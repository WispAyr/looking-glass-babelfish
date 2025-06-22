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
    
    // Track processed events
    this.processedEvents = new Set();
    this.maxProcessedEvents = 10000;
    
    // Statistics
    this.stats = {
      totalAircraftProcessed: 0,
      totalApproaches: 0,
      totalLandings: 0,
      totalTakeoffs: 0,
      totalDepartures: 0,
      lastActivity: new Date().toISOString()
    };
    
    // Telegram notification settings
    this.telegramConfig = {
      enabled: true,
      chatId: config.telegram?.chatId || -1001242323336,
      notifyApproaches: true,
      notifyLandings: true,
      notifyTakeoffs: true,
      notifyDepartures: true
    };
  }

  static getMetadata() {
    return {
      name: 'Prestwick Airport Connector',
      description: 'Tracks aircraft approaching, landing, and taking off at Prestwick Airport (EGPK)',
      version: '1.0.0',
      author: 'Looking Glass Team',
      capabilities: [
        'aircraft:tracking',
        'airport:operations',
        'runway:detection',
        'events:aircraft'
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
      
      // Try to connect to ADSB connector
      await this.connectToADSBConnector();
      
      // Try to connect to Telegram connector
      await this.connectToTelegramConnector();
      
      this.logger.info('Prestwick Airport Connector connected successfully');
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

    // Try to find ADSB connector
    const adsbConnector = this.connectorRegistry.getConnector('adsb-main');
    if (!adsbConnector) {
      this.logger.warn('ADSB connector not found, will retry later');
      return;
    }

    this.adsbConnector = adsbConnector;
    
    // Subscribe to ADSB events
    if (this.eventBus) {
      this.eventBus.on('aircraft:update', (event) => {
        this.handleADSBEvent(event);
      });
      
      this.eventBus.on('aircraft:detected', (event) => {
        this.handleADSBEvent(event);
      });
    }

    this.logger.info('Connected to ADSB connector');
  }

  /**
   * Connect to Telegram connector for notifications
   */
  async connectToTelegramConnector() {
    if (!this.connectorRegistry) {
      this.logger.warn('Connector registry not available');
      return;
    }

    if (!this.telegramConfig.enabled) {
      this.logger.info('Telegram notifications disabled');
      return;
    }

    // Try to find Telegram connector
    const telegramConnector = this.connectorRegistry.getConnector('telegram-bot-main');
    if (!telegramConnector) {
      this.logger.warn('Telegram connector not found, notifications will be disabled');
      return;
    }

    this.telegramConnector = telegramConnector;
    this.logger.info('Connected to Telegram connector for notifications');
    
    // Send startup notification
    await this.sendStartupNotification();
  }

  /**
   * Send startup notification to Telegram
   */
  async sendStartupNotification() {
    if (!this.telegramConnector || !this.telegramConfig.enabled) {
      return;
    }

    try {
      const message = `🟢 **Prestwick Airport Connector Active**

✈️ **Monitoring Status**: Online
📍 **Airport**: EGPK (Prestwick)
🕐 **Started**: ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}

**Notifications Enabled:**
${this.telegramConfig.notifyApproaches ? '✅' : '❌'} Aircraft Approaches
${this.telegramConfig.notifyLandings ? '✅' : '❌'} Aircraft Landings  
${this.telegramConfig.notifyTakeoffs ? '✅' : '❌'} Aircraft Takeoffs
${this.telegramConfig.notifyDepartures ? '✅' : '❌'} Aircraft Departures

*Ready to monitor aircraft activity at Prestwick Airport*`;

      // Emit event before sending startup notification
      if (this.eventBus) {
        this.eventBus.emit('telegram:startup:sending', {
          connectorId: this.id,
          message,
          timestamp: new Date().toISOString()
        });
      }

      const result = await this.telegramConnector.sendTextMessage(
        this.telegramConfig.chatId,
        message
      );

      // Emit success event
      if (this.eventBus) {
        this.eventBus.emit('telegram:startup:sent', {
          connectorId: this.id,
          message,
          result,
          timestamp: new Date().toISOString()
        });
      }
      
      this.logger.info('Startup notification sent to Telegram');
    } catch (error) {
      this.logger.error('Failed to send startup notification:', error.message);
      
      // Emit failure event
      if (this.eventBus) {
        this.eventBus.emit('telegram:startup:failed', {
          connectorId: this.id,
          error: error.message,
          timestamp: new Date().toISOString()
        });
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
      departure: []
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
   * Handle Prestwick service events
   */
  handlePrestwickEvent(event) {
    const { type, data } = event;
    
    // Update statistics
    this.stats.lastActivity = new Date().toISOString();
    
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
   * Send Telegram notification for aircraft events
   */
  async sendTelegramNotification(eventType, aircraftData) {
    if (!this.telegramConnector || !this.telegramConfig.enabled) {
      this.logger.warn('Telegram notifications disabled or connector not available');
      return;
    }

    try {
      const message = this.formatTelegramMessage(eventType, aircraftData);
      
      // Emit event before sending
      if (this.eventBus) {
        this.eventBus.emit('telegram:message:sending', {
          connectorId: this.id,
          eventType,
          aircraftData,
          message,
          timestamp: new Date().toISOString()
        });
      }

      const result = await this.telegramConnector.sendTextMessage(
        this.telegramConfig.chatId,
        message
      );

      // Emit success event
      if (this.eventBus) {
        this.eventBus.emit('telegram:message:sent', {
          connectorId: this.id,
          eventType,
          aircraftData,
          message,
          result,
          timestamp: new Date().toISOString()
        });
      }

      this.logger.info(`Telegram notification sent for ${eventType} event`);
      
    } catch (error) {
      this.logger.error(`Failed to send Telegram notification for ${eventType}:`, error.message);
      
      // Emit failure event
      if (this.eventBus) {
        this.eventBus.emit('telegram:message:failed', {
          connectorId: this.id,
          eventType,
          aircraftData,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
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
        
        // Try to reconnect to Telegram if enabled
        if (this.telegramConfig.enabled && !this.telegramConnector) {
          this.connectToTelegramConnector();
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
   * Get connector status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      adsbConnected: !!this.adsbConnector,
      eventBusConnected: !!this.eventBus,
      stats: this.stats,
      prestwickStats: this.prestwickService.getStats()
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
}

module.exports = PrestwickAirportConnector; 