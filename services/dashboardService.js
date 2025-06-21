const EventEmitter = require('events');
const winston = require('winston');

/**
 * Dashboard Service
 * 
 * Provides a unified view of all monitoring data for the single pane of glass interface.
 * Aggregates data from zones, cameras, analytics, and real-time events.
 */
class DashboardService extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || winston.createLogger();
    
    // Service references
    this.zoneManager = null;
    this.analyticsEngine = null;
    this.entityManager = null;
    this.eventProcessor = null;
    
    // Dashboard data
    this.dashboardData = {
      overview: {},
      zones: {},
      cameras: {},
      analytics: {},
      events: {
        recent: [],
        byType: {},
        byCamera: {}
      },
      alerts: {
        recent: [],
        byType: {},
        bySeverity: {}
      }
    };
    
    // Real-time updates
    this.realTimeUpdates = new Map();
    this.updateSubscribers = new Set();
    
    // Dashboard configuration
    this.dashboardConfig = {
      refreshInterval: config.dashboard?.refreshInterval || 5000,
      maxEvents: config.dashboard?.maxEvents || 100,
      maxAlerts: config.dashboard?.maxAlerts || 50,
      retentionHours: config.dashboard?.retentionHours || 24
    };
    
    // Update timer
    this.updateTimer = null;
    
    this.logger.info('Dashboard Service initialized');
  }
  
  /**
   * Initialize dashboard with services
   */
  async initialize(services) {
    try {
      this.logger.info('Initializing Dashboard Service...');
      
      // Store service references
      this.zoneManager = services.zoneManager;
      this.analyticsEngine = services.analyticsEngine;
      this.entityManager = services.entityManager;
      this.eventProcessor = services.eventProcessor;
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start update timer
      this.startUpdateTimer();
      
      // Perform initial data load
      await this.loadDashboardData();
      
      this.logger.info('Dashboard Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Dashboard Service:', error);
      throw error;
    }
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Zone events
    if (this.zoneManager) {
      this.zoneManager.on('zone:created', () => this.updateZones());
      this.zoneManager.on('zone:updated', () => this.updateZones());
      this.zoneManager.on('analytics:updated', () => this.updateZoneAnalytics());
    }
    
    // Analytics events
    if (this.analyticsEngine) {
      this.analyticsEngine.on('analytics:processed', () => this.updateAnalytics());
      this.analyticsEngine.on('speed:calculated', (data) => this.addSpeedAlert(data));
      this.analyticsEngine.on('people:counted', (data) => this.updatePeopleCounts(data));
      
      // Smart detection events
      this.analyticsEngine.on('smart:detected', (data) => this.addSmartDetectionAlert(data));
      this.analyticsEngine.on('smart:pattern:high-frequency', (data) => this.addSmartPatternAlert(data));
      this.analyticsEngine.on('smart:pattern:low-confidence', (data) => this.addSmartConfidenceAlert(data));
      this.analyticsEngine.on('smart:pattern:zone-activity', (data) => this.addZoneActivityAlert(data));
      this.analyticsEngine.on('vehicle:cross-zone', (data) => this.addCrossZoneAlert(data));
      
      // Audio detection events
      this.analyticsEngine.on('audio:detected', (data) => this.addAudioDetectionAlert(data));
      
      // Generic event processing
      this.analyticsEngine.on('event:generic:processed', (data) => this.addGenericEventAlert(data));
      this.analyticsEngine.on('analytics:fields:discovered', (data) => this.handleNewFieldsDiscovered(data));
    }
    
    // Entity events
    if (this.entityManager) {
      this.entityManager.on('entity:created', () => this.updateCameras());
      this.entityManager.on('entity:updated', () => this.updateCameras());
    }
  }
  
  /**
   * Start update timer
   */
  startUpdateTimer() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    
    this.updateTimer = setInterval(async () => {
      try {
        await this.updateDashboardData();
      } catch (error) {
        this.logger.error('Error updating dashboard data:', error);
      }
    }, this.dashboardConfig.refreshInterval);
  }
  
  /**
   * Stop update timer
   */
  stopUpdateTimer() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
  
  /**
   * Load initial dashboard data
   */
  async loadDashboardData() {
    try {
      await Promise.all([
        this.updateAlerts(),
        this.updateEvents(),
        this.updateZones(),
        this.updateCameras(),
        this.updateAnalytics(),
        this.updateOverview()
      ]);
      
      this.logger.info('Dashboard data loaded successfully');
    } catch (error) {
      this.logger.error('Error loading dashboard data:', error);
    }
  }
  
  /**
   * Update dashboard data
   */
  async updateDashboardData() {
    try {
      await Promise.all([
        this.updateAlerts(),
        this.updateEvents(),
        this.updateAnalytics(),
        this.updateOverview()
      ]);
      
      // Notify subscribers
      this.notifySubscribers();
    } catch (error) {
      this.logger.error('Error updating dashboard data:', error);
    }
  }
  
  /**
   * Update overview data
   */
  async updateOverview() {
    try {
      const overview = {
        timestamp: new Date().toISOString(),
        totalZones: 0,
        totalCameras: 0,
        activeCameras: 0,
        totalEvents: 0,
        totalAlerts: 0,
        peopleCount: 0,
        vehicleCount: 0,
        speedViolations: 0
      };
      
      // Get zone statistics
      if (this.zoneManager) {
        const zoneStats = this.zoneManager.getStats();
        overview.totalZones = zoneStats.totalZones;
      }
      
      // Get camera statistics
      if (this.entityManager) {
        const cameras = this.entityManager.getEntities({ type: 'camera' });
        overview.totalCameras = cameras.length;
        overview.activeCameras = cameras.filter(c => c.status === 'online').length;
      }
      
      // Get analytics statistics
      if (this.analyticsEngine) {
        const analyticsStats = this.analyticsEngine.getStats();
        overview.totalEvents = analyticsStats.totalEvents;
        overview.peopleCount = Object.values(this.analyticsEngine.peopleCounts).reduce((sum, count) => sum + count, 0);
      }
      
      // Get alert count
      overview.totalAlerts = (this.dashboardData.alerts?.recent?.length) || 0;
      
      this.dashboardData.overview = overview;
    } catch (error) {
      this.logger.error('Error updating overview:', error);
    }
  }
  
  /**
   * Update zones data
   */
  async updateZones() {
    try {
      if (!this.zoneManager) return;
      
      const zones = this.zoneManager.exportZones();
      const zonesData = {};
      
      for (const zone of zones) {
        zonesData[zone.id] = {
          ...zone,
          analytics: this.zoneManager.getZoneAnalytics(zone.id),
          peopleCount: this.analyticsEngine?.getPeopleCount(zone.id) || 0,
          vehicleCount: this.analyticsEngine?.getVehicleCount(zone.id) || 0
        };
      }
      
      this.dashboardData.zones = zonesData;
    } catch (error) {
      this.logger.error('Error updating zones:', error);
    }
  }
  
  /**
   * Update cameras data
   */
  async updateCameras() {
    try {
      if (!this.entityManager) return;
      
      const cameras = this.entityManager.getEntities({ type: 'camera' });
      const camerasData = {};
      
      for (const camera of cameras) {
        camerasData[camera.id] = {
          ...camera,
          analytics: this.analyticsEngine?.getCameraAnalytics(camera.metadata?.cameraId) || {},
          zones: this.zoneManager?.getZonesForCamera(camera.metadata?.cameraId) || [],
          recentEvents: this.analyticsEngine?.getEventHistory(camera.metadata?.cameraId, 10) || []
        };
      }
      
      this.dashboardData.cameras = camerasData;
    } catch (error) {
      this.logger.error('Error updating cameras:', error);
    }
  }
  
  /**
   * Update analytics data
   */
  async updateAnalytics() {
    try {
      const analytics = {
        summary: {
          totalEvents: 0,
          totalDetections: 0,
          totalAlerts: 0
        },
        smartDetections: {
          summary: {
            totalDetections: 0,
            personDetections: 0,
            vehicleDetections: 0,
            animalDetections: 0,
            packageDetections: 0,
            faceDetections: 0,
            genericDetections: 0
          },
          confidenceStats: {
            average: 0,
            min: 0,
            max: 0
          },
          recentDetections: [],
          patterns: {
            highFrequency: 0,
            lowConfidence: 0,
            crossZone: 0
          }
        },
        audioDetections: {
          summary: {
            totalDetections: 0,
            audioTypes: []
          },
          confidenceStats: {
            average: 0,
            min: 0,
            max: 0
          },
          recentDetections: []
        },
        genericEvents: {
          summary: {
            totalEvents: 0,
            eventTypes: []
          },
          capabilities: [],
          discoveredFields: {}
        },
        cameras: {},
        zones: {},
        speedCalculations: [],
        discoveredEventTypes: this.getDiscoveredEventTypes(),
        discoveredFields: this.getDiscoveredFields()
      };
      
      // Get camera analytics
      if (this.entityManager) {
        const cameras = this.entityManager.getEntities({ type: 'camera' });
        
        for (const camera of cameras) {
          const cameraAnalytics = this.analyticsEngine.getCameraAnalytics(camera.id);
          const smartAnalytics = this.analyticsEngine.getSmartDetectionAnalytics(camera.id);
          const audioAnalytics = this.analyticsEngine.getAudioDetectionAnalytics(camera.id);
          const genericAnalytics = this.analyticsEngine.getGenericEventAnalytics(camera.id);
          
          analytics.cameras[camera.id] = {
            ...cameraAnalytics,
            smartDetections: smartAnalytics,
            audioDetections: audioAnalytics,
            genericEvents: genericAnalytics,
            cameraName: camera.name,
            status: camera.status
          };
          
          // Aggregate smart detection summary
          if (smartAnalytics.detectionTypes) {
            analytics.smartDetections.summary.totalDetections += smartAnalytics.totalDetections;
            analytics.smartDetections.summary.personDetections += smartAnalytics.detectionTypes.person || 0;
            analytics.smartDetections.summary.vehicleDetections += smartAnalytics.detectionTypes.vehicle || 0;
            analytics.smartDetections.summary.animalDetections += smartAnalytics.detectionTypes.animal || 0;
            analytics.smartDetections.summary.packageDetections += smartAnalytics.detectionTypes.package || 0;
            analytics.smartDetections.summary.faceDetections += smartAnalytics.detectionTypes.face || 0;
            analytics.smartDetections.summary.genericDetections += smartAnalytics.detectionTypes.generic || 0;
          }
          
          // Aggregate audio detection summary
          if (audioAnalytics.audioTypes) {
            analytics.audioDetections.summary.totalDetections += audioAnalytics.totalDetections;
            analytics.audioDetections.summary.audioTypes.push(...audioAnalytics.audioTypes);
          }
          
          // Aggregate generic events summary
          if (genericAnalytics.eventTypes) {
            analytics.genericEvents.summary.totalEvents += genericAnalytics.totalEvents;
            analytics.genericEvents.summary.eventTypes.push(...genericAnalytics.eventTypes);
            analytics.genericEvents.capabilities.push(...genericAnalytics.capabilities);
          }
          
          // Aggregate confidence stats
          if (smartAnalytics.confidenceStats) {
            const stats = smartAnalytics.confidenceStats;
            if (stats.average > 0) {
              analytics.smartDetections.confidenceStats.average = 
                (analytics.smartDetections.confidenceStats.average + stats.average) / 2;
            }
            analytics.smartDetections.confidenceStats.min = 
              Math.min(analytics.smartDetections.confidenceStats.min, stats.min);
            analytics.smartDetections.confidenceStats.max = 
              Math.max(analytics.smartDetections.confidenceStats.max, stats.max);
          }
          
          // Add recent detections
          if (smartAnalytics.recentDetections) {
            analytics.smartDetections.recentDetections.push(...smartAnalytics.recentDetections);
          }
          
          if (audioAnalytics.recentDetections) {
            analytics.audioDetections.recentDetections.push(...audioAnalytics.recentDetections);
          }
        }
        
        // Sort recent detections by timestamp
        analytics.smartDetections.recentDetections.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        analytics.audioDetections.recentDetections.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        // Keep only the most recent 50 detections
        analytics.smartDetections.recentDetections = 
          analytics.smartDetections.recentDetections.slice(0, 50);
          
        analytics.audioDetections.recentDetections = 
          analytics.audioDetections.recentDetections.slice(0, 50);
      }
      
      // Get zone analytics
      if (this.zoneManager) {
        const zones = this.zoneManager.getZones();
        
        for (const zone of zones) {
          const peopleCount = this.analyticsEngine.getPeopleCount(zone.id);
          const vehicleCount = this.analyticsEngine.getVehicleCount(zone.id);
          const occupancyHistory = this.analyticsEngine.getOccupancyHistory(zone.id, 24);
          
          analytics.zones[zone.id] = {
            peopleCount,
            vehicleCount,
            occupancyHistory,
            zoneName: zone.name,
            zoneType: zone.type
          };
        }
      }
      
      // Get speed calculations
      const speedCalculations = this.analyticsEngine.getSpeedCalculations();
      analytics.speedCalculations = speedCalculations;
      
      // Update dashboard data
      this.dashboardData = analytics;
      
      // Emit analytics updated event
      this.emit('analytics:updated', analytics);
      
    } catch (error) {
      this.logger.error('Error updating analytics:', error);
    }
  }
  
  /**
   * Update events data
   */
  async updateEvents() {
    try {
      // Initialize events structure if it doesn't exist
      if (!this.dashboardData.events) {
        this.dashboardData.events = {
          recent: [],
          byType: {},
          byCamera: {}
        };
      }
      
      const events = {
        recent: this.dashboardData.events.recent || [],
        byType: this.dashboardData.events.byType || {},
        byCamera: this.dashboardData.events.byCamera || {}
      };
      
      // Get recent events from all cameras
      if (this.analyticsEngine) {
        const allEvents = [];
        
        for (const [cameraId, history] of this.analyticsEngine.eventHistory) {
          const recentEvents = history.slice(-5);
          allEvents.push(...recentEvents);
        }
        
        // Sort by timestamp and take most recent
        events.recent = allEvents
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, this.dashboardConfig.maxEvents);
      }
      
      this.dashboardData.events = events;
    } catch (error) {
      this.logger.error('Error updating events:', error);
    }
  }
  
  /**
   * Update alerts data
   */
  async updateAlerts() {
    try {
      // Initialize alerts structure if it doesn't exist
      if (!this.dashboardData.alerts) {
        this.dashboardData.alerts = {
          recent: [],
          byType: {},
          bySeverity: {}
        };
      }
      
      // Ensure recent array exists
      if (!this.dashboardData.alerts.recent) {
        this.dashboardData.alerts.recent = [];
      }
      
      // Ensure other properties exist
      if (!this.dashboardData.alerts.byType) {
        this.dashboardData.alerts.byType = {};
      }
      
      if (!this.dashboardData.alerts.bySeverity) {
        this.dashboardData.alerts.bySeverity = {};
      }
    } catch (error) {
      this.logger.error('Error updating alerts:', error);
    }
  }
  
  /**
   * Add speed alert
   */
  addSpeedAlert(speedData) {
    const alert = {
      id: `speed-${Date.now()}`,
      type: 'speed-violation',
      severity: 'high',
      title: 'Speed Violation Detected',
      message: `Vehicle ${speedData.plateNumber} detected at ${speedData.speed.toFixed(1)} mph`,
      data: speedData,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
  }
  
  /**
   * Add smart detection alert
   */
  addSmartDetectionAlert(data) {
    const { cameraId, smartContext, analytics } = data;
    
    const alert = {
      id: `smart-${Date.now()}`,
      type: 'smart-detection',
      severity: smartContext.confidence > 0.8 ? 'high' : smartContext.confidence > 0.5 ? 'medium' : 'low',
      title: `${smartContext.objectType.charAt(0).toUpperCase() + smartContext.objectType.slice(1)} Detected`,
      message: `${smartContext.objectType} detected on camera ${cameraId} with ${(smartContext.confidence * 100).toFixed(1)}% confidence`,
      data: {
        cameraId,
        smartContext,
        analytics
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
  }
  
  /**
   * Add smart pattern alert for high frequency detections
   */
  addSmartPatternAlert(data) {
    const { cameraId, objectType, frequency, detections } = data;
    
    const alert = {
      id: `pattern-${Date.now()}`,
      type: 'smart-pattern',
      severity: 'medium',
      title: 'High Frequency Detection Pattern',
      message: `Unusual ${objectType} detection frequency (${frequency.toFixed(1)}/min) on camera ${cameraId}`,
      data: {
        cameraId,
        objectType,
        frequency,
        detections
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
  }
  
  /**
   * Add smart confidence alert for low confidence detections
   */
  addSmartConfidenceAlert(data) {
    const { cameraId, objectType, confidence, context } = data;
    
    const alert = {
      id: `confidence-${Date.now()}`,
      type: 'smart-confidence',
      severity: 'low',
      title: 'Low Confidence Detection',
      message: `${objectType} detection with low confidence (${(confidence * 100).toFixed(1)}%) on camera ${cameraId}`,
      data: {
        cameraId,
        objectType,
        confidence,
        context
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
  }
  
  /**
   * Add zone activity alert
   */
  addZoneActivityAlert(data) {
    const { zoneId, objectType, eventCount, events } = data;
    
    const alert = {
      id: `zone-${Date.now()}`,
      type: 'zone-activity',
      severity: 'medium',
      title: 'Zone Activity Pattern',
      message: `Multiple ${objectType} detections (${eventCount}) in zone ${zoneId}`,
      data: {
        zoneId,
        objectType,
        eventCount,
        events
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
  }
  
  /**
   * Add cross-zone alert
   */
  addCrossZoneAlert(data) {
    const { trackingId, zones, tracking } = data;
    
    const alert = {
      id: `cross-zone-${Date.now()}`,
      type: 'cross-zone',
      severity: 'high',
      title: 'Cross-Zone Vehicle Movement',
      message: `Vehicle tracked across ${zones.length} zones: ${zones.join(', ')}`,
      data: {
        trackingId,
        zones,
        tracking
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
  }
  
  /**
   * Add audio detection alert
   */
  addAudioDetectionAlert(data) {
    const { cameraId, audioContext, analytics } = data;
    
    const alert = {
      id: `audio-${Date.now()}`,
      type: 'audio-detection',
      severity: audioContext.confidence > 0.8 ? 'high' : audioContext.confidence > 0.5 ? 'medium' : 'low',
      title: `Audio Detection: ${audioContext.audioType}`,
      message: `Audio detection "${audioContext.audioType}" on camera ${cameraId} with ${(audioContext.confidence * 100).toFixed(1)}% confidence`,
      data: {
        cameraId,
        audioContext,
        analytics
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
  }
  
  /**
   * Add generic event alert
   */
  addGenericEventAlert(data) {
    const { cameraId, eventType, capabilities, timestamp } = data;
    
    const alert = {
      id: `generic-${Date.now()}`,
      type: 'generic-event',
      severity: 'info',
      title: `Generic Event: ${eventType}`,
      message: `Generic event "${eventType}" processed for camera ${cameraId}`,
      data: {
        cameraId,
        eventType,
        capabilities,
        timestamp
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
  }
  
  /**
   * Add alert to dashboard
   */
  addAlert(alert) {
    // Ensure alerts structure exists
    if (!this.dashboardData.alerts) {
      this.dashboardData.alerts = {
        recent: [],
        byType: {},
        bySeverity: {}
      };
    }
    
    // Ensure recent array exists
    if (!this.dashboardData.alerts.recent) {
      this.dashboardData.alerts.recent = [];
    }
    
    // Add alert to recent array
    this.dashboardData.alerts.recent.unshift(alert);
    
    // Limit alerts
    if (this.dashboardData.alerts.recent.length > this.dashboardConfig.maxAlerts) {
      this.dashboardData.alerts.recent = this.dashboardData.alerts.recent.slice(0, this.dashboardConfig.maxAlerts);
    }
    
    // Categorize by type
    if (!this.dashboardData.alerts.byType[alert.type]) {
      this.dashboardData.alerts.byType[alert.type] = [];
    }
    this.dashboardData.alerts.byType[alert.type].push(alert);
    
    // Categorize by severity
    if (!this.dashboardData.alerts.bySeverity[alert.severity]) {
      this.dashboardData.alerts.bySeverity[alert.severity] = [];
    }
    this.dashboardData.alerts.bySeverity[alert.severity].push(alert);
    
    // Notify subscribers immediately
    this.notifySubscribers();
    
    this.logger.info(`Alert added: ${alert.title}`);
  }
  
  /**
   * Update people counts
   */
  updatePeopleCounts(data) {
    try {
      // Update real-time counts
      if (!this.realTimeUpdates.has('peopleCounts')) {
        this.realTimeUpdates.set('peopleCounts', {});
      }
      
      const counts = this.realTimeUpdates.get('peopleCounts');
      counts[data.zoneId] = data.count;
      
      this.emit('people:count_updated', data);
    } catch (error) {
      this.logger.error('Error updating people counts:', error);
    }
  }
  
  /**
   * Update zone analytics
   */
  updateZoneAnalytics() {
    try {
      // Trigger zone update
      this.updateZones();
    } catch (error) {
      this.logger.error('Error updating zone analytics:', error);
    }
  }
  
  /**
   * Get dashboard data
   */
  getDashboardData(filter = {}) {
    let data = { ...this.dashboardData };
    
    // Apply filters
    if (filter.zones) {
      data.zones = Object.fromEntries(
        Object.entries(data.zones).filter(([id]) => filter.zones.includes(id))
      );
    }
    
    if (filter.cameras) {
      data.cameras = Object.fromEntries(
        Object.entries(data.cameras).filter(([id]) => filter.cameras.includes(id))
      );
    }
    
    if (filter.includeRealTime) {
      data.realTime = Object.fromEntries(this.realTimeUpdates);
    }
    
    return data;
  }
  
  /**
   * Get overview data
   */
  getOverview() {
    return this.dashboardData.overview;
  }
  
  /**
   * Get zones data
   */
  getZones(filter = {}) {
    let zones = this.dashboardData.zones;
    
    if (filter.type) {
      zones = Object.fromEntries(
        Object.entries(zones).filter(([, zone]) => zone.type === filter.type)
      );
    }
    
    if (filter.active !== undefined) {
      zones = Object.fromEntries(
        Object.entries(zones).filter(([, zone]) => zone.active === filter.active)
      );
    }
    
    return zones;
  }
  
  /**
   * Get cameras data
   */
  getCameras(filter = {}) {
    let cameras = this.dashboardData.cameras;
    
    if (filter.status) {
      cameras = Object.fromEntries(
        Object.entries(cameras).filter(([, camera]) => camera.status === filter.status)
      );
    }
    
    if (filter.zone) {
      cameras = Object.fromEntries(
        Object.entries(cameras).filter(([, camera]) => 
          camera.zones.some(zone => zone.id === filter.zone)
        )
      );
    }
    
    return cameras;
  }
  
  /**
   * Get analytics data
   */
  getAnalytics() {
    return this.dashboardData.analytics;
  }
  
  /**
   * Get events data
   */
  getEvents(limit = 50) {
    if (!this.dashboardData.events || !this.dashboardData.events.recent) {
      return {
        recent: [],
        byType: {},
        byCamera: {}
      };
    }
    
    return {
      ...this.dashboardData.events,
      recent: this.dashboardData.events.recent.slice(0, limit)
    };
  }
  
  /**
   * Get alerts data
   */
  getAlerts(limit = 20) {
    if (!this.dashboardData.alerts || !this.dashboardData.alerts.recent) {
      return {
        recent: [],
        byType: {},
        bySeverity: {}
      };
    }
    
    return {
      ...this.dashboardData.alerts,
      recent: this.dashboardData.alerts.recent.slice(0, limit)
    };
  }
  
  /**
   * Subscribe to real-time updates
   */
  subscribe(callback) {
    this.updateSubscribers.add(callback);
    return () => this.updateSubscribers.delete(callback);
  }
  
  /**
   * Notify subscribers
   */
  notifySubscribers() {
    const data = this.getDashboardData({ includeRealTime: true });
    
    for (const callback of this.updateSubscribers) {
      try {
        callback(data);
      } catch (error) {
        this.logger.error('Error notifying subscriber:', error);
      }
    }
  }
  
  /**
   * Get real-time updates
   */
  getRealTimeUpdates() {
    return Object.fromEntries(this.realTimeUpdates);
  }
  
  /**
   * Export dashboard data
   */
  exportDashboardData() {
    return {
      ...this.dashboardData,
      realTime: Object.fromEntries(this.realTimeUpdates),
      config: this.dashboardConfig,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Cleanup
   */
  cleanup() {
    this.stopUpdateTimer();
    this.updateSubscribers.clear();
    this.realTimeUpdates.clear();
  }

  /**
   * Handle new event type discovery
   */
  handleNewEventTypeDiscovered(data) {
    const { eventType, timestamp, sampleData } = data;
    
    this.logger.warn(`🆕 NEW EVENT TYPE DISCOVERED: ${eventType}`);
    
    // Add to discovered event types
    if (!this.discoveredEventTypes) {
      this.discoveredEventTypes = new Set();
    }
    this.discoveredEventTypes.add(eventType);
    
    // Create alert for new event type
    const alert = {
      id: `new-event-type-${Date.now()}`,
      type: 'new-event-type',
      severity: 'info',
      title: `New Event Type: ${eventType}`,
      message: `A new event type "${eventType}" has been discovered from UniFi Protect`,
      data: {
        eventType,
        sampleData,
        timestamp
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
    
    // Update dashboard to include new event type
    this.updateAnalytics();
  }

  /**
   * Handle new fields discovery
   */
  handleNewFieldsDiscovered(data) {
    const { eventType, newFields, timestamp } = data;
    
    this.logger.warn(`🆕 NEW FIELDS DISCOVERED for ${eventType}: ${newFields.map(f => f.field).join(', ')}`);
    
    // Store discovered fields
    if (!this.discoveredFields) {
      this.discoveredFields = new Map();
    }
    
    if (!this.discoveredFields.has(eventType)) {
      this.discoveredFields.set(eventType, new Set());
    }
    
    const fields = this.discoveredFields.get(eventType);
    newFields.forEach(field => fields.add(field.field));
    
    // Create alert for new fields
    const alert = {
      id: `new-fields-${Date.now()}`,
      type: 'new-fields',
      severity: 'info',
      title: `New Fields Discovered`,
      message: `New fields discovered for event type "${eventType}": ${newFields.map(f => f.field).join(', ')}`,
      data: {
        eventType,
        newFields,
        timestamp
      },
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
    
    // Update dashboard to include new fields
    this.updateAnalytics();
  }

  /**
   * Get discovered event types and fields
   */
  getDiscoveredEventTypes() {
    return this.discoveredEventTypes ? Array.from(this.discoveredEventTypes) : [];
  }

  /**
   * Get discovered fields for all event types
   */
  getDiscoveredFields() {
    if (!this.discoveredFields) {
      return {};
    }
    
    const result = {};
    for (const [eventType, fields] of this.discoveredFields) {
      result[eventType] = Array.from(fields);
    }
    return result;
  }
}

module.exports = DashboardService; 