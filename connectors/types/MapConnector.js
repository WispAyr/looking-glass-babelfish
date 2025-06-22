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
    // Ensure type is set for BaseConnector
    const connectorConfig = {
      ...config,
      type: 'map'
    };
    
    super(connectorConfig);
    
    // Map-specific properties
    this.mapLayers = new Map();
    this.spatialData = new Map();
    this.connectorContexts = new Map();
    this.editMode = config.editMode || false;
    this.viewMode = config.viewMode || 'realtime';
    
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
      lastRenderTime: null,
      averageRenderTime: 0
    };

    // Web interface configuration
    this.webInterface = {
      enabled: config.webInterface?.enabled ?? true,
      route: config.webInterface?.route ?? '/map.html',
      port: config.webInterface?.port ?? 3000,
      host: config.webInterface?.host ?? 'localhost'
    };

    // Auto-registration settings
    this.autoRegisterConnectors = config.autoRegisterConnectors ?? true;
    
    // Security settings
    this.security = {
      requireAuth: config.security?.requireAuth ?? false,
      allowedRoles: config.security?.allowedRoles ?? ['admin', 'operator'],
      sessionTimeout: config.security?.sessionTimeout ?? 3600
    };

    // Debug settings
    this.debug = {
      enabled: config.debug?.enabled ?? false,
      logLevel: config.debug?.logLevel ?? 'info',
      traceEvents: config.debug?.traceEvents ?? false,
      performanceMetrics: config.debug?.performanceMetrics ?? false
    };

    // Caching
    this.spatialCache = new Map();
    this.CACHE_TTL = 300000; // 5 minutes

    // WebSocket connections
    this.webSocketConnections = new Set();
    
    this.logger.info('Map Connector initialized', {
      id: this.id,
      webInterface: this.webInterface,
      autoRegisterConnectors: this.autoRegisterConnectors
    });
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
   * Override executeCapability to handle integration:connector
   */
  async executeCapability(capabilityId, operation, parameters) {
    if (capabilityId === 'integration:connector') {
      return await this.executeConnectorIntegration(operation, parameters);
    }
    // Fallback to original implementation if not integration:connector
    return super.executeCapability(capabilityId, operation, parameters);
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
        // Defensive check to ensure method exists
        if (typeof this.unregisterConnector === 'function') {
          return await this.unregisterConnector(parameters);
        } else {
          this.logger.warn('unregisterConnector method not found, using fallback');
          // Fallback implementation
          const { connectorId } = parameters;
          if (this.connectorContexts && this.connectorContexts.has(connectorId)) {
            this.connectorContexts.delete(connectorId);
            this.logger.info(`Unregistered connector (fallback): ${connectorId}`);
            return { success: true, connectorId };
          }
          return { success: false, message: 'Connector not found' };
        }
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

    // Sync changes back to source connector if linked
    await this.syncToSourceConnector(elementId, updatedElement, original);

    this.logger.info(`Updated spatial element: ${elementId}`);
    this.emit('element:updated', updatedElement);

    return updatedElement;
  }

  /**
   * Sync map changes back to source connector
   */
  async syncToSourceConnector(elementId, updatedElement, originalElement) {
    try {
      // Check if element is linked to a source connector
      const sourceConnectorId = updatedElement.metadata?.sourceConnectorId;
      if (!sourceConnectorId) {
        return; // No source connector linked
      }

      // Get the source connector context
      const connectorContext = this.connectorContexts.get(sourceConnectorId);
      if (!connectorContext) {
        this.logger.warn(`Source connector not found: ${sourceConnectorId}`);
        return;
      }

      // Determine what changed
      const changes = this.detectChanges(originalElement, updatedElement);
      if (Object.keys(changes).length === 0) {
        return; // No meaningful changes
      }

      // Emit sync event for the source connector
      this.emit('sync:to-connector', {
        sourceConnectorId,
        elementId,
        elementType: updatedElement.type,
        changes,
        original: originalElement,
        updated: updatedElement,
        timestamp: new Date().toISOString()
      });

      // Also emit connector-specific event
      this.emit(`sync:${sourceConnectorId}`, {
        elementId,
        elementType: updatedElement.type,
        changes,
        original: originalElement,
        updated: updatedElement,
        timestamp: new Date().toISOString()
      });

      this.logger.info(`Synced changes to ${sourceConnectorId}:`, changes);

    } catch (error) {
      this.logger.error('Error syncing to source connector:', error);
      // Don't throw - sync failure shouldn't break map updates
    }
  }

  /**
   * Detect meaningful changes between element versions
   */
  detectChanges(original, updated) {
    const changes = {};

    // Check position changes
    if (original.position && updated.position) {
      const posDiff = {
        x: Math.abs(original.position.x - updated.position.x),
        y: Math.abs(original.position.y - updated.position.y),
        z: Math.abs((original.position.z || 0) - (updated.position.z || 0))
      };

      if (posDiff.x > 1 || posDiff.y > 1 || posDiff.z > 1) {
        changes.position = {
          from: original.position,
          to: updated.position,
          delta: posDiff
        };
      }
    }

    // Check property changes
    if (original.properties && updated.properties) {
      const propChanges = {};
      const allKeys = new Set([...Object.keys(original.properties), ...Object.keys(updated.properties)]);

      for (const key of allKeys) {
        const oldValue = original.properties[key];
        const newValue = updated.properties[key];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          propChanges[key] = {
            from: oldValue,
            to: newValue
          };
        }
      }

      if (Object.keys(propChanges).length > 0) {
        changes.properties = propChanges;
      }
    }

    // Check name changes
    if (original.name !== updated.name) {
      changes.name = {
        from: original.name,
        to: updated.name
      };
    }

    return changes;
  }

  /**
   * Link a map element to a source connector
   */
  async linkElementToConnector(elementId, connectorId, connectorElementId) {
    const element = this.spatialData.get(elementId);
    if (!element) {
      throw new Error(`Element not found: ${elementId}`);
    }

    // Update element metadata to link to source connector
    const updatedElement = {
      ...element,
      metadata: {
        ...element.metadata,
        sourceConnectorId: connectorId,
        sourceElementId: connectorElementId,
        linked: new Date().toISOString()
      }
    };

    this.spatialData.set(elementId, updatedElement);
    this.updateSpatialIndex(updatedElement);

    this.logger.info(`Linked element ${elementId} to connector ${connectorId}:${connectorElementId}`);
    this.emit('element:linked', {
      elementId,
      connectorId,
      connectorElementId,
      timestamp: new Date().toISOString()
    });

    return updatedElement;
  }

  /**
   * Unlink a map element from its source connector
   */
  async unlinkElementFromConnector(elementId) {
    const element = this.spatialData.get(elementId);
    if (!element) {
      throw new Error(`Element not found: ${elementId}`);
    }

    const sourceConnectorId = element.metadata?.sourceConnectorId;
    const sourceElementId = element.metadata?.sourceElementId;

    // Update element metadata to remove link
    const updatedElement = {
      ...element,
      metadata: {
        ...element.metadata,
        sourceConnectorId: undefined,
        sourceElementId: undefined,
        unlinked: new Date().toISOString()
      }
    };

    this.spatialData.set(elementId, updatedElement);
    this.updateSpatialIndex(updatedElement);

    this.logger.info(`Unlinked element ${elementId} from connector ${sourceConnectorId}:${sourceElementId}`);
    this.emit('element:unlinked', {
      elementId,
      connectorId: sourceConnectorId,
      connectorElementId: sourceElementId,
      timestamp: new Date().toISOString()
    });

    return updatedElement;
  }

  /**
   * Get linked elements for a connector
   */
  getLinkedElements(connectorId) {
    return Array.from(this.spatialData.values())
      .filter(element => element.metadata?.sourceConnectorId === connectorId);
  }

  /**
   * Check if an element is linked to a connector
   */
  isElementLinked(elementId, connectorId = null) {
    const element = this.spatialData.get(elementId);
    if (!element) return false;

    if (connectorId) {
      return element.metadata?.sourceConnectorId === connectorId;
    }

    return !!element.metadata?.sourceConnectorId;
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
    const { dataType, filter = {}, visual = {} } = parameters;
    
    const streamId = this.generateStreamId(dataType);
    
    const dataStream = {
      id: streamId,
      dataType: dataType,
      filter: filter,
      visual: visual,
      subscribed: new Date().toISOString(),
      active: true
    };

    this.dataStreams.set(streamId, dataStream);
    
    this.logger.info(`Subscribed to data stream: ${streamId} (${dataType})`);
    this.emit('stream:subscribed', dataStream);

    return { success: true, streamId, dataType };
  }

  /**
   * Unsubscribe from a data stream
   */
  async unsubscribeFromDataStream(parameters) {
    const { streamId } = parameters;
    
    const dataStream = this.dataStreams.get(streamId);
    if (!dataStream) {
      this.logger.warn(`Data stream not found: ${streamId}`);
      return { success: false, message: 'Stream not found' };
    }

    dataStream.active = false;
    this.dataStreams.delete(streamId);
    
    this.logger.info(`Unsubscribed from data stream: ${streamId}`);
    this.emit('stream:unsubscribed', { streamId, dataType: dataStream.dataType });

    return { success: true, streamId };
  }

  /**
   * Set data filter for visualization
   */
  async setDataFilter(parameters) {
    const { streamId, filter = {} } = parameters;
    
    const dataStream = this.dataStreams.get(streamId);
    if (!dataStream) {
      throw new Error(`Data stream not found: ${streamId}`);
    }

    dataStream.filter = { ...dataStream.filter, ...filter };
    
    this.logger.info(`Updated data filter for stream: ${streamId}`);
    this.emit('filter:updated', { streamId, filter: dataStream.filter });

    return { success: true, streamId, filter: dataStream.filter };
  }

  /**
   * Highlight an element on the map
   */
  async highlightElement(parameters) {
    const { elementId, highlight = true, style = {} } = parameters;
    
    const element = this.spatialData.get(elementId);
    if (!element) {
      throw new Error(`Element not found: ${elementId}`);
    }

    // Update element with highlight properties
    const updatedElement = {
      ...element,
      highlighted: highlight,
      highlightStyle: style,
      metadata: {
        ...element.metadata,
        updated: new Date().toISOString()
      }
    };

    this.spatialData.set(elementId, updatedElement);
    
    this.logger.info(`Highlighted element: ${elementId}`);
    this.emit('element:highlighted', { elementId, highlighted: highlight, style });

    return { success: true, elementId, highlighted: highlight };
  }

  /**
   * Animate an element on the map
   */
  async animateElement(parameters) {
    const { elementId, animation = {}, duration = 1000 } = parameters;
    
    const element = this.spatialData.get(elementId);
    if (!element) {
      throw new Error(`Element not found: ${elementId}`);
    }

    // Add animation data to element
    const updatedElement = {
      ...element,
      animation: {
        ...animation,
        duration: duration,
        startTime: new Date().toISOString()
      },
      metadata: {
        ...element.metadata,
        updated: new Date().toISOString()
      }
    };

    this.spatialData.set(elementId, updatedElement);
    
    this.logger.info(`Started animation for element: ${elementId}`);
    this.emit('element:animation:started', { elementId, animation, duration });

    return { success: true, elementId, animation: updatedElement.animation };
  }

  /**
   * Register a connector with the map
   */
  async registerConnector(parameters) {
    const { connectorId, context = {}, capabilities = [] } = parameters;
    
    const connectorContext = {
      id: connectorId,
      context: context,
      capabilities: capabilities,
      registered: new Date().toISOString(),
      lastSync: new Date().toISOString()
    };

    this.connectorContexts.set(connectorId, connectorContext);
    
    this.logger.info(`Registered connector: ${connectorId}`);
    this.emit('connector:registered', { connectorId, timestamp: new Date().toISOString() });

    return { success: true, connectorId };
  }

  /**
   * Configure a connector's integration settings
   */
  async configureConnector(parameters) {
    const { connectorId, config = {} } = parameters;
    
    const connectorContext = this.connectorContexts.get(connectorId);
    if (!connectorContext) {
      throw new Error(`Connector not found: ${connectorId}`);
    }

    // Update configuration
    connectorContext.config = { ...connectorContext.config, ...config };
    connectorContext.lastSync = new Date().toISOString();

    this.logger.info(`Configured connector: ${connectorId}`);
    this.emit('connector:configured', { connectorId, config, timestamp: new Date().toISOString() });

    return { success: true, connectorId, config: connectorContext.config };
  }

  /**
   * Query connector data
   */
  async queryConnector(parameters) {
    const { connectorId, query = {} } = parameters;
    
    const connectorContext = this.connectorContexts.get(connectorId);
    if (!connectorContext) {
      throw new Error(`Connector not found: ${connectorId}`);
    }

    // Return connector context data
    return {
      success: true,
      connectorId,
      data: connectorContext.context,
      capabilities: connectorContext.capabilities,
      lastSync: connectorContext.lastSync
    };
  }

  /**
   * Sync data with a connector
   */
  async syncConnectorData(parameters) {
    const { connectorId, data = {} } = parameters;
    
    const connectorContext = this.connectorContexts.get(connectorId);
    if (!connectorContext) {
      throw new Error(`Connector not found: ${connectorId}`);
    }

    // Update context with new data
    connectorContext.context = { ...connectorContext.context, ...data };
    connectorContext.lastSync = new Date().toISOString();

    this.logger.info(`Synced data with connector: ${connectorId}`);
    this.emit('connector:synced', { connectorId, data, timestamp: new Date().toISOString() });

    return { success: true, connectorId, lastSync: connectorContext.lastSync };
  }

  /**
   * Unregister a connector from the map
   */
  async unregisterConnector(parameters) {
    const { connectorId } = parameters;
    
    const connectorContext = this.connectorContexts.get(connectorId);
    if (!connectorContext) {
      this.logger.warn(`Connector not found for unregistration: ${connectorId}`);
      return { success: false, message: 'Connector not found' };
    }

    // Remove connector context
    this.connectorContexts.delete(connectorId);

    // Remove any linked elements from this connector
    const linkedElements = this.getLinkedElements(connectorId);
    for (const element of linkedElements) {
      await this.unlinkElementFromConnector(element.id);
    }

    this.logger.info(`Unregistered connector: ${connectorId}`);
    this.emit('connector:unregistered', { connectorId, timestamp: new Date().toISOString() });

    return { success: true, connectorId };
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
   * Link contexts together
   */
  async linkContext(parameters) {
    const { sourceContextId, targetContextId, relationship = {} } = parameters;
    
    const relationshipId = `rel-${sourceContextId}-${targetContextId}`;
    
    const contextRelationship = {
      id: relationshipId,
      source: sourceContextId,
      target: targetContextId,
      relationship: relationship,
      created: new Date().toISOString()
    };

    // Store relationship (could be in a separate Map)
    if (!this.contextRelationships) {
      this.contextRelationships = new Map();
    }
    this.contextRelationships.set(relationshipId, contextRelationship);
    
    this.logger.info(`Linked contexts: ${sourceContextId} -> ${targetContextId}`);
    this.emit('context:linked', contextRelationship);

    return { success: true, relationshipId, source: sourceContextId, target: targetContextId };
  }

  /**
   * Unlink contexts
   */
  async unlinkContext(parameters) {
    const { relationshipId } = parameters;
    
    if (!this.contextRelationships || !this.contextRelationships.has(relationshipId)) {
      this.logger.warn(`Context relationship not found: ${relationshipId}`);
      return { success: false, message: 'Relationship not found' };
    }

    const relationship = this.contextRelationships.get(relationshipId);
    this.contextRelationships.delete(relationshipId);
    
    this.logger.info(`Unlinked contexts: ${relationship.source} -> ${relationship.target}`);
    this.emit('context:unlinked', relationship);

    return { success: true, relationshipId };
  }

  /**
   * Export context data
   */
  async exportContext(parameters) {
    const { contextId, format = 'json' } = parameters;
    
    let contextData;
    if (contextId.startsWith('connector:')) {
      const connectorId = contextId.replace('connector:', '');
      const connectorContext = this.connectorContexts.get(connectorId);
      if (connectorContext) {
        contextData = connectorContext.context;
      }
    }

    if (!contextData) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const exportData = {
      contextId,
      data: contextData,
      exported: new Date().toISOString(),
      format
    };

    this.logger.info(`Exported context: ${contextId}`);
    this.emit('context:exported', exportData);

    return exportData;
  }

  /**
   * Import context data
   */
  async importContext(parameters) {
    const { contextId, data = {}, overwrite = false } = parameters;
    
    if (contextId.startsWith('connector:')) {
      const connectorId = contextId.replace('connector:', '');
      const connectorContext = this.connectorContexts.get(connectorId);
      if (connectorContext) {
        if (overwrite) {
          connectorContext.context = data;
        } else {
          connectorContext.context = { ...connectorContext.context, ...data };
        }
        connectorContext.lastSync = new Date().toISOString();
      }
    }

    this.logger.info(`Imported context: ${contextId}`);
    this.emit('context:imported', { contextId, data });

    return { success: true, contextId };
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
      mapConnector: {
        id: this.id,
        name: this.name,
        description: this.description,
        webInterface: this.webInterface,
        autoRegisterConnectors: this.autoRegisterConnectors,
        security: this.security,
        debug: this.debug
      },
      elements: Array.from(this.spatialData.values()),
      contexts: Array.from(this.connectorContexts.values()),
      streams: Array.from(this.dataStreams.values()),
      settings: {
        editMode: this.editMode,
        viewMode: this.viewMode
      },
      performance: this.getPerformanceMetrics()
    };
  }

  /**
   * Import spatial configuration
   */
  async importConfiguration(config) {
    try {
      // Validate configuration
      if (!config.version || !config.mapConnector) {
        throw new Error('Invalid configuration format');
      }

      // Clear existing data
      this.spatialData.clear();
      this.spatialIndex.clear();
      this.connectorContexts.clear();
      this.dataStreams.clear();
      this.spatialCache.clear();
      
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
      
      this.logger.info('Configuration imported successfully', {
        elements: this.spatialData.size,
        contexts: this.connectorContexts.size,
        streams: this.dataStreams.size
      });
      
      this.emit('configuration:imported', config);
      
      // Broadcast configuration update
      this.broadcastToWebSockets({
        type: 'configuration:imported',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.logger.error('Failed to import configuration', error);
      throw error;
    }
  }

  /**
   * Get connector statistics
   */
  getStats() {
    const baseStats = super.getStatus();
    return {
      ...baseStats,
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

  /**
   * Get web interface configuration
   */
  getWebInterfaceConfig() {
    return {
      ...this.webInterface,
      url: `http://${this.webInterface.host}:${this.webInterface.port}${this.webInterface.route}`,
      websocketUrl: `ws://${this.webInterface.host}:${this.webInterface.port}/ws/map`
    };
  }

  /**
   * Add WebSocket connection
   */
  addWebSocketConnection(connection) {
    this.webSocketConnections.add(connection);
    this.logger.debug(`WebSocket connection added. Total connections: ${this.webSocketConnections.size}`);
  }

  /**
   * Remove WebSocket connection
   */
  removeWebSocketConnection(connection) {
    this.webSocketConnections.delete(connection);
    this.logger.debug(`WebSocket connection removed. Total connections: ${this.webSocketConnections.size}`);
  }

  /**
   * Broadcast to all WebSocket connections
   */
  broadcastToWebSockets(data) {
    const message = JSON.stringify(data);
    let sentCount = 0;
    
    for (const connection of this.webSocketConnections) {
      try {
        if (connection.readyState === 1) { // WebSocket.OPEN
          connection.send(message);
          sentCount++;
        }
      } catch (error) {
        this.logger.error('Failed to send WebSocket message', error);
      }
    }
    
    if (this.debug.enabled && sentCount > 0) {
      this.logger.debug(`Broadcasted to ${sentCount} WebSocket connections`, {
        type: data.type,
        sentCount,
        totalConnections: this.webSocketConnections.size
      });
    }
  }

  /**
   * Get cached spatial elements with TTL
   */
  getCachedSpatialElements(filter = {}) {
    const cacheKey = JSON.stringify(filter);
    
    if (this.spatialCache.has(cacheKey)) {
      const cached = this.spatialCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }
    
    const data = this.getSpatialElements(filter);
    this.spatialCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }

  /**
   * Clear spatial cache
   */
  clearSpatialCache() {
    this.spatialCache.clear();
    this.logger.debug('Spatial cache cleared');
  }

  /**
   * Get map health status
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      mapConnector: this.getStatus(),
      connectedConnectors: this.connectorContexts.size,
      spatialElements: this.spatialData.size,
      dataStreams: this.dataStreams.size,
      webSocketConnections: this.webSocketConnections.size,
      cacheSize: this.spatialCache.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.renderStats,
      webSocketConnections: this.webSocketConnections.size,
      cacheSize: this.spatialCache.size,
      spatialElements: this.spatialData.size,
      connectorContexts: this.connectorContexts.size,
      dataStreams: this.dataStreams.size
    };
  }

  /**
   * Auto-register connector with map
   */
  async autoRegisterConnector(connector) {
    if (!this.autoRegisterConnectors || connector.type === 'map') {
      return;
    }

    try {
      const spatialContext = await this.getConnectorSpatialContext(connector);
      const capabilities = connector.getCapabilities ? await connector.getCapabilities() : [];
      
      await this.execute('integration:connector', 'register', {
        connectorId: connector.id,
        context: spatialContext,
        capabilities: capabilities
      });

      this.logger.info(`Auto-registered connector: ${connector.id}`);
    } catch (error) {
      this.logger.error(`Failed to auto-register connector: ${connector.id}`, error);
    }
  }

  /**
   * Get spatial context from connector
   */
  async getConnectorSpatialContext(connector) {
    // Try to get spatial context from connector
    if (connector.getSpatialContext) {
      return await connector.getSpatialContext();
    }

    // Fallback to basic context
    return {
      type: connector.type,
      name: connector.name,
      description: connector.description,
      capabilities: connector.getCapabilities ? await connector.getCapabilities() : []
    };
  }

  /**
   * Update element from connector data
   */
  async updateElementFromConnector(elementId, connectorData) {
    const element = this.spatialData.get(elementId);
    if (!element) {
      return;
    }

    const updates = {
      properties: {
        ...element.properties,
        ...connectorData.properties
      },
      metadata: {
        ...element.metadata,
        lastSync: new Date().toISOString(),
        connectorData: connectorData
      }
    };

    await this.updateSpatialElement({
      elementId,
      updates
    });

    // Broadcast update to WebSocket connections
    this.broadcastToWebSockets({
      type: 'element:updated',
      element: this.spatialData.get(elementId)
    });
  }

  /**
   * Handle connector sync event
   */
  async handleConnectorSync(syncData) {
    const { elementId, changes, timestamp } = syncData;
    
    if (this.debug.traceEvents) {
      this.logger.debug('Handling connector sync', syncData);
    }

    try {
      await this.updateElementFromConnector(elementId, {
        changes,
        timestamp,
        source: 'connector'
      });
    } catch (error) {
      this.logger.error('Failed to handle connector sync', error);
    }
  }
}

module.exports = MapConnector; 