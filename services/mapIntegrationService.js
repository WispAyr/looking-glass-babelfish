const EventEmitter = require('events');
const winston = require('winston');

/**
 * Map Integration Service
 * 
 * Handles the production-ready integration between connectors and maps,
 * including automatic registration, event synchronization, and WebSocket management.
 */
class MapIntegrationService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      autoRegisterConnectors: config.autoRegisterConnectors ?? true,
      enableWebSockets: config.enableWebSockets ?? true,
      syncInterval: config.syncInterval ?? 5000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      ...config
    };

    // Core services
    this.connectorRegistry = null;
    this.mapConnectors = new Map();
    this.webSocketServer = null;
    
    // Integration state
    this.connectorMapLinks = new Map(); // connectorId -> mapConnectorId[]
    this.syncQueue = [];
    this.syncInProgress = false;
    
    // Performance tracking
    this.metrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageSyncTime: 0,
      lastSyncTime: null,
      activeConnections: 0
    };

    // Logger
    this.logger = winston.createLogger({
      level: config.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.logger.info('Map Integration Service initialized', this.config);
  }

  /**
   * Initialize the service with required dependencies
   */
  async initialize(connectorRegistry, webSocketServer = null) {
    this.connectorRegistry = connectorRegistry;
    this.webSocketServer = webSocketServer;

    // Set up event listeners
    this.setupEventListeners();
    
    // Start sync process
    if (this.config.autoRegisterConnectors) {
      this.startSyncProcess();
    }

    this.logger.info('Map Integration Service initialized successfully');
  }

  /**
   * Set up event listeners for connector and map events
   */
  setupEventListeners() {
    if (!this.connectorRegistry) {
      throw new Error('Connector registry not available');
    }

    // Listen for connector registration
    this.connectorRegistry.on('connector:registered', async (connector) => {
      await this.handleConnectorRegistered(connector);
    });

    // Listen for connector unregistration
    this.connectorRegistry.on('connector:unregistered', async (connectorId) => {
      await this.handleConnectorUnregistered(connectorId);
    });

    // Listen for connector data updates
    this.connectorRegistry.on('connector:data:updated', async (data) => {
      await this.handleConnectorDataUpdate(data);
    });

    // Listen for connector status changes
    this.connectorRegistry.on('connector:status:changed', async (status) => {
      await this.handleConnectorStatusChange(status);
    });
  }

  /**
   * Register a map connector
   */
  async registerMapConnector(mapConnector) {
    if (mapConnector.type !== 'map') {
      throw new Error('Connector must be a map connector');
    }

    this.mapConnectors.set(mapConnector.id, mapConnector);
    
    // Set up map-specific event listeners
    this.setupMapEventListeners(mapConnector);
    
    // Auto-register existing connectors with this map
    if (this.config.autoRegisterConnectors) {
      await this.autoRegisterConnectorsWithMap(mapConnector);
    }

    this.logger.info(`Map connector registered: ${mapConnector.id}`);
    this.emit('map:registered', mapConnector);
  }

  /**
   * Unregister a map connector
   */
  async unregisterMapConnector(mapConnectorId) {
    const mapConnector = this.mapConnectors.get(mapConnectorId);
    if (!mapConnector) {
      return;
    }

    // Remove from map connectors
    this.mapConnectors.delete(mapConnectorId);
    
    // Remove from connector links
    for (const [connectorId, mapIds] of this.connectorMapLinks.entries()) {
      const index = mapIds.indexOf(mapConnectorId);
      if (index > -1) {
        mapIds.splice(index, 1);
        if (mapIds.length === 0) {
          this.connectorMapLinks.delete(connectorId);
        }
      }
    }

    this.logger.info(`Map connector unregistered: ${mapConnectorId}`);
    this.emit('map:unregistered', mapConnectorId);
  }

  /**
   * Handle connector registration
   */
  async handleConnectorRegistered(connector) {
    if (connector.type === 'map') {
      await this.registerMapConnector(connector);
      return;
    }

    // Auto-register non-map connectors with all map connectors
    if (this.config.autoRegisterConnectors) {
      for (const mapConnector of this.mapConnectors.values()) {
        await this.registerConnectorWithMap(connector, mapConnector);
      }
    }
  }

  /**
   * Handle connector unregistration
   */
  async handleConnectorUnregistered(connectorId) {
    // Remove from all map connectors
    for (const mapConnector of this.mapConnectors.values()) {
      try {
        await mapConnector.execute('integration:connector', 'unregister', {
          connectorId: connectorId
        });
      } catch (error) {
        this.logger.error(`Failed to unregister connector ${connectorId} from map ${mapConnector.id}`, error);
      }
    }

    // Remove from connector links
    this.connectorMapLinks.delete(connectorId);

    this.logger.info(`Connector unregistered from all maps: ${connectorId}`);
  }

  /**
   * Handle connector data updates
   */
  async handleConnectorDataUpdate(data) {
    const { connectorId, elementId, updates, timestamp } = data;
    
    // Find linked map connectors
    const linkedMapIds = this.connectorMapLinks.get(connectorId) || [];
    
    for (const mapId of linkedMapIds) {
      const mapConnector = this.mapConnectors.get(mapId);
      if (mapConnector) {
        try {
          await mapConnector.handleConnectorSync({
            elementId,
            changes: updates,
            timestamp,
            connectorId
          });
        } catch (error) {
          this.logger.error(`Failed to sync data to map ${mapId}`, error);
        }
      }
    }
  }

  /**
   * Handle connector status changes
   */
  async handleConnectorStatusChange(status) {
    const { connectorId, status: newStatus, timestamp } = status;
    
    // Broadcast status change to all map connectors
    for (const mapConnector of this.mapConnectors.values()) {
      try {
        mapConnector.broadcastToWebSockets({
          type: 'connector:status',
          connector: {
            id: connectorId,
            status: newStatus,
            timestamp
          }
        });
      } catch (error) {
        this.logger.error(`Failed to broadcast status to map ${mapConnector.id}`, error);
      }
    }
  }

  /**
   * Set up map-specific event listeners
   */
  setupMapEventListeners(mapConnector) {
    // Listen for map element updates
    mapConnector.on('element:updated', async (element) => {
      await this.handleMapElementUpdate(mapConnector, element);
    });

    // Listen for map element creation
    mapConnector.on('element:created', async (element) => {
      await this.handleMapElementCreated(mapConnector, element);
    });

    // Listen for map element deletion
    mapConnector.on('element:deleted', async (elementId) => {
      await this.handleMapElementDeleted(mapConnector, elementId);
    });

    // Listen for map configuration changes
    mapConnector.on('configuration:imported', async (config) => {
      await this.handleMapConfigurationImported(mapConnector, config);
    });
  }

  /**
   * Handle map element updates
   */
  async handleMapElementUpdate(mapConnector, element) {
    const { sourceConnectorId, sourceElementId } = element.metadata || {};
    
    if (sourceConnectorId && sourceElementId) {
      const connector = this.connectorRegistry.getConnector(sourceConnectorId);
      if (connector && connector.handleMapSync) {
        try {
          await connector.handleMapSync({
            elementId: sourceElementId,
            changes: element.changes,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          this.logger.error(`Failed to sync map update to connector ${sourceConnectorId}`, error);
        }
      }
    }
  }

  /**
   * Handle map element creation
   */
  async handleMapElementCreated(mapConnector, element) {
    this.logger.debug(`Map element created: ${element.id} in map ${mapConnector.id}`);
  }

  /**
   * Handle map element deletion
   */
  async handleMapElementDeleted(mapConnector, elementId) {
    this.logger.debug(`Map element deleted: ${elementId} from map ${mapConnector.id}`);
  }

  /**
   * Handle map configuration import
   */
  async handleMapConfigurationImported(mapConnector, config) {
    this.logger.info(`Map configuration imported: ${mapConnector.id}`, {
      elements: config.elements?.length || 0,
      contexts: config.contexts?.length || 0
    });
  }

  /**
   * Register a connector with a specific map
   */
  async registerConnectorWithMap(connector, mapConnector) {
    try {
      // Get spatial context from connector
      const spatialContext = await this.getConnectorSpatialContext(connector);
      const capabilities = connector.getCapabilities ? await connector.getCapabilities() : [];
      
      // Register with map
      await mapConnector.execute('integration:connector', 'register', {
        connectorId: connector.id,
        context: spatialContext,
        capabilities: capabilities
      });

      // Track the link
      if (!this.connectorMapLinks.has(connector.id)) {
        this.connectorMapLinks.set(connector.id, []);
      }
      this.connectorMapLinks.get(connector.id).push(mapConnector.id);

      this.logger.info(`Connector ${connector.id} registered with map ${mapConnector.id}`);
      
    } catch (error) {
      this.logger.error(`Failed to register connector ${connector.id} with map ${mapConnector.id}`, error);
      throw error;
    }
  }

  /**
   * Auto-register all existing connectors with a map
   */
  async autoRegisterConnectorsWithMap(mapConnector) {
    const connectors = this.connectorRegistry.getAllConnectors();
    
    for (const connector of connectors) {
      if (connector.type !== 'map') {
        await this.registerConnectorWithMap(connector, mapConnector);
      }
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
   * Start the sync process
   */
  startSyncProcess() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.processSyncQueue();
    }, this.config.syncInterval);

    this.logger.info('Sync process started');
  }

  /**
   * Stop the sync process
   */
  stopSyncProcess() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.logger.info('Sync process stopped');
  }

  /**
   * Process the sync queue
   */
  async processSyncQueue() {
    if (this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      const syncTasks = [...this.syncQueue];
      this.syncQueue = [];

      for (const task of syncTasks) {
        await this.executeSyncTask(task);
      }

      // Update metrics
      const duration = Date.now() - startTime;
      this.metrics.totalSyncs++;
      this.metrics.successfulSyncs++;
      this.metrics.averageSyncTime = (this.metrics.averageSyncTime + duration) / 2;
      this.metrics.lastSyncTime = new Date().toISOString();

    } catch (error) {
      this.metrics.failedSyncs++;
      this.logger.error('Sync process failed', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Execute a sync task
   */
  async executeSyncTask(task) {
    const { type, data, retries = 0 } = task;

    try {
      switch (type) {
        case 'connector:register':
          await this.handleConnectorRegistered(data.connector);
          break;
        case 'connector:unregister':
          await this.handleConnectorUnregistered(data.connectorId);
          break;
        case 'data:update':
          await this.handleConnectorDataUpdate(data);
          break;
        default:
          this.logger.warn(`Unknown sync task type: ${type}`);
      }
    } catch (error) {
      if (retries < this.config.maxRetries) {
        // Retry the task
        setTimeout(() => {
          this.syncQueue.push({
            ...task,
            retries: retries + 1
          });
        }, this.config.retryDelay * (retries + 1));
      } else {
        this.logger.error(`Sync task failed after ${retries} retries`, error);
      }
    }
  }

  /**
   * Add a sync task to the queue
   */
  addSyncTask(type, data) {
    this.syncQueue.push({ type, data });
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      status: 'running',
      config: this.config,
      metrics: this.metrics,
      mapConnectors: Array.from(this.mapConnectors.keys()),
      connectorLinks: Object.fromEntries(this.connectorMapLinks),
      syncQueueLength: this.syncQueue.length,
      syncInProgress: this.syncInProgress,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      mapConnectors: this.mapConnectors.size,
      connectorLinks: this.connectorMapLinks.size,
      syncQueueLength: this.syncQueue.length
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.stopSyncProcess();
    
    // Clear all maps
    this.mapConnectors.clear();
    this.connectorMapLinks.clear();
    this.syncQueue = [];

    this.logger.info('Map Integration Service cleaned up');
  }
}

module.exports = MapIntegrationService; 