const BaseConnector = require('../BaseConnector');
const PrestwickAirportService = require('../../services/prestwickAirportService');

/**
 * Prestwick Airport Connector
 * Integrates with ADSB system to track aircraft operations at EGPK
 */
class PrestwickAirportConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    this.prestwickService = new PrestwickAirportService(config.prestwick || {});
    this.adsbConnector = null;
    this.eventBus = null;
    this.connectorRegistry = null;
    this.telegramConnector = null;
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
      notamQueries: 0,
      notamAlerts: 0,
      lastActivity: new Date().toISOString()
    };
    
    // Telegram notification settings
    this.telegramConfig = {
      enabled: true,
      chatId: config.telegram?.chatId || -1001242323336,
      notifyApproaches: true,
      notifyLandings: true,
      notifyTakeoffs: true,
      notifyDepartures: true,
      notifyNotams: true
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
        id: 'telegram:notifications',
        name: 'Telegram Notifications',
        description: 'Send Telegram notifications for aircraft events',
        category: 'notifications',
        operations: ['configure_notifications', 'get_notification_config', 'test_notification'],
        dataTypes: ['notification:config', 'notification:status'],
        events: ['notification:sent', 'notification:failed'],
        parameters: {
          enabled: { type: 'boolean', required: false },
          chatId: { type: 'string', required: false },
          eventTypes: { type: 'array', required: false }
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
      
      // Set up event listeners for the Prestwick service
      this.setupPrestwickEventListeners();
      
      // Try to connect to ADSB connector (primary data source)
      await this.connectToADSBConnector();
      
      // Set up ADSB ground event listeners after connecting to ADSB
      this.setupADSBGroundEventListeners();
      
      // Try to connect to NOTAM connector
      await this.connectToNotamConnector();
      
      this.logger.info('Prestwick Airport Connector connected successfully');
      
      // Send startup notification
      await this.sendStartupNotification();
      
      return true;
    } catch (error) {
      this.logger.error('Failed to connect Prestwick Airport Connector', { error: error.message });
      return false;
    }
  }

  async performDisconnect() {
    try {
      this.logger.info('Disconnecting Prestwick Airport Connector');
      
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
   * Connect to ADSB connector to receive aircraft data
   */
  async connectToADSBConnector() {
    if (!this.connectorRegistry) {
      this.logger.warn('Connector registry not available');
      return;
    }

    try {
      const adsbConnector = this.connectorRegistry.getConnector('adsb-main');
      if (adsbConnector) {
        this.adsbConnector = adsbConnector;
        this.logger.info('Connected to ADSB connector');
      } else {
        this.logger.warn('ADSB connector not found');
      }
    } catch (error) {
      this.logger.error('Failed to connect to ADSB connector', { error: error.message });
    }
  }

  /**
   * Connect to NOTAM connector to query NOTAM data
   */
  async connectToNotamConnector() {
    if (!this.connectorRegistry) {
      this.logger.warn('Connector registry not available');
      return;
    }

    try {
      const notamConnector = this.connectorRegistry.getConnector('notam-main');
      if (notamConnector) {
        this.notamConnector = notamConnector;
        // Pass NOTAM connector to the Prestwick service
        this.prestwickService.setNotamConnector(notamConnector);
        this.logger.info('Connected to NOTAM connector');
      } else {
        this.logger.warn('NOTAM connector not found');
      }
    } catch (error) {
      this.logger.error('Failed to connect to NOTAM connector', { error: error.message });
    }
  }

  /**
   * Ensure Telegram connector is connected (lazy connection)
   */
  async ensureTelegramConnection() {
    if (this.telegramConnector) {
      return; // Already connected
    }

    if (!this.connectorRegistry) {
      this.logger.warn('Connector registry not available for Telegram connection');
      return;
    }

    // Try to find Telegram connector
    const telegramConnector = this.connectorRegistry.getConnector('telegram-bot-main');
    if (!telegramConnector) {
      this.logger.warn('Telegram connector not found, notifications will be disabled');
      return;
    }

    this.telegramConnector = telegramConnector;
    this.logger.info('Connected to Telegram connector (lazy connection)');
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

    // Listen for NOTAM alert events
    this.prestwickService.on('notam:alert', (event) => {
      this.handleNotamAlertEvent(event);
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
      'notam:alert': []
    };
  }

  /**
   * Handle ADSB events and process them through Prestwick service
   */
  handleADSBEvent(event) {
    try {
      const data = event.data || event;
      
      // Extract aircraft data
      const aircraftData = {
        icao24: data.icao24,
        callsign: data.callsign,
        registration: data.registration,
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude,
        speed: data.speed,
        heading: data.heading,
        squawk: data.squawk,
        timestamp: data.timestamp || event.timestamp
      };

      // Check if this is the first data received
      if (!this.firstDataReceived) {
        this.firstDataReceived = true;
        this.sendFirstDataNotification(aircraftData);
      }

      // Process through Prestwick service
      const result = this.prestwickService.processAircraftUpdate(aircraftData);
      
      if (result) {
        this.stats.totalAircraftProcessed++;
        this.stats.lastActivity = new Date().toISOString();
        
        // Update stats from Prestwick service
        const prestwickStats = this.prestwickService.getStats();
        this.stats.totalApproaches = prestwickStats.totalApproaches;
        this.stats.totalLandings = prestwickStats.totalLandings;
        this.stats.totalTakeoffs = prestwickStats.totalTakeoffs;
        this.stats.totalDepartures = prestwickStats.totalDepartures;
      }
    } catch (error) {
      this.logger.error('Error handling ADSB event', { error: error.message });
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
    
    // Send Telegram notification
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
          
          // Send NOTAM alerts via Telegram
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

    // Send Telegram notification
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

    // Send Telegram notification
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

    // Send Telegram notification
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

    // Send Telegram notification
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
   * Send Telegram notification for aircraft events
   */
  async sendTelegramNotification(eventType, aircraftData) {
    if (!this.telegramConfig.enabled) {
      return;
    }

    // Check if this event type should be notified
    const notifyKey = `notify${eventType.charAt(0).toUpperCase() + eventType.slice(1)}s`;
    if (!this.telegramConfig[notifyKey]) {
      return;
    }

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

      // Emit notification event instead of direct Telegram call
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
   * Send Telegram notification for ground movement events
   */
  async sendGroundMovementTelegramNotification(aircraft, metadata) {
    if (!this.telegramConfig.enabled) {
      return;
    }

    try {
      // Lazy connection to Telegram connector
      await this.ensureTelegramConnection();
      
      if (!this.telegramConnector) {
        this.logger.debug('Telegram connector not available, skipping ground movement notification');
        return;
      }

      const message = this.formatGroundMovementTelegramMessage(aircraft, metadata);
      
      // Use capability-based pattern to send message
      const result = await this.telegramConnector.execute('telegram:send', 'text', {
        chatId: this.telegramConfig.chatId,
        text: message,
        parseMode: 'HTML'
      });
      
      this.logger.info('Ground movement notification sent to Telegram', {
        icao24: aircraft.icao24,
        callsign: aircraft.callsign
      });
    } catch (error) {
      this.logger.error('Failed to send ground movement notification:', error.message);
    }
  }

  /**
   * Send Telegram notification for taxi events
   */
  async sendTaxiTelegramNotification(aircraft, metadata) {
    if (!this.telegramConfig.enabled) {
      return;
    }

    try {
      // Lazy connection to Telegram connector
      await this.ensureTelegramConnection();
      
      if (!this.telegramConnector) {
        this.logger.debug('Telegram connector not available, skipping taxi notification');
        return;
      }

      const message = this.formatTaxiTelegramMessage(aircraft, metadata);
      
      // Use capability-based pattern to send message
      const result = await this.telegramConnector.execute('telegram:send', 'text', {
        chatId: this.telegramConfig.chatId,
        text: message,
        parseMode: 'HTML'
      });
      
      this.logger.info('Taxi notification sent to Telegram', {
        icao24: aircraft.icao24,
        callsign: aircraft.callsign
      });
    } catch (error) {
      this.logger.error('Failed to send taxi notification:', error.message);
    }
  }

  /**
   * Send Telegram notification for parking events
   */
  async sendParkingTelegramNotification(aircraft, metadata) {
    if (!this.telegramConfig.enabled) {
      return;
    }

    try {
      // Lazy connection to Telegram connector
      await this.ensureTelegramConnection();
      
      if (!this.telegramConnector) {
        this.logger.debug('Telegram connector not available, skipping parking notification');
        return;
      }

      const message = this.formatParkingTelegramMessage(aircraft, metadata);
      
      // Use capability-based pattern to send message
      const result = await this.telegramConnector.execute('telegram:send', 'text', {
        chatId: this.telegramConfig.chatId,
        text: message,
        parseMode: 'HTML'
      });
      
      this.logger.info('Parking notification sent to Telegram', {
        icao24: aircraft.icao24,
        callsign: aircraft.callsign
      });
    } catch (error) {
      this.logger.error('Failed to send parking notification:', error.message);
    }
  }

  /**
   * Send Telegram notification for helicopter events
   */
  async sendHelicopterTelegramNotification(aircraft, metadata) {
    if (!this.telegramConfig.enabled) {
      return;
    }

    try {
      // Lazy connection to Telegram connector
      await this.ensureTelegramConnection();
      
      if (!this.telegramConnector) {
        this.logger.debug('Telegram connector not available, skipping helicopter notification');
        return;
      }

      const message = this.formatHelicopterTelegramMessage(aircraft, metadata);
      
      // Use capability-based pattern to send message
      const result = await this.telegramConnector.execute('telegram:send', 'text', {
        chatId: this.telegramConfig.chatId,
        text: message,
        parseMode: 'HTML'
      });
      
      this.logger.info('Helicopter notification sent to Telegram', {
        icao24: aircraft.icao24,
        callsign: aircraft.callsign
      });
    } catch (error) {
      this.logger.error('Failed to send helicopter notification:', error.message);
    }
  }

  /**
   * Format message for Telegram notification
   */
  formatTelegramMessage(eventType, aircraftData) {
    const { icao24, callsign, registration, altitude, speed, heading, runway } = aircraftData;
    
    const eventEmoji = {
      approach: '🛬',
      landing: '✈️',
      takeoff: '🛫',
      departure: '🛩️'
    };
    
    const eventText = {
      approach: 'Approaching',
      landing: 'Landing',
      takeoff: 'Taking off',
      departure: 'Departing'
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
   * Send Telegram notification for NOTAM alert
   */
  async sendNotamTelegramNotification(notamAlert) {
    if (!this.telegramConfig.enabled || !this.telegramConfig.notifyNotams) {
      this.logger.debug('Telegram NOTAM notifications disabled');
      return;
    }

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

      // Emit notification event instead of direct Telegram call
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
        case 'telegram:notifications':
          return this.executeTelegramNotificationsOperation(operation, parameters);
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
   * Execute Telegram notifications operations
   */
  executeTelegramNotificationsOperation(operation, parameters) {
    switch (operation) {
      case 'configure_notifications':
        const { enabled, chatId, eventTypes } = parameters;
        this.telegramConfig.enabled = enabled !== undefined ? enabled : this.telegramConfig.enabled;
        this.telegramConfig.chatId = chatId || this.telegramConfig.chatId;
        
        if (eventTypes) {
          this.telegramConfig.notifyApproaches = eventTypes.includes('approach');
          this.telegramConfig.notifyLandings = eventTypes.includes('landing');
          this.telegramConfig.notifyTakeoffs = eventTypes.includes('takeoff');
          this.telegramConfig.notifyDepartures = eventTypes.includes('departure');
        }
        
        return { 
          success: true, 
          config: this.telegramConfig 
        };
        
      case 'get_notification_config':
        return this.telegramConfig;
        
      case 'test_notification':
        const testData = {
          icao24: 'TEST123',
          callsign: 'TESTFLIGHT',
          registration: 'G-TEST',
          altitude: 3000,
          speed: 150,
          heading: 120,
          runway: '12'
        };
        this.sendTelegramNotification('approach', testData);
        return { success: true, message: 'Test notification sent' };
        
      default:
        throw new Error(`Unknown Telegram notifications operation: ${operation}`);
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
          this.connectToNotamConnector();
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
      notamConfig: this.notamConfig,
      telegramConfig: this.telegramConfig
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
   * Send startup notification to Telegram
   */
  async sendStartupNotification() {
    if (!this.telegramConfig.enabled || this.startupNotificationSent) {
      return;
    }

    try {
      // Try to get Telegram connector from registry
      if (this.connectorRegistry) {
        this.telegramConnector = this.connectorRegistry.getConnector('telegram-bot-main');
      }

      if (this.telegramConnector && this.telegramConnector.isConnected) {
        const message = this.formatStartupNotificationMessage();
        
        await this.telegramConnector.execute('telegram:send', 'text', {
          chatId: this.telegramConfig.chatId,
          text: message,
          parseMode: 'HTML'
        });
        
        this.startupNotificationSent = true;
        this.logger.info('Startup notification sent to Telegram');
      } else {
        // Fallback to event bus
        const notificationData = {
          type: 'startup',
          source: 'prestwick-airport',
          priority: 'low',
          message: this.formatStartupNotificationMessage(),
          data: {
            airportCode: 'EGPK',
            airportName: 'Prestwick Airport',
            notifications: {
              approaches: this.telegramConfig.notifyApproaches,
              landings: this.telegramConfig.notifyLandings,
              takeoffs: this.telegramConfig.notifyTakeoffs,
              departures: this.telegramConfig.notifyDepartures,
              notams: this.telegramConfig.notifyNotams
            }
          },
          timestamp: new Date().toISOString()
        };

        if (this.eventBus) {
          this.eventBus.emit('alarm:notification', notificationData);
        }
        
        this.startupNotificationSent = true;
        this.logger.info('Startup notification event emitted');
      }
    } catch (error) {
      this.logger.error('Failed to send startup notification:', error.message);
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
    if (this.telegramConfig.notifyApproaches) message += `• Aircraft Approaches\n`;
    if (this.telegramConfig.notifyLandings) message += `• Aircraft Landings\n`;
    if (this.telegramConfig.notifyTakeoffs) message += `• Aircraft Takeoffs\n`;
    if (this.telegramConfig.notifyDepartures) message += `• Aircraft Departures\n`;
    if (this.telegramConfig.notifyNotams) message += `• NOTAM Alerts\n`;
    
    message += `\n🔗 <b>Connections:</b>\n`;
    message += `• ADSB: ${this.adsbConnector ? '✅ Connected' : '❌ Disconnected'}\n`;
    message += `• NOTAM: ${this.notamConnector ? '✅ Connected' : '❌ Disconnected'}\n`;
    message += `• Telegram: ${this.telegramConnector ? '✅ Connected' : '❌ Disconnected'}\n`;
    
    message += `\n⏰ Started: <i>${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</i>`;
    
    return message;
  }

  /**
   * Send first data notification to Telegram
   */
  async sendFirstDataNotification(aircraftData) {
    if (!this.telegramConfig.enabled) {
      return;
    }

    try {
      // Try to get Telegram connector from registry if not already set
      if (!this.telegramConnector && this.connectorRegistry) {
        this.telegramConnector = this.connectorRegistry.getConnector('telegram-bot-main');
      }

      if (this.telegramConnector && this.telegramConnector.isConnected) {
        const message = this.formatFirstDataNotificationMessage(aircraftData);
        
        await this.telegramConnector.execute('telegram:send', 'text', {
          chatId: this.telegramConfig.chatId,
          text: message,
          parseMode: 'HTML'
        });
        
        this.logger.info('First data notification sent to Telegram');
      } else {
        // Fallback to event bus
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

        if (this.eventBus) {
          this.eventBus.emit('alarm:notification', notificationData);
        }
        
        this.logger.info('First data notification event emitted');
      }
    } catch (error) {
      this.logger.error('Failed to send first data notification:', error.message);
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
}

module.exports = PrestwickAirportConnector; 