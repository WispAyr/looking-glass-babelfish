const express = require('express');
const router = express.Router();

// Import services (these will be injected from the main server)
let unifiAPI, eventProcessor, mqttBroker, cache;

// Middleware to inject services
function injectServices(services) {
  unifiAPI = services.unifiAPI;
  eventProcessor = services.eventProcessor;
  mqttBroker = services.mqttBroker;
  cache = services.cache;
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

// Export both the router and the inject function
module.exports = { router, injectServices }; 