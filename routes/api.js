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

// Devices endpoints
router.get('/devices', async (req, res) => {
  try {
    const devices = await unifiAPI.getDevices();
    res.json({
      success: true,
      data: devices,
      count: devices.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = unifiAPI.getDeviceConfig(deviceId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    const systemInfo = await unifiAPI.getSystemInfo(deviceId);
    res.json({
      success: true,
      data: {
        ...device,
        systemInfo
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/devices', async (req, res) => {
  try {
    const deviceConfig = req.body;
    const deviceId = await unifiAPI.addDevice(deviceConfig);
    
    res.status(201).json({
      success: true,
      data: { deviceId },
      message: 'Device added successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const removed = await unifiAPI.removeDevice(deviceId);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    res.json({
      success: true,
      message: 'Device removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cameras endpoints
router.get('/cameras', async (req, res) => {
  try {
    const { deviceId } = req.query;
    const cameras = await unifiAPI.getCameras(deviceId);
    
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

router.get('/cameras/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const { deviceId } = req.query;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required'
      });
    }

    const cameras = await unifiAPI.getCameras(deviceId);
    const camera = cameras.find(c => c.id === cameraId);
    
    if (!camera) {
      return res.status(404).json({
        success: false,
        error: 'Camera not found'
      });
    }

    res.json({
      success: true,
      data: camera
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/cameras/:cameraId/snapshot', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const { deviceId } = req.query;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required'
      });
    }

    const snapshot = await unifiAPI.getCameraSnapshot(cameraId, deviceId);
    
    res.set('Content-Type', 'image/jpeg');
    res.send(snapshot);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Events endpoints
router.get('/events', async (req, res) => {
  try {
    const {
      deviceId,
      startTime,
      endTime,
      cameras,
      types,
      limit = 100,
      sortBy = 'start',
      sortOrder = 'desc'
    } = req.query;

    const options = {
      startTime,
      endTime,
      cameras: cameras ? cameras.split(',') : null,
      types: types ? types.split(',') : null,
      limit: parseInt(limit)
    };

    const events = await unifiAPI.getEvents(deviceId, options);
    
    // Apply sorting
    events.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    res.json({
      success: true,
      data: events,
      count: events.length,
      filters: options
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/events/motion', async (req, res) => {
  try {
    const { deviceId, ...options } = req.query;
    const events = await unifiAPI.getMotionEvents(deviceId, options);
    
    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/events/smart-detect', async (req, res) => {
  try {
    const { deviceId, ...options } = req.query;
    const events = await unifiAPI.getSmartDetectEvents(deviceId, options);
    
    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Event processor endpoints
router.get('/events/processed', (req, res) => {
  try {
    const { limit, filters, sortBy, sortOrder } = req.query;
    
    const options = {
      limit: limit ? parseInt(limit) : null,
      filters: filters ? JSON.parse(filters) : null,
      sortBy,
      sortOrder
    };

    const events = eventProcessor.getEvents(options);
    
    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/events/stats', (req, res) => {
  try {
    const stats = eventProcessor.getEventStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/events/filters', (req, res) => {
  try {
    const { id, ...filter } = req.body;
    const filterId = id || `filter-${Date.now()}`;
    
    eventProcessor.addFilter(filterId, filter);
    
    res.status(201).json({
      success: true,
      data: { filterId },
      message: 'Filter added successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/events/filters', (req, res) => {
  try {
    const filters = eventProcessor.getFilters();
    
    res.json({
      success: true,
      data: filters,
      count: filters.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/events/filters/:filterId', (req, res) => {
  try {
    const { filterId } = req.params;
    const updates = req.body;
    
    const updated = eventProcessor.updateFilter(filterId, updates);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Filter not found'
      });
    }

    res.json({
      success: true,
      message: 'Filter updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/events/filters/:filterId', (req, res) => {
  try {
    const { filterId } = req.params;
    const removed = eventProcessor.removeFilter(filterId);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Filter not found'
      });
    }

    res.json({
      success: true,
      message: 'Filter removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/events/processed', (req, res) => {
  try {
    const count = eventProcessor.clearEvents();
    
    res.json({
      success: true,
      data: { count },
      message: `${count} events cleared successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// MQTT endpoints (if enabled)
router.get('/mqtt/status', (req, res) => {
  if (!mqttBroker) {
    return res.status(404).json({
      success: false,
      error: 'MQTT broker not enabled'
    });
  }

  try {
    const status = mqttBroker.getStatus();
    
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

router.get('/mqtt/messages', (req, res) => {
  if (!mqttBroker) {
    return res.status(404).json({
      success: false,
      error: 'MQTT broker not enabled'
    });
  }

  try {
    const { limit = 50 } = req.query;
    const messages = mqttBroker.getPublishedMessages(parseInt(limit));
    
    res.json({
      success: true,
      data: messages,
      count: messages.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cache endpoints
router.get('/cache/stats', (req, res) => {
  try {
    const stats = cache.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/cache/keys', (req, res) => {
  try {
    const { pattern } = req.query;
    const keys = cache.keys(pattern);
    
    res.json({
      success: true,
      data: keys,
      count: keys.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/cache', (req, res) => {
  try {
    cache.clear();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/cache/pattern/:pattern', (req, res) => {
  try {
    const { pattern } = req.params;
    const deletedCount = cache.deletePattern(pattern);
    
    res.json({
      success: true,
      data: { deletedCount },
      message: `${deletedCount} cache entries deleted`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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
    
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export both the router and the inject function
module.exports = { router, injectServices }; 