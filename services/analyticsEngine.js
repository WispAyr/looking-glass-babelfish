const EventEmitter = require('events');
const winston = require('winston');

/**
 * Analytics Engine
 * 
 * Processes camera events to derive context and analytics.
 * Handles speed calculations, people counting, cross-zone tracking, and plate recognition.
 */
class AnalyticsEngine extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || winston.createLogger();
    
    // Analytics storage
    this.analytics = new Map();
    this.eventHistory = new Map();
    this.trackingData = new Map();
    
    // Plate tracking for speed calculations
    this.plateTracking = new Map(); // plateNumber -> tracking data
    this.speedCalculations = new Map();
    
    // People counting
    this.peopleCounts = new Map(); // zoneId -> count
    this.occupancyHistory = new Map();
    
    // Cross-zone tracking
    this.crossZoneEvents = new Map();
    this.zoneTransitions = new Map();
    
    // Analytics rules
    this.analyticsRules = new Map();
    
    // Statistics
    this.stats = {
      totalEvents: 0,
      processedEvents: 0,
      speedCalculations: 0,
      peopleCounts: 0,
      crossZoneEvents: 0,
      lastUpdate: null
    };
    
    this.logger.info('Analytics Engine initialized');
  }
  
  /**
   * Process camera event for analytics
   */
  async processEvent(event) {
    try {
      this.stats.totalEvents++;
      
      const { cameraId, eventType, data, timestamp } = event;
      
      // Store event in history
      this.storeEventHistory(cameraId, event);
      
      // Process based on event type
      switch (eventType) {
        case 'motion':
          await this.processMotionEvent(event);
          break;
          
        case 'smartDetected':
          await this.processSmartDetectionEvent(event);
          break;
          
        case 'plateDetected':
          await this.processPlateDetectionEvent(event);
          break;
          
        case 'personDetected':
          await this.processPersonDetectionEvent(event);
          break;
          
        case 'vehicleDetected':
          await this.processVehicleDetectionEvent(event);
          break;
      }
      
      this.stats.processedEvents++;
      this.stats.lastUpdate = new Date().toISOString();
      
      this.emit('analytics:processed', { event, stats: this.stats });
      
    } catch (error) {
      this.logger.error('Error processing analytics event:', error);
    }
  }
  
  /**
   * Process motion detection event
   */
  async processMotionEvent(event) {
    const { cameraId, data, timestamp } = event;
    
    // Update motion analytics
    const analytics = this.getOrCreateAnalytics(cameraId);
    analytics.motionEvents++;
    analytics.lastMotionEvent = timestamp;
    
    // Check for zone-specific processing
    if (data.zone) {
      await this.processZoneMotionEvent(event);
    }
  }
  
  /**
   * Process smart detection event
   */
  async processSmartDetectionEvent(event) {
    const { cameraId, data, timestamp } = event;
    
    const analytics = this.getOrCreateAnalytics(cameraId);
    
    // Enhanced smart detection processing with context
    const smartContext = {
      objectType: data.objectType || data.type,
      confidence: data.confidence || data.score || 0,
      zone: data.zone,
      location: data.location,
      trackingId: data.trackingId,
      boundingBox: data.boundingBox,
      attributes: data.attributes || {},
      timestamp: timestamp
    };
    
    // Store smart detection context
    if (!analytics.smartDetections) {
      analytics.smartDetections = [];
    }
    analytics.smartDetections.push(smartContext);
    
    // Keep only recent detections (last 100)
    if (analytics.smartDetections.length > 100) {
      analytics.smartDetections = analytics.smartDetections.slice(-100);
    }
    
    // Process based on detected object type with enhanced context
    switch (smartContext.objectType) {
      case 'person':
        await this.processPersonDetectionEvent({ ...event, smartContext });
        break;
        
      case 'vehicle':
        await this.processVehicleDetectionEvent({ ...event, smartContext });
        break;
        
      case 'animal':
        await this.processAnimalDetectionEvent({ ...event, smartContext });
        break;
        
      case 'package':
        await this.processPackageDetectionEvent({ ...event, smartContext });
        break;
        
      case 'face':
        await this.processFaceDetectionEvent({ ...event, smartContext });
        break;
        
      default:
        await this.processGenericSmartDetectionEvent({ ...event, smartContext });
    }
    
    analytics.smartDetections++;
    analytics.lastSmartDetection = timestamp;
    
    // Emit smart detection event with context
    this.emit('smart:detected', {
      cameraId,
      smartContext,
      analytics: this.getSmartDetectionAnalytics(cameraId)
    });
    
    // Check for patterns and anomalies
    await this.analyzeSmartDetectionPatterns(cameraId, smartContext);
  }
  
  /**
   * Process person detection event with enhanced context
   */
  async processPersonDetectionEvent(event) {
    const { cameraId, data, timestamp, smartContext } = event;
    
    const analytics = this.getOrCreateAnalytics(cameraId);
    analytics.personDetections++;
    
    // Enhanced person tracking
    if (smartContext.trackingId) {
      await this.trackPersonMovement(smartContext.trackingId, cameraId, smartContext.zone, timestamp, smartContext);
    }
    
    // Update people counting if zone is specified
    if (smartContext.zone) {
      await this.updatePeopleCount(smartContext.zone, data.direction || 'entered', smartContext);
    }
    
    // Store person detection context
    if (!analytics.personDetections) {
      analytics.personDetections = [];
    }
    analytics.personDetections.push({
      ...smartContext,
      confidence: smartContext.confidence,
      attributes: smartContext.attributes
    });
    
    // Keep only recent person detections (last 50)
    if (analytics.personDetections.length > 50) {
      analytics.personDetections = analytics.personDetections.slice(-50);
    }
    
    this.logger.info(`Person detected on camera ${cameraId} with confidence ${smartContext.confidence}`);
  }
  
  /**
   * Process vehicle detection event with enhanced context
   */
  async processVehicleDetectionEvent(event) {
    const { cameraId, data, timestamp, smartContext } = event;
    
    const analytics = this.getOrCreateAnalytics(cameraId);
    analytics.vehicleDetections++;
    
    // Enhanced vehicle tracking
    if (smartContext.trackingId) {
      await this.trackVehicleMovement(smartContext.trackingId, cameraId, smartContext.zone, timestamp, smartContext);
    }
    
    // Update vehicle counting if zone is specified
    if (smartContext.zone) {
      await this.updateVehicleCount(smartContext.zone, data.direction || 'entered', smartContext);
    }
    
    // Store vehicle detection context
    if (!analytics.vehicleDetections) {
      analytics.vehicleDetections = [];
    }
    analytics.vehicleDetections.push({
      ...smartContext,
      confidence: smartContext.confidence,
      attributes: smartContext.attributes
    });
    
    // Keep only recent vehicle detections (last 50)
    if (analytics.vehicleDetections.length > 50) {
      analytics.vehicleDetections = analytics.vehicleDetections.slice(-50);
    }
    
    this.logger.info(`Vehicle detected on camera ${cameraId} with confidence ${smartContext.confidence}`);
  }
  
  /**
   * Process animal detection event
   */
  async processAnimalDetectionEvent(event) {
    const { cameraId, data, timestamp, smartContext } = event;
    
    const analytics = this.getOrCreateAnalytics(cameraId);
    analytics.animalDetections = (analytics.animalDetections || 0) + 1;
    
    // Store animal detection context
    if (!analytics.animalDetections) {
      analytics.animalDetections = [];
    }
    analytics.animalDetections.push({
      ...smartContext,
      confidence: smartContext.confidence,
      attributes: smartContext.attributes
    });
    
    // Keep only recent animal detections (last 30)
    if (analytics.animalDetections.length > 30) {
      analytics.animalDetections = analytics.animalDetections.slice(-30);
    }
    
    this.logger.info(`Animal detected on camera ${cameraId} with confidence ${smartContext.confidence}`);
  }
  
  /**
   * Process package detection event
   */
  async processPackageDetectionEvent(event) {
    const { cameraId, data, timestamp, smartContext } = event;
    
    const analytics = this.getOrCreateAnalytics(cameraId);
    analytics.packageDetections = (analytics.packageDetections || 0) + 1;
    
    // Store package detection context
    if (!analytics.packageDetections) {
      analytics.packageDetections = [];
    }
    analytics.packageDetections.push({
      ...smartContext,
      confidence: smartContext.confidence,
      attributes: smartContext.attributes
    });
    
    // Keep only recent package detections (last 20)
    if (analytics.packageDetections.length > 20) {
      analytics.packageDetections = analytics.packageDetections.slice(-20);
    }
    
    this.logger.info(`Package detected on camera ${cameraId} with confidence ${smartContext.confidence}`);
  }
  
  /**
   * Process face detection event
   */
  async processFaceDetectionEvent(event) {
    const { cameraId, data, timestamp, smartContext } = event;
    
    const analytics = this.getOrCreateAnalytics(cameraId);
    analytics.faceDetections = (analytics.faceDetections || 0) + 1;
    
    // Store face detection context
    if (!analytics.faceDetections) {
      analytics.faceDetections = [];
    }
    analytics.faceDetections.push({
      ...smartContext,
      confidence: smartContext.confidence,
      attributes: smartContext.attributes
    });
    
    // Keep only recent face detections (last 40)
    if (analytics.faceDetections.length > 40) {
      analytics.faceDetections = analytics.faceDetections.slice(-40);
    }
    
    this.logger.info(`Face detected on camera ${cameraId} with confidence ${smartContext.confidence}`);
  }
  
  /**
   * Process generic smart detection event
   */
  async processGenericSmartDetectionEvent(event) {
    const { cameraId, data, timestamp, smartContext } = event;
    
    const analytics = this.getOrCreateAnalytics(cameraId);
    analytics.genericDetections = (analytics.genericDetections || 0) + 1;
    
    // Store generic detection context
    if (!analytics.genericDetections) {
      analytics.genericDetections = [];
    }
    analytics.genericDetections.push({
      ...smartContext,
      confidence: smartContext.confidence,
      attributes: smartContext.attributes
    });
    
    // Keep only recent generic detections (last 30)
    if (analytics.genericDetections.length > 30) {
      analytics.genericDetections = analytics.genericDetections.slice(-30);
    }
    
    this.logger.info(`Smart detection (${smartContext.objectType}) on camera ${cameraId} with confidence ${smartContext.confidence}`);
  }
  
  /**
   * Analyze smart detection patterns
   */
  async analyzeSmartDetectionPatterns(cameraId, smartContext) {
    const analytics = this.getOrCreateAnalytics(cameraId);
    
    // Analyze detection frequency
    const recentDetections = analytics.smartDetections?.slice(-20) || [];
    const sameTypeDetections = recentDetections.filter(d => d.objectType === smartContext.objectType);
    
    // Check for unusual activity patterns
    if (sameTypeDetections.length > 5) {
      const timeSpan = new Date(smartContext.timestamp) - new Date(sameTypeDetections[0].timestamp);
      const detectionsPerMinute = (sameTypeDetections.length / timeSpan) * 60000;
      
      if (detectionsPerMinute > 2) { // More than 2 detections per minute
        this.emit('smart:pattern:high-frequency', {
          cameraId,
          objectType: smartContext.objectType,
          frequency: detectionsPerMinute,
          detections: sameTypeDetections
        });
      }
    }
    
    // Check for confidence anomalies
    if (smartContext.confidence < 0.3) {
      this.emit('smart:pattern:low-confidence', {
        cameraId,
        objectType: smartContext.objectType,
        confidence: smartContext.confidence,
        context: smartContext
      });
    }
    
    // Check for zone-specific patterns
    if (smartContext.zone) {
      await this.analyzeZonePatterns(smartContext.zone, smartContext);
    }
  }
  
  /**
   * Analyze zone-specific patterns
   */
  async analyzeZonePatterns(zoneId, smartContext) {
    const zoneAnalytics = this.getZoneAnalytics(zoneId);
    
    if (!zoneAnalytics) {
      return;
    }
    
    // Check for unusual zone activity
    const recentZoneEvents = zoneAnalytics.recentEvents?.slice(-10) || [];
    const sameTypeZoneEvents = recentZoneEvents.filter(e => e.objectType === smartContext.objectType);
    
    if (sameTypeZoneEvents.length > 3) {
      this.emit('smart:pattern:zone-activity', {
        zoneId,
        objectType: smartContext.objectType,
        eventCount: sameTypeZoneEvents.length,
        events: sameTypeZoneEvents
      });
    }
  }
  
  /**
   * Get smart detection analytics for a camera
   */
  getSmartDetectionAnalytics(cameraId) {
    const analytics = this.getOrCreateAnalytics(cameraId);
    
    const smartAnalytics = {
      totalDetections: analytics.smartDetections || 0,
      lastDetection: analytics.lastSmartDetection,
      detectionTypes: {},
      confidenceStats: {
        average: 0,
        min: 1,
        max: 0
      },
      recentDetections: analytics.smartDetections?.slice(-10) || []
    };
    
    // Calculate detection type breakdown
    if (analytics.smartDetections) {
      const typeCounts = {};
      const confidences = [];
      
      analytics.smartDetections.forEach(detection => {
        typeCounts[detection.objectType] = (typeCounts[detection.objectType] || 0) + 1;
        confidences.push(detection.confidence);
      });
      
      smartAnalytics.detectionTypes = typeCounts;
      
      if (confidences.length > 0) {
        smartAnalytics.confidenceStats = {
          average: confidences.reduce((a, b) => a + b, 0) / confidences.length,
          min: Math.min(...confidences),
          max: Math.max(...confidences)
        };
      }
    }
    
    return smartAnalytics;
  }
  
  /**
   * Get zone analytics
   */
  getZoneAnalytics(zoneId) {
    return this.zoneAnalytics?.get(zoneId);
  }
  
  /**
   * Track vehicle movement
   */
  async trackVehicleMovement(trackingId, cameraId, zoneId, timestamp, smartContext) {
    if (!this.vehicleTracking) {
      this.vehicleTracking = new Map();
    }
    
    if (!this.vehicleTracking.has(trackingId)) {
      this.vehicleTracking.set(trackingId, {
        detections: [],
        zones: new Set(),
        firstSeen: timestamp,
        lastSeen: timestamp
      });
    }
    
    const tracking = this.vehicleTracking.get(trackingId);
    
    tracking.detections.push({
      cameraId,
      zoneId,
      timestamp,
      smartContext
    });
    
    if (zoneId) {
      tracking.zones.add(zoneId);
    }
    
    tracking.lastSeen = timestamp;
    
    // Check for cross-zone movement
    if (tracking.zones.size > 1) {
      this.emit('vehicle:cross-zone', {
        trackingId,
        zones: Array.from(tracking.zones),
        tracking
      });
    }
  }
  
  /**
   * Process plate detection event
   */
  async processPlateDetectionEvent(event) {
    const { cameraId, data, timestamp } = event;
    
    if (!data.plateNumber) {
      return;
    }
    
    const plateNumber = data.plateNumber;
    
    // Get or create plate tracking data
    if (!this.plateTracking.has(plateNumber)) {
      this.plateTracking.set(plateNumber, {
        detections: [],
        zones: new Set(),
        firstSeen: timestamp,
        lastSeen: timestamp
      });
    }
    
    const tracking = this.plateTracking.get(plateNumber);
    
    // Add detection
    tracking.detections.push({
      cameraId,
      timestamp,
      zone: data.zone,
      confidence: data.confidence,
      location: data.location
    });
    
    // Add zone if specified
    if (data.zone) {
      tracking.zones.add(data.zone);
    }
    
    tracking.lastSeen = timestamp;
    
    // Check for speed calculation opportunities
    await this.checkSpeedCalculation(plateNumber);
    
    this.logger.debug(`Plate detected: ${plateNumber} at ${cameraId}`);
  }
  
  /**
   * Check for speed calculation opportunities
   */
  async checkSpeedCalculation(plateNumber) {
    const tracking = this.plateTracking.get(plateNumber);
    if (!tracking || tracking.detections.length < 2) {
      return;
    }
    
    // Get last two detections
    const detections = tracking.detections.slice(-2);
    const [detection1, detection2] = detections;
    
    // Check if detections are in different zones
    if (detection1.zone && detection2.zone && detection1.zone !== detection2.zone) {
      // Calculate speed between zones
      const speedData = await this.calculateSpeedBetweenZones(
        plateNumber,
        detection1.zone,
        detection2.zone,
        detection1.timestamp,
        detection2.timestamp
      );
      
      if (speedData) {
        this.speedCalculations.set(`${plateNumber}-${detection1.timestamp}`, speedData);
        this.stats.speedCalculations++;
        
        this.emit('speed:calculated', speedData);
        this.logger.info(`Speed calculated for ${plateNumber}: ${speedData.speedKmh.toFixed(2)} km/h`);
      }
    }
  }
  
  /**
   * Calculate speed between zones
   */
  async calculateSpeedBetweenZones(plateNumber, zone1Id, zone2Id, timestamp1, timestamp2) {
    try {
      // Get zone manager from context
      const zoneManager = this.zoneManager;
      if (!zoneManager) {
        this.logger.warn('Zone manager not available for speed calculation');
        return null;
      }
      
      return await zoneManager.calculateZoneSpeed(plateNumber, zone1Id, zone2Id, timestamp1, timestamp2);
    } catch (error) {
      this.logger.error('Error calculating speed between zones:', error);
      return null;
    }
  }
  
  /**
   * Update people count for a zone
   */
  async updatePeopleCount(zoneId, direction, smartContext) {
    if (!this.peopleCounts.has(zoneId)) {
      this.peopleCounts.set(zoneId, 0);
    }
    
    let count = this.peopleCounts.get(zoneId);
    
    if (direction === 'entered') {
      count++;
    } else if (direction === 'exited') {
      count = Math.max(0, count - 1);
    }
    
    this.peopleCounts.set(zoneId, count);
    this.stats.peopleCounts++;
    
    // Store in history
    this.storeOccupancyHistory(zoneId, count);
    
    this.emit('people:counted', { zoneId, count, direction });
  }
  
  /**
   * Update vehicle count for a zone
   */
  async updateVehicleCount(zoneId, direction, smartContext) {
    const key = `vehicle-${zoneId}`;
    
    if (!this.peopleCounts.has(key)) {
      this.peopleCounts.set(key, 0);
    }
    
    let count = this.peopleCounts.get(key);
    
    if (direction === 'entered') {
      count++;
    } else if (direction === 'exited') {
      count = Math.max(0, count - 1);
    }
    
    this.peopleCounts.set(key, count);
    
    this.emit('vehicle:counted', { zoneId, count, direction });
  }
  
  /**
   * Track person movement across zones
   */
  async trackPersonMovement(trackingId, cameraId, zoneId, timestamp, smartContext) {
    if (!this.trackingData.has(trackingId)) {
      this.trackingData.set(trackingId, {
        movements: [],
        zones: new Set(),
        firstSeen: timestamp,
        lastSeen: timestamp
      });
    }
    
    const tracking = this.trackingData.get(trackingId);
    
    // Add movement
    tracking.movements.push({
      cameraId,
      zoneId,
      timestamp
    });
    
    if (zoneId) {
      tracking.zones.add(zoneId);
    }
    
    tracking.lastSeen = timestamp;
    
    // Check for cross-zone events
    if (tracking.zones.size > 1) {
      this.stats.crossZoneEvents++;
      this.emit('person:crossed_zones', { trackingId, zones: Array.from(tracking.zones) });
    }
  }
  
  /**
   * Get or create analytics for camera
   */
  getOrCreateAnalytics(cameraId) {
    if (!this.analytics.has(cameraId)) {
      this.analytics.set(cameraId, {
        motionEvents: 0,
        smartDetections: 0,
        personDetections: 0,
        vehicleDetections: 0,
        lastMotionEvent: null,
        lastSmartDetection: null,
        lastPersonDetection: null,
        lastVehicleDetection: null
      });
    }
    
    return this.analytics.get(cameraId);
  }
  
  /**
   * Store event in history
   */
  storeEventHistory(cameraId, event) {
    if (!this.eventHistory.has(cameraId)) {
      this.eventHistory.set(cameraId, []);
    }
    
    const history = this.eventHistory.get(cameraId);
    history.push({
      ...event,
      processedAt: new Date().toISOString()
    });
    
    // Keep only last 1000 events per camera
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }
  
  /**
   * Store occupancy history
   */
  storeOccupancyHistory(zoneId, count) {
    if (!this.occupancyHistory.has(zoneId)) {
      this.occupancyHistory.set(zoneId, []);
    }
    
    const history = this.occupancyHistory.get(zoneId);
    history.push({
      count,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }
  
  /**
   * Get analytics for camera
   */
  getCameraAnalytics(cameraId) {
    return this.analytics.get(cameraId);
  }
  
  /**
   * Get people count for zone
   */
  getPeopleCount(zoneId) {
    return this.peopleCounts.get(zoneId) || 0;
  }
  
  /**
   * Get vehicle count for zone
   */
  getVehicleCount(zoneId) {
    const key = `vehicle-${zoneId}`;
    return this.peopleCounts.get(key) || 0;
  }
  
  /**
   * Get plate tracking data
   */
  getPlateTracking(plateNumber) {
    return this.plateTracking.get(plateNumber);
  }
  
  /**
   * Get speed calculations
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
    
    return calculations;
  }
  
  /**
   * Get event history for camera
   */
  getEventHistory(cameraId, limit = 100) {
    const history = this.eventHistory.get(cameraId) || [];
    return history.slice(-limit);
  }
  
  /**
   * Get occupancy history for zone
   */
  getOccupancyHistory(zoneId, limit = 100) {
    const history = this.occupancyHistory.get(zoneId) || [];
    return history.slice(-limit);
  }
  
  /**
   * Set zone manager reference
   */
  setZoneManager(zoneManager) {
    this.zoneManager = zoneManager;
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalCameras: this.analytics.size,
      totalPlates: this.plateTracking.size,
      totalPeople: this.peopleCounts.size,
      totalSpeedCalculations: this.speedCalculations.size
    };
  }
  
  /**
   * Export analytics data
   */
  exportAnalytics(filter = {}) {
    return {
      cameras: Object.fromEntries(this.analytics),
      peopleCounts: Object.fromEntries(this.peopleCounts),
      plateTracking: Object.fromEntries(this.plateTracking),
      speedCalculations: this.getSpeedCalculations(filter),
      stats: this.getStats()
    };
  }

  /**
   * Generic event processor for unknown event types
   */
  async processGenericEvent(event) {
    const { cameraId, data, timestamp, type } = event;
    
    this.logger.info(`Processing generic event type: ${type} for camera ${cameraId}`);
    
    const analytics = this.getOrCreateAnalytics(cameraId);
    
    // Store generic event data
    if (!analytics.genericEvents) {
      analytics.genericEvents = [];
    }
    
    const genericEvent = {
      type,
      data,
      timestamp,
      processedAt: new Date().toISOString()
    };
    
    analytics.genericEvents.push(genericEvent);
    
    // Keep only recent generic events (last 50)
    if (analytics.genericEvents.length > 50) {
      analytics.genericEvents = analytics.genericEvents.slice(-50);
    }
    
    // Discover and store new fields
    this.discoverNewFields(type, data);
    
    // Extract capabilities from event data
    const capabilities = this.extractCapabilitiesFromEvent(type, data);
    
    // Update analytics with new capabilities
    if (!analytics.capabilities) {
      analytics.capabilities = new Set();
    }
    capabilities.forEach(cap => analytics.capabilities.add(cap));
    
    // Emit generic event processed
    this.emit('event:generic:processed', {
      cameraId,
      eventType: type,
      data,
      capabilities,
      timestamp
    });
    
    this.logger.debug(`Generic event ${type} processed for camera ${cameraId}`);
  }

  /**
   * Discover new fields in event data
   */
  discoverNewFields(eventType, data) {
    if (!this.discoveredFields) {
      this.discoveredFields = new Map();
    }
    
    if (!this.discoveredFields.has(eventType)) {
      this.discoveredFields.set(eventType, new Set());
    }
    
    const knownFields = this.discoveredFields.get(eventType);
    const newFields = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (!knownFields.has(key)) {
        knownFields.add(key);
        newFields.push({ field: key, value, type: typeof value });
      }
    }
    
    if (newFields.length > 0) {
      this.logger.warn(`🆕 NEW FIELDS DISCOVERED in analytics for ${eventType}: ${newFields.map(f => f.field).join(', ')}`);
      
      // Emit field discovery event
      this.emit('analytics:fields:discovered', {
        eventType,
        newFields,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Extract capabilities from event data
   */
  extractCapabilitiesFromEvent(eventType, data) {
    const capabilities = [];
    
    // Smart detection capabilities
    if (data.smartDetectTypes && Array.isArray(data.smartDetectTypes)) {
      capabilities.push(...data.smartDetectTypes.map(type => `smartDetect:${type}`));
    }
    
    // Audio detection capabilities
    if (eventType === 'smartAudioDetect') {
      capabilities.push('audioDetection');
    }
    
    // Motion detection capabilities
    if (eventType === 'motion') {
      capabilities.push('motionDetection');
    }
    
    // Line crossing capabilities
    if (eventType === 'smartDetectLine') {
      capabilities.push('lineCrossing');
    }
    
    // Zone detection capabilities
    if (eventType === 'smartDetectZone') {
      capabilities.push('zoneDetection');
    }
    
    // License plate detection
    if (data.smartDetectTypes && data.smartDetectTypes.includes('license')) {
      capabilities.push('licensePlateDetection');
    }
    
    // Audio alarm detection
    if (data.smartDetectTypes && data.smartDetectTypes.includes('alrmBark')) {
      capabilities.push('audioAlarmDetection');
    }
    
    return capabilities;
  }

  /**
   * Get generic event analytics
   */
  getGenericEventAnalytics(cameraId) {
    const analytics = this.getOrCreateAnalytics(cameraId);
    
    if (!analytics.genericEvents) {
      return {
        totalEvents: 0,
        eventTypes: [],
        recentEvents: [],
        capabilities: []
      };
    }
    
    const eventTypes = [...new Set(analytics.genericEvents.map(e => e.type))];
    const capabilities = analytics.capabilities ? Array.from(analytics.capabilities) : [];
    
    return {
      totalEvents: analytics.genericEvents.length,
      eventTypes,
      recentEvents: analytics.genericEvents.slice(-10),
      capabilities,
      discoveredFields: this.getDiscoveredFieldsForAnalytics()
    };
  }

  /**
   * Get discovered fields for analytics
   */
  getDiscoveredFieldsForAnalytics() {
    if (!this.discoveredFields) {
      return {};
    }
    
    const result = {};
    for (const [eventType, fields] of this.discoveredFields) {
      result[eventType] = Array.from(fields);
    }
    return result;
  }

  /**
   * Process audio detection event
   */
  async processAudioDetectionEvent(event) {
    const { cameraId, data, timestamp } = event;
    
    const analytics = this.getOrCreateAnalytics(cameraId);
    
    const audioContext = {
      audioType: data.smartDetectTypes?.[0] || 'unknown',
      confidence: data.confidence || data.score || 0,
      duration: data.start && data.end ? data.end - data.start : undefined,
      attributes: data.attributes || {},
      timestamp: timestamp
    };
    
    // Store audio detection context
    if (!analytics.audioDetections) {
      analytics.audioDetections = [];
    }
    analytics.audioDetections.push(audioContext);
    
    // Keep only recent audio detections (last 50)
    if (analytics.audioDetections.length > 50) {
      analytics.audioDetections = analytics.audioDetections.slice(-50);
    }
    
    analytics.audioDetections++;
    analytics.lastAudioDetection = timestamp;
    
    // Emit audio detection event
    this.emit('audio:detected', {
      cameraId,
      audioContext,
      analytics: this.getAudioDetectionAnalytics(cameraId)
    });
    
    this.logger.info(`Audio detection (${audioContext.audioType}) on camera ${cameraId} with ${(audioContext.confidence * 100).toFixed(1)}% confidence`);
  }

  /**
   * Get audio detection analytics
   */
  getAudioDetectionAnalytics(cameraId) {
    const analytics = this.getOrCreateAnalytics(cameraId);
    
    if (!analytics.audioDetections) {
      return {
        totalDetections: 0,
        audioTypes: [],
        recentDetections: [],
        confidenceStats: { average: 0, min: 0, max: 0 }
      };
    }
    
    const audioTypes = [...new Set(analytics.audioDetections.map(d => d.audioType))];
    const confidences = analytics.audioDetections.map(d => d.confidence).filter(c => c > 0);
    
    const confidenceStats = confidences.length > 0 ? {
      average: confidences.reduce((a, b) => a + b, 0) / confidences.length,
      min: Math.min(...confidences),
      max: Math.max(...confidences)
    } : { average: 0, min: 0, max: 0 };
    
    return {
      totalDetections: analytics.audioDetections.length,
      audioTypes,
      recentDetections: analytics.audioDetections.slice(-10),
      confidenceStats
    };
  }
}

module.exports = AnalyticsEngine; 