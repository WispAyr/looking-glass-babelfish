const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const winston = require('winston');

/**
 * Configuration Manager
 * 
 * Centralized configuration management for the entire application.
 * Handles configuration validation, persistence, and dynamic updates.
 */
class ConfigManager extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || winston.createLogger();
    
    // Configuration storage
    this.configs = new Map();
    this.configTemplates = new Map();
    this.configValidators = new Map();
    
    // Configuration categories
    this.categories = {
      connectors: 'connector-configurations',
      maps: 'map-configurations', 
      rules: 'rule-configurations',
      analytics: 'analytics-configurations',
      gui: 'gui-configurations',
      system: 'system-configurations'
    };
    
    // Database service reference
    this.databaseService = null;
    
    this.logger.info('Configuration Manager initialized');
  }

  /**
   * Set database service reference
   */
  setDatabaseService(databaseService) {
    this.databaseService = databaseService;
  }

  /**
   * Initialize configuration manager
   */
  async initialize() {
    // Load configuration templates
    await this.loadConfigurationTemplates();
    
    // Load existing configurations from database
    if (this.databaseService) {
      await this.loadStoredConfigurations();
    }
    
    this.logger.info('Configuration Manager initialized');
  }

  /**
   * Load configuration templates
   */
  async loadConfigurationTemplates() {
    // Connector templates
    this.configTemplates.set('unifi-protect', {
      name: 'UniFi Protect Connector',
      description: 'Connect to UniFi Protect NVR',
      fields: [
        { name: 'host', type: 'string', required: true, description: 'NVR IP address' },
        { name: 'port', type: 'number', required: false, default: 443, description: 'NVR port' },
        { name: 'protocol', type: 'string', required: false, default: 'https', enum: ['http', 'https'] },
        { name: 'apiKey', type: 'string', required: true, description: 'API key' },
        { name: 'username', type: 'string', required: false, description: 'Username' },
        { name: 'password', type: 'string', required: false, description: 'Password' },
        { name: 'verifySSL', type: 'boolean', required: false, default: true },
        { name: 'timeout', type: 'number', required: false, default: 10000 }
      ]
    });

    this.configTemplates.set('mqtt', {
      name: 'MQTT Connector',
      description: 'Connect to MQTT broker',
      fields: [
        { name: 'host', type: 'string', required: true, description: 'Broker host' },
        { name: 'port', type: 'number', required: false, default: 1883, description: 'Broker port' },
        { name: 'username', type: 'string', required: false, description: 'Username' },
        { name: 'password', type: 'string', required: false, description: 'Password' },
        { name: 'clientId', type: 'string', required: false, description: 'Client ID' },
        { name: 'topics', type: 'array', required: false, description: 'Topics to subscribe to' }
      ]
    });

    this.configTemplates.set('map', {
      name: 'Map Configuration',
      description: 'Configure map settings',
      fields: [
        { name: 'autoRegisterConnectors', type: 'boolean', required: false, default: true },
        { name: 'enableWebSockets', type: 'boolean', required: false, default: true },
        { name: 'editMode', type: 'boolean', required: false, default: false },
        { name: 'viewMode', type: 'string', required: false, default: 'realtime', enum: ['realtime', 'playback', 'edit'] }
      ]
    });

    this.configTemplates.set('web-gui', {
      name: 'Web GUI Configuration',
      description: 'Configure web interface',
      fields: [
        { name: 'theme', type: 'string', required: false, default: 'dark', enum: ['dark', 'light'] },
        { name: 'layout', type: 'string', required: false, default: 'default', enum: ['default', 'compact', 'wide'] },
        { name: 'autoRegisterWithMaps', type: 'boolean', required: false, default: true },
        { name: 'autoDiscoverConnectors', type: 'boolean', required: false, default: true }
      ]
    });
  }

  /**
   * Load stored configurations from database
   */
  async loadStoredConfigurations() {
    try {
      for (const [category, categoryName] of Object.entries(this.categories)) {
        const configs = await this.databaseService.all(
          'SELECT * FROM configurations WHERE category = ? ORDER BY version DESC',
          [categoryName]
        );
        
        for (const config of configs) {
          this.configs.set(config.id, {
            ...config,
            config: JSON.parse(config.config)
          });
        }
      }
      
      this.logger.info(`Loaded ${this.configs.size} stored configurations`);
    } catch (error) {
      this.logger.error('Failed to load stored configurations:', error);
    }
  }

  /**
   * Save configuration
   */
  async saveConfiguration(category, name, config, validate = true) {
    try {
      // Validate configuration if template exists
      if (validate && this.configTemplates.has(name)) {
        const validation = this.validateConfiguration(name, config);
        if (!validation.valid) {
          throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Save to database
      if (this.databaseService) {
        const categoryName = this.categories[category] || category;
        await this.databaseService.saveConfiguration(categoryName, name, config);
      }

      // Store in memory
      const configId = `${category}:${name}`;
      this.configs.set(configId, {
        id: configId,
        category,
        name,
        config,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      this.emit('configuration:saved', { category, name, config });
      this.logger.info(`Configuration saved: ${configId}`);

      return { success: true, configId };
    } catch (error) {
      this.logger.error(`Failed to save configuration ${category}:${name}:`, error);
      throw error;
    }
  }

  /**
   * Get configuration
   */
  async getConfiguration(category, name) {
    const configId = `${category}:${name}`;
    
    // Check memory first
    if (this.configs.has(configId)) {
      return this.configs.get(configId);
    }

    // Check database
    if (this.databaseService) {
      const categoryName = this.categories[category] || category;
      const config = await this.databaseService.getConfiguration(categoryName, name);
      
      if (config) {
        this.configs.set(configId, config);
        return config;
      }
    }

    return null;
  }

  /**
   * Get all configurations for a category
   */
  async getConfigurationsByCategory(category) {
    const categoryName = this.categories[category] || category;
    const configs = [];
    
    // Get from memory
    for (const [configId, config] of this.configs.entries()) {
      if (config.category === category) {
        configs.push(config);
      }
    }

    // Get from database if not in memory
    if (this.databaseService) {
      const dbConfigs = await this.databaseService.all(
        'SELECT * FROM configurations WHERE category = ? ORDER BY version DESC',
        [categoryName]
      );
      
      for (const dbConfig of dbConfigs) {
        const configId = `${category}:${dbConfig.name}`;
        if (!this.configs.has(configId)) {
          const config = {
            ...dbConfig,
            config: JSON.parse(dbConfig.config)
          };
          this.configs.set(configId, config);
          configs.push(config);
        }
      }
    }

    return configs;
  }

  /**
   * Delete configuration
   */
  async deleteConfiguration(category, name) {
    const configId = `${category}:${name}`;
    
    // Remove from memory
    this.configs.delete(configId);
    
    // Remove from database
    if (this.databaseService) {
      const categoryName = this.categories[category] || category;
      await this.databaseService.run(
        'DELETE FROM configurations WHERE category = ? AND name = ?',
        [categoryName, name]
      );
    }

    this.emit('configuration:deleted', { category, name });
    this.logger.info(`Configuration deleted: ${configId}`);

    return { success: true };
  }

  /**
   * Validate configuration against template
   */
  validateConfiguration(templateName, config) {
    const template = this.configTemplates.get(templateName);
    if (!template) {
      return { valid: true, errors: [] }; // No template, assume valid
    }

    const errors = [];
    
    for (const field of template.fields) {
      const value = config[field.name];
      
      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`Field '${field.name}' is required`);
        continue;
      }
      
      // Skip validation if value is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }
      
      // Type validation
      switch (field.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`Field '${field.name}' must be a string`);
          }
          break;
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`Field '${field.name}' must be a number`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`Field '${field.name}' must be a boolean`);
          }
          break;
        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`Field '${field.name}' must be an array`);
          }
          break;
      }
      
      // Enum validation
      if (field.enum && !field.enum.includes(value)) {
        errors.push(`Field '${field.name}' must be one of: ${field.enum.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration template
   */
  getConfigurationTemplate(templateName) {
    return this.configTemplates.get(templateName);
  }

  /**
   * Get all configuration templates
   */
  getAllConfigurationTemplates() {
    return Array.from(this.configTemplates.entries()).map(([name, template]) => ({
      name,
      ...template
    }));
  }

  /**
   * Export configurations
   */
  async exportConfigurations(category = null) {
    const exportData = {
      version: '1.0.0',
      exported: new Date().toISOString(),
      configurations: []
    };

    if (category) {
      const configs = await this.getConfigurationsByCategory(category);
      exportData.configurations = configs;
    } else {
      for (const [configId, config] of this.configs.entries()) {
        exportData.configurations.push(config);
      }
    }

    return exportData;
  }

  /**
   * Import configurations
   */
  async importConfigurations(importData) {
    if (!importData.configurations || !Array.isArray(importData.configurations)) {
      throw new Error('Invalid import data format');
    }

    const results = {
      imported: 0,
      failed: 0,
      errors: []
    };

    for (const config of importData.configurations) {
      try {
        await this.saveConfiguration(config.category, config.name, config.config, false);
        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          config: config.name,
          error: error.message
        });
      }
    }

    this.logger.info(`Configuration import completed: ${results.imported} imported, ${results.failed} failed`);
    return results;
  }

  /**
   * Get configuration statistics
   */
  async getStats() {
    const stats = {
      totalConfigurations: this.configs.size,
      configurationsByCategory: {},
      templates: this.configTemplates.size
    };

    // Count by category
    for (const [configId, config] of this.configs.entries()) {
      const category = config.category;
      stats.configurationsByCategory[category] = (stats.configurationsByCategory[category] || 0) + 1;
    }

    return stats;
  }
}

module.exports = ConfigManager; 