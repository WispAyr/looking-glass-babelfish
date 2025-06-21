const BaseConnector = require('../BaseConnector');
const axios = require('axios');
const EventEmitter = require('events');

/**
 * ADSB Connector for dump1090
 * 
 * Connects to dump1090 ADS-B receiver and provides aircraft tracking,
 * zone monitoring, and radar display capabilities. Supports real-time
 * aircraft data, emergency priority handling, and spatial zone management.
 */
class ADSBConnector extends BaseConnector {
  constructor(config) {
    // Ensure type is set for BaseConnector
    const connectorConfig = {
      ...config,
      type: 'adsb'
    };
    
    super(connectorConfig);
    
    // ADSB-specific properties
    this.dump1090Url = config.config?.url || 'http://10.0.1.180/skyaware/data/aircraft.json';
    this.pollInterval = config.config?.pollInterval || 5000; // 5 seconds
    this.emergencyCodes = config.config?.emergencyCodes || ['7500', '7600', '7700'];
    this.maxAircraftAge = config.config?.maxAircraftAge || 300000; // 5 minutes
    
    // Aircraft data management
    this.aircraft = new Map(); // Current aircraft
    this.aircraftHistory = new Map(); // Historical data
    this.recentChanges = []; // Recent changes for events
    this.appearances = []; // New aircraft appearances
    this.disappearances = []; // Aircraft disappearances
    
    // Zone management
    this.zones = new Map();
    this.zoneTypes = {
      'parking': { name: 'Parking Stands', color: '#FFD700', priority: 'low' },
      'taxiway': { name: 'Taxiways', color: '#FFA500', priority: 'medium' },
      'runway': { name: 'Runways', color: '#FF0000', priority: 'high' },
      'approach': { name: 'Approach Paths', color: '#00FF00', priority: 'high' },
      'departure': { name: 'Departure Paths', color: '#0000FF', priority: 'high' },
      'emergency': { name: 'Emergency Areas', color: '#FF00FF', priority: 'critical' },
      'custom': { name: 'Custom Zones', color: '#808080', priority: 'medium' }
    };
    
    // Radar display settings
    this.radarConfig = {
      range: config.config?.radarRange || 50, // nautical miles
      center: config.config?.radarCenter || { lat: 0, lon: 0 },
      displayMode: config.config?.displayMode || 'all', // all, filtered, emergency
      showTrails: config.config?.showTrails || true,
      trailLength: config.config?.trailLength || 10
    };
    
    // Event tracking
    this.events = [];
    this.emergencyEvents = [];
    
    // Performance tracking
    this.performance = {
      lastPoll: null,
      pollCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      aircraftCount: 0,
      zoneViolations: 0
    };
    
    // Polling control
    this.pollTimer = null;
    this.isPolling = false;
    
    // Spatial calculations
    this.spatialUtils = {
      // Convert degrees to radians
      toRadians: (degrees) => degrees * (Math.PI / 180),
      
      // Calculate distance between two points (nautical miles)
      calculateDistance: (lat1, lon1, lat2, lon2) => {
        const R = 3440.065; // Earth's radius in nautical miles
        const dLat = this.spatialUtils.toRadians(lat2 - lat1);
        const dLon = this.spatialUtils.toRadians(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.spatialUtils.toRadians(lat1)) * Math.cos(this.spatialUtils.toRadians(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      },
      
      // Check if point is in polygon (zone)
      pointInPolygon: (point, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          if (((polygon[i].lat > point.lat) !== (polygon[j].lat > point.lat)) &&
              (point.lon < (polygon[j].lon - polygon[i].lon) * (point.lat - polygon[i].lat) / (polygon[j].lat - polygon[i].lat) + polygon[i].lon)) {
            inside = !inside;
          }
        }
        return inside;
      },
      
      // Calculate bearing between two points
      calculateBearing: (lat1, lon1, lat2, lon2) => {
        const dLon = this.spatialUtils.toRadians(lon2 - lon1);
        const lat1Rad = this.spatialUtils.toRadians(lat1);
        const lat2Rad = this.spatialUtils.toRadians(lat2);
        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      }
    };
    
    this.logger.info('ADSB Connector initialized', {
      id: this.id,
      dump1090Url: this.dump1090Url,
      pollInterval: this.pollInterval,
      radarRange: this.radarConfig.range
    });
  }

  /**
   * Get capability definitions for this connector
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'aircraft:tracking',
        name: 'Aircraft Tracking',
        description: 'Track aircraft positions, movements, and status',
        category: 'tracking',
        operations: ['get', 'subscribe', 'filter', 'history'],
        dataTypes: ['aircraft:current', 'aircraft:history', 'aircraft:changes'],
        events: ['aircraft:appeared', 'aircraft:disappeared', 'aircraft:moved', 'aircraft:emergency'],
        parameters: {
          icao24: { type: 'string', required: false },
          callsign: { type: 'string', required: false },
          filter: { type: 'object', required: false }
        }
      },
      {
        id: 'zones:management',
        name: 'Zone Management',
        description: 'Define and manage spatial zones for aircraft monitoring',
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
        id: 'radar:display',
        name: 'Radar Display',
        description: 'Real-time radar display of aircraft positions',
        category: 'visualization',
        operations: ['get', 'configure', 'filter', 'export'],
        dataTypes: ['radar:display', 'radar:trails', 'radar:alerts'],
        events: ['radar:update', 'radar:alert', 'radar:emergency'],
        parameters: {
          range: { type: 'number', required: false },
          center: { type: 'object', required: false },
          filter: { type: 'object', required: false }
        }
      },
      {
        id: 'events:smart',
        name: 'Smart Events',
        description: 'Generate intelligent events based on aircraft behavior and zones',
        category: 'intelligence',
        operations: ['generate', 'configure', 'list', 'subscribe'],
        dataTypes: ['event:smart', 'event:pattern', 'event:rule'],
        events: ['event:generated', 'event:pattern:detected', 'event:rule:triggered'],
        parameters: {
          eventType: { type: 'string', required: false },
          pattern: { type: 'object', required: false },
          rule: { type: 'object', required: false }
        }
      },
      {
        id: 'emergency:monitoring',
        name: 'Emergency Monitoring',
        description: 'Monitor and handle emergency situations',
        category: 'safety',
        operations: ['monitor', 'alert', 'log', 'escalate'],
        dataTypes: ['emergency:status', 'emergency:alert', 'emergency:log'],
        events: ['emergency:detected', 'emergency:cleared', 'emergency:escalated'],
        parameters: {
          emergencyCode: { type: 'string', required: false },
          priority: { type: 'string', required: false },
          action: { type: 'string', required: false }
        }
      }
    ];
  }

  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    try {
      let result;
      switch (capabilityId) {
        case 'aircraft:tracking':
          result = await this.executeAircraftTracking(operation, parameters);
          break;
        case 'zones:management':
          result = await this.executeZoneManagement(operation, parameters);
          break;
        case 'radar:display':
          result = await this.executeRadarDisplay(operation, parameters);
          break;
        case 'events:smart':
          result = await this.executeSmartEvents(operation, parameters);
          break;
        case 'emergency:monitoring':
          result = await this.executeEmergencyMonitoring(operation, parameters);
          break;
        default:
          throw new Error(`Unknown capability: ${capabilityId}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Capability execution failed: ${capabilityId}.${operation}`, error);
      throw error;
    }
  }

  /**
   * Execute aircraft tracking operations
   */
  async executeAircraftTracking(operation, parameters) {
    switch (operation) {
      case 'get':
        return this.getAircraft(parameters);
      case 'subscribe':
        return this.subscribeToAircraftUpdates(parameters);
      case 'filter':
        return this.filterAircraft(parameters);
      case 'history':
        return this.getAircraftHistory(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
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
        throw new Error(`Unknown operation: ${operation}`);
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
      case 'filter':
        return this.filterRadarData(parameters);
      case 'export':
        return this.exportRadarData(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute smart events operations
   */
  async executeSmartEvents(operation, parameters) {
    switch (operation) {
      case 'generate':
        return this.generateSmartEvent(parameters);
      case 'configure':
        return this.configureSmartEvents(parameters);
      case 'list':
        return this.listSmartEvents(parameters);
      case 'subscribe':
        return this.subscribeToSmartEvents(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute emergency monitoring operations
   */
  async executeEmergencyMonitoring(operation, parameters) {
    switch (operation) {
      case 'monitor':
        return this.monitorEmergencies(parameters);
      case 'alert':
        return this.sendEmergencyAlert(parameters);
      case 'log':
        return this.logEmergency(parameters);
      case 'escalate':
        return this.escalateEmergency(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Connect to dump1090
   */
  async performConnect() {
    try {
      this.logger.info('Connecting to dump1090...', { url: this.dump1090Url });
      
      // Test connection
      const response = await axios.get(this.dump1090Url, { timeout: 5000 });
      
      if (response.status === 200) {
        this.logger.info('Successfully connected to dump1090');
        this.startPolling();
        return true;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error('Failed to connect to dump1090', error);
      throw error;
    }
  }

  /**
   * Disconnect from dump1090
   */
  async performDisconnect() {
    this.stopPolling();
    this.logger.info('Disconnected from dump1090');
    return true;
  }

  /**
   * Start polling for aircraft data
   */
  startPolling() {
    if (this.isPolling) {
      return;
    }
    
    this.isPolling = true;
    this.pollAircraftData();
    
    this.logger.info('Started aircraft data polling', { interval: this.pollInterval });
  }

  /**
   * Stop polling for aircraft data
   */
  stopPolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
    this.logger.info('Stopped aircraft data polling');
  }

  /**
   * Poll aircraft data from dump1090
   */
  async pollAircraftData() {
    if (!this.isPolling) {
      return;
    }

    const startTime = Date.now();
    
    try {
      const response = await axios.get(this.dump1090Url, { timeout: 10000 });
      
      if (response.status === 200 && response.data) {
        await this.processAircraftData(response.data);
        
        // Update performance metrics
        const responseTime = Date.now() - startTime;
        this.performance.averageResponseTime = 
          (this.performance.averageResponseTime * this.performance.pollCount + responseTime) / 
          (this.performance.pollCount + 1);
        this.performance.pollCount++;
        this.performance.lastPoll = new Date().toISOString();
        this.performance.aircraftCount = this.aircraft.size;
        
        this.logger.debug('Aircraft data polled successfully', {
          aircraftCount: this.aircraft.size,
          responseTime: `${responseTime}ms`
        });
      }
    } catch (error) {
      this.performance.errorCount++;
      this.logger.error('Failed to poll aircraft data', error);
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.pollAircraftData(), this.pollInterval);
  }

  /**
   * Process aircraft data from dump1090
   */
  async processAircraftData(data) {
    const now = Date.now();
    const newAircraft = new Map();
    const currentIcao24s = new Set();
    
    // Process each aircraft
    if (data.aircraft && Array.isArray(data.aircraft)) {
      for (const aircraftData of data.aircraft) {
        if (!aircraftData.hex) continue;
        
        const icao24 = aircraftData.hex.toUpperCase();
        currentIcao24s.add(icao24);
        
        // Create aircraft object
        const aircraft = {
          icao24: icao24,
          callsign: aircraftData.flight?.trim() || null,
          lat: aircraftData.lat || null,
          lon: aircraftData.lon || null,
          altitude: aircraftData.alt_baro || aircraftData.alt_geom || null,
          speed: aircraftData.gs || null,
          track: aircraftData.track || null,
          vertical_rate: aircraftData.baro_rate || null,
          squawk: aircraftData.squawk || null,
          emergency: aircraftData.squawk ? this.emergencyCodes.includes(aircraftData.squawk) : false,
          timestamp: now,
          last_seen: aircraftData.last_seen || now,
          messages: aircraftData.messages || 0,
          seen: aircraftData.seen || 0,
          rssi: aircraftData.rssi || null
        };
        
        // Check if this is a new aircraft
        const existingAircraft = this.aircraft.get(icao24);
        if (!existingAircraft) {
          // New aircraft appeared
          this.handleAircraftAppearance(aircraft);
        } else {
          // Update existing aircraft
          this.handleAircraftUpdate(existingAircraft, aircraft);
        }
        
        newAircraft.set(icao24, aircraft);
      }
    }
    
    // Check for disappeared aircraft
    for (const [icao24, aircraft] of this.aircraft) {
      if (!currentIcao24s.has(icao24)) {
        this.handleAircraftDisappearance(aircraft);
      }
    }
    
    // Update aircraft map
    this.aircraft = newAircraft;
    
    // Check zones
    await this.checkZones();
    
    // Generate smart events
    await this.generateSmartEvents();
    
    // Emit update event
    this.emit('aircraft:updated', {
      count: this.aircraft.size,
      timestamp: now,
      changes: this.recentChanges.length
    });
    
    // Clear recent changes after processing
    this.recentChanges = [];
  }

  /**
   * Handle aircraft appearance
   */
  handleAircraftAppearance(aircraft) {
    this.appearances.push({
      ...aircraft,
      appeared_at: new Date().toISOString()
    });
    
    // Keep only recent appearances
    if (this.appearances.length > 100) {
      this.appearances = this.appearances.slice(-100);
    }
    
    this.recentChanges.push({
      type: 'appearance',
      aircraft: aircraft,
      timestamp: new Date().toISOString()
    });
    
    this.emit('aircraft:appeared', aircraft);
    
    this.logger.info('Aircraft appeared', {
      icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      lat: aircraft.lat,
      lon: aircraft.lon
    });
  }

  /**
   * Handle aircraft update
   */
  handleAircraftUpdate(oldAircraft, newAircraft) {
    const changes = {};
    
    // Check for significant changes
    if (newAircraft.lat !== oldAircraft.lat || newAircraft.lon !== oldAircraft.lon) {
      changes.position = {
        old: { lat: oldAircraft.lat, lon: oldAircraft.lon },
        new: { lat: newAircraft.lat, lon: newAircraft.lon }
      };
    }
    
    if (newAircraft.altitude !== oldAircraft.altitude) {
      changes.altitude = { old: oldAircraft.altitude, new: newAircraft.altitude };
    }
    
    if (newAircraft.speed !== oldAircraft.speed) {
      changes.speed = { old: oldAircraft.speed, new: newAircraft.speed };
    }
    
    if (newAircraft.emergency !== oldAircraft.emergency) {
      changes.emergency = { old: oldAircraft.emergency, new: newAircraft.emergency };
      
      if (newAircraft.emergency) {
        this.handleEmergency(newAircraft);
      }
    }
    
    if (Object.keys(changes).length > 0) {
      this.recentChanges.push({
        type: 'update',
        aircraft: newAircraft,
        changes: changes,
        timestamp: new Date().toISOString()
      });
      
      this.emit('aircraft:moved', { aircraft: newAircraft, changes: changes });
    }
  }

  /**
   * Handle aircraft disappearance
   */
  handleAircraftDisappearance(aircraft) {
    this.disappearances.push({
      ...aircraft,
      disappeared_at: new Date().toISOString()
    });
    
    // Keep only recent disappearances
    if (this.disappearances.length > 100) {
      this.disappearances = this.disappearances.slice(-100);
    }
    
    this.recentChanges.push({
      type: 'disappearance',
      aircraft: aircraft,
      timestamp: new Date().toISOString()
    });
    
    this.emit('aircraft:disappeared', aircraft);
    
    this.logger.info('Aircraft disappeared', {
      icao24: aircraft.icao24,
      callsign: aircraft.callsign
    });
  }

  /**
   * Handle emergency situation
   */
  handleEmergency(aircraft) {
    const emergencyEvent = {
      id: `emergency_${aircraft.icao24}_${Date.now()}`,
      aircraft: aircraft,
      squawk: aircraft.squawk,
      timestamp: new Date().toISOString(),
      priority: 'critical',
      status: 'active'
    };
    
    this.emergencyEvents.push(emergencyEvent);
    
    // Keep only recent emergency events
    if (this.emergencyEvents.length > 50) {
      this.emergencyEvents = this.emergencyEvents.slice(-50);
    }
    
    this.emit('aircraft:emergency', emergencyEvent);
    
    this.logger.warn('Emergency detected', {
      icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      squawk: aircraft.squawk
    });
  }

  /**
   * Get aircraft data
   */
  getAircraft(parameters = {}) {
    let aircraft = Array.from(this.aircraft.values());
    
    // Apply filters
    if (parameters.icao24) {
      aircraft = aircraft.filter(a => a.icao24 === parameters.icao24.toUpperCase());
    }
    
    if (parameters.callsign) {
      aircraft = aircraft.filter(a => a.callsign && a.callsign.includes(parameters.callsign.toUpperCase()));
    }
    
    if (parameters.filter) {
      aircraft = aircraft.filter(a => this.applyFilter(a, parameters.filter));
    }
    
    return {
      aircraft: aircraft,
      count: aircraft.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Apply filter to aircraft
   */
  applyFilter(aircraft, filter) {
    for (const [key, value] of Object.entries(filter)) {
      switch (key) {
        case 'emergency':
          if (aircraft.emergency !== value) return false;
          break;
        case 'min_altitude':
          if (aircraft.altitude && aircraft.altitude < value) return false;
          break;
        case 'max_altitude':
          if (aircraft.altitude && aircraft.altitude > value) return false;
          break;
        case 'min_speed':
          if (aircraft.speed && aircraft.speed < value) return false;
          break;
        case 'max_speed':
          if (aircraft.speed && aircraft.speed > value) return false;
          break;
        case 'within_range':
          if (value.center && value.range) {
            const distance = this.spatialUtils.calculateDistance(
              value.center.lat, value.center.lon,
              aircraft.lat, aircraft.lon
            );
            if (distance > value.range) return false;
          }
          break;
      }
    }
    return true;
  }

  /**
   * Get aircraft history
   */
  getAircraftHistory(parameters = {}) {
    const icao24 = parameters.icao24?.toUpperCase();
    if (!icao24) {
      throw new Error('ICAO24 is required for history lookup');
    }
    
    return this.aircraftHistory.get(icao24) || [];
  }

  /**
   * Create a zone
   */
  createZone(parameters) {
    const zoneId = parameters.zoneId || `zone_${Date.now()}`;
    const zoneType = parameters.zoneType || 'custom';
    
    if (!parameters.coordinates || !Array.isArray(parameters.coordinates)) {
      throw new Error('Zone coordinates are required');
    }
    
    const zone = {
      id: zoneId,
      name: parameters.name || `Zone ${zoneId}`,
      type: zoneType,
      coordinates: parameters.coordinates,
      properties: parameters.properties || {},
      created: new Date().toISOString(),
      active: true,
      violations: []
    };
    
    this.zones.set(zoneId, zone);
    
    this.emit('zone:created', zone);
    
    this.logger.info('Zone created', {
      zoneId: zoneId,
      type: zoneType,
      coordinates: parameters.coordinates.length
    });
    
    return zone;
  }

  /**
   * Update a zone
   */
  updateZone(parameters) {
    const zoneId = parameters.zoneId;
    if (!zoneId) {
      throw new Error('Zone ID is required');
    }
    
    const zone = this.zones.get(zoneId);
    if (!zone) {
      throw new Error(`Zone not found: ${zoneId}`);
    }
    
    // Update zone properties
    if (parameters.name) zone.name = parameters.name;
    if (parameters.coordinates) zone.coordinates = parameters.coordinates;
    if (parameters.properties) zone.properties = { ...zone.properties, ...parameters.properties };
    if (parameters.active !== undefined) zone.active = parameters.active;
    
    zone.updated = new Date().toISOString();
    
    this.emit('zone:updated', zone);
    
    this.logger.info('Zone updated', { zoneId: zoneId });
    
    return zone;
  }

  /**
   * Delete a zone
   */
  deleteZone(parameters) {
    const zoneId = parameters.zoneId;
    if (!zoneId) {
      throw new Error('Zone ID is required');
    }
    
    const zone = this.zones.get(zoneId);
    if (!zone) {
      throw new Error(`Zone not found: ${zoneId}`);
    }
    
    this.zones.delete(zoneId);
    
    this.emit('zone:deleted', zone);
    
    this.logger.info('Zone deleted', { zoneId: zoneId });
    
    return { success: true, zoneId: zoneId };
  }

  /**
   * List zones
   */
  listZones(parameters = {}) {
    let zones = Array.from(this.zones.values());
    
    if (parameters.type) {
      zones = zones.filter(z => z.type === parameters.type);
    }
    
    if (parameters.active !== undefined) {
      zones = zones.filter(z => z.active === parameters.active);
    }
    
    return {
      zones: zones,
      count: zones.length,
      types: Object.keys(this.zoneTypes)
    };
  }

  /**
   * Check aircraft against zones
   */
  async checkZones() {
    for (const [zoneId, zone] of this.zones) {
      if (!zone.active) continue;
      
      for (const [icao24, aircraft] of this.aircraft) {
        if (!aircraft.lat || !aircraft.lon) continue;
        
        const isInZone = this.spatialUtils.pointInPolygon(
          { lat: aircraft.lat, lon: aircraft.lon },
          zone.coordinates
        );
        
        const wasInZone = zone.violations.some(v => 
          v.icao24 === icao24 && v.status === 'active'
        );
        
        if (isInZone && !wasInZone) {
          // Aircraft entered zone
          const violation = {
            id: `violation_${zoneId}_${icao24}_${Date.now()}`,
            zoneId: zoneId,
            zoneName: zone.name,
            zoneType: zone.type,
            icao24: icao24,
            aircraft: aircraft,
            timestamp: new Date().toISOString(),
            status: 'active'
          };
          
          zone.violations.push(violation);
          this.performance.zoneViolations++;
          
          this.emit('zone:entered', violation);
          
          this.logger.info('Aircraft entered zone', {
            zoneId: zoneId,
            zoneName: zone.name,
            icao24: icao24,
            callsign: aircraft.callsign
          });
        } else if (!isInZone && wasInZone) {
          // Aircraft exited zone
          const violation = zone.violations.find(v => 
            v.icao24 === icao24 && v.status === 'active'
          );
          
          if (violation) {
            violation.status = 'resolved';
            violation.resolved_at = new Date().toISOString();
            
            this.emit('zone:exited', violation);
            
            this.logger.info('Aircraft exited zone', {
              zoneId: zoneId,
              zoneName: zone.name,
              icao24: icao24,
              callsign: aircraft.callsign
            });
          }
        }
      }
      
      // Clean up old violations
      zone.violations = zone.violations.filter(v => 
        v.status === 'active' || 
        (new Date() - new Date(v.timestamp)) < 24 * 60 * 60 * 1000 // Keep for 24 hours
      );
    }
  }

  /**
   * Get radar display data
   */
  getRadarDisplay(parameters = {}) {
    const range = parameters.range || this.radarConfig.range;
    const center = parameters.center || this.radarConfig.center;
    const filter = parameters.filter || {};
    
    let aircraft = Array.from(this.aircraft.values());
    
    // Filter by range if center is specified
    if (center.lat && center.lon) {
      aircraft = aircraft.filter(a => {
        if (!a.lat || !a.lon) return false;
        const distance = this.spatialUtils.calculateDistance(
          center.lat, center.lon, a.lat, a.lon
        );
        return distance <= range;
      });
    }
    
    // Apply additional filters
    if (filter.emergency !== undefined) {
      aircraft = aircraft.filter(a => a.emergency === filter.emergency);
    }
    
    if (filter.min_altitude !== undefined) {
      aircraft = aircraft.filter(a => a.altitude && a.altitude >= filter.min_altitude);
    }
    
    if (filter.max_altitude !== undefined) {
      aircraft = aircraft.filter(a => a.altitude && a.altitude <= filter.max_altitude);
    }
    
    // Add calculated fields for display
    const displayAircraft = aircraft.map(a => ({
      ...a,
      distance: center.lat && center.lon ? 
        this.spatialUtils.calculateDistance(center.lat, center.lon, a.lat, a.lon) : null,
      bearing: center.lat && center.lon ? 
        this.spatialUtils.calculateBearing(center.lat, center.lon, a.lat, a.lon) : null
    }));
    
    return {
      aircraft: displayAircraft,
      count: displayAircraft.length,
      range: range,
      center: center,
      timestamp: new Date().toISOString(),
      config: this.radarConfig
    };
  }

  /**
   * Configure radar display
   */
  configureRadar(parameters) {
    if (parameters.range !== undefined) {
      this.radarConfig.range = parameters.range;
    }
    
    if (parameters.center !== undefined) {
      this.radarConfig.center = parameters.center;
    }
    
    if (parameters.displayMode !== undefined) {
      this.radarConfig.displayMode = parameters.displayMode;
    }
    
    if (parameters.showTrails !== undefined) {
      this.radarConfig.showTrails = parameters.showTrails;
    }
    
    if (parameters.trailLength !== undefined) {
      this.radarConfig.trailLength = parameters.trailLength;
    }
    
    this.logger.info('Radar configuration updated', this.radarConfig);
    
    return this.radarConfig;
  }

  /**
   * Generate smart events
   */
  async generateSmartEvents() {
    const events = [];
    
    // Check for patterns in aircraft behavior
    for (const [icao24, aircraft] of this.aircraft) {
      // Low altitude alert
      if (aircraft.altitude && aircraft.altitude < 1000) {
        events.push({
          type: 'low_altitude',
          aircraft: aircraft,
          priority: 'medium',
          timestamp: new Date().toISOString()
        });
      }
      
      // High speed alert
      if (aircraft.speed && aircraft.speed > 500) {
        events.push({
          type: 'high_speed',
          aircraft: aircraft,
          priority: 'medium',
          timestamp: new Date().toISOString()
        });
      }
      
      // Rapid descent
      if (aircraft.vertical_rate && aircraft.vertical_rate < -2000) {
        events.push({
          type: 'rapid_descent',
          aircraft: aircraft,
          priority: 'high',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Add events to history
    this.events.push(...events);
    
    // Keep only recent events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
    
    // Emit events
    for (const event of events) {
      this.emit('event:generated', event);
    }
    
    return events;
  }

  /**
   * Get smart events
   */
  listSmartEvents(parameters = {}) {
    let events = [...this.events];
    
    if (parameters.type) {
      events = events.filter(e => e.type === parameters.type);
    }
    
    if (parameters.priority) {
      events = events.filter(e => e.priority === parameters.priority);
    }
    
    if (parameters.since) {
      const since = new Date(parameters.since);
      events = events.filter(e => new Date(e.timestamp) >= since);
    }
    
    return {
      events: events,
      count: events.length,
      types: [...new Set(events.map(e => e.type))],
      priorities: [...new Set(events.map(e => e.priority))]
    };
  }

  /**
   * Get emergency events
   */
  getEmergencyEvents(parameters = {}) {
    let events = [...this.emergencyEvents];
    
    if (parameters.status) {
      events = events.filter(e => e.status === parameters.status);
    }
    
    if (parameters.since) {
      const since = new Date(parameters.since);
      events = events.filter(e => new Date(e.timestamp) >= since);
    }
    
    return {
      events: events,
      count: events.length,
      active: events.filter(e => e.status === 'active').length
    };
  }

  /**
   * Get connector statistics
   */
  getStats() {
    return {
      ...this.stats,
      performance: this.performance,
      aircraft: {
        current: this.aircraft.size,
        appearances: this.appearances.length,
        disappearances: this.disappearances.length,
        changes: this.recentChanges.length
      },
      zones: {
        total: this.zones.size,
        active: Array.from(this.zones.values()).filter(z => z.active).length,
        violations: this.performance.zoneViolations
      },
      events: {
        total: this.events.length,
        emergency: this.emergencyEvents.length,
        recent: this.events.slice(-10)
      }
    };
  }

  /**
   * Validate configuration
   */
  static validateConfig(config) {
    const errors = [];
    
    if (!config.config?.url) {
      errors.push('dump1090 URL is required');
    }
    
    if (config.config?.pollInterval && config.config.pollInterval < 1000) {
      errors.push('Poll interval must be at least 1000ms');
    }
    
    if (config.config?.radarRange && config.config.radarRange <= 0) {
      errors.push('Radar range must be positive');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      name: 'ADSB Connector',
      description: 'Connector for dump1090 ADS-B receiver with aircraft tracking, zone monitoring, and radar display',
      version: '1.0.0',
      author: 'Babelfish Looking Glass',
      capabilities: [
        'Aircraft tracking and monitoring',
        'Spatial zone management',
        'Real-time radar display',
        'Smart event generation',
        'Emergency situation monitoring'
      ],
      configuration: {
        url: 'dump1090 URL (required)',
        pollInterval: 'Polling interval in milliseconds (default: 5000)',
        emergencyCodes: 'Array of emergency squawk codes (default: ["7500", "7600", "7700"])',
        radarRange: 'Radar display range in nautical miles (default: 50)',
        radarCenter: 'Radar center coordinates {lat, lon}'
      }
    };
  }
}

module.exports = ADSBConnector; 