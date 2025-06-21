const EventEmitter = require('events');
const winston = require('winston');

/**
 * Zone Manager
 * 
 * Manages zones, their relationships, and camera coverage for multi-camera analytics.
 * Supports zone definitions, camera assignments, and zone-based event processing.
 */
class ZoneManager extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || winston.createLogger();
    
    // Zone storage
    this.zones = new Map();
    this.zoneTypes = new Map();
    
    // Camera-zone relationships
    this.cameraZones = new Map(); // cameraId -> zoneIds[]
    this.zoneCameras = new Map(); // zoneId -> cameraIds[]
    
    // Zone analytics
    this.zoneAnalytics = new Map();
    this.analyticsHistory = new Map();
    
    // Zone templates
    this.zoneTemplates = new Map();
    
    // Zone statistics
    this.stats = {
      totalZones: 0,
      zonesByType: new Map(),
      activeZones: 0,
      lastUpdate: null
    };
    
    this.logger.info('Zone Manager initialized');
  }
  
  /**
   * Create or update a zone
   */
  async createZone(zoneData) {
    try {
      // Validate zone data
      this.validateZoneData(zoneData);
      
      // Generate zone ID if not provided
      if (!zoneData.id) {
        zoneData.id = this.generateZoneId(zoneData.type);
      }
      
      // Add metadata
      zoneData.metadata = {
        ...zoneData.metadata,
        created: zoneData.metadata?.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        source: zoneData.metadata?.source || 'manual'
      };
      
      // Check if zone exists
      const existingZone = this.zones.get(zoneData.id);
      if (existingZone) {
        // Update existing zone
        const updatedZone = {
          ...existingZone,
          ...zoneData,
          metadata: {
            ...existingZone.metadata,
            ...zoneData.metadata,
            updated: new Date().toISOString()
          }
        };
        
        this.zones.set(zoneData.id, updatedZone);
        this.updateStats(updatedZone, 'update');
        
        this.logger.info(`Zone updated: ${zoneData.id} (${zoneData.type})`);
        this.emit('zone:updated', updatedZone);
        
        return updatedZone;
      } else {
        // Create new zone
        this.zones.set(zoneData.id, zoneData);
        this.updateStats(zoneData, 'create');
        
        // Initialize analytics for new zone
        this.zoneAnalytics.set(zoneData.id, {
          currentCount: 0,
          totalEvents: 0,
          lastEvent: null,
          occupancy: {
            current: 0,
            peak: 0,
            average: 0
          },
          speed: {
            average: 0,
            max: 0,
            min: 0,
            samples: 0
          }
        });
        
        this.logger.info(`Zone created: ${zoneData.id} (${zoneData.type})`);
        this.emit('zone:created', zoneData);
        
        return zoneData;
      }
    } catch (error) {
      this.logger.error('Error creating zone:', error);
      throw error;
    }
  }
  
  /**
   * Get zone by ID
   */
  getZone(zoneId) {
    return this.zones.get(zoneId);
  }
  
  /**
   * Get zones by filter
   */
  getZones(filter = {}) {
    let filtered = Array.from(this.zones.values());
    
    if (filter.type) {
      filtered = filtered.filter(z => z.type === filter.type);
    }
    
    if (filter.cameraId) {
      const zoneIds = this.cameraZones.get(filter.cameraId) || [];
      filtered = filtered.filter(z => zoneIds.includes(z.id));
    }
    
    if (filter.active !== undefined) {
      filtered = filtered.filter(z => z.active === filter.active);
    }
    
    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }
    
    return filtered;
  }
  
  /**
   * Assign camera to zone
   */
  async assignCameraToZone(cameraId, zoneId, coverage = {}) {
    try {
      const zone = this.zones.get(zoneId);
      if (!zone) {
        throw new Error(`Zone not found: ${zoneId}`);
      }
      
      // Add camera to zone
      if (!this.zoneCameras.has(zoneId)) {
        this.zoneCameras.set(zoneId, new Set());
      }
      this.zoneCameras.get(zoneId).add(cameraId);
      
      // Add zone to camera
      if (!this.cameraZones.has(cameraId)) {
        this.cameraZones.set(cameraId, new Set());
      }
      this.cameraZones.get(cameraId).add(zoneId);
      
      // Update zone with camera coverage data
      const updatedZone = {
        ...zone,
        cameras: Array.from(this.zoneCameras.get(zoneId)),
        coverage: {
          ...zone.coverage,
          [cameraId]: coverage
        }
      };
      
      this.zones.set(zoneId, updatedZone);
      
      this.logger.info(`Camera ${cameraId} assigned to zone ${zoneId}`);
      this.emit('camera:assigned', { cameraId, zoneId, coverage });
      
      return updatedZone;
    } catch (error) {
      this.logger.error('Error assigning camera to zone:', error);
      throw error;
    }
  }
  
  /**
   * Remove camera from zone
   */
  async removeCameraFromZone(cameraId, zoneId) {
    try {
      const zone = this.zones.get(zoneId);
      if (!zone) {
        throw new Error(`Zone not found: ${zoneId}`);
      }
      
      // Remove camera from zone
      if (this.zoneCameras.has(zoneId)) {
        this.zoneCameras.get(zoneId).delete(cameraId);
      }
      
      // Remove zone from camera
      if (this.cameraZones.has(cameraId)) {
        this.cameraZones.get(cameraId).delete(zoneId);
      }
      
      // Update zone
      const updatedZone = {
        ...zone,
        cameras: Array.from(this.zoneCameras.get(zoneId) || []),
        coverage: {
          ...zone.coverage
        }
      };
      delete updatedZone.coverage[cameraId];
      
      this.zones.set(zoneId, updatedZone);
      
      this.logger.info(`Camera ${cameraId} removed from zone ${zoneId}`);
      this.emit('camera:removed', { cameraId, zoneId });
      
      return updatedZone;
    } catch (error) {
      this.logger.error('Error removing camera from zone:', error);
      throw error;
    }
  }
  
  /**
   * Get zones for a camera
   */
  getZonesForCamera(cameraId) {
    const zoneIds = this.cameraZones.get(cameraId) || [];
    return zoneIds.map(id => this.zones.get(id)).filter(Boolean);
  }
  
  /**
   * Get cameras for a zone
   */
  getCamerasForZone(zoneId) {
    const cameraIds = this.zoneCameras.get(zoneId) || [];
    return Array.from(cameraIds);
  }
  
  /**
   * Process event for zone analytics
   */
  async processZoneEvent(event) {
    try {
      const { cameraId, zoneId, eventType, data } = event;
      
      if (!zoneId || !this.zones.has(zoneId)) {
        return;
      }
      
      const analytics = this.zoneAnalytics.get(zoneId);
      if (!analytics) {
        return;
      }
      
      // Update analytics based on event type
      switch (eventType) {
        case 'motion':
          analytics.totalEvents++;
          analytics.lastEvent = new Date().toISOString();
          break;
          
        case 'person_entered':
          analytics.currentCount++;
          analytics.occupancy.current = Math.max(analytics.occupancy.current, analytics.currentCount);
          analytics.occupancy.peak = Math.max(analytics.occupancy.peak, analytics.currentCount);
          break;
          
        case 'person_exited':
          analytics.currentCount = Math.max(0, analytics.currentCount - 1);
          break;
          
        case 'vehicle_speed':
          if (data.speed) {
            analytics.speed.samples++;
            analytics.speed.average = (analytics.speed.average * (analytics.speed.samples - 1) + data.speed) / analytics.speed.samples;
            analytics.speed.max = Math.max(analytics.speed.max, data.speed);
            analytics.speed.min = analytics.speed.min === 0 ? data.speed : Math.min(analytics.speed.min, data.speed);
          }
          break;
      }
      
      // Store in history
      this.storeAnalyticsHistory(zoneId, analytics);
      
      this.emit('analytics:updated', { zoneId, analytics, event });
      
    } catch (error) {
      this.logger.error('Error processing zone event:', error);
    }
  }
  
  /**
   * Calculate speed between zones
   */
  async calculateZoneSpeed(plateNumber, zone1Id, zone2Id, timestamp1, timestamp2) {
    try {
      const zone1 = this.zones.get(zone1Id);
      const zone2 = this.zones.get(zone2Id);
      
      if (!zone1 || !zone2) {
        throw new Error('One or both zones not found');
      }
      
      // Calculate distance between zones
      const distance = this.calculateZoneDistance(zone1, zone2);
      
      // Calculate time difference
      const timeDiff = new Date(timestamp2) - new Date(timestamp1);
      const timeHours = timeDiff / (1000 * 60 * 60); // Convert to hours
      
      // Calculate speed in km/h
      const speedKmh = distance / timeHours;
      
      return {
        plateNumber,
        zone1Id,
        zone2Id,
        distance,
        timeDiff,
        speedKmh,
        timestamp1,
        timestamp2
      };
    } catch (error) {
      this.logger.error('Error calculating zone speed:', error);
      throw error;
    }
  }
  
  /**
   * Calculate distance between zones
   */
  calculateZoneDistance(zone1, zone2) {
    // Simple Euclidean distance calculation
    // In a real implementation, this would use GPS coordinates or map data
    const dx = (zone1.location?.x || 0) - (zone2.location?.x || 0);
    const dy = (zone1.location?.y || 0) - (zone2.location?.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Get zone analytics
   */
  getZoneAnalytics(zoneId) {
    return this.zoneAnalytics.get(zoneId);
  }
  
  /**
   * Get analytics history
   */
  getAnalyticsHistory(zoneId, limit = 100) {
    const history = this.analyticsHistory.get(zoneId) || [];
    return history.slice(-limit);
  }
  
  /**
   * Store analytics history
   */
  storeAnalyticsHistory(zoneId, analytics) {
    if (!this.analyticsHistory.has(zoneId)) {
      this.analyticsHistory.set(zoneId, []);
    }
    
    const history = this.analyticsHistory.get(zoneId);
    history.push({
      ...analytics,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }
  
  /**
   * Validate zone data
   */
  validateZoneData(zoneData) {
    if (!zoneData.name) {
      throw new Error('Zone name is required');
    }
    
    if (!zoneData.type) {
      throw new Error('Zone type is required');
    }
    
    if (!zoneData.location) {
      throw new Error('Zone location is required');
    }
  }
  
  /**
   * Generate zone ID
   */
  generateZoneId(type) {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Update statistics
   */
  updateStats(zone, operation) {
    this.stats.totalZones = this.zones.size;
    this.stats.lastUpdate = new Date().toISOString();
    
    // Update type statistics
    if (!this.stats.zonesByType.has(zone.type)) {
      this.stats.zonesByType.set(zone.type, 0);
    }
    
    if (operation === 'create') {
      this.stats.zonesByType.set(zone.type, this.stats.zonesByType.get(zone.type) + 1);
    }
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      zonesByType: Object.fromEntries(this.stats.zonesByType),
      totalCameras: this.cameraZones.size,
      totalZoneCameras: this.zoneCameras.size
    };
  }
  
  /**
   * Export zones
   */
  exportZones(filter = {}) {
    const zones = this.getZones(filter);
    return zones.map(zone => ({
      ...zone,
      cameras: this.getCamerasForZone(zone.id),
      analytics: this.getZoneAnalytics(zone.id)
    }));
  }
}

module.exports = ZoneManager; 