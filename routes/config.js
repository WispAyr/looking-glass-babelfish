const express = require('express');
const router = express.Router();

/**
 * Configuration Management API Routes
 * 
 * Provides REST API endpoints for managing configurations,
 * setup wizard, and system settings.
 */

module.exports = function(configManager, setupWizard, databaseService) {
  
  /**
   * GET /api/config/templates
   * Get all configuration templates
   */
  router.get('/templates', async (req, res) => {
    try {
      const templates = configManager.getAllConfigurationTemplates();
      res.json({
        success: true,
        templates
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/config/templates/:name
   * Get specific configuration template
   */
  router.get('/templates/:name', async (req, res) => {
    try {
      const template = configManager.getConfigurationTemplate(req.params.name);
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }
      
      res.json({
        success: true,
        template
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/config/:category
   * Get all configurations for a category
   */
  router.get('/:category', async (req, res) => {
    try {
      const configs = await configManager.getConfigurationsByCategory(req.params.category);
      res.json({
        success: true,
        configs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/config/:category/:name
   * Get specific configuration
   */
  router.get('/:category/:name', async (req, res) => {
    try {
      const config = await configManager.getConfiguration(req.params.category, req.params.name);
      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }
      
      res.json({
        success: true,
        config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/config/:category/:name
   * Create or update configuration
   */
  router.post('/:category/:name', async (req, res) => {
    try {
      const { category, name } = req.params;
      const configData = req.body;
      
      const result = await configManager.saveConfiguration(category, name, configData);
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/config/:category/:name
   * Delete configuration
   */
  router.delete('/:category/:name', async (req, res) => {
    try {
      const { category, name } = req.params;
      
      const result = await configManager.deleteConfiguration(category, name);
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/config/validate
   * Validate configuration against template
   */
  router.post('/validate', async (req, res) => {
    try {
      const { templateName, config } = req.body;
      
      const validation = configManager.validateConfiguration(templateName, config);
      
      res.json({
        success: true,
        validation
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/config/export
   * Export configurations
   */
  router.get('/export/:category?', async (req, res) => {
    try {
      const category = req.params.category || null;
      const exportData = await configManager.exportConfigurations(category);
      
      res.json({
        success: true,
        export: exportData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/config/import
   * Import configurations
   */
  router.post('/import', async (req, res) => {
    try {
      const importData = req.body;
      
      const results = await configManager.importConfigurations(importData);
      
      res.json({
        success: true,
        results
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/config/stats
   * Get configuration statistics
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = await configManager.getStats();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Setup Wizard Routes

  /**
   * GET /api/setup/status
   * Get setup status
   */
  router.get('/setup/status', async (req, res) => {
    try {
      const progress = setupWizard.getSetupProgress();
      const summary = setupWizard.getSetupSummary();
      
      res.json({
        success: true,
        progress,
        summary
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/setup/start
   * Start setup process
   */
  router.post('/setup/start', async (req, res) => {
    try {
      const currentStep = await setupWizard.startSetup();
      
      res.json({
        success: true,
        currentStep
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/setup/steps
   * Get all setup steps
   */
  router.get('/setup/steps', async (req, res) => {
    try {
      const steps = setupWizard.getAllSteps();
      
      res.json({
        success: true,
        steps
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/setup/current
   * Get current setup step
   */
  router.get('/setup/current', async (req, res) => {
    try {
      const currentStep = setupWizard.getCurrentStep();
      
      res.json({
        success: true,
        currentStep
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/setup/next
   * Go to next setup step
   */
  router.post('/setup/next', async (req, res) => {
    try {
      const nextStep = await setupWizard.nextStep();
      
      res.json({
        success: true,
        nextStep
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/setup/previous
   * Go to previous setup step
   */
  router.post('/setup/previous', async (req, res) => {
    try {
      const previousStep = await setupWizard.previousStep();
      
      res.json({
        success: true,
        previousStep
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/setup/step/:index
   * Go to specific setup step
   */
  router.post('/setup/step/:index', async (req, res) => {
    try {
      const stepIndex = parseInt(req.params.index);
      const step = await setupWizard.goToStep(stepIndex);
      
      res.json({
        success: true,
        step
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/setup/submit
   * Submit step data
   */
  router.post('/setup/submit', async (req, res) => {
    try {
      const { data } = req.body;
      
      const result = await setupWizard.submitStepData(data);
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/setup/reset
   * Reset setup
   */
  router.post('/setup/reset', async (req, res) => {
    try {
      await setupWizard.resetSetup();
      
      res.json({
        success: true,
        message: 'Setup reset successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Database Routes

  /**
   * GET /api/database/stats
   * Get database statistics
   */
  router.get('/database/stats', async (req, res) => {
    try {
      const stats = await databaseService.getStats();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/database/cleanup
   * Run database cleanup
   */
  router.post('/database/cleanup', async (req, res) => {
    try {
      await databaseService.cleanup();
      
      res.json({
        success: true,
        message: 'Database cleanup completed'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}; 