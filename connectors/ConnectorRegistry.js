const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

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
    this.autoSave = false; // Temporarily disabled to prevent overwriting config
    
    // Load existing configuration
    // this.loadConfiguration(); // Moved to initialize()
  }
  
  /**
   * Initialize the registry by loading configuration
   */
  async initialize() {
    await this.loadConfiguration();
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
    
    // Create a safe logger object to avoid circular references
    const safeLogger = {
      info: (message, data) => this.logger.info(message, data),
      warn: (message, data) => this.logger.warn(message, data),
      error: (message, data) => this.logger.error(message, data),
      debug: (message, data) => this.logger.debug ? this.logger.debug(message, data) : this.logger.info(message, data)
    };
    
    // Create connector instance with safe logger
    const connector = new connectorType.class({
      ...config,
      logger: safeLogger
    });
    
    // Register connector
    this.connectors.set(config.id, connector);
    
    // Listen for connector events
    this.setupConnectorEventListeners(connector);
    
    // Save configuration if auto-save is enabled
    if (this.autoSave) {
      try {
        await this.saveConfiguration();
      } catch (error) {
        console.error('Failed to save connector configuration:', error.message);
      }
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
   * Register an existing connector instance
   */
  registerConnector(connector) {
    if (!connector || !connector.id) {
      throw new Error('Invalid connector instance');
    }
    
    if (this.connectors.has(connector.id)) {
      throw new Error(`Connector with ID '${connector.id}' already exists`);
    }
    
    this.connectors.set(connector.id, connector);
    this.logger.info(`Registered existing connector: ${connector.id}`);
    
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
      await this.saveConfiguration();
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
      await this.saveConfiguration();
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
  async loadConfiguration() {
    try {
      // Check if config file exists
      try {
        await fs.access(this.configPath);
      } catch (error) {
        console.log('No connector configuration file found, starting with empty configuration');
        return;
      }
      
      const configData = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Create connectors from configuration
      if (config.connectors) {
        for (const connectorConfig of config.connectors) {
          try {
            await this.createConnector(connectorConfig);
          } catch (error) {
            console.error(`Failed to create connector ${connectorConfig.id}:`, error.message);
          }
        }
      }
      
      console.log(`Loaded ${config.connectors?.length || 0} connectors from configuration`);
    } catch (error) {
      console.error('Failed to load connector configuration:', error.message);
    }
  }
  
  /**
   * Save configuration to file
   */
  async saveConfiguration() {
    try {
      const config = {
        connectors: Array.from(this.connectors.values()).map(connector => {
          // Create a safe configuration object without circular references
          const safeConfig = {
            id: connector.id,
            type: connector.type,
            name: connector.name,
            description: connector.description,
            enabled: connector.enabled,
            config: connector.config || {}
          };
          
          // Only add capabilities if they exist and are not circular
          if (connector.enabledCapabilities && connector.disabledCapabilities) {
            try {
              safeConfig.capabilities = {
                enabled: Array.from(connector.enabledCapabilities),
                disabled: Array.from(connector.disabledCapabilities)
              };
            } catch (error) {
              // Skip capabilities if they cause circular reference issues
              console.warn(`Skipping capabilities for connector ${connector.id} due to serialization issues`);
            }
          }
          
          return safeConfig;
        })
      };
      
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      try {
        await fs.access(configDir);
      } catch (error) {
        await fs.mkdir(configDir, { recursive: true });
      }
      
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
      
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
      // Check if directory exists
      try {
        await fs.access(typesDir);
      } catch (error) {
        console.log(`Types directory does not exist: ${typesDir}`);
        return;
      }
      
      const files = await fs.readdir(typesDir);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          try {
            const typePath = path.join(typesDir, file);
            const connectorClass = require(typePath);
            
            // Get type from filename and convert to standard format
            const className = path.basename(file, '.js');
            
            // Convert CamelCase to kebab-case with proper handling
            let type = className.replace(/Connector$/, '');
            
            // Handle special cases for proper naming
            const typeMappings = {
              'ADSB': 'adsb',
              'APRS': 'aprs',
              'Telegram': 'telegram',
              'LLM': 'llm',
              'Map': 'map',
              'WebGui': 'web-gui',
              'Mqtt': 'mqtt',
              'Radar': 'radar',
              'SpeedCalculation': 'speed-calculation',
              'UnifiProtect': 'unifi-protect',
              'AnkkeDvr': 'ankke-dvr',
              'GuiDesigner': 'gui-designer',
              'Hikvision': 'hikvision',
              'SpeedDetectionGui': 'speed-detection-gui'
            };
            
            if (typeMappings[type]) {
              type = typeMappings[type];
            } else {
              // Fallback: convert to lowercase with hyphens
              type = type.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
            }
            
            // Check if type is already registered
            if (this.connectorTypes.has(type)) {
              console.log(`Skipping duplicate connector type: ${type} (already registered)`);
              continue;
            }
            
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
  
  /**
   * Reload all connectors from configuration
   */
  async reloadConnectors() {
    this.logger.info('Reloading connectors from configuration...');
    try {
      // Disconnect all existing connectors
      for (const [id, connector] of this.connectors) {
        try {
          if (connector.status === 'connected') {
            await connector.disconnect();
          }
        } catch (error) {
          this.logger.error(`Error disconnecting connector ${id}:`, error);
        }
      }
      // Clear existing connectors
      this.connectors.clear();
      // Load configuration
      const configPath = path.join(process.cwd(), 'config', 'connectors.json');
      const configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      // Create connectors from config
      for (const connectorConfig of configData.connectors) {
        try {
          await this.createConnector(connectorConfig);
        } catch (error) {
          this.logger.error(`Error creating connector ${connectorConfig.id}:`, error);
        }
      }
      this.logger.info(`Reloaded ${this.connectors.size} connectors`);
    } catch (error) {
      this.logger.error('Error reloading connectors:', error);
      throw error;
    }
  }
}

module.exports = ConnectorRegistry; 