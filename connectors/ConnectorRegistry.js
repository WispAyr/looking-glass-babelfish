const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

/**
 * Connector Registry
 * 
 * Manages all connector types and instances in the system.
 * Provides centralized connector management, capability matching,
 * and lifecycle management.
 */
class ConnectorRegistry extends EventEmitter {
  constructor(logger) {
    super();
    
    // Store logger
    this.logger = logger;
    
    // Connector type registry
    this.connectorTypes = new Map();
    
    // Connector instances
    this.connectors = new Map();
    
    // Configuration storage
    this.configPath = path.join(process.cwd(), 'config', 'connectors.json');
    
    // Auto-save configuration
    this.autoSave = true;
    
    // Load existing configuration
    // this.loadConfiguration(); // Moved to initialize()
  }
  
  /**
   * Initialize the registry by loading configuration
   */
  initialize() {
    this.loadConfiguration();
  }
  
  /**
   * Register a connector type
   */
  registerType(type, connectorClass) {
    if (this.connectorTypes.has(type)) {
      throw new Error(`Connector type '${type}' is already registered`);
    }
    
    // Validate connector class
    if (!connectorClass || typeof connectorClass !== 'function') {
      throw new Error('Connector class must be a function');
    }
    
    // Check if it extends BaseConnector
    const BaseConnector = require('./BaseConnector');
    if (!(connectorClass.prototype instanceof BaseConnector)) {
      throw new Error('Connector class must extend BaseConnector');
    }
    
    // Get metadata
    const metadata = connectorClass.getMetadata();
    const capabilities = connectorClass.getCapabilityDefinitions();
    
    this.connectorTypes.set(type, {
      type,
      class: connectorClass,
      metadata,
      capabilities
    });
    
    this.emit('type-registered', {
      type,
      metadata,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Registered connector type: ${type} (${metadata.version})`);
  }
  
  /**
   * Get connector type information
   */
  getType(type) {
    return this.connectorTypes.get(type);
  }
  
  /**
   * Get all registered connector types
   */
  getTypes() {
    return Array.from(this.connectorTypes.values()).map(type => ({
      type: type.type,
      metadata: type.metadata,
      capabilities: type.capabilities
    }));
  }
  
  /**
   * Create and register a connector instance
   */
  async createConnector(config) {
    // Validate configuration
    if (!config.id) {
      throw new Error('Connector ID is required');
    }
    if (!config.type) {
      throw new Error('Connector type is required');
    }
    
    // Check if connector already exists
    if (this.connectors.has(config.id)) {
      throw new Error(`Connector with ID '${config.id}' already exists`);
    }
    
    // Get connector type
    const connectorType = this.connectorTypes.get(config.type);
    if (!connectorType) {
      throw new Error(`Unknown connector type: ${config.type}`);
    }
    
    // Validate configuration
    connectorType.class.validateConfig(config);
    
    // Create connector instance with logger
    const connector = new connectorType.class({
      ...config,
      logger: this.logger
    });
    
    // Register connector
    this.connectors.set(config.id, connector);
    
    // Listen for connector events
    this.setupConnectorEventListeners(connector);
    
    // Save configuration if auto-save is enabled
    if (this.autoSave) {
      this.saveConfiguration();
    }
    
    this.emit('connector-created', {
      connectorId: config.id,
      type: config.type,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Created connector: ${config.id} (${config.type})`);
    
    return connector;
  }
  
  /**
   * Get connector instance
   */
  getConnector(id) {
    return this.connectors.get(id);
  }
  
  /**
   * Get all connector instances
   */
  getConnectors() {
    return Array.from(this.connectors.values());
  }
  
  /**
   * Get connectors by type
   */
  getConnectorsByType(type) {
    return Array.from(this.connectors.values())
      .filter(connector => connector.type === type);
  }
  
  /**
   * Update connector configuration
   */
  async updateConnector(id, updates) {
    const connector = this.connectors.get(id);
    if (!connector) {
      throw new Error(`Connector '${id}' not found`);
    }
    
    // Update configuration
    if (updates.config) {
      connector.updateConfig(updates.config);
    }
    
    // Update capabilities
    if (updates.capabilities) {
      connector.configureCapabilities(updates.capabilities);
    }
    
    // Save configuration
    if (this.autoSave) {
      this.saveConfiguration();
    }
    
    this.emit('connector-updated', {
      connectorId: id,
      updates,
      timestamp: new Date().toISOString()
    });
    
    return connector;
  }
  
  /**
   * Remove connector instance
   */
  async removeConnector(id) {
    const connector = this.connectors.get(id);
    if (!connector) {
      throw new Error(`Connector '${id}' not found`);
    }
    
    // Disconnect if connected
    if (connector.status === 'connected') {
      await connector.disconnect();
    }
    
    // Remove from registry
    this.connectors.delete(id);
    
    // Save configuration
    if (this.autoSave) {
      this.saveConfiguration();
    }
    
    this.emit('connector-removed', {
      connectorId: id,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Removed connector: ${id}`);
    return true;
  }
  
  /**
   * Connect all connectors
   */
  async connectAll() {
    const results = [];
    
    for (const [id, connector] of this.connectors) {
      try {
        await connector.connect();
        results.push({ id, status: 'connected' });
      } catch (error) {
        results.push({ id, status: 'error', error: error.message });
      }
    }
    
    return results;
  }
  
  /**
   * Disconnect all connectors
   */
  async disconnectAll() {
    const results = [];
    
    for (const [id, connector] of this.connectors) {
      try {
        await connector.disconnect();
        results.push({ id, status: 'disconnected' });
      } catch (error) {
        results.push({ id, status: 'error', error: error.message });
      }
    }
    
    return results;
  }
  
  /**
   * Find connectors by capability
   */
  findConnectorsByCapability(capabilityId) {
    return Array.from(this.connectors.values())
      .filter(connector => connector.isCapabilityEnabled(capabilityId))
      .map(connector => ({
        id: connector.id,
        type: connector.type,
        name: connector.name,
        capability: connector.capabilities.get(capabilityId)
      }));
  }
  
  /**
   * Find capability matches between connectors
   */
  findCapabilityMatches(sourceCapability, targetCapability) {
    const sourceConnectors = this.findConnectorsByCapability(sourceCapability);
    const targetConnectors = this.findConnectorsByCapability(targetCapability);
    
    const matches = [];
    
    for (const source of sourceConnectors) {
      for (const target of targetConnectors) {
        if (source.id !== target.id) {
          matches.push({
            source: source,
            target: target,
            sourceCapability,
            targetCapability
          });
        }
      }
    }
    
    return matches;
  }
  
  /**
   * Get system status
   */
  getStatus() {
    const connectors = Array.from(this.connectors.values()).map(connector => ({
      id: connector.id,
      type: connector.type,
      name: connector.name,
      status: connector.status,
      capabilities: connector.getEnabledCapabilities().map(cap => cap.id),
      stats: connector.stats
    }));
    
    return {
      totalConnectors: connectors.length,
      connectedConnectors: connectors.filter(c => c.status === 'connected').length,
      connectorTypes: this.getTypes().length,
      connectors
    };
  }
  
  /**
   * Load configuration from file
   */
  loadConfiguration() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Create connectors from configuration
        if (config.connectors) {
          config.connectors.forEach(async (connectorConfig) => {
            try {
              await this.createConnector(connectorConfig);
            } catch (error) {
              console.error(`Failed to create connector ${connectorConfig.id}:`, error.message);
            }
          });
        }
        
        console.log(`Loaded ${config.connectors?.length || 0} connectors from configuration`);
      }
    } catch (error) {
      console.error('Failed to load connector configuration:', error.message);
    }
  }
  
  /**
   * Save configuration to file
   */
  saveConfiguration() {
    try {
      const config = {
        connectors: Array.from(this.connectors.values()).map(connector => ({
          id: connector.id,
          type: connector.type,
          name: connector.name,
          description: connector.description,
          config: connector.config,
          capabilities: {
            enabled: Array.from(connector.enabledCapabilities),
            disabled: Array.from(connector.disabledCapabilities)
          }
        }))
      };
      
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      
      this.emit('configuration-saved', {
        path: this.configPath,
        connectorCount: config.connectors.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to save connector configuration:', error.message);
    }
  }
  
  /**
   * Setup event listeners for a connector
   */
  setupConnectorEventListeners(connector) {
    // Forward connector events
    const events = [
      'connected', 'disconnected', 'connection-error', 'disconnection-error',
      'operation-completed', 'operation-error', 'capability-changed',
      'config-updated'
    ];
    
    events.forEach(event => {
      connector.on(event, (data) => {
        this.emit(`connector:${event}`, {
          connectorId: connector.id,
          ...data
        });
      });
    });
    
    // Handle raw error events to prevent crashes
    connector.on('error', (error) => {
      console.error(`Error from connector ${connector.id}:`, error.message);
      this.emit('connector:error', { connectorId: connector.id, error: error.message });
    });
  }
  
  /**
   * Auto-discover connector types from directory
   */
  async autoDiscoverTypes(typesDir = path.join(__dirname, 'types')) {
    try {
      if (!fs.existsSync(typesDir)) {
        return;
      }
      
      const files = fs.readdirSync(typesDir);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          try {
            const typePath = path.join(typesDir, file);
            const connectorClass = require(typePath);
            
            // Get type from filename or metadata
            const type = path.basename(file, '.js');
            
            this.registerType(type, connectorClass);
          } catch (error) {
            console.error(`Failed to load connector type from ${file}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('Failed to auto-discover connector types:', error.message);
    }
  }
  
  /**
   * Get registry statistics
   */
  getStats() {
    const connectors = Array.from(this.connectors.values());
    const types = Array.from(this.connectorTypes.values());
    
    return {
      totalConnectors: connectors.length,
      totalTypes: types.length,
      connectedConnectors: connectors.filter(c => c.status === 'connected').length,
      totalMessagesSent: connectors.reduce((sum, c) => sum + c.stats.messagesSent, 0),
      totalMessagesReceived: connectors.reduce((sum, c) => sum + c.stats.messagesReceived, 0),
      totalErrors: connectors.reduce((sum, c) => sum + c.stats.errors, 0),
      types: types.map(t => t.type),
      connectorIds: connectors.map(c => c.id)
    };
  }
}

module.exports = ConnectorRegistry; 