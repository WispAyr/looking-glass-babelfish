const BaseConnector = require('../BaseConnector');
const SpeedCalculationService = require('../../services/speedCalculationService');

/**
 * Speed Calculation Connector
 * 
 * Coordinates between UniFi Protect cameras and the speed calculation service.
 * Acts as the logic layer for ANPR-based speed calculations between detection points.
 */
class SpeedCalculationConnector extends BaseConnector {
  constructor(config) {
    const connectorConfig = {
      ...config,
      type: 'speed-calculation'
    };
    
    super(connectorConfig);
    
    // Speed calculation service
    this.speedService = new SpeedCalculationService(config.speedService || {});
    
    // Camera mapping
    this.cameraMapping = new Map(); // cameraId -> detection point config
    this.unifiConnector = null;
    
    // Event processing
    this.eventQueue = [];
    this.processingInterval = null;
    
    this.logger.info('Speed Calculation Connector initialized');
  }

  /**
   * Get capability definitions for this connector
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'speed:calculation',
        name: 'Speed Calculation',
        description: 'Calculate vehicle speeds between ANPR detection points',
        category: 'analytics',
        operations: ['register', 'process', 'calculate', 'alert'],
        dataTypes: ['anpr', 'speed', 'alert'],
        events: ['speed:calculated', 'speed:alert', 'detection:processed'],
        parameters: {
          cameraId: { type: 'string', required: true },
          plateNumber: { type: 'string', required: true },
          timestamp: { type: 'string', required: true }
        }
      },
      {
        id: 'detection:points',
        name: 'Detection Points',
        description: 'Manage ANPR detection points and their spatial relationships',
        category: 'spatial',
        operations: ['register', 'update', 'remove', 'list'],
        dataTypes: ['detection-point', 'camera', 'position'],
        events: ['point:registered', 'point:updated', 'point:removed'],
        parameters: {
          cameraId: { type: 'string', required: true },
          position: { type: 'object', required: true },
          speedLimit: { type: 'number', required: false }
        }
      },
      {
        id: 'integration:unifi',
        name: 'UniFi Integration',
        description: 'Integrate with UniFi Protect cameras for ANPR events',
        category: 'integration',
        operations: ['connect', 'subscribe', 'process'],
        dataTypes: ['camera', 'event', 'anpr'],
        events: ['camera:connected', 'event:received', 'anpr:detected'],
        parameters: {
          connectorId: { type: 'string', required: true },
          cameras: { type: 'array', required: false }
        }
      }
    ];
  }

  /**
   * Connect to the connector
   */
  async performConnect() {
    try {
      // Start the speed calculation service
      this.speedService.on('speed:calculated', (speedData) => {
        this.emit('speed:calculated', speedData);
        this.broadcastSpeedCalculation(speedData);
      });
      
      this.speedService.on('speed:alert', (alertData) => {
        this.emit('speed:alert', alertData);
        this.broadcastSpeedAlert(alertData);
      });
      
      this.speedService.on('detectionPoint:registered', (pointData) => {
        this.emit('detectionPoint:registered', pointData);
      });
      
      // Start event processing
      this.startEventProcessing();
      
      this.logger.info('Speed Calculation Connector connected');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect Speed Calculation Connector:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the connector
   */
  async performDisconnect() {
    try {
      // Stop event processing
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }
      
      // Clean up speed service
      this.speedService.cleanup();
      
      this.logger.info('Speed Calculation Connector disconnected');
      return true;
    } catch (error) {
      this.logger.error('Failed to disconnect Speed Calculation Connector:', error);
      throw error;
    }
  }

  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    try {
      let result;
      switch (capabilityId) {
        case 'speed:calculation':
          result = await this.executeSpeedCalculation(operation, parameters);
          break;
        case 'detection:points':
          result = await this.executeDetectionPoints(operation, parameters);
          break;
        case 'integration:unifi':
          result = await this.executeUniFiIntegration(operation, parameters);
          break;
        default:
          throw new Error(`Unknown capability: ${capabilityId}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Capability execution failed: ${capabilityId}.${operation}`, error);
      throw error;
    }
  }

  /**
   * Execute speed calculation operations
   */
  async executeSpeedCalculation(operation, parameters) {
    switch (operation) {
      case 'register':
        return await this.registerDetectionPoint(parameters);
      case 'process':
        return await this.processANPREvent(parameters);
      case 'calculate':
        return await this.calculateSpeed(parameters);
      case 'alert':
        return await this.getSpeedAlerts(parameters);
      default:
        throw new Error(`Unknown speed calculation operation: ${operation}`);
    }
  }

  /**
   * Execute detection points operations
   */
  async executeDetectionPoints(operation, parameters) {
    switch (operation) {
      case 'register':
        return await this.registerDetectionPoint(parameters);
      case 'update':
        return await this.updateDetectionPoint(parameters);
      case 'remove':
        return await this.removeDetectionPoint(parameters);
      case 'list':
        return await this.listDetectionPoints(parameters);
      default:
        throw new Error(`Unknown detection points operation: ${operation}`);
    }
  }

  /**
   * Execute UniFi integration operations
   */
  async executeUniFiIntegration(operation, parameters) {
    switch (operation) {
      case 'connect':
        return await this.connectToUniFi(parameters);
      case 'subscribe':
        return await this.subscribeToUniFiEvents(parameters);
      case 'process':
        return await this.processUniFiEvent(parameters);
      default:
        throw new Error(`Unknown UniFi integration operation: ${operation}`);
    }
  }

  /**
   * Register a detection point
   */
  async registerDetectionPoint(parameters) {
    const { cameraId, name, position, direction, speedLimit, metadata } = parameters;
    
    const detectionPoint = await this.speedService.registerDetectionPoint(cameraId, {
      name,
      position,
      direction,
      speedLimit,
      metadata
    });
    
    // Store camera mapping
    this.cameraMapping.set(cameraId, detectionPoint);
    
    this.logger.info(`Registered detection point: ${cameraId} at ${JSON.stringify(position)}`);
    
    return detectionPoint;
  }

  /**
   * Update a detection point
   */
  async updateDetectionPoint(parameters) {
    const { cameraId, updates } = parameters;
    
    const detectionPoint = this.cameraMapping.get(cameraId);
    if (!detectionPoint) {
      throw new Error(`Detection point not found: ${cameraId}`);
    }
    
    // Update the detection point
    const updatedPoint = await this.speedService.registerDetectionPoint(cameraId, {
      ...detectionPoint,
      ...updates
    });
    
    this.cameraMapping.set(cameraId, updatedPoint);
    
    return updatedPoint;
  }

  /**
   * Remove a detection point
   */
  async removeDetectionPoint(parameters) {
    const { cameraId } = parameters;
    
    this.cameraMapping.delete(cameraId);
    
    return { success: true, cameraId };
  }

  /**
   * List detection points
   */
  async listDetectionPoints(parameters = {}) {
    const points = this.speedService.getDetectionPoints();
    
    if (parameters.cameraId) {
      return points.filter(p => p.id === parameters.cameraId);
    }
    
    return points;
  }

  /**
   * Process ANPR event
   */
  async processANPREvent(parameters) {
    const { cameraId, plateNumber, timestamp, confidence, data } = parameters;
    
    await this.speedService.processANPRDetection({
      cameraId,
      plateNumber,
      timestamp,
      confidence,
      data
    });
    
    return { success: true, processed: true };
  }

  /**
   * Calculate speed manually
   */
  async calculateSpeed(parameters) {
    const { detection1, detection2 } = parameters;
    
    const speedData = await this.speedService.calculateSpeed(detection1, detection2);
    
    return speedData;
  }

  /**
   * Get speed alerts
   */
  async getSpeedAlerts(parameters = {}) {
    const alerts = this.speedService.getSpeedAlerts(parameters);
    
    return {
      alerts,
      count: alerts.length
    };
  }

  /**
   * Connect to UniFi Protect connector
   */
  async connectToUniFi(parameters) {
    const { connectorId } = parameters;
    
    // Get the UniFi Protect connector from the registry
    const connectorRegistry = this.getConnectorRegistry();
    if (!connectorRegistry) {
      throw new Error('Connector registry not available');
    }
    
    this.unifiConnector = connectorRegistry.getConnector(connectorId);
    if (!this.unifiConnector) {
      throw new Error(`UniFi Protect connector not found: ${connectorId}`);
    }
    
    // Subscribe to ANPR events
    this.unifiConnector.on('anpr:detected', (event) => {
      this.processUniFiANPREvent(event);
    });
    
    this.logger.info(`Connected to UniFi Protect connector: ${connectorId}`);
    
    return { success: true, connectorId };
  }

  /**
   * Subscribe to UniFi events
   */
  async subscribeToUniFiEvents(parameters) {
    const { eventTypes = ['anpr:detected', 'smartDetectLine'] } = parameters;
    
    if (!this.unifiConnector) {
      throw new Error('Not connected to UniFi Protect connector');
    }
    
    // Subscribe to specified event types
    eventTypes.forEach(eventType => {
      this.unifiConnector.on(eventType, (event) => {
        this.processUniFiEvent({ eventType, event });
      });
    });
    
    this.logger.info(`Subscribed to UniFi events: ${eventTypes.join(', ')}`);
    
    return { success: true, eventTypes };
  }

  /**
   * Process UniFi Protect events
   */
  async processUniFiEvent(parameters) {
    const { eventType, event } = parameters;
    
    try {
      switch (eventType) {
        case 'anpr:detected':
          await this.processANPREvent(event);
          break;
        case 'smartDetectLine':
          await this.processLineCrossingEvent(event);
          break;
        default:
          this.logger.debug(`Unhandled UniFi event type: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(`Error processing UniFi event ${eventType}:`, error);
    }
  }

  /**
   * Process UniFi ANPR event
   */
  async processUniFiANPREvent(event) {
    try {
      const { cameraId, plateNumber, timestamp, confidence, data } = event;
      
      // Check if this camera is registered as a detection point
      if (!this.cameraMapping.has(cameraId)) {
        this.logger.debug(`Camera ${cameraId} not registered as detection point`);
        return;
      }
      
      // Process the ANPR detection
      await this.speedService.processANPRDetection({
        cameraId,
        plateNumber,
        timestamp,
        confidence,
        data
      });
      
      this.logger.debug(`Processed UniFi ANPR event: ${plateNumber} at ${cameraId}`);
      
    } catch (error) {
      this.logger.error('Error processing UniFi ANPR event:', error);
    }
  }

  /**
   * Process line crossing event
   */
  async processLineCrossingEvent(event) {
    if (!this.speedService) {
      this.logger.warn('Speed calculation service not available');
      return;
    }

    // Extract line crossing data from event
    const lineCrossingData = {
      cameraId: event.cameraId || event.deviceId,
      smartContext: event.smartContext,
      timestamp: event.timestamp,
      data: event.data
    };

    await this.speedService.processLineCrossingEvent(lineCrossingData);
    this.logger.info(`Line crossing event processed: ${lineCrossingData.smartContext?.trackingId || 'unknown'} at ${lineCrossingData.cameraId}`);
  }

  /**
   * Start event processing
   */
  startEventProcessing() {
    this.processingInterval = setInterval(() => {
      this.processEventQueue();
    }, 1000); // Process every second
  }

  /**
   * Process event queue
   */
  async processEventQueue() {
    if (this.eventQueue.length === 0) {
      return;
    }
    
    const events = [...this.eventQueue];
    this.eventQueue = [];
    
    for (const event of events) {
      try {
        await this.processANPREvent(event);
      } catch (error) {
        this.logger.error('Error processing queued event:', error);
      }
    }
  }

  /**
   * Broadcast speed calculation to other connectors
   */
  broadcastSpeedCalculation(speedData) {
    // Emit to event bus if available
    if (this.eventBus) {
      this.eventBus.publishEvent({
        type: 'speed:calculated',
        source: this.id,
        timestamp: new Date().toISOString(),
        data: speedData
      });
    }
    
    // Broadcast to WebSocket clients
    this.broadcastToClients('speedCalculation', speedData);
  }

  /**
   * Broadcast speed alert to other connectors
   */
  broadcastSpeedAlert(alertData) {
    // Emit to event bus if available
    if (this.eventBus) {
      this.eventBus.publishEvent({
        type: 'speed:alert',
        source: this.id,
        timestamp: new Date().toISOString(),
        data: alertData
      });
    }
    
    // Broadcast to WebSocket clients
    this.broadcastToClients('speedAlert', alertData);
  }

  /**
   * Get speed calculations
   */
  getSpeedCalculations(filter = {}) {
    return this.speedService.getSpeedCalculations(filter);
  }

  /**
   * Get tracking data
   */
  getTrackingData(plateNumber) {
    return this.speedService.getTrackingData(plateNumber);
  }

  /**
   * Get statistics
   */
  getStats() {
    const baseStats = super.getStatus();
    const speedStats = this.speedService.getStats();
    
    return {
      ...baseStats,
      speedCalculation: speedStats,
      cameraMapping: this.cameraMapping.size,
      unifiConnected: !!this.unifiConnector
    };
  }

  /**
   * Export configuration
   */
  exportConfiguration() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      cameraMapping: Array.from(this.cameraMapping.entries()),
      speedService: this.speedService.getStats(),
      detectionPoints: this.speedService.getDetectionPoints()
    };
  }
}

module.exports = SpeedCalculationConnector; 