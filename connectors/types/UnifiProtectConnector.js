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
 */
class UnifiProtectConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // API client
    this.api = null;
    
    // Site information
    this.siteId = 'default';
    this.sites = [];
    
    // Camera cache
    this.cameras = new Map();
    this.cameraCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    
    // Event subscriptions
    this.eventSubscriptions = new Map();
    
    // WebSocket connection
    this.ws = null;
    this.wsConnected = false;
    this.wsReconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5 seconds
    this.heartbeatInterval = 30000; // 30 seconds
    this.heartbeatTimer = null;
    
    // Session management
    this.sessionToken = null;
    this.sessionExpiry = null;
    this.lastAuthAttempt = 0;
    this.authRetryDelay = 60000; // 1 minute
    
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
      
      // Test connection by getting sites data (which we know works)
      try {
        this.logger.debug(`Attempting to connect to UniFi at ${host}`);
        
        this.logger.debug('About to make sites request...');
        const sites = await this.makeRequest('GET', '/proxy/network/integration/v1/sites');
        this.logger.debug('Sites request completed successfully');
        
        this.logger.debug('Sites response type:', typeof sites);
        this.logger.debug('Sites response keys:', sites ? Object.keys(sites) : 'no response');
        
        // Safely extract response data without circular references
        const responseData = {
          status: sites?.status,
          statusText: sites?.statusText,
          data: sites?.data,
          dataType: typeof sites?.data,
          hasData: !!sites?.data,
          dataKeys: sites?.data ? Object.keys(sites.data) : 'no data'
        };
        this.logger.debug('Sites response data:', JSON.stringify(responseData, null, 2));
        
        try {
          // Handle different possible response structures
          if (sites.data && sites.data.data) {
            this.sites = sites.data.data;
            this.siteId = this.sites[0]?.id || 'default';
            this.logger.info(`Successfully connected to UniFi, found ${this.sites.length} sites`);
          } else if (sites.data && Array.isArray(sites.data)) {
            // Handle case where data is directly an array
            this.sites = sites.data;
            this.siteId = this.sites[0]?.id || 'default';
            this.logger.info(`Successfully connected to UniFi, found ${this.sites.length} sites`);
          } else if (Array.isArray(sites)) {
            // Handle case where response is directly an array
            this.sites = sites;
            this.siteId = this.sites[0]?.id || 'default';
            this.logger.info(`Successfully connected to UniFi, found ${this.sites.length} sites`);
          } else {
            this.logger.warn('No sites data found in response');
            this.logger.debug('Sites response structure:', {
              hasData: !!sites.data,
              dataType: typeof sites.data,
              responseType: typeof sites,
              responseKeys: sites ? Object.keys(sites) : 'no response',
              dataKeys: sites.data ? Object.keys(sites.data) : 'no data'
            });
            // Set a default site ID to continue
            this.siteId = 'default';
            this.sites = [];
          }
        } catch (parseError) {
          const parseErrorMessage = parseError?.message || String(parseError);
          this.logger.error('Error parsing sites response:', parseErrorMessage);
          // Set defaults and continue
          this.siteId = 'default';
          this.sites = [];
        }
        
        // Try to load cameras (may fail if Protect API not available)
        try {
          await this.loadCameras();
          this.logger.info('Successfully loaded cameras');
          
          // Perform initial camera discovery if enabled
          if (this.autoDiscovery.enabled) {
            await this.performCameraDiscovery();
          }
        } catch (error) {
          const errorMessage = error?.message || String(error);
          this.logger.error('Failed to load cameras:', errorMessage);
        }
        
        // Try to connect to WebSocket for real-time events
        try {
          await this.connectWebSocket();
          this.logger.info('Successfully connected to WebSocket');
        } catch (error) {
          const errorMessage = error?.message || String(error);
          this.logger.warn('Could not connect WebSocket (may not be available):', errorMessage);
        }
        
        // Always start REST API polling as backup (WebSocket may disconnect)
        this.startEventPolling();
        
        // Start auto-discovery if enabled
        if (this.autoDiscovery.enabled) {
          this.startAutoDiscovery();
        }
        
      } catch (error) {
        // Safely extract error information without circular references
        const errorInfo = {
          message: error?.message || String(error),
          name: error?.name,
          code: error?.code,
          status: error?.response?.status,
          statusText: error?.response?.statusText
        };
        
        this.logger.debug('Error info:', JSON.stringify(errorInfo, null, 2));
        this.logger.debug('Error type:', typeof error);
        this.logger.debug('Error constructor:', error?.constructor?.name);
        
        const errorMessage = errorInfo.message;
        
        // If we got a successful sites response but failed on cameras, this might be a partial success
        if (this.sites && this.sites.length > 0) {
          this.logger.warn(`Partial connection success - sites loaded but cameras failed: ${errorMessage}`);
          // Don't throw error, consider this a successful connection with limited functionality
          return;
        }
        
        this.logger.error('Connection failed:', errorMessage);
        throw new Error(`Failed to connect to Unifi Protect: ${errorMessage}`);
      }
    } catch (outerError) {
      const outerErrorMessage = outerError?.message || String(outerError);
      this.logger.error('Outer connection error:', outerErrorMessage);
      throw outerError;
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
    const { cameraId } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required');
    }
    
    // For now, this is handled through WebSocket events
    // In the future, we could implement specific smart detection subscriptions
    this.logger.debug(`Smart detection events will be handled via WebSocket for camera: ${cameraId}`);
    
    return {
      success: true,
      message: 'Smart detection events will be handled via WebSocket',
      cameraId
    };
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
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'camera:management':
        return this.executeCameraManagement(operation, parameters);
      
      case 'camera:video:stream':
        return this.executeVideoStream(operation, parameters);
      
      case 'camera:event:motion':
        return this.executeMotionEvents(operation, parameters);
      
      case 'camera:recording:management':
        return this.executeRecordingManagement(operation, parameters);
      
      case 'system:info':
        return this.executeSystemInfo(operation, parameters);
      
      case 'system:users':
        return this.executeUserManagement(operation, parameters);
      
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
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
        return this.getStreamUrl(parameters);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
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
   * List cameras
   */
  async listCameras(parameters = {}) {
    const { siteId = this.siteId } = parameters;
    
    // Use the correct Unifi Protect API endpoint
    const response = await this.makeRequest('GET', '/proxy/protect/v1/cameras');
    
    if (response.data && response.data.data) {
      return response.data.data;
    } else if (response.data && Array.isArray(response.data)) {
      return response.data;
    } else {
      return [];
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
    
    const response = await this.makeRequest('GET', `/proxy/protect/v1/cameras/${cameraId}`);
    return response.data;
  }
  
  /**
   * Update camera settings
   */
  async updateCamera(parameters) {
    const { cameraId, settings } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required');
    }
    
    if (!settings) {
      throw new Error('Camera settings are required');
    }
    
    const response = await this.makeRequest('PUT', `/proxy/protect/v1/cameras/${cameraId}`, settings);
    
    // Update local cache
    if (response.data) {
      this.cameras.set(cameraId, {
        ...response.data,
        lastUpdated: Date.now()
      });
    }
    
    return response.data;
  }
  
  /**
   * Get video stream URL
   */
  async getStreamUrl(parameters) {
    const { cameraId, quality = '1080p', type = 'live' } = parameters;
    
    if (!cameraId) {
      throw new Error('Camera ID is required');
    }
    
    // Use the correct Unifi Protect API endpoint for video streams
    const response = await this.makeRequest('GET', `/proxy/protect/v1/cameras/${cameraId}/stream?quality=${quality}&type=${type}`);
    
    if (response.data && response.data.url) {
      return {
        url: response.data.url,
        quality,
        type,
        cameraId
      };
    } else {
      throw new Error('No stream URL available');
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
      this.logger.debug(`Loading cameras for site: ${this.siteId}`);
      
      // Use the correct Unifi Protect API endpoint for cameras
      const response = await this.makeRequest('GET', '/proxy/protect/v1/cameras');
      
      this.logger.debug('Cameras response:', JSON.stringify(response.data, null, 2));
      
      // Update cache
      if (response.data && response.data.data) {
        response.data.data.forEach(camera => {
          this.cameras.set(camera.id, {
            ...camera,
            lastUpdated: Date.now()
          });
        });
        this.logger.info(`Loaded ${response.data.data.length} cameras`);
      } else if (response.data && Array.isArray(response.data)) {
        // Handle case where data is directly an array
        response.data.forEach(camera => {
          this.cameras.set(camera.id, {
            ...camera,
            lastUpdated: Date.now()
          });
        });
        this.logger.info(`Loaded ${response.data.length} cameras`);
      } else {
        this.logger.warn('No camera data found in response');
        this.logger.debug('Response structure:', {
          hasData: !!response.data,
          dataType: typeof response.data,
          dataKeys: response.data ? Object.keys(response.data) : 'no data'
        });
      }
      
      return response.data;
    } catch (error) {
      const errorMessage = error?.message || String(error);
      this.logger.error(`Failed to load cameras for site ${this.siteId}:`, errorMessage);
      
      // Log additional error details for debugging
      if (error?.response) {
        this.logger.error(`HTTP ${error.response.status} error:`, error.response.data);
      }
      
      throw error;
    }
  }
  
  /**
   * Make HTTP request to Unifi Protect API
   */
  async makeRequest(method, path, data = null, headers = {}) {
    try {
      // Check rate limiting
      await this.checkRateLimit();
      
      // Build the full URL
      const baseUrl = `${this.config.protocol}://${this.config.host}:${this.config.port}`;
      
      // Use the correct base path from documentation
      const apiBasePath = '/proxy/network/integration/v1';
      
      // Handle path construction - if path already includes the base, use it as is
      let fullPath;
      if (path.startsWith('/proxy/network/integration/v1')) {
        fullPath = path;
      } else if (path.startsWith('/proxy/')) {
        // If it's a different proxy path, use it as is
        fullPath = path;
      } else {
        // Otherwise, append to the base path
        fullPath = path.startsWith('/') ? `${apiBasePath}${path}` : `${apiBasePath}/${path}`;
      }
      
      const url = `${baseUrl}${fullPath}`;
      
      // Prepare request configuration
      const config = {
        method: method.toUpperCase(),
        url,
        timeout: this.config.timeout || 10000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-KEY': this.config.apiKey,
          ...headers
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: this.config.verifySSL !== false
        })
      };

      // Add data for POST/PUT/PATCH requests
      if (data && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
        config.data = data;
      }

      this.logger.debug(`Making ${method} request to: ${url}`);
      
      const response = await axios(config);
      
      this.logger.debug(`Response status: ${response.status} for ${method} ${path}`);

      // Check for expected content type
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        this.logger.warn(`Unexpected content type received: ${contentType}. This might indicate an invalid API key or an issue with the UniFi Protect API endpoint.`);
        // Return a response object with null data to prevent crashes
        return { ...response, data: null };
      }
      
      return response;
    } catch (error) {
      if (error.response) {
        this.logger.error(`HTTP ${error.response.status} error for ${method} ${path}: ${error.response.data}`);
      } else {
        this.logger.error(`Request failed for ${method} ${path}: ${error.message}`);
      }
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
        description: 'Stream video from camera',
        category: 'camera',
        operations: ['read'],
        dataTypes: ['video/rtsp', 'video/mp4', 'video/h264'],
        events: ['stream-started', 'stream-stopped', 'stream-error'],
        parameters: {
          cameraId: { type: 'string', required: true },
          quality: { type: 'string', enum: ['low', 'medium', 'high'] },
          format: { type: 'string', enum: ['rtsp', 'mp4'] }
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
          sensitivity: { type: 'number', min: 0, max: 100 },
          area: { type: 'object' }
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
        events: ['recording-completed', 'recording-deleted'],
        parameters: {
          cameraId: { type: 'string', required: false },
          startTime: { type: 'string', required: false },
          endTime: { type: 'string', required: false },
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
        events: [],
        parameters: {
          userId: { type: 'string', required: false },
          userData: { type: 'object', required: false }
        },
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
   * Authenticate and get session token for WebSocket
   */
  async authenticateForWebSocket() {
    // Check if we have a valid session token
    if (this.sessionToken && this.sessionExpiry && Date.now() < this.sessionExpiry) {
      return this.sessionToken;
    }

    // Rate limit auth attempts
    if (Date.now() - this.lastAuthAttempt < this.authRetryDelay) {
      this.logger.debug('Skipping auth attempt due to rate limiting');
      return this.sessionToken;
    }

    this.lastAuthAttempt = Date.now();

    try {
      this.logger.debug('Authenticating for WebSocket connection...');
      
      // Try to authenticate via REST API first
      const authResponse = await this.makeRequest('POST', '/auth/login', {
        username: this.config.username,
        password: this.config.password,
        remember: true
      });

      if (authResponse.data && authResponse.data.token) {
        const cookie = authResponse.headers['set-cookie'];
        this.sessionToken = {
          token: authResponse.data.token,
          cookie: cookie
        };
        this.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        this.logger.debug('Successfully authenticated and got session token');
        return this.sessionToken;
      }
    } catch (error) {
      this.logger.debug('REST API authentication failed, trying API key only:', error.message);
    }

    // If REST auth fails, try to validate API key
    try {
      const testResponse = await this.makeRequest('GET', `/sites/${this.siteId}/cameras?limit=1`);
      if (testResponse.status === 200) {
        this.logger.debug('API key validation successful');
        return this.config.apiKey; // Use API key as fallback
      }
    } catch (error) {
      this.logger.debug('API key validation failed:', error.message);
    }

    return null;
  }

  /**
   * Connect to UniFi Protect WebSocket for real-time events
   */
  async connectWebSocket() {
    if (this.wsConnected) {
      return;
    }

    try {
      const wsUrl = await this.getWebSocketUrl();
      
      if (!wsUrl) {
        this.logger.warn('No WebSocket URL available for UniFi Protect');
        return;
      }

      // First, get a session token
      const authData = await this.authenticateForWebSocket();
      
      if (!authData || !authData.token) {
        this.logger.error('Failed to get WebSocket session token');
        return;
      }
      
      this.logger.debug(`Attempting WebSocket connection with session token`);
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Cookie': authData.cookie,
          'Authorization': `Bearer ${authData.token}`
        },
        rejectUnauthorized: this.config.verifySSL !== false
      });

      // Set up event handlers
      this.setupWebSocketHandlers();
      
      // Wait for connection or failure
      await this.waitForWebSocketConnection();
      
      if (this.wsConnected) {
        this.logger.info(`WebSocket connected successfully`);
        return;
      }
      
      // If not connected, close and log
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      this.logger.warn('WebSocket connection failed - will rely on REST API polling');
      
    } catch (error) {
      const errorMessage = error?.message || String(error);
      this.logger.error('Failed to connect WebSocket:', errorMessage);
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  setupWebSocketHandlers() {
    this.ws.on('open', () => {
      this.logger.info('WebSocket connected to UniFi Protect');
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
        const message = JSON.parse(data.toString());
        this.handleWebSocketMessage(message);
      } catch (error) {
        const errorMessage = error?.message || String(error);
        this.logger.error('Error parsing WebSocket message:', errorMessage);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.logger.warn(`WebSocket disconnected: ${code} - ${reason}`);
      this.wsConnected = false;
      this.stopHeartbeat();
      
      // Handle specific error codes
      if (code === 4001) {
        this.logger.warn('Access key invalid - clearing session token and will retry with fresh auth');
        this.sessionToken = null;
        this.sessionExpiry = null;
      } else if (code === 1000) {
        this.logger.info('WebSocket closed normally');
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
      this.emit('websocket:error', { 
        connectorId: this.id, 
        error: errorMessage
      });
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
  handleWebSocketMessage(message) {
    // Handle different message types
    if (message.action === 'update') {
      this.handleWebSocketUpdate(message);
    } else if (message.action === 'add') {
      this.handleWebSocketAdd(message);
    } else if (message.action === 'remove') {
      this.handleWebSocketRemove(message);
    } else if (message.action === 'pong') {
      // Heartbeat response
      this.logger.debug('Heartbeat response received');
    } else {
      this.logger.debug(`Unknown message type: ${message.action}`);
    }
  }

  /**
   * Handle WebSocket update messages
   */
  handleWebSocketUpdate(message) {
    const event = {
      connectorId: this.id,
      type: message.newUpdateId,
      timestamp: new Date().toISOString(),
      data: message.data || message,
      source: 'unifi-protect-websocket'
    };

    this.logger.info(`UniFi event received: ${event.type}`);
    
    // Process event based on type
    this.processWebSocketEvent(event);
    
    // Emit the event
    this.emit('event', event);
    
    // Emit specific event types
    this.emit(`event:${event.type}`, event);
    
    // Emit connector-specific events
    this.emit(`connector:${this.id}:event`, event);
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
   * Schedule WebSocket reconnect
   */
  scheduleWebSocketReconnect() {
    // Don't reconnect if we've reached max attempts
    if (this.wsReconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.warn('Max WebSocket reconnect attempts reached - relying on REST API polling');
      return;
    }

    this.wsReconnectAttempts++;
    
    // Use longer delays for WebSocket reconnection since REST API polling is working
    const baseDelay = this.reconnectDelay * 2; // 10 seconds base
    const maxDelay = 300000; // 5 minutes max
    const delay = Math.min(baseDelay * Math.pow(2, this.wsReconnectAttempts - 1), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay; // 10% jitter
    const finalDelay = delay + jitter;
    
    this.logger.info(`Scheduling WebSocket reconnect in ${Math.round(finalDelay)}ms (attempt ${this.wsReconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      // Reset reconnect attempts if we've been connected for a while
      if (this.wsConnected) {
        this.wsReconnectAttempts = 0;
      } else {
        this.connectWebSocket();
      }
    }, finalDelay);
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
   * Get WebSocket URL for UniFi Protect
   */
  async getWebSocketUrl() {
    const endpoints = [
      `/proxy/protect/ws/updates`,
      `/proxy/protect/ws`,
      `/proxy/protect/v1/ws`,
      `/proxy/network/ws`,
      `/ws/protect`
    ];

    for (const endpoint of endpoints) {
      try {
        const url = `${this.config.protocol === 'https' ? 'wss' : 'ws'}://${this.config.host}:${this.config.port}${endpoint}`;
        this.logger.debug(`Trying WebSocket endpoint: ${url}`);
        
        const isAvailable = await this.testWebSocketEndpoint(url);
        if (isAvailable) {
          this.logger.info(`Found working WebSocket endpoint: ${endpoint}`);
          return url;
        }
      } catch (error) {
        const errorMessage = error && typeof error === 'object' && error.message ? error.message : String(error);
        this.logger.debug(`WebSocket endpoint ${endpoint} not available: ${errorMessage}`);
      }
    }

    this.logger.warn('No working WebSocket endpoints found');
    return null;
  }

  /**
   * Test if WebSocket endpoint is available
   */
  async testWebSocketEndpoint(url) {
    return new Promise((resolve) => {
      const ws = new WebSocket(url, {
        headers: {
          'X-API-KEY': this.config.apiKey
        },
        rejectUnauthorized: this.config.verifySSL !== false
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

      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
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
   */
  startEventPolling() {
    this.logger.info('Starting REST API event polling');
    
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
   */
  async pollForEvents() {
    try {
      // Use the correct Unifi Protect API endpoint for events
      const events = await this.makeRequest('GET', '/proxy/protect/v1/events?limit=10');
      
      if (events.data && events.data.data) {
        for (const event of events.data.data) {
          this.handleRestEvent(event);
        }
      } else if (events.data && Array.isArray(events.data)) {
        // Handle case where data is directly an array
        for (const event of events.data) {
          this.handleRestEvent(event);
        }
      }
    } catch (error) {
      // If Protect events API fails, try Network API for device events
      try {
        const devices = await this.makeRequest('GET', '/proxy/network/integration/v1/devices');
        if (devices.data && devices.data.data) {
          for (const device of devices.data.data) {
            this.handleDeviceEvent(device);
          }
        } else if (devices.data && Array.isArray(devices.data)) {
          // Handle case where data is directly an array
          for (const device of devices.data) {
            this.handleDeviceEvent(device);
          }
        }
      } catch (deviceError) {
        const deviceErrorMessage = deviceError?.message || String(deviceError);
        this.logger.debug('Could not poll for device events:', deviceErrorMessage);
      }
    }
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
      source: 'unifi-network-rest'
    };
    
    this.emit('connector:event', eventData);
    this.logger.debug(`Device event received: ${device.name || device.id}`);
  }
}

module.exports = UnifiProtectConnector;