const winston = require('winston');

/**
 * Prestwick Airport Aircraft Operations Service
 * Tracks aircraft approaching, landing, and taking off at EGPK
 */
class PrestwickAirportService {
  constructor(config = {}) {
    this.config = {
      airportCode: 'EGPK',
      airportName: 'Prestwick Airport',
      latitude: 55.5094,
      longitude: -4.5867,
      elevation: 20, // meters
      approachRadius: 50000, // 50km approach radius
      runwayThreshold: 5000, // 5km runway threshold
      ...config
    };

    // Runway definitions for EGPK
    this.runways = {
      '12': {
        name: 'Runway 12',
        heading: 120,
        latitude: 55.5094,
        longitude: -4.5867,
        length: 2987, // meters
        threshold: {
          latitude: 55.5094,
          longitude: -4.5867
        }
      },
      '30': {
        name: 'Runway 30',
        heading: 300,
        latitude: 55.5094,
        longitude: -4.5867,
        length: 2987, // meters
        threshold: {
          latitude: 55.5094,
          longitude: -4.5867
        }
      }
    };

    // Aircraft tracking state
    this.trackedAircraft = new Map();
    this.aircraftHistory = [];
    this.maxHistorySize = 1000;

    // Event callbacks
    this.eventCallbacks = {
      approach: [],
      landing: [],
      takeoff: [],
      departure: [],
      en_route: [],
      'notam:alert': [],
      'notam:new': []
    };

    // Statistics
    this.stats = {
      totalApproaches: 0,
      totalLandings: 0,
      totalTakeoffs: 0,
      totalDepartures: 0,
      totalEnRoute: 0,
      notamQueries: 0,
      notamAlerts: 0,
      lastUpdate: new Date().toISOString()
    };

    // NOTAM integration
    this.notamConnector = null;
    this.notamConfig = {
      enabled: true,
      searchRadius: 50, // km around Prestwick
      checkOnApproach: true,
      checkOnLanding: true,
      checkOnTakeoff: true,
      priorityThreshold: 'medium'
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'prestwick-airport' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });

    // New NOTAM monitoring state
    this.seenNotams = new Set();
    this.notamMonitoringInterval = null;
  }

  /**
   * Calculate distance between two points in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate bearing between two points
   */
  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = this.toRadians(lon2 - lon1);
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * (180 / Math.PI);
    return (bearing + 360) % 360;
  }

  /**
   * Determine which runway an aircraft is approaching
   */
  determineRunway(aircraftLat, aircraftLon, aircraftHeading) {
    const distances = {};
    
    for (const [runwayId, runway] of Object.entries(this.runways)) {
      const distance = this.calculateDistance(
        aircraftLat, aircraftLon,
        runway.threshold.latitude, runway.threshold.longitude
      );
      
      const bearing = this.calculateBearing(
        aircraftLat, aircraftLon,
        runway.threshold.latitude, runway.threshold.longitude
      );
      
      // Calculate heading difference
      let headingDiff = Math.abs(aircraftHeading - bearing);
      if (headingDiff > 180) {
        headingDiff = 360 - headingDiff;
      }
      
      // Score based on distance and heading alignment
      const distanceScore = Math.max(0, 1 - (distance / this.config.approachRadius));
      const headingScore = Math.max(0, 1 - (headingDiff / 45)); // 45 degrees tolerance
      const score = (distanceScore * 0.7) + (headingScore * 0.3);
      
      distances[runwayId] = {
        distance,
        bearing,
        headingDiff,
        score,
        runway
      };
    }
    
    // Return the runway with the best score
    const bestRunway = Object.entries(distances).reduce((best, [id, data]) => {
      return data.score > best.score ? { id, ...data } : best;
    }, { id: null, score: 0 });
    
    return bestRunway.id ? { id: bestRunway.id, ...bestRunway } : null;
  }

  /**
   * Process aircraft position update
   */
  processAircraftUpdate(aircraftData) {
    const {
      icao24,
      callsign,
      registration,
      latitude,
      longitude,
      altitude,
      speed,
      heading,
      squawk,
      timestamp
    } = aircraftData;

    if (!icao24 || !latitude || !longitude) {
      return null;
    }

    const distance = this.calculateDistance(
      latitude, longitude,
      this.config.latitude, this.config.longitude
    );

    // Only track aircraft within approach radius
    if (distance > this.config.approachRadius) {
      // Remove from tracking if aircraft is too far
      if (this.trackedAircraft.has(icao24)) {
        this.trackedAircraft.delete(icao24);
      }
      return null;
    }

    const runwayInfo = this.determineRunway(latitude, longitude, heading);
    const aircraftState = this.determineAircraftState(aircraftData, distance, runwayInfo);

    // Update tracked aircraft
    const previousState = this.trackedAircraft.get(icao24);
    this.trackedAircraft.set(icao24, {
      ...aircraftData,
      distance,
      runwayInfo,
      state: aircraftState,
      timestamp: timestamp || new Date().toISOString()
    });

    // Check for state transitions
    if (previousState && previousState.state !== aircraftState) {
      this.handleStateTransition(icao24, previousState, aircraftState, aircraftData);
    }

    // Add to history
    this.addToHistory({
      icao24,
      callsign,
      registration,
      latitude,
      longitude,
      altitude,
      speed,
      heading,
      squawk,
      distance,
      runwayInfo,
      state: aircraftState,
      timestamp: timestamp || new Date().toISOString()
    });

    return {
      icao24,
      callsign,
      registration,
      distance,
      runwayInfo,
      state: aircraftState,
      altitude,
      speed,
      heading
    };
  }

  /**
   * Determine aircraft state based on position and altitude
   */
  determineAircraftState(aircraftData, distance, runwayInfo) {
    const { altitude, speed, heading } = aircraftData;
    
    // En route: High altitude, not in approach pattern (check this first)
    if (altitude > 3000) {
      return 'en_route';
    }
    
    // Approach: Aircraft descending and within approach radius
    if (altitude < 3000 && altitude > 500 && distance < this.config.approachRadius && speed > 50) {
      return 'approach';
    }
    
    // Landing: Very low altitude near runway
    if (altitude < 500 && distance < this.config.runwayThreshold) {
      return 'landing';
    }
    
    // Takeoff: Low altitude, increasing, near runway
    if (altitude < 1000 && distance < this.config.runwayThreshold && speed > 100) {
      return 'takeoff';
    }
    
    // Departure: Climbing away from airport (but not yet en route)
    if (altitude > 1000 && altitude <= 3000 && distance > this.config.runwayThreshold && speed > 100) {
      return 'departure';
    }
    
    return 'unknown';
  }

  /**
   * Handle aircraft state transition and trigger events
   */
  async handleStateTransition(icao24, previousState, newState, aircraftData) {
    const event = {
      id: `prestwick-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: `aircraft:${newState}`,
      source: 'prestwick-airport',
      timestamp: new Date().toISOString(),
      data: {
        icao24,
        callsign: aircraftData.callsign,
        registration: aircraftData.registration,
        previousState,
        newState,
        runway: previousState.runwayInfo?.id || 'unknown',
        runwayName: previousState.runwayInfo?.runway?.name || 'Unknown Runway',
        altitude: aircraftData.altitude,
        speed: aircraftData.speed,
        heading: aircraftData.heading,
        distance: previousState.distance,
        squawk: aircraftData.squawk,
        airport: {
          code: this.config.airportCode,
          name: this.config.airportName,
          latitude: this.config.latitude,
          longitude: this.config.longitude
        }
      }
    };

    // Update statistics
    switch (newState) {
      case 'approach':
        this.stats.totalApproaches++;
        break;
      case 'landing':
        this.stats.totalLandings++;
        break;
      case 'takeoff':
        this.stats.totalTakeoffs++;
        break;
      case 'departure':
        this.stats.totalDepartures++;
        break;
      case 'en_route':
        this.stats.totalEnRoute++;
        break;
    }

    this.stats.lastUpdate = new Date().toISOString();

    // Log the event
    this.logger.info(`Aircraft ${newState} event`, {
      icao24,
      callsign: aircraftData.callsign,
      runway: event.data.runway,
      altitude: aircraftData.altitude,
      speed: aircraftData.speed
    });

    // Check for NOTAMs and send Telegram notifications
    if (this.notamConnector && this.notamConfig.enabled) {
      try {
        const aircraftPosition = {
          lat: aircraftData.latitude,
          lon: aircraftData.longitude
        };
        
        const notamAlerts = await this.getNotamAlerts(aircraftPosition, newState);
        
        if (notamAlerts.length > 0) {
          this.logger.info(`Found ${notamAlerts.length} NOTAM alerts for ${newState} operation`);
          
          // Send Telegram notifications for each NOTAM alert
          for (const alert of notamAlerts) {
            // Emit event for NOTAM alert
            if (this.eventCallbacks['notam:alert']) {
              this.eventCallbacks['notam:alert'].forEach(callback => {
                try {
                  callback({
                    ...event,
                    type: 'notam:alert',
                    data: { ...event.data, notamAlert: alert }
                  });
                } catch (error) {
                  this.logger.error('Error in NOTAM alert callback', { error: error.message });
                }
              });
            }
          }
        }
      } catch (error) {
        this.logger.error('Error checking NOTAMs during state transition', { error: error.message });
      }
    }

    // Trigger callbacks
    if (this.eventCallbacks[newState]) {
      this.eventCallbacks[newState].forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          this.logger.error('Error in event callback', { error: error.message });
        }
      });
    }

    return event;
  }

  /**
   * Add aircraft data to history
   */
  addToHistory(aircraftData) {
    this.aircraftHistory.unshift(aircraftData);
    
    // Keep only the last maxHistorySize entries
    if (this.aircraftHistory.length > this.maxHistorySize) {
      this.aircraftHistory = this.aircraftHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Register event callback
   */
  on(eventType, callback) {
    if (this.eventCallbacks[eventType]) {
      this.eventCallbacks[eventType].push(callback);
    }
  }

  /**
   * Get tracked aircraft
   */
  getTrackedAircraft() {
    return Array.from(this.trackedAircraft.values());
  }

  /**
   * Get aircraft history
   */
  getAircraftHistory(limit = 100) {
    return this.aircraftHistory.slice(0, limit);
  }

  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Get runway information
   */
  getRunways() {
    return { ...this.runways };
  }

  /**
   * Get airport configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.aircraftHistory = [];
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalApproaches: 0,
      totalLandings: 0,
      totalTakeoffs: 0,
      totalDepartures: 0,
      totalEnRoute: 0,
      notamQueries: 0,
      notamAlerts: 0,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Set NOTAM connector reference
   */
  setNotamConnector(notamConnector) {
    this.notamConnector = notamConnector;
    this.logger.info('NOTAM connector integrated with Prestwick service');
  }

  /**
   * Query NOTAMs related to Prestwick Airport
   */
  async queryNotams(radius = 50, category = null, priority = null, aircraftPosition = null) {
    if (!this.notamConnector) {
      this.logger.warn('NOTAM connector not available');
      return [];
    }

    try {
      this.stats.notamQueries++;
      
      // Use aircraft position if provided, otherwise use airport position
      const searchPosition = aircraftPosition || {
        lat: this.config.latitude,
        lon: this.config.longitude
      };

      // Get all NOTAMs from the connector
      const allNotams = this.notamConnector.getNOTAMs();
      
      // Filter NOTAMs by distance and add distance information
      const nearbyNotams = allNotams.filter(notam => {
        if (!notam.position || !notam.position.lat || !notam.position.lon) {
          return false;
        }
        
        const distance = this.calculateDistance(
          searchPosition.lat, searchPosition.lon,
          notam.position.lat, notam.position.lon
        ) / 1000; // Convert to km
        
        notam.distance = distance;
        return distance <= radius;
      });

      // Filter by category if specified
      let filteredNotams = nearbyNotams;
      if (category && category !== 'all') {
        filteredNotams = filteredNotams.filter(notam => notam.category === category);
      }

      // Filter by priority if specified
      if (priority && priority !== 'all') {
        filteredNotams = filteredNotams.filter(notam => notam.priority === priority);
      }

      // Sort by distance
      filteredNotams.sort((a, b) => a.distance - b.distance);

      this.logger.info(`Found ${filteredNotams.length} NOTAMs within ${radius}km of Prestwick`);
      return filteredNotams;

    } catch (error) {
      this.logger.error('Error querying NOTAMs', { error: error.message });
      return [];
    }
  }

  /**
   * Check specific NOTAM details
   */
  async checkNotam(notamId) {
    if (!this.notamConnector) {
      this.logger.warn('NOTAM connector not available');
      return null;
    }

    try {
      const notam = await this.notamConnector.executeCapability(
        'notam:tracking',
        'get',
        { notamId }
      );

      if (notam) {
        this.logger.info(`Retrieved NOTAM details for ${notamId}`);
        return notam;
      } else {
        this.logger.warn(`NOTAM ${notamId} not found`);
        return null;
      }

    } catch (error) {
      this.logger.error('Error checking NOTAM', { error: error.message, notamId });
      return null;
    }
  }

  /**
   * Get NOTAM alerts for aircraft operations
   */
  async getNotamAlerts(aircraftPosition, operationType = 'approach') {
    if (!this.notamConnector || !this.notamConfig.enabled) {
      return [];
    }

    try {
      // Check if we should check NOTAMs for this operation type
      const shouldCheck = this.shouldCheckNotamsForOperation(operationType);
      if (!shouldCheck) {
        return [];
      }

      // Query NOTAMs around the aircraft position
      const nearbyNotams = await this.queryNotams(
        this.notamConfig.searchRadius,
        null,
        this.notamConfig.priorityThreshold,
        aircraftPosition
      );

      // Filter NOTAMs that are relevant to the operation
      const relevantNotams = this.filterRelevantNotams(nearbyNotams, operationType);

      if (relevantNotams.length > 0) {
        this.stats.notamAlerts++;
        this.logger.info(`Found ${relevantNotams.length} relevant NOTAMs for ${operationType} operation`);
        
        // Generate alerts
        const alerts = relevantNotams.map(notam => ({
          type: 'notam:alert',
          notamId: notam.id,
          notamNumber: notam.notamNumber,
          title: notam.title,
          description: notam.description,
          priority: notam.priority,
          category: notam.category,
          distance: notam.distance,
          operationType,
          aircraftPosition,
          timestamp: new Date().toISOString()
        }));

        return alerts;
      }

      return [];

    } catch (error) {
      this.logger.error('Error getting NOTAM alerts', { error: error.message });
      return [];
    }
  }

  /**
   * Check if NOTAMs should be checked for a specific operation
   */
  shouldCheckNotamsForOperation(operationType) {
    switch (operationType) {
      case 'approach':
        return this.notamConfig.checkOnApproach;
      case 'landing':
        return this.notamConfig.checkOnLanding;
      case 'takeoff':
        return this.notamConfig.checkOnTakeoff;
      default:
        return false;
    }
  }

  /**
   * Filter NOTAMs that are relevant to the aircraft operation
   */
  filterRelevantNotams(notams, operationType) {
    return notams.filter(notam => {
      // Check if NOTAM is active
      const now = new Date();
      if (notam.endTime && now > notam.endTime) {
        return false;
      }
      if (notam.startTime && now < notam.startTime) {
        return false;
      }

      // Check if NOTAM is relevant to the operation
      const relevantCategories = this.getRelevantCategories(operationType);
      if (relevantCategories.length > 0 && !relevantCategories.includes(notam.category)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get relevant NOTAM categories for an operation
   */
  getRelevantCategories(operationType) {
    switch (operationType) {
      case 'approach':
      case 'landing':
        return ['runway', 'approach', 'landing', 'airport', 'navigation'];
      case 'takeoff':
        return ['runway', 'takeoff', 'airport', 'navigation'];
      default:
        return [];
    }
  }

  /**
   * Monitor for new NOTAMs in Prestwick's airspace
   */
  async monitorPrestwickNotams() {
    if (!this.notamConnector || !this.notamConfig.enabled) {
      return [];
    }

    try {
      // Query NOTAMs within Prestwick's airspace (50km radius)
      const prestwickNotams = await this.queryNotams(
        50, // 50km radius around Prestwick
        null, // All categories
        'medium', // Medium priority and above
        { lat: this.config.latitude, lon: this.config.longitude }
      );

      // Filter for active NOTAMs that affect Prestwick operations
      const activeNotams = prestwickNotams.filter(notam => {
        const now = new Date();
        
        // Check if NOTAM is active
        if (notam.endTime && now > notam.endTime) {
          return false;
        }
        if (notam.startTime && now < notam.startTime) {
          return false;
        }

        // Check if NOTAM is relevant to Prestwick operations
        const relevantCategories = ['runway', 'approach', 'landing', 'takeoff', 'airport', 'navigation', 'airspace'];
        if (relevantCategories.includes(notam.category)) {
          return true;
        }

        // Check if NOTAM mentions Prestwick or EGPK
        const description = (notam.description || '').toLowerCase();
        const title = (notam.title || '').toLowerCase();
        if (description.includes('prestwick') || description.includes('egpk') || 
            title.includes('prestwick') || title.includes('egpk')) {
          return true;
        }

        return false;
      });

      // Check for new NOTAMs (not previously seen)
      const newNotams = activeNotams.filter(notam => {
        return !this.seenNotams.has(notam.id);
      });

      // Add new NOTAMs to seen set
      newNotams.forEach(notam => {
        this.seenNotams.add(notam.id);
      });

      // Generate alarms for new NOTAMs
      if (newNotams.length > 0) {
        this.logger.info(`Found ${newNotams.length} new NOTAMs affecting Prestwick airspace`);
        
        const alarms = newNotams.map(notam => ({
          type: 'notam:new',
          notamId: notam.id,
          notamNumber: notam.notamNumber,
          title: notam.title,
          description: notam.description,
          priority: notam.priority,
          category: notam.category,
          distance: notam.distance,
          startTime: notam.startTime,
          endTime: notam.endTime,
          affectedArea: notam.affectedArea,
          airport: {
            code: this.config.airportCode,
            name: this.config.airportName,
            latitude: this.config.latitude,
            longitude: this.config.longitude
          },
          timestamp: new Date().toISOString()
        }));

        return alarms;
      }

      return [];

    } catch (error) {
      this.logger.error('Error monitoring Prestwick NOTAMs', { error: error.message });
      return [];
    }
  }

  /**
   * Start NOTAM monitoring for Prestwick airspace
   */
  startNotamMonitoring() {
    if (this.notamMonitoringInterval) {
      clearInterval(this.notamMonitoringInterval);
    }

    // Check for new NOTAMs every 5 minutes
    this.notamMonitoringInterval = setInterval(async () => {
      try {
        const newNotamAlarms = await this.monitorPrestwickNotams();
        
        if (newNotamAlarms.length > 0) {
          // Emit events for each new NOTAM
          newNotamAlarms.forEach(alarm => {
            if (this.eventCallbacks['notam:new']) {
              this.eventCallbacks['notam:new'].forEach(callback => {
                try {
                  callback({
                    type: 'notam:new',
                    data: alarm,
                    timestamp: new Date().toISOString()
                  });
                } catch (error) {
                  this.logger.error('Error in NOTAM new callback', { error: error.message });
                }
              });
            }
          });
        }
      } catch (error) {
        this.logger.error('Error in NOTAM monitoring interval', { error: error.message });
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.logger.info('Started NOTAM monitoring for Prestwick airspace');
  }

  /**
   * Stop NOTAM monitoring
   */
  stopNotamMonitoring() {
    if (this.notamMonitoringInterval) {
      clearInterval(this.notamMonitoringInterval);
      this.notamMonitoringInterval = null;
      this.logger.info('Stopped NOTAM monitoring for Prestwick airspace');
    }
  }
}

module.exports = PrestwickAirportService; 