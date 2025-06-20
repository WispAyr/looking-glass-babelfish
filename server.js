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

// Import default rules
const defaultRules = require('./config/defaultRules');

// Import connector system
const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const UnifiProtectConnector = require('./connectors/types/UnifiProtectConnector');
const MqttConnector = require('./connectors/types/MqttConnector');

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

// Initialize entity manager
const entityManager = new EntityManager(config.entities || {}, logger);

// Initialize connector registry
const connectorRegistry = new ConnectorRegistry(logger);

// Register connector types
connectorRegistry.registerType('unifi-protect', UnifiProtectConnector);
connectorRegistry.registerType('mqtt', MqttConnector);

// Initialize the registry to load connectors from config
connectorRegistry.initialize();

// Set entity manager reference for connectors that support it
connectorRegistry.getConnectors().forEach(connector => {
  if (connector.setEntityManager) {
    connector.setEntityManager(entityManager);
  }
});

// Initialize services
const cache = new Cache(config.cache);
const unifiAPI = new UnifiProtectAPI(config.unifi, logger);
const eventProcessor = new EventProcessor(config.events, logger);
let mqttBroker = null;

if (config.mqtt.enabled) {
  mqttBroker = new MQTTBroker(config.mqtt, logger);
}

// Initialize flow system (if enabled)
let eventBus = null;
let ruleEngine = null;
let actionFramework = null;
let flowOrchestrator = null;

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

// Handle connector events (including WebSocket events)
connectorRegistry.on('connector:event', (event) => {
  // Process the event through the event processor
  eventProcessor.processEvent(event);
  
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

// Handle entity events
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

// Handle camera-specific events from UniFi connector
connectorRegistry.on('motion:detected', (data) => {
  logger.info(`Motion detected on camera: ${data.cameraId}`);
  broadcastToClients('motionDetected', data);
  
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

connectorRegistry.on('discovery:completed', (data) => {
  logger.info(`Camera discovery completed: ${data.camerasFound} cameras found`);
  broadcastToClients('discoveryCompleted', data);
});

connectorRegistry.on('discovery:error', (data) => {
  logger.error(`Camera discovery error: ${data.error}`);
  broadcastToClients('discoveryError', data);
});

connectorRegistry.on('connector:websocket:connected', (data) => {
  logger.info(`Connector WebSocket connected: ${data.connectorId}`);
  broadcastToClients('connectorWebSocketConnected', data);
});

connectorRegistry.on('connector:websocket:disconnected', (data) => {
  logger.warn(`Connector WebSocket disconnected: ${data.connectorId}`);
  broadcastToClients('connectorWebSocketDisconnected', data);
});

connectorRegistry.on('connector:websocket:error', (data) => {
  logger.error(`Connector WebSocket error: ${data.connectorId}`, data.error);
  broadcastToClients('connectorWebSocketError', data);
});

// Inject services into API routes
injectServices({
  unifiAPI,
  eventProcessor,
  mqttBroker,
  cache,
  connectorRegistry,
  entityManager
});

// Create Express app
const app = express();
const server = http.createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: config.server.cors.origin,
    credentials: config.server.cors.credentials
  }
});

// Middleware
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

if (config.security.helmet.enabled) {
  app.use(helmet(config.security.helmet));
}

app.use(cors(config.server.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Babelfish Looking Glass',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.server.environment,
    uptime: process.uptime()
  });
});

// Connector Management API Endpoints
app.get('/api/connectors', async (req, res) => {
  try {
    const connectors = connectorRegistry.getConnectors().map(connector => ({
      id: connector.id,
      type: connector.type,
      name: connector.name,
      description: connector.description,
      status: connector.status,
      capabilities: connector.getEnabledCapabilities().map(cap => cap.id),
      stats: connector.stats
    }));
    
    res.json({
      success: true,
      connectors
    });
  } catch (error) {
    logger.error('Error getting connectors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Entity Management API Endpoints
app.get('/api/entities', async (req, res) => {
  try {
    const { type, source, connectorId, status, limit } = req.query;
    const filter = {};
    
    if (type) filter.type = type;
    if (source) filter.source = source;
    if (connectorId) filter.connectorId = connectorId;
    if (status) filter.status = status;
    if (limit) filter.limit = parseInt(limit);
    
    const entities = entityManager.getEntities(filter);
    
    res.json({
      success: true,
      entities,
      count: entities.length
    });
  } catch (error) {
    logger.error('Error getting entities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/entities/stats', async (req, res) => {
  try {
    const stats = entityManager.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting entity stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/entities/:id', async (req, res) => {
  try {
    const entity = entityManager.getEntity(req.params.id);
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found'
      });
    }
    
    res.json({
      success: true,
      entity
    });
  } catch (error) {
    logger.error('Error getting entity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/entities', async (req, res) => {
  try {
    const entity = await entityManager.createEntity(req.body);
    
    res.json({
      success: true,
      entity
    });
  } catch (error) {
    logger.error('Error creating entity:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/entities/:id', async (req, res) => {
  try {
    const entity = await entityManager.updateEntity(req.params.id, req.body);
    
    res.json({
      success: true,
      entity
    });
  } catch (error) {
    logger.error('Error updating entity:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/entities/:id', async (req, res) => {
  try {
    const entity = await entityManager.deleteEntity(req.params.id);
    
    res.json({
      success: true,
      entity,
      message: 'Entity deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting entity:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/entities/discovery', async (req, res) => {
  try {
    await entityManager.performAutoDiscovery();
    
    res.json({
      success: true,
      message: 'Entity discovery initiated'
    });
  } catch (error) {
    logger.error('Error initiating entity discovery:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/entities/discovery/start', async (req, res) => {
  try {
    entityManager.startAutoDiscovery();
    
    res.json({
      success: true,
      message: 'Entity auto-discovery started'
    });
  } catch (error) {
    logger.error('Error starting entity auto-discovery:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/entities/discovery/stop', async (req, res) => {
  try {
    entityManager.stopAutoDiscovery();
    
    res.json({
      success: true,
      message: 'Entity auto-discovery stopped'
    });
  } catch (error) {
    logger.error('Error stopping entity auto-discovery:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Specific routes must come before parameterized routes
app.get('/api/connectors/types', async (req, res) => {
  try {
    const types = connectorRegistry.getTypes();
    
    res.json({
      success: true,
      types
    });
  } catch (error) {
    logger.error('Error getting connector types:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/connectors/status', async (req, res) => {
  try {
    const status = connectorRegistry.getStatus();
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error('Error getting connector status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/connectors/matches', async (req, res) => {
  try {
    const { sourceCapability, targetCapability } = req.query;
    
    if (!sourceCapability || !targetCapability) {
      return res.status(400).json({
        success: false,
        error: 'sourceCapability and targetCapability are required'
      });
    }
    
    const matches = connectorRegistry.findCapabilityMatches(sourceCapability, targetCapability);
    
    res.json({
      success: true,
      sourceCapability,
      targetCapability,
      matches
    });
  } catch (error) {
    logger.error('Error finding capability matches:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/connectors/capabilities/:capabilityId', async (req, res) => {
  try {
    const connectors = connectorRegistry.findConnectorsByCapability(req.params.capabilityId);
    
    res.json({
      success: true,
      capabilityId: req.params.capabilityId,
      connectors
    });
  } catch (error) {
    logger.error('Error finding connectors by capability:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/connectors/:id', async (req, res) => {
  try {
    const connector = connectorRegistry.getConnector(req.params.id);
    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Connector not found'
      });
    }
    
    res.json({
      success: true,
      connector: {
        id: connector.id,
        type: connector.type,
        name: connector.name,
        description: connector.description,
        status: connector.getStatus(),
        capabilities: connector.getCapabilities(),
        config: connector.config
      }
    });
  } catch (error) {
    logger.error('Error getting connector:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/connectors', async (req, res) => {
  try {
    const connector = await connectorRegistry.createConnector(req.body);
    
    res.status(201).json({
      success: true,
      connector: {
        id: connector.id,
        type: connector.type,
        name: connector.name,
        status: connector.status
      }
    });
  } catch (error) {
    logger.error('Error creating connector:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/connectors/:id', async (req, res) => {
  try {
    const connector = await connectorRegistry.updateConnector(req.params.id, req.body);
    
    res.json({
      success: true,
      connector: {
        id: connector.id,
        type: connector.type,
        name: connector.name,
        status: connector.status
      }
    });
  } catch (error) {
    logger.error('Error updating connector:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/connectors/:id', async (req, res) => {
  try {
    await connectorRegistry.removeConnector(req.params.id);
    
    res.json({
      success: true,
      message: 'Connector removed successfully'
    });
  } catch (error) {
    logger.error('Error removing connector:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/connectors/:id/connect', async (req, res) => {
  try {
    const connector = connectorRegistry.getConnector(req.params.id);
    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Connector not found'
      });
    }
    
    await connector.connect();
    
    res.json({
      success: true,
      status: connector.status
    });
  } catch (error) {
    logger.error('Error connecting connector:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/connectors/:id/disconnect', async (req, res) => {
  try {
    const connector = connectorRegistry.getConnector(req.params.id);
    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Connector not found'
      });
    }
    
    await connector.disconnect();
    
    res.json({
      success: true,
      status: connector.status
    });
  } catch (error) {
    logger.error('Error disconnecting connector:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/connectors/:id/execute', async (req, res) => {
  try {
    const { capabilityId, operation, parameters } = req.body;
    
    if (!capabilityId || !operation) {
      return res.status(400).json({
        success: false,
        error: 'capabilityId and operation are required'
      });
    }
    
    const connector = connectorRegistry.getConnector(req.params.id);
    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Connector not found'
      });
    }
    
    const result = await connector.execute(capabilityId, operation, parameters || {});
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Error executing connector operation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Flow System API Endpoints (if enabled)
if (config.flow.enabled) {
  // Get flow system status
  app.get('/api/flows/status', async (req, res) => {
    try {
      const status = {
        eventBus: eventBus?.getStats(),
        ruleEngine: ruleEngine?.getStats(),
        actionFramework: actionFramework?.getStats(),
        orchestrator: flowOrchestrator?.getStats()
      };
      
      res.json({
        success: true,
        status
      });
    } catch (error) {
      logger.error('Error getting flow status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get connector WebSocket status
  app.get('/api/connectors/:id/websocket/status', async (req, res) => {
    try {
      const connector = connectorRegistry.getConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({
          success: false,
          error: 'Connector not found'
        });
      }

      const status = connector.getWebSocketStatus ? connector.getWebSocketStatus() : null;
      
      res.json({
        success: true,
        connectorId: req.params.id,
        connectorType: connector.type,
        websocketEnabled: !!connector.getWebSocketStatus,
        status
      });
    } catch (error) {
      logger.error('Error getting connector WebSocket status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get all flows
  app.get('/api/flows', async (req, res) => {
    try {
      const flows = flowOrchestrator.getFlows();
      
      res.json({
        success: true,
        flows
      });
    } catch (error) {
      logger.error('Error getting flows:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get flow by ID
  app.get('/api/flows/:id', async (req, res) => {
    try {
      const flow = flowOrchestrator.getFlow(req.params.id);
      if (!flow) {
        return res.status(404).json({
          success: false,
          error: 'Flow not found'
        });
      }
      
      res.json({
        success: true,
        flow
      });
    } catch (error) {
      logger.error('Error getting flow:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Create new flow
  app.post('/api/flows', async (req, res) => {
    try {
      const flowId = flowOrchestrator.createFlow(req.body);
      
      res.status(201).json({
        success: true,
        flowId
      });
    } catch (error) {
      logger.error('Error creating flow:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Update flow
  app.put('/api/flows/:id', async (req, res) => {
    try {
      const flow = flowOrchestrator.updateFlow(req.params.id, req.body);
      
      res.json({
        success: true,
        flow
      });
    } catch (error) {
      logger.error('Error updating flow:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Delete flow
  app.delete('/api/flows/:id', async (req, res) => {
    try {
      await flowOrchestrator.deleteFlow(req.params.id);
      
      res.json({
        success: true,
        message: 'Flow deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting flow:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Execute flow
  app.post('/api/flows/:id/execute', async (req, res) => {
    try {
      const results = await flowOrchestrator.executeFlow(req.params.id, req.body);
      
      res.json({
        success: true,
        results
      });
    } catch (error) {
      logger.error('Error executing flow:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get all rules
  app.get('/api/rules', async (req, res) => {
    try {
      const rules = ruleEngine.getRules();
      
      res.json({
        success: true,
        rules
      });
    } catch (error) {
      logger.error('Error getting rules:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get rule by ID
  app.get('/api/rules/:id', async (req, res) => {
    try {
      const rule = ruleEngine.getRule(req.params.id);
      if (!rule) {
        return res.status(404).json({
          success: false,
          error: 'Rule not found'
        });
      }
      
      res.json({
        success: true,
        rule
      });
    } catch (error) {
      logger.error('Error getting rule:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Create new rule
  app.post('/api/rules', async (req, res) => {
    try {
      const ruleId = ruleEngine.registerRule(req.body);
      
      res.status(201).json({
        success: true,
        ruleId
      });
    } catch (error) {
      logger.error('Error creating rule:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Update rule
  app.put('/api/rules/:id', async (req, res) => {
    try {
      const rule = ruleEngine.updateRule(req.params.id, req.body);
      
      res.json({
        success: true,
        rule
      });
    } catch (error) {
      logger.error('Error updating rule:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Delete rule
  app.delete('/api/rules/:id', async (req, res) => {
    try {
      await ruleEngine.removeRule(req.params.id);
      
      res.json({
        success: true,
        message: 'Rule deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting rule:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Enable/disable rule
  app.post('/api/rules/:id/enable', async (req, res) => {
    try {
      const { enabled } = req.body;
      const rule = ruleEngine.setRuleEnabled(req.params.id, enabled);
      
      res.json({
        success: true,
        rule
      });
    } catch (error) {
      logger.error('Error enabling/disabling rule:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get available actions
  app.get('/api/actions', async (req, res) => {
    try {
      const actions = actionFramework.getAvailableActions();
      
      res.json({
        success: true,
        actions
      });
    } catch (error) {
      logger.error('Error getting actions:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get action statistics
  app.get('/api/actions/stats', async (req, res) => {
    try {
      const stats = actionFramework.getStats();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Error getting action stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}

// API Routes
app.use('/api/v1', apiRouter);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);
  
  // Send initial data to new client
  socket.emit('connected', {
    id: socket.id,
    timestamp: new Date().toISOString(),
    message: 'Connected to Babelfish Looking Glass'
  });

  // Handle client disconnection
  socket.on('disconnect', () => {
    logger.info(`WebSocket client disconnected: ${socket.id}`);
  });

  // Handle client requests
  socket.on('getDevices', async () => {
    try {
      const devices = await unifiAPI.getDevices();
      socket.emit('devices', devices);
    } catch (error) {
      logger.error('Error getting devices:', error);
      socket.emit('error', { message: 'Failed to get devices' });
    }
  });

  socket.on('getEvents', async (data) => {
    try {
      const events = await unifiAPI.getEvents(data);
      socket.emit('events', events);
    } catch (error) {
      logger.error('Error getting events:', error);
      socket.emit('error', { message: 'Failed to get events' });
    }
  });

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

// Broadcast function for real-time updates
function broadcastToClients(event, data) {
  io.emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
}

// Connector event handling
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

// Event processing and broadcasting
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

// Start server
async function startServer() {
  try {
    logger.info('Starting Babelfish Looking Glass server...');
    
    // Initialize services
    await cache.initialize();
    await unifiAPI.initialize();
    await eventProcessor.initialize();
    
    if (mqttBroker) {
      await mqttBroker.initialize();
    }
    
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
    
    // Auto-discover connector types
    await connectorRegistry.autoDiscoverTypes();
    
    // Connect all connectors
    const connectionResults = await connectorRegistry.connectAll();
    logger.info(`Connected ${connectionResults.filter(r => r.status === 'connected').length} connectors`);
    
    // Start event processing
    eventProcessor.start();
    
    // Start server
    server.listen(config.server.port, config.server.host, () => {
      logger.info(`🚀 Babelfish Looking Glass server running on http://${config.server.host}:${config.server.port}`);
      logger.info(`📡 WebSocket available at ws://${config.server.host}:${config.server.port}`);
      logger.info(`🔍 Health check: http://${config.server.host}:${config.server.port}/health`);
      logger.info(`🌐 Web UI: http://${config.server.host}:${config.server.port}`);
      logger.info(`🔧 Environment: ${config.server.environment}`);
      logger.info(`🔌 Connector API: http://${config.server.host}:${config.server.port}/api/connectors`);
      
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
  
  eventProcessor.stop();
  
  // Disconnect all connectors
  await connectorRegistry.disconnectAll();
  
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
  
  eventProcessor.stop();
  
  // Disconnect all connectors
  await connectorRegistry.disconnectAll();
  
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