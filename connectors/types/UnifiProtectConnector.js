const BaseConnector = require('../BaseConnector');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const WebSocket = require('ws');
const axios = require('axios');

/**
 * Unifi Protect Connector
 * 
 * Provides integration with Ubiquiti's Unifi Protect video management system.
 * Supports camera management, video streaming, motion detection, and recording access.
 * Includes automatic camera discovery and entity management.
 * 
 * Uses API key authentication with X-API-KEY header as per UniFi Protect API v6.0.45
 */
class UnifiProtectConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // API client
    this.api = null;
    
    // API key authentication
    this.apiKey = this.config.apiKey;
    if (!this.apiKey) {
      throw new Error('API key is required for UniFi Protect authentication');
    }
    
    // Bootstrap data for UniFi Protect
    this.bootstrapData = null;
    this.lastUpdateId = null;
    this.bootstrapCache = new Map();
    this.bootstrapExpiry = 5 * 60 * 1000; // 5 minutes
    
    // Camera cache
    this.cameras = new Map();
    this.cameraCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    
    // Event subscriptions
    this.eventSubscriptions = new Map();
    
    // WebSocket connection with enhanced reliability
    this.ws = null;
    this.wsConnected = false;
    this.wsReconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.heartbeatInterval = 30000; // 30 seconds
    this.heartbeatTimer = null;
    this.lastHeartbeat = Date.now();
    
    // Event deduplication and state tracking
    this.lastEventIds = new Map();
    this.deviceStates = new Map();
    this.eventQueue = [];
    this.processingEvents = false;
    
    // Rate limiting
    this.rateLimiter = {
      requests: 0,
      windowStart: Date.now(),
      maxRequests: this.config.rateLimit?.requests || 100,
      windowMs: this.config.rateLimit?.window || 60000
    };
    
    // Entity management
    this.entityManager = null;
    this.autoDiscovery = {
      enabled: this.config.autoDiscovery?.enabled || false,
      refreshInterval: this.config.autoDiscovery?.refreshInterval || 300000,
      createEntities: this.config.autoDiscovery?.createEntities || false,
      subscribeToEvents: this.config.autoDiscovery?.subscribeToEvents || false,
      eventTypes: this.config.autoDiscovery?.eventTypes || ['motion', 'smart', 'recording', 'connection'],
      refreshTimer: null
    };
    
    // Entity tracking
    this.discoveredEntities = new Set();
    this.entitySubscriptions = new Map();
    
    // Video streaming
    this.streamSessions = new Map();
    this.streamTimeout = 30000; // 30 seconds
  }
  
  /**
   * Set entity manager reference
   */
  setEntityManager(entityManager) {
    this.entityManager = entityManager;
    
    // Listen for discovery requests
    if (this.entityManager) {
      this.entityManager.on('discovery:requested', () => {
        this.performCameraDiscovery();
      });
    }
  }
  
  /**
   * Perform connection
   */
  async performConnect() {
    try {
      const { host, port, protocol } = this.config;
      
      this.logger.debug(`Attempting to connect to UniFi Protect at ${host}`);
      
      // Try session-based authentication first if configured
      if (this.config.useSessionAuth && this.config.username && this.config.password) {
        try {
          this.logger.debug('Attempting session-based authentication...');
          const bootstrapData = await this.authenticateWithSession();
          if (bootstrapData && bootstrapData.accessKey) {
            this.logger.info('Successfully authenticated with UniFi Protect using session-based auth');
            this.cacheBootstrapData(bootstrapData);
          } else {
            throw new Error('Session authentication failed - no bootstrap data received');
          }
        } catch (sessionError) {
          this.logger.warn('Session-based authentication failed, falling back to API key:', sessionError.message);
          // Fall back to API key authentication
          await this.authenticateWithAPIKey();
        }
      } else {
        // Use API key authentication
        await this.authenticateWithAPIKey();
      }
      
      // Load initial camera data
      await this.loadCameras();
      
      // Set up WebSocket connection for real-time updates
      await this.connectWebSocket();
      
      // Start event polling as backup
      this.startEventPolling();
      
      this.logger.info('UniFi Protect connection established successfully');
      
    } catch (error) {
      this.logger.error('Failed to connect to UniFi Protect:', error.message);
      throw error;
    }
  }
  
  /**
   * Authenticate using API key
   */
  async authenticateWithAPIKey() {
    try {
      const response = await this.makeRequest('GET', '/proxy/protect/integration/v1/meta/info');
      this.logger.info('Successfully authenticated with UniFi Protect API using API key');
      this.logger.debug('API Info:', response);
    } catch (error) {
      const errorMessage = error?.message || String(error);
      this.logger.error('API key authentication failed:', errorMessage);
      throw new Error(`Failed to authenticate with UniFi Protect API: ${errorMessage}`);
    }
  }
  
  /**
   * Perform disconnection
   */
  async performDisconnect() {
    // Stop auto-discovery
    this.stopAutoDiscovery();
    
    // Clear caches
    this.cameras.clear();
    this.cameraCache.clear();
    this.eventSubscriptions.clear();
    this.entitySubscriptions.clear();
    
    // Disconnect WebSocket
    this.disconnectWebSocket();
    
    // Clear API client
    this.api = null;
  }
  
  /**
   * Perform camera discovery and entity creation
   */
  async performCameraDiscovery() {
    try {
      this.logger.info('Performing camera discovery...');
      
      // Load cameras from API
      const cameras = await this.loadCameras();
      
      if (!cameras || !cameras.data) {
        this.logger.warn('No camera data available for discovery');
        return;
      }
      
      const cameraList = Array.isArray(cameras.data) ? cameras.data : cameras.data.data || [];
      
      this.logger.info(`Discovered ${cameraList.length} cameras`);
      
      // Create entities for each camera if enabled
      if (this.autoDiscovery.createEntities && this.entityManager) {
        for (const camera of cameraList) {
          try {
            const entity = await this.entityManager.createCameraEntity(camera, this.id);
            this.discoveredEntities.add(entity.id);
            
            this.logger.info(`Created entity for camera: ${camera.name} (${camera.id})`);
            
            // Subscribe to events for this camera if enabled
            if (this.autoDiscovery.subscribeToEvents) {
              await this.subscribeToCameraEvents(camera.id, entity.id);
            }
          } catch (error) {
            this.logger.error(`Error creating entity for camera ${camera.id}:`, error);
          }
        }
      }
      
      // Emit discovery completed event
      this.emit('discovery:completed', {
        connectorId: this.id,
        camerasFound: cameraList.length,
        entitiesCreated: this.discoveredEntities.size,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.logger.error('Error during camera discovery:', error);
      this.emit('discovery:error', {
        connectorId: this.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Subscribe to events for a specific camera
   */
  async subscribeToCameraEvents(cameraId, entityId) {
    try {
      this.logger.info(`Subscribing to events for camera: ${cameraId}`);
      
      // Subscribe to motion events
      if (this.autoDiscovery.eventTypes.includes('motion')) {
        await this.subscribeToMotionEvents({ cameraId });
      }
      
      // Subscribe to smart detection events
      if (this.autoDiscovery.eventTypes.includes('smart')) {
        await this.subscribeToSmartEvents({ cameraId });
      }
      
      // Subscribe to recording events
      if (this.autoDiscovery.eventTypes.includes('recording')) {
        await this.subscribeToRecordingEvents({ cameraId });
      }
      
      // Subscribe to connection events
      if (this.autoDiscovery.eventTypes.includes('connection')) {
        await this.subscribeToConnectionEvents({ cameraId });
      }
      
      // Track subscription
      this.entitySubscriptions.set(entityId, {
        cameraId,
        eventTypes: this.autoDiscovery.eventTypes,
        subscribed: new Date().toISOString()
      });
      
      this.logger.info(`Successfully subscribed to events for camera: ${cameraId}`);
      
    } catch (error) {
      this.logger.error(`Error subscribing to events for camera ${cameraId}:`, error);
    }
  }
  
  /**
   * Subscribe to smart detection events
   */
  async subscribeToSmartEvents(parameters) {
    const { cameraId, types = ['person', 'vehicle', 'animal'] } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required for smart events subscription');
    }
    
    const subscriptionId = `smart_${cameraId}`;
    this.eventSubscriptions.set(subscriptionId, {
      type: 'smart',
      cameraId,
      types,
      active: true,
      timestamp: Date.now()
    });
    
    this.logger.info(`Subscribed to smart events for camera ${cameraId}: ${types.join(', ')}`);
    return { subscriptionId, status: 'subscribed' };
  }
  
  /**
   * Unsubscribe from smart detection events
   */
  async unsubscribeFromSmartEvents(parameters) {
    const { cameraId } = parameters;
    const subscriptionId = `smart_${cameraId}`;
    
    if (this.eventSubscriptions.has(subscriptionId)) {
      this.eventSubscriptions.delete(subscriptionId);
      this.logger.info(`Unsubscribed from smart events for camera ${cameraId}`);
      return { subscriptionId, status: 'unsubscribed' };
    }
    
    throw new Error(`No smart events subscription found for camera ${cameraId}`);
  }
  
  /**
   * Subscribe to recording events
   */
  async subscribeToRecordingEvents(parameters) {
    const { cameraId } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required');
    }
    
    // For now, this is handled through WebSocket events
    this.logger.debug(`Recording events will be handled via WebSocket for camera: ${cameraId}`);
    
    return {
      success: true,
      message: 'Recording events will be handled via WebSocket',
      cameraId
    };
  }
  
  /**
   * Subscribe to connection events
   */
  async subscribeToConnectionEvents(parameters) {
    const { cameraId } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required');
    }
    
    // For now, this is handled through WebSocket events
    this.logger.debug(`Connection events will be handled via WebSocket for camera: ${cameraId}`);
    
    return {
      success: true,
      message: 'Connection events will be handled via WebSocket',
      cameraId
    };
  }
  
  /**
   * Start auto-discovery
   */
  startAutoDiscovery() {
    if (!this.autoDiscovery.enabled) {
      return;
    }
    
    this.logger.info('Starting camera auto-discovery');
    
    // Clear existing timer
    if (this.autoDiscovery.refreshTimer) {
      clearInterval(this.autoDiscovery.refreshTimer);
    }
    
    // Start refresh timer
    this.autoDiscovery.refreshTimer = setInterval(() => {
      this.performCameraDiscovery();
    }, this.autoDiscovery.refreshInterval);
    
    this.logger.info(`Auto-discovery started with ${this.autoDiscovery.refreshInterval}ms interval`);
  }
  
  /**
   * Stop auto-discovery
   */
  stopAutoDiscovery() {
    if (this.autoDiscovery.refreshTimer) {
      clearInterval(this.autoDiscovery.refreshTimer);
      this.autoDiscovery.refreshTimer = null;
      this.logger.info('Camera auto-discovery stopped');
    }
  }
  
  /**
   * Execute capability
   */
  async executeCapability(capabilityId, operation, parameters) {
    try {
      switch (capabilityId) {
        case 'camera:management':
          return await this.executeCameraManagement(operation, parameters);
        case 'camera:video:stream':
          return await this.executeVideoStream(operation, parameters);
        case 'camera:snapshot':
          return await this.executeSnapshotCapability(operation, parameters);
        case 'camera:event:motion':
          return await this.executeMotionEvents(operation, parameters);
        case 'camera:event:smart':
          return await this.executeSmartEvents(operation, parameters);
        case 'camera:event:ring':
          return await this.executeRingEvents(operation, parameters);
        case 'camera:recording:management':
          return await this.executeRecordingManagement(operation, parameters);
        case 'system:info':
          return await this.executeSystemInfo(operation, parameters);
        case 'system:users':
          return await this.executeUserManagement(operation, parameters);
        case 'realtime:events':
          return await this.executeRealtimeEvents(operation, parameters);
        default:
          throw new Error(`Unknown capability: ${capabilityId}`);
      }
    } catch (error) {
      this.logger.error(`Error executing capability ${capabilityId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Camera management operations
   */
  async executeCameraManagement(operation, parameters) {
    switch (operation) {
      case 'list':
        return this.listCameras(parameters);
      
      case 'get':
        return this.getCamera(parameters);
      
      case 'update':
        return this.updateCamera(parameters);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * Video streaming operations
   */
  async executeVideoStream(operation, parameters) {
    switch (operation) {
      case 'read':
        return await this.getStreamUrl(parameters);
      case 'start':
        return await this.startVideoStream(parameters);
      case 'stop':
        return this.stopVideoStream(parameters.sessionId);
      default:
        throw new Error(`Unknown video stream operation: ${operation}`);
    }
  }
  
  /**
   * Motion event operations
   */
  async executeMotionEvents(operation, parameters) {
    switch (operation) {
      case 'subscribe':
        return this.subscribeToMotionEvents(parameters);
      
      case 'unsubscribe':
        return this.unsubscribeFromMotionEvents(parameters);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * Recording management operations
   */
  async executeRecordingManagement(operation, parameters) {
    switch (operation) {
      case 'list':
        return this.listRecordings(parameters);
      
      case 'get':
        return this.getRecording(parameters);
      
      case 'download':
        return this.downloadRecording(parameters);
      
      case 'delete':
        return this.deleteRecording(parameters);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * System information operations
   */
  async executeSystemInfo(operation, parameters) {
    switch (operation) {
      case 'read':
        return this.getSystemInfo(parameters);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * User management operations
   */
  async executeUserManagement(operation, parameters) {
    switch (operation) {
      case 'list':
        return this.listUsers(parameters);
      
      case 'get':
        return this.getUser(parameters);
      
      case 'create':
        return this.createUser(parameters);
      
      case 'update':
        return this.updateUser(parameters);
      
      case 'delete':
        return this.deleteUser(parameters);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * List all cameras
   */
  async listCameras(parameters = {}) {
    try {
      // Use the correct UniFi Protect API endpoint
      const response = await this.makeRequest('GET', '/proxy/protect/integration/v1/cameras');
      
      // Handle both array and object responses from UniFi Protect API
      let camerasArray = [];
      
      if (response) {
        if (Array.isArray(response)) {
          camerasArray = response;
        } else if (response.data && Array.isArray(response.data)) {
          camerasArray = response.data;
        } else if (typeof response === 'object') {
          // Convert object to array if needed
          camerasArray = Object.values(response);
        }
      }
      
      if (camerasArray.length > 0) {
        // Transform cameras to include location data if available
        const cameras = camerasArray.map(camera => ({
          id: camera.id,
          name: camera.name,
          type: camera.type,
          model: camera.model,
          mac: camera.mac,
          host: camera.host,
          connectionHost: camera.connectionHost,
          isConnected: camera.isConnected,
          isRecording: camera.isRecording,
          isMotionDetected: camera.isMotionDetected,
          isLowBattery: camera.isLowBattery,
          isWireless: camera.isWireless,
          isUpdating: camera.isUpdating,
          isRebooting: camera.isRebooting,
          isAdopting: camera.isAdopting,
          isAdopted: camera.isAdopted,
          isAdoptedByOther: camera.isAdoptedByOther,
          isProvisioned: camera.isProvisioned,
          // Location data (if available)
          hasLocation: camera.location && camera.location.latitude && camera.location.longitude,
          location: camera.location || null,
          // Additional metadata
          firmwareVersion: camera.firmwareVersion,
          hardwareRevision: camera.hardwareRevision,
          uptime: camera.uptime,
          lastSeen: camera.lastSeen,
          lastMotion: camera.lastMotion,
          lastRecording: camera.lastRecording,
          // Map-specific properties
          lat: camera.location?.latitude || null,
          lon: camera.location?.longitude || null,
          x: camera.location?.x || null,
          y: camera.location?.y || null
        }));

        return {
          success: true,
          cameras: cameras,
          total: cameras.length
        };
      } else {
        return {
          success: true,
          cameras: [],
          total: 0
        };
      }
    } catch (error) {
      this.logger.error('Error listing cameras:', error.message);
      return {
        success: false,
        cameras: [],
        total: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Get camera details
   */
  async getCamera(parameters) {
    const { cameraId } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required');
    }
    
    try {
      const response = await this.makeRequest('GET', `/proxy/protect/integration/v1/cameras/${cameraId}`);
      
      if (response) {
        // Transform camera data to include location and map-specific properties
        const camera = {
          id: response.id,
          name: response.name,
          type: response.type,
          model: response.model,
          mac: response.mac,
          host: response.host,
          connectionHost: response.connectionHost,
          isConnected: response.isConnected,
          isRecording: response.isRecording,
          isMotionDetected: response.isMotionDetected,
          isLowBattery: response.isLowBattery,
          isWireless: response.isWireless,
          isUpdating: response.isUpdating,
          isRebooting: response.isRebooting,
          isAdopting: response.isAdopting,
          isAdopted: response.isAdopted,
          isAdoptedByOther: response.isAdoptedByOther,
          isProvisioned: response.isProvisioned,
          // Location data (if available)
          hasLocation: response.location && response.location.latitude && response.location.longitude,
          location: response.location || null,
          // Additional metadata
          firmwareVersion: response.firmwareVersion,
          hardwareRevision: response.hardwareRevision,
          uptime: response.uptime,
          lastSeen: response.lastSeen,
          lastMotion: response.lastMotion,
          lastRecording: response.lastRecording,
          // Map-specific properties
          lat: response.location?.latitude || null,
          lon: response.location?.longitude || null,
          x: response.location?.x || null,
          y: response.location?.y || null
        };

        return {
          success: true,
          camera: camera
        };
      } else {
        return {
          success: false,
          camera: null,
          error: 'Camera not found'
        };
      }
    } catch (error) {
      this.logger.error(`Error getting camera ${cameraId}:`, error.message);
      return {
        success: false,
        camera: null,
        error: error.message
      };
    }
  }
  
  /**
   * Update camera settings
   */
  async updateCamera(parameters) {
    const { cameraId, settings } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required');
    }
    
    if (!settings || typeof settings !== 'object') {
      throw new Error('Settings object is required');
    }
    
    const response = await this.makeRequest('PATCH', `/proxy/protect/integration/v1/cameras/${cameraId}`, settings);
    return response;
  }
  
  /**
   * Get video stream URL for camera
   */
  async getStreamUrl(parameters) {
    const { cameraId, quality = 'high', format = 'rtsps' } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required for stream URL');
    }
    
    const camera = this.cameras.get(cameraId) || this.getCachedDevice('cameras', cameraId);
    if (!camera) {
      throw new Error(`Camera not found: ${cameraId}`);
    }
    
    try {
      if (format === 'rtsps') {
        return await this.getRtspsStreamUrl(camera, quality);
      } else {
        throw new Error(`Unsupported stream format: ${format}. Only 'rtsps' is supported.`);
      }
    } catch (error) {
      this.logger.error(`Failed to get stream URL for camera ${cameraId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get RTSPS stream URL using the new API
   */
  async getRtspsStreamUrl(camera, quality) {
    const qualityMap = {
      low: 'low',
      medium: 'medium', 
      high: 'high',
      package: 'package'
    };
    
    const streamQuality = qualityMap[quality] || 'high';
    
    try {
      // Request RTSPS stream using the new API endpoint
      const response = await this.makeRequest('POST', `/v1/cameras/${camera.id}/rtsps-stream`, {
        qualities: [streamQuality]
      });
      
      if (response && response[streamQuality]) {
        this.logger.debug(`Generated RTSPS URL for camera ${camera.id}: ${response[streamQuality]}`);
        return response[streamQuality];
      } else {
        throw new Error(`No RTSPS stream URL available for quality: ${streamQuality}`);
      }
    } catch (error) {
      this.logger.error(`Failed to get RTSPS stream for camera ${camera.id}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Subscribe to motion events
   */
  async subscribeToMotionEvents(parameters) {
    const { cameraId, sensitivity, area, siteId = this.siteId } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required');
    }
    
    // Create subscription key
    const subscriptionKey = `${siteId}:${cameraId}`;
    
    // Check if already subscribed
    if (this.eventSubscriptions.has(subscriptionKey)) {
      return { message: 'Already subscribed to motion events for this camera' };
    }
    
    // Store subscription
    this.eventSubscriptions.set(subscriptionKey, {
      cameraId,
      siteId,
      sensitivity,
      area,
      timestamp: new Date().toISOString()
    });
    
    // Emit subscription event
    this.emit('motion-subscription-created', {
      cameraId,
      siteId,
      sensitivity,
      area
    });
    
    return { message: 'Subscribed to motion events', subscriptionKey };
  }
  
  /**
   * Unsubscribe from motion events
   */
  async unsubscribeFromMotionEvents(parameters) {
    const { cameraId, siteId = this.siteId } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required');
    }
    
    const subscriptionKey = `${siteId}:${cameraId}`;
    
    if (!this.eventSubscriptions.has(subscriptionKey)) {
      return { message: 'Not subscribed to motion events for this camera' };
    }
    
    // Remove subscription
    this.eventSubscriptions.delete(subscriptionKey);
    
    // Emit unsubscription event
    this.emit('motion-subscription-removed', {
      cameraId,
      siteId
    });
    
    return { message: 'Unsubscribed from motion events' };
  }
  
  /**
   * List recordings
   */
  async listRecordings(parameters = {}) {
    const { cameraId, startTime, endTime, type } = parameters;
    
    let url = '/proxy/protect/v1/recordings';
    const queryParams = [];
    
    if (cameraId) {
      queryParams.push(`cameraId=${encodeURIComponent(cameraId)}`);
    }
    if (startTime) {
      queryParams.push(`startTime=${encodeURIComponent(startTime)}`);
    }
    if (endTime) {
      queryParams.push(`endTime=${encodeURIComponent(endTime)}`);
    }
    if (type) {
      queryParams.push(`type=${encodeURIComponent(type)}`);
    }
    
    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }
    
    const response = await this.makeRequest('GET', url);
    return response.data || [];
  }
  
  /**
   * Get recording details
   */
  async getRecording(parameters) {
    const { recordingId } = parameters;
    
    if (!recordingId) {
      throw new Error('Recording ID is required');
    }
    
    const response = await this.makeRequest('GET', `/proxy/protect/v1/recordings/${recordingId}`);
    return response.data;
  }
  
  /**
   * Download recording
   */
  async downloadRecording(parameters) {
    const { recordingId } = parameters;
    
    if (!recordingId) {
      throw new Error('Recording ID is required');
    }
    
    const response = await this.makeRequest('GET', `/proxy/protect/v1/recordings/${recordingId}/download`, null, {
      'Accept': 'video/mp4'
    });
    return response.data;
  }
  
  /**
   * Delete recording
   */
  async deleteRecording(parameters) {
    const { recordingId } = parameters;
    
    if (!recordingId) {
      throw new Error('Recording ID is required');
    }
    
    const response = await this.makeRequest('DELETE', `/proxy/protect/v1/recordings/${recordingId}`);
    
    // Emit recording deleted event
    this.emit('recording:deleted', {
      recordingId
    });
    
    return response.data;
  }
  
  /**
   * Get system information
   */
  async getSystemInfo(parameters) {
    const response = await this.makeRequest('GET', '/proxy/protect/v1/system');
    return response.data;
  }
  
  /**
   * List users
   */
  async listUsers(parameters = {}) {
    const response = await this.makeRequest('GET', '/proxy/protect/v1/users');
    return response.data || [];
  }
  
  /**
   * Get user details
   */
  async getUser(parameters) {
    const { userId } = parameters;
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const response = await this.makeRequest('GET', `/proxy/protect/v1/users/${userId}`);
    return response.data;
  }
  
  /**
   * Create user
   */
  async createUser(parameters) {
    const { userData } = parameters;
    
    if (!userData) {
      throw new Error('User data is required');
    }
    
    const response = await this.makeRequest('POST', '/proxy/protect/v1/users', userData);
    return response.data;
  }
  
  /**
   * Update user
   */
  async updateUser(parameters) {
    const { userId, userData } = parameters;
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    if (!userData) {
      throw new Error('User data is required');
    }
    
    const response = await this.makeRequest('PUT', `/proxy/protect/v1/users/${userId}`, userData);
    return response.data;
  }
  
  /**
   * Delete user
   */
  async deleteUser(parameters) {
    const { userId } = parameters;
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const response = await this.makeRequest('DELETE', `/proxy/protect/v1/users/${userId}`);
    return response.data;
  }
  
  /**
   * Load cameras for the current site
   */
  async loadCameras() {
    try {
      const camerasResponse = await this.makeRequest('GET', '/proxy/protect/integration/v1/cameras');
      if (camerasResponse && Array.isArray(camerasResponse)) {
        camerasResponse.forEach(camera => {
          this.cameras.set(camera.id, {
            ...camera,
            lastUpdated: Date.now()
          });
        });
        this.logger.info(`Loaded ${camerasResponse.length} cameras from API`);
      }
    } catch (error) {
      const errorMessage = error?.message || String(error);
      this.logger.warn('Could not load cameras:', errorMessage);
    }
  }
  
  /**
   * Make HTTP request to Unifi Protect API
   */
  async makeRequest(method, path, data = null, headers = {}) {
    await this.checkRateLimit();
    
    const { host, port, protocol, verifySSL } = this.config;
    
    // Build URL
    const baseUrl = `${protocol}://${host}:${port}`;
    const url = `${baseUrl}${path}`;
    
    // Set up request options
    const options = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: verifySSL
      }),
      timeout: 30000,
      validateStatus: (status) => status < 500 // Accept 4xx errors for debugging
    };
    
    // Use session authentication if available, otherwise use API key
    if (this.sessionToken && this.cookies && this.csrfToken) {
      // Session-based authentication
      options.headers['Authorization'] = `Bearer ${this.sessionToken}`;
      options.headers['X-CSRF-Token'] = this.csrfToken;
      options.headers['Cookie'] = this.cookies;
      this.logger.debug('Using session-based authentication');
    } else if (this.apiKey) {
      // API key authentication
      options.headers['X-API-KEY'] = this.apiKey;
      this.logger.debug('Using API key authentication');
    } else {
      throw new Error('No authentication method available - neither session token nor API key found');
    }
    
    // Add request body if provided
    if (data) {
      options.data = data;
    }
    
    try {
      this.logger.debug(`Making ${method} request to: ${url}`);
      this.logger.debug(`Headers:`, { 
        'Authorization': options.headers['Authorization'] ? 'Bearer [session]' : 'None',
        'X-API-KEY': options.headers['X-API-KEY'] ? `${this.apiKey?.substring(0, 8)}...` : 'None',
        'X-CSRF-Token': options.headers['X-CSRF-Token'] ? 'Present' : 'None',
        'Cookie': options.headers['Cookie'] ? 'Present' : 'None',
        'Content-Type': options.headers['Content-Type'],
        'Accept': options.headers['Accept']
      });
      
      const response = await axios(options);
      
      this.logger.debug(`Response status: ${response.status}`);
      
      // Log response structure for debugging
      if (response.data && typeof response.data === 'object') {
        const keys = Object.keys(response.data);
        this.logger.debug(`Response keys: ${keys.join(', ')}`);
      }
      
      return response.data;
      
    } catch (error) {
      // Handle specific error cases
      if (error.response) {
        const { status, statusText, data } = error.response;
        
        this.logger.error(`API request failed: ${status} ${statusText}`);
        this.logger.debug(`Response data:`, data);
        
        // Handle authentication errors
        if (status === 401) {
          this.logger.error('Authentication failed - check credentials');
          this.logger.error(`URL attempted: ${url}`);
          throw new Error(`Authentication failed (401): ${statusText} - Check credentials`);
        }
        
        // Handle 2FA required
        if (status === 499 && data && data.code === 'MFA_AUTH_REQUIRED') {
          this.logger.error('2FA authentication required');
          this.logger.error(`URL attempted: ${url}`);
          throw new Error('2FA authentication required - use session-based authentication');
        }
        
        // Handle not found errors
        if (status === 404) {
          this.logger.error('Endpoint not found - check if UniFi Protect is installed');
          this.logger.error(`URL attempted: ${url}`);
          throw new Error(`Endpoint not found (404): ${statusText} - UniFi Protect may not be installed`);
        }
        
        // Handle rate limiting
        if (status === 429) {
          this.logger.warn('Rate limit exceeded, retrying...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          return this.makeRequest(method, path, data, headers);
        }
        
        throw new Error(`API request failed: ${status} ${statusText}`);
      }
      
      // Handle network errors
      if (error.code === 'ECONNREFUSED') {
        this.logger.error('Connection refused - check if UniFi Protect is running');
        this.logger.error(`Host: ${host}:${port}`);
        throw new Error('Connection refused - UniFi Protect may not be running');
      }
      
      if (error.code === 'ENOTFOUND') {
        this.logger.error('Host not found - check UniFi Protect host configuration');
        this.logger.error(`Host: ${host}`);
        throw new Error('Host not found - check UniFi Protect host configuration');
      }
      
      if (error.code === 'ECONNRESET') {
        this.logger.error('Connection reset - check network connectivity');
        throw new Error('Connection reset - check network connectivity');
      }
      
      this.logger.error('Request failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Check and enforce rate limiting
   */
  async checkRateLimit() {
    const now = Date.now();
    
    // Reset window if expired
    if (now - this.rateLimiter.windowStart > this.rateLimiter.windowMs) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.windowStart = now;
    }
    
    // Check if limit exceeded
    if (this.rateLimiter.requests >= this.rateLimiter.maxRequests) {
      const waitTime = this.rateLimiter.windowMs - (now - this.rateLimiter.windowStart);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reset after waiting
      this.rateLimiter.requests = 0;
      this.rateLimiter.windowStart = Date.now();
    }
    
    this.rateLimiter.requests++;
  }
  
  /**
   * Get capability definitions
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'camera:management',
        name: 'Camera Management',
        description: 'Manage camera devices and their settings',
        category: 'camera',
        operations: ['list', 'get', 'update'],
        dataTypes: ['application/json'],
        events: [],
        parameters: {
          cameraId: { type: 'string', required: false },
          siteId: { type: 'string', required: false }
        },
        requiresConnection: true
      },
      {
        id: 'camera:video:stream',
        name: 'Video Stream',
        description: 'Stream video from camera with RTSP and HTTP support',
        category: 'camera',
        operations: ['read', 'start', 'stop'],
        dataTypes: ['video/rtsp', 'video/mp4', 'video/h264'],
        events: ['stream-started', 'stream-stopped', 'stream-error'],
        parameters: {
          cameraId: { type: 'string', required: true },
          quality: { type: 'string', enum: ['low', 'medium', 'high'] },
          format: { type: 'string', enum: ['rtsp', 'http'] },
          duration: { type: 'number', min: 1, max: 3600 }
        },
        requiresConnection: true
      },
      {
        id: 'camera:snapshot',
        name: 'Camera Snapshot',
        description: 'Get still image from camera',
        category: 'camera',
        operations: ['read'],
        dataTypes: ['image/jpeg', 'image/png'],
        events: [],
        parameters: {
          cameraId: { type: 'string', required: true },
          quality: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        requiresConnection: true
      },
      {
        id: 'camera:event:motion',
        name: 'Motion Detection Events',
        description: 'Subscribe to motion detection events',
        category: 'camera',
        operations: ['subscribe', 'unsubscribe'],
        dataTypes: ['application/json'],
        events: ['motion-detected', 'motion-ended'],
        parameters: {
          cameraId: { type: 'string', required: true },
          sensitivity: { type: 'number', min: 0, max: 100 }
        },
        requiresConnection: true
      },
      {
        id: 'camera:event:smart',
        name: 'Smart Detection Events',
        description: 'Subscribe to smart detection events (person, vehicle, etc.)',
        category: 'camera',
        operations: ['subscribe', 'unsubscribe'],
        dataTypes: ['application/json'],
        events: ['smart-detected', 'smart-ended'],
        parameters: {
          cameraId: { type: 'string', required: true },
          types: { type: 'array', items: { type: 'string', enum: ['person', 'vehicle', 'animal'] } }
        },
        requiresConnection: true
      },
      {
        id: 'camera:event:ring',
        name: 'Doorbell Ring Events',
        description: 'Subscribe to doorbell ring events',
        category: 'camera',
        operations: ['subscribe', 'unsubscribe'],
        dataTypes: ['application/json'],
        events: ['ring-detected'],
        parameters: {
          cameraId: { type: 'string', required: true }
        },
        requiresConnection: true
      },
      {
        id: 'camera:recording:management',
        name: 'Recording Management',
        description: 'Manage camera recordings',
        category: 'camera',
        operations: ['list', 'get', 'download', 'delete'],
        dataTypes: ['video/mp4', 'application/json'],
        events: ['recording-started', 'recording-stopped'],
        parameters: {
          cameraId: { type: 'string', required: false },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          type: { type: 'string', enum: ['motion', 'continuous', 'timelapse'] }
        },
        requiresConnection: true
      },
      {
        id: 'system:info',
        name: 'System Information',
        description: 'Get system status, version, and configuration',
        category: 'system',
        operations: ['read'],
        dataTypes: ['application/json'],
        events: [],
        parameters: {},
        requiresConnection: true
      },
      {
        id: 'system:users',
        name: 'User Management',
        description: 'Manage system users and permissions',
        category: 'system',
        operations: ['list', 'get', 'create', 'update', 'delete'],
        dataTypes: ['application/json'],
        events: ['user-added', 'user-updated', 'user-deleted'],
        parameters: {
          userId: { type: 'string', required: false },
          userData: { type: 'object', required: false }
        },
        requiresConnection: true
      },
      {
        id: 'realtime:events',
        name: 'Real-time Events',
        description: 'Subscribe to all real-time events from UniFi Protect',
        category: 'events',
        operations: ['subscribe', 'unsubscribe'],
        dataTypes: ['application/json'],
        events: ['motion', 'smart', 'ring', 'recording', 'connection', 'nvr', 'sensor'],
        parameters: {
          eventTypes: { type: 'array', items: { type: 'string' } },
          deviceIds: { type: 'array', items: { type: 'string' } }
        },
        requiresConnection: true
      },
      {
        id: 'camera:snapshot',
        name: 'Camera Snapshot',
        description: 'Get a snapshot from a camera',
        category: 'camera',
        operations: ['get'],
        dataTypes: ['image'],
        events: ['snapshot:captured'],
        requiresConnection: true
      },
      {
        id: 'camera:recording',
        name: 'Camera Recording',
        description: 'Manage camera recordings',
        category: 'camera',
        operations: ['start', 'stop', 'get'],
        dataTypes: ['video'],
        events: ['recording:started', 'recording:stopped'],
        requiresConnection: true
      },
      {
        id: 'camera:status',
        name: 'Camera Status',
        description: 'Get camera status and information',
        category: 'camera',
        operations: ['get'],
        dataTypes: ['status'],
        events: ['status:changed'],
        requiresConnection: true
      }
    ];
  }
  
  /**
   * Validate configuration
   */
  static validateConfig(config) {
    BaseConnector.validateConfig(config);
    
    const { host, apiKey } = config.config || {};
    
    if (!host) {
      throw new Error('Host is required for Unifi Protect connector');
    }
    
    if (!apiKey) {
      throw new Error('API key is required for Unifi Protect connector');
    }
    
    return true;
  }
  
  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      type: 'unifi-protect',
      version: '1.0.0',
      description: 'Unifi Protect video management system connector',
      author: 'Looking Glass Platform',
      capabilities: [
        'camera:management',
        'camera:video:stream',
        'camera:event:motion',
        'camera:recording:management',
        'system:info',
        'system:users'
      ]
    };
  }

  /**
   * Connect to UniFi Protect WebSocket for real-time events
   * Only start REST API polling if WebSocket is not available
   */
  async connectWebSocket() {
    if (this.wsConnected) {
      return;
    }

    try {
      const wsUrl = await this.getWebSocketUrl();
      
      if (!wsUrl) {
        this.logger.info('WebSocket not available - real-time events disabled, falling back to REST API polling');
        this.wsConnected = false;
        this.startEventPolling(); // Only start polling if WebSocket is not available
        return;
      }
      
      // Set up headers with API key authentication
      // Include additional headers for proper WebSocket handshake
      const headers = {
        'X-API-KEY': this.apiKey,
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': Buffer.from(Math.random().toString()).toString('base64')
      };
      
      this.logger.debug(`Attempting WebSocket connection to: ${wsUrl}`);
      this.logger.debug('Using headers:', headers);
      
      this.ws = new WebSocket(wsUrl, {
        headers,
        rejectUnauthorized: false,
        followRedirects: true,
        handshakeTimeout: 10000
      });
      
      this.setupWebSocketHandlers();
    } catch (error) {
      this.logger.error('Error connecting to WebSocket:', error.message);
      this.wsConnected = false;
      this.startEventPolling(); // Only start polling if WebSocket fails
    }
  }

  /**
   * Set up WebSocket event handlers
   * Enhanced to handle HTTP to WebSocket protocol switching
   */
  setupWebSocketHandlers() {
    this.ws.on('open', () => {
      this.logger.info('WebSocket connected to UniFi Protect successfully');
      this.logger.debug('WebSocket connection established - protocol switching completed');
      this.wsConnected = true;
      this.wsReconnectAttempts = 0;
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Subscribe to events
      this.subscribeToWebSocketEvents();
      
      this.emit('websocket:connected', { connectorId: this.id });
    });

    this.ws.on('message', (data) => {
      try {
        this.handleWebSocketMessage(data);
      } catch (error) {
        const errorMessage = error?.message || String(error);
        this.logger.error('Error handling WebSocket message:', errorMessage);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.logger.warn(`WebSocket disconnected: ${code} - ${reason}`);
      this.wsConnected = false;
      this.stopHeartbeat();
      
      // Handle specific error codes
      if (code === 4001) {
        this.logger.warn('Access key invalid - check API key configuration');
      } else if (code === 1000) {
        this.logger.info('WebSocket closed normally');
      } else if (code === 101) {
        this.logger.info('HTTP 101 Switching Protocols - this is expected during handshake');
      } else if (code === 302) {
        this.logger.info('HTTP 302 Redirect - this is expected for WebSocket endpoints');
      } else {
        this.logger.warn(`WebSocket closed with unexpected code: ${code}`);
      }
      
      this.emit('websocket:disconnected', { 
        connectorId: this.id, 
        code, 
        reason 
      });
      
      // Attempt to reconnect
      this.scheduleWebSocketReconnect();
    });

    this.ws.on('error', (error) => {
      const errorMessage = error?.message || String(error);
      this.logger.error('WebSocket error:', errorMessage);
      
      // Log additional error details for debugging
      if (error.code) {
        this.logger.debug(`WebSocket error code: ${error.code}`);
      }
      if (error.errno) {
        this.logger.debug(`WebSocket error number: ${error.errno}`);
      }
      
      this.emit('websocket:error', { 
        connectorId: this.id, 
        error: errorMessage
      });
    });

    // Add upgrade event handler for protocol switching
    this.ws.on('upgrade', (response) => {
      this.logger.debug('WebSocket upgrade response received');
      this.logger.debug(`Upgrade status: ${response.statusCode} ${response.statusMessage}`);
    });
  }

  /**
   * Wait for WebSocket connection with timeout
   */
  waitForWebSocketConnection() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 3000);

      if (this.wsConnected) {
        clearTimeout(timeout);
        resolve();
      } else {
        this.ws.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        this.ws.once('close', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        this.ws.once('error', () => {
          clearTimeout(timeout);
          resolve();
        });
      }
    });
  }

  /**
   * Handle WebSocket message
   */
  handleWebSocketMessage(data) {
    try {
      let message;
      
      // Check if this is binary data (UniFi Protect protocol)
      if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
        this.logger.debug(`Received binary WebSocket message (${data.length} bytes)`);
        message = this.decodeBinaryMessage(data);
        
        if (!message) {
          // Only log if it's a substantial message (not just noise)
          if (data.length > 16) {
            this.logger.debug('Failed to decode binary message - first 32 bytes:', Buffer.from(data).toString('hex').substring(0, 64));
          }
          return;
        }
        
        // Log successful binary message parsing
        this.logger.info(`Successfully parsed binary message: ${message.action || message.type || 'unknown'} - ${JSON.stringify(message).substring(0, 200)}...`);
      } else {
        // Handle text messages
        const dataString = data.toString();
        
        // Skip empty or whitespace-only messages
        if (!dataString.trim()) {
          return;
        }
        
        // Skip heartbeat messages to reduce log noise
        if (dataString.includes('"service":"babelfish"')) {
          this.logger.debug('Received heartbeat message');
          return;
        }
        
        // Try to parse as JSON
        try {
          message = JSON.parse(dataString);
          this.logger.info(`Successfully parsed JSON message: ${message.action || message.type || 'unknown'} - ${JSON.stringify(message).substring(0, 200)}...`);
        } catch (error) {
          // Only log JSON parse errors for actual text data that looks like it should be JSON
          // Skip binary data that was converted to string or other non-JSON text
          if (dataString.length < 1000 && 
              !dataString.includes('\x00') && 
              !dataString.includes('\\x') &&
              (dataString.startsWith('{') || dataString.startsWith('['))) {
            this.logger.debug('Failed to parse message as JSON:', dataString.substring(0, 100));
          }
          return;
        }
      }
      
      // Enhanced message handling with automatic type detection and field discovery
      if (message) {
        const result = this.handleMessageByStructure(message);
        if (!result.handled) {
          // Only log if the message is not a known event and has content
          this.logger.info(`Unhandled WebSocket message: ${JSON.stringify(message).substring(0, 200)}...`);
        }
      }
    } catch (error) {
      const errorMessage = error?.message || String(error);
      this.logger.error('Error handling WebSocket message:', errorMessage);
    }
  }

  /**
   * Handle message by detecting its structure and mapping to appropriate handlers
   */
  handleMessageByStructure(message) {
    // Handle traditional action-based messages
    if (message.action) {
      return this.handleActionBasedMessage(message);
    }
    
    // Handle UniFi Protect event-style messages (item + type structure)
    if (message.item && message.type) {
      return this.handleUnifiProtectEventMessage(message);
    }
    
    // Handle direct event messages
    if (message.modelKey && message.id) {
      return this.handleDirectEventMessage(message);
    }
    
    // Handle heartbeat responses
    if (message.pong || message.ping) {
      this.logger.debug('Heartbeat response received');
      return { handled: true, type: 'heartbeat' };
    }
    
    return { handled: false, reason: 'unknown_structure' };
  }

  /**
   * Handle traditional action-based messages
   */
  handleActionBasedMessage(message) {
    switch (message.action) {
      case 'update':
        this.handleWebSocketUpdate(message);
        return { handled: true, type: 'update' };
      case 'add':
        this.handleWebSocketAdd(message);
        return { handled: true, type: 'add' };
      case 'remove':
        this.handleWebSocketRemove(message);
        return { handled: true, type: 'remove' };
      case 'pong':
        this.logger.debug('Heartbeat response received');
        return { handled: true, type: 'heartbeat' };
      default:
        this.logger.info(`Unknown message action: ${message.action} - ${JSON.stringify(message).substring(0, 200)}...`);
        return { handled: false, reason: 'unknown_action' };
    }
  }

  /**
   * Handle UniFi Protect event-style messages (item + type structure)
   */
  handleUnifiProtectEventMessage(message) {
    const { item, type } = message;
    
    // Discover and track new event types and fields
    this.discoverNewEventTypes(item);
    this.discoverNewFields(item);
    
    // Map UniFi Protect event types to internal event types
    const eventTypeMapping = {
      'smartDetectZone': 'smartDetectZone',
      'smartDetectLine': 'smartDetectLine', 
      'smartDetectLoiterZone': 'smartDetectLoiterZone',
      'smartAudioDetect': 'smartAudioDetect',
      'motion': 'motion',
      'ring': 'ring',
      'recording': 'recording',
      'connection': 'connection'
    };
    
    const mappedEventType = eventTypeMapping[item.type] || item.type;
    
    // Create standardized event structure with all original fields preserved
    const event = {
      connectorId: this.id,
      type: mappedEventType,
      modelKey: item.modelKey || 'event',
      deviceId: item.device,
      eventId: item.id,
      timestamp: new Date().toISOString(),
      data: {
        ...item, // Preserve ALL original fields
        originalType: item.type,
        mappedType: mappedEventType,
        start: item.start ? new Date(item.start).toISOString() : undefined,
        end: item.end ? new Date(item.end).toISOString() : undefined
      },
      source: 'unifi-protect-websocket',
      metadata: {
        messageType: 'unifi-protect-event',
        originalMessage: message,
        discoveredFields: this.getDiscoveredFields(item),
        capabilities: this.extractCapabilities(item)
      }
    };

    this.logger.info(`UniFi Protect ${mappedEventType} event: ${item.device} (${item.type})`);
    
    // Queue event for processing
    this.queueEvent(event);
    
    // Emit the event locally
    this.emit('event', event);
    this.emit(`event:${mappedEventType}`, event);
    this.emit(`connector:${this.id}:event`, event);
    
    // Publish to EventBus if available
    if (this.eventBus) {
      this.eventBus.publishEvent(event).catch(error => {
        this.logger.error('Failed to publish event to EventBus:', error);
      });
    }
    
    // Handle specific event types
    this.handleSpecificEventType(event, item);
    
    return { handled: true, type: mappedEventType };
  }

  /**
   * Handle direct event messages (modelKey + id structure)
   */
  handleDirectEventMessage(message) {
    const event = {
      connectorId: this.id,
      type: 'update',
      modelKey: message.modelKey,
      deviceId: message.id,
      eventId: message.newUpdateId,
      timestamp: new Date().toISOString(),
      data: message.data || message,
      source: 'unifi-protect-websocket'
    };

    this.logger.info(`UniFi ${message.modelKey} update: ${message.id}`);
    
    // Queue event for processing
    this.queueEvent(event);
    
    // Emit the event
    this.emit('event', event);
    this.emit(`event:${message.modelKey}`, event);
    this.emit(`connector:${this.id}:event`, event);
    
    // Handle specific modelKey events
    switch (message.modelKey) {
      case 'camera':
        this.handleCameraUpdate(event);
        break;
      case 'event':
        this.handleEventUpdate(event);
        break;
      case 'nvr':
        this.handleNvrUpdate(event);
        break;
      case 'sensor':
        this.handleSensorUpdate(event);
        break;
      default:
        this.logger.debug(`Unhandled modelKey update: ${message.modelKey}`);
    }
    
    return { handled: true, type: 'direct_update' };
  }

  /**
   * Discover and track new event types
   */
  discoverNewEventTypes(item) {
    if (!this.discoveredEventTypes) {
      this.discoveredEventTypes = new Set();
    }
    
    if (!this.discoveredEventTypes.has(item.type)) {
      this.discoveredEventTypes.add(item.type);
      this.logger.warn(`🆕 NEW EVENT TYPE DISCOVERED: ${item.type}`);
      
      // Emit discovery event for downstream systems
      this.emit('eventType:discovered', {
        eventType: item.type,
        timestamp: new Date().toISOString(),
        sampleData: item
      });
    }
  }

  /**
   * Discover and track new fields in events
   */
  discoverNewFields(item) {
    if (!this.discoveredFields) {
      this.discoveredFields = new Map();
    }
    
    const eventType = item.type;
    if (!this.discoveredFields.has(eventType)) {
      this.discoveredFields.set(eventType, new Set());
    }
    
    const knownFields = this.discoveredFields.get(eventType);
    const newFields = [];
    
    for (const [key, value] of Object.entries(item)) {
      if (!knownFields.has(key)) {
        knownFields.add(key);
        newFields.push({ field: key, value, type: typeof value });
      }
    }
    
    if (newFields.length > 0) {
      this.logger.warn(`🆕 NEW FIELDS DISCOVERED for ${eventType}: ${newFields.map(f => f.field).join(', ')}`);
      
      // Emit field discovery event for downstream systems
      this.emit('fields:discovered', {
        eventType,
        newFields,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get discovered fields for an event type
   */
  getDiscoveredFields(item) {
    if (!this.discoveredFields || !this.discoveredFields.has(item.type)) {
      return [];
    }
    return Array.from(this.discoveredFields.get(item.type));
  }

  /**
   * Extract capabilities from event data
   */
  extractCapabilities(item) {
    const capabilities = [];
    
    // Smart detection capabilities
    if (item.smartDetectTypes && Array.isArray(item.smartDetectTypes)) {
      capabilities.push(...item.smartDetectTypes.map(type => `smartDetect:${type}`));
    }
    
    // Audio detection capabilities
    if (item.type === 'smartAudioDetect') {
      capabilities.push('audioDetection');
    }
    
    // Motion detection capabilities
    if (item.type === 'motion') {
      capabilities.push('motionDetection');
    }
    
    // Line crossing capabilities
    if (item.type === 'smartDetectLine') {
      capabilities.push('lineCrossing');
    }
    
    // Zone detection capabilities
    if (item.type === 'smartDetectZone') {
      capabilities.push('zoneDetection');
    }
    
    // License plate detection
    if (item.smartDetectTypes && item.smartDetectTypes.includes('license')) {
      capabilities.push('licensePlateDetection');
    }
    
    return capabilities;
  }

  /**
   * Handle specific event types with specialized logic
   */
  handleSpecificEventType(event, item) {
    switch (item.type) {
      case 'smartDetectZone':
        this.handleSmartDetectionEvent(event, item);
        break;
      case 'smartDetectLine':
        this.handleSmartDetectionEvent(event, item);
        break;
      case 'smartDetectLoiterZone':
        this.handleLoiteringDetectionEvent(event, item);
        break;
      case 'smartAudioDetect':
        this.handleSmartAudioDetectionEvent(event, item);
        break;
      case 'motion':
        this.handleMotionDetectionEvent(event, item);
        break;
      case 'ring':
        this.handleRingEvent(event, item);
        break;
      case 'recording':
        this.handleRecordingEvent(event, item);
        break;
      case 'connection':
        this.handleConnectionEvent(event, item);
        break;
      default:
        // Generic handler for unknown event types
        this.handleGenericEvent(event, item);
    }
  }

  /**
   * Handle smart detection events (zone and line)
   */
  handleSmartDetectionEvent(event, item) {
    const smartContext = {
      objectType: item.smartDetectTypes?.[0] || 'unknown',
      confidence: item.score || 0.5,
      zone: item.zone,
      location: item.location,
      trackingId: item.trackingId,
      boundingBox: item.boundingBox,
      attributes: {
        detectionTypes: item.smartDetectTypes || [],
        zoneType: event.type, // 'smartDetectZone' or 'smartDetectLine'
        ...item.attributes
      },
      timestamp: event.timestamp
    };

    // Emit smart detection event with context
    this.emit('smart:detected', {
      cameraId: event.deviceId,
      smartContext,
      event: event.data
    });

    this.logger.info(`Smart detection (${smartContext.objectType}) on camera ${event.deviceId} with ${(smartContext.confidence * 100).toFixed(1)}% confidence`);
  }

  /**
   * Handle smart audio detection events
   */
  handleSmartAudioDetectionEvent(event, item) {
    const detectionTypes = item.smartDetectTypes || [];
    const confidence = item.score || 50.0;
    
    this.logger.info(`Smart audio detection (${detectionTypes.join(', ') || 'unknown'}) on camera ${item.device} with ${confidence}% confidence`);
    
    // Emit specialized event
    this.emit('smartAudioDetect', {
      cameraId: item.device,
      detectionTypes,
      confidence,
      timestamp: event.timestamp,
      eventId: item.id
    });
  }

  /**
   * Handle loitering detection events
   */
  handleLoiteringDetectionEvent(event, item) {
    const detectionTypes = item.smartDetectTypes || [];
    const confidence = item.score || 50.0;
    const duration = item.end && item.start ? item.end - item.start : 0;
    
    this.logger.info(`Loitering detection (${detectionTypes.join(', ') || 'unknown'}) on camera ${item.device} with ${confidence}% confidence for ${duration}ms`);
    
    // Create event data
    const eventData = {
      type: 'smartDetectLoiterZone',
      cameraId: item.device,
      detectionTypes,
      confidence,
      duration,
      timestamp: event.timestamp,
      eventId: item.id,
      start: item.start,
      end: item.end,
      device: item.device
    };
    
    // Emit local event
    this.emit('loiteringDetect', eventData);
    
    // Publish to EventBus if available
    if (this.eventBus) {
      this.eventBus.publishEvent('smartDetectLoiterZone', eventData);
    }
    
    // Emit specialized event
    this.emit('smartDetectLoiterZone', eventData);
  }

  /**
   * Handle motion detection events
   */
  handleMotionDetectionEvent(event, item) {
    const motionData = {
      timestamp: item.start ? new Date(item.start).toISOString() : event.timestamp,
      cameraId: event.deviceId,
      duration: item.start && item.end ? item.end - item.start : undefined,
      zone: item.zone
    };

    this.emit('motion:detected', {
      cameraId: event.deviceId,
      motionData,
      event: event.data
    });

    this.logger.info(`Motion detected on camera: ${event.deviceId}`);
  }

  /**
   * Handle ring events
   */
  handleRingEvent(event, item) {
    const ringData = {
      timestamp: item.start ? new Date(item.start).toISOString() : event.timestamp,
      cameraId: event.deviceId
    };

    this.emit('ring:detected', {
      cameraId: event.deviceId,
      ringData,
      event: event.data
    });

    this.logger.info(`Doorbell ring on camera: ${event.deviceId}`);
  }

  /**
   * Handle recording events
   */
  handleRecordingEvent(event, item) {
    this.emit('recording:event', {
      cameraId: event.deviceId,
      event: event.data
    });

    this.logger.debug(`Recording event on camera: ${event.deviceId}`);
  }

  /**
   * Handle connection events
   */
  handleConnectionEvent(event, item) {
    this.emit('connection:event', {
      cameraId: event.deviceId,
      event: event.data
    });

    this.logger.debug(`Connection event on camera: ${event.deviceId}`);
  }

  /**
   * Generic handler for unknown event types
   */
  handleGenericEvent(event, item) {
    this.logger.info(`Generic event handler for unknown type: ${event.type}`);
    
    // Emit generic event for downstream processing
    this.emit('event:generic', {
      eventType: event.type,
      cameraId: event.deviceId,
      data: event.data,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle WebSocket update messages with enhanced state management
   */
  handleWebSocketUpdate(message) {
    const deviceId = message.id;
    const modelKey = message.modelKey;
    const eventId = message.newUpdateId;
    
    // Check for duplicate events
    if (this.isDuplicateEvent(deviceId, eventId)) {
      this.logger.debug(`Skipping duplicate event for ${deviceId}: ${eventId}`);
      return;
    }
    
    // Update device state
    const updatedState = this.updateDeviceState(deviceId, message.data);
    
    const event = {
      connectorId: this.id,
      type: 'update',
      modelKey: modelKey,
      deviceId: deviceId,
      eventId: eventId,
      timestamp: new Date().toISOString(),
      data: message.data,
      state: updatedState,
      source: 'unifi-protect-websocket'
    };

    this.logger.info(`UniFi ${modelKey} update: ${deviceId}`);
    
    // Queue event for processing
    this.queueEvent(event);
    
    // Emit the event
    this.emit('event', event);
    this.emit(`event:${modelKey}`, event);
    this.emit(`connector:${this.id}:event`, event);
    
    // Handle specific modelKey events
    switch (modelKey) {
      case 'camera':
        this.handleCameraUpdate(event);
        break;
      case 'event':
        this.handleEventUpdate(event);
        break;
      case 'nvr':
        this.handleNvrUpdate(event);
        break;
      case 'sensor':
        this.handleSensorUpdate(event);
        break;
      default:
        this.logger.debug(`Unhandled modelKey update: ${modelKey}`);
    }
  }
  
  /**
   * Handle camera-specific updates
   */
  handleCameraUpdate(event) {
    const cameraData = event.data;
    
    // Check for motion events
    if (cameraData.lastMotion) {
      const motionEvent = {
        ...event,
        type: 'motion',
        motionData: {
          timestamp: cameraData.lastMotion,
          cameraId: event.deviceId,
          cameraName: cameraData.name
        }
      };
      
      this.emit('event:motion', motionEvent);
      this.logger.info(`Motion detected on camera: ${cameraData.name || event.deviceId}`);
    }
    
    // Check for doorbell rings
    if (cameraData.lastRing) {
      const ringEvent = {
        ...event,
        type: 'ring',
        ringData: {
          timestamp: cameraData.lastRing,
          cameraId: event.deviceId,
          cameraName: cameraData.name
        }
      };
      
      this.emit('event:ring', ringEvent);
      this.logger.info(`Doorbell ring on camera: ${cameraData.name || event.deviceId}`);
    }
    
    // Check for smart detection events
    if (cameraData.lastSmartDetectZone) {
      const smartEvent = {
        ...event,
        type: 'smart',
        smartData: {
          timestamp: cameraData.lastSmartDetectZone,
          cameraId: event.deviceId,
          cameraName: cameraData.name
        }
      };
      
      this.emit('event:smart', smartEvent);
      this.logger.info(`Smart detection on camera: ${cameraData.name || event.deviceId}`);
    }
  }
  
  /**
   * Handle event updates (Protect events list)
   */
  handleEventUpdate(event) {
    this.emit('event:protect', event);
    this.logger.debug(`Protect event update: ${event.eventId}`);
  }
  
  /**
   * Handle NVR updates
   */
  handleNvrUpdate(event) {
    this.emit('event:nvr', event);
    this.logger.debug(`NVR update: ${event.deviceId}`);
  }
  
  /**
   * Handle sensor updates
   */
  handleSensorUpdate(event) {
    this.emit('event:sensor', event);
    this.logger.debug(`Sensor update: ${event.deviceId}`);
  }

  /**
   * Handle WebSocket add messages
   */
  handleWebSocketAdd(message) {
    const event = {
      connectorId: this.id,
      type: 'add',
      resourceType: message.newUpdateId,
      timestamp: new Date().toISOString(),
      data: message.data || message,
      source: 'unifi-protect-websocket'
    };

    this.logger.info(`UniFi resource added: ${event.resourceType}`);
    
    // Handle camera additions
    if (event.resourceType === 'camera' && event.data) {
      this.handleCameraAdded(event.data);
    }
    
    this.emit('resource:added', event);
  }

  /**
   * Handle WebSocket remove messages
   */
  handleWebSocketRemove(message) {
    const event = {
      connectorId: this.id,
      type: 'remove',
      resourceType: message.newUpdateId,
      timestamp: new Date().toISOString(),
      data: message.data || message,
      source: 'unifi-protect-websocket'
    };

    this.logger.info(`UniFi resource removed: ${event.resourceType}`);
    
    // Handle camera removals
    if (event.resourceType === 'camera' && event.data) {
      this.handleCameraRemoved(event.data);
    }
    
    this.emit('resource:removed', event);
  }
  
  /**
   * Process WebSocket event and update entities
   */
  async processWebSocketEvent(event) {
    try {
      // Handle different event types
      switch (event.type) {
        case 'motion':
          await this.handleMotionEvent(event);
          break;
        case 'smart':
          await this.handleSmartEvent(event);
          break;
        case 'smartDetectLine':
          await this.handleSmartDetectLineEvent(event);
          break;
        case 'smartDetectZone':
          await this.handleSmartDetectZoneEvent(event);
          break;
        case 'recording':
          await this.handleRecordingEvent(event);
          break;
        case 'connection':
          await this.handleConnectionEvent(event);
          break;
        default:
          this.logger.debug(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error('Error processing WebSocket event:', error);
    }
  }
  
  /**
   * Handle motion detection events
   */
  async handleMotionEvent(event) {
    const cameraId = event.data?.cameraId || event.data?.id;
    if (!cameraId) {
      this.logger.warn('Motion event missing camera ID');
      return;
    }
    
    // Find corresponding entity
    const entityId = `camera-${cameraId}`;
    const entity = this.entityManager?.getEntity(entityId);
    
    if (entity) {
      // Update entity with motion event data
      await this.entityManager.updateEntity(entityId, {
        status: event.data?.state || entity.status,
        data: {
          ...entity.data,
          lastMotionEvent: {
            timestamp: event.timestamp,
            state: event.data?.state,
            score: event.data?.score,
            zone: event.data?.zone
          }
        }
      });
      
      this.logger.info(`Motion event processed for camera: ${cameraId}`);
    }
    
    // Emit motion event
    this.emit('motion:detected', {
      cameraId,
      entityId,
      event: event.data,
      timestamp: event.timestamp
    });
  }
  
  /**
   * Handle smart detection events
   */
  async handleSmartEvent(event) {
    const cameraId = event.data?.cameraId || event.data?.id;
    if (!cameraId) {
      this.logger.warn('Smart event missing camera ID');
      return;
    }
    
    // Find corresponding entity
    const entityId = `camera-${cameraId}`;
    const entity = this.entityManager?.getEntity(entityId);
    
    if (entity) {
      // Update entity with smart event data
      await this.entityManager.updateEntity(entityId, {
        data: {
          ...entity.data,
          lastSmartEvent: {
            timestamp: event.timestamp,
            type: event.data?.type,
            score: event.data?.score,
            object: event.data?.object
          }
        }
      });
      
      this.logger.info(`Smart event processed for camera: ${cameraId}`);
    }
    
    // Emit smart event
    this.emit('smart:detected', {
      cameraId,
      entityId,
      event: event.data,
      timestamp: event.timestamp
    });
  }
  
  /**
   * Handle smart detection line crossing events
   */
  async handleSmartDetectLineEvent(event) {
    const cameraId = event.data?.cameraId || event.data?.id;
    if (!cameraId) {
      this.logger.warn('Smart detect line event missing camera ID');
      return;
    }
    
    // Find corresponding entity
    const entityId = `camera-${cameraId}`;
    const entity = this.entityManager?.getEntity(entityId);
    
    if (entity) {
      // Update entity with smart detect line event data
      await this.entityManager.updateEntity(entityId, {
        data: {
          ...entity.data,
          lastSmartDetectLineEvent: {
            timestamp: event.timestamp,
            type: event.data?.type,
            score: event.data?.score,
            object: event.data?.object,
            direction: event.data?.direction
          }
        }
      });
      
      this.logger.info(`Smart detect line event processed for camera: ${cameraId}`);
    }
    
    // Emit smart detect line event
    this.emit('smartDetectLine', {
      cameraId,
      entityId,
      event: event.data,
      timestamp: event.timestamp
    });
  }
  
  /**
   * Handle smart detection zone events
   */
  async handleSmartDetectZoneEvent(event) {
    const cameraId = event.data?.cameraId || event.data?.id;
    if (!cameraId) {
      this.logger.warn('Smart detect zone event missing camera ID');
      return;
    }
    
    // Find corresponding entity
    const entityId = `camera-${cameraId}`;
    const entity = this.entityManager?.getEntity(entityId);
    
    if (entity) {
      // Update entity with smart detect zone event data
      await this.entityManager.updateEntity(entityId, {
        data: {
          ...entity.data,
          lastSmartDetectZoneEvent: {
            timestamp: event.timestamp,
            type: event.data?.type,
            score: event.data?.score,
            object: event.data?.object,
            zone: event.data?.zone
          }
        }
      });
      
      this.logger.info(`Smart detect zone event processed for camera: ${cameraId}`);
    }
    
    // Emit smart detect zone event
    this.emit('smartDetectZone', {
      cameraId,
      entityId,
      event: event.data,
      timestamp: event.timestamp
    });
  }
  
  /**
   * Handle recording events
   */
  async handleRecordingEvent(event) {
    const cameraId = event.data?.cameraId || event.data?.id;
    if (!cameraId) {
      this.logger.warn('Recording event missing camera ID');
      return;
    }
    
    // Find corresponding entity
    const entityId = `camera-${cameraId}`;
    const entity = this.entityManager?.getEntity(entityId);
    
    if (entity) {
      // Update entity with recording event data
      await this.entityManager.updateEntity(entityId, {
        data: {
          ...entity.data,
          lastRecordingEvent: {
            timestamp: event.timestamp,
            type: event.data?.type,
            status: event.data?.status,
            duration: event.data?.duration
          }
        }
      });
      
      this.logger.info(`Recording event processed for camera: ${cameraId}`);
    }
    
    // Emit recording event
    this.emit('recording:event', {
      cameraId,
      entityId,
      event: event.data,
      timestamp: event.timestamp
    });
  }
  
  /**
   * Handle connection events
   */
  async handleConnectionEvent(event) {
    const cameraId = event.data?.cameraId || event.data?.id;
    if (!cameraId) {
      this.logger.warn('Connection event missing camera ID');
      return;
    }
    
    // Find corresponding entity
    const entityId = `camera-${cameraId}`;
    const entity = this.entityManager?.getEntity(entityId);
    
    if (entity) {
      // Update entity with connection event data
      await this.entityManager.updateEntity(entityId, {
        status: event.data?.state || entity.status,
        data: {
          ...entity.data,
          lastConnectionEvent: {
            timestamp: event.timestamp,
            state: event.data?.state,
            ip: event.data?.ip,
            mac: event.data?.mac
          }
        }
      });
      
      this.logger.info(`Connection event processed for camera: ${cameraId}`);
    }
    
    // Emit connection event
    this.emit('connection:event', {
      cameraId,
      entityId,
      event: event.data,
      timestamp: event.timestamp
    });
  }
  
  /**
   * Handle camera addition
   */
  async handleCameraAdded(cameraData) {
    try {
      this.logger.info(`Camera added: ${cameraData.name} (${cameraData.id})`);
      
      // Add to local cache
      this.cameras.set(cameraData.id, {
        ...cameraData,
        lastUpdated: Date.now()
      });
      
      // Create entity if auto-discovery is enabled
      if (this.autoDiscovery.createEntities && this.entityManager) {
        const entity = await this.entityManager.createCameraEntity(cameraData, this.id);
        this.discoveredEntities.add(entity.id);
        
        // Subscribe to events if enabled
        if (this.autoDiscovery.subscribeToEvents) {
          await this.subscribeToCameraEvents(cameraData.id, entity.id);
        }
      }
      
      this.emit('camera:added', {
        cameraId: cameraData.id,
        cameraData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.logger.error('Error handling camera addition:', error);
    }
  }
  
  /**
   * Handle camera removal
   */
  async handleCameraRemoved(cameraData) {
    try {
      this.logger.info(`Camera removed: ${cameraData.name} (${cameraData.id})`);
      
      // Remove from local cache
      this.cameras.delete(cameraData.id);
      
      // Remove entity if auto-discovery is enabled
      if (this.autoDiscovery.createEntities && this.entityManager) {
        const entityId = `camera-${cameraData.id}`;
        if (this.discoveredEntities.has(entityId)) {
          await this.entityManager.deleteEntity(entityId);
          this.discoveredEntities.delete(entityId);
          this.entitySubscriptions.delete(entityId);
        }
      }
      
      this.emit('camera:removed', {
        cameraId: cameraData.id,
        cameraData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.logger.error('Error handling camera removal:', error);
    }
  }

  /**
   * Start WebSocket heartbeat
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.wsConnected && this.ws && this.ws.readyState === 1) {
        try {
          this.ws.send(JSON.stringify({ action: 'ping' }));
          this.logger.debug('Heartbeat sent');
        } catch (error) {
          const errorMessage = error && typeof error === 'object' && error.message ? error.message : String(error);
          this.logger.error('Error sending heartbeat:', errorMessage);
          
          // If heartbeat fails, the connection might be broken
          this.logger.warn('Heartbeat failed - connection may be broken, triggering reconnect');
          this.ws.close();
        }
      } else {
        this.logger.debug('Skipping heartbeat - WebSocket not connected');
      }
    }, this.heartbeatInterval);
  }

  /**
   * Stop WebSocket heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule WebSocket reconnection with exponential backoff
   */
  scheduleWebSocketReconnect() {
    if (this.wsReconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max WebSocket reconnection attempts reached');
      return;
    }
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.wsReconnectAttempts),
      this.maxReconnectDelay
    );
    
    this.logger.info(`Scheduling WebSocket reconnection in ${delay}ms (attempt ${this.wsReconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      this.wsReconnectAttempts++;
      try {
        await this.connectWebSocket();
      } catch (error) {
        this.logger.error('WebSocket reconnection failed:', error.message);
        this.scheduleWebSocketReconnect();
      }
    }, delay);
  }
  
  /**
   * Process event queue to handle events in order
   */
  async processEventQueue() {
    if (this.processingEvents || this.eventQueue.length === 0) {
      return;
    }
    
    this.processingEvents = true;
    
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      try {
        await this.processWebSocketEvent(event);
      } catch (error) {
        this.logger.error('Error processing event from queue:', error.message);
      }
    }
    
    this.processingEvents = false;
  }
  
  /**
   * Add event to processing queue
   */
  queueEvent(event) {
    this.eventQueue.push(event);
    this.processEventQueue();
  }

  /**
   * Get WebSocket connection status
   */
  getWebSocketStatus() {
    return {
      connected: this.wsConnected,
      reconnectAttempts: this.wsReconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      heartbeatActive: !!this.heartbeatTimer
    };
  }

  /**
   * Get WebSocket URL for real-time updates
   * Based on community findings: use port 80, http protocol, and "integration" path
   */
  async getWebSocketUrl() {
    // According to community findings, the correct endpoint is:
    // http://unifi/proxy/protect/integration/v1/subscribe/events (port 80, not 443)
    // Use "integration" (not "integrations") in the path
    const endpoints = [
      `/proxy/protect/integration/v1/subscribe/events`,  // Primary endpoint (correct path)
      `/proxy/protect/integration/v1/subscribe/devices`, // Alternative endpoint
      `/proxy/protect/v1/subscribe/events`,             // Fallback (old path)
      `/proxy/protect/v1/subscribe/devices`,            // Fallback (old path)
      `/proxy/protect/ws/protect`                       // Legacy endpoint
    ];

    for (const endpoint of endpoints) {
      try {
        // Force HTTP protocol and port 80 for WebSocket connections
        // This is based on community findings that WebSocket only works on port 80
        const url = `ws://${this.config.host}:80${endpoint}`;
        this.logger.debug(`Trying WebSocket endpoint: ${url}`);
        
        const isAvailable = await this.testWebSocketEndpoint(url);
        if (isAvailable) {
          this.logger.info(`Found working WebSocket endpoint: ${endpoint}`);
          return url;
        }
      } catch (error) {
        const errorMessage = error && typeof error === 'object' && error.message ? error.message : String(error);
        this.logger.debug(`WebSocket endpoint ${endpoint} failed: ${errorMessage}`);
      }
    }

    this.logger.warn('No working WebSocket endpoints found');
    return null;
  }

  /**
   * Test if WebSocket endpoint is available
   * Updated to handle HTTP to WebSocket protocol switching
   */
  async testWebSocketEndpoint(url) {
    return new Promise((resolve) => {
      // Set up headers with API key authentication and WebSocket handshake
      const headers = {
        'X-API-KEY': this.apiKey,
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': Buffer.from(Math.random().toString()).toString('base64')
      };
      
      const ws = new WebSocket(url, {
        headers,
        rejectUnauthorized: false, // Disable SSL verification for self-signed certs
        followRedirects: true,     // Follow HTTP redirects during handshake
        handshakeTimeout: 5000     // 5 second timeout for testing
      });

      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.logger.debug(`WebSocket test failed for ${url}: ${error.message}`);
        resolve(false);
      });

      ws.on('close', (code, reason) => {
        clearTimeout(timeout);
        // Accept 101 Switching Protocols as success
        if (code === 101) {
          resolve(true);
        } else {
          this.logger.debug(`WebSocket test closed with code ${code}: ${reason}`);
          resolve(false);
        }
      });
    });
  }

  /**
   * Subscribe to WebSocket events
   */
  subscribeToWebSocketEvents() {
    if (!this.wsConnected) {
      return;
    }

    try {
      // Wait a moment before subscribing to ensure connection is stable
      setTimeout(() => {
        if (this.wsConnected) {
          const subscriptions = [
            { action: 'subscribe', newUpdateId: 'motion' },
            { action: 'subscribe', newUpdateId: 'smartDetectZone' },
            { action: 'subscribe', newUpdateId: 'camera' },
            { action: 'subscribe', newUpdateId: 'system' }
          ];

          for (const subscription of subscriptions) {
            this.ws.send(JSON.stringify(subscription));
            this.logger.debug(`Subscribed to ${subscription.newUpdateId} events`);
          }
        }
      }, 1000);
    } catch (error) {
      const errorMessage = error && typeof error === 'object' && error.message ? error.message : String(error);
      this.logger.error('Error subscribing to WebSocket events:', errorMessage);
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsConnected = false;
    this.stopHeartbeat();
  }

  /**
   * Start REST API polling for events as fallback
   * Only called if WebSocket is not available or fails
   */
  startEventPolling() {
    if (this.wsConnected) {
      this.logger.info('WebSocket is connected, not starting REST API polling');
      return;
    }
    this.logger.info('Starting REST API event polling (WebSocket not available)');
    
    // Poll for events every 10 seconds (more frequent than before)
    this.eventPollingInterval = setInterval(async () => {
      try {
        await this.pollForEvents();
      } catch (error) {
        const errorMessage = error && typeof error === 'object' && error.message ? error.message : String(error);
        this.logger.error('Error polling for events:', errorMessage);
      }
    }, 10000); // 10 seconds
    
    // Initial poll
    this.pollForEvents();
  }

  /**
   * Poll for events via REST API
   * Note: Events endpoint is not available in current API version (404 error)
   * Real-time events are only available via WebSocket subscriptions
   */
  async pollForEvents() {
    // Events endpoint is not available in the current API version
    // Real-time events are only available via WebSocket subscriptions
    this.logger.debug('Events polling disabled - endpoint not available in current API version');
  }

  /**
   * Handle event from REST API
   */
  handleRestEvent(event) {
    const eventData = {
      connectorId: this.id,
      type: event.type || 'unknown',
      timestamp: event.startTime || new Date().toISOString(),
      data: event,
      source: 'unifi-protect-rest'
    };
    
    this.emit('connector:event', eventData);
    this.logger.debug(`REST API event received: ${event.type}`);
  }

  /**
   * Handle device event from Network API
   */
  handleDeviceEvent(device) {
    const eventData = {
      connectorId: this.id,
      type: 'device_status',
      timestamp: new Date().toISOString(),
      data: device,
      source: 'unifi-protect-rest'
    };
    
    this.emit('connector:event', eventData);
    this.logger.debug(`Device event received: ${device.name || device.id}`);
  }

  /**
   * Authenticate and get bootstrap data for UniFi Protect
   */
  async authenticateAndGetBootstrap() {
    try {
      this.logger.debug('Authenticating with UniFi and checking for Protect...');
      
      // Check if we have valid cached bootstrap data
      const cached = this.bootstrapCache.get('data');
      if (cached && Date.now() - cached.timestamp < this.bootstrapExpiry) {
        this.logger.info('Using cached bootstrap data');
        this.bootstrapData = cached.data;
        this.lastUpdateId = cached.data.lastUpdateId;
        return cached.data;
      }
      
      // Step 0: Try session-based authentication first (new method)
      try {
        this.logger.debug('Step 0: Trying session-based authentication...');
        const sessionResult = await this.authenticateWithSession();
        if (sessionResult) {
          this.logger.info('✅ Session-based authentication successful');
          this.cacheBootstrapData(sessionResult);
          return sessionResult;
        }
      } catch (sessionError) {
        const sessionErrorMessage = sessionError?.message || String(sessionError);
        this.logger.debug('Session-based authentication failed:', sessionErrorMessage);
      }
      
      // Step 1: Check if session token is provided in config (for UDM Pro)
      if (this.config.sessionToken) {
        this.logger.debug('Step 1: Using provided session token for UDM Pro...');
        this.sessionToken = this.config.sessionToken;
        this.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        this.udmPro = true;
        
        // Try to get the bootstrap JSON with the session token
        try {
          const bootstrapResponse = await this.makeRequest('GET', '/proxy/protect/integrations/v1/bootstrap', null, {
            'Authorization': `Bearer ${this.sessionToken}`
          });
          
          if (bootstrapResponse && bootstrapResponse.accessKey) {
            this.logger.info('✅ Successfully obtained Protect bootstrap data with session token');
            this.cacheBootstrapData(bootstrapResponse);
            return bootstrapResponse;
          } else {
            this.logger.warn('Bootstrap response missing accessKey with session token');
          }
        } catch (error) {
          this.logger.debug('Session token authentication failed:', error.message);
        }
      }
      
      // Step 2: Get Bootstrap JSON - this is the key step for UniFi Protect
      // According to the documentation, this should be the first step
      try {
        this.logger.debug('Step 2: Getting bootstrap JSON from UniFi Protect...');
        const bootstrapResponse = await this.makeRequest('GET', '/proxy/protect/api/bootstrap');
        
        if (bootstrapResponse && bootstrapResponse.accessKey) {
          this.logger.info('✅ UniFi Protect bootstrap successful');
          this.logger.debug('Bootstrap data contains:', {
            accessKey: bootstrapResponse.accessKey ? 'Present' : 'Missing',
            lastUpdateId: bootstrapResponse.lastUpdateId || 'None',
            cameras: bootstrapResponse.cameras?.length || 0,
            nvr: bootstrapResponse.nvr ? 'Present' : 'Missing'
          });
          
          this.cacheBootstrapData(bootstrapResponse);
          return bootstrapResponse;
        } else {
          this.logger.warn('Bootstrap response missing accessKey - Protect may not be available');
        }
      } catch (bootstrapError) {
        const bootstrapErrorMessage = bootstrapError?.message || String(bootstrapError);
        this.logger.debug('Bootstrap authentication failed:', bootstrapErrorMessage);
      }
      
      // Step 2b: Try Protect meta/info endpoint as alternative
      try {
        this.logger.debug('Step 2b: Trying Protect meta/info endpoint...');
        const metaResponse = await this.makeRequest('GET', '/proxy/protect/v1/meta/info');
        
        if (metaResponse && metaResponse.version) {
          this.logger.info('✅ UniFi Protect meta/info successful');
          this.logger.debug('Meta info contains:', {
            version: metaResponse.version,
            server: metaResponse.server,
            apiVersion: metaResponse.apiVersion
          });
          
          // Create a minimal bootstrap from meta info
          const metaBootstrap = {
            accessKey: this.config.apiKey,
            lastUpdateId: null,
            cameras: [],
            nvr: metaResponse,
            protectAvailable: true,
            networkOnly: false,
            udmPro: true,
            metaInfo: metaResponse
          };
          
          this.cacheBootstrapData(metaBootstrap);
          return metaBootstrap;
        } else {
          this.logger.warn('Meta info response missing version - Protect may not be available');
        }
      } catch (metaError) {
        const metaErrorMessage = metaError?.message || String(metaError);
        this.logger.debug('Meta info authentication failed:', metaErrorMessage);
      }
      
      // Step 2c: Try Protect subscribe/devices endpoint as alternative
      try {
        this.logger.debug('Step 2c: Trying Protect subscribe/devices endpoint...');
        const subscribeResponse = await this.makeRequest('GET', '/proxy/protect/v1/subscribe/devices');
        
        if (subscribeResponse && Array.isArray(subscribeResponse)) {
          this.logger.info('✅ UniFi Protect subscribe/devices successful');
          this.logger.debug('Subscribe devices contains:', {
            deviceCount: subscribeResponse.length,
            devices: subscribeResponse.map(d => ({ id: d.id, type: d.type, name: d.name }))
          });
          
          // Create a minimal bootstrap from subscribe devices
          const subscribeBootstrap = {
            accessKey: this.config.apiKey,
            lastUpdateId: null,
            cameras: subscribeResponse.filter(d => d.type === 'camera'),
            nvr: null,
            protectAvailable: true,
            networkOnly: false,
            udmPro: true,
            subscribeDevices: subscribeResponse
          };
          
          this.cacheBootstrapData(subscribeBootstrap);
          return subscribeBootstrap;
        } else {
          this.logger.warn('Subscribe devices response not an array - Protect may not be available');
        }
      } catch (subscribeError) {
        const subscribeErrorMessage = subscribeError?.message || String(subscribeError);
        this.logger.debug('Subscribe devices authentication failed:', subscribeErrorMessage);
      }
      
      // Step 3: Try UDM Pro specific authentication (session-based)
      try {
        this.logger.debug('Step 3: Trying UDM Pro session-based authentication...');
        
        // First, try to get a session token
        const loginResponse = await this.makeRequest('POST', '/api/auth/login', {
          username: this.config.username,
          password: this.config.password,
          remember: true
        });
        
        if (loginResponse && loginResponse.data && loginResponse.data.mfaCookie) {
          this.logger.info('UDM Pro detected - 2FA authentication required');
          this.logger.warn('2FA authentication is required for UDM Pro Protect access');
          this.logger.warn('Please complete 2FA authentication manually in the web interface');
          this.logger.warn('Then use session-based authentication for Protect API access');
          
          // Store the MFA cookie for potential future use
          this.mfaCookie = loginResponse.data.mfaCookie;
          
          // For now, we'll fall back to Network API only
          this.logger.info('Falling back to Network API only due to 2FA requirement');
        } else if (loginResponse && loginResponse.token) {
          this.logger.info('Successfully logged in to UDM Pro');
          this.sessionToken = loginResponse.token;
          this.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
          
          // Extract cookies from response headers if available
          if (loginResponse.headers && loginResponse.headers['set-cookie']) {
            this.cookies = loginResponse.headers['set-cookie'];
          }
          
          // Now try to get the bootstrap JSON with the session token
          const bootstrapResponse = await this.makeRequest('GET', '/proxy/protect/api/bootstrap', null, {
            'Authorization': `Bearer ${this.sessionToken}`
          });
          
          if (bootstrapResponse && bootstrapResponse.accessKey) {
            this.logger.info('Successfully obtained bootstrap data via UDM Pro session');
            this.cacheBootstrapData(bootstrapResponse);
            return bootstrapResponse;
          } else {
            this.logger.warn('Bootstrap response missing accessKey after UDM Pro login');
          }
        } else {
          this.logger.debug('UDM Pro login failed');
        }
      } catch (error) {
        const errorMessage = error?.message || String(error);
        this.logger.debug('UDM Pro session authentication failed:', errorMessage);
      }
      
      // Step 4: If Protect fails, try Network API
      try {
        this.logger.debug('Step 4: Trying Network API...');
        const networkTest = await this.makeRequest('GET', '/proxy/network/integration/v1/sites');
        
        if (networkTest && networkTest.data) {
          this.logger.info('✅ Network API accessible - UniFi Network Controller detected');
          
          // Create a minimal bootstrap for Network API only
          const networkBootstrap = {
            accessKey: this.config.apiKey,
            lastUpdateId: null,
            cameras: [],
            nvr: null,
            sites: networkTest.data,
            protectAvailable: false,
            networkOnly: true,
            udmPro: true,
            requires2FA: this.mfaCookie ? true : false
          };
          
          this.cacheBootstrapData(networkBootstrap);
          return networkBootstrap;
        }
      } catch (networkError) {
        this.logger.debug('Network API test failed:', networkError.message);
      }
      
      this.logger.error('All authentication methods failed');
      return null;
    } catch (error) {
      this.logger.error('Authentication failed:', error.message);
      return null;
    }
  }

  /**
   * Decode binary WebSocket message according to UniFi Protect protocol
   * Based on https://github.com/hjdhjd/unifi-protect
   */
  decodeBinaryMessage(data) {
    try {
      // Convert Buffer to Uint8Array for easier manipulation
      const buffer = Buffer.isBuffer(data) ? new Uint8Array(data) : new Uint8Array(data);
      
      this.logger.debug(`Decoding binary message of length: ${buffer.length}`);
      
      if (buffer.length < 8) {
        this.logger.debug('Message too short to be valid');
        return null;
      }
      
      // Try to parse as simple JSON first (some messages are just JSON)
      try {
        const jsonString = new TextDecoder().decode(buffer);
        const jsonMessage = JSON.parse(jsonString);
        this.logger.debug('Message was simple JSON format');
        return jsonMessage;
      } catch (error) {
        // Not JSON, continue with binary protocol parsing
      }
      
      // Parse first header frame (8 bytes)
      const header1 = this.parseHeaderFrame(buffer, 0);
      if (!header1) {
        this.logger.debug('Failed to parse first header frame');
        return null;
      }
      
      this.logger.debug(`Header 1: type=${header1.packetType}, format=${header1.payloadFormat}, size=${header1.payloadSize}`);
      
      // Parse action frame
      const actionFrameStart = 8;
      const actionFrameEnd = actionFrameStart + header1.payloadSize;
      
      if (buffer.length < actionFrameEnd) {
        this.logger.debug('Message too short for action frame');
        return null;
      }
      
      const actionFrame = this.parseActionFrame(buffer, actionFrameStart, header1.payloadSize);
      if (!actionFrame) {
        this.logger.debug('Failed to parse action frame');
        return null;
      }
      
      // Check if there's a second header frame
      if (buffer.length < actionFrameEnd + 8) {
        // Single frame message
        this.logger.debug('Single frame message detected');
        const result = {
          action: actionFrame.action,
          id: actionFrame.id,
          modelKey: actionFrame.modelKey,
          newUpdateId: actionFrame.newUpdateId,
          data: actionFrame.data || actionFrame
        };
        this.logger.debug(`Single frame message parsed: ${result.action} - ${result.modelKey || 'unknown'}`);
        return result;
      }
      
      // Parse second header frame
      const header2 = this.parseHeaderFrame(buffer, actionFrameEnd);
      if (!header2) {
        this.logger.debug('Failed to parse second header frame');
        return null;
      }
      
      this.logger.debug(`Header 2: type=${header2.packetType}, format=${header2.payloadFormat}, size=${header2.payloadSize}`);
      
      // Parse data frame
      const dataFrameStart = actionFrameEnd + 8;
      const dataFrame = this.parseDataFrame(buffer, dataFrameStart, header2);
      if (!dataFrame) {
        this.logger.debug('Failed to parse data frame');
        return null;
      }
      
      const result = {
        action: actionFrame.action,
        id: actionFrame.id,
        modelKey: actionFrame.modelKey,
        newUpdateId: actionFrame.newUpdateId,
        data: dataFrame
      };
      
      this.logger.debug(`Multi-frame message parsed: ${result.action} - ${result.modelKey || 'unknown'} - data size: ${JSON.stringify(dataFrame).length}`);
      return result;
      
    } catch (error) {
      this.logger.error('Error decoding binary message:', error.message);
      return null;
    }
  }
  
  /**
   * Parse header frame (8 bytes)
   */
  parseHeaderFrame(buffer, offset) {
    if (buffer.length < offset + 8) return null;
    
    const packetType = buffer[offset];
    const payloadFormat = buffer[offset + 1];
    const deflated = buffer[offset + 2];
    const unknown = buffer[offset + 3];
    
    // Payload size (4 bytes, big endian)
    const payloadSize = (buffer[offset + 4] << 24) | 
                       (buffer[offset + 5] << 16) | 
                       (buffer[offset + 6] << 8) | 
                       buffer[offset + 7];
    
    return {
      packetType,
      payloadFormat,
      deflated: deflated === 1,
      unknown,
      payloadSize
    };
  }
  
  /**
   * Parse action frame
   */
  parseActionFrame(buffer, offset, size) {
    try {
      const payload = buffer.slice(offset, offset + size);
      const jsonString = new TextDecoder().decode(payload);
      
      this.logger.debug(`Action frame JSON (${jsonString.length} chars): ${jsonString.substring(0, 200)}...`);
      
      const parsed = JSON.parse(jsonString);
      
      // Handle different action frame formats
      if (parsed.action) {
        this.logger.debug(`Action frame parsed: ${parsed.action} - ${parsed.modelKey || 'unknown'} - ${parsed.id || 'no-id'}`);
        return parsed;
      } else if (parsed.newUpdateId) {
        // Some messages only have newUpdateId
        const result = {
          action: 'update',
          newUpdateId: parsed.newUpdateId,
          ...parsed
        };
        this.logger.debug(`Action frame parsed (newUpdateId): update - ${parsed.newUpdateId}`);
        return result;
      } else if (parsed.modelKey) {
        // Some messages have modelKey but no action
        const result = {
          action: 'update',
          modelKey: parsed.modelKey,
          ...parsed
        };
        this.logger.debug(`Action frame parsed (modelKey): update - ${parsed.modelKey}`);
        return result;
      } else {
        // Generic message
        const result = {
          action: 'message',
          data: parsed
        };
        this.logger.debug(`Action frame parsed (generic): message - ${JSON.stringify(parsed).substring(0, 100)}...`);
        return result;
      }
    } catch (error) {
      this.logger.error('Error parsing action frame:', error.message);
      this.logger.debug('Raw action frame data:', buffer.slice(offset, offset + Math.min(size, 100)));
      return null;
    }
  }
  
  /**
   * Parse data frame
   */
  parseDataFrame(buffer, offset, header) {
    try {
      const payload = buffer.slice(offset, offset + header.payloadSize);
      
      // Handle compression
      let data = payload;
      if (header.deflated) {
        const zlib = require('zlib');
        data = zlib.inflateSync(payload);
      }
      
      // Parse based on payload format
      switch (header.payloadFormat) {
        case 1: // JSON
          const jsonString = new TextDecoder().decode(data);
          return JSON.parse(jsonString);
        case 2: // UTF8 string
          return new TextDecoder().decode(data);
        case 3: // Node Buffer
          return data;
        default:
          this.logger.warn(`Unknown payload format: ${header.payloadFormat}`);
          return null;
      }
    } catch (error) {
      this.logger.error('Error parsing data frame:', error.message);
      return null;
    }
  }

  /**
   * Cache bootstrap data and initialize device states
   */
  cacheBootstrapData(bootstrapData) {
    if (!bootstrapData) return;
    
    this.bootstrapData = bootstrapData;
    this.lastUpdateId = bootstrapData.lastUpdateId;
    this.bootstrapCache.set('data', {
      data: bootstrapData,
      timestamp: Date.now()
    });
    
    // Cache individual devices by modelKey and id
    const modelKeys = ['cameras', 'nvr', 'sensors', 'users', 'bridges', 'lights', 'liveviews', 'viewers'];
    
    modelKeys.forEach(key => {
      if (bootstrapData[key]) {
        const devices = Array.isArray(bootstrapData[key]) ? bootstrapData[key] : [bootstrapData[key]];
        devices.forEach(device => {
          const cacheKey = `${key}:${device.id}`;
          this.bootstrapCache.set(cacheKey, {
            data: device,
            timestamp: Date.now()
          });
          
          // Initialize device state
          this.deviceStates.set(device.id, {
            ...device,
            lastUpdate: Date.now(),
            lastEventId: null
          });
          
          // Cache cameras separately for easy access
          if (key === 'cameras') {
            this.cameras.set(device.id, {
              ...device,
              lastUpdated: Date.now()
            });
          }
        });
      }
    });
    
    this.logger.info(`Cached bootstrap data with ${this.bootstrapCache.size} entries`);
  }
  
  /**
   * Get cached device data
   */
  getCachedDevice(modelKey, deviceId) {
    const cacheKey = `${modelKey}:${deviceId}`;
    const cached = this.bootstrapCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.bootstrapExpiry) {
      return cached.data;
    }
    
    return null;
  }
  
  /**
   * Update device state from WebSocket event
   */
  updateDeviceState(deviceId, updateData) {
    const currentState = this.deviceStates.get(deviceId);
    if (!currentState) return;
    
    const updatedState = {
      ...currentState,
      ...updateData,
      lastUpdate: Date.now()
    };
    
    this.deviceStates.set(deviceId, updatedState);
    
    // Update camera cache if it's a camera
    if (this.cameras.has(deviceId)) {
      this.cameras.set(deviceId, {
        ...updatedState,
        lastUpdated: Date.now()
      });
    }
    
    return updatedState;
  }
  
  /**
   * Check if event is duplicate
   */
  isDuplicateEvent(deviceId, eventId) {
    const lastEventId = this.lastEventIds.get(deviceId);
    if (lastEventId === eventId) {
      return true;
    }
    
    this.lastEventIds.set(deviceId, eventId);
    return false;
  }

  /**
   * Start video stream session
   */
  async startVideoStream(parameters) {
    const { cameraId, quality = 'high', format = 'rtsp', duration = 30 } = parameters;
    
    const streamUrl = await this.getStreamUrl({ cameraId, quality, format, duration });
    
    const sessionId = `stream_${cameraId}_${Date.now()}`;
    const session = {
      id: sessionId,
      cameraId: cameraId,
      url: streamUrl,
      format: format,
      quality: quality,
      startTime: Date.now(),
      duration: duration,
      active: true
    };
    
    this.streamSessions.set(sessionId, session);
    
    // Auto-cleanup session after duration
    setTimeout(() => {
      this.stopVideoStream(sessionId);
    }, duration * 1000);
    
    this.logger.info(`Started video stream session ${sessionId} for camera ${cameraId}`);
    
    this.emit('stream:started', session);
    return session;
  }
  
  /**
   * Stop video stream session
   */
  stopVideoStream(sessionId) {
    const session = this.streamSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Stream session not found: ${sessionId}`);
      return;
    }
    
    session.active = false;
    session.endTime = Date.now();
    this.streamSessions.delete(sessionId);
    
    this.logger.info(`Stopped video stream session ${sessionId}`);
    this.emit('stream:stopped', session);
  }
  
  /**
   * Get active stream sessions
   */
  getActiveStreams() {
    return Array.from(this.streamSessions.values()).filter(session => session.active);
  }
  
  /**
   * Get camera snapshot
   */
  async getCameraSnapshot(parameters) {
    const { cameraId, highQuality = 'false' } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required for snapshot');
    }
    
    try {
      const response = await this.makeRequest('GET', `/proxy/protect/integration/v1/cameras/${cameraId}/snapshot?highQuality=${highQuality}`, null, {
        'Accept': 'image/jpeg'
      });
      
      if (response) {
        this.logger.debug(`Got snapshot for camera ${cameraId}`);
        return response;
      } else {
        throw new Error('No snapshot data in response');
      }
    } catch (error) {
      this.logger.error(`Failed to get snapshot for camera ${cameraId}:`, error.message);
      throw error;
    }
  }

  /**
   * Execute camera snapshot operations
   */
  async executeCameraSnapshot(operation, parameters) {
    switch (operation) {
      case 'read':
        return await this.getCameraSnapshot(parameters);
      default:
        throw new Error(`Unknown snapshot operation: ${operation}`);
    }
  }
  
  /**
   * Execute smart detection events
   */
  async executeSmartEvents(operation, parameters) {
    switch (operation) {
      case 'subscribe':
        return await this.subscribeToSmartEvents(parameters);
      case 'unsubscribe':
        return await this.unsubscribeFromSmartEvents(parameters);
      default:
        throw new Error(`Unknown smart events operation: ${operation}`);
    }
  }
  
  /**
   * Execute doorbell ring events
   */
  async executeRingEvents(operation, parameters) {
    switch (operation) {
      case 'subscribe':
        return await this.subscribeToRingEvents(parameters);
      case 'unsubscribe':
        return await this.unsubscribeFromRingEvents(parameters);
      default:
        throw new Error(`Unknown ring events operation: ${operation}`);
    }
  }
  
  /**
   * Execute real-time events
   */
  async executeRealtimeEvents(operation, parameters) {
    switch (operation) {
      case 'subscribe':
        return await this.subscribeToRealtimeEvents(parameters);
      case 'unsubscribe':
        return await this.unsubscribeFromRealtimeEvents(parameters);
      default:
        throw new Error(`Unknown realtime events operation: ${operation}`);
    }
  }
  
  /**
   * Subscribe to doorbell ring events
   */
  async subscribeToRingEvents(parameters) {
    const { cameraId } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required for ring events subscription');
    }
    
    const subscriptionId = `ring_${cameraId}`;
    this.eventSubscriptions.set(subscriptionId, {
      type: 'ring',
      cameraId,
      active: true,
      timestamp: Date.now()
    });
    
    this.logger.info(`Subscribed to ring events for camera ${cameraId}`);
    return { subscriptionId, status: 'subscribed' };
  }
  
  /**
   * Unsubscribe from doorbell ring events
   */
  async unsubscribeFromRingEvents(parameters) {
    const { cameraId } = parameters;
    const subscriptionId = `ring_${cameraId}`;
    
    if (this.eventSubscriptions.has(subscriptionId)) {
      this.eventSubscriptions.delete(subscriptionId);
      this.logger.info(`Unsubscribed from ring events for camera ${cameraId}`);
      return { subscriptionId, status: 'unsubscribed' };
    }
    
    throw new Error(`No ring events subscription found for camera ${cameraId}`);
  }
  
  /**
   * Subscribe to real-time events
   */
  async subscribeToRealtimeEvents(parameters) {
    const { eventTypes = ['motion', 'smart', 'ring', 'recording', 'connection'], deviceIds = [] } = parameters;
    
    const subscriptionId = `realtime_${Date.now()}`;
    this.eventSubscriptions.set(subscriptionId, {
      type: 'realtime',
      eventTypes,
      deviceIds,
      active: true,
      timestamp: Date.now()
    });
    
    this.logger.info(`Subscribed to real-time events: ${eventTypes.join(', ')}`);
    return { subscriptionId, status: 'subscribed' };
  }
  
  /**
   * Unsubscribe from real-time events
   */
  async unsubscribeFromRealtimeEvents(parameters) {
    const { subscriptionId } = parameters;
    
    if (this.eventSubscriptions.has(subscriptionId)) {
      this.eventSubscriptions.delete(subscriptionId);
      this.logger.info(`Unsubscribed from real-time events: ${subscriptionId}`);
      return { subscriptionId, status: 'unsubscribed' };
    }
    
    throw new Error(`No real-time events subscription found: ${subscriptionId}`);
  }

  /**
   * Handle 2FA authentication for UDM Pro
   * This method can be called after initial login to complete 2FA
   */
  async complete2FA(authenticatorId, code) {
    try {
      this.logger.debug('Completing 2FA authentication...');
      
      const response = await this.makeRequest('POST', '/api/auth/mfa', {
        authenticatorId: authenticatorId,
        code: code
      });
      
      if (response && response.token) {
        this.logger.info('✅ 2FA authentication successful');
        this.sessionToken = response.token;
        this.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        this.requires2FA = false;
        
        // Now try to get Protect bootstrap data
        const bootstrapResponse = await this.makeRequest('GET', '/proxy/protect/api/bootstrap', null, {
          'Authorization': `Bearer ${this.sessionToken}`
        });
        
        if (bootstrapResponse && bootstrapResponse.accessKey) {
          this.logger.info('Successfully obtained Protect bootstrap data after 2FA');
          this.cacheBootstrapData(bootstrapResponse);
          return bootstrapResponse;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error('2FA authentication failed:', error.message);
      return null;
    }
  }

  /**
   * Get available 2FA authenticators for UDM Pro
   */
  async get2FAAuthenticators() {
    try {
      const response = await this.makeRequest('POST', '/api/auth/login', {
        username: this.config.username,
        password: this.config.password,
        remember: true
      });
      
      if (response && response.data && response.data.authenticators) {
        return response.data.authenticators;
      }
      
      return [];
    } catch (error) {
      this.logger.error('Failed to get 2FA authenticators:', error.message);
      return [];
    }
  }

  /**
   * Session-based authentication using cookies and CSRF tokens
   * This method mimics the browser authentication flow
   */
  async authenticateWithSession() {
    try {
      this.logger.debug('Attempting session-based authentication...');
      
      const { host, port, protocol, username, password } = this.config;
      const baseUrl = `${protocol}://${host}:${port}`;
      
      // Step 1: Get CSRF token
      this.logger.debug('Step 1: Getting CSRF token...');
      const csrfResponse = await axios.get(`${baseUrl}/api/auth/csrf`, {
        httpsAgent: new https.Agent({ rejectUnauthorized: this.config.verifySSL }),
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      if (!csrfResponse.data || !csrfResponse.data.csrfToken) {
        throw new Error('Failed to get CSRF token');
      }
      
      const csrfToken = csrfResponse.data.csrfToken;
      this.logger.debug('CSRF token obtained');
      
      // Step 2: Login with username/password
      this.logger.debug('Step 2: Logging in with credentials...');
      const loginResponse = await axios.post(`${baseUrl}/api/auth/login`, {
        username: username,
        password: password,
        remember: true
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: this.config.verifySSL }),
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      if (!loginResponse.data || !loginResponse.data.token) {
        throw new Error('Login failed - no token received');
      }
      
      const sessionToken = loginResponse.data.token;
      this.logger.debug('Login successful, session token obtained');
      
      // Step 3: Extract cookies from response
      const cookies = loginResponse.headers['set-cookie'] || [];
      const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
      
      // Step 4: Test Protect API access with session
      this.logger.debug('Step 3: Testing Protect API access...');
      const protectTest = await axios.get(`${baseUrl}/proxy/protect/api/bootstrap`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-CSRF-Token': csrfToken,
          'Cookie': cookieHeader,
          'Accept': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: this.config.verifySSL }),
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      if (protectTest.data && protectTest.data.accessKey) {
        this.logger.info('✅ Session-based authentication successful for Protect API');
        
        // Store session data for future requests
        this.sessionToken = sessionToken;
        this.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        this.cookies = cookieHeader;
        this.csrfToken = csrfToken;
        
        return {
          ...protectTest.data,
          sessionToken,
          cookies: cookieHeader,
          csrfToken,
          protectAvailable: true,
          networkOnly: false,
          udmPro: true
        };
      } else {
        throw new Error('Protect API test failed - no accessKey in response');
      }
      
    } catch (error) {
      this.logger.debug('Session-based authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Execute snapshot capability
   */
  async executeSnapshotCapability(operation, parameters) {
    if (operation !== 'get') {
      throw new Error(`Unknown operation: ${operation}`);
    }

    const { cameraId, quality = 'high', timestamp } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required');
    }

    try {
      // Get camera snapshot from UniFi Protect API
      const snapshotUrl = await this.getCameraSnapshot(cameraId, quality);
      
      const result = {
        success: true,
        snapshotUrl,
        cameraId,
        quality,
        timestamp: timestamp || new Date().toISOString()
      };

      // Emit snapshot captured event
      this.emit('snapshot:captured', result);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get snapshot for camera ${cameraId}:`, error);
      throw error;
    }
  }

  /**
   * Get camera snapshot
   */
  async getCameraSnapshot(cameraId, quality = 'high') {
    try {
      // Use the existing makeRequest method to get snapshot
      const response = await this.makeRequest('GET', `/proxy/protect/integration/v1/cameras/${cameraId}/snapshot?highQuality=${quality === 'high' ? 'true' : 'false'}`, null, {
        'Accept': 'image/jpeg'
      });

      if (response) {
        this.logger.debug(`Got snapshot for camera ${cameraId}`);
        return response;
      } else {
        throw new Error('No snapshot data in response');
      }
    } catch (error) {
      this.logger.error(`Failed to get camera snapshot:`, error);
      throw new Error(`Failed to get camera snapshot: ${error.message}`);
    }
  }
}

module.exports = UnifiProtectConnector;