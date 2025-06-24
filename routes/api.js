const express = require('express');
const router = express.Router();
const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;

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
let eventProcessor, mqttBroker, cache, connectorRegistry, entityManager, analyticsEngine, dashboardService;

// Middleware to inject services
function injectServices(services) {
  eventProcessor = services.eventProcessor;
  mqttBroker = services.mqttBroker;
  cache = services.cache;
  connectorRegistry = services.connectorRegistry;
  entityManager = services.entityManager;
  analyticsEngine = services.analyticsEngine;
  dashboardService = services.dashboardService;
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
    const connector = connectorRegistry.getConnector(req.params.connectorId);
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
      const connector = connectorRegistry.getConnector(connectorId);
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
    
    const connector = connectorRegistry.getConnector(connectorId);

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

// Import rules
router.post('/rules/import', (req, res) => {
  try {
    const ruleEngine = req.app.locals.ruleEngine;
    if (!ruleEngine) {
      return res.status(500).json({ success: false, error: 'Rule Engine not initialized' });
    }
    
    const rulesData = req.body;
    if (!Array.isArray(rulesData)) {
      return res.status(400).json({ success: false, error: 'Invalid rules data format' });
    }
    
    const importedRules = [];
    for (const ruleData of rulesData) {
      try {
        const rule = ruleEngine.createRule(ruleData);
        importedRules.push(rule);
      } catch (error) {
        console.error('Error importing rule:', error);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Imported ${importedRules.length} rules successfully`,
      data: importedRules 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export rules
router.get('/rules/export', (req, res) => {
  try {
    const ruleEngine = req.app.locals.ruleEngine;
    if (!ruleEngine) {
      return res.status(500).json({ success: false, error: 'Rule Engine not initialized' });
    }
    
    const rules = ruleEngine.getRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle rule enabled/disabled
router.post('/rules/:ruleId/toggle', (req, res) => {
  try {
    const ruleEngine = req.app.locals.ruleEngine;
    if (!ruleEngine) {
      return res.status(500).json({ success: false, error: 'Rule Engine not initialized' });
    }
    
    const { ruleId } = req.params;
    const { enabled } = req.body;
    
    const rule = ruleEngine.getRule(ruleId);
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    
    rule.enabled = enabled;
    ruleEngine.updateRule(ruleId, rule);
    
    res.json({ 
      success: true, 
      message: `Rule ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: rule 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test rule
router.post('/rules/:ruleId/test', (req, res) => {
  try {
    const ruleEngine = req.app.locals.ruleEngine;
    if (!ruleEngine) {
      return res.status(500).json({ success: false, error: 'Rule Engine not initialized' });
    }
    
    const { ruleId } = req.params;
    const { testData } = req.body;
    
    const rule = ruleEngine.getRule(ruleId);
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    
    // Create a test event
    const testEvent = {
      type: rule.eventType || 'test',
      source: rule.source || 'test',
      data: testData || {},
      timestamp: Date.now()
    };
    
    // Process the test event
    const result = ruleEngine.processEvent(testEvent);
    
    res.json({ 
      success: true, 
      message: 'Rule test completed',
      data: {
        rule: rule,
        testEvent: testEvent,
        result: result
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Flows endpoints - DISABLED (legacy flowOrchestrator)
router.get('/flows', (req, res) => {
  res.status(501).json({ 
    success: false, 
    error: 'Flows functionality has been disabled - legacy flowOrchestrator removed' 
  });
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

// Auto-generated rules - DISABLED (legacy flowOrchestrator)
router.get('/rules/auto-generated', async (req, res) => {
  res.status(501).json({ 
    success: false, 
    error: 'Auto-generated rules functionality has been disabled - legacy flowOrchestrator removed',
    data: []
  });
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

// GUI Configuration endpoints
router.get('/gui/config', (req, res) => {
  try {
    const layoutManager = req.app.locals.layoutManager;
    const guiEditor = req.app.locals.guiEditor;
    const connectorRegistry = req.app.locals.connectorRegistry;
    
    if (!layoutManager || !guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI services not initialized' });
    }
    
    const activeLayout = layoutManager.getActiveLayout();
    const editorState = guiEditor.getEditorState();
    const connectors = connectorRegistry ? connectorRegistry.getConnectors() : [];
    
    const guiConfig = {
      activeLayout,
      editorState,
      connectors: connectors.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        hasGuiConfig: typeof c.getGuiConfig === 'function',
        guiConfig: c.getGuiConfig ? c.getGuiConfig() : null
      })),
      canEdit: !editorState.isEditing,
      editUrl: `/gui/editor${activeLayout ? `?layout=${activeLayout.id}` : ''}`
    };
    
    res.json({ success: true, data: guiConfig });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/gui/edit', (req, res) => {
  try {
    const layoutManager = req.app.locals.layoutManager;
    const guiEditor = req.app.locals.guiEditor;
    
    if (!layoutManager || !guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI services not initialized' });
    }
    
    const { layoutId } = req.body;
    const targetLayout = layoutId || (layoutManager.getActiveLayout() ? layoutManager.getActiveLayout().id : null);
    
    if (!targetLayout) {
      return res.status(400).json({ success: false, error: 'No layout specified or active' });
    }
    
    // Start editing the layout
    const layout = guiEditor.startEditing(targetLayout, layoutManager);
    
    res.json({ 
      success: true, 
      data: {
        layout,
        editorUrl: `/gui/editor?layout=${targetLayout}`,
        message: 'Editor started successfully'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/gui/save', async (req, res) => {
  try {
    const guiEditor = req.app.locals.guiEditor;
    
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    const layout = await guiEditor.saveLayout();
    
    res.json({ 
      success: true, 
      data: {
        layout,
        message: 'Layout saved successfully'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/gui/stop-edit', (req, res) => {
  try {
    const guiEditor = req.app.locals.guiEditor;
    
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    guiEditor.stopEditing();
    
    res.json({ 
      success: true, 
      message: 'Editor stopped successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configuration management endpoints
router.post('/connectors', async (req, res) => {
  try {
    const { id, type, name, description, config } = req.body;
    
    if (!id || !type) {
      return res.status(400).json({ success: false, error: 'ID and type are required' });
    }
    
    // Load current config
    const configPath = path.join(process.cwd(), 'config', 'connectors.json');
    const configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    
    // Check if connector already exists
    if (configData.connectors.find(c => c.id === id)) {
      return res.status(400).json({ success: false, error: 'Connector with this ID already exists' });
    }
    
    // Add new connector
    const newConnector = {
      id,
      type,
      name: name || id,
      description: description || '',
      config: config || {},
      capabilities: {
        enabled: [],
        disabled: []
      }
    };
    
    configData.connectors.push(newConnector);
    
    // Save config
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2));
    
    res.json({ success: true, connector: newConnector });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/connectors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Load current config
    const configPath = path.join(process.cwd(), 'config', 'connectors.json');
    const configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    
    // Find and remove connector
    const index = configData.connectors.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Connector not found' });
    }
    
    configData.connectors.splice(index, 1);
    
    // Save config
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/connectors/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const connector = connectorRegistry.getConnector(id);
    
    if (!connector) {
      return res.status(404).json({ success: false, error: 'Connector not found' });
    }
    
    if (connector.status === 'connected') {
      await connector.disconnect();
    } else {
      await connector.connect();
    }
    
    res.json({ success: true, status: connector.status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/config/save', async (req, res) => {
  try {
    // This endpoint can be used to save any configuration changes
    // For now, just return success as the individual endpoints handle their own saving
    res.json({ success: true, message: 'Configuration saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/server/restart', async (req, res) => {
  try {
    // Send response before restarting
    res.json({ success: true, message: 'Server restart initiated' });
    
    // Restart server after a short delay
    setTimeout(() => {
      process.exit(0); // This will cause the server to restart if using a process manager
    }, 1000);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/connectors/reload', async (req, res) => {
  try {
    // Reload connectors from config
    await connectorRegistry.reloadConnectors();
    res.json({ success: true, message: 'Connectors reloaded' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Radar API endpoints
router.get('/radar/status', (req, res) => {
  try {
    const radarConnector = req.app.locals.radarConnector;
    const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
    
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const status = {
      radar: radarConnector.getStatus(),
      adsb: adsbConnector ? adsbConnector.getStatus() : null,
      integration: {
        hasAdsb: !!adsbConnector,
        aircraftCount: adsbConnector ? adsbConnector.aircraft?.size || 0 : 0,
        zonesCount: radarConnector.zoneData?.size || 0
      }
    };
    
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/radar/aircraft', (req, res) => {
  try {
    const radarConnector = req.app.locals.radarConnector;
    const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
    
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    let aircraft = [];
    
    // Get aircraft from ADSB connector if available
    if (adsbConnector && adsbConnector.aircraft) {
      aircraft = Array.from(adsbConnector.aircraft.values());
    }
    
    // Apply filters if provided
    if (req.query.filter) {
      const filter = JSON.parse(req.query.filter);
      aircraft = radarConnector.applyAircraftFilter(aircraft, filter);
    }
    
    res.json({ success: true, data: aircraft });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Simple aircraft endpoint that doesn't require RadarConnector
router.get('/aircraft', (req, res) => {
  try {
    const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
    
    if (!adsbConnector) {
      return res.status(500).json({ success: false, error: 'ADSB Connector not found' });
    }
    
    let aircraft = [];
    
    // Get aircraft from ADSB connector if available
    if (adsbConnector.aircraft) {
      aircraft = Array.from(adsbConnector.aircraft.values());
    }
    
    res.json({ success: true, data: aircraft });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint for ADSB connector internal state
router.get('/adsb/debug', (req, res) => {
  try {
    const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
    
    if (!adsbConnector) {
      return res.status(500).json({ success: false, error: 'ADSB Connector not found' });
    }
    
    const debugInfo = {
      status: adsbConnector.status,
      config: {
        enableFlightTracking: adsbConnector.enableFlightTracking,
        enableAircraftDataService: adsbConnector.enableAircraftDataService,
        flightDetectionConfig: adsbConnector.flightDetectionConfig,
        hasAircraftDataService: !!adsbConnector.aircraftDataService,
        hasAirspaceService: !!adsbConnector.airspaceService,
        hasSquawkCodeService: !!adsbConnector.squawkCodeService
      },
      state: {
        aircraftCount: adsbConnector.aircraft?.size || 0,
        activeFlightsCount: adsbConnector.activeFlights?.size || 0,
        activeFlights: Array.from(adsbConnector.activeFlights?.entries() || []).map(([icao24, flight]) => ({
          icao24,
          callsign: flight.callsign,
          startTime: flight.startTime,
          lastUpdate: flight.lastUpdate,
          sessionId: flight.sessionId
        })),
        performance: adsbConnector.performance
      }
    };
    
    res.json({ success: true, data: debugInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint for aircraft data service
router.get('/aircraft-data/debug', async (req, res) => {
  try {
    const aircraftDataService = req.app.locals.aircraftDataService;
    
    if (!aircraftDataService) {
      return res.status(500).json({ success: false, error: 'Aircraft Data Service not found' });
    }
    
    // Test getting recent events
    const recentEvents = await aircraftDataService.getRecentEvents(24, 'flight_started');
    
    const debugInfo = {
      serviceStatus: 'available',
      recentEvents: {
        count: recentEvents.length,
        events: recentEvents.slice(0, 5).map(event => ({
          icao24: event.icao24,
          event_type: event.event_type,
          timestamp: event.timestamp,
          event_data: event.event_data ? JSON.parse(event.event_data) : null
        }))
      },
      stats: await aircraftDataService.getStats()
    };
    
    res.json({ success: true, data: debugInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/radar/airport-vectors', (req, res) => {
  try {
    const airportVectorService = req.app.locals.airportVectorService;
    
    if (!airportVectorService) {
      return res.status(500).json({ success: false, error: 'Airport Vector Service not initialized' });
    }
    
    const data = airportVectorService.getAllData();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/radar/zones', (req, res) => {
  try {
    const radarConnector = req.app.locals.radarConnector;
    const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
    
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    let zones = [];
    
    // Get zones from radar connector
    zones = radarConnector.listZones();
    
    // Merge with ADSB zones if available
    if (adsbConnector && adsbConnector.zones) {
      const adsbZones = Array.from(adsbConnector.zones.values());
      zones = [...zones, ...adsbZones];
    }
    
    res.json({ success: true, data: zones });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/radar/zones', (req, res) => {
  try {
    const radarConnector = req.app.locals.radarConnector;
    
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const zone = radarConnector.createZone(req.body);
    res.json({ success: true, data: zone });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/radar/zones/:id', (req, res) => {
  try {
    const radarConnector = req.app.locals.radarConnector;
    
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const zone = radarConnector.updateZone({
      id: req.params.id,
      updates: req.body
    });
    res.json({ success: true, data: zone });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/radar/zones/:id', (req, res) => {
  try {
    const radarConnector = req.app.locals.radarConnector;
    
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const result = radarConnector.deleteZone({ id: req.params.id });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/radar/sync-adsb', (req, res) => {
  try {
    const radarConnector = req.app.locals.radarConnector;
    const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
    
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    if (!adsbConnector) {
      return res.status(500).json({ success: false, error: 'ADSB Connector not found' });
    }
    
    // Sync aircraft data from ADSB to radar
    if (adsbConnector.aircraft) {
      const aircraft = Array.from(adsbConnector.aircraft.values());
      radarConnector.updateAircraftData(aircraft);
    }
    
    // Sync zones from ADSB to radar
    if (adsbConnector.zones) {
      const zones = Array.from(adsbConnector.zones.values());
      radarConnector.updateZoneData(zones);
    }
    
    res.json({ 
      success: true, 
      message: 'ADSB data synced to radar',
      synced: {
        aircraft: adsbConnector.aircraft?.size || 0,
        zones: adsbConnector.zones?.size || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// BaseStation Database API Routes
router.get('/adsb/basestation/lookup', async (req, res) => {
  try {
    const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
    const { icao24 } = req.query;
    
    if (!adsbConnector) {
      return res.status(500).json({ success: false, error: 'ADSB Connector not found' });
    }
    
    if (!icao24) {
      return res.status(400).json({ success: false, error: 'ICAO24 parameter is required' });
    }
    
    const result = await adsbConnector.execute('basestation:database', 'lookup', { icao24 });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/adsb/basestation/search', async (req, res) => {
  try {
    const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
    
    if (!adsbConnector) {
      return res.status(500).json({ success: false, error: 'ADSB Connector not found' });
    }
    
    const searchParams = {
      registration: req.query.registration,
      manufacturer: req.query.manufacturer,
      type: req.query.type,
      operator: req.query.operator,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };
    
    const result = await adsbConnector.execute('basestation:database', 'search', searchParams);
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/adsb/basestation/stats', async (req, res) => {
  try {
    const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
    
    if (!adsbConnector) {
      return res.status(500).json({ success: false, error: 'ADSB Connector not found' });
    }
    
    const result = await adsbConnector.execute('basestation:database', 'stats', {});
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/adsb/basestation/export', async (req, res) => {
  try {
    const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
    const { icao24, format = 'json', limit = 1000 } = req.query;
    
    if (!adsbConnector) {
      return res.status(500).json({ success: false, error: 'ADSB Connector not found' });
    }
    
    const exportParams = {
      format,
      limit: parseInt(limit)
    };
    
    // If specific ICAO24 is provided, filter by it
    if (icao24) {
      const lookupResult = await adsbConnector.execute('basestation:database', 'lookup', { icao24 });
      if (lookupResult) {
        exportParams.icao24 = icao24;
      }
    }
    
    const result = await adsbConnector.execute('basestation:database', 'export', exportParams);
    
    // Set appropriate headers for download
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="aircraft_export_${Date.now()}.csv"`);
      res.send(result.csv);
    } else {
      res.json({ success: true, data: result });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced aircraft endpoint with BaseStation data
router.get('/adsb/aircraft/enhanced', async (req, res) => {
  try {
    const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
    
    if (!adsbConnector) {
      return res.status(500).json({ success: false, error: 'ADSB Connector not found' });
    }
    
    const aircraft = await adsbConnector.execute('aircraft:tracking', 'get', {});
    
    // Add BaseStation statistics
    const baseStationStats = await adsbConnector.execute('basestation:database', 'stats', {});
    
    res.json({ 
      success: true, 
      data: aircraft,
      baseStation: baseStationStats.baseStation
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remotion Connector API Routes
router.post('/connectors/remotion/execute', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(500).json({ success: false, error: 'Connector Registry not initialized' });
    }

    const remotionConnector = connectorRegistry.getConnectorsByType('remotion')[0];
    if (!remotionConnector) {
      return res.status(404).json({ success: false, error: 'Remotion connector not found' });
    }

    const { capabilityId, operation, parameters = {} } = req.body;

    if (!capabilityId || !operation) {
      return res.status(400).json({ success: false, error: 'capabilityId and operation are required' });
    }

    const result = await remotionConnector.execute(capabilityId, operation, parameters);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Remotion connector execution failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/connectors/remotion/stats', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(500).json({ success: false, error: 'Connector Registry not initialized' });
    }

    const remotionConnector = connectorRegistry.getConnectorsByType('remotion')[0];
    if (!remotionConnector) {
      return res.status(404).json({ success: false, error: 'Remotion connector not found' });
    }

    const stats = remotionConnector.getRenderStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get Remotion stats', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/connectors/remotion/templates', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(500).json({ success: false, error: 'Connector Registry not initialized' });
    }

    const remotionConnector = connectorRegistry.getConnectorsByType('remotion')[0];
    if (!remotionConnector) {
      return res.status(404).json({ success: false, error: 'Remotion connector not found' });
    }

    const templates = await remotionConnector.listTemplates(req.query);
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Failed to get Remotion templates', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/connectors/remotion/renders', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(500).json({ success: false, error: 'Connector Registry not initialized' });
    }

    const remotionConnector = connectorRegistry.getConnectorsByType('remotion')[0];
    if (!remotionConnector) {
      return res.status(404).json({ success: false, error: 'Remotion connector not found' });
    }

    const { renderId } = req.query;
    
    if (renderId) {
      const renderStatus = await remotionConnector.getRenderStatus(renderId);
      res.json({ success: true, data: renderStatus });
    } else {
      const activeRenders = Array.from(remotionConnector.activeRenders.values());
      res.json({ success: true, data: activeRenders });
    }
  } catch (error) {
    logger.error('Failed to get Remotion renders', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export both the router and the inject function
module.exports = { router, injectServices }; 