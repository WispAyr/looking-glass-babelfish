const BaseConnector = require('../BaseConnector');
const EventEmitter = require('events');

/**
 * Map Connector
 * 
 * Provides spatial configuration and real-time visualization capabilities
 * for the Looking Glass platform. Integrates with other connectors to
 * display cameras, zones, detection lines, and real-time events on an
 * interactive map interface.
 */
class MapConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // Map-specific properties
    this.mapLayers = new Map();
    this.spatialData = new Map();
    this.connectorContexts = new Map();
    this.editMode = false;
    this.viewMode = 'realtime';
    
    // Real-time data streams
    this.dataStreams = new Map();
    this.visualizationRules = new Map();
    
    // Spatial data management
    this.spatialIndex = new Map(); // For efficient spatial queries
    this.elementHistory = []; // For undo/redo functionality
    this.historyIndex = -1;
    
    // Performance tracking
    this.renderStats = {
      fps: 0,
      elementsRendered: 0,
      lastRenderTime: null
    };
    
    this.logger.info('Map Connector initialized');
  }

  /**
   * Get capability definitions for this connector
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'spatial:config',
        name: 'Spatial Configuration',
        description: 'Configure spatial elements like cameras, zones, and detection lines',
        category: 'spatial',
        operations: ['create', 'update', 'delete', 'position', 'resize', 'duplicate'],
        dataTypes: ['camera', 'zone', 'line', 'polygon', 'point', 'area'],
        events: ['element:created', 'element:updated', 'element:deleted', 'element:moved'],
        parameters: {
          elementType: { type: 'string', required: true, enum: ['camera', 'zone', 'line'] },
          position: { type: 'object', required: false },
          properties: { type: 'object', required: false }
        }
      },
      {
        id: 'visualization:realtime',
        name: 'Real-Time Visualization',
        description: 'Display real-time data from connected systems',
        category: 'visualization',
        operations: ['subscribe', 'unsubscribe', 'filter', 'highlight', 'animate'],
        dataTypes: ['detection', 'event', 'analytics', 'status', 'alert'],
        events: ['data:updated', 'visualization:changed', 'alert:triggered', 'animation:started'],
        parameters: {
          dataType: { type: 'string', required: true },
          filter: { type: 'object', required: false },
          visual: { type: 'object', required: false }
        }
      },
      {
        id: 'integration:connector',
        name: 'Connector Integration',
        description: 'Integrate with other connectors for spatial context and data',
        category: 'integration',
        operations: ['register', 'unregister', 'configure', 'query', 'sync'],
        dataTypes: ['connector:metadata', 'connector:capabilities', 'connector:data', 'connector:context'],
        events: ['connector:registered', 'connector:data:received', 'connector:status:changed', 'context:updated'],
        parameters: {
          connectorId: { type: 'string', required: true },
          context: { type: 'object', required: false },
          capabilities: { type: 'array', required: false }
        }
      },
      {
        id: 'context:spatial',
        name: 'Spatial Context Management',
        description: 'Manage spatial context data for connectors',
        category: 'context',
        operations: ['store', 'retrieve', 'link', 'unlink', 'export', 'import'],
        dataTypes: ['context:definition', 'context:data', 'context:relationship', 'context:template'],
        events: ['context:created', 'context:updated', 'context:linked', 'context:exported'],
        parameters: {
          contextId: { type: 'string', required: true },
          data: { type: 'object', required: false },
          relationships: { type: 'array', required: false }
        }
      }
    ];
  }

  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'spatial:config':
        return await this.executeSpatialConfig(operation, parameters);
      case 'visualization:realtime':
        return await this.executeVisualization(operation, parameters);
      case 'integration:connector':
        return await this.executeConnectorIntegration(operation, parameters);
      case 'context:spatial':
        return await this.executeContextManagement(operation, parameters);
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }

  /**
   * Execute spatial configuration operations
   */
  async executeSpatialConfig(operation, parameters) {
    switch (operation) {
      case 'create':
        return await this.createSpatialElement(parameters);
      case 'update':
        return await this.updateSpatialElement(parameters);
      case 'delete':
        return await this.deleteSpatialElement(parameters);
      case 'position':
        return await this.positionSpatialElement(parameters);
      case 'resize':
        return await this.resizeSpatialElement(parameters);
      case 'duplicate':
        return await this.duplicateSpatialElement(parameters);
      default:
        throw new Error(`Unknown spatial operation: ${operation}`);
    }
  }

  /**
   * Execute visualization operations
   */
  async executeVisualization(operation, parameters) {
    switch (operation) {
      case 'subscribe':
        return await this.subscribeToDataStream(parameters);
      case 'unsubscribe':
        return await this.unsubscribeFromDataStream(parameters);
      case 'filter':
        return await this.setDataFilter(parameters);
      case 'highlight':
        return await this.highlightElement(parameters);
      case 'animate':
        return await this.animateElement(parameters);
      default:
        throw new Error(`Unknown visualization operation: ${operation}`);
    }
  }

  /**
   * Execute connector integration operations
   */
  async executeConnectorIntegration(operation, parameters) {
    switch (operation) {
      case 'register':
        return await this.registerConnector(parameters);
      case 'unregister':
        return await this.unregisterConnector(parameters);
      case 'configure':
        return await this.configureConnector(parameters);
      case 'query':
        return await this.queryConnector(parameters);
      case 'sync':
        return await this.syncConnectorData(parameters);
      default:
        throw new Error(`Unknown integration operation: ${operation}`);
    }
  }

  /**
   * Execute context management operations
   */
  async executeContextManagement(operation, parameters) {
    switch (operation) {
      case 'store':
        return await this.storeContext(parameters);
      case 'retrieve':
        return await this.retrieveContext(parameters);
      case 'link':
        return await this.linkContext(parameters);
      case 'unlink':
        return await this.unlinkContext(parameters);
      case 'export':
        return await this.exportContext(parameters);
      case 'import':
        return await this.importContext(parameters);
      default:
        throw new Error(`Unknown context operation: ${operation}`);
    }
  }

  /**
   * Create a new spatial element
   */
  async createSpatialElement(parameters) {
    const { elementType, position, properties = {} } = parameters;
    
    // Generate unique ID
    const elementId = this.generateElementId(elementType);
    
    // Create element data
    const element = {
      id: elementId,
      type: elementType,
      position: position || { x: 0, y: 0, z: 0 },
      properties: properties,
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        connectorId: this.id
      }
    };

    // Add to spatial data
    this.spatialData.set(elementId, element);
    this.updateSpatialIndex(element);
    this.addToHistory('create', element);

    this.logger.info(`Created spatial element: ${elementId} (${elementType})`);
    this.emit('element:created', element);

    return element;
  }

  /**
   * Update an existing spatial element
   */
  async updateSpatialElement(parameters) {
    const { elementId, updates } = parameters;
    
    const element = this.spatialData.get(elementId);
    if (!element) {
      throw new Error(`Element not found: ${elementId}`);
    }

    // Store original for history
    const original = { ...element };

    // Apply updates
    const updatedElement = {
      ...element,
      ...updates,
      metadata: {
        ...element.metadata,
        updated: new Date().toISOString()
      }
    };

    // Update spatial data
    this.spatialData.set(elementId, updatedElement);
    this.updateSpatialIndex(updatedElement);
    this.addToHistory('update', { elementId, original, updated: updatedElement });

    this.logger.info(`Updated spatial element: ${elementId}`);
    this.emit('element:updated', updatedElement);

    return updatedElement;
  }

  /**
   * Delete a spatial element
   */
  async deleteSpatialElement(parameters) {
    const { elementId } = parameters;
    
    const element = this.spatialData.get(elementId);
    if (!element) {
      throw new Error(`Element not found: ${elementId}`);
    }

    // Remove from spatial data
    this.spatialData.delete(elementId);
    this.removeFromSpatialIndex(elementId);
    this.addToHistory('delete', element);

    this.logger.info(`Deleted spatial element: ${elementId}`);
    this.emit('element:deleted', element);

    return { success: true, elementId };
  }

  /**
   * Position a spatial element
   */
  async positionSpatialElement(parameters) {
    const { elementId, position } = parameters;
    
    return await this.updateSpatialElement({
      elementId,
      updates: { position }
    });
  }

  /**
   * Resize a spatial element
   */
  async resizeSpatialElement(parameters) {
    const { elementId, size } = parameters;
    
    return await this.updateSpatialElement({
      elementId,
      updates: { size }
    });
  }

  /**
   * Duplicate a spatial element
   */
  async duplicateSpatialElement(parameters) {
    const { elementId, newPosition } = parameters;
    
    const original = this.spatialData.get(elementId);
    if (!original) {
      throw new Error(`Element not found: ${elementId}`);
    }

    // Create duplicate with new ID and position
    const duplicate = {
      ...original,
      id: this.generateElementId(original.type),
      position: newPosition || original.position,
      metadata: {
        ...original.metadata,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        duplicatedFrom: elementId
      }
    };

    // Add to spatial data
    this.spatialData.set(duplicate.id, duplicate);
    this.updateSpatialIndex(duplicate);

    this.logger.info(`Duplicated spatial element: ${elementId} -> ${duplicate.id}`);
    this.emit('element:created', duplicate);

    return duplicate;
  }

  /**
   * Subscribe to a data stream
   */
  async subscribeToDataStream(parameters) {
    const { dataType, filter, visual } = parameters;
    
    const streamId = this.generateStreamId(dataType);
    
    const stream = {
      id: streamId,
      dataType,
      filter,
      visual,
      active: true,
      subscribers: new Set(),
      lastData: null
    };

    this.dataStreams.set(streamId, stream);

    this.logger.info(`Subscribed to data stream: ${streamId} (${dataType})`);
    this.emit('data:subscribed', stream);

    return stream;
  }

  /**
   * Unsubscribe from a data stream
   */
  async unsubscribeFromDataStream(parameters) {
    const { streamId } = parameters;
    
    const stream = this.dataStreams.get(streamId);
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    stream.active = false;
    this.dataStreams.delete(streamId);

    this.logger.info(`Unsubscribed from data stream: ${streamId}`);
    this.emit('data:unsubscribed', stream);

    return { success: true, streamId };
  }

  /**
   * Register a connector for integration
   */
  async registerConnector(parameters) {
    const { connectorId, context, capabilities } = parameters;
    
    const connectorContext = {
      id: connectorId,
      context: context || {},
      capabilities: capabilities || [],
      registered: new Date().toISOString(),
      lastSync: null,
      status: 'registered'
    };

    this.connectorContexts.set(connectorId, connectorContext);

    this.logger.info(`Registered connector: ${connectorId}`);
    this.emit('connector:registered', connectorContext);

    return connectorContext;
  }

  /**
   * Store spatial context data
   */
  async storeContext(parameters) {
    const { contextId, data, relationships } = parameters;
    
    const context = {
      id: contextId,
      data: data || {},
      relationships: relationships || [],
      stored: new Date().toISOString(),
      version: 1
    };

    // Store in appropriate location based on context type
    if (contextId.startsWith('connector:')) {
      const connectorId = contextId.replace('connector:', '');
      const connectorContext = this.connectorContexts.get(connectorId);
      if (connectorContext) {
        connectorContext.context = { ...connectorContext.context, ...data };
        connectorContext.lastSync = new Date().toISOString();
      }
    }

    this.logger.info(`Stored context: ${contextId}`);
    this.emit('context:stored', context);

    return context;
  }

  /**
   * Retrieve spatial context data
   */
  async retrieveContext(parameters) {
    const { contextId } = parameters;
    
    if (contextId.startsWith('connector:')) {
      const connectorId = contextId.replace('connector:', '');
      const connectorContext = this.connectorContexts.get(connectorId);
      if (connectorContext) {
        return connectorContext.context;
      }
    }

    throw new Error(`Context not found: ${contextId}`);
  }

  /**
   * Set edit mode
   */
  setEditMode(enabled) {
    this.editMode = enabled;
    this.emit('mode:changed', { mode: enabled ? 'edit' : 'view' });
    this.logger.info(`Edit mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set view mode
   */
  setViewMode(mode) {
    this.viewMode = mode;
    this.emit('mode:changed', { mode });
    this.logger.info(`View mode set to: ${mode}`);
  }

  /**
   * Get all spatial elements
   */
  getSpatialElements(filter = {}) {
    let elements = Array.from(this.spatialData.values());
    
    if (filter.type) {
      elements = elements.filter(el => el.type === filter.type);
    }
    
    if (filter.connectorId) {
      elements = elements.filter(el => el.metadata?.connectorId === filter.connectorId);
    }
    
    return elements;
  }

  /**
   * Get spatial element by ID
   */
  getSpatialElement(elementId) {
    return this.spatialData.get(elementId);
  }

  /**
   * Get connector contexts
   */
  getConnectorContexts() {
    return Array.from(this.connectorContexts.values());
  }

  /**
   * Get data streams
   */
  getDataStreams() {
    return Array.from(this.dataStreams.values());
  }

  /**
   * Generate unique element ID
   */
  generateElementId(type) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${type}-${timestamp}-${random}`;
  }

  /**
   * Generate unique stream ID
   */
  generateStreamId(dataType) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `stream-${dataType}-${timestamp}-${random}`;
  }

  /**
   * Update spatial index for efficient queries
   */
  updateSpatialIndex(element) {
    this.spatialIndex.set(element.id, {
      type: element.type,
      position: element.position,
      bounds: this.calculateBounds(element)
    });
  }

  /**
   * Remove from spatial index
   */
  removeFromSpatialIndex(elementId) {
    this.spatialIndex.delete(elementId);
  }

  /**
   * Calculate element bounds
   */
  calculateBounds(element) {
    // Simple bounding box calculation
    // Can be enhanced for complex geometries
    return {
      min: { x: element.position.x, y: element.position.y },
      max: { x: element.position.x + (element.size?.x || 0), y: element.position.y + (element.size?.y || 0) }
    };
  }

  /**
   * Add operation to history for undo/redo
   */
  addToHistory(operation, data) {
    // Remove any operations after current index (for redo)
    this.elementHistory = this.elementHistory.slice(0, this.historyIndex + 1);
    
    // Add new operation
    this.elementHistory.push({
      operation,
      data,
      timestamp: new Date().toISOString()
    });
    
    this.historyIndex++;
    
    // Limit history size
    if (this.elementHistory.length > 100) {
      this.elementHistory.shift();
      this.historyIndex--;
    }
  }

  /**
   * Undo last operation
   */
  undo() {
    if (this.historyIndex >= 0) {
      const historyItem = this.elementHistory[this.historyIndex];
      this.revertOperation(historyItem);
      this.historyIndex--;
      return historyItem;
    }
    return null;
  }

  /**
   * Redo last undone operation
   */
  redo() {
    if (this.historyIndex < this.elementHistory.length - 1) {
      this.historyIndex++;
      const historyItem = this.elementHistory[this.historyIndex];
      this.applyOperation(historyItem);
      return historyItem;
    }
    return null;
  }

  /**
   * Revert an operation
   */
  revertOperation(historyItem) {
    switch (historyItem.operation) {
      case 'create':
        this.spatialData.delete(historyItem.data.id);
        this.removeFromSpatialIndex(historyItem.data.id);
        break;
      case 'update':
        this.spatialData.set(historyItem.data.elementId, historyItem.data.original);
        this.updateSpatialIndex(historyItem.data.original);
        break;
      case 'delete':
        this.spatialData.set(historyItem.data.id, historyItem.data);
        this.updateSpatialIndex(historyItem.data);
        break;
    }
  }

  /**
   * Apply an operation
   */
  applyOperation(historyItem) {
    switch (historyItem.operation) {
      case 'create':
        this.spatialData.set(historyItem.data.id, historyItem.data);
        this.updateSpatialIndex(historyItem.data);
        break;
      case 'update':
        this.spatialData.set(historyItem.data.elementId, historyItem.data.updated);
        this.updateSpatialIndex(historyItem.data.updated);
        break;
      case 'delete':
        this.spatialData.delete(historyItem.data.id);
        this.removeFromSpatialIndex(historyItem.data.id);
        break;
    }
  }

  /**
   * Export spatial configuration
   */
  exportConfiguration() {
    return {
      version: '1.0.0',
      exported: new Date().toISOString(),
      elements: Array.from(this.spatialData.values()),
      contexts: Array.from(this.connectorContexts.values()),
      streams: Array.from(this.dataStreams.values()),
      settings: {
        editMode: this.editMode,
        viewMode: this.viewMode
      }
    };
  }

  /**
   * Import spatial configuration
   */
  async importConfiguration(config) {
    // Clear existing data
    this.spatialData.clear();
    this.spatialIndex.clear();
    this.connectorContexts.clear();
    this.dataStreams.clear();
    
    // Import elements
    if (config.elements) {
      for (const element of config.elements) {
        this.spatialData.set(element.id, element);
        this.updateSpatialIndex(element);
      }
    }
    
    // Import contexts
    if (config.contexts) {
      for (const context of config.contexts) {
        this.connectorContexts.set(context.id, context);
      }
    }
    
    // Import streams
    if (config.streams) {
      for (const stream of config.streams) {
        this.dataStreams.set(stream.id, stream);
      }
    }
    
    // Import settings
    if (config.settings) {
      this.editMode = config.settings.editMode || false;
      this.viewMode = config.settings.viewMode || 'realtime';
    }
    
    this.logger.info('Configuration imported successfully');
    this.emit('configuration:imported', config);
  }

  /**
   * Get connector statistics
   */
  getStats() {
    return {
      ...super.getStats(),
      spatial: {
        totalElements: this.spatialData.size,
        elementsByType: this.getElementsByType(),
        totalContexts: this.connectorContexts.size,
        totalStreams: this.dataStreams.size,
        editMode: this.editMode,
        viewMode: this.viewMode
      },
      render: this.renderStats
    };
  }

  /**
   * Get elements grouped by type
   */
  getElementsByType() {
    const byType = {};
    for (const element of this.spatialData.values()) {
      byType[element.type] = (byType[element.type] || 0) + 1;
    }
    return byType;
  }

  /**
   * Validate connector configuration
   */
  static validateConfig(config) {
    const errors = [];
    
    if (!config.id) {
      errors.push('Map connector ID is required');
    }
    
    if (!config.name) {
      errors.push('Map connector name is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      type: 'map',
      name: 'Map Connector',
      description: 'Spatial configuration and real-time visualization connector',
      version: '1.0.0',
      author: 'Looking Glass Team',
      capabilities: ['spatial:config', 'visualization:realtime', 'integration:connector', 'context:spatial']
    };
  }
}

module.exports = MapConnector; 