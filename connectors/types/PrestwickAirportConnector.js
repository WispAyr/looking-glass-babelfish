const BaseConnector = require('../BaseConnector');
const PrestwickAirportService = require('../../services/prestwickAirportService');
const AircraftDataService = require('../../services/aircraftDataService');

/**
 * Prestwick Airport Connector
 * Integrates with ADSB system to track aircraft operations at EGPK
 */
class PrestwickAirportConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    this.prestwickService = new PrestwickAirportService(config.prestwick || {});
    this.aircraftDataService = new AircraftDataService(config.aircraftData || {});
    this.adsbConnector = null;
    this.eventBus = null;
    this.connectorRegistry = null;
    this.notamConnector = null;
    
    // Track processed events
    this.processedEvents = new Set();
    this.maxProcessedEvents = 10000;
    
    // Track first data received
    this.firstDataReceived = false;
    this.startupNotificationSent = false;
    
    // Statistics
    this.stats = {
      totalAircraftProcessed: 0,
      totalApproaches: 0,
      totalLandings: 0,
      totalTakeoffs: 0,
      totalDepartures: 0,
      totalEnRoute: 0,
      notamQueries: 0,
      notamAlerts: 0,
      aircraftEnhanced: 0,
      lastActivity: new Date().toISOString()
    };

    // NOTAM integration settings
    this.notamConfig = {
      enabled: true,
      searchRadius: 50, // km around Prestwick
      checkOnApproach: true,
      checkOnLanding: true,
      checkOnTakeoff: true,
      priorityThreshold: 'medium' // Only alert on medium+ priority NOTAMs
    };

    // Distance tracking
    this.aircraftDistances = new Map();
    
    // Initialize dependencies
    this.initializeDependencies();
  }

  static getMetadata() {
    return {
      name: 'Prestwick Airport Connector',
      description: 'Tracks aircraft approaching, landing, and taking off at Prestwick Airport (EGPK) with NOTAM integration',
      version: '1.1.0',
      author: 'Looking Glass Team',
      capabilities: [
        'aircraft:tracking',
        'airport:operations',
        'runway:detection',
        'events:aircraft',
        'notam:integration'
      ]
    };
  }

  static getCapabilityDefinitions() {
    return [
      {
        id: 'aircraft:tracking',
        name: 'Aircraft Tracking',
        description: 'Track aircraft in the vicinity of Prestwick Airport',
        category: 'tracking',
        operations: ['get_tracked_aircraft', 'get_aircraft_history'],
        dataTypes: ['aircraft:current', 'aircraft:history'],
        events: ['aircraft:approach', 'aircraft:landing', 'aircraft:takeoff'],
        parameters: {
          limit: { type: 'number', required: false },
          filter: { type: 'object', required: false }
        }
      },
      {
        id: 'airport:operations',
        name: 'Airport Operations',
        description: 'Monitor airport operations and statistics',
        category: 'operations',
        operations: ['get_stats', 'get_runways', 'get_config'],
        dataTypes: ['airport:stats', 'airport:runways', 'airport:config'],
        events: ['airport:stats_updated', 'runway:status_changed'],
        parameters: {
          runwayId: { type: 'string', required: false },
          timeRange: { type: 'object', required: false }
        }
      },
      {
        id: 'runway:detection',
        name: 'Runway Detection',
        description: 'Detect which runway aircraft are using',
        category: 'detection',
        operations: ['determine_runway', 'get_runway_info'],
        dataTypes: ['runway:info', 'runway:usage'],
        events: ['runway:detected', 'runway:changed'],
        parameters: {
          latitude: { type: 'number', required: true },
          longitude: { type: 'number', required: true },
          heading: { type: 'number', required: true }
        }
      },
      {
        id: 'events:aircraft',
        name: 'Aircraft Events',
        description: 'Generate events for aircraft operations',
        category: 'events',
        operations: ['subscribe_events', 'get_event_history'],
        dataTypes: ['event:aircraft', 'event:history'],
        events: ['event:generated', 'event:pattern_detected'],
        parameters: {
          eventType: { type: 'string', required: false },
          limit: { type: 'number', required: false },
          timeRange: { type: 'object', required: false }
        }
      },
      {
        id: 'notam:integration',
        name: 'NOTAM Integration',
        description: 'Query and monitor NOTAMs related to Prestwick Airport',
        category: 'notam',
        operations: ['query_notams', 'check_notams', 'get_notam_alerts', 'configure_notam_monitoring'],
        dataTypes: ['notam:current', 'notam:alerts', 'notam:config'],
        events: ['notam:detected', 'notam:proximity', 'notam:expired'],
        parameters: {
          radius: { type: 'number', required: false },
          category: { type: 'string', required: false },
          priority: { type: 'string', required: false },
          aircraftPosition: { type: 'object', required: false }
        }
      }
    ];
  }

  static validateConfig(config) {
    const errors = [];
    
    if (config.prestwick) {
      if (config.prestwick.approachRadius && typeof config.prestwick.approachRadius !== 'number') {
        errors.push('approachRadius must be a number');
      }
      if (config.prestwick.runwayThreshold && typeof config.prestwick.runwayThreshold !== 'number') {
        errors.push('runwayThreshold must be a number');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async performConnect() {
    try {
      this.logger.info('Connecting Prestwick Airport Connector');
      
      // Check dependencies first
      const dependencyCheck = await this.checkDependencies();
      
      if (!dependencyCheck.available) {
        this.logger.warn('Some dependencies are not available', {
          missing: dependencyCheck.missing,
          errors: dependencyCheck.errors
        });
        
        // Handle critical dependency failures
        for (const connectorId of dependencyCheck.missing) {
          const dependency = this.dependencies.get(connectorId);
          if (dependency && dependency.critical) {
            await this.handleDependencyFailure(connectorId, new Error('Critical dependency not available'));
          }
        }
      }
      
      // Connect to dependencies
      await this.connectToDependencies();
      
      // Set up event listeners
      this.setupPrestwickEventListeners();
      this.setupADSBGroundEventListeners();
      
      // Set up ADSB event listener if available
      if (this.adsbConnector) {
        // Listen for aircraft updates from ADSB
        this.adsbConnector.on('aircraft:appeared', (event) => {
          this.logger.debug('Received aircraft:appeared event directly from ADSB connector', { event });
          this.handleADSBEvent(event);
        });
        
        // Listen for aircraft movement events
        this.adsbConnector.on('aircraft:moved', (event) => {
          this.logger.debug('Received aircraft:moved event directly from ADSB connector', { event });
          this.handleADSBEvent(event);
        });
        
        // Listen for aircraft update events
        this.adsbConnector.on('aircraft:updated', (event) => {
          this.logger.debug('Received aircraft:updated event directly from ADSB connector', { event });
          this.handleADSBEvent(event);
        });
        
        // Listen for aircraft disappearance events
        this.adsbConnector.on('aircraft:disappeared', (event) => {
          this.logger.debug('Received aircraft:disappeared event directly from ADSB connector', { event });
          this.handleADSBEvent(event);
        });
        
        // Listen for emergency events
        this.adsbConnector.on('aircraft:emergency', (event) => {
          this.logger.debug('Received aircraft:emergency event directly from ADSB connector', { event });
          this.handleADSBEvent(event);
        });
        
        this.logger.info('ADSB event listeners configured');
      } else {
        this.logger.warn('ADSB connector not available - no aircraft data will be processed');
      }
      
      // Set up event bus listeners for ADSB events
      if (this.eventBus) {
        // Listen for aircraft events from ADSB through event bus
        this.eventBus.on('aircraft:appeared', (event) => {
          if (event.source === 'adsb-main') {
            this.logger.debug('Received aircraft:appeared event from event bus', { event });
            this.handleADSBEvent(event);
          }
        });
        
        this.eventBus.on('aircraft:updated', (event) => {
          if (event.source === 'adsb-main') {
            this.logger.debug('Received aircraft:updated event from event bus', { event });
            this.handleADSBEvent(event);
          }
        });
        
        this.eventBus.on('aircraft:emergency', (event) => {
          if (event.source === 'adsb-main') {
            this.logger.debug('Received aircraft:emergency event from event bus', { event });
            this.handleADSBEvent(event);
          }
        });
        
        this.logger.info('Event bus listeners configured for ADSB events');
      }
      
      // Send startup notification
      await this.sendStartupNotification();
      
      // Start NOTAM monitoring for Prestwick airspace
      this.prestwickService.startNotamMonitoring();
      
      this.logger.info('Prestwick Airport Connector connected successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect Prestwick Airport Connector', { error: error.message });
      throw error;
    }
  }

  async performDisconnect() {
    try {
      this.logger.info('Disconnecting Prestwick Airport Connector');
      
      // Stop NOTAM monitoring
      this.prestwickService.stopNotamMonitoring();
      
      // Remove event listeners
      this.removePrestwickEventListeners();
      
      this.logger.info('Prestwick Airport Connector disconnected successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to disconnect Prestwick Airport Connector', { error: error.message });
      return false;
    }
  }

  setConnectorRegistry(connectorRegistry) {
    this.connectorRegistry = connectorRegistry;
  }

  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Connect to dependencies using the dependency management system
   */
  async connectToDependencies() {
    // Connect to ADSB connector (critical dependency)
    if (this.isDependencyAvailable('adsb-main')) {
      try {
        this.adsbConnector = this.getDependency('adsb-main');
        this.logger.info('Connected to ADSB connector via dependency management');
      } catch (error) {
        await this.handleDependencyFailure('adsb-main', error);
      }
    }
    
    // Connect to NOTAM connector (optional dependency)
    if (this.isDependencyAvailable('notam-main')) {
      try {
        this.notamConnector = this.getDependency('notam-main');
        this.prestwickService.setNotamConnector(this.notamConnector);
        this.logger.info('Connected to NOTAM connector via dependency management');
      } catch (error) {
        await this.handleDependencyFailure('notam-main', error);
      }
    }
  }

  /**
   * Set up event listeners for Prestwick service events
   */
  setupPrestwickEventListeners() {
    // Listen for approach events
    this.prestwickService.on('approach', (event) => {
      this.handlePrestwickEvent(event);
    });

    // Listen for landing events
    this.prestwickService.on('landing', (event) => {
      this.handlePrestwickEvent(event);
    });

    // Listen for takeoff events
    this.prestwickService.on('takeoff', (event) => {
      this.handlePrestwickEvent(event);
    });

    // Listen for departure events
    this.prestwickService.on('departure', (event) => {
      this.handlePrestwickEvent(event);
    });

    // Listen for en_route events
    this.prestwickService.on('en_route', (event) => {
      this.handlePrestwickEvent(event);
    });

    // Listen for NOTAM alert events
    this.prestwickService.on('notam:alert', (event) => {
      this.handleNotamAlertEvent(event);
    });

    // Listen for new NOTAM events
    this.prestwickService.on('notam:new', (event) => {
      this.handleNewNotamEvent(event);
    });
  }

  /**
   * Set up ADSB ground event listeners
   */
  setupADSBGroundEventListeners() {
    if (!this.adsbConnector) {
      this.logger.warn('ADSB connector not available for ground event listening');
      return;
    }

    // Listen for ground movement events
    this.adsbConnector.on('ground:movement', (event) => {
      this.handleGroundMovementEvent(event);
    });

    // Listen for taxi movement events
    this.adsbConnector.on('taxi:movement', (event) => {
      this.handleTaxiEvent(event);
    });

    // Listen for parking status events
    this.adsbConnector.on('parking:status', (event) => {
      this.handleParkingEvent(event);
    });

    // Listen for helicopter action events
    this.adsbConnector.on('helicopter:action', (event) => {
      this.handleHelicopterEvent(event);
    });

    this.logger.info('ADSB ground event listeners configured');
  }

  /**
   * Remove event listeners
   */
  removePrestwickEventListeners() {
    // The Prestwick service doesn't have a remove listener method,
    // so we'll just clear the callbacks
    this.prestwickService.eventCallbacks = {
      approach: [],
      landing: [],
      takeoff: [],
      departure: [],
      'notam:alert': [],
      'notam:new': []
    };
  }

  /**
   * Enhance aircraft data with database information
   */
  async enhanceAircraftData(aircraftData) {
    try {
      if (!aircraftData.icao24) {
        return aircraftData;
      }

      // Get enhanced aircraft information from database
      const enhancedData = await this.aircraftDataService.getAircraftRegistration(aircraftData.icao24);
      
      if (enhancedData) {
        this.stats.aircraftEnhanced++;
        this.logger.debug('Enhanced aircraft data', { 
          icao24: aircraftData.icao24, 
          registration: enhancedData.registration,
          type: enhancedData.type 
        });
        
        return {
          ...aircraftData,
          registration: aircraftData.registration || enhancedData.registration,
          icaoTypeCode: enhancedData.icaoTypeCode,
          type: enhancedData.type,
          manufacturer: enhancedData.manufacturer,
          operatorFlagCode: enhancedData.operatorFlagCode,
          serialNo: enhancedData.serialNo,
          yearBuilt: enhancedData.yearBuilt,
          owner: enhancedData.owner,
          country: enhancedData.country,
          enhanced: true
        };
      }
      
      return aircraftData;
    } catch (error) {
      this.logger.error('Error enhancing aircraft data', { 
        icao24: aircraftData.icao24, 
        error: error.message 
      });
      return aircraftData;
    }
  }

  /**
   * Emit airspace events for EGPK
   */
  emitAirspaceEvent(aircraftData, eventType, metadata = {}) {
    if (!this.eventBus) {
      return;
    }

    const airspaceEvent = {
      source: 'prestwick-airport',
      type: `airspace:${eventType}`,
      data: {
        icao24: aircraftData.icao24,
        callsign: aircraftData.callsign,
        registration: aircraftData.registration,
        type: aircraftData.type,
        manufacturer: aircraftData.manufacturer,
        altitude: aircraftData.altitude,
        speed: aircraftData.speed,
        heading: aircraftData.heading,
        squawk: aircraftData.squawk,
        latitude: aircraftData.latitude,
        longitude: aircraftData.longitude,
        distance: metadata.distance,
        runway: metadata.runway,
        airspace: {
          code: 'EGPK',
          name: 'Glasgow Prestwick Airport',
          type: 'CTR', // Control Zone
          radius: this.prestwickService.config.approachRadius / 1000, // km
          center: {
            latitude: this.prestwickService.config.latitude,
            longitude: this.prestwickService.config.longitude
          }
        },
        enhanced: aircraftData.enhanced || false
      },
      timestamp: new Date().toISOString()
    };

    this.eventBus.emit(`airspace:${eventType}`, airspaceEvent);
    
    this.logger.info(`Airspace event emitted: ${eventType}`, {
      icao24: aircraftData.icao24,
      callsign: aircraftData.callsign,
      distance: metadata.distance
    });
  }

  /**
   * Check and emit airspace boundary events
   */
  checkAirspaceBoundary(aircraftData, previousDistance) {
    const currentDistance = this.prestwickService.calculateDistance(
      aircraftData.latitude,
      aircraftData.longitude,
      this.prestwickService.config.latitude,
      this.prestwickService.config.longitude
    );

    const airspaceRadius = this.prestwickService.config.approachRadius;
    
    // Aircraft entering airspace
    if (previousDistance > airspaceRadius && currentDistance <= airspaceRadius) {
      this.emitAirspaceEvent(aircraftData, 'entered', { 
        distance: currentDistance,
        previousDistance 
      });
    }
    
    // Aircraft exiting airspace
    if (previousDistance <= airspaceRadius && currentDistance > airspaceRadius) {
      this.emitAirspaceEvent(aircraftData, 'exited', { 
        distance: currentDistance,
        previousDistance 
      });
    }
    
    // Aircraft in approach zone (within 10km)
    if (currentDistance <= 10000 && currentDistance > 5000) {
      this.emitAirspaceEvent(aircraftData, 'approach_zone', { 
        distance: currentDistance 
      });
    }
    
    // Aircraft in terminal area (within 5km)
    if (currentDistance <= 5000) {
      this.emitAirspaceEvent(aircraftData, 'terminal_area', { 
        distance: currentDistance 
      });
    }
  }

  /**
   * Handle ADSB events and process them through Prestwick service
   */
  async handleADSBEvent(event) {
    try {
      this.logger.debug('Processing ADSB event in Prestwick connector', { eventType: event.type, event });
      
      let aircraftData;
      
      // Handle different event types
      if (event.aircraft) {
        // Event has aircraft property (e.g., aircraft:moved)
        aircraftData = event.aircraft;
      } else if (event.icao24 || event.hex) {
        // Direct aircraft data
        aircraftData = event;
      } else {
        this.logger.warn('Unknown ADSB event format', { event });
        return;
      }
      
      // Extract aircraft data with fallbacks
      const processedData = {
        icao24: aircraftData.icao24 || aircraftData.hex,
        callsign: aircraftData.callsign || aircraftData.flight,
        registration: aircraftData.registration,
        latitude: aircraftData.latitude || aircraftData.lat,
        longitude: aircraftData.longitude || aircraftData.lon,
        altitude: aircraftData.altitude || aircraftData.alt_baro,
        speed: aircraftData.speed || aircraftData.gs,
        heading: aircraftData.heading || aircraftData.track,
        squawk: aircraftData.squawk,
        timestamp: aircraftData.timestamp || event.timestamp || new Date().toISOString()
      };

      this.logger.debug('Processed aircraft data', { processedData });

      // Enhance aircraft data with database information
      const enhancedData = await this.enhanceAircraftData(processedData);

      // Check airspace boundaries
      const previousDistance = this.aircraftDistances.get(enhancedData.icao24);
      this.checkAirspaceBoundary(enhancedData, previousDistance);
      
      // Update distance tracking
      const currentDistance = this.prestwickService.calculateDistance(
        enhancedData.latitude,
        enhancedData.longitude,
        this.prestwickService.config.latitude,
        this.prestwickService.config.longitude
      );
      this.aircraftDistances.set(enhancedData.icao24, currentDistance);

      // Check if this is the first data received
      if (!this.firstDataReceived) {
        this.firstDataReceived = true;
        this.sendFirstDataNotification(enhancedData);
      }

      // Process through Prestwick service
      const result = this.prestwickService.processAircraftUpdate(enhancedData);
      
      if (result) {
        this.stats.totalAircraftProcessed++;
        this.stats.lastActivity = new Date().toISOString();
        
        // Update stats from Prestwick service
        const prestwickStats = this.prestwickService.getStats();
        this.stats.totalApproaches = prestwickStats.totalApproaches;
        this.stats.totalLandings = prestwickStats.totalLandings;
        this.stats.totalTakeoffs = prestwickStats.totalTakeoffs;
        this.stats.totalDepartures = prestwickStats.totalDepartures;
        
        this.logger.debug('Processed aircraft update', {
          icao24: enhancedData.icao24,
          callsign: enhancedData.callsign,
          registration: enhancedData.registration,
          type: enhancedData.type,
          distance: currentDistance,
          result: result
        });
      }
    } catch (error) {
      this.logger.error('Error handling ADSB event', { error: error.message, event });
    }
  }

  /**
   * Handle NOTAM alert events
   */
  async handleNotamAlertEvent(event) {
    const { data } = event;
    const { notamAlert } = data;
    
    if (!notamAlert) {
      this.logger.warn('No NOTAM alert data in event');
      return;
    }
    
    this.logger.info(`Processing NOTAM alert for ${notamAlert.notamNumber}`);
    
    // Send notification event
    await this.sendNotamTelegramNotification(notamAlert);
    
    // Update statistics
    this.stats.notamAlerts++;
    this.stats.lastActivity = new Date().toISOString();
    
    // Emit event to event bus
    if (this.eventBus) {
      this.eventBus.emit('prestwick:notam:alert', {
        source: 'prestwick-airport',
        type: 'notam:alert',
        data: notamAlert,
        aircraftData: data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle new NOTAM events
   */
  async handleNewNotamEvent(event) {
    const { data } = event;
    
    if (!data) {
      this.logger.warn('No NOTAM data in event');
      return;
    }
    
    this.logger.info(`New NOTAM detected: ${data.notamNumber}`);
    
    // Send notification event
    await this.sendNewNotamTelegramNotification(data);
    
    // Update statistics
    this.stats.notamQueries++;
    this.stats.lastActivity = new Date().toISOString();
    
    // Emit event to event bus
    if (this.eventBus) {
      this.eventBus.emit('prestwick:notam:new', {
        source: 'prestwick-airport',
        type: 'notam:new',
        data: data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle Prestwick service events
   */
  async handlePrestwickEvent(event) {
    const { type, data } = event;
    
    // Update statistics
    this.stats.lastActivity = new Date().toISOString();
    
    // Check for NOTAMs if enabled
    if (this.notamConfig.enabled && data.latitude && data.longitude) {
      try {
        const aircraftPosition = { lat: data.latitude, lon: data.longitude };
        const notamAlerts = await this.prestwickService.getNotamAlerts(aircraftPosition, type);
        
        if (notamAlerts.length > 0) {
          this.logger.info(`Found ${notamAlerts.length} NOTAM alerts for ${type} operation`);
          
          // Send NOTAM alerts via notification events
          for (const alert of notamAlerts) {
            await this.sendNotamTelegramNotification(alert);
          }
          
          // Emit NOTAM alert events
          if (this.eventBus) {
            this.eventBus.emit('prestwick:notam:alert', {
              source: 'prestwick-airport',
              type: 'notam:alert',
              data: notamAlerts,
              aircraftData: data,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        this.logger.error('Error checking NOTAMs', { error: error.message });
      }
    }
    
    switch (type) {
      case 'approach':
        this.stats.totalApproaches++;
        this.sendTelegramNotification('approach', data);
        break;
      case 'landing':
        this.stats.totalLandings++;
        this.sendTelegramNotification('landing', data);
        break;
      case 'takeoff':
        this.stats.totalTakeoffs++;
        this.sendTelegramNotification('takeoff', data);
        break;
      case 'departure':
        this.stats.totalDepartures++;
        this.sendTelegramNotification('departure', data);
        break;
      case 'en_route':
        this.stats.totalEnRoute++;
        this.sendTelegramNotification('en_route', data);
        break;
    }
    
    // Emit event to event bus
    if (this.eventBus) {
      this.eventBus.emit(`prestwick:${type}`, {
        source: 'prestwick-airport',
        type,
        data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle ground movement events from ADSB connector
   */
  async handleGroundMovementEvent(event) {
    const { aircraft, metadata } = event;
    
    // Only process events for aircraft at Prestwick
    if (!this.isAircraftAtPrestwick(aircraft)) {
      return;
    }

    this.logger.info('Ground movement detected at Prestwick', {
      icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      movementType: metadata.movementType,
      confidence: metadata.confidence
    });

    // Send notification event for ground movement events
    await this.sendGroundMovementTelegramNotification(aircraft, metadata);

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit('prestwick:ground:movement', {
        source: 'prestwick-airport',
        type: 'ground:movement',
        data: {
          icao24: aircraft.icao24,
          callsign: aircraft.callsign,
          registration: aircraft.registration,
          movementType: metadata.movementType,
          confidence: metadata.confidence,
          location: metadata.location,
          airport: {
            code: this.prestwickService.config.airportCode,
            name: this.prestwickService.config.airportName
          }
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle taxi movement events from ADSB connector
   */
  async handleTaxiEvent(event) {
    const { aircraft, metadata } = event;
    
    // Only process events for aircraft at Prestwick
    if (!this.isAircraftAtPrestwick(aircraft)) {
      return;
    }

    this.logger.info('Taxi movement detected at Prestwick', {
      icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      taxiPhase: metadata.taxiPhase,
      confidence: metadata.confidence
    });

    // Send notification event for taxi events
    await this.sendTaxiTelegramNotification(aircraft, metadata);

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit('prestwick:taxi:movement', {
        source: 'prestwick-airport',
        type: 'taxi:movement',
        data: {
          icao24: aircraft.icao24,
          callsign: aircraft.callsign,
          registration: aircraft.registration,
          taxiPhase: metadata.taxiPhase,
          confidence: metadata.confidence,
          location: metadata.location,
          airport: {
            code: this.prestwickService.config.airportCode,
            name: this.prestwickService.config.airportName
          }
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle parking status events from ADSB connector
   */
  async handleParkingEvent(event) {
    const { aircraft, metadata } = event;
    
    // Only process events for aircraft at Prestwick
    if (!this.isAircraftAtPrestwick(aircraft)) {
      return;
    }

    this.logger.info('Parking status detected at Prestwick', {
      icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      parkingArea: metadata.parkingArea,
      confidence: metadata.confidence
    });

    // Send notification event for parking events
    await this.sendParkingTelegramNotification(aircraft, metadata);

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit('prestwick:parking:status', {
        source: 'prestwick-airport',
        type: 'parking:status',
        data: {
          icao24: aircraft.icao24,
          callsign: aircraft.callsign,
          registration: aircraft.registration,
          parkingArea: metadata.parkingArea,
          confidence: metadata.confidence,
          location: metadata.location,
          airport: {
            code: this.prestwickService.config.airportCode,
            name: this.prestwickService.config.airportName
          }
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle helicopter action events from ADSB connector
   */
  async handleHelicopterEvent(event) {
    const { aircraft, metadata } = event;
    
    // Only process events for aircraft at Prestwick
    if (!this.isAircraftAtPrestwick(aircraft)) {
      return;
    }

    this.logger.info('Helicopter action detected at Prestwick', {
      icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      action: metadata.action,
      confidence: metadata.confidence
    });

    // Send notification event for helicopter events
    await this.sendHelicopterTelegramNotification(aircraft, metadata);

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit('prestwick:helicopter:action', {
        source: 'prestwick-airport',
        type: 'helicopter:action',
        data: {
          icao24: aircraft.icao24,
          callsign: aircraft.callsign,
          registration: aircraft.registration,
          action: metadata.action,
          confidence: metadata.confidence,
          location: metadata.location,
          airport: {
            code: this.prestwickService.config.airportCode,
            name: this.prestwickService.config.airportName
          }
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Check if aircraft is at Prestwick airport
   */
  isAircraftAtPrestwick(aircraft) {
    if (!aircraft.lat || !aircraft.lon) {
      return false;
    }

    const distance = this.prestwickService.calculateDistance(
      aircraft.lat, aircraft.lon,
      this.prestwickService.config.latitude,
      this.prestwickService.config.longitude
    );

    // Consider aircraft at Prestwick if within 5km
    return distance <= 5000;
  }

  /**
   * Send notification event for aircraft events
   */
  async sendTelegramNotification(eventType, aircraftData) {
    try {
      const notificationData = {
        type: `aircraft:${eventType}`,
        source: 'prestwick-airport',
        priority: 'medium',
        message: this.formatTelegramMessage(eventType, aircraftData),
        data: {
          eventType,
          aircraft: aircraftData,
          airport: {
            code: this.prestwickService.config.airportCode,
            name: this.prestwickService.config.airportName
          }
        },
        timestamp: new Date().toISOString()
      };

      // Emit notification event to alarm center
      if (this.eventBus) {
        this.eventBus.emit('alarm:notification', notificationData);
      }
      
      this.logger.info(`${eventType} notification event emitted`, {
        icao24: aircraftData.icao24,
        callsign: aircraftData.callsign
      });
    } catch (error) {
      this.logger.error(`Failed to emit ${eventType} notification:`, error.message);
    }
  }

  /**
   * Format message for notification event
   */
  formatTelegramMessage(eventType, aircraftData) {
    const { icao24, callsign, registration, altitude, speed, heading, runway } = aircraftData;
    
    const eventEmoji = {
      approach: '🛬',
      landing: '✈️',
      takeoff: '🛫',
      departure: '🛩️',
      en_route: '✈️'
    };
    
    const eventText = {
      approach: 'Approaching',
      landing: 'Landing',
      takeoff: 'Taking off',
      departure: 'Departing',
      en_route: 'En Route'
    };
    
    const emoji = eventEmoji[eventType] || '✈️';
    const action = eventText[eventType] || eventType;
    
    let message = `${emoji} <b>${action} at Prestwick Airport (EGPK)</b>\n\n`;
    
    if (callsign) {
      message += `Flight: <b>${callsign}</b>\n`;
    }
    
    if (registration) {
      message += `Registration: <b>${registration}</b>\n`;
    }
    
    if (icao24) {
      message += `ICAO24: <code>${icao24}</code>\n`;
    }
    
    if (altitude) {
      message += `Altitude: <b>${Math.round(altitude)}ft</b>\n`;
    }
    
    if (speed) {
      message += `Speed: <b>${Math.round(speed)}kts</b>\n`;
    }
    
    if (heading) {
      message += `Heading: <b>${Math.round(heading)}°</b>\n`;
    }
    
    if (runway) {
      message += `Runway: <b>${runway}</b>\n`;
    }
    
    message += `\nTime: <i>${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</i>`;
    
    return message;
  }

  /**
   * Send notification event for ground movement events
   */
  async sendGroundMovementTelegramNotification(aircraft, metadata) {
    try {
      const notificationData = {
        type: 'ground:movement',
        source: 'prestwick-airport',
        priority: 'medium',
        message: this.formatGroundMovementTelegramMessage(aircraft, metadata),
        data: {
          icao24: aircraft.icao24,
          callsign: aircraft.callsign,
          registration: aircraft.registration,
          movementType: metadata.movementType,
          confidence: metadata.confidence,
          location: metadata.location,
          airport: {
            code: this.prestwickService.config.airportCode,
            name: this.prestwickService.config.airportName
          }
        },
        timestamp: new Date().toISOString()
      };

      // Emit notification event to alarm center
      if (this.eventBus) {
        this.eventBus.emit('alarm:notification', notificationData);
      }
      
      this.logger.info('Ground movement notification event emitted', {
        icao24: aircraft.icao24,
        callsign: aircraft.callsign
      });
    } catch (error) {
      this.logger.error('Failed to emit ground movement notification:', error.message);
    }
  }

  /**
   * Format message for taxi Telegram notification
   */
  formatTaxiTelegramMessage(aircraft, metadata) {
    const { icao24, callsign, registration } = aircraft;
    const { taxiPhase, confidence, location } = metadata;
    
    const phaseEmoji = {
      runway_approach: '🛫',
      taxiway: '🚗',
      apron: '🅿️'
    };
    
    const phaseText = {
      runway_approach: 'Approaching Runway',
      taxiway: 'On Taxiway',
      apron: 'On Apron'
    };
    
    const emoji = phaseEmoji[taxiPhase] || '🚗';
    const phase = phaseText[taxiPhase] || taxiPhase;
    
    let message = `${emoji} <b>Taxiing at Prestwick Airport (EGPK)</b>\n\n`;
    
    if (callsign) {
      message += `Flight: <b>${callsign}</b>\n`;
    }
    
    if (registration) {
      message += `Registration: <b>${registration}</b>\n`;
    }
    
    if (icao24) {
      message += `ICAO24: <code>${icao24}</code>\n`;
    }
    
    if (location && location.altitude) {
      message += `Altitude: <b>${Math.round(location.altitude)}ft</b>\n`;
    }
    
    message += `Phase: <b>${phase}</b>\n`;
    message += `Confidence: <b>${Math.round(confidence * 100)}%</b>\n`;
    
    message += `\nTime: <i>${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</i>`;
    
    return message;
  }

  /**
   * Send notification event for parking events
   */
  async sendParkingTelegramNotification(aircraft, metadata) {
    try {
      const notificationData = {
        type: 'parking:status',
        source: 'prestwick-airport',
        priority: 'medium',
        message: this.formatParkingTelegramMessage(aircraft, metadata),
        data: {
          icao24: aircraft.icao24,
          callsign: aircraft.callsign,
          registration: aircraft.registration,
          parkingArea: metadata.parkingArea,
          confidence: metadata.confidence,
          location: metadata.location,
          airport: {
            code: this.prestwickService.config.airportCode,
            name: this.prestwickService.config.airportName
          }
        },
        timestamp: new Date().toISOString()
      };

      // Emit notification event to alarm center
      if (this.eventBus) {
        this.eventBus.emit('alarm:notification', notificationData);
      }
      
      this.logger.info('Parking notification event emitted', {
        icao24: aircraft.icao24,
        callsign: aircraft.callsign
      });
    } catch (error) {
      this.logger.error('Failed to emit parking notification:', error.message);
    }
  }

  /**
   * Send notification event for helicopter events
   */
  async sendHelicopterTelegramNotification(aircraft, metadata) {
    try {
      const notificationData = {
        type: 'helicopter:action',
        source: 'prestwick-airport',
        priority: 'medium',
        message: this.formatHelicopterTelegramMessage(aircraft, metadata),
        data: {
          icao24: aircraft.icao24,
          callsign: aircraft.callsign,
          registration: aircraft.registration,
          action: metadata.action,
          confidence: metadata.confidence,
          location: metadata.location,
          airport: {
            code: this.prestwickService.config.airportCode,
            name: this.prestwickService.config.airportName
          }
        },
        timestamp: new Date().toISOString()
      };

      // Emit notification event to alarm center
      if (this.eventBus) {
        this.eventBus.emit('alarm:notification', notificationData);
      }
      
      this.logger.info('Helicopter notification event emitted', {
        icao24: aircraft.icao24,
        callsign: aircraft.callsign
      });
    } catch (error) {
      this.logger.error('Failed to emit helicopter notification:', error.message);
    }
  }

  /**
   * Format message for ground movement Telegram notification
   */
  formatGroundMovementTelegramMessage(aircraft, metadata) {
    const { icao24, callsign, registration } = aircraft;
    const { movementType, confidence, location } = metadata;
    
    const movementEmoji = {
      taxi: '🚗',
      parked: '🅿️',
      moving: '🔄',
      stationary: '⏸️'
    };
    
    const movementText = {
      taxi: 'Taxiing',
      parked: 'Parked',
      moving: 'Moving on Ground',
      stationary: 'Stationary on Ground'
    };
    
    const emoji = movementEmoji[movementType] || '🛬';
    const action = movementText[movementType] || movementType;
    
    let message = `${emoji} <b>${action} at Prestwick Airport (EGPK)</b>\n\n`;
    
    if (callsign) {
      message += `Flight: <b>${callsign}</b>\n`;
    }
    
    if (registration) {
      message += `Registration: <b>${registration}</b>\n`;
    }
    
    if (icao24) {
      message += `ICAO24: <code>${icao24}</code>\n`;
    }
    
    if (location && location.altitude) {
      message += `Altitude: <b>${Math.round(location.altitude)}ft</b>\n`;
    }
    
    message += `Movement Type: <b>${movementType}</b>\n`;
    message += `Confidence: <b>${Math.round(confidence * 100)}%</b>\n`;
    
    message += `\nTime: <i>${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</i>`;
    
    return message;
  }

  /**
   * Format message for parking Telegram notification
   */
  formatParkingTelegramMessage(aircraft, metadata) {
    const { icao24, callsign, registration } = aircraft;
    const { parkingArea, confidence, location } = metadata;
    
    const areaEmoji = {
      terminal: '🏢',
      apron: '🅿️',
      remote_parking: '🚁',
      maintenance_area: '🔧'
    };
    
    const areaText = {
      terminal: 'Terminal Area',
      apron: 'Apron',
      remote_parking: 'Remote Parking',
      maintenance_area: 'Maintenance Area'
    };
    
    const emoji = areaEmoji[parkingArea] || '🅿️';
    const area = areaText[parkingArea] || parkingArea;
    
    let message = `${emoji} <b>Parked at Prestwick Airport (EGPK)</b>\n\n`;
    
    if (callsign) {
      message += `Flight: <b>${callsign}</b>\n`;
    }
    
    if (registration) {
      message += `Registration: <b>${registration}</b>\n`;
    }
    
    if (icao24) {
      message += `ICAO24: <code>${icao24}</code>\n`;
    }
    
    if (location && location.altitude) {
      message += `Altitude: <b>${Math.round(location.altitude)}ft</b>\n`;
    }
    
    message += `Parking Area: <b>${area}</b>\n`;
    message += `Confidence: <b>${Math.round(confidence * 100)}%</b>\n`;
    
    message += `\nTime: <i>${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</i>`;
    
    return message;
  }

  /**
   * Format message for helicopter Telegram notification
   */
  formatHelicopterTelegramMessage(aircraft, metadata) {
    const { icao24, callsign, registration } = aircraft;
    const { action, confidence, location } = metadata;
    
    const actionEmoji = {
      takeoff: '🚁',
      landing: '🚁',
      hovering_low: '🔄',
      hovering_high: '🔄',
      flying: '🚁'
    };
    
    const actionText = {
      takeoff: 'Taking Off',
      landing: 'Landing',
      hovering_low: 'Hovering (Low)',
      hovering_high: 'Hovering (High)',
      flying: 'Flying'
    };
    
    const emoji = actionEmoji[action] || '🚁';
    const actionText_ = actionText[action] || action;
    
    let message = `${emoji} <b>Helicopter ${actionText_} at Prestwick Airport (EGPK)</b>\n\n`;
    
    if (callsign) {
      message += `Flight: <b>${callsign}</b>\n`;
    }
    
    if (registration) {
      message += `Registration: <b>${registration}</b>\n`;
    }
    
    if (icao24) {
      message += `ICAO24: <code>${icao24}</code>\n`;
    }
    
    if (location && location.altitude) {
      message += `Altitude: <b>${Math.round(location.altitude)}ft</b>\n`;
    }
    
    message += `Action: <b>${actionText_}</b>\n`;
    message += `Confidence: <b>${Math.round(confidence * 100)}%</b>\n`;
    
    message += `\nTime: <i>${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</i>`;
    
    return message;
  }

  /**
   * Send notification event for NOTAM alert
   */
  async sendNotamTelegramNotification(notamAlert) {
    try {
      const notificationData = {
        type: 'notam:alert',
        source: 'prestwick-airport',
        priority: 'high',
        message: this.formatNotamTelegramMessage(notamAlert),
        data: {
          notamAlert,
          airport: {
            code: this.prestwickService.config.airportCode,
            name: this.prestwickService.config.airportName
          }
        },
        timestamp: new Date().toISOString()
      };

      // Emit notification event to alarm center
      if (this.eventBus) {
        this.eventBus.emit('alarm:notification', notificationData);
      }

      this.logger.info(`NOTAM notification event emitted for ${notamAlert.notamNumber}`);
      
    } catch (error) {
      this.logger.error(`Failed to emit NOTAM notification:`, error.message);
    }
  }

  /**
   * Format NOTAM message for Telegram notification
   */
  formatNotamTelegramMessage(notamAlert) {
    const { notamNumber, title, description, priority, category, distance, operationType } = notamAlert;
    
    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };
    
    const operationEmoji = {
      approach: '🛬',
      landing: '✈️',
      takeoff: '🛫',
      departure: '🛩️'
    };
    
    const emoji = priorityEmoji[priority] || '⚠️';
    const operationIcon = operationEmoji[operationType] || '✈️';
    
    let message = `${emoji} <b>NOTAM Alert - Prestwick Airport</b>\n\n`;
    message += `${operationIcon} <b>${operationType.toUpperCase()}</b> Operation\n\n`;
    
    if (notamNumber) {
      message += `NOTAM: <b>${notamNumber}</b>\n`;
    }
    
    if (title) {
      message += `Title: <b>${title}</b>\n`;
    }
    
    if (category) {
      message += `Category: <b>${category}</b>\n`;
    }
    
    if (priority) {
      message += `Priority: <b>${priority.toUpperCase()}</b>\n`;
    }
    
    if (distance) {
      message += `Distance: <b>${Math.round(distance)}km</b>\n`;
    }
    
    if (description) {
      // Truncate description if too long
      const maxLength = 200;
      const truncatedDesc = description.length > maxLength 
        ? description.substring(0, maxLength) + '...'
        : description;
      message += `\nDescription: <i>${truncatedDesc}</i>\n`;
    }
    
    message += `\nTime: <i>${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</i>`;
    
    return message;
  }

  /**
   * Send notification event for new NOTAM
   */
  async sendNewNotamTelegramNotification(notamData) {
    try {
      const notificationData = {
        type: 'notam:new',
        source: 'prestwick-airport',
        priority: 'high',
        message: this.formatNewNotamTelegramMessage(notamData),
        data: {
          notamData,
          airport: {
            code: this.prestwickService.config.airportCode,
            name: this.prestwickService.config.airportName
          }
        },
        timestamp: new Date().toISOString()
      };

      // Emit notification event to alarm center
      if (this.eventBus) {
        this.eventBus.emit('alarm:notification', notificationData);
      }

      this.logger.info(`New NOTAM notification event emitted for ${notamData.notamNumber}`);
      
    } catch (error) {
      this.logger.error(`Failed to emit new NOTAM notification:`, error.message);
    }
  }

  /**
   * Format new NOTAM message for Telegram notification
   */
  formatNewNotamTelegramMessage(notamData) {
    const { notamNumber, title, description, priority, category, distance, startTime, endTime } = notamData;
    
    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };
    
    const categoryEmoji = {
      runway: '🛫',
      approach: '🛬',
      landing: '✈️',
      takeoff: '🛫',
      airport: '🏢',
      navigation: '🧭',
      airspace: '🌐'
    };
    
    const emoji = priorityEmoji[priority] || '⚠️';
    const categoryIcon = categoryEmoji[category] || '✈️';
    
    let message = `${emoji} <b>NEW NOTAM - Prestwick Airport (EGPK)</b>\n\n`;
    
    if (notamNumber) {
      message += `NOTAM: <b>${notamNumber}</b>\n`;
    }
    
    if (title) {
      message += `Title: <b>${title}</b>\n`;
    }
    
    if (category) {
      message += `Category: <b>${category.toUpperCase()}</b> ${categoryIcon}\n`;
    }
    
    if (priority) {
      message += `Priority: <b>${priority.toUpperCase()}</b>\n`;
    }
    
    if (distance) {
      message += `Distance: <b>${Math.round(distance)}km</b> from EGPK\n`;
    }
    
    if (startTime) {
      const startDate = new Date(startTime).toLocaleString('en-GB', { timeZone: 'Europe/London' });
      message += `Start: <b>${startDate}</b>\n`;
    }
    
    if (endTime) {
      const endDate = new Date(endTime).toLocaleString('en-GB', { timeZone: 'Europe/London' });
      message += `End: <b>${endDate}</b>\n`;
    }
    
    if (description) {
      // Truncate description if too long
      const maxLength = 300;
      const truncatedDesc = description.length > maxLength 
        ? description.substring(0, maxLength) + '...'
        : description;
      message += `\nDescription: <i>${truncatedDesc}</i>\n`;
    }
    
    message += `\n📍 <b>Affects Prestwick Airport Operations</b>\n`;
    message += `⏰ Detected: <i>${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</i>`;
    
    return message;
  }

  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters = {}) {
    try {
      switch (capabilityId) {
        case 'aircraft:tracking':
          return this.executeAircraftTrackingOperation(operation, parameters);
        case 'airport:operations':
          return this.executeAirportOperationsOperation(operation, parameters);
        case 'runway:detection':
          return this.executeRunwayDetectionOperation(operation, parameters);
        case 'events:aircraft':
          return this.executeAircraftEventsOperation(operation, parameters);
        case 'notam:integration':
          return this.executeNotamIntegrationOperation(operation, parameters);
        default:
          throw new Error(`Unknown capability: ${capabilityId}`);
      }
    } catch (error) {
      this.logger.error(`Error executing capability ${capabilityId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Execute aircraft tracking operations
   */
  executeAircraftTrackingOperation(operation, parameters) {
    switch (operation) {
      case 'get_tracked_aircraft':
        return this.prestwickService.getTrackedAircraft();
      case 'get_aircraft_history':
        const limit = parameters.limit || 100;
        return this.prestwickService.getAircraftHistory(limit);
      default:
        throw new Error(`Unknown aircraft tracking operation: ${operation}`);
    }
  }

  /**
   * Execute airport operations
   */
  executeAirportOperationsOperation(operation, parameters) {
    switch (operation) {
      case 'get_stats':
        return {
          connector: this.stats,
          prestwick: this.prestwickService.getStats()
        };
      case 'get_runways':
        return this.prestwickService.getRunways();
      case 'get_config':
        return this.prestwickService.getConfig();
      default:
        throw new Error(`Unknown airport operations operation: ${operation}`);
    }
  }

  /**
   * Execute runway detection operations
   */
  executeRunwayDetectionOperation(operation, parameters) {
    switch (operation) {
      case 'determine_runway':
        const { latitude, longitude, heading } = parameters;
        if (!latitude || !longitude || !heading) {
          throw new Error('latitude, longitude, and heading are required');
        }
        return this.prestwickService.determineRunway(latitude, longitude, heading);
      case 'get_runway_info':
        return this.prestwickService.getRunways();
      default:
        throw new Error(`Unknown runway detection operation: ${operation}`);
    }
  }

  /**
   * Execute aircraft events operations
   */
  executeAircraftEventsOperation(operation, parameters) {
    switch (operation) {
      case 'subscribe_events':
        const { eventType, callback } = parameters;
        if (!eventType || !callback) {
          throw new Error('eventType and callback are required');
        }
        this.prestwickService.on(eventType, callback);
        return { success: true };
      case 'get_event_history':
        const limit = parameters.limit || 100;
        return this.prestwickService.getAircraftHistory(limit);
      default:
        throw new Error(`Unknown aircraft events operation: ${operation}`);
    }
  }

  /**
   * Execute NOTAM integration operations
   */
  executeNotamIntegrationOperation(operation, parameters) {
    switch (operation) {
      case 'query_notams':
        const { radius, category, priority, aircraftPosition } = parameters;
        if (!radius || !category || !priority || !aircraftPosition) {
          throw new Error('radius, category, priority, and aircraftPosition are required');
        }
        return this.prestwickService.queryNotams(radius, category, priority, aircraftPosition);
      case 'check_notams':
        const { notamId } = parameters;
        if (!notamId) {
          throw new Error('notamId is required');
        }
        return this.prestwickService.checkNotam(notamId);
      case 'get_notam_alerts':
        const { notamIds } = parameters;
        if (!notamIds || !Array.isArray(notamIds)) {
          throw new Error('notamIds must be an array');
        }
        return this.prestwickService.getNotamAlerts(notamIds);
      case 'configure_notam_monitoring':
        const { enabled, searchRadius, checkOnApproach, checkOnLanding, checkOnTakeoff, priorityThreshold } = parameters;
        this.notamConfig.enabled = enabled !== undefined ? enabled : this.notamConfig.enabled;
        this.notamConfig.searchRadius = searchRadius || this.notamConfig.searchRadius;
        this.notamConfig.checkOnApproach = checkOnApproach !== undefined ? checkOnApproach : this.notamConfig.checkOnApproach;
        this.notamConfig.checkOnLanding = checkOnLanding !== undefined ? checkOnLanding : this.notamConfig.checkOnLanding;
        this.notamConfig.checkOnTakeoff = checkOnTakeoff !== undefined ? checkOnTakeoff : this.notamConfig.checkOnTakeoff;
        this.notamConfig.priorityThreshold = priorityThreshold || this.notamConfig.priorityThreshold;
        
        // Try to reconnect to NOTAM connector if enabled
        if (this.notamConfig.enabled && !this.notamConnector) {
          this.connectToDependencies();
        }
        
        return { 
          success: true, 
          config: this.notamConfig 
        };
        
      default:
        throw new Error(`Unknown NOTAM integration operation: ${operation}`);
    }
  }

  /**
   * Get connector status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      adsbConnected: !!this.adsbConnector,
      notamConnected: !!this.notamConnector,
      eventBusConnected: !!this.eventBus,
      stats: this.stats,
      prestwickStats: this.prestwickService.getStats(),
      notamConfig: this.notamConfig
    };
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    try {
      const status = this.getStatus();
      const prestwickConfig = this.prestwickService.getConfig();
      
      return {
        healthy: this.isConnected,
        status,
        config: prestwickConfig,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Send startup notification event
   */
  async sendStartupNotification() {
    if (this.startupNotificationSent) {
      return;
    }

    try {
      const notificationData = {
        type: 'startup',
        source: 'prestwick-airport',
        priority: 'low',
        message: this.formatStartupNotificationMessage(),
        data: {
          airportCode: 'EGPK',
          airportName: 'Prestwick Airport',
          connections: {
            adsb: !!this.adsbConnector,
            notam: !!this.notamConnector
          }
        },
        timestamp: new Date().toISOString()
      };

      // Emit notification event to alarm center
      if (this.eventBus) {
        this.eventBus.emit('alarm:notification', notificationData);
      }
      
      this.startupNotificationSent = true;
      this.logger.info('Startup notification event emitted');
    } catch (error) {
      this.logger.error('Failed to emit startup notification:', error.message);
    }
  }

  /**
   * Format startup notification message
   */
  formatStartupNotificationMessage() {
    const config = this.prestwickService.getConfig();
    
    let message = `🟢 <b>Prestwick Airport Connector Active</b>\n\n`;
    message += `Airport: <b>${config.airportName} (${config.airportCode})</b>\n`;
    message += `Location: <b>${config.latitude}°N, ${config.longitude}°W</b>\n`;
    message += `Approach Radius: <b>${config.approachRadius}km</b>\n\n`;
    
    message += `📡 <b>Monitoring:</b>\n`;
    message += `• Aircraft Approaches\n`;
    message += `• Aircraft Landings\n`;
    message += `• Aircraft Takeoffs\n`;
    message += `• Aircraft Departures\n`;
    message += `• NOTAM Alerts\n`;
    
    message += `\n🔗 <b>Connections:</b>\n`;
    message += `• ADSB: ${this.adsbConnector ? '✅ Connected' : '❌ Disconnected'}\n`;
    message += `• NOTAM: ${this.notamConnector ? '✅ Connected' : '❌ Disconnected'}\n`;
    
    message += `\n⏰ Started: <i>${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</i>`;
    
    return message;
  }

  /**
   * Send first data notification event
   */
  async sendFirstDataNotification(aircraftData) {
    try {
      const notificationData = {
        type: 'first_data',
        source: 'prestwick-airport',
        priority: 'low',
        message: this.formatFirstDataNotificationMessage(aircraftData),
        data: {
          aircraft: aircraftData,
          airport: {
            code: this.prestwickService.config.airportCode,
            name: this.prestwickService.config.airportName
          }
        },
        timestamp: new Date().toISOString()
      };

      // Emit notification event to alarm center
      if (this.eventBus) {
        this.eventBus.emit('alarm:notification', notificationData);
      }
      
      this.logger.info('First data notification event emitted');
    } catch (error) {
      this.logger.error('Failed to emit first data notification:', error.message);
    }
  }

  /**
   * Format first data notification message
   */
  formatFirstDataNotificationMessage(aircraftData) {
    const { icao24, callsign, registration, altitude, speed, heading, runway } = aircraftData;
    
    let message = `🟢 First ADSB data received from Prestwick Airport (EGPK)\n\n`;
    
    if (callsign) {
      message += `Flight: <b>${callsign}</b>\n`;
    }
    
    if (registration) {
      message += `Registration: <b>${registration}</b>\n`;
    }
    
    if (icao24) {
      message += `ICAO24: <code>${icao24}</code>\n`;
    }
    
    if (altitude) {
      message += `Altitude: <b>${Math.round(altitude)}ft</b>\n`;
    }
    
    if (speed) {
      message += `Speed: <b>${Math.round(speed)}kts</b>\n`;
    }
    
    if (heading) {
      message += `Heading: <b>${Math.round(heading)}°</b>\n`;
    }
    
    if (runway) {
      message += `Runway: <b>${runway}</b>\n`;
    }
    
    message += `\nTime: <i>${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</i>`;
    
    return message;
  }

  /**
   * Initialize dependencies for Prestwick Airport Connector
   */
  initializeDependencies() {
    // Declare critical dependency on ADSB connector (support multiple ADSB sources)
    this.declareDependency('adsb-main', {
      required: true,
      critical: true,
      description: 'ADSB connector for aircraft data',
      capabilities: ['aircraft:tracking'],
      fallback: 'degraded_mode'
    });
    
    // Also support the new ADS-B connectors
    this.declareDependency('adsbfi-main', {
      required: false,
      critical: false,
      description: 'ADS-B.fi connector for aircraft data',
      capabilities: ['aircraft:tracking'],
      fallback: 'degraded_mode'
    });
    
    this.declareDependency('airplaneslive-main', {
      required: false,
      critical: false,
      description: 'Airplanes.Live connector for aircraft data',
      capabilities: ['aircraft:tracking'],
      fallback: 'degraded_mode'
    });
    
    // Declare optional dependency on NOTAM connector
    this.declareDependency('notam-main', {
      required: false,
      critical: false,
      description: 'NOTAM connector for airspace information',
      capabilities: ['notam:query'],
      fallback: 'notam_disabled'
    });
  }
  
  /**
   * Execute fallback for dependency failure
   */
  async executeFallback(connectorId, fallback) {
    this.logger.info(`Executing fallback for ${connectorId}: ${fallback}`);
    
    switch (fallback) {
      case 'degraded_mode':
        this.logger.warn('Entering degraded mode - limited functionality available');
        this.notamConfig.enabled = false;
        break;
        
      case 'notam_disabled':
        this.logger.warn('NOTAM integration disabled due to connector unavailability');
        this.notamConfig.enabled = false;
        break;
        
      default:
        this.logger.warn(`Unknown fallback: ${fallback}`);
    }
  }
}

module.exports = PrestwickAirportConnector; 