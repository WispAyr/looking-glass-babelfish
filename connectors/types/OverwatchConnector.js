const BaseConnector = require('../BaseConnector');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * Overwatch Connector
 * 
 * Provides a comprehensive GUI for monitoring and managing the system.
 * Features:
 * - View and manage flows/rules
 * - Real-time event monitoring with dynamic filtering
 * - Connector status overview
 * - System health monitoring
 */
class OverwatchConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // Overwatch-specific properties
    this.eventStream = new EventEmitter();
    this.connectedConnectors = new Map();
    this.flows = new Map();
    this.rules = new Map();
    this.eventHistory = [];
    this.maxEventHistory = config.maxEventHistory || 1000;
    
    // WebSocket connections for real-time updates
    this.webSocketConnections = new Set();
    
    // Event filtering
    this.activeFilters = new Map();
    this.filterPresets = new Map();
    
    // Performance tracking
    this.performanceMetrics = {
      eventsProcessed: 0,
      eventsFiltered: 0,
      averageProcessingTime: 0,
      lastUpdate: null
    };
    
    // Initialize default filters
    this.initializeDefaultFilters();

    this.webInterface = {
      enabled: true,
      route: '/overwatch',
      port: 3000,
      host: 'localhost'
    };
  }
  
  /**
   * Initialize default event filters
   */
  initializeDefaultFilters() {
    this.filterPresets.set('all', {
      name: 'All Events',
      description: 'Show all events from all connectors',
      filters: {}
    });
    
    this.filterPresets.set('security', {
      name: 'Security Events',
      description: 'Show security-related events only',
      filters: {
        eventType: ['motion', 'smartDetectZone', 'smartDetectLine', 'loitering', 'intrusion'],
        source: ['unifi-protect-websocket']
      }
    });
    
    this.filterPresets.set('aircraft', {
      name: 'Aircraft Events',
      description: 'Show aircraft-related events only',
      filters: {
        source: ['adsb-main', 'aprs-main'],
        eventType: ['aircraft:detected', 'aircraft:emergency', 'aircraft:zone', 'squawk:analysis', 'flight:started', 'flight:ended']
      }
    });
    
    this.filterPresets.set('system', {
      name: 'System Events',
      description: 'Show system health and status events',
      filters: {
        eventType: ['system:status', 'connector:status', 'health:check', 'connector:connected', 'connector:disconnected'],
        source: ['system']
      }
    });
  }
  
  /**
   * Set connector registry reference
   */
  setConnectorRegistry(connectorRegistry) {
    this.connectorRegistry = connectorRegistry;
    this.logger.info('Connector registry reference set');
  }
  
  /**
   * Set event bus reference
   */
  setEventBus(eventBus) {
    this.eventBus = eventBus;
    this.logger.info('Event bus reference set');
  }
  
  /**
   * Get capability definitions
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'overwatch:flows',
        name: 'Flow Management',
        description: 'View, create, edit, and delete flows',
        operations: ['list', 'get', 'create', 'update', 'delete', 'enable', 'disable'],
        requiresConnection: false
      },
      {
        id: 'overwatch:rules',
        name: 'Rule Management',
        description: 'View, create, edit, and delete rules',
        operations: ['list', 'get', 'create', 'update', 'delete', 'enable', 'disable'],
        requiresConnection: false
      },
      {
        id: 'overwatch:events',
        name: 'Event Monitoring',
        description: 'Monitor real-time events with filtering',
        operations: ['stream', 'filter', 'history', 'stats'],
        requiresConnection: false
      },
      {
        id: 'overwatch:connectors',
        name: 'Connector Management',
        description: 'Monitor and manage connector status',
        operations: ['list', 'status', 'connect', 'disconnect', 'config'],
        requiresConnection: false
      },
      {
        id: 'overwatch:system',
        name: 'System Health',
        description: 'Monitor system health and performance',
        operations: ['health', 'metrics', 'alerts'],
        requiresConnection: false
      }
    ];
  }
  
  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      name: 'Overwatch Connector',
      version: '1.0.0',
      description: 'Comprehensive system monitoring and management GUI',
      author: 'Babelfish Looking Glass',
      capabilities: ['flows', 'rules', 'events', 'connectors', 'system'],
      category: 'monitoring'
    };
  }
  
  /**
   * Validate configuration
   */
  static validateConfig(config) {
    if (!config.id) {
      throw new Error('Connector ID is required');
    }
    
    // Validate default connectors
    if (config.defaultConnectors && !Array.isArray(config.defaultConnectors)) {
      throw new Error('defaultConnectors must be an array');
    }
    
    // Validate event history limit
    if (config.maxEventHistory && (typeof config.maxEventHistory !== 'number' || config.maxEventHistory < 100)) {
      throw new Error('maxEventHistory must be a number >= 100');
    }
    
    return true;
  }
  
  /**
   * Connect to the system
   */
  async performConnect() {
    try {
      // Load flows and rules
      await this.loadFlowsAndRules();
      
      // Connect to default connectors
      await this.connectToDefaultConnectors();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start event processing
      this.startEventProcessing();
      
      this.logger.info('Overwatch connector connected successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect Overwatch connector', error);
      throw error;
    }
  }
  
  /**
   * Disconnect from the system
   */
  async performDisconnect() {
    try {
      // Stop event processing
      this.stopEventProcessing();
      
      // Remove event listeners
      this.removeEventListeners();
      
      // Close WebSocket connections
      this.closeWebSocketConnections();
      
      this.logger.info('Overwatch connector disconnected');
      return true;
    } catch (error) {
      this.logger.error('Failed to disconnect Overwatch connector', error);
      throw error;
    }
  }
  
  /**
   * Load flows and rules from configuration
   */
  async loadFlowsAndRules() {
    try {
      const flowsDir = path.join(process.cwd(), 'config', 'flows');
      const flowsFiles = await fs.readdir(flowsDir);
      
      for (const file of flowsFiles) {
        if (file.endsWith('.json')) {
          const flowPath = path.join(flowsDir, file);
          const flowData = await fs.readFile(flowPath, 'utf8');
          const flow = JSON.parse(flowData);
          
          this.flows.set(flow.id, {
            ...flow,
            filePath: flowPath,
            lastModified: new Date().toISOString()
          });
        }
      }
      
      this.logger.info(`Loaded ${this.flows.size} flows`);
    } catch (error) {
      this.logger.warn('Failed to load flows', error.message);
    }
  }
  
  /**
   * Connect to default connectors
   */
  async connectToDefaultConnectors() {
    const defaultConnectors = this.config.defaultConnectors || ['unifi-protect-main', 'adsb-main'];
    
    for (const connectorId of defaultConnectors) {
      try {
        const connector = this.connectorRegistry?.getConnector(connectorId);
        if (connector) {
          this.connectedConnectors.set(connectorId, connector);
          this.logger.info(`Connected to default connector: ${connectorId}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to connect to default connector: ${connectorId}`, error.message);
      }
    }
  }
  
  /**
   * Set up event listeners for connected connectors
   */
  setupEventListeners() {
    // Listen to the global event bus if available
    if (this.eventBus) {
      this.eventBus.on('*', (event) => {
        this.processEvent(event.source || 'unknown', event);
      });
      
      this.eventBus.on('event', (event) => {
        this.processEvent(event.source || 'unknown', event);
      });
      
      this.logger.info('Connected to global event bus');
    }
    
    // Also listen to individual connectors for status changes
    this.connectedConnectors.forEach((connector, connectorId) => {
      connector.on('status-changed', (status) => {
        this.processSystemEvent('connector:status', {
          connectorId,
          status,
          timestamp: new Date().toISOString()
        });
      });
    });
  }
  
  /**
   * Remove event listeners
   */
  removeEventListeners() {
    // Remove event bus listeners
    if (this.eventBus) {
      this.eventBus.removeAllListeners('*');
      this.eventBus.removeAllListeners('event');
    }
    
    // Remove connector listeners
    this.connectedConnectors.forEach((connector) => {
      connector.removeAllListeners('status-changed');
    });
  }
  
  /**
   * Process incoming events
   */
  processEvent(connectorId, event) {
    // Enhance event data with additional metadata
    let enhanced = this.enhanceEventData(connectorId, event);
    
    // Update connector last activity
    const connector = this.connectorRegistry?.getConnector(connectorId);
    if (connector && connector.stats) {
      connector.stats.lastActivity = new Date().toISOString();
    }
    
    const processedEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: connectorId,
      timestamp: new Date().toISOString(),
      data: enhanced,
      type: enhanced.type || event.type || 'unknown',
      priority: enhanced.priority || event.priority || 'normal',
      category: enhanced.category || this.getEventCategory(enhanced.type || event.type),
      metadata: enhanced.metadata || {}
    };
    
    // Add to history
    this.eventHistory.unshift(processedEvent);
    
    // Keep only last 1000 events
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(0, 1000);
    }
    
    // Update metrics
    this.updateMetrics(processedEvent);
    
    // Apply filters
    if (this.applyFilters(processedEvent)) {
      // Broadcast to WebSocket clients
      this.broadcastEvent(processedEvent);
    }
    
    return processedEvent;
  }
  
  /**
   * Enhance event data with additional metadata and formatting
   */
  enhanceEventData(connectorId, event) {
    let enhanced = { ...event };
    const type = event.type || 'unknown';
    
    // Add category
    enhanced.category = this.getEventCategory(type);
    
    // Add priority if not present
    if (!enhanced.priority) {
      enhanced.priority = this.getEventPriority(type, event);
    }
    
    // Add metadata
    enhanced.metadata = {
      connectorType: this.getConnectorType(connectorId),
      eventType: type,
      timestamp: new Date().toISOString(),
      processed: true
    };
    
    // Type-specific enhancements
    switch (type.toLowerCase()) {
      case 'motion':
        enhanced = this.enhanceMotionEvent(enhanced);
        break;
      case 'smartdetectzone':
      case 'smartdetectline':
        enhanced = this.enhanceSmartDetectEvent(enhanced);
        break;
      case 'aircraft:detected':
      case 'aircraft:emergency':
      case 'aircraft:zone':
        enhanced = this.enhanceAircraftEvent(enhanced);
        break;
      case 'squawk:analysis':
        enhanced = this.enhanceSquawkEvent(enhanced);
        break;
      case 'speed:violation':
        enhanced = this.enhanceSpeedViolationEvent(enhanced);
        break;
      case 'vehicle':
        enhanced = this.enhanceVehicleEvent(enhanced);
        break;
      case 'person':
        enhanced = this.enhancePersonEvent(enhanced);
        break;
    }
    
    return enhanced;
  }
  
  /**
   * Get event category based on type
   */
  getEventCategory(type) {
    const typeLower = type.toLowerCase();
    
    if (typeLower.includes('motion') || typeLower.includes('smartdetect')) {
      return 'security';
    } else if (typeLower.includes('aircraft') || typeLower.includes('squawk')) {
      return 'aircraft';
    } else if (typeLower.includes('vehicle') || typeLower.includes('speed')) {
      return 'vehicle';
    } else if (typeLower.includes('person') || typeLower.includes('loitering') || typeLower.includes('intrusion')) {
      return 'security';
    } else if (typeLower.includes('connector') || typeLower.includes('system')) {
      return 'system';
    }
    
    return 'general';
  }
  
  /**
   * Get event priority based on type and data
   */
  getEventPriority(type, event) {
    const typeLower = type.toLowerCase();
    const data = event.data || event;
    
    // Critical events
    if (typeLower.includes('emergency') || typeLower.includes('squawk:7500') || typeLower.includes('squawk:7600') || typeLower.includes('squawk:7700')) {
      return 'critical';
    }
    
    // High priority events
    if (typeLower.includes('intrusion') || typeLower.includes('loitering') || typeLower.includes('speed:violation')) {
      return 'high';
    }
    
    // Normal priority events
    if (typeLower.includes('motion') || typeLower.includes('smartdetect') || typeLower.includes('vehicle') || typeLower.includes('person')) {
      return 'normal';
    }
    
    // Low priority events
    if (typeLower.includes('connector:status') || typeLower.includes('system:status')) {
      return 'low';
    }
    
    return 'normal';
  }
  
  /**
   * Get connector type
   */
  getConnectorType(connectorId) {
    if (connectorId.includes('unifi')) return 'unifi-protect';
    if (connectorId.includes('adsb')) return 'adsb';
    if (connectorId.includes('aprs')) return 'aprs';
    if (connectorId.includes('overwatch')) return 'overwatch';
    return 'unknown';
  }
  
  /**
   * Get camera information from UniFi Protect connector
   */
  getCameraInfo(deviceId) {
    try {
      const unifiConnector = this.connectorRegistry?.getConnector('unifi-protect-main');
      if (!unifiConnector) {
        return { id: deviceId, name: 'Unknown Camera' };
      }
      
      // Try to get camera from the connector's camera cache
      const camera = unifiConnector.cameras?.get(deviceId) || 
                    unifiConnector.getCachedDevice?.('cameras', deviceId);
      
      if (camera) {
        return {
          id: deviceId,
          name: camera.name || camera.displayName || 'Unknown Camera',
          type: camera.type || 'unknown',
          model: camera.model || 'unknown'
        };
      }
      
      return { id: deviceId, name: `Camera ${deviceId}` };
    } catch (error) {
      return { id: deviceId, name: `Camera ${deviceId}` };
    }
  }
  
  /**
   * Enhance motion events
   */
  enhanceMotionEvent(event) {
    let enhanced = { ...event };
    const data = event.data || event;
    
    // Add duration calculation
    if (data.start && data.end) {
      enhanced.duration = Math.round((data.end - data.start) / 1000);
    }
    
    // Add camera information
    if (data.device) {
      const cameraInfo = this.getCameraInfo(data.device);
      enhanced.camera = cameraInfo;
      enhanced.snapshotUrl = this.generateSnapshotUrl(data.device, data.start);
      enhanced.thumbnailUrl = this.generateThumbnailUrl(data.device, data.start);
    }
    
    return enhanced;
  }
  
  /**
   * Enhance smart detect events
   */
  enhanceSmartDetectEvent(event) {
    let enhanced = { ...event };
    const data = event.data || event;
    
    // Add detection confidence
    if (!enhanced.confidence) {
      enhanced.confidence = 50.0; // Default confidence
    }
    
    // Add detection types
    if (data.smartDetectTypes && Array.isArray(data.smartDetectTypes)) {
      enhanced.detectionTypes = data.smartDetectTypes;
    }
    
    // Add camera information
    if (data.device) {
      const cameraInfo = this.getCameraInfo(data.device);
      enhanced.camera = cameraInfo;
      enhanced.snapshotUrl = this.generateSnapshotUrl(data.device, data.start);
      enhanced.videoUrl = this.generateVideoUrl(data.device, data.start, data.end);
    }
    
    return enhanced;
  }
  
  /**
   * Enhance aircraft events
   */
  enhanceAircraftEvent(event) {
    let enhanced = { ...event };
    const data = event.data || event;
    
    // Add aircraft information
    if (data.icao24) {
      enhanced.icao24 = data.icao24;
    }
    
    if (data.callsign) {
      enhanced.callsign = data.callsign;
    }
    
    if (data.registration) {
      enhanced.registration = data.registration;
    }
    
    // Add flight data
    if (data.altitude) {
      enhanced.altitude = data.altitude;
    }
    
    if (data.speed) {
      enhanced.speed = data.speed;
    }
    
    // Add emergency status
    if (data.squawk) {
      enhanced.squawk = data.squawk;
      enhanced.isEmergency = ['7500', '7600', '7700'].includes(data.squawk);
    }
    
    return enhanced;
  }
  
  /**
   * Enhance squawk analysis events
   */
  enhanceSquawkEvent(event) {
    let enhanced = { ...event };
    const data = event.data || event;
    
    // Add squawk analysis
    if (data.squawk) {
      enhanced.squawk = data.squawk;
      enhanced.category = this.analyzeSquawkCode(data.squawk);
    }
    
    if (data.aircraft) {
      enhanced.aircraft = data.aircraft;
    }
    
    return enhanced;
  }
  
  /**
   * Enhance speed violation events
   */
  enhanceSpeedViolationEvent(event) {
    let enhanced = { ...event };
    const data = event.data || event;
    
    // Add speed information
    if (data.speed) {
      enhanced.speed = data.speed;
    }
    
    if (data.limit) {
      enhanced.limit = data.limit;
      enhanced.overLimit = data.speed - data.limit;
    }
    
    if (data.location) {
      enhanced.location = data.location;
    }
    
    if (data.vehicle) {
      enhanced.vehicle = data.vehicle;
    }
    
    // Add media links
    if (data.camera) {
      enhanced.snapshotUrl = this.generateSnapshotUrl(data.camera, data.timestamp);
      enhanced.videoUrl = this.generateVideoUrl(data.camera, data.timestamp - 30000, data.timestamp + 30000);
    }
    
    return enhanced;
  }
  
  /**
   * Enhance vehicle events
   */
  enhanceVehicleEvent(event) {
    let enhanced = { ...event };
    const data = event.data || event;
    
    // Add vehicle information
    if (data.licensePlate) {
      enhanced.licensePlate = data.licensePlate;
    }
    
    if (data.vehicleType) {
      enhanced.vehicleType = data.vehicleType;
    }
    
    if (data.color) {
      enhanced.color = data.color;
    }
    
    // Add media links
    if (data.camera) {
      enhanced.snapshotUrl = this.generateSnapshotUrl(data.camera, data.timestamp);
    }
    
    return enhanced;
  }
  
  /**
   * Enhance person events
   */
  enhancePersonEvent(event) {
    let enhanced = { ...event };
    const data = event.data || event;
    
    // Add person information
    if (data.confidence) {
      enhanced.confidence = data.confidence;
    }
    
    if (data.location) {
      enhanced.location = data.location;
    }
    
    // Add media links
    if (data.camera) {
      enhanced.snapshotUrl = this.generateSnapshotUrl(data.camera, data.timestamp);
    }
    
    return enhanced;
  }
  
  /**
   * Analyze squawk code
   */
  analyzeSquawkCode(squawk) {
    switch (squawk) {
      case '7500': return 'Hijacking';
      case '7600': return 'Radio Failure';
      case '7700': return 'Emergency';
      default: return 'General';
    }
  }
  
  /**
   * Generate snapshot URL
   */
  generateSnapshotUrl(device, timestamp) {
    // This would be implemented based on your camera system
    // For now, return a placeholder
    return `/api/cameras/${device}/snapshot?timestamp=${timestamp}`;
  }
  
  /**
   * Generate thumbnail URL
   */
  generateThumbnailUrl(device, timestamp) {
    return `/api/cameras/${device}/thumbnail?timestamp=${timestamp}`;
  }
  
  /**
   * Generate video URL
   */
  generateVideoUrl(device, start, end) {
    return `/api/cameras/${device}/video?start=${start}&end=${end}`;
  }
  
  /**
   * Process system events
   */
  processSystemEvent(type, data) {
    const event = {
      id: `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: 'system',
      timestamp: new Date().toISOString(),
      data,
      type,
      priority: 'normal'
    };
    
    this.eventHistory.push(event);
    this.broadcastEvent(event);
  }
  
  /**
   * Apply active filters to an event
   */
  applyFilters(event) {
    if (this.activeFilters.size === 0) {
      return event; // No filters active, show all events
    }
    
    for (const [filterId, filter] of this.activeFilters) {
      if (!this.matchesFilter(event, filter)) {
        return null; // Event doesn't match filter
      }
    }
    
    return event;
  }
  
  /**
   * Check if event matches a filter
   */
  matchesFilter(event, filter) {
    for (const [key, value] of Object.entries(filter)) {
      if (key === 'eventType' && Array.isArray(value)) {
        // Check if any of the filter event types match the event type
        const matches = value.some(filterType => {
          // Handle exact matches
          if (event.type === filterType) return true;
          // Handle partial matches (e.g., 'smartDetect' matches 'smartDetectZone')
          if (event.type && event.type.includes(filterType)) return true;
          return false;
        });
        if (!matches) return false;
      }
      
      if (key === 'source' && Array.isArray(value)) {
        // Check if the event source matches any of the filter sources
        if (!value.includes(event.source)) {
          return false;
        }
      }
      
      if (key === 'priority' && Array.isArray(value)) {
        if (!value.includes(event.priority)) {
          return false;
        }
      }
    }
    return true;
  }
  
  /**
   * Safely serialize event data to prevent circular reference errors
   */
  safeSerialize(data) {
    const seen = new WeakSet();
    return JSON.stringify(data, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    });
  }
  
  /**
   * Broadcast event to WebSocket connections
   */
  broadcastEvent(event) {
    this.webSocketConnections.forEach((ws) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          const serializedEvent = this.safeSerialize({
            type: 'event',
            data: event
          });
          ws.send(serializedEvent);
        } catch (error) {
          this.logger.error('Failed to serialize event for WebSocket broadcast', {
            error: error.message,
            eventType: event.type,
            eventId: event.id
          });
        }
      }
    });
  }
  
  /**
   * Update performance metrics
   */
  updateMetrics(event) {
    this.performanceMetrics.eventsProcessed++;
    this.performanceMetrics.lastUpdate = new Date().toISOString();
  }
  
  /**
   * Start event processing
   */
  startEventProcessing() {
    // Set up periodic system health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Stop event processing
   */
  stopEventProcessing() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  
  /**
   * Perform health check
   */
  async performHealthCheck() {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        connectors: {},
        system: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          eventHistorySize: this.eventHistory.length
        },
        performance: this.performanceMetrics
      };
      
      // Check connector health
      this.connectedConnectors.forEach((connector, connectorId) => {
        health.connectors[connectorId] = {
          status: connector.status,
          lastActivity: connector.stats?.lastActivity,
          errors: connector.stats?.errors || 0
        };
      });
      
      this.logger.info('[OverwatchConnector] performHealthCheck called', { health });
      
      this.processSystemEvent('health:check', health);
      
      const result = {
        healthy: true,
        details: health,
        timestamp: new Date().toISOString()
      };
      this.logger.info('[OverwatchConnector] performHealthCheck returning', { result });
      return result;
    } catch (error) {
      this.logger.error('[OverwatchConnector] performHealthCheck error', { error });
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Close WebSocket connections
   */
  closeWebSocketConnections() {
    this.webSocketConnections.forEach((ws) => {
      if (ws.readyState === 1) {
        ws.close();
      }
    });
    this.webSocketConnections.clear();
  }
  
  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'overwatch:flows':
        return await this.executeFlowOperation(operation, parameters);
      case 'overwatch:rules':
        return await this.executeRuleOperation(operation, parameters);
      case 'overwatch:events':
        return await this.executeEventOperation(operation, parameters);
      case 'overwatch:connectors':
        return await this.executeConnectorOperation(operation, parameters);
      case 'overwatch:system':
        return await this.executeSystemOperation(operation, parameters);
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }
  
  /**
   * Execute flow operations
   */
  async executeFlowOperation(operation, parameters) {
    switch (operation) {
      case 'list':
        return Array.from(this.flows.values());
      case 'get':
        return this.flows.get(parameters.id);
      case 'create':
        return await this.createFlow(parameters);
      case 'update':
        return await this.updateFlow(parameters.id, parameters);
      case 'delete':
        return await this.deleteFlow(parameters.id);
      case 'enable':
        return await this.enableFlow(parameters.id);
      case 'disable':
        return await this.disableFlow(parameters.id);
      default:
        throw new Error(`Unknown flow operation: ${operation}`);
    }
  }
  
  /**
   * Execute rule operations
   */
  async executeRuleOperation(operation, parameters) {
    switch (operation) {
      case 'list':
        return Array.from(this.rules.values());
      case 'get':
        return this.rules.get(parameters.id);
      case 'create':
        return await this.createRule(parameters);
      case 'update':
        return await this.updateRule(parameters.id, parameters);
      case 'delete':
        return await this.deleteRule(parameters.id);
      case 'enable':
        return await this.enableRule(parameters.id);
      case 'disable':
        return await this.disableRule(parameters.id);
      default:
        throw new Error(`Unknown rule operation: ${operation}`);
    }
  }
  
  /**
   * Execute event operations
   */
  async executeEventOperation(operation, parameters) {
    switch (operation) {
      case 'stream':
        return this.getEventStream(parameters);
      case 'filter':
        return this.setEventFilter(parameters);
      case 'history':
        return this.getEventHistory(parameters);
      case 'stats':
        return this.getEventStats();
      default:
        throw new Error(`Unknown event operation: ${operation}`);
    }
  }
  
  /**
   * Execute connector operations
   */
  async executeConnectorOperation(operation, parameters) {
    switch (operation) {
      case 'list':
        // Get all connectors from the registry
        const allConnectors = this.connectorRegistry?.getConnectors() || [];
        return allConnectors.map(connector => ({
          id: connector.id,
          name: connector.name,
          type: connector.type,
          status: connector.status,
          lastActivity: connector.stats?.lastActivity || null,
          enabled: connector.enabled
        }));
      case 'status':
        return this.getConnectorStatus(parameters.id);
      case 'connect':
        return await this.connectToConnector(parameters.id);
      case 'disconnect':
        return await this.disconnectFromConnector(parameters.id);
      case 'config':
        return this.getConnectorConfig(parameters.id);
      default:
        throw new Error(`Unknown connector operation: ${operation}`);
    }
  }
  
  /**
   * Execute system operations
   */
  async executeSystemOperation(operation, parameters) {
    switch (operation) {
      case 'health':
        return this.getSystemHealth();
      case 'metrics':
        return this.getSystemMetrics();
      case 'alerts':
        return this.getSystemAlerts();
      default:
        throw new Error(`Unknown system operation: ${operation}`);
    }
  }
  
  // Helper methods for operations
  async createFlow(flowData) {
    const flowId = flowData.id || `flow-${Date.now()}`;
    const flow = {
      ...flowData,
      id: flowId,
      createdAt: new Date().toISOString(),
      enabled: true
    };
    
    this.flows.set(flowId, flow);
    return flow;
  }
  
  async updateFlow(flowId, updates) {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    
    const updatedFlow = { ...flow, ...updates, updatedAt: new Date().toISOString() };
    this.flows.set(flowId, updatedFlow);
    return updatedFlow;
  }
  
  async deleteFlow(flowId) {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    
    this.flows.delete(flowId);
    return { success: true, message: `Flow ${flowId} deleted` };
  }
  
  async enableFlow(flowId) {
    return await this.updateFlow(flowId, { enabled: true });
  }
  
  async disableFlow(flowId) {
    return await this.updateFlow(flowId, { enabled: false });
  }
  
  getEventStream(parameters) {
    // Return event stream configuration
    return {
      type: 'websocket',
      url: `/api/overwatch/events/stream`,
      filters: parameters.filters || {}
    };
  }
  
  setEventFilter(parameters) {
    const filterId = parameters.id || `filter-${Date.now()}`;
    
    // Handle filter preset selection
    if (parameters.preset) {
      const preset = this.filterPresets.get(parameters.preset);
      if (preset) {
        this.activeFilters.set(filterId, preset.filters);
        return { filterId, active: true, preset: parameters.preset };
      }
    }
    
    // Handle custom filter criteria
    this.activeFilters.set(filterId, parameters.filters || {});
    return { filterId, active: true };
  }
  
  getEventHistory(parameters) {
    let events = [...this.eventHistory];
    
    // Apply filters
    if (parameters.filters) {
      events = events.filter(event => this.matchesFilter(event, parameters.filters));
    }
    
    // Apply pagination
    const limit = parameters.limit || 100;
    const offset = parameters.offset || 0;
    
    return events.slice(offset, offset + limit);
  }
  
  getEventStats() {
    return {
      totalEvents: this.eventHistory.length,
      eventsProcessed: this.performanceMetrics.eventsProcessed,
      activeFilters: this.activeFilters.size,
      connectedConnectors: this.connectedConnectors.size,
      lastUpdate: this.performanceMetrics.lastUpdate
    };
  }
  
  getConnectorStatus(connectorId) {
    const connector = this.connectorRegistry?.getConnector(connectorId);
    if (!connector) {
      throw new Error(`Connector not found: ${connectorId}`);
    }
    
    return {
      id: connectorId,
      status: connector.status,
      lastActivity: connector.stats?.lastActivity || null,
      errors: connector.stats?.errors || [],
      capabilities: connector.getEnabledCapabilities?.() || []
    };
  }
  
  async connectToConnector(connectorId) {
    const connector = this.connectorRegistry?.getConnector(connectorId);
    if (!connector) {
      throw new Error(`Connector not found: ${connectorId}`);
    }
    
    await connector.connect();
    this.connectedConnectors.set(connectorId, connector);
    return { success: true, message: `Connected to ${connectorId}` };
  }
  
  async disconnectFromConnector(connectorId) {
    const connector = this.connectedConnectors.get(connectorId);
    if (!connector) {
      throw new Error(`Connector not found: ${connectorId}`);
    }
    
    await connector.disconnect();
    this.connectedConnectors.delete(connectorId);
    return { success: true, message: `Disconnected from ${connectorId}` };
  }
  
  getConnectorConfig(connectorId) {
    const connector = this.connectorRegistry?.getConnector(connectorId);
    if (!connector) {
      throw new Error(`Connector not found: ${connectorId}`);
    }
    
    return {
      id: connectorId,
      name: connector.name,
      type: connector.type,
      config: connector.config,
      capabilities: connector.getCapabilities?.() || []
    };
  }
  
  getSystemHealth() {
    return {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      connectors: Array.from(this.connectedConnectors.values()).map(c => ({
        id: c.id,
        status: c.status,
        errors: c.stats.errors
      })),
      events: {
        total: this.eventHistory.length,
        processed: this.performanceMetrics.eventsProcessed
      }
    };
  }
  
  getSystemMetrics() {
    return {
      ...this.performanceMetrics,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      activeConnections: this.webSocketConnections.size
    };
  }
  
  getSystemAlerts() {
    const alerts = [];
    
    // Check for connector errors
    this.connectedConnectors.forEach((connector, connectorId) => {
      if (connector.stats.errors > 10) {
        alerts.push({
          type: 'connector_error',
          severity: 'warning',
          message: `Connector ${connectorId} has ${connector.stats.errors} errors`,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Check for memory usage
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      alerts.push({
        type: 'memory_usage',
        severity: 'warning',
        message: 'High memory usage detected',
        timestamp: new Date().toISOString()
      });
    }
    
    return alerts;
  }
  
  /**
   * Add WebSocket connection for real-time updates
   */
  addWebSocketConnection(ws) {
    this.webSocketConnections.add(ws);
    
    // Send initial data
    ws.send(JSON.stringify({
      type: 'connected',
      data: {
        message: 'Connected to Overwatch event stream',
        timestamp: new Date().toISOString()
      }
    }));
  }
  
  /**
   * Remove WebSocket connection
   */
  removeWebSocketConnection(ws) {
    this.webSocketConnections.delete(ws);
  }
  
  // Rule operation helper methods
  async createRule(ruleData) {
    const ruleId = ruleData.id || `rule-${Date.now()}`;
    const rule = {
      ...ruleData,
      id: ruleId,
      createdAt: new Date().toISOString(),
      enabled: true
    };
    
    this.rules.set(ruleId, rule);
    return rule;
  }
  
  async updateRule(ruleId, updates) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
    
    const updatedRule = { ...rule, ...updates, updatedAt: new Date().toISOString() };
    this.rules.set(ruleId, updatedRule);
    return updatedRule;
  }
  
  async deleteRule(ruleId) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
    
    this.rules.delete(ruleId);
    return { success: true, message: `Rule ${ruleId} deleted` };
  }
  
  async enableRule(ruleId) {
    return await this.updateRule(ruleId, { enabled: true });
  }
  
  async disableRule(ruleId) {
    return await this.updateRule(ruleId, { enabled: false });
  }
}

module.exports = OverwatchConnector;
