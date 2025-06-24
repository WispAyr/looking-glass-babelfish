const EventEmitter = require('events');

/**
 * Base Connector Class
 * 
 * All connectors must extend this class and implement the required methods.
 * This provides a standardized interface for connector management, event handling,
 * and capability management.
 */
class BaseConnector extends EventEmitter {
  constructor(config) {
    super();
    
    // Validate required config
    if (!config.id) {
      throw new Error('Connector ID is required');
    }
    if (!config.type) {
      throw new Error('Connector type is required');
    }
    
    // Basic properties
    this.id = config.id;
    this.type = config.type;
    this.name = config.name || config.id;
    this.description = config.description || '';
    this.config = config.config || {};
    
    // Store logger
    this.logger = config.logger || console;
    
    // State management
    this.status = 'disconnected';
    this.lastConnected = null;
    this.lastError = null;
    this.connectionAttempts = 0;
    
    // Capability management
    this.capabilities = new Map();
    this.enabledCapabilities = new Set();
    this.disabledCapabilities = new Set();
    
    // Dependency management
    this.dependencies = new Map();
    this.dependencyStatus = new Map();
    this.connectorRegistry = null;
    this.eventBus = null;
    this.alarmManager = null;
    
    // Performance tracking
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      lastActivity: null
    };
    
    // Debug mode
    this.debugMode = false;
    
    // Initialize capabilities
    this.initializeCapabilities();
    
    // Initialize dependencies
    this.initializeDependencies();
    
    // Apply capability configuration
    if (config.capabilities) {
      this.configureCapabilities(config.capabilities);
    }
  }
  
  /**
   * Initialize connector capabilities
   * Must be implemented by each connector
   */
  initializeCapabilities() {
    const definitions = this.constructor.getCapabilityDefinitions();
    if (!definitions) {
      throw new Error(`Connector ${this.type} must implement getCapabilityDefinitions()`);
    }
    
    definitions.forEach(def => {
      this.capabilities.set(def.id, {
        ...def,
        enabled: true
      });
    });
  }
  
  /**
   * Configure which capabilities are enabled/disabled
   */
  configureCapabilities(capabilityConfig) {
    if (capabilityConfig.enabled) {
      capabilityConfig.enabled.forEach(capId => {
        if (this.capabilities.has(capId)) {
          this.enabledCapabilities.add(capId);
          this.capabilities.get(capId).enabled = true;
        } else {
          this.emit('warn', `Unknown capability: ${capId}`);
        }
      });
    }
    
    if (capabilityConfig.disabled) {
      capabilityConfig.disabled.forEach(capId => {
        this.disabledCapabilities.add(capId);
        this.capabilities.get(capId).enabled = false;
      });
    }
  }
  
  /**
   * Get all capabilities
   */
  getCapabilities() {
    return Array.from(this.capabilities.values());
  }
  
  /**
   * Get enabled capabilities
   */
  getEnabledCapabilities() {
    return Array.from(this.capabilities.values())
      .filter(cap => cap.enabled);
  }
  
  /**
   * Check if capability is enabled
   */
  isCapabilityEnabled(capabilityId) {
    const capability = this.capabilities.get(capabilityId);
    return capability && capability.enabled;
  }
  
  /**
   * Enable/disable capability
   */
  setCapabilityEnabled(capabilityId, enabled) {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      throw new Error(`Unknown capability: ${capabilityId}`);
    }
    
    capability.enabled = enabled;
    if (enabled) {
      this.enabledCapabilities.add(capabilityId);
      this.disabledCapabilities.delete(capabilityId);
    } else {
      this.disabledCapabilities.add(capabilityId);
      this.enabledCapabilities.delete(capabilityId);
    }
    
    this.emit('capability-changed', {
      capabilityId,
      enabled,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Execute capability operation
   */
  async execute(capabilityId, operation, parameters = {}) {
    // Validate capability
    if (!this.isCapabilityEnabled(capabilityId)) {
      throw new Error(`Capability ${capabilityId} is not enabled`);
    }
    
    const capability = this.capabilities.get(capabilityId);
    if (!capability.operations.includes(operation)) {
      throw new Error(`Operation ${operation} not supported by capability ${capabilityId}`);
    }
    
    // Check connection
    if (capability.requiresConnection && this.status !== 'connected') {
      throw new Error(`Connector must be connected to execute ${capabilityId}:${operation}`);
    }
    
    try {
      this.stats.lastActivity = new Date().toISOString();
      
      // Execute the operation
      const result = await this.executeCapability(capabilityId, operation, parameters);
      
      // Update stats
      if (operation === 'write' || operation === 'publish') {
        this.stats.messagesSent++;
      } else if (operation === 'read' || operation === 'subscribe') {
        this.stats.messagesReceived++;
      }
      
      this.emit('operation-completed', {
        capabilityId,
        operation,
        parameters,
        result,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      this.stats.errors++;
      this.lastError = error;
      
      this.emit('operation-error', {
        capabilityId,
        operation,
        parameters,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }
  
  /**
   * Execute capability operation (must be implemented by each connector)
   */
  async executeCapability(capabilityId, operation, parameters) {
    throw new Error(`executeCapability not implemented for ${this.type} connector`);
  }
  
  /**
   * Connect to the service
   * Must be implemented by each connector
   */
  async connect() {
    if (this.status === 'connected') {
      return;
    }
    
    this.status = 'connecting';
    this.connectionAttempts++;
    
    try {
      await this.performConnect();
      this.status = 'connected';
      this.lastConnected = new Date().toISOString();
      this.connectionAttempts = 0;
      
      this.emit('connected', {
        connectorId: this.id,
        timestamp: this.lastConnected
      });
      
      // Call optional hook
      await this.onConnect();
    } catch (error) {
      this.status = 'disconnected';
      this.lastError = error;
      
      this.emit('connection-error', {
        connectorId: this.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }
  
  /**
   * Perform actual connection (must be implemented by each connector)
   */
  async performConnect() {
    throw new Error(`performConnect not implemented for ${this.type} connector`);
  }
  
  /**
   * Disconnect from the service
   */
  async disconnect() {
    if (this.status === 'disconnected') {
      return;
    }
    
    try {
      await this.performDisconnect();
      this.status = 'disconnected';
      
      this.emit('disconnected', {
        connectorId: this.id,
        timestamp: new Date().toISOString()
      });
      
      // Call optional hook
      await this.onDisconnect();
    } catch (error) {
      this.lastError = error;
      
      this.emit('disconnection-error', {
        connectorId: this.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }
  
  /**
   * Perform actual disconnection (must be implemented by each connector)
   */
  async performDisconnect() {
    throw new Error(`performDisconnect not implemented for ${this.type} connector`);
  }
  
  /**
   * Reconnect to the service
   */
  async reconnect() {
    await this.disconnect();
    await this.connect();
  }
  
  /**
   * Get connection status
   */
  getStatus() {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      lastConnected: this.lastConnected,
      lastError: this.lastError ? this.lastError.message : null,
      connectionAttempts: this.connectionAttempts,
      stats: this.stats
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    this.emit('config-updated', {
      connectorId: this.id,
      config: this.config,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    
    if (enabled) {
      this.on('operation-completed', (data) => {
        console.log(`[${this.type}:${this.id}] Operation completed:`, data);
      });
      
      this.on('operation-error', (data) => {
        console.error(`[${this.type}:${this.id}] Operation error:`, data);
      });
    }
  }
  
  /**
   * Optional hooks (can be overridden by connectors)
   */
  async onConnect() {}
  async onDisconnect() {}
  async onError(error) {}
  
  /**
   * Get capability definitions (must be implemented by each connector)
   */
  static getCapabilityDefinitions() {
    throw new Error('getCapabilityDefinitions must be implemented by connector class');
  }
  
  /**
   * Validate configuration (can be overridden by connectors)
   */
  static validateConfig(config) {
    const required = ['id', 'type'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
    }
    
    return true;
  }
  
  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      type: 'base',
      version: '1.0.0',
      description: 'Base connector class',
      author: 'Looking Glass Platform',
      capabilities: []
    };
  }
  
  /**
   * Set entity manager reference
   */
  setEntityManager(entityManager) {
    this.entityManager = entityManager;
  }

  /**
   * Set event bus reference
   */
  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Initialize connector dependencies
   * Override this method in connectors to declare their dependencies
   */
  initializeDependencies() {
    // Default implementation - no dependencies
    // Override in subclasses to declare dependencies
  }
  
  /**
   * Declare a dependency on another connector
   */
  declareDependency(connectorId, options = {}) {
    const dependency = {
      id: connectorId,
      required: options.required !== false, // Default to required
      critical: options.critical !== false, // Default to critical
      fallback: options.fallback || null,
      capabilities: options.capabilities || [],
      description: options.description || `Dependency on ${connectorId}`,
      lastCheck: null,
      status: 'unknown'
    };
    
    this.dependencies.set(connectorId, dependency);
    this.dependencyStatus.set(connectorId, 'unknown');
    
    this.logger.debug(`Declared dependency: ${connectorId}`, dependency);
  }
  
  /**
   * Check if all dependencies are available
   */
  async checkDependencies() {
    if (!this.connectorRegistry) {
      this.logger.warn('Connector registry not available for dependency checking');
      return { available: false, missing: [], errors: ['Connector registry not available'] };
    }
    
    const results = {
      available: true,
      missing: [],
      errors: [],
      details: {}
    };
    
    for (const [connectorId, dependency] of this.dependencies) {
      try {
        const connector = this.connectorRegistry.getConnector(connectorId);
        
        if (!connector) {
          results.missing.push(connectorId);
          results.available = false;
          results.details[connectorId] = {
            status: 'missing',
            error: 'Connector not found in registry'
          };
          
          if (dependency.required) {
            results.errors.push(`Required connector not found: ${connectorId}`);
          }
          continue;
        }
        
        // Check if connector is connected - look at status property
        const isConnected = connector.status === 'connected' || connector.connected === true;
        if (!isConnected) {
          results.missing.push(connectorId);
          results.available = false;
          results.details[connectorId] = {
            status: 'disconnected',
            error: 'Connector not connected',
            connectorStatus: connector.status || 'unknown'
          };
          
          if (dependency.required) {
            results.errors.push(`Required connector not connected: ${connectorId} (status: ${connector.status})`);
          }
          continue;
        }
        
        // Check required capabilities
        if (dependency.capabilities && dependency.capabilities.length > 0) {
          const missingCapabilities = [];
          for (const capabilityId of dependency.capabilities) {
            if (!connector.isCapabilityEnabled(capabilityId)) {
              missingCapabilities.push(capabilityId);
            }
          }
          
          if (missingCapabilities.length > 0) {
            results.missing.push(connectorId);
            results.available = false;
            results.details[connectorId] = {
              status: 'missing_capabilities',
              error: `Missing capabilities: ${missingCapabilities.join(', ')}`,
              missingCapabilities
            };
            
            if (dependency.required) {
              results.errors.push(`Required capabilities missing for ${connectorId}: ${missingCapabilities.join(', ')}`);
            }
            continue;
          }
        }
        
        // Dependency is available
        results.details[connectorId] = {
          status: 'available',
          connector: connector
        };
        
        // Update dependency status
        this.dependencyStatus.set(connectorId, 'available');
        dependency.lastCheck = new Date().toISOString();
        dependency.status = 'available';
        
      } catch (error) {
        results.errors.push(`Error checking dependency ${connectorId}: ${error.message}`);
        results.details[connectorId] = {
          status: 'error',
          error: error.message
        };
        results.available = false;
      }
    }
    
    return results;
  }
  
  /**
   * Get a dependency connector safely
   */
  getDependency(connectorId) {
    const dependency = this.dependencies.get(connectorId);
    if (!dependency) {
      throw new Error(`Dependency not declared: ${connectorId}`);
    }
    
    if (!this.connectorRegistry) {
      throw new Error('Connector registry not available');
    }
    
    const connector = this.connectorRegistry.getConnector(connectorId);
    if (!connector) {
      throw new Error(`Dependency not available: ${connectorId}`);
    }
    
    // Check if connector is connected - look at status property
    const isConnected = connector.status === 'connected' || connector.connected === true;
    if (!isConnected) {
      throw new Error(`Dependency not connected: ${connectorId} (status: ${connector.status})`);
    }
    
    return connector;
  }
  
  /**
   * Check if a dependency is available
   */
  isDependencyAvailable(connectorId) {
    const status = this.dependencyStatus.get(connectorId);
    return status === 'available';
  }
  
  /**
   * Handle dependency failure
   */
  async handleDependencyFailure(connectorId, error) {
    const dependency = this.dependencies.get(connectorId);
    if (!dependency) {
      return;
    }
    
    // Update status
    this.dependencyStatus.set(connectorId, 'failed');
    dependency.status = 'failed';
    dependency.lastError = error;
    
    // Log the failure
    this.logger.warn(`Dependency failure: ${connectorId}`, {
      error: error.message,
      dependency: dependency,
      connectorId: this.id
    });
    
    // Send alarm if critical
    if (dependency.critical && this.alarmManager) {
      try {
        await this.alarmManager.sendNotification('system', {
          type: 'dependency_failure',
          severity: 'high',
          message: `Critical dependency failure: ${connectorId} is not available`,
          connectorId: this.id,
          dependencyId: connectorId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      } catch (alarmError) {
        this.logger.error('Failed to send dependency failure alarm', alarmError);
      }
    }
    
    // Emit dependency failure event
    this.emit('dependency-failed', {
      connectorId: this.id,
      dependencyId: connectorId,
      error: error.message,
      critical: dependency.critical,
      timestamp: new Date().toISOString()
    });
    
    // Try fallback if available
    if (dependency.fallback) {
      this.logger.info(`Attempting fallback for dependency: ${connectorId}`);
      try {
        await this.executeFallback(connectorId, dependency.fallback);
      } catch (fallbackError) {
        this.logger.error(`Fallback failed for dependency: ${connectorId}`, fallbackError);
      }
    }
  }
  
  /**
   * Execute fallback for dependency failure
   * Override in subclasses to implement specific fallback logic
   */
  async executeFallback(connectorId, fallback) {
    this.logger.info(`Executing fallback for ${connectorId}: ${fallback}`);
    // Default implementation - override in subclasses
  }
  
  /**
   * Set connector registry reference
   */
  setConnectorRegistry(registry) {
    this.connectorRegistry = registry;
  }
  
  /**
   * Set alarm manager reference
   */
  setAlarmManager(alarmManager) {
    this.alarmManager = alarmManager;
  }
}

module.exports = BaseConnector; 