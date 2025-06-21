const express = require('express');
const router = express.Router();
const winston = require('winston');

// Create logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'babelfish' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Import services (these will be injected from the main server)
let unifiAPI, eventProcessor, mqttBroker, cache, connectorRegistry, entityManager, analyticsEngine, dashboardService, flowOrchestrator;

// Middleware to inject services
function injectServices(services) {
  unifiAPI = services.unifiAPI;
  eventProcessor = services.eventProcessor;
  mqttBroker = services.mqttBroker;
  cache = services.cache;
  connectorRegistry = services.connectorRegistry;
  entityManager = services.entityManager;
  analyticsEngine = services.analyticsEngine;
  dashboardService = services.dashboardService;
  flowOrchestrator = services.flowOrchestrator;
}

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Babelfish API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// System endpoints
router.get('/system/info', (req, res) => {
  try {
    const info = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      timestamp: new Date().toISOString()
    };
    res.json({ success: true, data: info });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Connectors endpoints
router.get('/connectors', (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(500).json({ success: false, error: 'Connector Registry not initialized' });
    }
    const connectors = connectorRegistry.getConnectors();
    const data = connectors.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      description: c.description,
      status: c.getStatus(),
      config: c.config,
    }));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/connectors/:connectorId', (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    const connector = connectorRegistry.getConnectorById(req.params.connectorId);
    if (!connector) {
      return res.status(404).json({ success: false, error: 'Connector not found' });
    }
    const data = {
      id: connector.id,
      name: connector.name,
      type: connector.type,
      description: connector.description,
      status: connector.getStatus(),
      config: connector.config,
      capabilities: connector.getCapabilities(),
    };
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Devices endpoint (summary of all devices from all connectors)
router.get('/devices', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    let allDevices = [];
    const connectors = connectorRegistry.getConnectors();

    for (const connector of connectors) {
      // Treat cameras as devices for now
      if (typeof connector.listCameras === 'function') {
        const cameras = await connector.listCameras();
        allDevices = allDevices.concat(cameras.map(d => ({ ...d, connectorId: connector.id, deviceType: 'camera' })));
      }
    }

    res.json({ success: true, count: allDevices.length, data: allDevices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cameras endpoints
router.get('/cameras', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    let allCameras = [];
    const connectors = connectorRegistry.getConnectors();
    for (const connector of connectors) {
      if (typeof connector.listCameras === 'function') {
        const cameras = await connector.listCameras();
        allCameras = allCameras.concat(cameras.map(c => ({ ...c, connectorId: connector.id })));
      }
    }
    res.json({ success: true, count: allCameras.length, data: allCameras });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/cameras/:cameraId', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    const { cameraId } = req.params;
    const { connectorId } = req.query;

    if (connectorId) {
      const connector = connectorRegistry.getConnectorById(connectorId);
      if (connector && typeof connector.getCamera === 'function') {
        const camera = await connector.getCamera(cameraId);
        if (camera) {
          return res.json({ success: true, data: { ...camera, connectorId: connector.id } });
        }
      }
    } else {
       const connectors = connectorRegistry.getConnectors();
       for (const connector of connectors) {
         if (typeof connector.getCamera === 'function') {
           const camera = await connector.getCamera(cameraId);
           if (camera) {
             return res.json({ success: true, data: { ...camera, connectorId: connector.id } });
           }
         }
       }
    }
    
    return res.status(404).json({ success: false, error: 'Camera not found' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/cameras/:cameraId/snapshot', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const { connectorId } = req.query;
    const connectorRegistry = req.app.locals.connectorRegistry;
    
    const connector = connectorRegistry.getConnectorById(connectorId);

    if (!connector || typeof connector.getCameraSnapshot !== 'function') {
      return res.status(404).json({ success: false, error: 'Snapshot function not available for this camera or connector.' });
    }

    const snapshot = await connector.getCameraSnapshot({ cameraId });
    
    res.set('Content-Type', 'image/jpeg');
    res.send(snapshot);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Events endpoints
router.get('/events', async (req, res) => {
  try {
    const eventProcessor = req.app.locals.eventProcessor;
    const events = eventProcessor.getEvents(req.query);
    res.json({ success: true, count: events.length, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rules endpoints
router.get('/rules', (req, res) => {
  try {
    const ruleEngine = req.app.locals.ruleEngine;
    if (!ruleEngine) {
      return res.status(500).json({ success: false, error: 'Rule Engine not initialized' });
    }
    const rules = ruleEngine.getRules();
    res.json({ success: true, count: rules.length, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rules', (req, res) => {
  try {
    const ruleEngine = req.app.locals.ruleEngine;
    const rule = ruleEngine.createRule(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/rules/:ruleId', (req, res) => {
  try {
    const ruleEngine = req.app.locals.ruleEngine;
    const rule = ruleEngine.updateRule(req.params.ruleId, req.body);
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/rules/:ruleId', (req, res) => {
  try {
    const ruleEngine = req.app.locals.ruleEngine;
    const success = ruleEngine.deleteRule(req.params.ruleId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Flows endpoints
router.get('/flows', (req, res) => {
  try {
    const flowOrchestrator = req.app.locals.flowOrchestrator;
    if (!flowOrchestrator) {
      return res.status(500).json({ success: false, error: 'Flow Orchestrator not initialized' });
    }
    const flows = flowOrchestrator.getFlows();
    res.json({ success: true, count: flows.length, data: flows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analytics endpoints
router.get('/analytics', async (req, res) => {
  try {
    if (!analyticsEngine) {
      return res.status(500).json({ success: false, error: 'Analytics Engine not initialized' });
    }
    const analytics = analyticsEngine.getAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    logger.error('Error getting analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Smart detection analytics
router.get('/analytics/smart-detections', async (req, res) => {
  try {
    if (!analyticsEngine || !entityManager) {
      return res.status(500).json({ success: false, error: 'Analytics Engine or Entity Manager not initialized' });
    }
    
    const { cameraId, objectType, limit = 20 } = req.query;
    
    if (cameraId) {
      const analytics = analyticsEngine.getSmartDetectionAnalytics(cameraId);
      res.json({ success: true, data: analytics });
    } else {
      const allAnalytics = {};
      const cameras = entityManager.getEntities({ type: 'camera' });
      
      for (const camera of cameras) {
        allAnalytics[camera.id] = analyticsEngine.getSmartDetectionAnalytics(camera.id);
      }
      
      res.json({ success: true, data: allAnalytics });
    }
  } catch (error) {
    logger.error('Error getting smart detection analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Audio detection analytics
router.get('/analytics/audio-detections', async (req, res) => {
  try {
    if (!analyticsEngine || !entityManager) {
      return res.status(500).json({ success: false, error: 'Analytics Engine or Entity Manager not initialized' });
    }
    
    const { cameraId } = req.query;
    
    if (cameraId) {
      const analytics = analyticsEngine.getAudioDetectionAnalytics(cameraId);
      res.json({ success: true, data: analytics });
    } else {
      const allAnalytics = {};
      const cameras = entityManager.getEntities({ type: 'camera' });
      
      for (const camera of cameras) {
        allAnalytics[camera.id] = analyticsEngine.getAudioDetectionAnalytics(camera.id);
      }
      
      res.json({ success: true, data: allAnalytics });
    }
  } catch (error) {
    logger.error('Error getting audio detection analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generic event analytics
router.get('/analytics/generic-events', async (req, res) => {
  try {
    if (!analyticsEngine || !entityManager) {
      return res.status(500).json({ success: false, error: 'Analytics Engine or Entity Manager not initialized' });
    }
    
    const { cameraId } = req.query;
    
    if (cameraId) {
      const analytics = analyticsEngine.getGenericEventAnalytics(cameraId);
      res.json({ success: true, data: analytics });
    } else {
      const allAnalytics = {};
      const cameras = entityManager.getEntities({ type: 'camera' });
      
      for (const camera of cameras) {
        allAnalytics[camera.id] = analyticsEngine.getGenericEventAnalytics(camera.id);
      }
      
      res.json({ success: true, data: allAnalytics });
    }
  } catch (error) {
    logger.error('Error getting generic event analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Discovered event types and fields
router.get('/discovered', async (req, res) => {
  try {
    const discovered = {
      eventTypes: [],
      fields: {},
      capabilities: [],
      autoGeneratedRules: []
    };
    
    // Get discovered event types from connectors
    if (connectorRegistry) {
      const connectors = connectorRegistry.getConnectors();
      for (const connector of connectors) {
        if (connector.discoveredEventTypes) {
          discovered.eventTypes.push(...Array.from(connector.discoveredEventTypes));
        }
        if (connector.discoveredFields) {
          for (const [eventType, fields] of connector.discoveredFields) {
            if (!discovered.fields[eventType]) {
              discovered.fields[eventType] = [];
            }
            discovered.fields[eventType].push(...Array.from(fields));
          }
        }
      }
    }
    
    // Get discovered data from analytics engine
    if (analyticsEngine) {
      const analyticsFields = analyticsEngine.getDiscoveredFieldsForAnalytics();
      for (const [eventType, fields] of Object.entries(analyticsFields)) {
        if (!discovered.fields[eventType]) {
          discovered.fields[eventType] = [];
        }
        discovered.fields[eventType].push(...fields);
      }
    }
    
    // Get discovered data from dashboard service
    if (dashboardService) {
      const dashboardEventTypes = dashboardService.getDiscoveredEventTypes();
      const dashboardFields = dashboardService.getDiscoveredFields();
      
      discovered.eventTypes.push(...dashboardEventTypes);
      for (const [eventType, fields] of Object.entries(dashboardFields)) {
        if (!discovered.fields[eventType]) {
          discovered.fields[eventType] = [];
        }
        discovered.fields[eventType].push(...fields);
      }
    }
    
    // Get discovered data from flow orchestrator
    if (flowOrchestrator) {
      const orchestratorEventTypes = flowOrchestrator.getDiscoveredEventTypes();
      const orchestratorFields = flowOrchestrator.getDiscoveredFields();
      const autoGeneratedRules = flowOrchestrator.getAutoGeneratedRules();
      
      discovered.eventTypes.push(...orchestratorEventTypes);
      for (const [eventType, fields] of Object.entries(orchestratorFields)) {
        if (!discovered.fields[eventType]) {
          discovered.fields[eventType] = [];
        }
        discovered.fields[eventType].push(...fields);
      }
      discovered.autoGeneratedRules = autoGeneratedRules;
    }
    
    // Remove duplicates
    discovered.eventTypes = [...new Set(discovered.eventTypes)];
    for (const eventType in discovered.fields) {
      discovered.fields[eventType] = [...new Set(discovered.fields[eventType])];
    }
    
    res.json({ success: true, data: discovered });
  } catch (error) {
    logger.error('Error getting discovered data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Auto-generated rules
router.get('/rules/auto-generated', async (req, res) => {
  try {
    if (!flowOrchestrator) {
      return res.json({ success: true, data: [] });
    }
    
    const autoGeneratedRules = flowOrchestrator.getAutoGeneratedRules();
    res.json({ success: true, data: autoGeneratedRules });
  } catch (error) {
    logger.error('Error getting auto-generated rules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Event type capabilities
router.get('/capabilities/:eventType', async (req, res) => {
  try {
    const { eventType } = req.params;
    const capabilities = [];
    
    // Extract capabilities from event type
    if (eventType === 'smartDetectZone' || eventType === 'smartDetectLine') {
      capabilities.push('smartDetection', 'zoneDetection', 'lineCrossing');
    } else if (eventType === 'smartAudioDetect') {
      capabilities.push('audioDetection');
    } else if (eventType === 'motion') {
      capabilities.push('motionDetection');
    }
    
    // Get discovered fields for this event type
    let discoveredFields = [];
    if (connectorRegistry) {
      const connectors = connectorRegistry.getConnectors();
      for (const connector of connectors) {
        if (connector.discoveredFields && connector.discoveredFields.has(eventType)) {
          discoveredFields.push(...Array.from(connector.discoveredFields.get(eventType)));
        }
      }
    }
    
    res.json({ 
      success: true, 
      data: {
        eventType,
        capabilities,
        discoveredFields: [...new Set(discoveredFields)]
      }
    });
  } catch (error) {
    logger.error('Error getting event type capabilities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export both the router and the inject function
module.exports = { router, injectServices }; 