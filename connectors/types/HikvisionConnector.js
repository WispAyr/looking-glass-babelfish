const BaseConnector = require('../BaseConnector');
const axios = require('axios');

/**
 * Hikvision Connector
 * 
 * Provides integration with Hikvision IP cameras, DVRs, and NVRs.
 * Supports ISAPI REST API, RTSP streaming, and event management.
 * Compatible with Hikvision cameras, DVRs, NVRs, and access control devices.
 */
class HikvisionConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // HTTP client for ISAPI calls
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
    this.maxStreams = 32;
    
    // Recording management
    this.recordings = new Map();
    this.recordingStatus = new Map();
    
    // Motion detection
    this.motionEnabled = new Map();
    this.motionSensitivity = new Map();
    
    // PTZ presets
    this.ptzPresets = new Map();
    
    // Reconnection settings
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = this.config.maxReconnectAttempts || 5;
    this.reconnectInterval = this.config.reconnectInterval || 30000;
    
    // API endpoints
    this.baseUrl = null;
    this.apiEndpoints = {
      deviceInfo: '/ISAPI/System/deviceInfo',
      network: '/ISAPI/System/Network',
      channels: '/ISAPI/System/Video/inputs/channels',
      streams: '/ISAPI/Streaming',
      snapshots: '/ISAPI/Streaming/channels',
      recordings: '/ISAPI/ContentMgmt/record',
      motion: '/ISAPI/System/Video/inputs/channels',
      ptz: '/ISAPI/PTZCtrl',
      events: '/ISAPI/Event/triggers',
      users: '/ISAPI/Security/users',
      system: '/ISAPI/System'
    };
  }
  
  /**
   * Perform connection to Hikvision device
   */
  async performConnect() {
    const { host, port, protocol, username, password } = this.config;
    
    if (!host) {
      throw new Error('Host is required for Hikvision connection');
    }
    
    if (!username || !password) {
      throw new Error('Username and password are required for Hikvision connection');
    }
    
    try {
      // Build base URL
      this.baseUrl = `${protocol}://${host}:${port}`;
      
      // Create HTTP client with basic auth
      this.httpClient = axios.create({
        baseURL: this.baseUrl,
        timeout: this.config.timeout || 15000,
        auth: {
          username: username,
          password: password
        },
        headers: {
          'User-Agent': 'Babelfish-Hikvision/1.0',
          'Content-Type': 'application/xml'
        }
      });
      
      // Test connection and get device info
      await this.getDeviceInfo();
      
      // Discover cameras and channels
      await this.discoverChannels();
      
      this.reconnectAttempts = 0;
      this.isAuthenticated = true;
      console.log(`Connected to Hikvision device: ${this.baseUrl}`);
      
    } catch (error) {
      console.error('Hikvision connection error:', error);
      throw error;
    }
  }
  
  /**
   * Get device information
   */
  async getDeviceInfo() {
    try {
      const response = await this.httpClient.get(this.apiEndpoints.deviceInfo);
      
      if (response.data) {
        const deviceData = response.data;
        this.deviceInfo = {
          deviceName: deviceData.deviceName || 'Unknown',
          deviceID: deviceData.deviceID || 'Unknown',
          model: deviceData.model || 'Unknown',
          serialNumber: deviceData.serialNumber || 'Unknown',
          macAddress: deviceData.macAddress || 'Unknown',
          firmwareVersion: deviceData.firmwareVersion || 'Unknown',
          firmwareReleasedDate: deviceData.firmwareReleasedDate || 'Unknown',
          deviceType: deviceData.deviceType || 'Unknown',
          hardwareVersion: deviceData.hardwareVersion || 'Unknown',
          ipAddress: this.config.host,
          port: this.config.port
        };
        
        console.log('Device info retrieved:', this.deviceInfo.deviceName);
      }
    } catch (error) {
      console.error('Error getting device info:', error.message);
      throw new Error(`Failed to get device info: ${error.message}`);
    }
  }
  
  /**
   * Discover channels
   */
  async discoverChannels() {
    try {
      const response = await this.httpClient.get(this.apiEndpoints.channels);
      
      if (response.data && response.data.VideoInputChannelList) {
        this.channels.clear();
        
        const channels = Array.isArray(response.data.VideoInputChannelList.VideoInputChannel) 
          ? response.data.VideoInputChannelList.VideoInputChannel 
          : [response.data.VideoInputChannelList.VideoInputChannel];
        
        channels.forEach(channel => {
          if (channel) {
            this.channels.set(channel.id, {
              id: channel.id,
              name: channel.name || `Channel ${channel.id}`,
              enabled: channel.enabled === 'true' || channel.enabled === true,
              videoInputPortID: channel.videoInputPortID,
              videoCodecType: channel.videoCodecType,
              videoScanType: channel.videoScanType,
              videoResolutionWidth: channel.videoResolutionWidth,
              videoResolutionHeight: channel.videoResolutionHeight,
              videoQualityControlType: channel.videoQualityControlType,
              videoFrameRate: channel.videoFrameRate,
              videoBitRate: channel.videoBitRate,
              videoGovLength: channel.videoGovLength,
              videoProfile: channel.videoProfile
            });
          }
        });
        
        console.log(`Discovered ${this.channels.size} channels`);
      }
    } catch (error) {
      console.error('Error discovering channels:', error.message);
    }
  }
  
  /**
   * Perform disconnection from Hikvision device
   */
  async performDisconnect() {
    this.sessionId = null;
    this.isAuthenticated = false;
    this.httpClient = null;
    this.cameras.clear();
    this.channels.clear();
    this.activeStreams.clear();
  }
  
  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'hikvision:camera':
        return this.executeCameraManagement(operation, parameters);
      
      case 'hikvision:stream':
        return this.executeStreaming(operation, parameters);
      
      case 'hikvision:recording':
        return this.executeRecordingManagement(operation, parameters);
      
      case 'hikvision:motion':
        return this.executeMotionDetection(operation, parameters);
      
      case 'hikvision:ptz':
        return this.executePTZControl(operation, parameters);
      
      case 'hikvision:event':
        return this.executeEventManagement(operation, parameters);
      
      case 'hikvision:system':
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
      
      case 'config':
        return this.getCameraConfig(parameters);
      
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
      
      case 'config':
        return this.getStreamConfig(parameters);
      
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
      
      case 'schedule':
        return this.getRecordingSchedule(parameters);
      
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
      
      case 'areas':
        return this.getMotionAreas(parameters);
      
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
      
      case 'goto':
        return this.gotoPTZPreset(parameters);
      
      case 'zoom':
        return this.zoomPTZ(parameters);
      
      case 'list-presets':
        return this.listPTZPresets(parameters);
      
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
      
      case 'triggers':
        return this.getEventTriggers(parameters);
      
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
      
      case 'network':
        return this.getNetworkConfig(parameters);
      
      case 'users':
        return this.getUsers(parameters);
      
      default:
        throw new Error(`Unknown system operation: ${operation}`);
    }
  }
  
  /**
   * List cameras
   */
  async listCameras(parameters) {
    const { enabled } = parameters || {};
    
    let cameras = Array.from(this.channels.values());
    
    if (enabled !== undefined) {
      cameras = cameras.filter(camera => camera.enabled === enabled);
    }
    
    return cameras;
  }
  
  /**
   * Get camera information
   */
  async getCameraInfo(parameters) {
    const { channelId } = parameters;
    
    if (!channelId) {
      throw new Error('Channel ID is required');
    }
    
    const camera = this.channels.get(channelId);
    if (!camera) {
      throw new Error(`Camera not found for channel ${channelId}`);
    }
    
    return camera;
  }
  
  /**
   * Enable camera
   */
  async enableCamera(parameters) {
    const { channelId } = parameters;
    
    if (!channelId) {
      throw new Error('Channel ID is required');
    }
    
    try {
      const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<VideoInputChannel version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <id>${channelId}</id>
  <enabled>true</enabled>
</VideoInputChannel>`;
      
      const response = await this.httpClient.put(`${this.apiEndpoints.channels}/${channelId}`, xmlData);
      
      if (response.status === 200) {
        const camera = this.channels.get(channelId);
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
    const { channelId } = parameters;
    
    if (!channelId) {
      throw new Error('Channel ID is required');
    }
    
    try {
      const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<VideoInputChannel version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <id>${channelId}</id>
  <enabled>false</enabled>
</VideoInputChannel>`;
      
      const response = await this.httpClient.put(`${this.apiEndpoints.channels}/${channelId}`, xmlData);
      
      if (response.status === 200) {
        const camera = this.channels.get(channelId);
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
    const { channelId, streamType = 'main' } = parameters;
    
    if (!channelId) {
      throw new Error('Channel ID is required');
    }
    
    try {
      const response = await this.httpClient.get(`${this.apiEndpoints.snapshots}/${channelId}/picture`, {
        params: {
          streamType: streamType
        },
        responseType: 'arraybuffer'
      });
      
      return {
        channelId,
        streamType,
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
    const { channelId, streamType = 'main', protocol = 'rtsp' } = parameters;
    
    if (!channelId) {
      throw new Error('Channel ID is required');
    }
    
    if (this.activeStreams.size >= this.maxStreams) {
      throw new Error('Maximum number of active streams reached');
    }
    
    try {
      const streamId = `${channelId}_${streamType}_${Date.now()}`;
      let streamUrl;
      
      if (protocol === 'rtsp') {
        streamUrl = `rtsp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}/Streaming/Channels/${channelId}${streamType === 'sub' ? '02' : '01'}`;
      } else {
        streamUrl = `${this.baseUrl}${this.apiEndpoints.streams}/channels/${channelId}/httpPreview`;
      }
      
      this.activeStreams.set(streamId, {
        id: streamId,
        channelId,
        streamType,
        protocol,
        url: streamUrl,
        startTime: new Date().toISOString(),
        status: 'active'
      });
      
      return {
        streamId,
        url: streamUrl,
        channelId,
        streamType,
        protocol
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
    const { channelId, streamType = 'main', protocol = 'rtsp' } = parameters;
    
    if (!channelId) {
      throw new Error('Channel ID is required');
    }
    
    if (protocol === 'rtsp') {
      return `rtsp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}/Streaming/Channels/${channelId}${streamType === 'sub' ? '02' : '01'}`;
    } else {
      return `${this.baseUrl}${this.apiEndpoints.streams}/channels/${channelId}/httpPreview`;
    }
  }
  
  /**
   * List recordings
   */
  async listRecordings(parameters) {
    const { channelId, startTime, endTime } = parameters;
    
    if (!channelId) {
      throw new Error('Channel ID is required');
    }
    
    try {
      const params = {
        channelID: channelId
      };
      
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;
      
      const response = await this.httpClient.get(this.apiEndpoints.recordings, { params });
      
      if (response.data && response.data.MatchList) {
        return response.data.MatchList;
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
    const { channelId, enabled = true } = parameters;
    
    if (!channelId) {
      throw new Error('Channel ID is required');
    }
    
    try {
      const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<MotionDetection version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <enabled>${enabled}</enabled>
</MotionDetection>`;
      
      const response = await this.httpClient.put(`${this.apiEndpoints.motion}/${channelId}/motionDetection`, xmlData);
      
      if (response.status === 200) {
        this.motionEnabled.set(channelId, enabled);
        return { success: true, message: `Motion detection ${enabled ? 'enabled' : 'disabled'}` };
      } else {
        throw new Error('Failed to configure motion detection');
      }
    } catch (error) {
      throw new Error(`Error configuring motion detection: ${error.message}`);
    }
  }
  
  /**
   * Disable motion detection
   */
  async disableMotionDetection(parameters) {
    return this.enableMotionDetection({ ...parameters, enabled: false });
  }
  
  /**
   * Move PTZ
   */
  async movePTZ(parameters) {
    const { channelId, action, speed = 1 } = parameters;
    
    if (!channelId || !action) {
      throw new Error('Channel ID and action are required');
    }
    
    const validActions = ['start', 'stop'];
    const validDirections = ['up', 'down', 'left', 'right', 'upLeft', 'upRight', 'downLeft', 'downRight'];
    
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action. Must be one of: ${validActions.join(', ')}`);
    }
    
    try {
      const response = await this.httpClient.put(`${this.apiEndpoints.ptz}/channels/${channelId}/continuous`, {
        pan: parameters.pan || 0,
        tilt: parameters.tilt || 0,
        zoom: parameters.zoom || 0
      });
      
      if (response.status === 200) {
        return { success: true, message: `PTZ ${action} completed` };
      } else {
        throw new Error(`Failed to ${action} PTZ`);
      }
    } catch (error) {
      throw new Error(`Error controlling PTZ: ${error.message}`);
    }
  }
  
  /**
   * Stop PTZ
   */
  async stopPTZ(parameters) {
    const { channelId } = parameters;
    
    if (!channelId) {
      throw new Error('Channel ID is required');
    }
    
    try {
      const response = await this.httpClient.put(`${this.apiEndpoints.ptz}/channels/${channelId}/continuous`, {
        pan: 0,
        tilt: 0,
        zoom: 0
      });
      
      if (response.status === 200) {
        return { success: true, message: 'PTZ stopped' };
      } else {
        throw new Error('Failed to stop PTZ');
      }
    } catch (error) {
      throw new Error(`Error stopping PTZ: ${error.message}`);
    }
  }
  
  /**
   * Set PTZ preset
   */
  async setPTZPreset(parameters) {
    const { channelId, presetId, presetName } = parameters;
    
    if (!channelId || !presetId) {
      throw new Error('Channel ID and preset ID are required');
    }
    
    try {
      const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<PTZPreset version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <id>${presetId}</id>
  <presetName>${presetName || `Preset ${presetId}`}</presetName>
</PTZPreset>`;
      
      const response = await this.httpClient.put(`${this.apiEndpoints.ptz}/channels/${channelId}/presets/${presetId}`, xmlData);
      
      if (response.status === 200) {
        this.ptzPresets.set(`${channelId}_${presetId}`, {
          channelId,
          presetId,
          presetName: presetName || `Preset ${presetId}`
        });
        
        return { success: true, message: 'PTZ preset set' };
      } else {
        throw new Error('Failed to set PTZ preset');
      }
    } catch (error) {
      throw new Error(`Error setting PTZ preset: ${error.message}`);
    }
  }
  
  /**
   * List PTZ presets
   */
  async listPTZPresets(parameters) {
    const { channelId } = parameters;
    
    if (!channelId) {
      throw new Error('Channel ID is required');
    }
    
    try {
      const response = await this.httpClient.get(`${this.apiEndpoints.ptz}/channels/${channelId}/presets`);
      
      if (response.data && response.data.PTZPresetList) {
        return response.data.PTZPresetList;
      }
      
      return [];
    } catch (error) {
      throw new Error(`Error listing PTZ presets: ${error.message}`);
    }
  }
  
  /**
   * Get system information
   */
  async getSystemInfo(parameters) {
    return this.deviceInfo || {};
  }
  
  /**
   * Get network configuration
   */
  async getNetworkConfig(parameters) {
    try {
      const response = await this.httpClient.get(this.apiEndpoints.network);
      
      if (response.data) {
        return response.data;
      }
      
      return {};
    } catch (error) {
      throw new Error(`Error getting network config: ${error.message}`);
    }
  }
  
  /**
   * Get capability definitions
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'hikvision:camera',
        name: 'Camera Management',
        description: 'Manage cameras and take snapshots',
        operations: ['list', 'info', 'enable', 'disable', 'snapshot', 'config'],
        requiresConnection: true
      },
      {
        id: 'hikvision:stream',
        name: 'Video Streaming',
        description: 'Start, stop, and manage video streams',
        operations: ['start', 'stop', 'list', 'url', 'config'],
        requiresConnection: true
      },
      {
        id: 'hikvision:recording',
        name: 'Recording Management',
        description: 'Manage video recordings',
        operations: ['start', 'stop', 'list', 'download', 'delete', 'schedule'],
        requiresConnection: true
      },
      {
        id: 'hikvision:motion',
        name: 'Motion Detection',
        description: 'Configure and manage motion detection',
        operations: ['enable', 'disable', 'configure', 'status', 'areas'],
        requiresConnection: true
      },
      {
        id: 'hikvision:ptz',
        name: 'PTZ Control',
        description: 'Control pan, tilt, and zoom functions',
        operations: ['move', 'stop', 'preset', 'goto', 'zoom', 'list-presets'],
        requiresConnection: true
      },
      {
        id: 'hikvision:event',
        name: 'Event Management',
        description: 'Manage system events and notifications',
        operations: ['list', 'subscribe', 'unsubscribe', 'triggers'],
        requiresConnection: true
      },
      {
        id: 'hikvision:system',
        name: 'System Management',
        description: 'System information and configuration',
        operations: ['info', 'reboot', 'config', 'network', 'users'],
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
      name: 'Hikvision Connector',
      version: '1.0.0',
      description: 'Integration with Hikvision IP cameras, DVRs, and NVRs',
      author: 'Looking Glass Team',
      capabilities: [
        'camera management',
        'video streaming',
        'recording management',
        'motion detection',
        'PTZ control',
        'event management',
        'system management'
      ],
      configSchema: {
        host: { type: 'string', required: true, description: 'Hikvision device IP address' },
        port: { type: 'number', default: 80, description: 'Hikvision device port' },
        protocol: { type: 'string', enum: ['http', 'https'], default: 'http', description: 'Connection protocol' },
        username: { type: 'string', required: true, description: 'Device username' },
        password: { type: 'string', required: true, description: 'Device password' },
        timeout: { type: 'number', default: 15000, description: 'Request timeout in milliseconds' },
        maxReconnectAttempts: { type: 'number', default: 5, description: 'Maximum reconnection attempts' },
        reconnectInterval: { type: 'number', default: 30000, description: 'Reconnection interval in milliseconds' }
      }
    };
  }
}

module.exports = HikvisionConnector;
