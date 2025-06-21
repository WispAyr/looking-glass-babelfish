const express = require('express');
const router = express.Router();

/**
 * GET /api/flows
 * List all flows
 */
router.get('/', (req, res) => {
  try {
    const flowBuilder = req.app.locals.flowBuilder;
    if (!flowBuilder) {
      return res.status(503).json({ success: false, error: 'Flow Builder not available' });
    }

    const flows = flowBuilder.listFlows();
    res.json({
      success: true,
      data: flows,
      total: flows.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/flows/templates
 * Get available flow templates
 */
router.get('/templates', (req, res) => {
  try {
    const flowBuilder = req.app.locals.flowBuilder;
    if (!flowBuilder) {
      return res.status(503).json({ success: false, error: 'Flow Builder not available' });
    }

    const templates = flowBuilder.getTemplates();
    res.json({
      success: true,
      data: templates,
      total: templates.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/flows/:flowId
 * Get a specific flow
 */
router.get('/:flowId', (req, res) => {
  try {
    const flowBuilder = req.app.locals.flowBuilder;
    if (!flowBuilder) {
      return res.status(503).json({ success: false, error: 'Flow Builder not available' });
    }

    const flow = flowBuilder.getFlow(req.params.flowId);
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/flows
 * Create a new flow
 */
router.post('/', async (req, res) => {
  try {
    const flowBuilder = req.app.locals.flowBuilder;
    if (!flowBuilder) {
      return res.status(503).json({ success: false, error: 'Flow Builder not available' });
    }

    const flowData = req.body;
    
    // Validate flow data
    const errors = flowBuilder.validateFlow(flowData);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid flow data',
        details: errors
      });
    }

    const flow = await flowBuilder.createFlow(flowData);
    res.status(201).json({
      success: true,
      data: flow
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/flows/template/:templateId
 * Create flow from template
 */
router.post('/template/:templateId', async (req, res) => {
  try {
    const flowBuilder = req.app.locals.flowBuilder;
    if (!flowBuilder) {
      return res.status(503).json({ success: false, error: 'Flow Builder not available' });
    }

    const templateId = req.params.templateId;
    const customizations = req.body || {};

    const flow = await flowBuilder.createFromTemplate(templateId, customizations);
    res.status(201).json({
      success: true,
      data: flow
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/flows/:flowId
 * Update a flow
 */
router.put('/:flowId', async (req, res) => {
  try {
    const flowBuilder = req.app.locals.flowBuilder;
    if (!flowBuilder) {
      return res.status(503).json({ success: false, error: 'Flow Builder not available' });
    }

    const flowId = req.params.flowId;
    const updates = req.body;

    // Validate updates if they include flow structure
    if (updates.nodes || updates.connections) {
      const currentFlow = flowBuilder.getFlow(flowId);
      if (!currentFlow) {
        return res.status(404).json({ success: false, error: 'Flow not found' });
      }

      const updatedFlow = { ...currentFlow, ...updates };
      const errors = flowBuilder.validateFlow(updatedFlow);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid flow data',
          details: errors
        });
      }
    }

    const flow = await flowBuilder.updateFlow(flowId, updates);
    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/flows/:flowId
 * Delete a flow
 */
router.delete('/:flowId', async (req, res) => {
  try {
    const flowBuilder = req.app.locals.flowBuilder;
    if (!flowBuilder) {
      return res.status(503).json({ success: false, error: 'Flow Builder not available' });
    }

    const flowId = req.params.flowId;
    await flowBuilder.deleteFlow(flowId);
    
    res.json({
      success: true,
      message: `Flow ${flowId} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/flows/:flowId/execute
 * Execute a flow
 */
router.post('/:flowId/execute', async (req, res) => {
  try {
    const flowBuilder = req.app.locals.flowBuilder;
    if (!flowBuilder) {
      return res.status(503).json({ success: false, error: 'Flow Builder not available' });
    }

    const flowId = req.params.flowId;
    const context = req.body || {};

    const result = await flowBuilder.executeFlow(flowId, context);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/flows/:flowId/enable
 * Enable a flow
 */
router.post('/:flowId/enable', async (req, res) => {
  try {
    const flowBuilder = req.app.locals.flowBuilder;
    if (!flowBuilder) {
      return res.status(503).json({ success: false, error: 'Flow Builder not available' });
    }

    const flowId = req.params.flowId;
    const flow = await flowBuilder.updateFlow(flowId, { enabled: true });
    
    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/flows/:flowId/disable
 * Disable a flow
 */
router.post('/:flowId/disable', async (req, res) => {
  try {
    const flowBuilder = req.app.locals.flowBuilder;
    if (!flowBuilder) {
      return res.status(503).json({ success: false, error: 'Flow Builder not available' });
    }

    const flowId = req.params.flowId;
    const flow = await flowBuilder.updateFlow(flowId, { enabled: false });
    
    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/flows/:flowId/status
 * Get flow execution status
 */
router.get('/:flowId/status', (req, res) => {
  try {
    const flowBuilder = req.app.locals.flowBuilder;
    if (!flowBuilder) {
      return res.status(503).json({ success: false, error: 'Flow Builder not available' });
    }

    const flowId = req.params.flowId;
    const isExecuting = flowBuilder.executingFlows.has(flowId);
    const flow = flowBuilder.getFlow(flowId);
    
    res.json({
      success: true,
      data: {
        flowId,
        isExecuting,
        enabled: flow?.enabled || false,
        lastExecuted: flow?.lastExecuted,
        executionCount: flow?.executionCount || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 