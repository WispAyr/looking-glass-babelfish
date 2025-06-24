const express = require('express');
const router = express.Router();
const winston = require('winston');
const WebSocket = require('ws');

// Create logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'overwatch-routes' },
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
let connectorRegistry = null;

// Middleware to inject services
function injectServices(services) {
  connectorRegistry = services.connectorRegistry;
}

// Get Overwatch connector
function getOverwatchConnector() {
  if (!connectorRegistry) {
    throw new Error('Connector Registry not initialized');
  }
  
  const connector = connectorRegistry.getConnector('overwatch-main');
  if (!connector) {
    throw new Error('Overwatch connector not found');
  }
  
  return connector;
}

// WebSocket server for real-time events
let wss = null;

function setupWebSocketServer(server) {
  wss = new WebSocket.Server({ 
    server,
    path: '/api/overwatch/websocket'
  });
  
  wss.on('connection', (ws, req) => {
    logger.info('WebSocket client connected to Overwatch');
    
    const overwatchConnector = getOverwatchConnector();
    overwatchConnector.addWebSocketConnection(ws);
    
    ws.on('close', () => {
      logger.info('WebSocket client disconnected from Overwatch');
      overwatchConnector.removeWebSocketConnection(ws);
    });
    
    ws.on('error', (error) => {
      logger.error('WebSocket error in Overwatch', error);
    });
  });
}

// Flow Management Endpoints
router.get('/flows', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const flows = await connector.execute('overwatch:flows', 'list');
    
    res.json({
      success: true,
      data: flows
    });
  } catch (error) {
    logger.error('Failed to get flows', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/flows/:flowId', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const flow = await connector.execute('overwatch:flows', 'get', { id: req.params.flowId });
    
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }
    
    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    logger.error('Failed to get flow', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/flows', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const flow = await connector.execute('overwatch:flows', 'create', req.body);
    
    res.status(201).json({
      success: true,
      data: flow
    });
  } catch (error) {
    logger.error('Failed to create flow', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/flows/:flowId', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const flow = await connector.execute('overwatch:flows', 'update', {
      id: req.params.flowId,
      ...req.body
    });
    
    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    logger.error('Failed to update flow', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/flows/:flowId', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const result = await connector.execute('overwatch:flows', 'delete', { id: req.params.flowId });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to delete flow', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/flows/:flowId/enable', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const flow = await connector.execute('overwatch:flows', 'enable', { id: req.params.flowId });
    
    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    logger.error('Failed to enable flow', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/flows/:flowId/disable', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const flow = await connector.execute('overwatch:flows', 'disable', { id: req.params.flowId });
    
    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    logger.error('Failed to disable flow', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Event Management Endpoints
router.get('/events', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const { limit = 100, offset = 0, filters } = req.query;
    
    const events = await connector.execute('overwatch:events', 'history', {
      limit: parseInt(limit),
      offset: parseInt(offset),
      filters: filters ? JSON.parse(filters) : undefined
    });
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Failed to get events', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/events/stats', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const stats = await connector.execute('overwatch:events', 'stats');
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get event stats', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/events/filter', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const result = await connector.execute('overwatch:events', 'filter', req.body);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to set event filter', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/events/stream', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const streamConfig = await connector.execute('overwatch:events', 'stream', req.query);
    
    res.json({
      success: true,
      data: streamConfig
    });
  } catch (error) {
    logger.error('Failed to get event stream config', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Connector Management Endpoints
router.get('/connectors', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const connectors = await connector.execute('overwatch:connectors', 'list');
    
    res.json({
      success: true,
      data: connectors
    });
  } catch (error) {
    logger.error('Failed to get connectors', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/connectors/:connectorId', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const connectorInfo = await connector.execute('overwatch:connectors', 'status', {
      id: req.params.connectorId
    });
    
    res.json({
      success: true,
      data: connectorInfo
    });
  } catch (error) {
    logger.error('Failed to get connector status', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/connectors/:connectorId/config', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const config = await connector.execute('overwatch:connectors', 'config', {
      id: req.params.connectorId
    });
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Failed to get connector config', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/connectors/:connectorId/connect', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const result = await connector.execute('overwatch:connectors', 'connect', {
      id: req.params.connectorId
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to connect connector', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/connectors/:connectorId/disconnect', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const result = await connector.execute('overwatch:connectors', 'disconnect', {
      id: req.params.connectorId
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to disconnect connector', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// System Health Endpoints
router.get('/system/health', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const health = await connector.execute('overwatch:system', 'health');
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Failed to get system health', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/system/metrics', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const metrics = await connector.execute('overwatch:system', 'metrics');
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get system metrics', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/system/alerts', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const alerts = await connector.execute('overwatch:system', 'alerts');
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error('Failed to get system alerts', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Filter Presets Endpoints
router.get('/filters/presets', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const presets = Array.from(connector.filterPresets.entries()).map(([id, preset]) => ({
      id,
      ...preset
    }));
    
    res.json({
      success: true,
      data: presets
    });
  } catch (error) {
    logger.error('Failed to get filter presets', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/filters/presets/:presetId/apply', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const preset = connector.filterPresets.get(req.params.presetId);
    
    if (!preset) {
      return res.status(404).json({ success: false, error: 'Filter preset not found' });
    }
    
    const result = await connector.execute('overwatch:events', 'filter', {
      id: `preset-${req.params.presetId}`,
      filters: preset.filters
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to apply filter preset', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Dashboard Overview Endpoint
router.get('/dashboard', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    
    // Get all dashboard data in parallel
    const [flows, events, connectors, health, alerts] = await Promise.all([
      connector.execute('overwatch:flows', 'list'),
      connector.execute('overwatch:events', 'stats'),
      connector.execute('overwatch:connectors', 'list'),
      connector.execute('overwatch:system', 'health'),
      connector.execute('overwatch:system', 'alerts')
    ]);
    
    const dashboard = {
      flows: {
        total: flows.length,
        enabled: flows.filter(f => f.enabled).length,
        disabled: flows.filter(f => !f.enabled).length
      },
      events: events,
      connectors: {
        total: connectors.length,
        connected: connectors.filter(c => c.status === 'connected').length,
        disconnected: connectors.filter(c => c.status === 'disconnected').length
      },
      system: health,
      alerts: alerts
    };
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Failed to get dashboard data', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export the router and setup function
module.exports = {
  router,
  injectServices,
  setupWebSocketServer,
  setupEventStreamWebSocket
};

// API Routes (these are the ones the frontend is trying to access)
router.get('/api/status', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const health = await connector.execute('overwatch:system', 'health');
    const metrics = await connector.execute('overwatch:system', 'metrics');
    
    const status = {
      ...health,
      ...metrics,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get status', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/events', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const { limit = 100, offset = 0, filters } = req.query;
    
    const events = await connector.execute('overwatch:events', 'history', {
      limit: parseInt(limit),
      offset: parseInt(offset),
      filters: filters ? JSON.parse(filters) : undefined
    });
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Failed to get events', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/health', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const health = await connector.execute('overwatch:system', 'health');
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Failed to get health', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/config', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const connectors = await connector.execute('overwatch:connectors', 'list');
    const flows = await connector.execute('overwatch:flows', 'list');
    
    const config = {
      connectors,
      flows,
      filters: Array.from(connector.filterPresets.entries()).map(([id, preset]) => ({
        id,
        ...preset
      })),
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Failed to get config', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/dashboard', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    
    // Get all dashboard data in parallel
    const [flows, events, connectors, health, alerts] = await Promise.all([
      connector.execute('overwatch:flows', 'list'),
      connector.execute('overwatch:events', 'stats'),
      connector.execute('overwatch:connectors', 'list'),
      connector.execute('overwatch:system', 'health'),
      connector.execute('overwatch:system', 'alerts')
    ]);
    
    const dashboard = {
      flows: {
        total: flows.length,
        enabled: flows.filter(f => f.enabled).length,
        disabled: flows.filter(f => !f.enabled).length
      },
      events: events,
      connectors: {
        total: connectors.length,
        connected: connectors.filter(c => c.status === 'connected').length,
        disconnected: connectors.filter(c => c.status === 'disconnected').length
      },
      system: health,
      alerts: alerts
    };
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Failed to get dashboard data', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Camera snapshot endpoint
router.get('/api/cameras/:cameraId/snapshot', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const { timestamp } = req.query;
    
    // Get the UniFi Protect connector
    const unifiConnector = connectorRegistry.getConnector('unifi-protect-main');
    if (!unifiConnector) {
      return res.status(404).json({ success: false, error: 'UniFi Protect connector not found' });
    }
    
    // Try to get camera from the cameras Map first
    const camera = unifiConnector.cameras?.get(cameraId);
    if (!camera) {
      // If not in cameras Map, try cached device
      const cachedCamera = unifiConnector.getCachedDevice('cameras', cameraId);
      if (!cachedCamera) {
        // If still not found, try to get it directly from the API
        try {
          const cameraData = await unifiConnector.getCamera({ id: cameraId });
          if (!cameraData) {
            return res.status(404).json({ success: false, error: 'Camera not found' });
          }
        } catch (error) {
          return res.status(404).json({ success: false, error: 'Camera not found' });
        }
      }
    }
    
    // Get snapshot from UniFi Protect using the first getCameraSnapshot method
    const snapshot = await unifiConnector.getCameraSnapshot({ 
      cameraId, 
      highQuality: 'true',
      timestamp: timestamp || new Date().toISOString()
    });
    
    if (!snapshot) {
      return res.status(404).json({ success: false, error: 'Snapshot not available' });
    }
    
    // Set appropriate headers for image
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.setHeader('Content-Disposition', `inline; filename="snapshot-${cameraId}-${timestamp || Date.now()}.jpg"`);
    
    res.send(snapshot);
  } catch (error) {
    logger.error('Failed to get camera snapshot', { error: error.message, cameraId: req.params.cameraId });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Additional API routes that the frontend expects
router.get('/api/system/health', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const health = await connector.execute('overwatch:system', 'health');
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Failed to get system health', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/system/metrics', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const metrics = await connector.execute('overwatch:system', 'metrics');
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get system metrics', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/connectors', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const connectors = await connector.execute('overwatch:connectors', 'list');
    
    res.json({
      success: true,
      data: connectors
    });
  } catch (error) {
    logger.error('Failed to get connectors', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/flows', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const flows = await connector.execute('overwatch:flows', 'list');
    
    res.json({
      success: true,
      data: flows
    });
  } catch (error) {
    logger.error('Failed to get flows', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/filters', async (req, res) => {
  try {
    const connector = getOverwatchConnector();
    const filters = Array.from(connector.filterPresets.entries()).map(([id, preset]) => ({
      id,
      ...preset
    }));
    
    res.json({
      success: true,
      data: filters
    });
  } catch (error) {
    logger.error('Failed to get filters', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket endpoint for event streaming (proper implementation)
function setupEventStreamWebSocket(server) {
  const WebSocket = require('ws');
  const wss = new WebSocket.Server({ 
    server,
    path: '/api/overwatch/events/stream'
  });
  
  wss.on('connection', (ws, req) => {
    logger.info('WebSocket client connected to events stream');
    
    const overwatchConnector = getOverwatchConnector();
    if (overwatchConnector && overwatchConnector.addWebSocketConnection) {
      overwatchConnector.addWebSocketConnection(ws);
    }
    
    ws.on('close', () => {
      logger.info('WebSocket client disconnected from events stream');
      if (overwatchConnector && overwatchConnector.removeWebSocketConnection) {
        overwatchConnector.removeWebSocketConnection(ws);
      }
    });
    
    ws.on('error', (error) => {
      logger.error('WebSocket error in events stream', error);
    });
  });
  
  return wss;
} 