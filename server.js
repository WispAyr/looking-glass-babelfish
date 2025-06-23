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

// Import layout and GUI services
const LayoutManager = require('./services/layoutManager');
const GuiEditor = require('./services/guiEditor');

// Import speed calculation system
const SpeedCalculationService = require('./services/speedCalculationService');

// Import airport vector service
const AirportVectorService = require('./services/airportVectorService');

// Import coastline vector service
const CoastlineVectorService = require('./services/coastlineVectorService');

// Import vector optimization service
const VectorOptimizationService = require('./services/vectorOptimizationService');

// Import airspace service
const AirspaceService = require('./services/airspaceService');

// Import default rules
const defaultRules = require('./config/defaultRules');

// Import connector system
const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const UnifiProtectConnector = require('./connectors/types/UnifiProtectConnector');
const MqttConnector = require('./connectors/types/MqttConnector');
const WebGuiConnector = require('./connectors/types/WebGuiConnector');
const MapConnector = require('./connectors/types/MapConnector');
const SpeedCalculationConnector = require('./connectors/types/SpeedCalculationConnector');
const RadarConnector = require('./connectors/types/RadarConnector');
const ADSBConnector = require('./connectors/types/ADSBConnector');
const APRSConnector = require('./connectors/types/APRSConnector');
const RemotionConnector = require('./connectors/types/RemotionConnector');
const OverwatchConnector = require('./connectors/types/OverwatchConnector');
const PrestwickAirportConnector = require('./connectors/types/PrestwickAirportConnector');
const SystemVisualizerConnector = require('./connectors/types/SystemVisualizerConnector');
const TelegramConnector = require('./connectors/types/TelegramConnector');
const AlarmManagerConnector = require('./connectors/types/AlarmManagerConnector');
const NOTAMConnector = require('./connectors/types/NOTAMConnector');

// Import analytics routes
const analyticsRouter = require('./routes/analytics');

// Import speed calculation routes
const { router: speedRouter, SpeedRoutes } = require('./routes/speed');

// Import radar routes
const { router: radarRouter, injectServices: injectRadarServices } = require('./routes/radar');

// Import map integration service
const MapIntegrationService = require('./services/mapIntegrationService');

// Import map routes
const mapRouter = require('./routes/map');

// Import GUI routes
const { router: guiRouter, injectServices: injectGuiServices } = require('./routes/gui');

// Import Overwatch routes
const { router: overwatchRouter, injectServices: injectOverwatchServices, setupWebSocketServer, setupEventStreamWebSocket } = require('./routes/overwatch');

// Health routes
const { router: healthRouter, HealthRoutes } = require('./routes/health');

// History routes
const { router: historyRouter, injectServices: injectHistoryServices } = require('./routes/history');

// Prestwick Airport routes
const { router: prestwickRouter, injectServices: injectPrestwickServices } = require('./routes/prestwick');

// Import new health monitoring and security services
const HealthMonitor = require('./services/healthMonitor');
const SecurityMiddleware = require('./middleware/security');

// Import Flow Builder
const FlowBuilder = require('./services/flowBuilder');

// Import aircraft data service
const AircraftDataService = require('./services/aircraftDataService');

// Import squawk code service
const SquawkCodeService = require('./services/squawkCodeService');

// Import telegram route
const telegramRouter = require('./routes/telegram');

// Import alarm manager routes
const alarmRouter = require('./routes/alarms');

// Import UniFi Protect routes
const unifiRouter = require('./routes/unifi');

// Import display routes
const displayRouter = require('./routes/display');

// Import RTSP transcoding service
const RTSPTranscodingService = require('./services/rtspTranscodingService');

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

// Layout and GUI services
let layoutManager;
let guiEditor;

// Speed calculation system
let speedCalculationService;
let speedCalculationConnector;

// Radar system
let radarConnector;

// Airport vector service
let airportVectorService;

// Coastline vector service
let coastlineVectorService;

// Airspace service
let airspaceService;

// Vector optimization service
let vectorOptimizationService;

// Map integration service
let mapIntegrationService;

// New health monitoring and security services
let healthMonitor;
let securityMiddleware;

// Flow Builder
let flowBuilder;

// Aircraft data service
let aircraftDataService;

// Squawk code service
let squawkCodeService;

// RTSP transcoding service
let transcodingService;

// Main application setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.server.cors.origin,
    credentials: config.server.cors.credentials
  }
});

// Initialize security middleware
securityMiddleware = new SecurityMiddleware(config.security);

// Middleware
app.use(securityMiddleware.getHelmetConfig());
app.use(compression());
app.use(cors(securityMiddleware.getCorsConfig()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Add security middleware
app.use(securityMiddleware.getRateLimiter());
app.use(securityMiddleware.requestLogger());

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
  connectorRegistry.on('event', (data) => {
    logger.debug(`Generic event received: ${data.type} from ${data.source}`);
    
    // Route to rule engine for processing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: data.type,
        source: data.source || 'connector',
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        eventId: data.eventId,
        data: data.data
      });
    }
  });

  // Handle connector-specific events (e.g., van-unifi:event)
  connectorRegistry.on('connector:van-unifi:event', (data) => {
    logger.debug(`UniFi Protect connector event: ${data.type}`);
    
    // Route to rule engine for processing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: data.type,
        source: data.source || 'unifi-protect-websocket',
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        eventId: data.eventId,
        data: data.data
      });
    }
  });

  // Handle specific event types from connectors
  connectorRegistry.on('event:smartDetectZone', (data) => {
    logger.debug(`Smart detect zone event: ${data.deviceId}`);
    
    // Route to rule engine for processing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: 'smartDetectZone',
        source: data.source || 'unifi-protect-websocket',
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        eventId: data.eventId,
        data: data.data
      });
    }
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

  // Handle smartDetectZone events specifically
  connectorRegistry.on('smartDetectZone', (data) => {
    logger.info(`Smart detect zone event on camera: ${data.deviceId}`);
    broadcastToClients('smartDetectZone', data);
    
    // Process through analytics engine
    if (analyticsEngine) {
      analyticsEngine.processEvent({
        cameraId: data.deviceId,
        eventType: 'smartDetectZone',
        data: data.data,
        timestamp: data.timestamp
      });
    }
    
    // Route to rule engine for processing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: 'smartDetectZone',
        source: 'unifi-protect-websocket',
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        eventId: data.eventId,
        data: data.data
      });
    }
  });

  // Handle line crossing events specifically for speed calculation
  connectorRegistry.on('smartDetectLine', (data) => {
    logger.info(`Line crossing detected on camera: ${data.cameraId}`);
    broadcastToClients('lineCrossingDetected', data);
    
    // Process through analytics engine
    if (analyticsEngine) {
      analyticsEngine.processEvent({
        cameraId: data.cameraId,
        eventType: 'lineCrossing',
        data: data.event,
        timestamp: data.timestamp
      });
    }
    
    // Route to speed calculation system
    if (speedCalculationService) {
      speedCalculationService.processLineCrossingEvent({
        cameraId: data.cameraId,
        smartContext: data.smartContext,
        timestamp: data.timestamp,
        data: data.event
      });
    }
    
    // Route to rule engine for MQTT publishing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: 'lineCrossing',
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
      const unifiConnector = connectorRegistry.getConnector('unifi-protect-main');
      if (unifiConnector) {
        const cameras = await unifiConnector.getCameras();
        socket.emit('cameras', cameras);
      } else {
        socket.emit('cameras', []);
      }
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
  get mapIntegrationService() { return mapIntegrationService; },
  get layoutManager() { return layoutManager; },
  get guiEditor() { return guiEditor; },
  get speedCalculationService() { return speedCalculationService; },
  get speedCalculationConnector() { return speedCalculationConnector; },
  get radarConnector() { return radarConnector; },
  get airportVectorService() { return airportVectorService; },
  get coastlineVectorService() { return coastlineVectorService; },
  get airspaceService() { return airspaceService; },
  get vectorOptimizationService() { return vectorOptimizationService; },
  get aircraftDataService() { return aircraftDataService; },
  get squawkCodeService() { return squawkCodeService; },
  get transcodingService() { return transcodingService; }
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

  // Generic event handler for all connector events
  connectorRegistry.on('event', (data) => {
    logger.debug(`Generic event received: ${data.type} from ${data.source}`);
    
    // Route to rule engine for processing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: data.type,
        source: data.source || 'connector',
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        eventId: data.eventId,
        data: data.data
      });
    }
  });

  // Handle connector-specific events (e.g., van-unifi:event)
  connectorRegistry.on('connector:van-unifi:event', (data) => {
    logger.debug(`UniFi Protect connector event: ${data.type}`);
    
    // Route to rule engine for processing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: data.type,
        source: data.source || 'unifi-protect-websocket',
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        eventId: data.eventId,
        data: data.data
      });
    }
  });

  // Handle specific event types from connectors
  connectorRegistry.on('event:smartDetectZone', (data) => {
    logger.debug(`Smart detect zone event: ${data.deviceId}`);
    
    // Route to rule engine for processing
    if (ruleEngine) {
      ruleEngine.processEvent({
        type: 'smartDetectZone',
        source: data.source || 'unifi-protect-websocket',
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        eventId: data.eventId,
        data: data.data
      });
    }
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
    // Initialize map integration service with connectors
    const webGui = connectorRegistry.getConnector('web-gui');
    const map = connectorRegistry.getConnector('main-map');
    
    if (webGui && map) {
      // Auto-register Web GUI with Map using the map integration service
      try {
        await mapIntegrationService.registerConnectorWithMap(webGui, map);
        logger.info('Web GUI connector registered with map');
      } catch (error) {
        logger.warn(`Failed to register Web GUI with map: ${error.message}`);
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

    // Initialize Flow Builder
    flowBuilder = new FlowBuilder({
      flowsDir: path.join(process.cwd(), 'config', 'flows'),
      autoSave: true,
      maxFlows: 100
    });

    // Initialize core services
    cache = new Cache(config.cache || {}, logger);
    eventProcessor = new EventProcessor(config.events || {}, logger);
    mqttBroker = new MQTTBroker(config.mqtt || {}, logger);
    eventBus = new EventBus(config.eventBus || {}, logger);
    ruleEngine = new RuleEngine(config.rules || {}, logger);
    actionFramework = new ActionFramework(config.actions || {}, logger);
    flowOrchestrator = new FlowOrchestrator(config.flows || {}, logger);

    // Initialize entity manager
    entityManager = new EntityManager(config.entities || {}, logger);

    // Initialize new analytics and monitoring services
    zoneManager = new ZoneManager(config.analytics || {}, logger);
    analyticsEngine = new AnalyticsEngine(config.analytics || {}, logger);
    dashboardService = new DashboardService(config.dashboard || {}, logger);

    // Initialize speed calculation system
    speedCalculationService = new SpeedCalculationService(config.speedCalculation || {}, logger);

    // Initialize airport vector service
    airportVectorService = new AirportVectorService(config.airportVector || {}, logger);

    // Initialize coastline vector service
    coastlineVectorService = new CoastlineVectorService(config.coastlineVector || {}, logger);

    // Initialize airspace service with error handling
    try {
      logger.info('Initializing airspace service...');
      airspaceService = new AirspaceService(config.airspace || {});
      await airspaceService.initialize();
      logger.info('Airspace service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize airspace service', { 
        error: error.message,
        stack: error.stack 
      });
      // Continue without airspace service
      airspaceService = null;
    }

    // Initialize vector optimization service
    vectorOptimizationService = new VectorOptimizationService(config.vectorOptimization || {}, logger);

    // Initialize layout and GUI services
    layoutManager = new LayoutManager(config.layouts || {}, logger);
    guiEditor = new GuiEditor(config.guiEditor || {}, logger);

    // Initialize map integration service
    mapIntegrationService = new MapIntegrationService(config.mapIntegration || {}, logger);

    // Initialize health monitor
    healthMonitor = new HealthMonitor(config.health || {}, logger);
    healthMonitor.start();

    // Initialize connector registry
    connectorRegistry = new ConnectorRegistry(logger);
    app.locals.connectorRegistry = connectorRegistry;

    // Initialize RTSP transcoding service
    transcodingService = new RTSPTranscodingService();
    transcodingService.setConnectorRegistry(connectorRegistry);
    app.locals.transcodingService = transcodingService;
    logger.info('RTSP transcoding service initialized');

    // Register connector types
    connectorRegistry.registerType('unifi-protect', UnifiProtectConnector);
    connectorRegistry.registerType('mqtt', MqttConnector);
    connectorRegistry.registerType('web-gui', WebGuiConnector);
    connectorRegistry.registerType('map', MapConnector);
    connectorRegistry.registerType('speed-calculation', SpeedCalculationConnector);
    connectorRegistry.registerType('radar', RadarConnector);
    connectorRegistry.registerType('adsb', ADSBConnector);
    connectorRegistry.registerType('aprs', APRSConnector);
    connectorRegistry.registerType('remotion', RemotionConnector);
    connectorRegistry.registerType('overwatch', OverwatchConnector);
    connectorRegistry.registerType('prestwick-airport', PrestwickAirportConnector);
    connectorRegistry.registerType('telegram', TelegramConnector);
    connectorRegistry.registerType('alarm-manager', AlarmManagerConnector);
    connectorRegistry.registerType('notam', NOTAMConnector);

    // Auto-discover and register connector types
    await connectorRegistry.autoDiscoverTypes();

    // Initialize services BEFORE connectors
    await cache.initialize();
    await eventProcessor.initialize();
    
    // Initialize aircraft data service
    aircraftDataService = new AircraftDataService(config.aircraftData || {}, logger);
    await aircraftDataService.initialize();
    
    // Initialize squawk code service
    squawkCodeService = new SquawkCodeService(config.squawkCode || {}, logger);
    await squawkCodeService.initialize();

    // Initialize the registry to load connectors from config
    await connectorRegistry.initialize();

    // Initialize map integration service with connector registry
    await mapIntegrationService.initialize(connectorRegistry);

    // Create speed calculation connector if it doesn't exist
    let speedCalculationConnectorInstance = connectorRegistry.getConnector('speed-calculation-main');
    if (!speedCalculationConnectorInstance) {
      // Only auto-create if not already configured in config file
      const existingSpeedConnectors = connectorRegistry.getConnectors().filter(c => c.type === 'speed-calculation');
      if (existingSpeedConnectors.length === 0) {
        logger.info('Auto-creating Speed Calculation connector...');
        const speedConfig = {
          id: 'speed-calculation-main',
          type: 'speed-calculation',
          name: 'Main Speed Calculation',
          description: 'Primary speed calculation service',
          enabled: true,
        };
        await connectorRegistry.createConnector(speedConfig);
        speedCalculationConnectorInstance = connectorRegistry.getConnector('speed-calculation-main');
      } else {
        speedCalculationConnectorInstance = existingSpeedConnectors[0];
        logger.info('Using existing Speed Calculation connector from config');
      }
    }
    speedCalculationConnector = speedCalculationConnectorInstance;

    // Ensure essential connectors exist and initialize them
    const adsbConnectorInstance = connectorRegistry.getConnector('adsb-main');
    let radarConnectorInstance = connectorRegistry.getConnector('radar-main');

    if (!adsbConnectorInstance) {
      logger.warn('ADSB Connector "adsb-main" not found. Radar will not function correctly.');
    } else {
      // Initialize ADSB connector with its dependencies
      if (aircraftDataService) {
        adsbConnectorInstance.setAircraftDataService(aircraftDataService);
        logger.info('Connected aircraft data service to ADSB connector');
      }
      if (airspaceService) {
        adsbConnectorInstance.setAirspaceService(airspaceService);
        logger.info('Connected airspace service to ADSB connector');
      }
      if (squawkCodeService) {
        adsbConnectorInstance.setSquawkCodeService(squawkCodeService);
        logger.info('Connected squawk code service to ADSB connector');
      }
      if (connectorRegistry) {
        adsbConnectorInstance.setConnectorRegistry(connectorRegistry);
        logger.info('Connected connector registry to ADSB connector');
      }
    }

    if (!radarConnectorInstance) {
      // Only auto-create if not already configured in config file
      const existingRadarConnectors = connectorRegistry.getConnectors().filter(c => c.type === 'radar');
      if (existingRadarConnectors.length === 0) {
        logger.info('Auto-creating Radar connector...');
        const radarConfig = {
            id: 'radar-main',
            type: 'radar',
            name: 'Main Radar',
            description: 'Primary radar display service',
            enabled: true,
        };
        await connectorRegistry.createConnector(radarConfig);
        radarConnectorInstance = connectorRegistry.getConnector('radar-main');
      } else {
        radarConnectorInstance = existingRadarConnectors[0];
        logger.info('Using existing Radar connector from config');
      }
    }

    // Initialize radar connector with its dependencies
    if (radarConnectorInstance && adsbConnectorInstance && airportVectorService && coastlineVectorService) {
      radarConnectorInstance.initialize({
        adsbConnector: adsbConnectorInstance,
        airportVectorService: airportVectorService,
        coastlineVectorService: coastlineVectorService,
        airspaceService: airspaceService,
      });
      logger.info('Radar connector initialized with its dependencies.');
    } else {
        logger.warn('Could not initialize radar connector due to missing dependencies.');
    }
    
    // Make the instance available to the rest of the app
    radarConnector = radarConnectorInstance;
    
    // Ensure radarConnector is properly initialized
    if (!radarConnector) {
      logger.error('Radar connector failed to initialize properly');
      radarConnector = null;
    } else {
      logger.info('Radar connector successfully assigned to global variable');
    }

    // Auto-create Prestwick Airport connector
    let prestwickConnectorInstance = connectorRegistry.getConnector('prestwick-airport-main');
    if (!prestwickConnectorInstance) {
      // Only auto-create if not already configured in config file
      const existingPrestwickConnectors = connectorRegistry.getConnectors().filter(c => c.type === 'prestwick-airport');
      if (existingPrestwickConnectors.length === 0) {
        logger.info('Auto-creating Prestwick Airport connector...');
        const prestwickConfig = {
          id: 'prestwick-airport-main',
          type: 'prestwick-airport',
          name: 'Prestwick Airport',
          description: 'Prestwick Airport (EGPK) aircraft operations tracking',
          enabled: true,
          config: {
            prestwick: {
              approachRadius: 50000, // 50km
              runwayThreshold: 5000  // 5km
            }
          }
        };
        await connectorRegistry.createConnector(prestwickConfig);
        prestwickConnectorInstance = connectorRegistry.getConnector('prestwick-airport-main');
      } else {
        prestwickConnectorInstance = existingPrestwickConnectors[0];
        logger.info('Using existing Prestwick Airport connector from config');
      }
    }

    // Initialize Prestwick Airport connector with its dependencies
    if (prestwickConnectorInstance && adsbConnectorInstance) {
      // Set dependencies through existing setter methods
      if (prestwickConnectorInstance.setEventBus) {
        prestwickConnectorInstance.setEventBus(eventBus);
      }
      if (prestwickConnectorInstance.setConnectorRegistry) {
        prestwickConnectorInstance.setConnectorRegistry(connectorRegistry);
      }
      logger.info('Prestwick Airport connector initialized with its dependencies.');
    } else {
      logger.warn('Could not initialize Prestwick Airport connector due to missing dependencies.');
    }

    // Auto-create Remotion connector
    let remotionConnectorInstance = connectorRegistry.getConnector('remotion-main');
    if (!remotionConnectorInstance) {
      // Only auto-create if not already configured in config file
      const existingRemotionConnectors = connectorRegistry.getConnectors().filter(c => c.type === 'remotion');
      if (existingRemotionConnectors.length === 0) {
        logger.info('Auto-creating Remotion connector...');
        const remotionConfig = {
          id: 'remotion-main',
          type: 'remotion',
          name: 'Main Remotion',
          description: 'Primary video rendering service for flight paths and timelines',
          enabled: true,
          config: {
            outputDir: './renders',
            templatesDir: './templates',
            remotionProjectDir: './remotion-project',
            defaultFps: 30,
            defaultDuration: 15,
            quality: 'high',
            enableAudio: true,
            enableSubtitles: true,
            autoRenderEnabled: true
          }
        };
        await connectorRegistry.createConnector(remotionConfig);
        remotionConnectorInstance = connectorRegistry.getConnector('remotion-main');
      } else {
        remotionConnectorInstance = existingRemotionConnectors[0];
        logger.info('Using existing Remotion connector from config');
      }
    }

    // Initialize Remotion connector with its dependencies
    if (remotionConnectorInstance) {
      // Set dependencies through existing setter methods
      if (remotionConnectorInstance.setEventBus) {
        remotionConnectorInstance.setEventBus(eventBus);
      }
      if (remotionConnectorInstance.setConnectorRegistry) {
        remotionConnectorInstance.setConnectorRegistry(connectorRegistry);
      }
      logger.info('Remotion connector initialized with its dependencies.');
    } else {
      logger.warn('Could not initialize Remotion connector due to missing dependencies.');
    }

    // Auto-register Web GUI and Map connectors
    await autoRegisterGuiAndMapConnectors();

    // Set entity manager reference for connectors that support it
    connectorRegistry.getConnectors().forEach(connector => {
      if (connector.setEntityManager) {
        connector.setEntityManager(entityManager);
      }
      // Set EventBus reference for connectors that support it
      if (connector.setEventBus && eventBus) {
        connector.setEventBus(eventBus);
      }
      // Set ConnectorRegistry reference for connectors that support it
      if (connector.setConnectorRegistry) {
        connector.setConnectorRegistry(connectorRegistry);
      }
    });
    
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
    
    // Initialize layout manager
    await layoutManager.initialize();
    
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
    
    // Load default rules
    if (ruleEngine) {
      // Handle new defaultRules structure (object) vs old structure (array)
      const rulesArray = Array.isArray(defaultRules) ? defaultRules : [];
      ruleEngine.loadRules(rulesArray);
      logger.info(`Loaded ${rulesArray.length} default rules`);
    }
    
    // Connect all connectors
    const connectionResults = await connectorRegistry.connectAll();
    logger.info(`Connected ${connectionResults.filter(r => r.status === 'connected').length} connectors`);
    
    // Start event processing
    eventProcessor.start();
    
    // Set up API routes
    injectServices({
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
      mapIntegrationService,
      layoutManager,
      guiEditor,
      speedCalculationService,
      speedCalculationConnector,
      radarConnector,
      airspaceService,
      vectorOptimizationService,
      aircraftDataService,
      squawkCodeService
    });
    
    // Set up GUI routes
    injectGuiServices({
      layoutManager,
      guiEditor,
      connectorRegistry
    });

    // Set up radar routes
    injectRadarServices({
      radarConnector,
      adsbConnector: connectorRegistry.getConnector('adsb-main'),
      connectorRegistry,
      airportVectorService,
      airspaceService,
      vectorOptimizationService
    });

    // Set up history routes
    injectHistoryServices({
      adsbConnector: connectorRegistry.getConnector('adsb-main'),
      connectorRegistry,
      aircraftDataService,
      airspaceService,
      squawkCodeService,
      remotionConnector: connectorRegistry.getConnector('remotion-main')
    });

    // Set up Overwatch routes
    injectOverwatchServices({
      connectorRegistry
    });

    // Set up Prestwick Airport routes
    injectPrestwickServices({
      connectorRegistry,
      eventBus
    });

    // Mount Overwatch API routes at the path the frontend expects
    app.use('/api/overwatch', overwatchRouter);

    // Mount Prestwick Airport routes
    app.use('/api/prestwick', prestwickRouter);

    // Mount history routes
    app.use('/history', historyRouter);
    
    // Mount map routes with lenient rate limiting
    app.use('/api/map', securityMiddleware.getMapRateLimiter(), mapRouter);
    app.use('/map', securityMiddleware.getMapRateLimiter(), mapRouter);
    
    // Mount GUI routes
    app.use('/gui', guiRouter);
    
    // Mount health routes
    app.use('/health', healthRouter);
    
    // Mount API routes
    app.use('/api', apiRouter);
    
    // Mount analytics routes
    app.use('/api/analytics', analyticsRouter);
    
    // Mount speed calculation routes
    app.use('/api', speedRouter);
    
    // Mount radar routes
    app.use('/radar', radarRouter);
    
    // Mount flow routes
    app.use('/api/flows', require('./routes/flows'));
    app.use('/flows', require('./routes/flows-gui'));

    // Mount Overwatch routes
    app.use('/overwatch', overwatchRouter);
    
    // Mount camera location management routes
    app.use('/api/cameras', require('./routes/cameras'));

    // Mount telegram routes
    app.use('/api/telegram', telegramRouter);

    // Mount alarm manager routes
    app.use('/alarms', alarmRouter);

    // Mount UniFi Protect routes
    app.use('/unifi', unifiRouter);

    // Mount display routes
    app.use('/display', displayRouter);

    // Mount RTSP transcoding routes
    app.get('/api/transcoding/status', async (req, res) => {
      try {
        const status = transcodingService.getStatus();
        res.json({
          success: true,
          data: status
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.get('/api/transcoding/cameras', async (req, res) => {
      try {
        const cameras = await transcodingService.discoverCameras();
        res.json({
          success: true,
          data: cameras,
          count: cameras.length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/api/transcoding/start/:cameraId', async (req, res) => {
      try {
        const { cameraId } = req.params;
        await transcodingService.startTranscoding(cameraId);
        res.json({ 
          success: true, 
          message: `Started transcoding for ${cameraId}` 
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/api/transcoding/stop/:cameraId', async (req, res) => {
      try {
        const { cameraId } = req.params;
        transcodingService.stopTranscoding(cameraId);
        res.json({ 
          success: true, 
          message: `Stopped transcoding for ${cameraId}` 
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/api/transcoding/start-all', async (req, res) => {
      try {
        await transcodingService.startAll();
        res.json({ 
          success: true, 
          message: 'Started all transcoding' 
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/api/transcoding/stop-all', async (req, res) => {
      try {
        transcodingService.stopAll();
        res.json({ 
          success: true, 
          message: 'Stopped all transcoding' 
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    app.post('/api/transcoding/refresh', async (req, res) => {
      try {
        await transcodingService.refreshCameras();
        res.json({ 
          success: true, 
          message: 'Camera discovery refreshed' 
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Serve HLS streams
    app.use('/streams', express.static(path.join(__dirname, 'public', 'streams')));

    // Serve Overwatch dashboard at /overwatch and /overwatch/
    app.get(['/overwatch', '/overwatch/'], (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'overwatch.html'));
    });

    // Serve camera locations management page
    app.get(['/camera-locations', '/camera-locations/'], (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'camera-locations.html'));
    });

    // Make services available to API routes via app.locals
    app.locals.connectorRegistry = connectorRegistry;
    app.locals.eventBus = eventBus;
    app.locals.ruleEngine = ruleEngine;
    app.locals.actionFramework = actionFramework;
    app.locals.flowOrchestrator = flowOrchestrator;
    app.locals.entityManager = entityManager;
    app.locals.analyticsEngine = analyticsEngine;
    app.locals.dashboardService = dashboardService;
    app.locals.layoutManager = layoutManager;
    app.locals.guiEditor = guiEditor;
    app.locals.mapIntegrationService = mapIntegrationService;
    app.locals.healthMonitor = healthMonitor;
    app.locals.flowBuilder = flowBuilder;
    app.locals.logger = logger;
    
    // Initialize speed calculation routes
    new SpeedRoutes({
      speedCalculationConnector,
      mapConnector: connectorRegistry.getConnector('main-map'),
      unifiConnector: connectorRegistry.getConnector('unifi-protect-main')
    });

    // Initialize health routes
    new HealthRoutes({
      healthMonitor,
      databaseService: null, // Will be added when database service is enhanced
      connectorRegistry
    });

    // Add error handling middleware
    app.use(securityMiddleware.errorHandler());
    
    // Initialize Flow Builder
    await flowBuilder.initialize();

    // Connect EventBus with Flow Builder
    eventBus.flowBuilder = flowBuilder;
    global.flowBuilder = flowBuilder;
    global.actionFramework = actionFramework;
    global.eventBus = eventBus;
    global.connectorRegistry = connectorRegistry;

    // Set up event listeners for flow execution
    flowBuilder.on('action:execute', async (data) => {
      const { actionType, parameters, nodeId, flowId } = data;
      
      try {
        // Execute the action using the action framework
        const actionFramework = app.locals.actionFramework;
        if (actionFramework) {
          const result = await actionFramework.executeAction(actionType, parameters);
          console.log(`Flow ${flowId} executed action ${actionType}:`, result);
        }
      } catch (error) {
        console.error(`Error executing flow action ${actionType}:`, error);
      }
    });
    
    // Start server
    server.listen(config.server.port, config.server.host, () => {
      logger.info(`🚀 Babelfish Looking Glass server running on http://${config.server.host}:${config.server.port}`);
      logger.info(`📡 WebSocket available at ws://${config.server.host}:${config.server.port}`);
      logger.info(`🔍 Health check: http://${config.server.host}:${config.server.port}/health`);
      logger.info(`📊 Metrics: http://${config.server.host}:${config.server.port}/health/metrics`);
      logger.info(`🌐 Web UI: http://${config.server.host}:${config.server.port}`);
      logger.info(`🔧 Environment: ${config.server.environment}`);
      logger.info(`🔌 Connector API: http://${config.server.host}:${config.server.port}/api/connectors`);
      logger.info(`📊 Analytics API: http://${config.server.host}:${config.server.port}/api/analytics`);
      logger.info(`📈 Dashboard API: http://${config.server.host}:${config.server.port}/api/analytics/dashboard`);
      logger.info(`🚗 Speed Calculation API: http://${config.server.host}:${config.server.port}/api/speed`);
      logger.info(`🛩️ Radar API: http://${config.server.host}:${config.server.port}/radar`);
      logger.info(`📊 Flight History: http://${config.server.host}:${config.server.port}/history`);
      logger.info(`🔍 Overwatch API: http://${config.server.host}:${config.server.port}/overwatch`);
      logger.info(`🚨 Alarm Manager: http://${config.server.host}:${config.server.port}/alarms`);
      logger.info(`📺 Display Manager: http://${config.server.host}:${config.server.port}/display`);
      logger.info(`📹 RTSP Transcoding: http://${config.server.host}:${config.server.port}/api/transcoding/status`);
      logger.info(`🎥 Camera Streams: http://${config.server.host}:${config.server.port}/streams/`);
      
      if (mqttBroker) {
        logger.info(`📨 MQTT broker connected to localhost:1883`);
      }
      
      // Set up Overwatch WebSocket for event streaming
      setupEventStreamWebSocket(server);
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