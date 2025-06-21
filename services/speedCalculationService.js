const EventEmitter = require('events');
const winston = require('winston');

/**
 * Speed Calculation Service
 * 
 * Dedicated service for calculating vehicle speeds between camera points
 * based on ANPR detections and spatial relationships.
 */
class SpeedCalculationService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      minTimeBetweenDetections: config.minTimeBetweenDetections || 1000, // 1 second
      maxTimeBetweenDetections: config.maxTimeBetweenDetections || 300000, // 5 minutes
      minSpeedThreshold: config.minSpeedThreshold || 5, // 5 km/h
      maxSpeedThreshold: config.maxSpeedThreshold || 200, // 200 km/h
      confidenceThreshold: config.confidenceThreshold || 0.8,
      retentionHours: config.retentionHours || 24,
      ...config
    };

    this.logger = winston.createLogger({
      level: config.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    // Speed calculation storage
    this.detectionPoints = new Map(); // cameraId -> detection point config
    this.activeTracking = new Map(); // plateNumber -> tracking data
    this.speedCalculations = new Map(); // calculationId -> speed data
    this.speedAlerts = new Map(); // alertId -> alert data

    // Statistics
    this.stats = {
      totalDetections: 0,
      totalCalculations: 0,
      totalAlerts: 0,
      averageSpeed: 0,
      lastCalculation: null
    };

    this.logger.info('Speed Calculation Service initialized');
  }

  /**
   * Register a detection point (camera location)
   */
  async registerDetectionPoint(cameraId, config) {
    const detectionPoint = {
      id: cameraId,
      name: config.name,
      position: config.position, // { lat, lon } or { x, y }
      type: config.type || 'anpr',
      direction: config.direction, // 'northbound', 'southbound', etc.
      speedLimit: config.speedLimit,
      active: config.active !== false,
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        ...config.metadata
      }
    };

    this.detectionPoints.set(cameraId, detectionPoint);
    
    this.logger.info(`Registered detection point: ${cameraId} at ${JSON.stringify(config.position)}`);
    this.emit('detectionPoint:registered', detectionPoint);
    
    return detectionPoint;
  }

  /**
   * Process ANPR detection event
   */
  async processANPRDetection(event) {
    try {
      const { cameraId, plateNumber, timestamp, confidence, data = {} } = event;
      
      if (!plateNumber || confidence < this.config.confidenceThreshold) {
        return;
      }

      this.stats.totalDetections++;

      // Get detection point
      const detectionPoint = this.detectionPoints.get(cameraId);
      if (!detectionPoint || !detectionPoint.active) {
        return;
      }

      // Create or update tracking data
      const trackingData = this.getOrCreateTracking(plateNumber);
      
      // Add detection
      const detection = {
        cameraId,
        timestamp: new Date(timestamp),
        confidence,
        position: detectionPoint.position,
        direction: detectionPoint.direction,
        speedLimit: detectionPoint.speedLimit,
        data
      };

      trackingData.detections.push(detection);
      
      // Keep only recent detections (last 10)
      if (trackingData.detections.length > 10) {
        trackingData.detections = trackingData.detections.slice(-10);
      }

      trackingData.lastSeen = new Date(timestamp);

      // Check for speed calculation opportunities
      await this.checkSpeedCalculation(plateNumber, detection);

      this.logger.debug(`ANPR detection processed: ${plateNumber} at ${cameraId}`);
      
    } catch (error) {
      this.logger.error('Error processing ANPR detection:', error);
    }
  }

  /**
   * Process line crossing event from UniFi Protect
   * This method handles smartDetectLine events and integrates them with speed calculation
   */
  async processLineCrossingEvent(event) {
    try {
      const { cameraId, smartContext, timestamp, data = {} } = event;
      
      // Extract line crossing data
      const lineData = data.data || data;
      const trackingId = lineData.trackingId || smartContext?.trackingId;
      const objectType = lineData.smartDetectTypes?.[0] || smartContext?.objectType || 'vehicle';
      const confidence = lineData.score || smartContext?.confidence || 0.5;
      
      if (!trackingId || confidence < this.config.confidenceThreshold) {
        return;
      }

      this.stats.totalDetections++;

      // Get detection point
      const detectionPoint = this.detectionPoints.get(cameraId);
      if (!detectionPoint || !detectionPoint.active) {
        return;
      }

      // Create or update tracking data using tracking ID
      const trackingData = this.getOrCreateTrackingByTrackingId(trackingId);
      
      // Add line crossing detection
      const detection = {
        cameraId,
        trackingId,
        timestamp: new Date(timestamp),
        confidence,
        position: detectionPoint.position,
        direction: detectionPoint.direction,
        speedLimit: detectionPoint.speedLimit,
        objectType,
        detectionType: 'lineCrossing',
        lineData: {
          lineId: lineData.lineId,
          crossingDirection: lineData.crossingDirection, // 'in' or 'out'
          boundingBox: lineData.boundingBox,
          zone: lineData.zone
        },
        data: lineData
      };

      trackingData.detections.push(detection);
      
      // Keep only recent detections (last 10)
      if (trackingData.detections.length > 10) {
        trackingData.detections = trackingData.detections.slice(-10);
      }

      trackingData.lastSeen = new Date(timestamp);
      trackingData.objectType = objectType;

      // Check for speed calculation opportunities
      await this.checkSpeedCalculationByTrackingId(trackingId, detection);

      this.logger.debug(`Line crossing processed: ${trackingId} (${objectType}) at ${cameraId}`);
      
      // Emit line crossing event
      this.emit('lineCrossing:detected', {
        trackingId,
        cameraId,
        objectType,
        detection,
        timestamp
      });
      
    } catch (error) {
      this.logger.error('Error processing line crossing event:', error);
    }
  }

  /**
   * Get or create tracking data for a plate
   */
  getOrCreateTracking(plateNumber) {
    if (!this.activeTracking.has(plateNumber)) {
      this.activeTracking.set(plateNumber, {
        plateNumber,
        detections: [],
        firstSeen: new Date(),
        lastSeen: new Date(),
        speedCalculations: [],
        alerts: []
      });
    }
    return this.activeTracking.get(plateNumber);
  }

  /**
   * Get or create tracking data for a tracking ID (for line crossing)
   */
  getOrCreateTrackingByTrackingId(trackingId) {
    if (!this.activeTracking.has(trackingId)) {
      this.activeTracking.set(trackingId, {
        trackingId,
        detections: [],
        firstSeen: new Date(),
        lastSeen: new Date(),
        speedCalculations: [],
        alerts: [],
        objectType: 'unknown'
      });
    }
    return this.activeTracking.get(trackingId);
  }

  /**
   * Check for speed calculation opportunities
   */
  async checkSpeedCalculation(plateNumber, currentDetection) {
    const tracking = this.activeTracking.get(plateNumber);
    if (!tracking || tracking.detections.length < 2) {
      return;
    }

    // Get all detections for this plate
    const detections = tracking.detections;
    
    // Find pairs of detections that could be used for speed calculation
    for (let i = 0; i < detections.length - 1; i++) {
      for (let j = i + 1; j < detections.length; j++) {
        const detection1 = detections[i];
        const detection2 = detections[j];
        
        // Skip if same camera
        if (detection1.cameraId === detection2.cameraId) {
          continue;
        }

        // Check time constraints
        const timeDiff = Math.abs(detection2.timestamp - detection1.timestamp);
        if (timeDiff < this.config.minTimeBetweenDetections || 
            timeDiff > this.config.maxTimeBetweenDetections) {
          continue;
        }

        // Calculate speed
        const speedData = await this.calculateSpeed(detection1, detection2);
        if (speedData) {
          // Store calculation
          const calculationId = `${plateNumber}-${detection1.timestamp.getTime()}-${detection2.timestamp.getTime()}`;
          this.speedCalculations.set(calculationId, speedData);
          tracking.speedCalculations.push(speedData);
          
          this.stats.totalCalculations++;
          this.stats.lastCalculation = new Date().toISOString();
          
          // Update average speed
          this.updateAverageSpeed(speedData.speedKmh);
          
          // Check for speed alerts
          await this.checkSpeedAlert(speedData);
          
          this.emit('speed:calculated', speedData);
          this.logger.info(`Speed calculated for ${plateNumber}: ${speedData.speedKmh.toFixed(2)} km/h`);
        }
      }
    }
  }

  /**
   * Check for speed calculation opportunities using tracking ID
   */
  async checkSpeedCalculationByTrackingId(trackingId, currentDetection) {
    const tracking = this.activeTracking.get(trackingId);
    if (!tracking || tracking.detections.length < 2) {
      return;
    }

    // Get all detections for this tracking ID
    const detections = tracking.detections;
    
    // Find pairs of detections that could be used for speed calculation
    for (let i = 0; i < detections.length - 1; i++) {
      for (let j = i + 1; j < detections.length; j++) {
        const detection1 = detections[i];
        const detection2 = detections[j];
        
        // Skip if same camera
        if (detection1.cameraId === detection2.cameraId) {
          continue;
        }

        // Check time constraints
        const timeDiff = Math.abs(detection2.timestamp - detection1.timestamp);
        if (timeDiff < this.config.minTimeBetweenDetections || 
            timeDiff > this.config.maxTimeBetweenDetections) {
          continue;
        }

        // Calculate speed
        const speedData = await this.calculateSpeed(detection1, detection2);
        if (speedData) {
          // Store calculation
          const calculationId = `${trackingId}-${detection1.timestamp.getTime()}-${detection2.timestamp.getTime()}`;
          this.speedCalculations.set(calculationId, speedData);
          tracking.speedCalculations.push(speedData);
          
          this.stats.totalCalculations++;
          this.stats.lastCalculation = new Date().toISOString();
          
          // Update average speed
          this.updateAverageSpeed(speedData.speedKmh);
          
          // Check for speed alerts
          await this.checkSpeedAlert(speedData);
          
          this.emit('speed:calculated', speedData);
          this.logger.info(`Speed calculated for ${trackingId} (${tracking.objectType}): ${speedData.speedKmh.toFixed(2)} km/h`);
        }
      }
    }
  }

  /**
   * Calculate speed between two detection points
   */
  async calculateSpeed(detection1, detection2) {
    try {
      // Calculate distance between points
      const distance = this.calculateDistance(detection1.position, detection2.position);
      
      // Calculate time difference in hours
      const timeDiff = Math.abs(detection2.timestamp - detection1.timestamp);
      const timeHours = timeDiff / (1000 * 60 * 60);
      
      // Calculate speed in km/h
      const speedKmh = distance / timeHours;
      
      // Validate speed
      if (speedKmh < this.config.minSpeedThreshold || speedKmh > this.config.maxSpeedThreshold) {
        return null;
      }

      return {
        plateNumber: detection1.plateNumber,
        detection1: {
          cameraId: detection1.cameraId,
          timestamp: detection1.timestamp,
          position: detection1.position,
          direction: detection1.direction
        },
        detection2: {
          cameraId: detection2.cameraId,
          timestamp: detection2.timestamp,
          position: detection2.position,
          direction: detection2.direction
        },
        distance: distance, // km
        timeDiff: timeDiff, // milliseconds
        speedKmh: speedKmh,
        calculatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Error calculating speed:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two points (Haversine formula for lat/lon)
   */
  calculateDistance(pos1, pos2) {
    // If using lat/lon coordinates
    if (pos1.lat && pos1.lon && pos2.lat && pos2.lon) {
      const R = 6371; // Earth's radius in km
      const dLat = this.toRadians(pos2.lat - pos1.lat);
      const dLon = this.toRadians(pos2.lon - pos1.lon);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(pos1.lat)) * Math.cos(this.toRadians(pos2.lat)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }
    
    // If using x,y coordinates (assume meters, convert to km)
    if (pos1.x !== undefined && pos1.y !== undefined && 
        pos2.x !== undefined && pos2.y !== undefined) {
      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      return Math.sqrt(dx*dx + dy*dy) / 1000; // Convert to km
    }
    
    return 0;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Update average speed statistic
   */
  updateAverageSpeed(newSpeed) {
    if (this.stats.totalCalculations === 1) {
      this.stats.averageSpeed = newSpeed;
    } else {
      this.stats.averageSpeed = (this.stats.averageSpeed * (this.stats.totalCalculations - 1) + newSpeed) / this.stats.totalCalculations;
    }
  }

  /**
   * Check for speed alerts
   */
  async checkSpeedAlert(speedData) {
    const detection1 = speedData.detection1;
    const detection2 = speedData.detection2;
    
    // Check if either detection point has a speed limit
    const speedLimit1 = detection1.speedLimit;
    const speedLimit2 = detection2.speedLimit;
    const speedLimit = speedLimit1 || speedLimit2;
    
    if (speedLimit && speedData.speedKmh > speedLimit) {
      const alertData = {
        id: `speed-alert-${Date.now()}`,
        plateNumber: speedData.plateNumber,
        speedKmh: speedData.speedKmh,
        speedLimit: speedLimit,
        excess: speedData.speedKmh - speedLimit,
        detection1: detection1,
        detection2: detection2,
        timestamp: new Date().toISOString()
      };
      
      this.speedAlerts.set(alertData.id, alertData);
      this.stats.totalAlerts++;
      
      this.emit('speed:alert', alertData);
      this.logger.warn(`Speed alert: ${speedData.plateNumber} exceeded limit by ${alertData.excess.toFixed(2)} km/h`);
    }
  }

  /**
   * Get speed calculations with filters
   */
  getSpeedCalculations(filter = {}) {
    let calculations = Array.from(this.speedCalculations.values());
    
    if (filter.plateNumber) {
      calculations = calculations.filter(c => c.plateNumber === filter.plateNumber);
    }
    
    if (filter.minSpeed) {
      calculations = calculations.filter(c => c.speedKmh >= filter.minSpeed);
    }
    
    if (filter.maxSpeed) {
      calculations = calculations.filter(c => c.speedKmh <= filter.maxSpeed);
    }
    
    if (filter.startTime) {
      calculations = calculations.filter(c => c.calculatedAt >= filter.startTime);
    }
    
    if (filter.endTime) {
      calculations = calculations.filter(c => c.calculatedAt <= filter.endTime);
    }
    
    return calculations.sort((a, b) => new Date(b.calculatedAt) - new Date(a.calculatedAt));
  }

  /**
   * Get speed alerts
   */
  getSpeedAlerts(filter = {}) {
    let alerts = Array.from(this.speedAlerts.values());
    
    if (filter.plateNumber) {
      alerts = alerts.filter(a => a.plateNumber === filter.plateNumber);
    }
    
    if (filter.minExcess) {
      alerts = alerts.filter(a => a.excess >= filter.minExcess);
    }
    
    return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Get tracking data for a plate
   */
  getTrackingData(plateNumber) {
    return this.activeTracking.get(plateNumber);
  }

  /**
   * Get detection points
   */
  getDetectionPoints() {
    return Array.from(this.detectionPoints.values());
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      detectionPoints: this.detectionPoints.size,
      activeTracking: this.activeTracking.size,
      totalCalculations: this.speedCalculations.size,
      totalAlerts: this.speedAlerts.size
    };
  }

  /**
   * Clean up old data
   */
  cleanup() {
    const cutoffTime = new Date(Date.now() - this.config.retentionHours * 60 * 60 * 1000);
    
    // Clean up old speed calculations
    for (const [id, calculation] of this.speedCalculations.entries()) {
      if (new Date(calculation.calculatedAt) < cutoffTime) {
        this.speedCalculations.delete(id);
      }
    }
    
    // Clean up old alerts
    for (const [id, alert] of this.speedAlerts.entries()) {
      if (new Date(alert.timestamp) < cutoffTime) {
        this.speedAlerts.delete(id);
      }
    }
    
    // Clean up old tracking data
    for (const [plateNumber, tracking] of this.activeTracking.entries()) {
      if (tracking.lastSeen < cutoffTime) {
        this.activeTracking.delete(plateNumber);
      }
    }
    
    this.logger.info('Speed calculation service cleanup completed');
  }
}

module.exports = SpeedCalculationService; 