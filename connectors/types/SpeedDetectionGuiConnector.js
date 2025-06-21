const BaseConnector = require('../BaseConnector');
const winston = require('winston');

/**
 * Speed Detection GUI Connector
 * 
 * Provides a web-based interface for setting up and managing line crossing speed detection systems.
 * Supports multiple speed detection configurations running simultaneously.
 */
class SpeedDetectionGuiConnector extends BaseConnector {
  constructor(config = {}) {
    super({
      id: config.id || 'speed-detection-gui',
      name: config.name || 'Speed Detection GUI',
      type: 'speed-detection-gui',
      capabilities: [
        'speed-detection-setup',
        'camera-selection',
        'map-integration',
        'line-crossing-configuration',
        'speed-calculation-monitoring',
        'multi-system-management'
      ],
      ...config
    });

    this.config = {
      webInterface: {
        enabled: true,
        host: config.host || 'localhost',
        port: config.port || 3000,
        route: config.route || '/speed-detection',
        title: 'Speed Detection Setup',
        ...config.webInterface
      },
      mapIntegration: {
        enabled: true,
        defaultLocation: {
          lat: 55.5074, // St Quivox Road, Prestwick
          lon: -4.6167,
          zoom: 15
        },
        ...config.mapIntegration
      },
      speedDetection: {
        maxSystems: config.maxSystems || 10,
        defaultSpeedLimit: 30,
        ...config.speedDetection
      },
      ...config
    };

    this.speedDetectionSystems = new Map(); // systemId -> system config
    this.activeConnections = new Map(); // connectorId -> connector
    this.cameraRegistry = new Map(); // cameraId -> camera info
    this.lineCrossingConfigs = new Map(); // lineId -> line config

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

    this.logger.info('Speed Detection GUI Connector initialized', {
      id: this.id,
      webInterface: this.config.webInterface
    });
  }

  /**
   * Get connector capabilities
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      speedDetection: {
        maxSystems: this.config.speedDetection.maxSystems,
        supportedObjectTypes: ['vehicle', 'person', 'bicycle'],
        supportedDetectionTypes: ['lineCrossing', 'anpr'],
        mapIntegration: this.config.mapIntegration.enabled
      },
      cameraIntegration: {
        supportedConnectors: ['unifi-protect', 'hikvision', 'ankke-dvr'],
        lineCrossingSupport: true,
        anprSupport: true
      }
    };
  }

  /**
   * Execute commands
   */
  async execute(operation, action, parameters = {}) {
    try {
      switch (operation) {
        case 'system':
          return await this.handleSystemOperation(action, parameters);
        case 'camera':
          return await this.handleCameraOperation(action, parameters);
        case 'line':
          return await this.handleLineOperation(action, parameters);
        case 'map':
          return await this.handleMapOperation(action, parameters);
        case 'speed':
          return await this.handleSpeedOperation(action, parameters);
        case 'gui':
          return await this.handleGuiOperation(action, parameters);
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      this.logger.error(`Error executing ${operation}:${action}:`, error);
      throw error;
    }
  }

  /**
   * Handle system operations
   */
  async handleSystemOperation(action, parameters) {
    switch (action) {
      case 'create':
        return await this.createSpeedDetectionSystem(parameters);
      case 'update':
        return await this.updateSpeedDetectionSystem(parameters);
      case 'delete':
        return await this.deleteSpeedDetectionSystem(parameters);
      case 'list':
        return await this.listSpeedDetectionSystems(parameters);
      case 'get':
        return await this.getSpeedDetectionSystem(parameters);
      case 'start':
        return await this.startSpeedDetectionSystem(parameters);
      case 'stop':
        return await this.stopSpeedDetectionSystem(parameters);
      default:
        throw new Error(`Unknown system action: ${action}`);
    }
  }

  /**
   * Handle camera operations
   */
  async handleCameraOperation(action, parameters) {
    switch (action) {
      case 'discover':
        return await this.discoverCameras(parameters);
      case 'list':
        return await this.listCameras(parameters);
      case 'get':
        return await this.getCamera(parameters);
      case 'test':
        return await this.testCameraConnection(parameters);
      default:
        throw new Error(`Unknown camera action: ${action}`);
    }
  }

  /**
   * Handle line crossing operations
   */
  async handleLineOperation(action, parameters) {
    switch (action) {
      case 'create':
        return await this.createLineCrossing(parameters);
      case 'update':
        return await this.updateLineCrossing(parameters);
      case 'delete':
        return await this.deleteLineCrossing(parameters);
      case 'list':
        return await this.listLineCrossings(parameters);
      case 'test':
        return await this.testLineCrossing(parameters);
      default:
        throw new Error(`Unknown line action: ${action}`);
    }
  }

  /**
   * Handle map operations
   */
  async handleMapOperation(action, parameters) {
    switch (action) {
      case 'getLocation':
        return await this.getMapLocation(parameters);
      case 'setLocation':
        return await this.setMapLocation(parameters);
      case 'calculateDistance':
        return await this.calculateDistance(parameters);
      default:
        throw new Error(`Unknown map action: ${action}`);
    }
  }

  /**
   * Handle speed calculation operations
   */
  async handleSpeedOperation(action, parameters) {
    switch (action) {
      case 'getCalculations':
        return await this.getSpeedCalculations(parameters);
      case 'getAlerts':
        return await this.getSpeedAlerts(parameters);
      case 'getStats':
        return await this.getSpeedStats(parameters);
      default:
        throw new Error(`Unknown speed action: ${action}`);
    }
  }

  /**
   * Handle GUI operations
   */
  async handleGuiOperation(action, parameters) {
    switch (action) {
      case 'getConfig':
        return await this.getGuiConfig(parameters);
      case 'getTemplates':
        return await this.getGuiTemplates(parameters);
      default:
        throw new Error(`Unknown GUI action: ${action}`);
    }
  }

  /**
   * Create a new speed detection system
   */
  async createSpeedDetectionSystem(parameters) {
    const { name, description, cameras, lines, speedLimit, location } = parameters;
    
    if (!name) {
      throw new Error('System name is required');
    }

    const systemId = `speed-system-${Date.now()}`;
    const system = {
      id: systemId,
      name,
      description: description || '',
      status: 'inactive',
      cameras: cameras || [],
      lines: lines || [],
      speedLimit: speedLimit || this.config.speedDetection.defaultSpeedLimit,
      location: location || this.config.mapIntegration.defaultLocation,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      stats: {
        totalDetections: 0,
        totalCalculations: 0,
        totalAlerts: 0,
        lastCalculation: null
      }
    };

    this.speedDetectionSystems.set(systemId, system);
    
    this.logger.info(`Speed detection system created: ${name} (${systemId})`);
    this.emit('system:created', system);
    
    return { success: true, systemId, system };
  }

  /**
   * Update a speed detection system
   */
  async updateSpeedDetectionSystem(parameters) {
    const { systemId, updates } = parameters;
    
    if (!systemId || !this.speedDetectionSystems.has(systemId)) {
      throw new Error(`Speed detection system not found: ${systemId}`);
    }

    const system = this.speedDetectionSystems.get(systemId);
    const updatedSystem = {
      ...system,
      ...updates,
      updated: new Date().toISOString()
    };

    this.speedDetectionSystems.set(systemId, updatedSystem);
    
    this.logger.info(`Speed detection system updated: ${systemId}`);
    this.emit('system:updated', updatedSystem);
    
    return { success: true, system: updatedSystem };
  }

  /**
   * Delete a speed detection system
   */
  async deleteSpeedDetectionSystem(parameters) {
    const { systemId } = parameters;
    
    if (!systemId || !this.speedDetectionSystems.has(systemId)) {
      throw new Error(`Speed detection system not found: ${systemId}`);
    }

    const system = this.speedDetectionSystems.get(systemId);
    
    // Stop the system if it's running
    if (system.status === 'active') {
      await this.stopSpeedDetectionSystem({ systemId });
    }

    this.speedDetectionSystems.delete(systemId);
    
    this.logger.info(`Speed detection system deleted: ${systemId}`);
    this.emit('system:deleted', system);
    
    return { success: true, systemId };
  }

  /**
   * List all speed detection systems
   */
  async listSpeedDetectionSystems(parameters = {}) {
    const { status, limit } = parameters;
    
    let systems = Array.from(this.speedDetectionSystems.values());
    
    if (status) {
      systems = systems.filter(system => system.status === status);
    }
    
    if (limit) {
      systems = systems.slice(0, limit);
    }
    
    return {
      success: true,
      systems,
      total: systems.length
    };
  }

  /**
   * Get a specific speed detection system
   */
  async getSpeedDetectionSystem(parameters) {
    const { systemId } = parameters;
    
    if (!systemId || !this.speedDetectionSystems.has(systemId)) {
      throw new Error(`Speed detection system not found: ${systemId}`);
    }

    return {
      success: true,
      system: this.speedDetectionSystems.get(systemId)
    };
  }

  /**
   * Start a speed detection system
   */
  async startSpeedDetectionSystem(parameters) {
    const { systemId } = parameters;
    
    if (!systemId || !this.speedDetectionSystems.has(systemId)) {
      throw new Error(`Speed detection system not found: ${systemId}`);
    }

    const system = this.speedDetectionSystems.get(systemId);
    
    if (system.status === 'active') {
      throw new Error(`Speed detection system is already active: ${systemId}`);
    }

    // Validate system configuration
    if (system.cameras.length < 2) {
      throw new Error(`Speed detection system requires at least 2 cameras: ${systemId}`);
    }

    // Update system status
    system.status = 'active';
    system.started = new Date().toISOString();
    system.updated = new Date().toISOString();

    this.speedDetectionSystems.set(systemId, system);
    
    this.logger.info(`Speed detection system started: ${systemId}`);
    this.emit('system:started', system);
    
    return { success: true, system };
  }

  /**
   * Stop a speed detection system
   */
  async stopSpeedDetectionSystem(parameters) {
    const { systemId } = parameters;
    
    if (!systemId || !this.speedDetectionSystems.has(systemId)) {
      throw new Error(`Speed detection system not found: ${systemId}`);
    }

    const system = this.speedDetectionSystems.get(systemId);
    
    if (system.status !== 'active') {
      throw new Error(`Speed detection system is not active: ${systemId}`);
    }

    // Update system status
    system.status = 'inactive';
    system.stopped = new Date().toISOString();
    system.updated = new Date().toISOString();

    this.speedDetectionSystems.set(systemId, system);
    
    this.logger.info(`Speed detection system stopped: ${systemId}`);
    this.emit('system:stopped', system);
    
    return { success: true, system };
  }

  /**
   * Discover available cameras from connected connectors
   */
  async discoverCameras(parameters = {}) {
    const { connectorId, connectorType } = parameters;
    
    const cameras = [];
    
    // Get cameras from connected connectors
    for (const [id, connector] of this.activeConnections.entries()) {
      if (connectorId && id !== connectorId) continue;
      if (connectorType && connector.type !== connectorType) continue;
      
      try {
        const connectorCameras = await connector.execute('cameras', 'list');
        if (connectorCameras.success && connectorCameras.cameras) {
          cameras.push(...connectorCameras.cameras.map(camera => ({
            ...camera,
            connectorId: id,
            connectorType: connector.type
          })));
        }
      } catch (error) {
        this.logger.warn(`Failed to discover cameras from connector ${id}:`, error);
      }
    }
    
    // Update camera registry
    cameras.forEach(camera => {
      this.cameraRegistry.set(camera.id, camera);
    });
    
    this.logger.info(`Discovered ${cameras.length} cameras`);
    
    return {
      success: true,
      cameras,
      total: cameras.length
    };
  }

  /**
   * List registered cameras
   */
  async listCameras(parameters = {}) {
    const { connectorId, hasLineCrossing } = parameters;
    
    let cameras = Array.from(this.cameraRegistry.values());
    
    if (connectorId) {
      cameras = cameras.filter(camera => camera.connectorId === connectorId);
    }
    
    if (hasLineCrossing) {
      cameras = cameras.filter(camera => 
        camera.capabilities && camera.capabilities.includes('lineCrossing')
      );
    }
    
    return {
      success: true,
      cameras,
      total: cameras.length
    };
  }

  /**
   * Get camera details
   */
  async getCamera(parameters) {
    const { cameraId } = parameters;
    
    if (!cameraId || !this.cameraRegistry.has(cameraId)) {
      throw new Error(`Camera not found: ${cameraId}`);
    }

    return {
      success: true,
      camera: this.cameraRegistry.get(cameraId)
    };
  }

  /**
   * Test camera connection
   */
  async testCameraConnection(parameters) {
    const { cameraId } = parameters;
    
    if (!cameraId || !this.cameraRegistry.has(cameraId)) {
      throw new Error(`Camera not found: ${cameraId}`);
    }

    const camera = this.cameraRegistry.get(cameraId);
    const connector = this.activeConnections.get(camera.connectorId);
    
    if (!connector) {
      throw new Error(`Connector not found: ${camera.connectorId}`);
    }

    try {
      const result = await connector.execute('camera', 'test', { cameraId });
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a line crossing configuration
   */
  async createLineCrossing(parameters) {
    const { cameraId, name, position, direction, objectTypes, systemId } = parameters;
    
    if (!cameraId || !name) {
      throw new Error('Camera ID and name are required');
    }

    const lineId = `line-${Date.now()}`;
    const line = {
      id: lineId,
      cameraId,
      name,
      position: position || { x: 0, y: 0 },
      direction: direction || 'in',
      objectTypes: objectTypes || ['vehicle'],
      systemId,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    this.lineCrossingConfigs.set(lineId, line);
    
    this.logger.info(`Line crossing created: ${name} (${lineId})`);
    this.emit('line:created', line);
    
    return { success: true, lineId, line };
  }

  /**
   * Update a line crossing configuration
   */
  async updateLineCrossing(parameters) {
    const { lineId, updates } = parameters;
    
    if (!lineId || !this.lineCrossingConfigs.has(lineId)) {
      throw new Error(`Line crossing not found: ${lineId}`);
    }

    const line = this.lineCrossingConfigs.get(lineId);
    const updatedLine = {
      ...line,
      ...updates,
      updated: new Date().toISOString()
    };

    this.lineCrossingConfigs.set(lineId, updatedLine);
    
    this.logger.info(`Line crossing updated: ${lineId}`);
    this.emit('line:updated', updatedLine);
    
    return { success: true, line: updatedLine };
  }

  /**
   * Delete a line crossing configuration
   */
  async deleteLineCrossing(parameters) {
    const { lineId } = parameters;
    
    if (!lineId || !this.lineCrossingConfigs.has(lineId)) {
      throw new Error(`Line crossing not found: ${lineId}`);
    }

    const line = this.lineCrossingConfigs.get(lineId);
    this.lineCrossingConfigs.delete(lineId);
    
    this.logger.info(`Line crossing deleted: ${lineId}`);
    this.emit('line:deleted', line);
    
    return { success: true, lineId };
  }

  /**
   * List line crossing configurations
   */
  async listLineCrossings(parameters = {}) {
    const { systemId, cameraId } = parameters;
    
    let lines = Array.from(this.lineCrossingConfigs.values());
    
    if (systemId) {
      lines = lines.filter(line => line.systemId === systemId);
    }
    
    if (cameraId) {
      lines = lines.filter(line => line.cameraId === cameraId);
    }
    
    return {
      success: true,
      lines,
      total: lines.length
    };
  }

  /**
   * Test line crossing configuration
   */
  async testLineCrossing(parameters) {
    const { lineId } = parameters;
    
    if (!lineId || !this.lineCrossingConfigs.has(lineId)) {
      throw new Error(`Line crossing not found: ${lineId}`);
    }

    const line = this.lineCrossingConfigs.get(lineId);
    const camera = this.cameraRegistry.get(line.cameraId);
    
    if (!camera) {
      throw new Error(`Camera not found: ${line.cameraId}`);
    }

    // Test if camera supports line crossing
    const supportsLineCrossing = camera.capabilities && 
      camera.capabilities.includes('lineCrossing');

    return {
      success: true,
      line,
      camera,
      supportsLineCrossing,
      testResult: supportsLineCrossing ? 'compatible' : 'incompatible'
    };
  }

  /**
   * Get map location
   */
  async getMapLocation(parameters = {}) {
    const { systemId } = parameters;
    
    if (systemId && this.speedDetectionSystems.has(systemId)) {
      const system = this.speedDetectionSystems.get(systemId);
      return {
        success: true,
        location: system.location
      };
    }
    
    return {
      success: true,
      location: this.config.mapIntegration.defaultLocation
    };
  }

  /**
   * Set map location
   */
  async setMapLocation(parameters) {
    const { systemId, location } = parameters;
    
    if (systemId && this.speedDetectionSystems.has(systemId)) {
      const system = this.speedDetectionSystems.get(systemId);
      system.location = location;
      system.updated = new Date().toISOString();
      this.speedDetectionSystems.set(systemId, system);
    }
    
    return { success: true, location };
  }

  /**
   * Calculate distance between two points
   */
  async calculateDistance(parameters) {
    const { point1, point2 } = parameters;
    
    if (!point1 || !point2) {
      throw new Error('Two points are required for distance calculation');
    }

    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLon = this.toRadians(point2.lon - point1.lon);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return {
      success: true,
      distance: distance,
      unit: 'km'
    };
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get speed calculations
   */
  async getSpeedCalculations(parameters = {}) {
    const { systemId, limit, startTime, endTime } = parameters;
    
    // This would integrate with the speed calculation service
    // For now, return mock data
    return {
      success: true,
      calculations: [],
      total: 0
    };
  }

  /**
   * Get speed alerts
   */
  async getSpeedAlerts(parameters = {}) {
    const { systemId, limit, minExcess } = parameters;
    
    // This would integrate with the speed calculation service
    // For now, return mock data
    return {
      success: true,
      alerts: [],
      total: 0
    };
  }

  /**
   * Get speed statistics
   */
  async getSpeedStats(parameters = {}) {
    const { systemId } = parameters;
    
    if (systemId && this.speedDetectionSystems.has(systemId)) {
      const system = this.speedDetectionSystems.get(systemId);
      return {
        success: true,
        stats: system.stats
      };
    }
    
    // Return overall stats
    const totalStats = {
      totalSystems: this.speedDetectionSystems.size,
      activeSystems: Array.from(this.speedDetectionSystems.values())
        .filter(system => system.status === 'active').length,
      totalDetections: 0,
      totalCalculations: 0,
      totalAlerts: 0
    };
    
    this.speedDetectionSystems.forEach(system => {
      totalStats.totalDetections += system.stats.totalDetections;
      totalStats.totalCalculations += system.stats.totalCalculations;
      totalStats.totalAlerts += system.stats.totalAlerts;
    });
    
    return {
      success: true,
      stats: totalStats
    };
  }

  /**
   * Get GUI configuration
   */
  async getGuiConfig(parameters = {}) {
    return {
      success: true,
      config: {
        webInterface: this.config.webInterface,
        mapIntegration: this.config.mapIntegration,
        speedDetection: this.config.speedDetection,
        capabilities: this.getCapabilities()
      }
    };
  }

  /**
   * Get GUI templates
   */
  async getGuiTemplates(parameters = {}) {
    return {
      success: true,
      templates: {
        singleCamera: {
          name: 'Single Camera Setup',
          description: 'One camera with multiple line crossings',
          cameras: 1,
          lines: 2,
          complexity: 'simple'
        },
        dualCamera: {
          name: 'Dual Camera Setup',
          description: 'Two cameras with single line crossings',
          cameras: 2,
          lines: 2,
          complexity: 'medium'
        },
        multiCamera: {
          name: 'Multi Camera Setup',
          description: 'Multiple cameras with complex line configurations',
          cameras: 3,
          lines: 4,
          complexity: 'advanced'
        }
      }
    };
  }

  /**
   * Connect to another connector
   */
  async connectToConnector(connector) {
    this.activeConnections.set(connector.id, connector);
    this.logger.info(`Connected to connector: ${connector.id} (${connector.type})`);
    
    // Discover cameras from the new connector
    await this.discoverCameras({ connectorId: connector.id });
    
    return { success: true, connectorId: connector.id };
  }

  /**
   * Disconnect from a connector
   */
  async disconnectFromConnector(connectorId) {
    if (this.activeConnections.has(connectorId)) {
      this.activeConnections.delete(connectorId);
      this.logger.info(`Disconnected from connector: ${connectorId}`);
      
      // Remove cameras from this connector
      for (const [cameraId, camera] of this.cameraRegistry.entries()) {
        if (camera.connectorId === connectorId) {
          this.cameraRegistry.delete(cameraId);
        }
      }
      
      return { success: true, connectorId };
    }
    
    throw new Error(`Connector not found: ${connectorId}`);
  }

  /**
   * Get connector status
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: 'connected',
      capabilities: this.getCapabilities(),
      stats: {
        totalSystems: this.speedDetectionSystems.size,
        activeSystems: Array.from(this.speedDetectionSystems.values())
          .filter(system => system.status === 'active').length,
        totalCameras: this.cameraRegistry.size,
        totalLines: this.lineCrossingConfigs.size,
        connectedConnectors: this.activeConnections.size
      }
    };
  }
}

module.exports = SpeedDetectionGuiConnector; 