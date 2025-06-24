const express = require('express');
const router = express.Router();
const path = require('path');

/**
 * GET /alarms
 * Serve the alarm manager web interface
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../templates/alarm-center.html'));
});

/**
 * GET /alarms/api
 * Get all alarm rules from the Alarm Manager Connector
 */
router.get('/api', async (req, res) => {
  try {
    const { category, connectorType, enabledOnly } = req.query;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    const parameters = {};
    if (category) parameters.category = category;
    if (connectorType) parameters.connectorType = connectorType;
    if (enabledOnly === 'true') parameters.enabledOnly = true;

    const rules = await alarmManager.execute('alarm:management', 'read', parameters);
    
    res.json({
      success: true,
      data: rules,
      count: Array.isArray(rules) ? rules.length : 1
    });
  } catch (error) {
    console.error('Error getting alarm rules:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /alarms/api/stats
 * Get alarm statistics from the Alarm Manager Connector
 */
router.get('/api/stats', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    const stats = await alarmManager.execute('alarm:management', 'stats');
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting alarm stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /alarms/api/history
 * Get alarm history from the Alarm Manager Connector
 */
router.get('/api/history', async (req, res) => {
  try {
    const { limit = 100, offset = 0, status, ruleId, eventType } = req.query;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    const filters = {};
    if (status) filters.status = status;
    if (ruleId) filters.ruleId = ruleId;
    if (eventType) filters.eventType = eventType;
    
    const history = await alarmManager.getAlarmHistory(
      parseInt(limit),
      parseInt(offset),
      filters
    );
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error getting alarm history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /alarms/api/test
 * Test an alarm rule using the Alarm Manager Connector
 */
router.post('/api/test', async (req, res) => {
  try {
    const { ruleId, eventData } = req.body;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    const result = await alarmManager.execute('alarm:management', 'test', {
      ruleId,
      eventData
    });
    
    res.json({
      success: true,
      data: result,
      message: 'Rule test completed successfully'
    });
  } catch (error) {
    console.error('Error testing alarm rule:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /alarms/api/channels
 * Get available notification channels
 */
router.get('/api/channels', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    // Get available channels from the alarm manager's channel map
    const telegramChannel = alarmManager.channels.get('telegram');
    const mqttChannel = alarmManager.channels.get('mqtt');

    const channels = [
      {
        name: 'Telegram',
        description: 'Telegram bot notifications',
        connected: !!(telegramChannel && telegramChannel.isConnected)
      },
      {
        name: 'MQTT',
        description: 'MQTT broker notifications',
        connected: !!(mqttChannel && mqttChannel.isConnected)
      }
    ];
    
    res.json({
      success: true,
      data: channels
    });
  } catch (error) {
    console.error('Error getting notification channels:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /alarms/api/notify
 * Send a test notification
 */
router.post('/api/notify', async (req, res) => {
  try {
    const { channel, message, options = {} } = req.body;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    // Send notification through the alarm manager
    if (channel === 'telegram' && alarmManager.telegramConnector) {
      await alarmManager.telegramConnector.sendTextMessage(
        alarmManager.telegramConfig.chatId,
        message
      );
    } else if (channel === 'mqtt' && alarmManager.mqttConnector) {
      await alarmManager.mqttConnector.publish(
        'alarms/test',
        JSON.stringify({ message, timestamp: Date.now() })
      );
    } else {
      return res.status(400).json({
        success: false,
        error: 'Channel not available or not configured'
      });
    }
    
    res.json({
      success: true,
      message: 'Notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /alarms/api/events
 * Get recent events that could trigger alarms
 */
router.get('/api/events', async (req, res) => {
  try {
    const { limit = 50, eventType, source } = req.query;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    // Get recent events from the event bus
    const eventBus = req.app.locals.eventBus;
    if (!eventBus) {
      return res.status(503).json({
        success: false,
        error: 'Event bus not available'
      });
    }

    // For now, return a sample of recent events
    // In a real implementation, this would query the event bus history
    const sampleEvents = [
      {
        type: 'smartDetectLine',
        source: 'unifi-protect-websocket',
        timestamp: Date.now() - 60000,
        data: { device: 'camera-1', smartDetectTypes: ['vehicle'] }
      },
      {
        type: 'adsb:status',
        source: 'adsb-main',
        timestamp: Date.now() - 120000,
        data: { activeFlights: 0, aircraftCount: 1 }
      }
    ];
    
    res.json({
      success: true,
      data: sampleEvents,
      count: sampleEvents.length
    });
  } catch (error) {
    console.error('Error getting recent events:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /alarms/api/:id
 * Get a specific alarm rule
 */
router.get('/api/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    const rule = await alarmManager.execute('alarm:management', 'read', {
      ruleId: id
    });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }
    
    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('Error getting alarm rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /alarms/api/rules
 * Create a new rule
 */
router.post('/api/rules', async (req, res) => {
  try {
    const ruleData = req.body;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    const result = await alarmManager.execute('alarm:management', 'createRule', ruleData);
    
    if (result.success) {
      // Broadcast rule update via WebSocket
      if (req.app.locals.broadcastRuleUpdate) {
        req.app.locals.broadcastRuleUpdate('created', result.rule);
      }
      
      res.json({
        success: true,
        data: result.rule,
        message: 'Rule created successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /alarms/api/rules/:id
 * Update an existing rule
 */
router.put('/api/rules/:id', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const ruleData = req.body;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    const result = await alarmManager.execute('alarm:management', 'updateRule', { id: ruleId, ...ruleData });
    
    if (result.success) {
      // Broadcast rule update via WebSocket
      if (req.app.locals.broadcastRuleUpdate) {
        req.app.locals.broadcastRuleUpdate('updated', result.rule);
      }
      
      res.json({
        success: true,
        data: result.rule,
        message: 'Rule updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /alarms/api/rules/:id
 * Delete a rule
 */
router.delete('/api/rules/:id', async (req, res) => {
  try {
    const ruleId = req.params.id;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    const result = await alarmManager.execute('alarm:management', 'deleteRule', { id: ruleId });
    
    if (result.success) {
      // Broadcast rule update via WebSocket
      if (req.app.locals.broadcastRuleUpdate) {
        req.app.locals.broadcastRuleUpdate('deleted', result.rule);
      }
      
      res.json({
        success: true,
        message: 'Rule deleted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /alarms/api/rules/:id/toggle
 * Toggle rule enabled/disabled status
 */
router.post('/api/rules/:id/toggle', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const { enabled } = req.body;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    const result = await alarmManager.execute('alarm:management', 'toggleRule', { id: ruleId, enabled });
    
    if (result.success) {
      // Broadcast rule update via WebSocket
      if (req.app.locals.broadcastRuleUpdate) {
        req.app.locals.broadcastRuleUpdate(enabled ? 'enabled' : 'disabled', result.rule);
      }
      
      res.json({
        success: true,
        data: result.rule,
        message: `Rule ${enabled ? 'enabled' : 'disabled'} successfully`
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error toggling rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /alarms/api/import
 * Import rules from JSON
 */
router.post('/api/import', async (req, res) => {
  try {
    const { rulesData } = req.body;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    const result = await alarmManager.execute('alarm:management', 'import', { rulesData });
    
    res.json({
      success: true,
      data: result,
      message: 'Rules imported successfully'
    });
  } catch (error) {
    console.error('Error importing rules:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /alarms/api/export
 * Export rules to JSON
 */
router.get('/api/export', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const alarmManager = connectorRegistry.getConnector('alarm-manager-main');
    if (!alarmManager) {
      return res.status(503).json({
        success: false,
        error: 'Alarm Manager Connector not available'
      });
    }

    const rules = await alarmManager.execute('alarm:management', 'read');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="alarm-rules.json"');
    res.json({
      rules,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    });
  } catch (error) {
    console.error('Error exporting rules:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /alarms/api/test-alert
 * Send a test alert via WebSocket
 */
router.post('/api/test-alert', (req, res) => {
  try {
    const { type = 'info', title = 'Test Alert', message = 'This is a test alert', priority = 'medium' } = req.body;
    
    const alertData = {
      type,
      title,
      message,
      priority,
      source: 'alarm-manager-test'
    };
    
    // Use the main app's broadcastAlert function to prevent cyclical alerts
    if (req.app.locals.broadcastAlert) {
      req.app.locals.broadcastAlert(alertData);
    }
    
    res.json({
      success: true,
      message: 'Test alert sent successfully',
      data: alertData
    });
  } catch (error) {
    console.error('Error sending test alert:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /alarms/api/telegram-test
 * Send a test telegram alert
 */
router.post('/api/telegram-test', async (req, res) => {
  try {
    const { message = '🧪 Test alert from Alarm Manager', chatId } = req.body;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    // Find telegram connector
    const telegramConnectors = connectorRegistry.getConnectorsByType('telegram');
    if (!telegramConnectors || telegramConnectors.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No Telegram connectors found'
      });
    }

    const telegramConnector = telegramConnectors[0];
    if (!telegramConnector.connected) {
      return res.status(503).json({
        success: false,
        error: 'Telegram connector is not connected'
      });
    }

    // Use provided chatId or default from connector config
    const targetChatId = chatId || telegramConnector.config.chatId;
    if (!targetChatId) {
      return res.status(400).json({
        success: false,
        error: 'No chat ID provided and no default chat ID configured'
      });
    }

    // Send test message using capability pattern
    const result = await telegramConnector.execute('telegram:send', 'text', {
      chatId: targetChatId,
      text: message,
      parseMode: 'HTML'
    });
    
    res.json({
      success: true,
      data: result,
      message: 'Telegram test alert sent successfully'
    });
  } catch (error) {
    console.error('Error sending telegram test alert:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /alarms/api/connectors/status
 * Get status of all connectors for visualization
 */
router.get('/api/connectors/status', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    // Defensive programming - ensure getConnectors returns an array
    let connectors = [];
    try {
      const connectorsResult = connectorRegistry.getConnectors();
      if (Array.isArray(connectorsResult)) {
        connectors = connectorsResult;
      } else if (connectorsResult && typeof connectorsResult === 'object') {
        // If it's a Map or other iterable, convert to array
        connectors = Array.from(connectorsResult.values ? connectorsResult.values() : Object.values(connectorsResult));
      } else {
        console.warn('getConnectors() returned non-iterable:', typeof connectorsResult);
        connectors = [];
      }
    } catch (error) {
      console.error('Error getting connectors:', error);
      connectors = [];
    }

    const connectorStatus = [];

    for (const connector of connectors) {
      try {
        // Get health status if available
        let healthStatus = { healthy: false, error: 'Health check not available' };
        if (connector.performHealthCheck && typeof connector.performHealthCheck === 'function') {
          try {
            healthStatus = await connector.performHealthCheck();
            // Ensure healthStatus has the expected structure
            if (!healthStatus || typeof healthStatus !== 'object') {
              healthStatus = { healthy: false, error: 'Invalid health check response' };
            }
          } catch (healthError) {
            healthStatus = { healthy: false, error: healthError.message };
          }
        }

        connectorStatus.push({
          id: connector.id,
          name: connector.config?.name || connector.id,
          type: connector.config?.type || connector.type,
          connected: connector.connected || false,
          healthy: healthStatus.healthy || false,
          healthDetails: healthStatus,
          capabilities: connector.getCapabilityDefinitions ? connector.getCapabilityDefinitions() : [],
          metadata: connector.getMetadata ? connector.getMetadata() : {},
          uptime: connector.startTime ? Date.now() - connector.startTime : 0,
          lastSeen: connector.lastSeen || null
        });
      } catch (error) {
        console.error(`Error getting status for connector ${connector.id}:`, error);
        connectorStatus.push({
          id: connector.id,
          name: connector.config?.name || connector.id,
          type: connector.config?.type || connector.type,
          connected: false,
          healthy: false,
          error: error.message,
          capabilities: [],
          metadata: {},
          uptime: 0,
          lastSeen: null
        });
      }
    }

    // Group by type for better organization
    const groupedConnectors = {};
    connectorStatus.forEach(connector => {
      if (!groupedConnectors[connector.type]) {
        groupedConnectors[connector.type] = [];
      }
      groupedConnectors[connector.type].push(connector);
    });

    res.json({
      success: true,
      data: {
        connectors: connectorStatus,
        grouped: groupedConnectors,
        summary: {
          total: connectorStatus.length,
          connected: connectorStatus.filter(c => c.connected).length,
          healthy: connectorStatus.filter(c => c.healthy).length,
          types: Object.keys(groupedConnectors).length
        }
      }
    });
  } catch (error) {
    console.error('Error getting connector status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /alarms/api/connectors/discovered
 * Get discovered connector types and their capabilities
 */
router.get('/api/connectors/discovered', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    const types = connectorRegistry.getTypes();
    
    res.json({
      success: true,
      data: {
        types,
        count: types.length,
        categories: {
          video: types.filter(t => t.metadata.category === 'video').length,
          communication: types.filter(t => t.metadata.category === 'communication').length,
          aviation: types.filter(t => t.metadata.category === 'aviation').length,
          spatial: types.filter(t => t.metadata.category === 'spatial').length,
          analytics: types.filter(t => t.metadata.category === 'analytics').length
        }
      }
    });
  } catch (error) {
    console.error('Error getting discovered connectors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export the router
module.exports = router; 