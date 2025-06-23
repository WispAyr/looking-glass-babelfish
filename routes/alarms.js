const express = require('express');
const router = express.Router();
const path = require('path');
const AlarmManagerService = require('../services/alarmManagerService');

// Initialize alarm manager service
const alarmService = new AlarmManagerService();

// Initialize service on startup
(async () => {
  try {
    await alarmService.initialize();
  } catch (error) {
    console.error('Failed to initialize alarm service:', error);
  }
})();

/**
 * GET /alarms
 * Serve the alarm manager web interface
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/alarms.html'));
});

/**
 * GET /alarms/api
 * Get all alarm rules
 */
router.get('/api', async (req, res) => {
  try {
    const rules = await alarmService.getAllRules();
    res.json({
      success: true,
      data: rules,
      count: rules.length
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
 * Get alarm statistics
 */
router.get('/api/stats', async (req, res) => {
  try {
    const stats = await alarmService.getStats();
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
 * Get alarm history
 */
router.get('/api/history', async (req, res) => {
  try {
    const { limit = 100, offset = 0, status, ruleId, eventType } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (ruleId) filters.ruleId = ruleId;
    if (eventType) filters.eventType = eventType;
    
    const history = await alarmService.getAlarmHistory(
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
 * Test an alarm rule
 */
router.post('/api/test', async (req, res) => {
  try {
    const { ruleId, eventData } = req.body;
    
    // Record a test alarm trigger
    const alarmId = await alarmService.recordAlarmTrigger(
      ruleId,
      'test',
      'test',
      eventData || {}
    );
    
    res.json({
      success: true,
      data: { alarmId },
      message: 'Test alarm triggered successfully'
    });
  } catch (error) {
    console.error('Error testing alarm:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /alarms/api/categories/:category
 * Get rules by category
 */
router.get('/api/categories/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const rules = await alarmService.getRulesByCategory(category);
    res.json({
      success: true,
      data: rules,
      count: rules.length
    });
  } catch (error) {
    console.error('Error getting rules by category:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /alarms/api/enabled
 * Get enabled rules only
 */
router.get('/api/enabled', async (req, res) => {
  try {
    const rules = await alarmService.getEnabledRules();
    res.json({
      success: true,
      data: rules,
      count: rules.length
    });
  } catch (error) {
    console.error('Error getting enabled rules:', error);
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
    const rule = await alarmService.getRule(id);
    
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
 * POST /alarms/api
 * Create a new alarm rule
 */
router.post('/api', async (req, res) => {
  try {
    const ruleData = req.body;
    const newRule = await alarmService.createRule(ruleData);
    
    res.status(201).json({
      success: true,
      data: newRule,
      message: 'Alarm rule created successfully'
    });
  } catch (error) {
    console.error('Error creating alarm rule:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /alarms/api/:id
 * Update an existing alarm rule
 */
router.put('/api/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updatedRule = await alarmService.updateRule(id, updates);
    
    res.json({
      success: true,
      data: updatedRule,
      message: 'Alarm rule updated successfully'
    });
  } catch (error) {
    console.error('Error updating alarm rule:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /alarms/api/:id
 * Delete an alarm rule
 */
router.delete('/api/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await alarmService.deleteRule(id);
    
    res.json({
      success: true,
      message: 'Alarm rule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting alarm rule:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /alarms/api/:id/acknowledge
 * Acknowledge an alarm
 */
router.post('/api/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, notes } = req.body;
    
    await alarmService.acknowledgeAlarm(id, userId, notes);
    
    res.json({
      success: true,
      message: 'Alarm acknowledged successfully'
    });
  } catch (error) {
    console.error('Error acknowledging alarm:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /alarms/api/:id/resolve
 * Resolve an alarm
 */
router.post('/api/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    await alarmService.resolveAlarm(id, userId);
    
    res.json({
      success: true,
      message: 'Alarm resolved successfully'
    });
  } catch (error) {
    console.error('Error resolving alarm:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 