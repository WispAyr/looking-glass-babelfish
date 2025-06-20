const BaseConnector = require("../BaseConnector");
const axios = require('axios');

/**
 * ANKKE DVR Connector
 * 
 * Provides integration with ANKKE DVR systems for camera management,
 * video streaming, motion detection, and recording management.
 * Supports HTTP API and RTSP streaming protocols.
 */
class AnkkeDvrConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // HTTP client for API calls
    this.httpClient = null;
    
    // Connection state
    this.sessionId = null;
    this.isAuthenticated = false;
    
    // Device information
    this.deviceInfo = null;
    this.cameras = new Map();
    this.channels = new Map();
    
    // Event tracking
    this.eventHistory = new Map();
    this.maxEventHistory = 1000;
    
    // Stream management
    this.activeStreams = new Map();
    this.maxStreams = 16;
    
    // Recording management
    this.recordings = new Map();
    this.recordingStatus = new Map();
    
    // Motion detection
    this.motionEnabled = new Map();
    this.motionSensitivity = new Map();
    
    // Reconnection settings
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = this.config.maxReconnectAttempts || 5;
    this.reconnectInterval = this.config.reconnectInterval || 30000;
    
    // API endpoints
    this.baseUrl = null;
    this.apiEndpoints = {
      login: '/cgi-bin/guest/Login.cgi',
      logout: '/cgi-bin/guest/Logout.cgi',
      deviceInfo: '/cgi-bin/guest/DeviceInfo.cgi',
      cameraList: '/cgi-bin/guest/CameraList.cgi',
      channelList: '/cgi-bin/guest/ChannelList.cgi',
      stream: '/cgi-bin/guest/Stream.cgi',
      snapshot: '/cgi-bin/guest/Snapshot.cgi',
      recording: '/cgi-bin/guest/Recording.cgi',
      motion: '/cgi-bin/guest/Motion.cgi',
      event: '/cgi-bin/guest/Event.cgi',
      ptz: '/cgi-bin/guest/PTZ.cgi'
    };
  }
  
  /**
   * Perform connection to ANKKE DVR
   */
  async performConnect() {
    const { host, port, protocol, username, password } = this.config;
    
    if (!host) {
      throw new Error('Host is required for ANKKE DVR connection');
    }
    
    if (!username || !password) {
      throw new Error('Username and password are required for ANKKE DVR connection');
    }
    
    try {
      // Build base URL
      this.baseUrl = `${protocol}://${host}:${port}`;
      
      // Create HTTP client
      this.httpClient = axios.create({
        baseURL: this.baseUrl,
        timeout: this.config.timeout || 10000,
        headers: {
          'User-Agent': 'Babelfish-AnkkeDVR/1.0',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      // Authenticate
      await this.authenticate();
      
      // Get device information
      await this.getDeviceInfo();
      
      // Discover cameras and channels
      await this.discoverCameras();
      await this.discoverChannels();
      
      this.reconnectAttempts = 0;
      console.log(`Connected to ANKKE DVR: ${this.baseUrl}`);
      
    } catch (error) {
      console.error('ANKKE DVR connection error:', error);
      throw error;
    }
  }
  
  /**
   * Authenticate with the DVR
   */
  async authenticate() {
    const { username, password } = this.config;
    
    try {
      const response = await this.httpClient.post(this.apiEndpoints.login, {
        Username: username,
        Password: password
      });
      
      if (response.data && response.data.SessionID) {
        this.sessionId = response.data.SessionID;
        this.isAuthenticated = true;
        
        // Update HTTP client with session
        this.httpClient.defaults.headers.common['Cookie'] = `SessionID=${this.sessionId}`;
        
        console.log('Authenticated with ANKKE DVR');
      } else {
        throw new Error('Authentication failed - no session ID received');
      }
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }
  
  /**
   * Get device information
   */
  async getDeviceInfo() {
    try {
      const response = await this.httpClient.get(this.apiEndpoints.deviceInfo);
      
      if (response.data) {
        this.deviceInfo = {
          deviceName: response.data.DeviceName || 'Unknown',
          deviceType: response.data.DeviceType || 'Unknown',
          firmwareVersion: response.data.FirmwareVersion || 'Unknown',
          serialNumber: response.data.SerialNumber || 'Unknown',
          macAddress: response.data.MACAddress || 'Unknown',
          ipAddress: response.data.IPAddress || this.config.host,
          port: response.data.Port || this.config.port,
          channels: response.data.Channels || 0,
          maxUsers: response.data.MaxUsers || 1
        };
        
        console.log('Device info retrieved:', this.deviceInfo.deviceName);
      }
    } catch (error) {
      console.error('Error getting device info:', error.message);
    }
  }
  
  /**
   * Discover cameras
   */
  async discoverCameras() {
    try {
      const response = await this.httpClient.get(this.apiEndpoints.cameraList);
      
      if (response.data && response.data.Cameras) {
        this.cameras.clear();
        
        response.data.Cameras.forEach(camera => {
          this.cameras.set(camera.Channel, {
            channel: camera.Channel,
            name: camera.Name || `Camera ${camera.Channel}`,
            type: camera.Type || 'Unknown',
            status: camera.Status || 'Unknown',
            resolution: camera.Resolution || 'Unknown',
            fps: camera.FPS || 0,
            bitrate: camera.Bitrate || 0,
            enabled: camera.Enabled === 'true' || camera.Enabled === true
          });
        });
        
        console.log(`Discovered ${this.cameras.size} cameras`);
      }
    } catch (error) {
      console.error('Error discovering cameras:', error.message);
    }
  }
  
  /**
   * Discover channels
   */
  async discoverChannels() {
    try {
      const response = await this.httpClient.get(this.apiEndpoints.channelList);
      
      if (response.data && response.data.Channels) {
        this.channels.clear();
        
        response.data.Channels.forEach(channel => {
          this.channels.set(channel.Channel, {
            channel: channel.Channel,
            name: channel.Name || `Channel ${channel.Channel}`,
            type: channel.Type || 'Unknown',
            status: channel.Status || 'Unknown',
            recording: channel.Recording === 'true' || channel.Recording === true,
            motion: channel.Motion === 'true' || channel.Motion === true,
            ptz: channel.PTZ === 'true' || channel.PTZ === true
          });
        });
        
        console.log(`Discovered ${this.channels.size} channels`);
      }
    } catch (error) {
      console.error('Error discovering channels:', error.message);
    }
  }
  
  /**
   * Perform disconnection from ANKKE DVR
   */
  async performDisconnect() {
    try {
      if (this.isAuthenticated && this.sessionId) {
        await this.httpClient.post(this.apiEndpoints.logout, {
          SessionID: this.sessionId
        });
      }
    } catch (error) {
      console.error('Error during logout:', error.message);
    } finally {
      this.sessionId = null;
      this.isAuthenticated = false;
      this.httpClient = null;
      this.cameras.clear();
      this.channels.clear();
      this.activeStreams.clear();
    }
  }
  
  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'ankke:camera':
        return this.executeCameraManagement(operation, parameters);
      
      case 'ankke:stream':
        return this.executeStreaming(operation, parameters);
      
      case 'ankke:recording':
        return this.executeRecordingManagement(operation, parameters);
      
      case 'ankke:motion':
        return this.executeMotionDetection(operation, parameters);
      
      case 'ankke:ptz':
        return this.executePTZControl(operation, parameters);
      
      case 'ankke:event':
        return this.executeEventManagement(operation, parameters);
      
      case 'ankke:system':
        return this.executeSystemManagement(operation, parameters);
      
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }
  
  /**
   * Execute camera management operations
   */
  async executeCameraManagement(operation, parameters) {
    switch (operation) {
      case 'list':
        return this.listCameras(parameters);
      
      case 'info':
        return this.getCameraInfo(parameters);
      
      case 'enable':
        return this.enableCamera(parameters);
      
      case 'disable':
        return this.disableCamera(parameters);
      
      case 'snapshot':
        return this.takeSnapshot(parameters);
      
      default:
        throw new Error(`Unknown camera operation: ${operation}`);
    }
  }
  
  /**
   * Execute streaming operations
   */
  async executeStreaming(operation, parameters) {
    switch (operation) {
      case 'start':
        return this.startStream(parameters);
      
      case 'stop':
        return this.stopStream(parameters);
      
      case 'list':
        return this.listStreams(parameters);
      
      case 'url':
        return this.getStreamUrl(parameters);
      
      default:
        throw new Error(`Unknown streaming operation: ${operation}`);
    }
  }
  
  /**
   * Execute recording management operations
   */
  async executeRecordingManagement(operation, parameters) {
    switch (operation) {
      case 'start':
        return this.startRecording(parameters);
      
      case 'stop':
        return this.stopRecording(parameters);
      
      case 'list':
        return this.listRecordings(parameters);
      
      case 'download':
        return this.downloadRecording(parameters);
      
      case 'delete':
        return this.deleteRecording(parameters);
      
      default:
        throw new Error(`Unknown recording operation: ${operation}`);
    }
  }
  
  /**
   * Execute motion detection operations
   */
  async executeMotionDetection(operation, parameters) {
    switch (operation) {
      case 'enable':
        return this.enableMotionDetection(parameters);
      
      case 'disable':
        return this.disableMotionDetection(parameters);
      
      case 'configure':
        return this.configureMotionDetection(parameters);
      
      case 'status':
        return this.getMotionStatus(parameters);
      
      default:
        throw new Error(`Unknown motion operation: ${operation}`);
    }
  }
  
  /**
   * Execute PTZ control operations
   */
  async executePTZControl(operation, parameters) {
    switch (operation) {
      case 'move':
        return this.movePTZ(parameters);
      
      case 'stop':
        return this.stopPTZ(parameters);
      
      case 'preset':
        return this.setPTZPreset(parameters);
      
      case 'zoom':
        return this.zoomPTZ(parameters);
      
      default:
        throw new Error(`Unknown PTZ operation: ${operation}`);
    }
  }
  
  /**
   * Execute event management operations
   */
  async executeEventManagement(operation, parameters) {
    switch (operation) {
      case 'list':
        return this.listEvents(parameters);
      
      case 'subscribe':
        return this.subscribeToEvents(parameters);
      
      case 'unsubscribe':
        return this.unsubscribeFromEvents(parameters);
      
      default:
        throw new Error(`Unknown event operation: ${operation}`);
    }
  }
  
  /**
   * Execute system management operations
   */
  async executeSystemManagement(operation, parameters) {
    switch (operation) {
      case 'info':
        return this.getSystemInfo(parameters);
      
      case 'reboot':
        return this.rebootSystem(parameters);
      
      case 'config':
        return this.getSystemConfig(parameters);
      
      default:
        throw new Error(`Unknown system operation: ${operation}`);
    }
  }
  
  /**
   * List cameras
   */
  async listCameras(parameters) {
    const { enabled } = parameters || {};
    
    let cameras = Array.from(this.cameras.values());
    
    if (enabled !== undefined) {
      cameras = cameras.filter(camera => camera.enabled === enabled);
    }
    
    return cameras;
  }
  
  /**
   * Get camera information
   */
  async getCameraInfo(parameters) {
    const { channel } = parameters;
    
    if (!channel) {
      throw new Error('Channel is required');
    }
    
    const camera = this.cameras.get(channel);
    if (!camera) {
      throw new Error(`Camera not found for channel ${channel}`);
    }
    
    return camera;
  }
  
  /**
   * Enable camera
   */
  async enableCamera(parameters) {
    const { channel } = parameters;
    
    if (!channel) {
      throw new Error('Channel is required');
    }
    
    try {
      const response = await this.httpClient.post('/cgi-bin/guest/Camera.cgi', {
        Action: 'Enable',
        Channel: channel
      });
      
      if (response.data && response.data.Result === 'Success') {
        const camera = this.cameras.get(channel);
        if (camera) {
          camera.enabled = true;
        }
        return { success: true, message: 'Camera enabled' };
      } else {
        throw new Error('Failed to enable camera');
      }
    } catch (error) {
      throw new Error(`Error enabling camera: ${error.message}`);
    }
  }
  
  /**
   * Disable camera
   */
  async disableCamera(parameters) {
    const { channel } = parameters;
    
    if (!channel) {
      throw new Error('Channel is required');
    }
    
    try {
      const response = await this.httpClient.post('/cgi-bin/guest/Camera.cgi', {
        Action: 'Disable',
        Channel: channel
      });
      
      if (response.data && response.data.Result === 'Success') {
        const camera = this.cameras.get(channel);
        if (camera) {
          camera.enabled = false;
        }
        return { success: true, message: 'Camera disabled' };
      } else {
        throw new Error('Failed to disable camera');
      }
    } catch (error) {
      throw new Error(`Error disabling camera: ${error.message}`);
    }
  }
  
  /**
   * Take snapshot
   */
  async takeSnapshot(parameters) {
    const { channel, quality = 'high' } = parameters;
    
    if (!channel) {
      throw new Error('Channel is required');
    }
    
    try {
      const response = await this.httpClient.get(this.apiEndpoints.snapshot, {
        params: {
          Channel: channel,
          Quality: quality
        },
        responseType: 'arraybuffer'
      });
      
      return {
        channel,
        timestamp: new Date().toISOString(),
        data: response.data,
        contentType: response.headers['content-type'] || 'image/jpeg',
        size: response.data.length
      };
    } catch (error) {
      throw new Error(`Error taking snapshot: ${error.message}`);
    }
  }
  
  /**
   * Start stream
   */
  async startStream(parameters) {
    const { channel, type = 'main', format = 'h264' } = parameters;
    
    if (!channel) {
      throw new Error('Channel is required');
    }
    
    if (this.activeStreams.size >= this.maxStreams) {
      throw new Error('Maximum number of active streams reached');
    }
    
    try {
      const streamId = `${channel}_${type}_${Date.now()}`;
      const streamUrl = `${this.baseUrl}${this.apiEndpoints.stream}?Channel=${channel}&Type=${type}&Format=${format}`;
      
      this.activeStreams.set(streamId, {
        id: streamId,
        channel,
        type,
        format,
        url: streamUrl,
        startTime: new Date().toISOString(),
        status: 'active'
      });
      
      return {
        streamId,
        url: streamUrl,
        channel,
        type,
        format
      };
    } catch (error) {
      throw new Error(`Error starting stream: ${error.message}`);
    }
  }
  
  /**
   * Stop stream
   */
  async stopStream(parameters) {
    const { streamId } = parameters;
    
    if (!streamId) {
      throw new Error('Stream ID is required');
    }
    
    const stream = this.activeStreams.get(streamId);
    if (!stream) {
      throw new Error('Stream not found');
    }
    
    this.activeStreams.delete(streamId);
    
    return {
      streamId,
      message: 'Stream stopped',
      duration: Date.now() - new Date(stream.startTime).getTime()
    };
  }
  
  /**
   * List active streams
   */
  async listStreams(parameters) {
    return Array.from(this.activeStreams.values());
  }
  
  /**
   * Get stream URL
   */
  async getStreamUrl(parameters) {
    const { channel, type = 'main', format = 'h264' } = parameters;
    
    if (!channel) {
      throw new Error('Channel is required');
    }
    
    return `${this.baseUrl}${this.apiEndpoints.stream}?Channel=${channel}&Type=${type}&Format=${format}`;
  }
  
  /**
   * Start recording
   */
  async startRecording(parameters) {
    const { channel, type = 'manual' } = parameters;
    
    if (!channel) {
      throw new Error('Channel is required');
    }
    
    try {
      const response = await this.httpClient.post(this.apiEndpoints.recording, {
        Action: 'Start',
        Channel: channel,
        Type: type
      });
      
      if (response.data && response.data.Result === 'Success') {
        this.recordingStatus.set(channel, {
          channel,
          type,
          startTime: new Date().toISOString(),
          status: 'recording'
        });
        
        return { success: true, message: 'Recording started' };
      } else {
        throw new Error('Failed to start recording');
      }
    } catch (error) {
      throw new Error(`Error starting recording: ${error.message}`);
    }
  }
  
  /**
   * Stop recording
   */
  async stopRecording(parameters) {
    const { channel } = parameters;
    
    if (!channel) {
      throw new Error('Channel is required');
    }
    
    try {
      const response = await this.httpClient.post(this.apiEndpoints.recording, {
        Action: 'Stop',
        Channel: channel
      });
      
      if (response.data && response.data.Result === 'Success') {
        this.recordingStatus.delete(channel);
        return { success: true, message: 'Recording stopped' };
      } else {
        throw new Error('Failed to stop recording');
      }
    } catch (error) {
      throw new Error(`Error stopping recording: ${error.message}`);
    }
  }
  
  /**
   * List recordings
   */
  async listRecordings(parameters) {
    const { channel, startTime, endTime } = parameters;
    
    try {
      const params = {};
      if (channel) params.Channel = channel;
      if (startTime) params.StartTime = startTime;
      if (endTime) params.EndTime = endTime;
      
      const response = await this.httpClient.get(this.apiEndpoints.recording, { params });
      
      if (response.data && response.data.Recordings) {
        return response.data.Recordings;
      }
      
      return [];
    } catch (error) {
      throw new Error(`Error listing recordings: ${error.message}`);
    }
  }
  
  /**
   * Enable motion detection
   */
  async enableMotionDetection(parameters) {
    const { channel, sensitivity = 50 } = parameters;
    
    if (!channel) {
      throw new Error('Channel is required');
    }
    
    try {
      const response = await this.httpClient.post(this.apiEndpoints.motion, {
        Action: 'Enable',
        Channel: channel,
        Sensitivity: sensitivity
      });
      
      if (response.data && response.data.Result === 'Success') {
        this.motionEnabled.set(channel, true);
        this.motionSensitivity.set(channel, sensitivity);
        
        return { success: true, message: 'Motion detection enabled' };
      } else {
        throw new Error('Failed to enable motion detection');
      }
    } catch (error) {
      throw new Error(`Error enabling motion detection: ${error.message}`);
    }
  }
  
  /**
   * Disable motion detection
   */
  async disableMotionDetection(parameters) {
    const { channel } = parameters;
    
    if (!channel) {
      throw new Error('Channel is required');
    }
    
    try {
      const response = await this.httpClient.post(this.apiEndpoints.motion, {
        Action: 'Disable',
        Channel: channel
      });
      
      if (response.data && response.data.Result === 'Success') {
        this.motionEnabled.set(channel, false);
        
        return { success: true, message: 'Motion detection disabled' };
      } else {
        throw new Error('Failed to disable motion detection');
      }
    } catch (error) {
      throw new Error(`Error disabling motion detection: ${error.message}`);
    }
  }
  
  /**
   * Move PTZ
   */
  async movePTZ(parameters) {
    const { channel, direction, speed = 50 } = parameters;
    
    if (!channel || !direction) {
      throw new Error('Channel and direction are required');
    }
    
    const validDirections = ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'];
    if (!validDirections.includes(direction)) {
      throw new Error(`Invalid direction. Must be one of: ${validDirections.join(', ')}`);
    }
    
    try {
      const response = await this.httpClient.post(this.apiEndpoints.ptz, {
        Action: 'Move',
        Channel: channel,
        Direction: direction,
        Speed: speed
      });
      
      if (response.data && response.data.Result === 'Success') {
        return { success: true, message: `PTZ moved ${direction}` };
      } else {
        throw new Error('Failed to move PTZ');
      }
    } catch (error) {
      throw new Error(`Error moving PTZ: ${error.message}`);
    }
  }
  
  /**
   * Stop PTZ
   */
  async stopPTZ(parameters) {
    const { channel } = parameters;
    
    if (!channel) {
      throw new Error('Channel is required');
    }
    
    try {
      const response = await this.httpClient.post(this.apiEndpoints.ptz, {
        Action: 'Stop',
        Channel: channel
      });
      
      if (response.data && response.data.Result === 'Success') {
        return { success: true, message: 'PTZ stopped' };
      } else {
        throw new Error('Failed to stop PTZ');
      }
    } catch (error) {
      throw new Error(`Error stopping PTZ: ${error.message}`);
    }
  }
  
  /**
   * Get system information
   */
  async getSystemInfo(parameters) {
    return this.deviceInfo || {};
  }
  
  /**
   * Get capability definitions
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'ankke:camera',
        name: 'Camera Management',
        description: 'Manage cameras and take snapshots',
        operations: ['list', 'info', 'enable', 'disable', 'snapshot'],
        requiresConnection: true
      },
      {
        id: 'ankke:stream',
        name: 'Video Streaming',
        description: 'Start, stop, and manage video streams',
        operations: ['start', 'stop', 'list', 'url'],
        requiresConnection: true
      },
      {
        id: 'ankke:recording',
        name: 'Recording Management',
        description: 'Manage video recordings',
        operations: ['start', 'stop', 'list', 'download', 'delete'],
        requiresConnection: true
      },
      {
        id: 'ankke:motion',
        name: 'Motion Detection',
        description: 'Configure and manage motion detection',
        operations: ['enable', 'disable', 'configure', 'status'],
        requiresConnection: true
      },
      {
        id: 'ankke:ptz',
        name: 'PTZ Control',
        description: 'Control pan, tilt, and zoom functions',
        operations: ['move', 'stop', 'preset', 'zoom'],
        requiresConnection: true
      },
      {
        id: 'ankke:event',
        name: 'Event Management',
        description: 'Manage system events and notifications',
        operations: ['list', 'subscribe', 'unsubscribe'],
        requiresConnection: true
      },
      {
        id: 'ankke:system',
        name: 'System Management',
        description: 'System information and configuration',
        operations: ['info', 'reboot', 'config'],
        requiresConnection: true
      }
    ];
  }
  
  /**
   * Validate configuration
   */
  static validateConfig(config) {
    if (!config.host) {
      throw new Error('Host is required');
    }
    
    if (!config.username) {
      throw new Error('Username is required');
    }
    
    if (!config.password) {
      throw new Error('Password is required');
    }
    
    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error('Port must be between 1 and 65535');
    }
    
    if (config.protocol && !['http', 'https'].includes(config.protocol)) {
      throw new Error('Protocol must be either "http" or "https"');
    }
  }
  
  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      name: 'ANKKE DVR Connector',
      version: '1.0.0',
      description: 'Integration with ANKKE DVR systems for camera management and video streaming',
      author: 'Looking Glass Team',
      capabilities: [
        'camera management',
        'video streaming',
        'recording management',
        'motion detection',
        'PTZ control',
        'event management'
      ],
      configSchema: {
        host: { type: 'string', required: true, description: 'ANKKE DVR IP address' },
        port: { type: 'number', default: 80, description: 'ANKKE DVR port' },
        protocol: { type: 'string', enum: ['http', 'https'], default: 'http', description: 'Connection protocol' },
        username: { type: 'string', required: true, description: 'DVR username' },
        password: { type: 'string', required: true, description: 'DVR password' },
        timeout: { type: 'number', default: 10000, description: 'Request timeout in milliseconds' },
        maxReconnectAttempts: { type: 'number', default: 5, description: 'Maximum reconnection attempts' },
        reconnectInterval: { type: 'number', default: 30000, description: 'Reconnection interval in milliseconds' }
      }
    };
  }
}

module.exports = AnkkeDvrConnector;
