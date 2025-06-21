const express = require('express');
const router = express.Router();

/**
 * Speed Calculation Routes
 * 
 * Provides API endpoints for speed calculation system management
 */
class SpeedRoutes {
  constructor(services) {
    this.speedCalculationConnector = services.speedCalculationConnector;
    this.mapConnector = services.mapConnector;
    this.unifiConnector = services.unifiConnector;
    
    this.setupRoutes();
  }

  setupRoutes() {
    // Get speed calculation statistics
    router.get('/speed/stats', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const stats = connector.getStats();
        res.json({
          success: true,
          stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get speed calculations
    router.get('/speed/calculations', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const filter = {
          plateNumber: req.query.plateNumber,
          minSpeed: req.query.minSpeed ? parseFloat(req.query.minSpeed) : undefined,
          maxSpeed: req.query.maxSpeed ? parseFloat(req.query.maxSpeed) : undefined,
          startTime: req.query.startTime,
          endTime: req.query.endTime
        };
        
        const calculations = connector.getSpeedCalculations(filter);
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        
        res.json({
          success: true,
          calculations: calculations.slice(0, limit),
          count: calculations.length,
          filter
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get speed alerts
    router.get('/speed/alerts', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const filter = {
          plateNumber: req.query.plateNumber,
          minExcess: req.query.minExcess ? parseFloat(req.query.minExcess) : undefined
        };
        
        const result = await connector.execute('speed:calculation', 'alert', filter);
        
        res.json({
          success: true,
          alerts: result.alerts,
          count: result.count,
          filter
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get tracking data for a specific plate
    router.get('/speed/tracking/:plateNumber', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const trackingData = connector.getTrackingData(req.params.plateNumber);
        if (!trackingData) {
          return res.status(404).json({ error: 'Plate not found' });
        }
        
        res.json({
          success: true,
          plateNumber: req.params.plateNumber,
          tracking: trackingData
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Register detection point
    router.post('/speed/detection-points', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const { cameraId, name, position, direction, speedLimit, metadata } = req.body;
        
        if (!cameraId || !name || !position) {
          return res.status(400).json({ error: 'Missing required fields: cameraId, name, position' });
        }
        
        const detectionPoint = await connector.execute('detection:points', 'register', {
          cameraId,
          name,
          position,
          direction,
          speedLimit,
          metadata
        });
        
        res.json({
          success: true,
          detectionPoint
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update detection point
    router.put('/speed/detection-points/:cameraId', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const { cameraId } = req.params;
        const updates = req.body;
        
        const detectionPoint = await connector.execute('detection:points', 'update', {
          cameraId,
          updates
        });
        
        res.json({
          success: true,
          detectionPoint
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Remove detection point
    router.delete('/speed/detection-points/:cameraId', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const { cameraId } = req.params;
        
        const result = await connector.execute('detection:points', 'remove', { cameraId });
        
        res.json({
          success: true,
          result
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // List detection points
    router.get('/speed/detection-points', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const filter = {
          cameraId: req.query.cameraId
        };
        
        const detectionPoints = await connector.execute('detection:points', 'list', filter);
        
        res.json({
          success: true,
          detectionPoints,
          count: detectionPoints.length
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Connect to UniFi Protect
    router.post('/speed/connect-unifi', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const { connectorId } = req.body;
        
        if (!connectorId) {
          return res.status(400).json({ error: 'Missing connectorId' });
        }
        
        const result = await connector.execute('integration:unifi', 'connect', { connectorId });
        
        res.json({
          success: true,
          result
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Subscribe to UniFi events
    router.post('/speed/subscribe-unifi', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const { eventTypes } = req.body;
        
        const result = await connector.execute('integration:unifi', 'subscribe', { eventTypes });
        
        res.json({
          success: true,
          result
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Process ANPR event manually
    router.post('/speed/process-anpr', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const { cameraId, plateNumber, timestamp, confidence, data } = req.body;
        
        if (!cameraId || !plateNumber || !timestamp) {
          return res.status(400).json({ error: 'Missing required fields: cameraId, plateNumber, timestamp' });
        }
        
        const result = await connector.execute('speed:calculation', 'process', {
          cameraId,
          plateNumber,
          timestamp,
          confidence: confidence || 1.0,
          data: data || {}
        });
        
        res.json({
          success: true,
          result
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get speed calculation configuration
    router.get('/speed/config', async (req, res) => {
      try {
        const connector = req.app.locals.speedCalculationConnector;
        if (!connector) {
          return res.status(503).json({ error: 'Speed calculation connector not available' });
        }
        
        const config = connector.exportConfiguration();
        
        res.json({
          success: true,
          config
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get real-time speed data (WebSocket endpoint)
    router.get('/speed/realtime', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const sendEvent = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Send initial data
      const connector = req.app.locals.speedCalculationConnector;
      if (connector) {
        const stats = connector.getStats();
        sendEvent('stats', stats);
      }

      // Set up event listeners
      if (connector) {
        connector.on('speed:calculated', (speedData) => {
          sendEvent('speedCalculated', speedData);
        });

        connector.on('speed:alert', (alertData) => {
          sendEvent('speedAlert', alertData);
        });
      }

      // Handle client disconnect
      req.on('close', () => {
        if (connector) {
          connector.removeAllListeners('speed:calculated');
          connector.removeAllListeners('speed:alert');
        }
      });
    });
  }
}

module.exports = { router, SpeedRoutes }; 