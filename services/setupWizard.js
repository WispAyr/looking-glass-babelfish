const EventEmitter = require('events');
const winston = require('winston');

/**
 * Setup Wizard Service
 * 
 * Guides users through initial configuration and connector setup.
 * Provides step-by-step setup process with validation and auto-discovery.
 */
class SetupWizard extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || winston.createLogger();
    
    // Service references
    this.configManager = null;
    this.connectorRegistry = null;
    this.databaseService = null;
    
    // Setup state
    this.setupState = {
      completed: false,
      currentStep: 0,
      steps: [],
      data: {}
    };
    
    // Setup steps
    this.setupSteps = [
      {
        id: 'welcome',
        name: 'Welcome',
        description: 'Welcome to Babelfish Looking Glass Setup',
        type: 'welcome',
        required: false
      },
      {
        id: 'system-config',
        name: 'System Configuration',
        description: 'Configure basic system settings',
        type: 'form',
        required: true,
        fields: [
          { name: 'serverName', type: 'string', required: true, label: 'Server Name', description: 'Name for this server instance' },
          { name: 'environment', type: 'string', required: true, label: 'Environment', enum: ['development', 'production'], default: 'development' },
          { name: 'logLevel', type: 'string', required: false, label: 'Log Level', enum: ['debug', 'info', 'warn', 'error'], default: 'info' }
        ]
      },
      {
        id: 'database-setup',
        name: 'Database Setup',
        description: 'Configure database settings',
        type: 'form',
        required: true,
        fields: [
          { name: 'enabled', type: 'boolean', required: false, label: 'Enable Database', default: true },
          { name: 'type', type: 'string', required: false, label: 'Database Type', enum: ['sqlite', 'mysql', 'postgresql'], default: 'sqlite' },
          { name: 'host', type: 'string', required: false, label: 'Database Host', description: 'Leave empty for SQLite' },
          { name: 'port', type: 'number', required: false, label: 'Database Port', description: 'Leave empty for SQLite' },
          { name: 'name', type: 'string', required: false, label: 'Database Name', default: 'babelfish' },
          { name: 'username', type: 'string', required: false, label: 'Database Username' },
          { name: 'password', type: 'string', required: false, label: 'Database Password' }
        ]
      },
      {
        id: 'connector-discovery',
        name: 'Connector Discovery',
        description: 'Discover and configure connectors',
        type: 'discovery',
        required: false,
        autoDiscovery: true
      },
      {
        id: 'unifi-protect-setup',
        name: 'UniFi Protect Setup',
        description: 'Configure UniFi Protect connector',
        type: 'connector',
        connectorType: 'unifi-protect',
        required: false,
        fields: [
          { name: 'host', type: 'string', required: true, label: 'NVR IP Address' },
          { name: 'port', type: 'number', required: false, label: 'Port', default: 443 },
          { name: 'protocol', type: 'string', required: false, label: 'Protocol', enum: ['http', 'https'], default: 'https' },
          { name: 'apiKey', type: 'string', required: true, label: 'API Key' },
          { name: 'username', type: 'string', required: false, label: 'Username' },
          { name: 'password', type: 'string', required: false, label: 'Password' }
        ]
      },
      {
        id: 'mqtt-setup',
        name: 'MQTT Setup',
        description: 'Configure MQTT connector',
        type: 'connector',
        connectorType: 'mqtt',
        required: false,
        fields: [
          { name: 'host', type: 'string', required: true, label: 'MQTT Broker Host' },
          { name: 'port', type: 'number', required: false, label: 'Port', default: 1883 },
          { name: 'username', type: 'string', required: false, label: 'Username' },
          { name: 'password', type: 'string', required: false, label: 'Password' },
          { name: 'clientId', type: 'string', required: false, label: 'Client ID', default: 'babelfish-lookingglass' }
        ]
      },
      {
        id: 'map-setup',
        name: 'Map Configuration',
        description: 'Configure map settings',
        type: 'form',
        required: false,
        fields: [
          { name: 'autoRegisterConnectors', type: 'boolean', required: false, label: 'Auto-register Connectors', default: true },
          { name: 'enableWebSockets', type: 'boolean', required: false, label: 'Enable WebSockets', default: true },
          { name: 'editMode', type: 'boolean', required: false, label: 'Enable Edit Mode', default: false }
        ]
      },
      {
        id: 'gui-setup',
        name: 'Web Interface Setup',
        description: 'Configure web interface settings',
        type: 'form',
        required: false,
        fields: [
          { name: 'theme', type: 'string', required: false, label: 'Theme', enum: ['dark', 'light'], default: 'dark' },
          { name: 'layout', type: 'string', required: false, label: 'Layout', enum: ['default', 'compact', 'wide'], default: 'default' },
          { name: 'autoRegisterWithMaps', type: 'boolean', required: false, label: 'Auto-register with Maps', default: true }
        ]
      },
      {
        id: 'rules-setup',
        name: 'Rules Configuration',
        description: 'Configure default rules and automation',
        type: 'rules',
        required: false
      },
      {
        id: 'completion',
        name: 'Setup Complete',
        description: 'Setup completed successfully',
        type: 'completion',
        required: false
      }
    ];
    
    this.logger.info('Setup Wizard initialized');
  }

  /**
   * Set service references
   */
  setServices(configManager, connectorRegistry, databaseService) {
    this.configManager = configManager;
    this.connectorRegistry = connectorRegistry;
    this.databaseService = databaseService;
  }

  /**
   * Initialize setup wizard
   */
  async initialize() {
    // Check if setup is already completed
    const setupConfig = await this.configManager.getConfiguration('system', 'setup');
    if (setupConfig) {
      this.setupState.completed = setupConfig.config.completed || false;
    }
    
    // Initialize steps
    this.setupState.steps = [...this.setupSteps];
    
    this.logger.info('Setup Wizard initialized');
  }

  /**
   * Start setup process
   */
  async startSetup() {
    this.setupState.currentStep = 0;
    this.setupState.data = {};
    this.setupState.completed = false;
    
    this.emit('setup:started', this.getCurrentStep());
    this.logger.info('Setup process started');
    
    return this.getCurrentStep();
  }

  /**
   * Get current step
   */
  getCurrentStep() {
    if (this.setupState.currentStep >= this.setupState.steps.length) {
      return null;
    }
    
    const step = this.setupState.steps[this.setupState.currentStep];
    return {
      ...step,
      stepNumber: this.setupState.currentStep + 1,
      totalSteps: this.setupState.steps.length,
      canProceed: this.canProceedToNext(),
      canGoBack: this.setupState.currentStep > 0
    };
  }

  /**
   * Get all steps
   */
  getAllSteps() {
    return this.setupState.steps.map((step, index) => ({
      ...step,
      stepNumber: index + 1,
      completed: index < this.setupState.currentStep,
      current: index === this.setupState.currentStep
    }));
  }

  /**
   * Go to next step
   */
  async nextStep() {
    if (this.setupState.currentStep < this.setupState.steps.length - 1) {
      this.setupState.currentStep++;
      
      const currentStep = this.getCurrentStep();
      this.emit('setup:step-changed', currentStep);
      
      // Auto-execute step if needed
      if (currentStep.type === 'discovery' && currentStep.autoDiscovery) {
        await this.executeDiscoveryStep();
      }
      
      return currentStep;
    }
    
    return null;
  }

  /**
   * Go to previous step
   */
  async previousStep() {
    if (this.setupState.currentStep > 0) {
      this.setupState.currentStep--;
      
      const currentStep = this.getCurrentStep();
      this.emit('setup:step-changed', currentStep);
      
      return currentStep;
    }
    
    return null;
  }

  /**
   * Go to specific step
   */
  async goToStep(stepIndex) {
    if (stepIndex >= 0 && stepIndex < this.setupState.steps.length) {
      this.setupState.currentStep = stepIndex;
      
      const currentStep = this.getCurrentStep();
      this.emit('setup:step-changed', currentStep);
      
      return currentStep;
    }
    
    return null;
  }

  /**
   * Submit step data
   */
  async submitStepData(data) {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      throw new Error('No current step');
    }
    
    // Validate step data
    if (currentStep.fields) {
      const validation = this.validateStepData(currentStep, data);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    // Store step data
    this.setupState.data[currentStep.id] = data;
    
    // Execute step-specific logic
    await this.executeStep(currentStep, data);
    
    this.emit('setup:step-completed', { step: currentStep, data });
    
    return { success: true };
  }

  /**
   * Validate step data
   */
  validateStepData(step, data) {
    if (!step.fields) {
      return { valid: true, errors: [] };
    }
    
    const errors = [];
    
    for (const field of step.fields) {
      const value = data[field.name];
      
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
   * Execute step-specific logic
   */
  async executeStep(step, data) {
    switch (step.type) {
      case 'form':
        await this.executeFormStep(step, data);
        break;
      case 'connector':
        await this.executeConnectorStep(step, data);
        break;
      case 'discovery':
        await this.executeDiscoveryStep();
        break;
      case 'rules':
        await this.executeRulesStep(data);
        break;
      case 'completion':
        await this.executeCompletionStep();
        break;
    }
  }

  /**
   * Execute form step
   */
  async executeFormStep(step, data) {
    switch (step.id) {
      case 'system-config':
        await this.configManager.saveConfiguration('system', 'system', data);
        break;
      case 'database-setup':
        await this.configManager.saveConfiguration('system', 'database', data);
        break;
      case 'map-setup':
        await this.configManager.saveConfiguration('maps', 'default', data);
        break;
      case 'gui-setup':
        await this.configManager.saveConfiguration('gui', 'default', data);
        break;
    }
  }

  /**
   * Execute connector step
   */
  async executeConnectorStep(step, data) {
    if (step.connectorType === 'unifi-protect') {
      // Create connector configuration
      const connectorConfig = {
        id: 'communications-van',
        type: 'unifi-protect',
        name: 'Communications Van System',
        description: 'Primary UniFi Protect system',
        config: data
      };
      
      await this.configManager.saveConfiguration('connectors', connectorConfig.id, connectorConfig);
      
      // Create connector instance if registry is available
      if (this.connectorRegistry) {
        try {
          await this.connectorRegistry.createConnector(connectorConfig);
        } catch (error) {
          this.logger.warn('Failed to create connector instance:', error.message);
        }
      }
    } else if (step.connectorType === 'mqtt') {
      // Create MQTT connector configuration
      const connectorConfig = {
        id: 'mqtt-broker',
        type: 'mqtt',
        name: 'MQTT Broker',
        description: 'MQTT message broker',
        config: data
      };
      
      await this.configManager.saveConfiguration('connectors', connectorConfig.id, connectorConfig);
    }
  }

  /**
   * Execute discovery step
   */
  async executeDiscoveryStep() {
    const discoveredConnectors = [];
    
    // Auto-discover UniFi Protect systems
    try {
      const commonHosts = ['10.0.0.1', '192.168.1.1', '192.168.0.1'];
      
      for (const host of commonHosts) {
        try {
          // This would need actual network discovery logic
          // For now, just add to discovered list
          discoveredConnectors.push({
            type: 'unifi-protect',
            host,
            discovered: new Date().toISOString()
          });
        } catch (error) {
          // Host not reachable, continue
        }
      }
    } catch (error) {
      this.logger.warn('Discovery failed:', error.message);
    }
    
    this.setupState.data.discovery = {
      discoveredConnectors,
      timestamp: new Date().toISOString()
    };
    
    this.emit('setup:discovery-completed', discoveredConnectors);
  }

  /**
   * Execute rules step
   */
  async executeRulesStep(data) {
    // Load default rules
    const defaultRules = require('../config/defaultRules.js');
    
    for (const rule of defaultRules) {
      await this.configManager.saveConfiguration('rules', rule.id, rule);
    }
    
    this.setupState.data.rules = {
      importedRules: defaultRules.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute completion step
   */
  async executeCompletionStep() {
    // Mark setup as completed
    await this.configManager.saveConfiguration('system', 'setup', {
      completed: true,
      completedAt: new Date().toISOString(),
      steps: this.setupState.steps.length,
      data: this.setupState.data
    });
    
    this.setupState.completed = true;
    
    this.emit('setup:completed', {
      completedAt: new Date().toISOString(),
      steps: this.setupState.steps.length
    });
  }

  /**
   * Check if can proceed to next step
   */
  canProceedToNext() {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      return false;
    }
    
    // Check if current step data is available
    if (currentStep.required && !this.setupState.data[currentStep.id]) {
      return false;
    }
    
    return true;
  }

  /**
   * Get setup progress
   */
  getSetupProgress() {
    const completedSteps = Object.keys(this.setupState.data).length;
    const totalSteps = this.setupState.steps.filter(step => step.required).length;
    
    return {
      completed: this.setupState.completed,
      currentStep: this.setupState.currentStep + 1,
      totalSteps: this.setupState.steps.length,
      completedSteps,
      requiredSteps: totalSteps,
      progress: Math.round((completedSteps / totalSteps) * 100)
    };
  }

  /**
   * Reset setup
   */
  async resetSetup() {
    this.setupState.completed = false;
    this.setupState.currentStep = 0;
    this.setupState.data = {};
    
    // Remove setup configuration
    await this.configManager.deleteConfiguration('system', 'setup');
    
    this.emit('setup:reset');
    this.logger.info('Setup reset');
  }

  /**
   * Get setup summary
   */
  getSetupSummary() {
    return {
      completed: this.setupState.completed,
      steps: this.getAllSteps(),
      data: this.setupState.data,
      progress: this.getSetupProgress()
    };
  }
}

module.exports = SetupWizard; 