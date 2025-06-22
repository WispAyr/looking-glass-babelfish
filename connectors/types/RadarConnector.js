const BaseConnector = require('../BaseConnector');
const EventEmitter = require('events');

/**
 * Radar Connector
 * 
 * Provides a comprehensive radar map interface for ADSB aircraft tracking.
 * Features real-time aircraft display, zone management, coastline visualization, and advanced radar controls.
 */
class RadarConnector extends BaseConnector {
  constructor(config) {
    super({ ...config, type: 'radar' });
    this.adsbConnector = null;
    this.airportVectorService = null;
    this.coastlineVectorService = null;
    this.airspaceService = null;
    this.config = config || {};
    
    // Ensure we have a proper config structure
    const radarConfig = this.config.config || this.config || {};
    
    // Radar display configuration
    this.radarConfig = {
      range: radarConfig.range || 50, // nautical miles
      center: radarConfig.center || { lat: 51.5074, lon: -0.1278 }, // London default
      zoom: radarConfig.zoom || 10,
      rotation: radarConfig.rotation || 0, // degrees
      sweepSpeed: radarConfig.sweepSpeed || 4, // seconds per sweep
      showTrails: radarConfig.showTrails !== false,
      trailLength: radarConfig.trailLength || 20,
      showLabels: radarConfig.showLabels !== false,
      showAltitude: radarConfig.showAltitude !== false,
      showSpeed: radarConfig.showSpeed !== false,
      showHeading: radarConfig.showHeading !== false,
      showSquawk: radarConfig.showSquawk !== false,
      showEmergency: radarConfig.showEmergency !== false,
      colorByAltitude: radarConfig.colorByAltitude !== false,
      colorBySpeed: radarConfig.colorBySpeed !== false,
      colorByType: radarConfig.colorByType !== false,
      showCoastline: radarConfig.showCoastline !== false,
      coastlineColor: radarConfig.coastlineColor || '#0066cc',
      coastlineWidth: radarConfig.coastlineWidth || 2,
      coastlineOpacity: radarConfig.coastlineOpacity || 0.8
    };
    
    // Aircraft display settings
    this.aircraftDisplay = {
      symbolSize: radarConfig.symbolSize || 6,
      symbolType: radarConfig.symbolType || 'circle', // circle, triangle, square, diamond
      trailOpacity: radarConfig.trailOpacity || 0.6,
      labelFontSize: radarConfig.labelFontSize || 12,
      labelOffset: radarConfig.labelOffset || 15,
      emergencyBlink: radarConfig.emergencyBlink !== false,
      altitudeThresholds: radarConfig.altitudeThresholds || {
        low: 1000,
        medium: 10000,
        high: 30000
      },
      speedThresholds: radarConfig.speedThresholds || {
        slow: 100,
        medium: 300,
        fast: 500
      }
    };
    
    // Zone display settings
    this.zoneDisplay = {
      showZones: radarConfig.showZones !== false,
      zoneOpacity: radarConfig.zoneOpacity || 0.3,
      zoneBorderWidth: radarConfig.zoneBorderWidth || 2,
      showZoneLabels: radarConfig.showZoneLabels !== false,
      zoneLabelFontSize: radarConfig.zoneLabelFontSize || 10,
      highlightActiveZones: radarConfig.highlightActiveZones !== false
    };
    
    // Coastline display settings
    this.coastlineDisplay = {
      showCoastline: radarConfig.showCoastline !== false,
      coastlineColor: radarConfig.coastlineColor || '#0066cc',
      coastlineWidth: radarConfig.coastlineWidth || 2,
      coastlineOpacity: radarConfig.coastlineOpacity || 0.8,
      showCoastlineLabels: radarConfig.showCoastlineLabels !== false,
      coastlineLabelFontSize: radarConfig.coastlineLabelFontSize || 10
    };
    
    // Filter settings
    this.filters = {
      altitude: {
        min: radarConfig.altitudeMin || 0,
        max: radarConfig.altitudeMax || 50000,
        enabled: radarConfig.altitudeFilter !== false
      },
      speed: {
        min: radarConfig.speedMin || 0,
        max: radarConfig.speedMax || 1000,
        enabled: radarConfig.speedFilter !== false
      },
      distance: {
        max: radarConfig.distanceMax || 100,
        enabled: radarConfig.distanceFilter !== false
      },
      aircraftType: {
        types: radarConfig.aircraftTypes || [],
        enabled: radarConfig.typeFilter !== false
      },
      callsign: {
        pattern: radarConfig.callsignPattern || '',
        enabled: radarConfig.callsignFilter !== false
      },
      squawk: {
        codes: radarConfig.squawkCodes || [],
        enabled: radarConfig.squawkFilter !== false
      }
    };
    
    // Radar sweep animation
    this.sweepAngle = 0;
    this.sweepTimer = null;
    this.isSweeping = radarConfig.sweepAnimation !== false;
    
    // Aircraft data cache
    this.aircraftData = new Map();
    this.aircraftTrails = new Map();
    this.zoneData = new Map();
    this.coastlineData = new Map();
    
    // Event tracking
    this.radarEvents = [];
    this.alertEvents = [];
    
    // Performance metrics
    this.performance = {
      frameRate: 0,
      aircraftCount: 0,
      zoneCount: 0,
      coastlineSegments: 0,
      lastUpdate: null,
      updateCount: 0
    };
    
    // WebSocket connections for real-time updates
    this.connections = new Set();
    
    this.logger.info('Radar Connector initialized');
  }
  
  initialize(services) {
    this.adsbConnector = services.adsbConnector;
    this.airportVectorService = services.airportVectorService;
    this.coastlineVectorService = services.coastlineVectorService;
    this.airspaceService = services.airspaceService;
    
    // Ensure radarConfig is always initialized
    if (!this.radarConfig) {
      this.radarConfig = {
        range: 50,
        center: { lat: 51.5074, lon: -0.1278 },
        zoom: 10,
        rotation: 0,
        sweepSpeed: 4,
        showTrails: true,
        trailLength: 20,
        showLabels: true,
        showAltitude: true,
        showSpeed: true,
        showHeading: true,
        showSquawk: true,
        showEmergency: true,
        colorByAltitude: true,
        colorBySpeed: true,
        colorByType: true,
        showCoastline: true,
        coastlineColor: '#0066cc',
        coastlineWidth: 2,
        coastlineOpacity: 0.8
      };
      this.logger.info('Radar config initialized with defaults');
    }
    
    this.logger.info('Radar Connector initialized with dependencies.');
  }
  
  /**
   * Get capability definitions for this connector
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'radar:display',
        name: 'Radar Display',
        description: 'Provides a unified view of aircraft, airport, and coastline data.',
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
        id: 'coastline:management',
        name: 'Coastline Management',
        description: 'Manage and display coastline vector data',
        category: 'spatial',
        operations: ['get', 'filter', 'highlight', 'configure'],
        dataTypes: ['coastline:segment', 'coastline:display', 'coastline:stats'],
        events: ['coastline:loaded', 'coastline:updated'],
        parameters: {
          bounds: { type: 'object', required: false },
          filter: { type: 'object', required: false },
          display: { type: 'object', required: false }
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
      case 'coastline:management':
        return await this.executeCoastlineManagement(operation, parameters);
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
   * Execute coastline management operations
   */
  async executeCoastlineManagement(operation, parameters) {
    switch (operation) {
      case 'get':
        return this.getCoastlineData(parameters);
      case 'filter':
        return this.filterCoastline(parameters);
      case 'highlight':
        return this.highlightCoastline(parameters);
      case 'configure':
        return this.configureCoastline(parameters);
      default:
        throw new Error(`Unknown coastline management operation: ${operation}`);
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
      this.setStatus('connecting');
      
      // Initialize dependencies if not already done
      if (!this.adsbConnector || !this.airportVectorService || !this.coastlineVectorService) {
        throw new Error('Dependencies not initialized');
      }
      
      // Start radar sweep animation
      if (this.isSweeping) {
        this.startSweepAnimation();
      }
      
      // Initialize radar display
      await this.initializeRadarDisplay();
      
      this.setStatus('connected');
      this.logger.info('Radar Connector connected successfully');
      return true;
    } catch (error) {
      this.setStatus('error');
      this.logger.error('Failed to connect radar', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Disconnect from radar system
   */
  async performDisconnect() {
    try {
      this.setStatus('disconnecting');
      this.setStatus('disconnected');
      this.logger.info('Radar Connector disconnected');
      
      // Stop sweep animation
      if (this.sweepTimer) {
        clearInterval(this.sweepTimer);
        this.sweepTimer = null;
      }
      
      // Clear connections
      this.connections.clear();
      
      return true;
    } catch (error) {
      this.logger.error('Error disconnecting radar', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get coastline data
   */
  getCoastlineData(parameters = {}) {
    if (!this.coastlineVectorService) {
      throw new Error('Coastline vector service not available');
    }
    const { bounds, filter } = parameters;
    let segments = this.coastlineVectorService.getAllData().segments;
    // Filter by bounds if provided
    if (bounds) {
      segments = segments.filter(seg => {
        // Simple bounds check: at least one point in bounds
        return seg.points.some(pt =>
          pt.lat >= bounds.minLat && pt.lat <= bounds.maxLat &&
          pt.lon >= bounds.minLon && pt.lon <= bounds.maxLon
        );
      });
    }
    // Defensive: always return a valid bounds object
    const allBounds = this.coastlineVectorService.getAllData().bounds || {
      minLat: null, maxLat: null, minLon: null, maxLon: null, center: { lat: null, lon: null }
    };
    return { segments, bounds: allBounds };
  }
  
  /**
   * Get radar display (include coastline if enabled)
   */
  getRadarDisplay() {
    // Get aircraft data from ADSB connector if available
    let aircraft = [];
    if (this.adsbConnector && this.adsbConnector.getAircraft) {
      try {
        const aircraftResult = this.adsbConnector.getAircraft();
        if (aircraftResult && aircraftResult.aircraft) {
          aircraft = aircraftResult.aircraft;
          // Clean up aircraft data to remove circular references
          aircraft = aircraft.map(ac => ({
            icao24: ac.icao24,
            callsign: ac.callsign,
            lat: ac.lat,
            lon: ac.lon,
            altitude: ac.altitude,
            velocity: ac.velocity,
            track: ac.track,
            squawk: ac.squawk,
            emergency: ac.emergency,
            lastUpdate: ac.lastUpdate,
            // Only include essential properties, avoid circular references
            aircraftType: ac.aircraftType,
            registration: ac.registration,
            operator: ac.operator
          }));
          // Update the local aircraft data cache
          this.updateAircraftData(aircraft);
        }
      } catch (error) {
        this.logger.warn('Failed to get aircraft data from ADSB connector', { error: error.message });
        // Fall back to cached data
        aircraft = Array.from(this.aircraftData?.values?.() || []);
      }
    } else {
      // Use cached data if no ADSB connector
      aircraft = Array.from(this.aircraftData?.values?.() || []);
    }

    const display = {
      aircraft: aircraft,
      zones: Array.from(this.zoneData?.values?.() || []),
      config: this.radarConfig || {
        range: 50,
        center: { lat: 51.5074, lon: -0.1278 },
        zoom: 10,
        rotation: 0,
        sweepSpeed: 4,
        showTrails: true,
        trailLength: 20,
        showLabels: true,
        showAltitude: true,
        showSpeed: true,
        showHeading: true,
        showSquawk: true,
        showEmergency: true,
        colorByAltitude: true,
        colorBySpeed: true,
        colorByType: true,
        showCoastline: true,
        coastlineColor: '#0066cc',
        coastlineWidth: 2,
        coastlineOpacity: 0.8
      }
    };
    
    // Add airspace data if available
    if (this.airspaceService) {
      try {
        const center = this.radarConfig?.center || { lat: 51.5074, lon: -0.1278 };
        const range = this.radarConfig?.range || 50;
        const airspaces = this.airspaceService.getAirspaceForVisualization(center, range);
        // Clean up airspace data to prevent circular references
        display.airspaces = airspaces.map(airspace => ({
          id: airspace.id,
          name: airspace.name,
          type: airspace.type,
          class: airspace.class,
          floor: airspace.metadata?.floor,
          ceiling: airspace.metadata?.ceiling,
          color: airspace.color,
          bounds: airspace.bounds,
          // Only include essential polygon data
          polygons: airspace.polygons ? airspace.polygons.map(polygon => 
            polygon.map(point => ({ lat: point.lat, lon: point.lon }))
          ) : []
        }));
      } catch (error) {
        this.logger.warn('Failed to get airspace data for radar display', { error: error.message });
        display.airspaces = [];
      }
    }
    
    if (this.radarConfig?.showCoastline && this.coastlineVectorService) {
      const coastlineData = this.coastlineVectorService.getAllData();
      display.coastline = {
        enabled: true,
        segments: coastlineData.segments,
        bounds: coastlineData.bounds,
      };
    }
    return display;
  }
  
  /**
   * Configure radar display
   */
  configureRadar(parameters) {
    // Safety check - ensure radarConfig is always defined
    if (!this.radarConfig) {
      this.radarConfig = {
        range: 50,
        center: { lat: 51.5074, lon: -0.1278 },
        zoom: 10,
        rotation: 0,
        sweepSpeed: 4,
        showTrails: true,
        trailLength: 20,
        showLabels: true,
        showAltitude: true,
        showSpeed: true,
        showHeading: true,
        showSquawk: true,
        showEmergency: true,
        colorByAltitude: true,
        colorBySpeed: true,
        colorByType: true,
        showCoastline: true,
        coastlineColor: '#0066cc',
        coastlineWidth: 2,
        coastlineOpacity: 0.8
      };
      this.logger.info('Radar config initialized with defaults');
    }
    
    // Update radar configuration
    if (parameters.range !== undefined) {
      this.radarConfig.range = parameters.range;
    }
    
    if (parameters.center) {
      this.radarConfig.center = parameters.center;
    }
    
    if (parameters.displayMode) {
      this.radarConfig.displayMode = parameters.displayMode;
    }
    
    if (parameters.showTrails !== undefined) {
      this.radarConfig.showTrails = parameters.showTrails;
    }
    
    if (parameters.trailLength) {
      this.radarConfig.trailLength = parameters.trailLength;
    }
    
    if (parameters.showCoastline !== undefined) {
      this.radarConfig.showCoastline = parameters.showCoastline;
    }
    
    // Also configure ADSB connector if available
    if (this.adsbConnector && this.adsbConnector.configureRadar) {
      this.adsbConnector.configureRadar(parameters);
    }
    
    this.logger.info('Radar configuration updated', this.radarConfig);
    return { success: true, data: this.radarConfig };
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
    
    // Update coastline data
    if (parameters.coastline) {
      this.updateCoastlineData(parameters.coastline);
    }
    
    // Update performance metrics
    this.performance.lastUpdate = new Date().toISOString();
    this.performance.updateCount++;
    this.performance.aircraftCount = this.aircraftData.size;
    this.performance.zoneCount = this.zoneData.size;
    this.performance.coastlineSegments = this.coastlineData.size;
    
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
            coastline: Array.from(this.coastlineData.values()),
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
    const { zoneId } = parameters;
    
    if (!zoneId) {
      throw new Error('Zone ID is required');
    }
    
    const zone = this.zoneData.get(zoneId);
    if (!zone) {
      throw new Error(`Zone '${zoneId}' not found`);
    }
    
    return {
      zoneId,
      status: 'monitoring',
      aircraft: Array.from(this.aircraftData.values()).filter(ac => {
        return this.calculateDistance(ac.lat, ac.lon, zone.center.lat, zone.center.lon) <= zone.radius;
      })
    };
  }
  
  /**
   * Filter coastline segments
   */
  filterCoastline(parameters) {
    const { filter } = parameters;
    
    if (!filter) {
      throw new Error('Filter parameters are required');
    }
    
    const segments = this.coastlineVectorService.getAllData().segments;
    const filtered = this.applyCoastlineFilter(segments, filter);
    
    return {
      segments: filtered,
      count: filtered.length,
      filter: filter
    };
  }
  
  /**
   * Highlight coastline segments
   */
  highlightCoastline(parameters) {
    const { segmentIds, highlight = true } = parameters;
    
    if (!segmentIds || !Array.isArray(segmentIds)) {
      throw new Error('Segment IDs array is required');
    }
    
    const segments = this.coastlineVectorService.getAllData().segments;
    const highlighted = segments.filter(segment => segmentIds.includes(segment.id));
    
    // Add highlight property to segments
    highlighted.forEach(segment => {
      segment.highlighted = highlight;
    });
    
    return {
      segments: highlighted,
      highlighted: highlight,
      count: highlighted.length
    };
  }
  
  /**
   * Configure coastline display
   */
  configureCoastline(parameters) {
    const { display } = parameters;
    
    if (!display) {
      throw new Error('Display configuration is required');
    }
    
    // Update coastline display settings
    Object.assign(this.coastlineDisplay, display);
    
    return {
      display: this.coastlineDisplay,
      message: 'Coastline display configuration updated'
    };
  }
  
  /**
   * Apply coastline filter
   */
  applyCoastlineFilter(segments, filter) {
    return segments.filter(segment => {
      // Filter by segment length
      if (filter.minLength && segment.coordinates.length < filter.minLength) {
        return false;
      }
      if (filter.maxLength && segment.coordinates.length > filter.maxLength) {
        return false;
      }
      
      // Filter by bounds
      if (filter.bounds && segment.bounds) {
        if (!this.boundsIntersect(segment.bounds, filter.bounds)) {
          return false;
        }
      }
      
      // Filter by distance from point
      if (filter.nearPoint && filter.radius) {
        const nearSegment = this.coastlineVectorService.getSegmentsNearPoint(
          filter.nearPoint, 
          filter.radius
        );
        if (!nearSegment.find(s => s.id === segment.id)) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Check if two bounds intersect
   */
  boundsIntersect(bounds1, bounds2) {
    return !(bounds1.maxLat < bounds2.minLat ||
             bounds1.minLat > bounds2.maxLat ||
             bounds1.maxLon < bounds2.minLon ||
             bounds1.minLon > bounds2.maxLon);
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
   * Update coastline data
   */
  updateCoastlineData(coastline) {
    for (const segment of coastline) {
      this.coastlineData.set(segment.id, segment);
    }
  }
  
  /**
   * Apply aircraft filter
   */
  applyAircraftFilter(aircraft, filter) {
    // Simple filter implementation
    if (!filter) return aircraft;
    
    return aircraft.filter(ac => {
      if (filter.icao24 && ac.icao24 !== filter.icao24) return false;
      if (filter.callsign && ac.callsign !== filter.callsign) return false;
      if (filter.emergency && !ac.emergency) return false;
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
      connected: true,
      aircraftCount: this.aircraftData ? this.aircraftData.length : 0,
      zoneCount: this.zoneData ? this.zoneData.length : 0,
      coastlineSegments: this.coastlineData ? this.coastlineData.length : 0
    };
  }
  
  /**
   * Get metadata
   */
  static getMetadata() {
    return {
      name: 'Radar Connector',
      version: '1.0.0',
      description: 'Comprehensive radar display for ADSB aircraft tracking',
      author: 'Babelfish Team',
      capabilities: [
        'radar:display',
        'aircraft:tracking', 
        'zones:management',
        'coastline:management',
        'filters:radar',
        'alerts:radar'
      ]
    };
  }
}

module.exports = RadarConnector; 