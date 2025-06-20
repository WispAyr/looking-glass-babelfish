const axios = require('axios');
const https = require('https');
const EventEmitter = require('events');

class UnifiProtectAPI extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.devices = new Map();
    this.connections = new Map();
    this.authenticated = new Map();
    
    // Initialize devices from config
    this.config.devices.forEach(device => {
      this.devices.set(device.id, {
        ...this.config.default,
        ...device
      });
    });
  }

  async initialize() {
    this.logger.info('Initializing Unifi Protect API...');
    
    // Test connections to all devices
    for (const [deviceId, device] of this.devices) {
      try {
        await this.testConnection(deviceId);
        this.logger.info(`✅ Device ${device.name} (${deviceId}) connected successfully`);
      } catch (error) {
        this.logger.error(`❌ Failed to connect to device ${device.name} (${deviceId}):`, error.message);
      }
    }
  }

  async testConnection(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    try {
      const response = await this.makeRequest(deviceId, 'GET', '/proxy/network/integration/v1/sites');
      return response.data;
    } catch (error) {
      throw new Error(`Connection test failed for ${deviceId}: ${error.message}`);
    }
  }

  async authenticate(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    // If we have an API key, we're already authenticated
    if (device.apiKey) {
      this.authenticated.set(deviceId, true);
      return true;
    }

    // If we have username/password, authenticate
    if (device.username && device.password) {
      try {
        const response = await this.makeRequest(deviceId, 'POST', '/api/auth/login', {
          username: device.username,
          password: device.password
        });
        
        this.authenticated.set(deviceId, true);
        return true;
      } catch (error) {
        throw new Error(`Authentication failed for ${deviceId}: ${error.message}`);
      }
    }

    throw new Error(`No authentication method available for device ${deviceId}`);
  }

  async makeRequest(deviceId, method, endpoint, data = null, options = {}) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    // Ensure we're authenticated
    if (!this.authenticated.has(deviceId)) {
      await this.authenticate(deviceId);
    }

    const url = `${device.protocol}://${device.host}:${device.port}${endpoint}`;
    
    const config = {
      method,
      url,
      timeout: device.timeout,
      httpsAgent: new https.Agent({
        rejectUnauthorized: device.verifySSL
      }),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    // Add API key if available
    if (device.apiKey) {
      config.headers['X-API-KEY'] = device.apiKey;
    }

    // Add data for POST/PUT requests
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }

    try {
      this.logger.debug(`Making ${method} request to ${deviceId}: ${endpoint}`);
      const response = await axios(config);
      return response;
    } catch (error) {
      this.logger.error(`Request failed for ${deviceId}: ${error.message}`);
      
      // If authentication failed, try to re-authenticate
      if (error.response?.status === 401) {
        this.authenticated.delete(deviceId);
        await this.authenticate(deviceId);
        return this.makeRequest(deviceId, method, endpoint, data, options);
      }
      
      throw error;
    }
  }

  async getSites(deviceId) {
    try {
      const response = await this.makeRequest(deviceId, 'GET', '/proxy/network/integration/v1/sites');
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get sites for ${deviceId}:`, error.message);
      throw error;
    }
  }

  async getCameras(deviceId = null) {
    const cameras = [];
    
    const devices = deviceId ? [this.devices.get(deviceId)] : Array.from(this.devices.values());
    
    for (const device of devices) {
      if (!device) continue;
      
      try {
        this.logger.debug(`Attempting to get cameras from ${device.id} (${device.name})`);
        const response = await this.makeRequest(device.id, 'GET', '/proxy/protect/v1/cameras');
        
        if (response.data && Array.isArray(response.data)) {
          const deviceCameras = response.data.map(camera => ({
            ...camera,
            deviceId: device.id,
            deviceName: device.name
          }));
          cameras.push(...deviceCameras);
          this.logger.info(`Found ${deviceCameras.length} cameras on ${device.name}`);
        } else {
          this.logger.warn(`No cameras found on ${device.name} or Protect API not available`);
        }
      } catch (error) {
        this.logger.error(`Failed to get cameras for ${device.id}: ${error.message}`);
        // Don't throw, just log the error and continue
        this.logger.info(`Protect API may not be available on ${device.name} - this is normal if no cameras are configured`);
      }
    }
    
    return cameras;
  }

  async getEvents(deviceId = null, options = {}) {
    const {
      startTime,
      endTime,
      cameras,
      types,
      limit = 100
    } = options;

    const events = [];
    const devices = deviceId ? [this.devices.get(deviceId)] : Array.from(this.devices.values());
    
    for (const device of devices) {
      if (!device) continue;
      
      try {
        this.logger.debug(`Attempting to get events from ${device.id} (${device.name})`);
        let endpoint = `/proxy/protect/v1/events?limit=${limit}`;
        
        if (startTime) {
          endpoint += `&start=${startTime}`;
        }
        
        if (endTime) {
          endpoint += `&end=${endTime}`;
        }
        
        if (cameras && cameras.length > 0) {
          endpoint += `&cameras=${cameras.join(',')}`;
        }
        
        if (types && types.length > 0) {
          endpoint += `&types=${types.join(',')}`;
        }
        
        const response = await this.makeRequest(device.id, 'GET', endpoint);
        
        if (response.data && Array.isArray(response.data)) {
          const deviceEvents = response.data.map(event => ({
            ...event,
            deviceId: device.id,
            deviceName: device.name
          }));
          events.push(...deviceEvents);
          this.logger.info(`Found ${deviceEvents.length} events on ${device.name}`);
        } else {
          this.logger.warn(`No events found on ${device.name} or Protect API not available`);
        }
      } catch (error) {
        this.logger.error(`Failed to get events for ${device.id}: ${error.message}`);
        // Don't throw, just log the error and continue
        this.logger.info(`Protect API may not be available on ${device.name} - this is normal if no cameras are configured`);
      }
    }
    
    return events;
  }

  async getMotionEvents(deviceId = null, options = {}) {
    return this.getEvents(deviceId, { ...options, types: ['motion'] });
  }

  async getSmartDetectEvents(deviceId = null, options = {}) {
    return this.getEvents(deviceId, { ...options, types: ['smartDetectZone'] });
  }

  async getCameraSnapshot(cameraId, deviceId) {
    try {
      const response = await this.makeRequest(deviceId, 'GET', `/proxy/protect/v1/cameras/${cameraId}/snapshot`, null, {
        responseType: 'arraybuffer'
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get snapshot for camera ${cameraId}:`, error.message);
      throw error;
    }
  }

  async getCameraRecording(cameraId, deviceId, startTime, endTime) {
    try {
      const endpoint = `/proxy/protect/v1/cameras/${cameraId}/recordings?start=${startTime}&end=${endTime}`;
      const response = await this.makeRequest(deviceId, 'GET', endpoint);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get recording for camera ${cameraId}:`, error.message);
      throw error;
    }
  }

  async getSystemInfo(deviceId) {
    try {
      // First try to get Protect system info
      const response = await this.makeRequest(deviceId, 'GET', '/proxy/protect/v1/system');
      return response.data;
    } catch (error) {
      this.logger.warn(`Protect system info not available for ${deviceId}, falling back to network info: ${error.message}`);
      
      try {
        // Fall back to network system info
        const networkResponse = await this.makeRequest(deviceId, 'GET', '/proxy/network/integration/v1/sites');
        return {
          protect: {
            version: 'Not Available',
            status: 'Protect API not configured'
          },
          network: networkResponse.data,
          message: 'Protect API not available, showing network info only'
        };
      } catch (networkError) {
        this.logger.error(`Failed to get system info for ${deviceId}: ${networkError.message}`);
        return {
          protect: {
            version: 'Unknown',
            status: 'Error'
          },
          error: networkError.message
        };
      }
    }
  }

  async getDevices() {
    const devices = [];
    
    for (const [deviceId, device] of this.devices) {
      try {
        const systemInfo = await this.getSystemInfo(deviceId);
        devices.push({
          id: deviceId,
          name: device.name,
          host: device.host,
          port: device.port,
          protocol: device.protocol,
          description: device.description,
          status: 'online',
          systemInfo,
          lastSeen: new Date().toISOString()
        });
      } catch (error) {
        devices.push({
          id: deviceId,
          name: device.name,
          host: device.host,
          port: device.port,
          protocol: device.protocol,
          description: device.description,
          status: 'offline',
          error: error.message,
          lastSeen: new Date().toISOString()
        });
      }
    }
    
    return devices;
  }

  async addDevice(deviceConfig) {
    const deviceId = deviceConfig.id || `device-${Date.now()}`;
    
    this.devices.set(deviceId, {
      ...this.config.default,
      ...deviceConfig,
      id: deviceId
    });
    
    this.logger.info(`Added new device: ${deviceConfig.name} (${deviceId})`);
    
    // Test connection
    try {
      await this.testConnection(deviceId);
      this.logger.info(`✅ New device ${deviceConfig.name} connected successfully`);
    } catch (error) {
      this.logger.warn(`⚠️ New device ${deviceConfig.name} connection failed: ${error.message}`);
    }
    
    return deviceId;
  }

  async removeDevice(deviceId) {
    if (this.devices.has(deviceId)) {
      this.devices.delete(deviceId);
      this.authenticated.delete(deviceId);
      this.logger.info(`Removed device: ${deviceId}`);
      return true;
    }
    return false;
  }

  getDeviceConfig(deviceId) {
    return this.devices.get(deviceId);
  }

  getAllDevices() {
    return Array.from(this.devices.entries()).map(([id, device]) => ({
      id,
      ...device
    }));
  }
}

module.exports = UnifiProtectAPI; 