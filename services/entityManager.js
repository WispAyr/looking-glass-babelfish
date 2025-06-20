const EventEmitter = require('events');
const winston = require('winston');

/**
 * Entity Manager
 * 
 * Manages entities across the system including cameras, devices, and other resources.
 * Provides CRUD operations, entity discovery, and event integration.
 */
class EntityManager extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || winston.createLogger();
    
    // Entity storage
    this.entities = new Map();
    this.entityTypes = new Map();
    
    // Entity statistics
    this.stats = {
      totalEntities: 0,
      entitiesByType: new Map(),
      entitiesBySource: new Map(),
      lastUpdate: null
    };
    
    // Auto-discovery settings
    this.autoDiscovery = {
      enabled: config.autoDiscovery?.enabled || false,
      refreshInterval: config.autoDiscovery?.refreshInterval || 300000,
      refreshTimer: null
    };
    
    // Entity templates
    this.entityTemplates = new Map();
    
    this.logger.info('Entity Manager initialized');
  }
  
  /**
   * Create or update an entity
   */
  async createEntity(entityData) {
    try {
      // Validate entity data
      this.validateEntityData(entityData);
      
      // Generate entity ID if not provided
      if (!entityData.id) {
        entityData.id = this.generateEntityId(entityData.type);
      }
      
      // Add metadata
      entityData.metadata = {
        ...entityData.metadata,
        created: entityData.metadata?.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        source: entityData.metadata?.source || 'unknown',
        connectorId: entityData.metadata?.connectorId || 'unknown'
      };
      
      // Check if entity exists
      const existingEntity = this.entities.get(entityData.id);
      if (existingEntity) {
        // Update existing entity
        const updatedEntity = {
          ...existingEntity,
          ...entityData,
          metadata: {
            ...existingEntity.metadata,
            ...entityData.metadata,
            updated: new Date().toISOString()
          }
        };
        
        this.entities.set(entityData.id, updatedEntity);
        this.updateStats(updatedEntity, 'update');
        
        this.logger.info(`Entity updated: ${entityData.id} (${entityData.type})`);
        this.emit('entity:updated', updatedEntity);
        
        return updatedEntity;
      } else {
        // Create new entity
        this.entities.set(entityData.id, entityData);
        this.updateStats(entityData, 'create');
        
        this.logger.info(`Entity created: ${entityData.id} (${entityData.type})`);
        this.emit('entity:created', entityData);
        
        return entityData;
      }
    } catch (error) {
      this.logger.error('Error creating entity:', error);
      throw error;
    }
  }
  
  /**
   * Get entity by ID
   */
  getEntity(entityId) {
    return this.entities.get(entityId);
  }
  
  /**
   * Get entities by filter
   */
  getEntities(filter = {}) {
    let filtered = Array.from(this.entities.values());
    
    if (filter.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }
    
    if (filter.source) {
      filtered = filtered.filter(e => e.metadata?.source === filter.source);
    }
    
    if (filter.connectorId) {
      filtered = filtered.filter(e => e.metadata?.connectorId === filter.connectorId);
    }
    
    if (filter.status) {
      filtered = filtered.filter(e => e.status === filter.status);
    }
    
    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }
    
    return filtered;
  }
  
  /**
   * Update entity
   */
  async updateEntity(entityId, updates) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }
    
    const updatedEntity = {
      ...entity,
      ...updates,
      metadata: {
        ...entity.metadata,
        ...updates.metadata,
        updated: new Date().toISOString()
      }
    };
    
    this.entities.set(entityId, updatedEntity);
    this.updateStats(updatedEntity, 'update');
    
    this.logger.info(`Entity updated: ${entityId}`);
    this.emit('entity:updated', updatedEntity);
    
    return updatedEntity;
  }
  
  /**
   * Delete entity
   */
  async deleteEntity(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }
    
    this.entities.delete(entityId);
    this.updateStats(entity, 'delete');
    
    this.logger.info(`Entity deleted: ${entityId}`);
    this.emit('entity:deleted', entity);
    
    return entity;
  }
  
  /**
   * Create camera entity from UniFi Protect camera data
   */
  async createCameraEntity(cameraData, connectorId) {
    const entityData = {
      id: `camera-${cameraData.id}`,
      type: 'camera',
      name: cameraData.name || cameraData.id,
      description: cameraData.description || `Camera ${cameraData.id}`,
      status: cameraData.state || 'unknown',
      data: {
        ...cameraData,
        capabilities: {
          motion: cameraData.featureFlags?.hasMotion || false,
          recording: cameraData.featureFlags?.hasRecording || false,
          smart: cameraData.featureFlags?.hasSmartDetect || false,
          audio: cameraData.featureFlags?.hasAudio || false,
          speaker: cameraData.featureFlags?.hasSpeaker || false,
          lcd: cameraData.featureFlags?.hasLcd || false,
          sdCard: cameraData.featureFlags?.hasSdCard || false
        },
        settings: {
          recording: cameraData.recordingSettings || {},
          motion: cameraData.motionSettings || {},
          smart: cameraData.smartDetectSettings || {}
        }
      },
      metadata: {
        source: 'unifi-protect',
        connectorId: connectorId,
        cameraId: cameraData.id,
        model: cameraData.modelKey,
        firmware: cameraData.firmwareVersion,
        mac: cameraData.mac,
        ip: cameraData.ip
      }
    };
    
    return await this.createEntity(entityData);
  }
  
  /**
   * Start auto-discovery
   */
  startAutoDiscovery() {
    if (!this.autoDiscovery.enabled) {
      return;
    }
    
    this.logger.info('Starting entity auto-discovery');
    
    // Clear existing timer
    if (this.autoDiscovery.refreshTimer) {
      clearInterval(this.autoDiscovery.refreshTimer);
    }
    
    // Start refresh timer
    this.autoDiscovery.refreshTimer = setInterval(() => {
      this.performAutoDiscovery();
    }, this.autoDiscovery.refreshInterval);
    
    // Perform initial discovery
    this.performAutoDiscovery();
  }
  
  /**
   * Stop auto-discovery
   */
  stopAutoDiscovery() {
    if (this.autoDiscovery.refreshTimer) {
      clearInterval(this.autoDiscovery.refreshTimer);
      this.autoDiscovery.refreshTimer = null;
      this.logger.info('Entity auto-discovery stopped');
    }
  }
  
  /**
   * Perform auto-discovery
   */
  async performAutoDiscovery() {
    try {
      this.logger.debug('Performing entity auto-discovery');
      
      // Emit discovery event for connectors to handle
      this.emit('discovery:requested', {
        timestamp: new Date().toISOString(),
        source: 'entity-manager'
      });
      
      this.stats.lastUpdate = new Date().toISOString();
    } catch (error) {
      this.logger.error('Error during auto-discovery:', error);
    }
  }
  
  /**
   * Validate entity data
   */
  validateEntityData(entityData) {
    if (!entityData.type) {
      throw new Error('Entity type is required');
    }
    
    if (!entityData.name) {
      throw new Error('Entity name is required');
    }
  }
  
  /**
   * Generate entity ID
   */
  generateEntityId(type) {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Update statistics
   */
  updateStats(entity, operation) {
    this.stats.totalEntities = this.entities.size;
    this.stats.lastUpdate = new Date().toISOString();
    
    // Count by type
    const typeCount = this.stats.entitiesByType.get(entity.type) || 0;
    this.stats.entitiesByType.set(entity.type, typeCount + (operation === 'delete' ? -1 : 1));
    
    // Count by source
    const source = entity.metadata?.source || 'unknown';
    const sourceCount = this.stats.entitiesBySource.get(source) || 0;
    this.stats.entitiesBySource.set(source, sourceCount + (operation === 'delete' ? -1 : 1));
  }
  
  /**
   * Get entity statistics
   */
  getStats() {
    return {
      ...this.stats,
      entities: this.entities.size,
      autoDiscovery: {
        enabled: this.autoDiscovery.enabled,
        refreshInterval: this.autoDiscovery.refreshInterval
      }
    };
  }
  
  /**
   * Export entities
   */
  exportEntities(filter = {}) {
    const entities = this.getEntities(filter);
    return entities.map(entity => ({
      ...entity,
      metadata: {
        ...entity.metadata,
        exported: new Date().toISOString()
      }
    }));
  }
}

module.exports = EntityManager; 