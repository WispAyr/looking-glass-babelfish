const express = require('express');
const router = express.Router();

let prestwickConnector = null;
let eventBus = null;

function injectServices({ connectorRegistry, eventBus }) {
  prestwickConnector = connectorRegistry.getConnector('prestwick-airport-main');
  eventBus = eventBus;
}

/**
 * GET /api/prestwick/status
 * Get Prestwick Airport connector status
 */
router.get('/status', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const status = prestwickConnector.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/prestwick/aircraft/tracked
 * Get currently tracked aircraft
 */
router.get('/aircraft/tracked', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const aircraft = await prestwickConnector.executeCapability('aircraft:tracking', 'get_tracked_aircraft');
    
    res.json({
      success: true,
      data: aircraft,
      count: aircraft.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/prestwick/aircraft/history
 * Get aircraft history
 */
router.get('/aircraft/history', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const limit = parseInt(req.query.limit) || 100;
    const aircraft = await prestwickConnector.executeCapability('aircraft:tracking', 'get_aircraft_history', { limit });
    
    res.json({
      success: true,
      data: aircraft,
      count: aircraft.length,
      limit,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/prestwick/stats
 * Get airport statistics
 */
router.get('/stats', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const stats = await prestwickConnector.executeCapability('airport:operations', 'get_stats');
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/prestwick/runways
 * Get runway information
 */
router.get('/runways', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const runways = await prestwickConnector.executeCapability('airport:operations', 'get_runways');
    
    res.json({
      success: true,
      data: runways,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/prestwick/config
 * Get airport configuration
 */
router.get('/config', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const config = await prestwickConnector.executeCapability('airport:operations', 'get_config');
    
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/prestwick/runway/determine
 * Determine which runway an aircraft is approaching
 */
router.post('/runway/determine', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const { latitude, longitude, heading } = req.body;
    
    if (!latitude || !longitude || !heading) {
      return res.status(400).json({
        error: 'latitude, longitude, and heading are required',
        timestamp: new Date().toISOString()
      });
    }

    const runway = await prestwickConnector.executeCapability('runway:detection', 'determine_runway', {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      heading: parseFloat(heading)
    });
    
    res.json({
      success: true,
      data: runway,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/prestwick/events
 * Get recent aircraft events
 */
router.get('/events', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const limit = parseInt(req.query.limit) || 100;
    const events = await prestwickConnector.executeCapability('events:aircraft', 'get_event_history', { limit });
    
    res.json({
      success: true,
      data: events,
      count: events.length,
      limit,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/prestwick/health
 * Get connector health status
 */
router.get('/health', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        healthy: false,
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const health = await prestwickConnector.performHealthCheck();
    
    res.json({
      ...health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/prestwick/telegram/config
 * Get Telegram notification configuration
 */
router.get('/telegram/config', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const config = await prestwickConnector.executeCapability('telegram:notifications', 'get_notification_config');
    
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/prestwick/telegram/config
 * Configure Telegram notifications
 */
router.post('/telegram/config', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const { enabled, chatId, eventTypes } = req.body;
    
    const result = await prestwickConnector.executeCapability('telegram:notifications', 'configure_notifications', {
      enabled,
      chatId,
      eventTypes
    });
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/prestwick/telegram/test
 * Send a test Telegram notification
 */
router.post('/telegram/test', async (req, res) => {
  try {
    if (!prestwickConnector) {
      return res.status(503).json({
        error: 'Prestwick Airport connector not available',
        timestamp: new Date().toISOString()
      });
    }

    const result = await prestwickConnector.executeCapability('telegram:notifications', 'test_notification');
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = {
  router,
  injectServices
}; 