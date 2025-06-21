const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const killPort = require('kill-port');

const config = require('./config/config');
const UnifiProtectAPI = require('./services/unifiProtectAPI');
const EventProcessor = require('./services/eventProcessor');
const MQTTBroker = require('./services/mqttBroker');
const Cache = require('./services/cache');
const { router: apiRouter, injectServices } = require('./routes/api');

// Import flow system
const EventBus = require('./services/eventBus');
const RuleEngine = require('./services/ruleEngine');
const ActionFramework = require('./services/actionFramework');
const FlowOrchestrator = require('./services/flowOrchestrator');

// Import entity management system
const EntityManager = require('./services/entityManager');

// Import new analytics and monitoring services
const ZoneManager = require('./services/zoneManager');
const AnalyticsEngine = require('./services/analyticsEngine');
const DashboardService = require('./services/dashboardService');

// Import default rules
const defaultRules = require('./config/defaultRules');

// Import connector system
const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const UnifiProtectConnector = require('./connectors/types/UnifiProtectConnector');
const MqttConnector = require('./connectors/types/MqttConnector');
const WebGuiConnector = require('./connectors/types/WebGuiConnector');
const MapConnector = require('./connectors/types/MapConnector');

// Import analytics routes
const analyticsRouter = require('./routes/analytics');

// Import map integration service
const MapIntegrationService = require('./services/mapIntegrationService');

// Import map routes
const mapRouter = require('./routes/map');

// Initialize logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'babelfish' },
  transports: [
    new winston.transports.File({ filename: config.logging.file }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Define services and managers in a broader scope
let entityManager;
let connectorRegistry;
let cache;
let unifiAPI;
let eventProcessor;
let mqttBroker;
let eventBus;
let ruleEngine;
let actionFramework;
let flowOrchestrator;

// New analytics and monitoring services
let zoneManager;
let analyticsEngine;
let dashboardService;

// Map integration service
let mapIntegrationService;

// Main application setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.server.cors.origin,
    credentials: config.server.cors.credentials
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https:", "data:", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));
app.use(compression());
app.use(cors(config.server.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Broadcast function for real-time updates
function broadcastToClients(event, data) {
  if (io) {
    io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }
}

// Handle connector events (including WebSocket events)
function setupConnectorEvents() {
  if (!connectorRegistry) return;
  
  connectorRegistry.on('connector:event', (event) => {
    // Process the event through the event processor
    if (eventProcessor) {
      eventProcessor.processEvent(event);
    }
    
    // Publish to event bus for flow processing
    if (eventBus) {
      eventBus.publishEvent({
        type: event.type,
        source: event.connectorId || 'communications-van',
        timestamp: event.timestamp,
        data: event.data || event
      });
    }
    
    // Publish to MQTT if enabled
    if (mqttBroker) {
      mqttBroker.publish('connector/events', event);
    }
    
    // Broadcast to WebSocket clients
    broadcastToClients('connectorEvent', event);
  });
  
  // Handle new event type discoveries
  connectorRegistry.on('eventType:discovered', (data) => {
    logger.warn(`🆕 NEW EVENT TYPE DISCOVERED: ${data.eventType}`);
    
    // Publish to event bus
    if (eventBus) {
      eventBus.publishEvent({
        type: 'eventType:discovered',
        source: 'connector-registry',
        timestamp: data.timestamp,
        data: data
      });
    }
    
    // Publish to MQTT
    if (mqttBroker) {
      mqttBroker.publish('system/discovered/eventType', data);
    }
    
    // Broadcast to WebSocket clients
    broadcastToClients('eventTypeDiscovered', data);
  });
  
  // Handle new field discoveries
  connectorRegistry.on('fields:discovered', (data) => {
    logger.warn(`🆕 NEW FIELDS DISCOVERED for ${data.eventType}: ${data.newFields.map(f => f.field).join(', ')}`);
    
    // Publish to event bus
    if (eventBus) {
      eventBus.publishEvent({
        type: 'fields:discovered',
        source: 'connector-registry',
        timestamp: data.timestamp,
        data: data
      });
    }
    
    // Publish to MQTT
    if (mqttBroker) {
      mqttBroker.publish('system/discovered/fields', data);
    }
    
    // Broadcast to WebSocket clients
    broadcastToClients('fieldsDiscovered', data);
  });
  
  // Handle generic events
  connectorRegistry.on('event:generic', (event) => {
    logger.info(`Generic event received: ${event.eventType} for camera ${event.cameraId}`);
    
    // Publish to event bus
    if (eventBus) {
      eventBus.publishEvent({
        type: 'event:generic',
        source: 'connector-registry',
        timestamp: event.timestamp,
        data: event
      });
    }
    
    // Publish to MQTT
    if (mqttBroker) {
      mqttBroker.publish('events/generic', event);
    }
    
    // Broadcast to WebSocket clients
    broadcastToClients('genericEvent', event);
  });
}

// Handle entity events
function setupEntityEvents() {
  if (!entityManager) return;
  
  entityManager.on('entity:created', (entity) => {
    logger.info(`Entity created: ${entity.id} (${entity.type})`);
    broadcastToClients('entityCreated', entity);
  });

  entityManager.on('entity:updated', (entity) => {
    logger.info(`Entity updated: ${entity.id} (${entity.type})`);
    broadcastToClients('entityUpdated', entity);
  });

  entityManager.on('entity:deleted', (entity) => {
    logger.info(`Entity deleted: ${entity.id} (${entity.type})`);
    broadcastToClients('entityDeleted', entity);
  });
}

// Handle camera-specific events from UniFi connector
function setupCameraEvents() {
  if (!connectorRegistry) return;
  
  connectorRegistry.on('motion:detected', (data) => {
    logger.info(`Motion detected on camera: ${data.cameraId}`);
    broadcastToClients('motionDetected', data);
    
    // Process through analytics engine
    if (analyticsEngine) {
      analyticsEngine.processEvent({
        cameraId: data.cameraId,
        eventType: 'motion',
        data: data.event,
        timestamp: data.timestamp
      });
    }
    
    // Route to rule engine for MQTT publishing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: 'motionDetected',
        source: 'unifi-protect-websocket',
        timestamp: new Date().toISOString(),
        data: data
      });
    }
  });

  connectorRegistry.on('smart:detected', (data) => {
    logger.info(`Smart detection on camera: ${data.cameraId}`);
    broadcastToClients('smartDetected', data);
    
    // Process through analytics engine
    if (analyticsEngine) {
      analyticsEngine.processEvent({
        cameraId: data.cameraId,
        eventType: 'smartDetected',
        data: data.event,
        timestamp: data.timestamp
      });
    }
    
    // Route to rule engine for MQTT publishing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: 'smartDetected',
        source: 'unifi-protect-websocket',
        timestamp: new Date().toISOString(),
        data: data
      });
    }
  });

  connectorRegistry.on('recording:event', (data) => {
    logger.info(`Recording event on camera: ${data.cameraId}`);
    broadcastToClients('recordingEvent', data);
    
    // Process through analytics engine
    if (analyticsEngine) {
      analyticsEngine.processEvent({
        cameraId: data.cameraId,
        eventType: 'recording',
        data: data.event,
        timestamp: data.timestamp
      });
    }
    
    // Route to rule engine for MQTT publishing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: 'recordingEvent',
        source: 'unifi-protect-websocket',
        timestamp: new Date().toISOString(),
        data: data
      });
    }
  });

  connectorRegistry.on('connection:event', (data) => {
    logger.info(`Connection event on camera: ${data.cameraId}`);
    broadcastToClients('connectionEvent', data);
    
    // Process through analytics engine
    if (analyticsEngine) {
      analyticsEngine.processEvent({
        cameraId: data.cameraId,
        eventType: 'connection',
        data: data.event,
        timestamp: data.timestamp
      });
    }
    
    // Route to rule engine for MQTT publishing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: 'connectionEvent',
        source: 'unifi-protect-websocket',
        timestamp: new Date().toISOString(),
        data: data
      });
    }
  });

  connectorRegistry.on('camera:added', (data) => {
    logger.info(`Camera added: ${data.cameraId}`);
    broadcastToClients('cameraAdded', data);
    
    // Process through analytics engine
    if (analyticsEngine) {
      analyticsEngine.processEvent({
        cameraId: data.cameraId,
        eventType: 'cameraAdded',
        data: data,
        timestamp: data.timestamp
      });
    }
    
    // Route to rule engine for MQTT publishing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: 'cameraAdded',
        source: 'unifi-protect-websocket',
        timestamp: new Date().toISOString(),
        data: data
      });
    }
  });

  connectorRegistry.on('camera:removed', (data) => {
    logger.info(`Camera removed: ${data.cameraId}`);
    broadcastToClients('cameraRemoved', data);
    
    // Process through analytics engine
    if (analyticsEngine) {
      analyticsEngine.processEvent({
        cameraId: data.cameraId,
        eventType: 'cameraRemoved',
        data: data,
        timestamp: data.timestamp
      });
    }
    
    // Route to rule engine for MQTT publishing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: 'cameraRemoved',
        source: 'unifi-protect-websocket',
        timestamp: new Date().toISOString(),
        data: data
      });
    }
  });
}

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`WebSocket client disconnected: ${socket.id}`);
  });
  
  // Camera-related WebSocket events
  socket.on('getCameras', async () => {
    try {
      const cameras = await unifiAPI.getCameras();
      socket.emit('cameras', cameras);
    } catch (error) {
      logger.error('Error getting cameras:', error);
      socket.emit('error', { message: 'Failed to get cameras' });
    }
  });

  // Connector-related WebSocket events
  socket.on('getConnectors', async () => {
    try {
      const connectors = connectorRegistry.getConnectors().map(connector => ({
        id: connector.id,
        type: connector.type,
        name: connector.name,
        status: connector.status,
        capabilities: connector.getEnabledCapabilities().map(cap => cap.id)
      }));
      socket.emit('connectors', connectors);
    } catch (error) {
      logger.error('Error getting connectors:', error);
      socket.emit('error', { message: 'Failed to get connectors' });
    }
  });
});

// Inject services into API router
injectServices({
  get unifiAPI() { return unifiAPI; },
  get eventProcessor() { return eventProcessor; },
  get mqttBroker() { return mqttBroker; },
  get cache() { return cache; },
  get connectorRegistry() { return connectorRegistry; },
  get entityManager() { return entityManager; },
  get zoneManager() { return zoneManager; },
  get analyticsEngine() { return analyticsEngine; },
  get dashboardService() { return dashboardService; },
  get ruleEngine() { return ruleEngine; },
  get flowOrchestrator() { return flowOrchestrator; },
  get mapIntegrationService() { return mapIntegrationService; }
});

// Connector event handling
function setupConnectorEventHandlers() {
  if (!connectorRegistry) return;
  
  connectorRegistry.on('connector:connected', (data) => {
    broadcastToClients('connectorConnected', data);
  });

  connectorRegistry.on('connector:disconnected', (data) => {
    broadcastToClients('connectorDisconnected', data);
  });

  connectorRegistry.on('connector:operation-completed', (data) => {
    broadcastToClients('connectorOperationCompleted', data);
  });

  connectorRegistry.on('connector:operation-error', (data) => {
    broadcastToClients('connectorOperationError', data);
  });
}

// Event processing and broadcasting
function setupEventProcessing() {
  if (!eventProcessor) return;
  
  eventProcessor.on('newEvent', (event) => {
    broadcastToClients('newEvent', event);
    
    // Publish to event bus for flow processing
    if (eventBus) {
      eventBus.publishEvent({
        type: event.type,
        source: event.source || 'communications-van',
        timestamp: event.timestamp,
        data: event.data || event
      });
    }
    
    // Publish to MQTT if enabled
    if (mqttBroker) {
      mqttBroker.publish('events', event);
    }
  });

  eventProcessor.on('deviceStatus', (status) => {
    broadcastToClients('deviceStatus', status);
    
    // Publish system status to event bus
    if (eventBus) {
      eventBus.publishEvent({
        type: 'system',
        source: status.deviceId || 'communications-van',
        timestamp: status.timestamp,
        data: status
      });
    }
    
    // Publish to MQTT if enabled
    if (mqttBroker) {
      mqttBroker.publish('system', status);
    }
  });
}

/**
 * Auto-register Web GUI and Map connectors
 */
async function autoRegisterGuiAndMapConnectors() {
  try {
    // Check if Web GUI connector exists
    const webGuiConnector = connectorRegistry.getConnector('web-gui');
    if (!webGuiConnector) {
      logger.info('Auto-creating Web GUI connector...');
      await connectorRegistry.createConnector({
        id: 'web-gui',
        type: 'web-gui',
        name: 'Web GUI',
        description: 'Web-based graphical user interface',
        config: {
          webInterface: {
            enabled: true,
            port: config.server.port,
            host: config.server.host
          },
          autoRegisterWithMaps: true,
          autoDiscoverConnectors: true,
          theme: 'dark',
          layout: 'default'
        }
      });
    }

    // Check if Map connector exists
    const mapConnector = connectorRegistry.getConnector('main-map');
    if (!mapConnector) {
      logger.info('Auto-creating Map connector...');
      await connectorRegistry.createConnector({
        id: 'main-map',
        type: 'map',
        name: 'Main Map',
        description: 'Primary spatial visualization map',
        config: {
          autoRegisterConnectors: true,
          enableWebSockets: true,
          editMode: false,
          viewMode: 'realtime',
          spatialElements: [],
          connectorContexts: []
        }
      });
    }

    // Initialize map integration service with connectors
    const webGui = connectorRegistry.getConnector('web-gui');
    const map = connectorRegistry.getConnector('main-map');
    
    if (webGui && map) {
      await mapIntegrationService.initialize({
        webGuiConnector: webGui,
        mapConnector: map,
        connectorRegistry: connectorRegistry
      });

      // Auto-register Web GUI with Map
      if (webGui.autoRegisterWithMaps) {
        await webGui.autoRegisterWithMaps(map);
      }

      // Auto-register all other connectors with the map
      const otherConnectors = connectorRegistry.getConnectors().filter(c => 
        c.id !== 'web-gui' && c.id !== 'main-map'
      );

      for (const connector of otherConnectors) {
        try {
          await mapIntegrationService.registerConnectorWithMap(connector, map);
        } catch (error) {
          logger.warn(`Failed to auto-register connector ${connector.id} with map: ${error.message}`);
        }
      }

      logger.info(`Auto-registered ${otherConnectors.length} connectors with map`);
    }

  } catch (error) {
    logger.error('Failed to auto-register GUI and Map connectors:', error);
  }
}

// Start server
async function startServer() {
  try {
    if (config.server.killPort) {
      const port = config.server.port;
      try {
        logger.info(`Attempting to free port ${port}...`);
        await killPort(port, 'tcp');
        logger.info(`Port ${port} has been successfully freed.`);
      } catch (e) {
        logger.warn(`Could not kill port ${port}, it may have already been free. Details: ${e.message}`);
      }
    }
    logger.info('Starting Babelfish Looking Glass server...');

    // Initialize entity manager
    entityManager = new EntityManager(config.entities || {}, logger);

    // Initialize new analytics and monitoring services
    zoneManager = new ZoneManager(config.analytics || {}, logger);
    analyticsEngine = new AnalyticsEngine(config.analytics || {}, logger);
    dashboardService = new DashboardService(config.dashboard || {}, logger);

    // Initialize map integration service
    mapIntegrationService = new MapIntegrationService(config.mapIntegration || {}, logger);

    // Initialize connector registry
    connectorRegistry = new ConnectorRegistry(logger);

    // Register connector types
    connectorRegistry.registerType('unifi-protect', UnifiProtectConnector);
    connectorRegistry.registerType('mqtt', MqttConnector);
    connectorRegistry.registerType('web-gui', WebGuiConnector);
    connectorRegistry.registerType('map', MapConnector);

    // Auto-discover and register connector types
    await connectorRegistry.autoDiscoverTypes();

    // Initialize the registry to load connectors from config
    connectorRegistry.initialize();

    // Auto-register Web GUI and Map connectors
    await autoRegisterGuiAndMapConnectors();

    // Set entity manager reference for connectors that support it
    connectorRegistry.getConnectors().forEach(connector => {
      if (connector.setEntityManager) {
        connector.setEntityManager(entityManager);
      }
    });
    
    // Initialize services
    cache = new Cache(config.cache);
    unifiAPI = new UnifiProtectAPI(config.unifi, logger);
    eventProcessor = new EventProcessor(config.events, logger);
    
    if (config.mqtt.enabled) {
      mqttBroker = new MQTTBroker(config.mqtt, logger);
    }
    
    // Initialize flow system (if enabled)
    if (config.flow.enabled) {
      eventBus = new EventBus(config.flow.eventBus, logger);
      ruleEngine = new RuleEngine(config.flow.ruleEngine, logger);
      actionFramework = new ActionFramework(config.flow.actionFramework, logger);
      flowOrchestrator = new FlowOrchestrator(config.flow.orchestrator, logger);
      
      // Connect rule engine with services
      ruleEngine.setConnectors(connectorRegistry);
      ruleEngine.setEventBus(eventBus);
      ruleEngine.setCache(cache);
      
      // Register action framework handlers with rule engine
      ruleEngine.registerAction('mqtt_publish', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('mqtt_subscribe', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('send_notification', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('send_email', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('send_sms', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('slack_notify', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('connector_execute', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('connector_connect', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('connector_disconnect', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('log_event', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('store_data', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('http_request', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('delay', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('transform_data', actionFramework.executeAction.bind(actionFramework));
      ruleEngine.registerAction('conditional_action', actionFramework.executeAction.bind(actionFramework));
      
      // Load default rules
      ruleEngine.loadRules(defaultRules);
      
      logger.info('Flow system initialized');
    }

    // Setup event listeners
    setupConnectorEvents();
    setupEntityEvents();
    setupCameraEvents();
    setupConnectorEventHandlers();
    setupEventProcessing();

    // Initialize services
    await cache.initialize();
    await unifiAPI.initialize();
    await eventProcessor.initialize();
    
    if (mqttBroker) {
      await mqttBroker.initialize();
    }
    
    // Initialize analytics engine with zone manager
    analyticsEngine.setZoneManager(zoneManager);
    
    // Initialize dashboard service
    await dashboardService.initialize({
      zoneManager,
      analyticsEngine,
      entityManager,
      eventProcessor
    });
    
    // Initialize flow system
    if (flowOrchestrator) {
      // Create connectors map for flow orchestrator
      const connectorsMap = new Map();
      const connectors = connectorRegistry.getConnectors();
      for (const connector of connectors) {
        connectorsMap.set(connector.id, connector);
      }
      
      await flowOrchestrator.initialize({
        eventBus,
        ruleEngine,
        actionFramework,
        connectors: connectorsMap,
        cache,
        mqttBroker
      });
      
      logger.info('Flow system initialized and ready');
    }
    
    // Connect all connectors
    const connectionResults = await connectorRegistry.connectAll();
    logger.info(`Connected ${connectionResults.filter(r => r.status === 'connected').length} connectors`);
    
    // Start event processing
    eventProcessor.start();
    
    // Set up API routes
    injectServices({
      unifiAPI,
      eventProcessor,
      mqttBroker,
      cache,
      connectorRegistry,
      entityManager,
      zoneManager,
      analyticsEngine,
      dashboardService,
      ruleEngine,
      flowOrchestrator,
      mapIntegrationService
    });
    
    // Make services available to API routes via app.locals
    app.locals.connectorRegistry = connectorRegistry;
    app.locals.entityManager = entityManager;
    app.locals.zoneManager = zoneManager;
    app.locals.analyticsEngine = analyticsEngine;
    app.locals.dashboardService = dashboardService;
    app.locals.eventProcessor = eventProcessor;
    app.locals.cache = cache;
    app.locals.unifiAPI = unifiAPI;
    app.locals.mqttBroker = mqttBroker;
    app.locals.mapIntegrationService = mapIntegrationService;
    
    // Flow system services
    if (config.flow.enabled) {
      app.locals.ruleEngine = ruleEngine;
      app.locals.flowOrchestrator = flowOrchestrator;
      app.locals.eventBus = eventBus;
      app.locals.actionFramework = actionFramework;
    }
    
    // Root health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        service: 'Babelfish Looking Glass',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        environment: config.server.environment
      });
    });
    
    // Mount API routes
    app.use('/api', apiRouter);
    
    // Mount analytics routes
    app.use('/api/analytics', analyticsRouter);
    
    // Mount map routes
    app.use('/api/map', mapRouter);
    
    // Start server
    server.listen(config.server.port, config.server.host, () => {
      logger.info(`🚀 Babelfish Looking Glass server running on http://${config.server.host}:${config.server.port}`);
      logger.info(`📡 WebSocket available at ws://${config.server.host}:${config.server.port}`);
      logger.info(`🔍 Health check: http://${config.server.host}:${config.server.port}/health`);
      logger.info(`🌐 Web UI: http://${config.server.host}:${config.server.port}`);
      logger.info(`🔧 Environment: ${config.server.environment}`);
      logger.info(`🔌 Connector API: http://${config.server.host}:${config.server.port}/api/connectors`);
      logger.info(`📊 Analytics API: http://${config.server.host}:${config.server.port}/api/analytics`);
      logger.info(`📈 Dashboard API: http://${config.server.host}:${config.server.port}/api/analytics/dashboard`);
      
      if (mqttBroker) {
        logger.info(`📨 MQTT broker connected to ${config.mqtt.broker.host}:${config.mqtt.broker.port}`);
      }
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  if (eventProcessor) {
    eventProcessor.stop();
  }
  
  if (dashboardService) {
    dashboardService.cleanup();
  }
  
  // Disconnect all connectors
  if (connectorRegistry) {
    await connectorRegistry.disconnectAll();
  }
  
  if (mqttBroker) {
    await mqttBroker.disconnect();
  }
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  
  if (eventProcessor) {
    eventProcessor.stop();
  }
  
  if (dashboardService) {
    dashboardService.cleanup();
  }
  
  // Disconnect all connectors
  if (connectorRegistry) {
    await connectorRegistry.disconnectAll();
  }
  
  if (mqttBroker) {
    await mqttBroker.disconnect();
  }
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start the server
startServer(); 