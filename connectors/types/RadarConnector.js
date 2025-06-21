const BaseConnector = require('../BaseConnector');
const EventEmitter = require('events');

/**
 * Radar Connector
 * 
 * Provides a comprehensive radar map interface for ADSB aircraft tracking.
 * Features real-time aircraft display, zone management, and advanced radar controls.
 */
class RadarConnector extends BaseConnector {
  constructor(config, adsbConnector, airportVectorService) {
    const connectorConfig = {
      ...config,
      type: 'radar'
    };
    
    super(connectorConfig);
    
    this.adsbConnector = adsbConnector;
    this.airportVectorService = airportVectorService;
    this.config = this.adsbConnector.radarConfig; // Use ADSB config by default
    
    // Radar display configuration
    this.radarConfig = {
      range: config.config?.range || 50, // nautical miles
      center: config.config?.center || { lat: 51.5074, lon: -0.1278 }, // London default
      zoom: config.config?.zoom || 10,
      rotation: config.config?.rotation || 0, // degrees
      sweepSpeed: config.config?.sweepSpeed || 4, // seconds per sweep
      showTrails: config.config?.showTrails !== false,
      trailLength: config.config?.trailLength || 20,
      showLabels: config.config?.showLabels !== false,
      showAltitude: config.config?.showAltitude !== false,
      showSpeed: config.config?.showSpeed !== false,
      showHeading: config.config?.showHeading !== false,
      showSquawk: config.config?.showSquawk !== false,
      showEmergency: config.config?.showEmergency !== false,
      colorByAltitude: config.config?.colorByAltitude !== false,
      colorBySpeed: config.config?.colorBySpeed !== false,
      colorByType: config.config?.colorByType !== false
    };
    
    // Aircraft display settings
    this.aircraftDisplay = {
      symbolSize: config.config?.symbolSize || 6,
      symbolType: config.config?.symbolType || 'circle', // circle, triangle, square, diamond
      trailOpacity: config.config?.trailOpacity || 0.6,
      labelFontSize: config.config?.labelFontSize || 12,
      labelOffset: config.config?.labelOffset || 15,
      emergencyBlink: config.config?.emergencyBlink !== false,
      altitudeThresholds: config.config?.altitudeThresholds || {
        low: 1000,
        medium: 10000,
        high: 30000
      },
      speedThresholds: config.config?.speedThresholds || {
        slow: 100,
        medium: 300,
        fast: 500
      }
    };
    
    // Zone display settings
    this.zoneDisplay = {
      showZones: config.config?.showZones !== false,
      zoneOpacity: config.config?.zoneOpacity || 0.3,
      zoneBorderWidth: config.config?.zoneBorderWidth || 2,
      showZoneLabels: config.config?.showZoneLabels !== false,
      zoneLabelFontSize: config.config?.zoneLabelFontSize || 10,
      highlightActiveZones: config.config?.highlightActiveZones !== false
    };
    
    // Filter settings
    this.filters = {
      altitude: {
        min: config.config?.altitudeMin || 0,
        max: config.config?.altitudeMax || 50000,
        enabled: config.config?.altitudeFilter !== false
      },
      speed: {
        min: config.config?.speedMin || 0,
        max: config.config?.speedMax || 1000,
        enabled: config.config?.speedFilter !== false
      },
      distance: {
        max: config.config?.distanceMax || 100,
        enabled: config.config?.distanceFilter !== false
      },
      aircraftType: {
        types: config.config?.aircraftTypes || [],
        enabled: config.config?.typeFilter !== false
      },
      callsign: {
        pattern: config.config?.callsignPattern || '',
        enabled: config.config?.callsignFilter !== false
      },
      squawk: {
        codes: config.config?.squawkCodes || [],
        enabled: config.config?.squawkFilter !== false
      }
    };
    
    // Radar sweep animation
    this.sweepAngle = 0;
    this.sweepTimer = null;
    this.isSweeping = config.config?.sweepAnimation !== false;
    
    // Aircraft data cache
    this.aircraftData = new Map();
    this.aircraftTrails = new Map();
    this.zoneData = new Map();
    
    // Event tracking
    this.radarEvents = [];
    this.alertEvents = [];
    
    // Performance metrics
    this.performance = {
      frameRate: 0,
      aircraftCount: 0,
      zoneCount: 0,
      lastUpdate: null,
      updateCount: 0
    };
    
    // WebSocket connections for real-time updates
    this.connections = new Set();
    
    this.logger.info('Radar Connector initialized', {
      id: this.id,
      range: this.radarConfig.range,
      center: this.radarConfig.center
    });
  }
  
  /**
   * Get capability definitions for this connector
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'radar:display',
        name: 'Radar Display',
        description: 'Provides a unified view of aircraft and airport data.',
        operations: ['get', 'configure'],
      },
      {
        id: 'aircraft:tracking',
        name: 'Aircraft Tracking',
        description: 'Track and display aircraft on radar',
        category: 'tracking',
        operations: ['get', 'filter', 'highlight', 'trail'],
        dataTypes: ['aircraft:position', 'aircraft:trail', 'aircraft:info'],
        events: ['aircraft:update', 'aircraft:enter', 'aircraft:exit'],
        parameters: {
          icao24: { type: 'string', required: false },
          callsign: { type: 'string', required: false },
          filter: { type: 'object', required: false }
        }
      },
      {
        id: 'zones:management',
        name: 'Zone Management',
        description: 'Define and manage radar zones',
        category: 'spatial',
        operations: ['create', 'update', 'delete', 'list', 'monitor'],
        dataTypes: ['zone:definition', 'zone:violation', 'zone:status'],
        events: ['zone:entered', 'zone:exited', 'zone:violation'],
        parameters: {
          zoneId: { type: 'string', required: false },
          zoneType: { type: 'string', required: false },
          coordinates: { type: 'array', required: false }
        }
      },
      {
        id: 'filters:radar',
        name: 'Radar Filters',
        description: 'Filter aircraft display on radar',
        category: 'filtering',
        operations: ['set', 'get', 'clear', 'apply'],
        dataTypes: ['filter:altitude', 'filter:speed', 'filter:distance', 'filter:type'],
        events: ['filter:changed', 'filter:applied'],
        parameters: {
          filterType: { type: 'string', required: false },
          filterValue: { type: 'object', required: false }
        }
      },
      {
        id: 'alerts:radar',
        name: 'Radar Alerts',
        description: 'Generate alerts based on radar events',
        category: 'alerts',
        operations: ['configure', 'trigger', 'acknowledge', 'list'],
        dataTypes: ['alert:rule', 'alert:triggered', 'alert:status'],
        events: ['alert:triggered', 'alert:acknowledged', 'alert:cleared'],
        parameters: {
          alertType: { type: 'string', required: false },
          rule: { type: 'object', required: false }
        }
      }
    ];
  }
  
  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'radar:display':
        return await this.executeRadarDisplay(operation, parameters);
      case 'aircraft:tracking':
        return await this.executeAircraftTracking(operation, parameters);
      case 'zones:management':
        return await this.executeZoneManagement(operation, parameters);
      case 'filters:radar':
        return await this.executeRadarFilters(operation, parameters);
      case 'alerts:radar':
        return await this.executeRadarAlerts(operation, parameters);
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }
  
  /**
   * Execute radar display operations
   */
  async executeRadarDisplay(operation, parameters) {
    switch (operation) {
      case 'get':
        return this.getRadarDisplay(parameters);
      case 'configure':
        return this.configureRadar(parameters);
      case 'update':
        return this.updateRadarDisplay(parameters);
      case 'export':
        return this.exportRadarData(parameters);
      default:
        throw new Error(`Unknown radar display operation: ${operation}`);
    }
  }
  
  /**
   * Execute aircraft tracking operations
   */
  async executeAircraftTracking(operation, parameters) {
    switch (operation) {
      case 'get':
        return this.getAircraftData(parameters);
      case 'filter':
        return this.filterAircraft(parameters);
      case 'highlight':
        return this.highlightAircraft(parameters);
      case 'trail':
        return this.getAircraftTrail(parameters);
      default:
        throw new Error(`Unknown aircraft tracking operation: ${operation}`);
    }
  }
  
  /**
   * Execute zone management operations
   */
  async executeZoneManagement(operation, parameters) {
    switch (operation) {
      case 'create':
        return this.createZone(parameters);
      case 'update':
        return this.updateZone(parameters);
      case 'delete':
        return this.deleteZone(parameters);
      case 'list':
        return this.listZones(parameters);
      case 'monitor':
        return this.monitorZone(parameters);
      default:
        throw new Error(`Unknown zone management operation: ${operation}`);
    }
  }
  
  /**
   * Execute radar filter operations
   */
  async executeRadarFilters(operation, parameters) {
    switch (operation) {
      case 'set':
        return this.setFilter(parameters);
      case 'get':
        return this.getFilters(parameters);
      case 'clear':
        return this.clearFilter(parameters);
      case 'apply':
        return this.applyFilters(parameters);
      default:
        throw new Error(`Unknown radar filter operation: ${operation}`);
    }
  }
  
  /**
   * Execute radar alert operations
   */
  async executeRadarAlerts(operation, parameters) {
    switch (operation) {
      case 'configure':
        return this.configureAlert(parameters);
      case 'trigger':
        return this.triggerAlert(parameters);
      case 'acknowledge':
        return this.acknowledgeAlert(parameters);
      case 'list':
        return this.listAlerts(parameters);
      default:
        throw new Error(`Unknown radar alert operation: ${operation}`);
    }
  }
  
  /**
   * Connect to radar system
   */
  async performConnect() {
    try {
      // Start radar sweep animation
      if (this.isSweeping) {
        this.startSweepAnimation();
      }
      
      // Initialize radar display
      await this.initializeRadarDisplay();
      
      this.logger.info('Radar Connector connected');
      return { status: 'connected', message: 'Radar system ready' };
    } catch (error) {
      this.logger.error('Failed to connect radar', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Disconnect from radar system
   */
  async performDisconnect() {
    try {
      // Stop sweep animation
      if (this.sweepTimer) {
        clearInterval(this.sweepTimer);
        this.sweepTimer = null;
      }
      
      // Clear connections
      this.connections.clear();
      
      this.logger.info('Radar Connector disconnected');
      return { status: 'disconnected', message: 'Radar system stopped' };
    } catch (error) {
      this.logger.error('Failed to disconnect radar', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get radar display data
   */
  getRadarDisplay(parameters = {}) {
    const adsbDisplay = this.adsbConnector.getRadarDisplay();
    const airportData = this.airportVectorService.getAllData();
    
    return {
      ...adsbDisplay,
      airport: airportData,
    };
  }
  
  /**
   * Configure radar display
   */
  configureRadar(parameters) {
    return this.adsbConnector.configureRadar(parameters);
  }
  
  /**
   * Update radar display
   */
  updateRadarDisplay(parameters) {
    // Update aircraft data
    if (parameters.aircraft) {
      this.updateAircraftData(parameters.aircraft);
    }
    
    // Update zone data
    if (parameters.zones) {
      this.updateZoneData(parameters.zones);
    }
    
    // Update performance metrics
    this.performance.lastUpdate = new Date().toISOString();
    this.performance.updateCount++;
    this.performance.aircraftCount = this.aircraftData.size;
    this.performance.zoneCount = this.zoneData.size;
    
    // Broadcast update to connected clients
    this.broadcastUpdate();
    
    return { success: true, timestamp: this.performance.lastUpdate };
  }
  
  /**
   * Export radar data
   */
  exportRadarData(parameters) {
    const format = parameters.format || 'json';
    
    switch (format) {
      case 'json':
        return {
          format: 'json',
          data: {
            radar: this.getRadarDisplay(),
            aircraft: Array.from(this.aircraftData.values()),
            zones: Array.from(this.zoneData.values()),
            trails: Array.from(this.aircraftTrails.entries()),
            events: this.radarEvents,
            alerts: this.alertEvents
          }
        };
      case 'csv':
        return {
          format: 'csv',
          data: this.exportToCSV()
        };
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Get aircraft data
   */
  getAircraftData(parameters = {}) {
    let aircraft = Array.from(this.aircraftData.values());
    
    // Apply filters
    if (parameters.filter) {
      aircraft = this.applyAircraftFilter(aircraft, parameters.filter);
    }
    
    // Apply sorting
    if (parameters.sort) {
      aircraft = this.sortAircraft(aircraft, parameters.sort);
    }
    
    // Apply pagination
    if (parameters.limit) {
      aircraft = aircraft.slice(0, parameters.limit);
    }
    
    return aircraft;
  }
  
  /**
   * Filter aircraft
   */
  filterAircraft(parameters) {
    const filter = parameters.filter || {};
    const aircraft = Array.from(this.aircraftData.values());
    
    return this.applyAircraftFilter(aircraft, filter);
  }
  
  /**
   * Highlight aircraft
   */
  highlightAircraft(parameters) {
    const { icao24, callsign, highlight } = parameters;
    
    if (icao24 && this.aircraftData.has(icao24)) {
      const aircraft = this.aircraftData.get(icao24);
      aircraft.highlighted = highlight !== false;
      this.aircraftData.set(icao24, aircraft);
    }
    
    if (callsign) {
      for (const [icao, aircraft] of this.aircraftData.entries()) {
        if (aircraft.callsign === callsign) {
          aircraft.highlighted = highlight !== false;
          this.aircraftData.set(icao, aircraft);
          break;
        }
      }
    }
    
    return { success: true };
  }
  
  /**
   * Get aircraft trail
   */
  getAircraftTrail(parameters) {
    const { icao24, length } = parameters;
    
    if (!icao24 || !this.aircraftTrails.has(icao24)) {
      return [];
    }
    
    const trail = this.aircraftTrails.get(icao24);
    return length ? trail.slice(-length) : trail;
  }
  
  /**
   * Create zone
   */
  createZone(parameters) {
    const { id, name, type, coordinates, color, priority } = parameters;
    
    if (!id || !coordinates) {
      throw new Error('Zone ID and coordinates are required');
    }
    
    const zone = {
      id,
      name: name || `Zone ${id}`,
      type: type || 'custom',
      coordinates,
      color: color || '#FF0000',
      priority: priority || 'medium',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.zoneData.set(id, zone);
    
    this.logger.info('Zone created', { id, name, type });
    return zone;
  }
  
  /**
   * Update zone
   */
  updateZone(parameters) {
    const { id, updates } = parameters;
    
    if (!id || !this.zoneData.has(id)) {
      throw new Error(`Zone ${id} not found`);
    }
    
    const zone = this.zoneData.get(id);
    Object.assign(zone, updates, { updatedAt: new Date().toISOString() });
    this.zoneData.set(id, zone);
    
    this.logger.info('Zone updated', { id, updates });
    return zone;
  }
  
  /**
   * Delete zone
   */
  deleteZone(parameters) {
    const { id } = parameters;
    
    if (!id || !this.zoneData.has(id)) {
      throw new Error(`Zone ${id} not found`);
    }
    
    this.zoneData.delete(id);
    
    this.logger.info('Zone deleted', { id });
    return { success: true, id };
  }
  
  /**
   * List zones
   */
  listZones(parameters = {}) {
    let zones = Array.from(this.zoneData.values());
    
    // Filter by type
    if (parameters.type) {
      zones = zones.filter(zone => zone.type === parameters.type);
    }
    
    // Filter by active status
    if (parameters.active !== undefined) {
      zones = zones.filter(zone => zone.active === parameters.active);
    }
    
    return zones;
  }
  
  /**
   * Monitor zone
   */
  monitorZone(parameters) {
    const { zoneId, enabled } = parameters;
    
    if (!zoneId || !this.zoneData.has(zoneId)) {
      throw new Error(`Zone ${zoneId} not found`);
    }
    
    const zone = this.zoneData.get(zoneId);
    zone.monitored = enabled !== false;
    this.zoneData.set(zoneId, zone);
    
    return { success: true, zoneId, monitored: zone.monitored };
  }
  
  /**
   * Set filter
   */
  setFilter(parameters) {
    const { filterType, filterValue } = parameters;
    
    if (!filterType || !this.filters[filterType]) {
      throw new Error(`Unknown filter type: ${filterType}`);
    }
    
    Object.assign(this.filters[filterType], filterValue);
    
    this.logger.info('Filter updated', { filterType, filterValue });
    return this.filters[filterType];
  }
  
  /**
   * Get filters
   */
  getFilters(parameters = {}) {
    const { filterType } = parameters;
    
    if (filterType) {
      return this.filters[filterType] || null;
    }
    
    return this.filters;
  }
  
  /**
   * Clear filter
   */
  clearFilter(parameters) {
    const { filterType } = parameters;
    
    if (filterType && this.filters[filterType]) {
      this.filters[filterType].enabled = false;
      return { success: true, filterType, cleared: true };
    }
    
    // Clear all filters
    Object.values(this.filters).forEach(filter => {
      filter.enabled = false;
    });
    
    return { success: true, cleared: 'all' };
  }
  
  /**
   * Apply filters
   */
  applyFilters(parameters) {
    const aircraft = Array.from(this.aircraftData.values());
    return this.applyAircraftFilter(aircraft, this.filters);
  }
  
  /**
   * Configure alert
   */
  configureAlert(parameters) {
    const { alertType, rule } = parameters;
    
    // Implementation for alert configuration
    this.logger.info('Alert configured', { alertType, rule });
    return { success: true, alertType, rule };
  }
  
  /**
   * Trigger alert
   */
  triggerAlert(parameters) {
    const { alertType, data } = parameters;
    
    const alert = {
      id: `alert_${Date.now()}`,
      type: alertType,
      data,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.alertEvents.push(alert);
    
    this.logger.info('Alert triggered', alert);
    return alert;
  }
  
  /**
   * Acknowledge alert
   */
  acknowledgeAlert(parameters) {
    const { alertId } = parameters;
    
    const alert = this.alertEvents.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
    }
    
    return { success: true, alertId };
  }
  
  /**
   * List alerts
   */
  listAlerts(parameters = {}) {
    let alerts = [...this.alertEvents];
    
    if (parameters.acknowledged !== undefined) {
      alerts = alerts.filter(alert => alert.acknowledged === parameters.acknowledged);
    }
    
    if (parameters.type) {
      alerts = alerts.filter(alert => alert.type === parameters.type);
    }
    
    return alerts;
  }
  
  /**
   * Start sweep animation
   */
  startSweepAnimation() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
    }
    
    this.sweepTimer = setInterval(() => {
      this.sweepAngle = (this.sweepAngle + 6) % 360; // 6 degrees per update
      this.broadcastUpdate();
    }, (this.radarConfig.sweepSpeed * 1000) / 60); // 60 updates per sweep
  }
  
  /**
   * Update sweep speed
   */
  updateSweepSpeed(speed) {
    this.radarConfig.sweepSpeed = speed;
    
    if (this.sweepTimer) {
      this.startSweepAnimation();
    }
  }
  
  /**
   * Initialize radar display
   */
  async initializeRadarDisplay() {
    // Initialize with default data
    this.performance.lastUpdate = new Date().toISOString();
    
    this.logger.info('Radar display initialized');
  }
  
  /**
   * Update aircraft data
   */
  updateAircraftData(aircraftList) {
    for (const aircraft of aircraftList) {
      const icao24 = aircraft.icao24;
      
      // Update aircraft data
      this.aircraftData.set(icao24, {
        ...aircraft,
        lastUpdate: new Date().toISOString()
      });
      
      // Update trail
      if (!this.aircraftTrails.has(icao24)) {
        this.aircraftTrails.set(icao24, []);
      }
      
      const trail = this.aircraftTrails.get(icao24);
      trail.push({
        lat: aircraft.lat,
        lon: aircraft.lon,
        altitude: aircraft.altitude,
        timestamp: new Date().toISOString()
      });
      
      // Limit trail length
      if (trail.length > this.radarConfig.trailLength) {
        trail.shift();
      }
    }
  }
  
  /**
   * Update zone data
   */
  updateZoneData(zones) {
    for (const zone of zones) {
      this.zoneData.set(zone.id, zone);
    }
  }
  
  /**
   * Apply aircraft filter
   */
  applyAircraftFilter(aircraft, filter) {
    return aircraft.filter(ac => {
      // Altitude filter
      if (filter.altitude) {
        const alt = ac.altitude || 0;
        if (filter.altitude.min !== undefined && alt < filter.altitude.min) return false;
        if (filter.altitude.max !== undefined && alt > filter.altitude.max) return false;
      }
      
      // Speed filter
      if (filter.speed) {
        const speed = ac.speed || 0;
        if (filter.speed.min !== undefined && speed < filter.speed.min) return false;
        if (filter.speed.max !== undefined && speed > filter.speed.max) return false;
      }
      
      // Distance filter
      if (filter.distance && filter.distance.max) {
        const distance = this.calculateDistance(
          this.radarConfig.center.lat,
          this.radarConfig.center.lon,
          ac.lat,
          ac.lon
        );
        if (distance > filter.distance.max) return false;
      }
      
      // Type filter
      if (filter.aircraftType && filter.aircraftType.types.length > 0) {
        if (!filter.aircraftType.types.includes(ac.aircraftType)) return false;
      }
      
      // Callsign filter
      if (filter.callsign && filter.callsign.pattern) {
        if (!ac.callsign || !ac.callsign.match(filter.callsign.pattern)) return false;
      }
      
      // Squawk filter
      if (filter.squawk && filter.squawk.codes.length > 0) {
        if (!ac.squawk || !filter.squawk.codes.includes(ac.squawk)) return false;
      }
      
      return true;
    });
  }
  
  /**
   * Sort aircraft
   */
  sortAircraft(aircraft, sort) {
    return aircraft.sort((a, b) => {
      const aValue = a[sort.field] || 0;
      const bValue = b[sort.field] || 0;
      
      if (sort.direction === 'desc') {
        return bValue - aValue;
      }
      return aValue - bValue;
    });
  }
  
  /**
   * Calculate distance between two points
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth's radius in nautical miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  /**
   * Export to CSV
   */
  exportToCSV() {
    const aircraft = Array.from(this.aircraftData.values());
    const headers = ['icao24', 'callsign', 'lat', 'lon', 'altitude', 'speed', 'heading', 'squawk', 'aircraftType'];
    const csv = [headers.join(',')];
    
    for (const ac of aircraft) {
      const row = headers.map(header => ac[header] || '').join(',');
      csv.push(row);
    }
    
    return csv.join('\n');
  }
  
  /**
   * Broadcast update to connected clients
   */
  broadcastUpdate() {
    const update = {
      type: 'radar_update',
      data: this.getRadarDisplay(),
      timestamp: new Date().toISOString()
    };
    
    for (const connection of this.connections) {
      try {
        connection.send(JSON.stringify(update));
      } catch (error) {
        this.logger.error('Failed to send update to client', { error: error.message });
      }
    }
  }
  
  /**
   * Add WebSocket connection
   */
  addConnection(connection) {
    this.connections.add(connection);
  }
  
  /**
   * Remove WebSocket connection
   */
  removeConnection(connection) {
    this.connections.delete(connection);
  }
  
  /**
   * Get radar status
   */
  getStatus() {
    return {
      status: this.isConnected ? 'connected' : 'disconnected',
      aircraftCount: this.aircraftData.size,
      zoneCount: this.zoneData.size,
      connections: this.connections.size,
      performance: this.performance,
      sweepAngle: this.sweepAngle
    };
  }
  
  /**
   * Get metadata
   */
  static getMetadata() {
    return {
      name: 'Radar Connector',
      description: 'Comprehensive radar map interface for ADSB aircraft tracking',
      version: '1.0.0',
      author: 'Looking Glass Team',
      capabilities: [
        'radar:display',
        'aircraft:tracking',
        'zones:management',
        'filters:radar',
        'alerts:radar'
      ]
    };
  }
}

module.exports = RadarConnector; 