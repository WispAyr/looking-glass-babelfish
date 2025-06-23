const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

/**
 * Serve the Display Manager GUI
 */
router.get('/manager', async (req, res) => {
  try {
    const guiPath = path.join(__dirname, '../templates/display/display-manager-gui.html');
    const html = await fs.readFile(guiPath, 'utf8');
    res.send(html);
  } catch (error) {
    console.error('Error serving Display Manager GUI:', error);
    res.status(500).send('Error loading Display Manager GUI');
  }
});

/**
 * Get display manager status
 */
router.get('/api/status', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const status = displayManager.getDisplayManagerStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Error getting display manager status:', error);
    res.status(500).json({ error: 'Failed to get display manager status' });
  }
});

/**
 * Get all displays
 */
router.get('/api/displays', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const displays = Array.from(displayManager.displays.values());
    res.json({ success: true, data: displays });
  } catch (error) {
    console.error('Error getting displays:', error);
    res.status(500).json({ error: 'Failed to get displays' });
  }
});

/**
 * Get all views
 */
router.get('/api/views', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const views = Array.from(displayManager.views.values());
    res.json({ success: true, data: views });
  } catch (error) {
    console.error('Error getting views:', error);
    res.status(500).json({ error: 'Failed to get views' });
  }
});

/**
 * Get all templates
 */
router.get('/api/templates', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const templates = Array.from(displayManager.templates.values());
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

/**
 * Create a new display
 */
router.post('/api/displays', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const result = await displayManager.executeCapability('display:management', 'create', req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating display:', error);
    res.status(500).json({ error: 'Failed to create display' });
  }
});

/**
 * Update a display
 */
router.put('/api/displays/:id', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const result = await displayManager.executeCapability('display:management', 'update', {
      ...req.body,
      id: req.params.id
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating display:', error);
    res.status(500).json({ error: 'Failed to update display' });
  }
});

/**
 * Delete a display
 */
router.delete('/api/displays/:id', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const result = await displayManager.executeCapability('display:management', 'delete', {
      id: req.params.id
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error deleting display:', error);
    res.status(500).json({ error: 'Failed to delete display' });
  }
});

/**
 * Activate a display
 */
router.post('/api/displays/:id/activate', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const result = await displayManager.executeCapability('display:management', 'activate', {
      id: req.params.id
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error activating display:', error);
    res.status(500).json({ error: 'Failed to activate display' });
  }
});

/**
 * Deactivate a display
 */
router.post('/api/displays/:id/deactivate', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const result = await displayManager.executeCapability('display:management', 'deactivate', {
      id: req.params.id
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error deactivating display:', error);
    res.status(500).json({ error: 'Failed to deactivate display' });
  }
});

/**
 * Blackout a display
 */
router.post('/api/displays/:id/blackout', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const result = await displayManager.executeCapability('display:management', 'blackout', {
      id: req.params.id
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error blacking out display:', error);
    res.status(500).json({ error: 'Failed to blackout display' });
  }
});

/**
 * Create a new view
 */
router.post('/api/views', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const result = await displayManager.executeCapability('display:views', 'create', req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating view:', error);
    res.status(500).json({ error: 'Failed to create view' });
  }
});

/**
 * Apply a view to displays
 */
router.post('/api/views/:id/apply', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const result = await displayManager.executeCapability('display:views', 'apply', {
      viewId: req.params.id,
      displayIds: req.body.displayIds
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error applying view:', error);
    res.status(500).json({ error: 'Failed to apply view' });
  }
});

/**
 * Create a new template
 */
router.post('/api/templates', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const result = await displayManager.executeCapability('display:templates', 'create', req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * Apply a template to displays
 */
router.post('/api/templates/:id/apply', async (req, res) => {
  try {
    const displayManager = req.app.locals.connectorRegistry?.getConnector('display-manager-main');
    if (!displayManager) {
      return res.status(404).json({ error: 'Display Manager not found' });
    }

    const result = await displayManager.executeCapability('display:templates', 'apply', {
      templateId: req.params.id,
      displayIds: req.body.displayIds
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

module.exports = router; 