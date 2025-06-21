const BaseConnector = require('../BaseConnector');
const fs = require('fs').promises;
const path = require('path');

/**
 * GUI Designer Connector
 * 
 * Manages the creation, storage, and retrieval of custom GUI layouts.
 */
class GuiDesignerConnector extends BaseConnector {
  constructor(config) {
    super({
      ...config,
      id: config.id || 'gui-designer',
      type: 'gui-designer'
    });
    
    this.layouts = new Map();
    this.layoutsDir = path.join(process.cwd(), 'config', 'layouts');
    
    // Initialize layouts asynchronously
    this.initializeLayouts().catch(error => {
      this.logger.error('Failed to initialize layouts:', error);
    });
  }

  /**
   * Load layouts from the filesystem
   */
  async initializeLayouts() {
    try {
      await fs.mkdir(this.layoutsDir, { recursive: true });
      const files = await fs.readdir(this.layoutsDir);
      for (const file of files) {
        if (path.extname(file) === '.json') {
          const layoutId = path.basename(file, '.json');
          try {
            const content = await fs.readFile(path.join(this.layoutsDir, file), 'utf-8');
            const layout = JSON.parse(content);
            this.layouts.set(layoutId, layout);
            this.logger.info(`Loaded layout: ${layoutId}`);
          } catch (parseError) {
            this.logger.error(`Failed to parse layout file ${file}:`, parseError);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error initializing layouts:', error);
      throw error;
    }
  }

  /**
   * Capability definitions
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'gui:designer',
        name: 'GUI Designer',
        description: 'Manage GUI layouts',
        category: 'gui',
        operations: ['get', 'save', 'delete', 'list'],
        dataTypes: ['layout'],
        events: ['layout:saved', 'layout:deleted'],
        requiresConnection: false
      }
    ];
  }

  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    if (capabilityId !== 'gui:designer') {
      throw new Error(`Unknown capability: ${capabilityId}`);
    }

    switch (operation) {
      case 'get':
        return this.getLayout(parameters.id);
      case 'save':
        return this.saveLayout(parameters.id, parameters.layout);
      case 'delete':
        return this.deleteLayout(parameters.id);
      case 'list':
        return this.listLayouts();
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Get a layout
   */
  getLayout(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Layout ID is required and must be a string');
    }
    
    if (!this.layouts.has(id)) {
      throw new Error(`Layout '${id}' not found`);
    }
    return this.layouts.get(id);
  }

  /**
   * List all layouts
   */
  listLayouts() {
    return Array.from(this.layouts.keys());
  }

  /**
   * Save a layout
   */
  async saveLayout(id, layout) {
    if (!id || typeof id !== 'string') {
      throw new Error('Layout ID is required and must be a string');
    }
    
    if (!layout || typeof layout !== 'object') {
      throw new Error('Layout data is required and must be an object');
    }

    // Validate layout structure
    if (!layout.name || !layout.components) {
      throw new Error('Layout must have name and components properties');
    }

    try {
      const filePath = path.join(this.layoutsDir, `${id}.json`);
      await fs.writeFile(filePath, JSON.stringify(layout, null, 2));
      this.layouts.set(id, layout);
      this.logger.info(`Saved layout: ${id}`);
      this.emit('layout:saved', { id, layout });
      return { success: true, id };
    } catch (error) {
      this.logger.error(`Failed to save layout ${id}:`, error);
      throw new Error(`Failed to save layout: ${error.message}`);
    }
  }

  /**
   * Delete a layout
   */
  async deleteLayout(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Layout ID is required and must be a string');
    }

    if (!this.layouts.has(id)) {
      throw new Error(`Layout '${id}' not found`);
    }

    try {
      const filePath = path.join(this.layoutsDir, `${id}.json`);
      await fs.unlink(filePath);
      this.layouts.delete(id);
      this.logger.info(`Deleted layout: ${id}`);
      this.emit('layout:deleted', { id });
      return { success: true, id };
    } catch (error) {
      this.logger.error(`Failed to delete layout ${id}:`, error);
      throw new Error(`Failed to delete layout: ${error.message}`);
    }
  }

  /**
   * Connect to the service (no-op for file-based connector)
   */
  async performConnect() {
    // File-based connector doesn't need connection
    this.logger.info('GUI Designer connector connected');
  }

  /**
   * Disconnect from the service (no-op for file-based connector)
   */
  async performDisconnect() {
    // File-based connector doesn't need disconnection
    this.logger.info('GUI Designer connector disconnected');
  }

  /**
   * Metadata
   */
  static getMetadata() {
    return {
      name: 'GUI Designer',
      version: '1.0.0',
      description: 'Manages custom GUI layouts.',
      author: 'Babelfish',
      type: 'gui-designer'
    };
  }

  /**
   * Validate configuration
   */
  static validateConfig(config) {
    // Validate required fields
    if (!config.id) {
      throw new Error('Connector ID is required');
    }
    
    // Validate optional custom layouts directory
    if (config.layoutsDir && typeof config.layoutsDir !== 'string') {
      throw new Error('layoutsDir must be a string');
    }
    
    return true;
  }
}

module.exports = GuiDesignerConnector; 