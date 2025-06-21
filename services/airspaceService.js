const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

/**
 * Airspace Service for UK Airspace Data Integration
 * 
 * Parses and manages UK airspace data from BaseStation format files.
 * Provides airspace awareness, classification, and event generation
 * for aircraft tracking and radar visualization.
 */
class AirspaceService {
  constructor(config = {}) {
    this.logger = winston.createLogger({
      level: config.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'airspace-service' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });

    // Configuration
    this.airspaceDataPath = config.airspaceDataPath || path.join(__dirname, '../aviationdata/OUT_UK_Airspace');
    this.enableAirspaceAwareness = config.enableAirspaceAwareness !== false; // Default to true
    this.airspaceTypes = config.airspaceTypes || ['FA', 'ATZ', 'CTA', 'CTR', 'DA', 'FIR', 'LARS', 'MIL'];
    
    // Airspace data storage
    this.airspaces = new Map(); // All airspace definitions
    this.airspaceIndex = new Map(); // Spatial index for quick lookup
    this.airspaceTypeCollections = new Map(); // Type-specific collections
    
    // Aircraft airspace tracking
    this.aircraftAirspace = new Map(); // Current airspace for each aircraft
    this.airspaceHistory = new Map(); // Historical airspace entries/exits
    
    // Event generation
    this.events = [];
    this.eventCallbacks = [];
    
    // Performance tracking
    this.performance = {
      loadTime: 0,
      parseTime: 0,
      queryCount: 0,
      cacheHits: 0,
      airspaceCount: 0
    };

    this.logger.info('Airspace Service initialized', {
      airspaceDataPath: this.airspaceDataPath,
      enableAirspaceAwareness: this.enableAirspaceAwareness,
      airspaceTypes: this.airspaceTypes
    });
  }

  /**
   * Initialize the airspace service
   */
  async initialize() {
    if (!this.enableAirspaceAwareness) {
      this.logger.info('Airspace awareness disabled');
      return;
    }

    try {
      this.logger.info('Loading airspace data...');
      const startTime = Date.now();
      
      await this.loadAirspaceData();
      await this.buildSpatialIndex();
      
      this.performance.loadTime = Date.now() - startTime;
      
      this.logger.info('Airspace service initialized successfully', {
        airspaceCount: this.airspaces.size,
        loadTime: this.performance.loadTime,
        types: Array.from(this.airspaceTypeCollections.keys())
      });
    } catch (error) {
      this.logger.error('Failed to initialize airspace service', { error: error.message });
      throw error;
    }
  }

  /**
   * Load all airspace data files
   */
  async loadAirspaceData() {
    try {
      const files = await fs.readdir(this.airspaceDataPath);
      const outFiles = files.filter(file => file.endsWith('.out'));
      
      this.logger.info(`Found ${outFiles.length} airspace files`);
      
      for (const file of outFiles) {
        await this.parseAirspaceFile(file);
      }
      
      // Also load VATSIM holding patterns
      const vatsimPath = path.join(this.airspaceDataPath, 'VATSIM');
      try {
        const vatsimFiles = await fs.readdir(vatsimPath);
        const holdFiles = vatsimFiles.filter(file => file.endsWith('.out'));
        
        for (const file of holdFiles) {
          await this.parseAirspaceFile(file, 'VATSIM');
        }
      } catch (error) {
        this.logger.warn('VATSIM directory not found or accessible', { error: error.message });
      }
      
    } catch (error) {
      this.logger.error('Failed to load airspace data', { error: error.message });
      throw error;
    }
  }

  /**
   * Parse a single airspace file
   */
  async parseAirspaceFile(filename, subdirectory = '') {
    try {
      const filePath = path.join(this.airspaceDataPath, subdirectory, filename);
      const content = await fs.readFile(filePath, 'utf8');
      
      const airspaceType = this.determineAirspaceType(filename);
      const airspaceData = this.parseBaseStationFormat(content, filename);
      
      if (airspaceData.length > 0) {
        // Store by type
        if (!this.airspaceTypeCollections.has(airspaceType)) {
          this.airspaceTypeCollections.set(airspaceType, []);
        }
        this.airspaceTypeCollections.get(airspaceType).push(...airspaceData);
        
        // Store individually
        airspaceData.forEach(airspace => {
          this.airspaces.set(airspace.id, airspace);
        });
        
        this.logger.debug(`Parsed ${airspaceData.length} airspace elements from ${filename}`, {
          type: airspaceType,
          filename
        });
      }
      
    } catch (error) {
      this.logger.error(`Failed to parse airspace file ${filename}`, { error: error.message });
    }
  }

  /**
   * Determine airspace type from filename
   */
  determineAirspaceType(filename) {
    if (filename.startsWith('UK_FA')) return 'Final_Approach';
    if (filename.startsWith('UK_FA20')) return 'Final_Approach_20nm';
    if (filename.startsWith('UK_AWY_L')) return 'Airway_Lower';
    if (filename.startsWith('UK_AWY_U')) return 'Airway_Upper';
    if (filename.startsWith('UK_ATZ')) return 'ATZ';
    if (filename.startsWith('UK_CTA')) return 'CTA';
    if (filename.startsWith('UK_TMA')) return 'TMA';
    if (filename.startsWith('UK_CTR')) return 'CTR';
    if (filename.startsWith('UK_DA')) return 'Danger_Area';
    if (filename.startsWith('UK_FIR')) return 'FIR';
    if (filename.startsWith('UK_LARS')) return 'LARS';
    if (filename.startsWith('UK_MIL')) return 'Military';
    if (filename.startsWith('UK_VOR')) return 'VOR';
    if (filename.startsWith('UK_HOLD')) return 'Holding_Pattern';
    
    return 'Unknown';
  }

  /**
   * Parse BaseStation format airspace data
   */
  parseBaseStationFormat(content, filename) {
    const airspaces = [];
    const lines = content.split('\n');
    
    let currentAirspace = null;
    let currentPolygon = [];
    let type = 5; // Default type
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith(';') || trimmedLine === '') {
        continue; // Comment or empty line
      }
      
      if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
        if (currentAirspace && currentPolygon.length > 0) {
          currentAirspace.polygons.push(currentPolygon);
          airspaces.push(currentAirspace);
          this.logger.debug(`Pushed airspace: ${currentAirspace.name} with ${currentAirspace.polygons.length} polygons`);
        }
        const name = trimmedLine.slice(1, -1);
        currentAirspace = {
          id: `${filename}_${name}`,
          name: name,
          type: this.determineAirspaceType(filename),
          filename: filename,
          polygons: [],
          metadata: {}
        };
        currentPolygon = [];
        type = 5; // Reset type
        this.logger.debug(`Started new airspace: ${name}`);
      }
      else if (trimmedLine.startsWith('$TYPE=')) {
        type = parseInt(trimmedLine.substring(6));
        if (currentAirspace) {
          currentAirspace.metadata.type = type;
        }
      }
      else if (trimmedLine === '-1') {
        if (currentPolygon.length > 0) {
          if (currentAirspace) {
            currentAirspace.polygons.push(currentPolygon);
            this.logger.debug(`Pushed polygon with ${currentPolygon.length} points to airspace: ${currentAirspace.name}`);
          }
          currentPolygon = [];
        }
      }
      else if (trimmedLine.includes('+')) {
        // Coordinate pair - format is lat+lon (e.g., 52.08683+0.92682 or 54.69917+-6.21583)
        const plusIndex = trimmedLine.indexOf('+');
        if (plusIndex > 0) {
          const latStr = trimmedLine.substring(0, plusIndex);
          const lonStr = trimmedLine.substring(plusIndex + 1); // Skip the + separator
          
          const lat = parseFloat(latStr);
          const lon = parseFloat(lonStr);
          
          if (!isNaN(lat) && !isNaN(lon)) {
            currentPolygon.push({ lat, lon });
          } else {
            this.logger.warn(`Invalid coordinates: ${trimmedLine} (lat=${latStr}, lon=${lonStr})`);
          }
        } else {
          this.logger.warn(`Invalid coordinate format: ${trimmedLine}`);
        }
      }
    }
    
    // Add final airspace
    if (currentAirspace && currentPolygon.length > 0) {
      currentAirspace.polygons.push(currentPolygon);
      this.logger.debug(`Pushed polygon with ${currentPolygon.length} points to airspace: ${currentAirspace.name} (final)`);
    }
    if (currentAirspace && currentAirspace.polygons.length > 0) {
      airspaces.push(currentAirspace);
      this.logger.debug(`Pushed airspace: ${currentAirspace.name} with ${currentAirspace.polygons.length} polygons (final)`);
    }
    
    this.logger.info(`Parsed airspaces for file ${filename}: count=${airspaces.length}`);
    if (airspaces.length > 0) {
      this.logger.info(`Sample airspace:`, {name: airspaces[0].name, polygons: airspaces[0].polygons.length});
    }
    return airspaces;
  }

  /**
   * Build spatial index for quick airspace lookup
   */
  async buildSpatialIndex() {
    this.logger.info('Building spatial index...');
    
    for (const [id, airspace] of this.airspaces) {
      // Calculate bounding box for each airspace
      const bounds = this.calculateBounds(airspace.polygons);
      airspace.bounds = bounds;
      
      // Store in spatial index
      const gridKey = this.getGridKey(bounds.center.lat, bounds.center.lon);
      if (!this.airspaceIndex.has(gridKey)) {
        this.airspaceIndex.set(gridKey, []);
      }
      this.airspaceIndex.get(gridKey).push(id);
    }
    
    this.logger.info(`Spatial index built with ${this.airspaceIndex.size} grid cells`);
  }

  /**
   * Calculate bounding box for airspace polygons
   */
  calculateBounds(polygons) {
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    
    for (const polygon of polygons) {
      for (const point of polygon) {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLon = Math.min(minLon, point.lon);
        maxLon = Math.max(maxLon, point.lon);
      }
    }
    
    return {
      minLat, maxLat, minLon, maxLon,
      center: {
        lat: (minLat + maxLat) / 2,
        lon: (minLon + maxLon) / 2
      },
      width: maxLon - minLon,
      height: maxLat - minLat
    };
  }

  /**
   * Get grid key for spatial indexing
   */
  getGridKey(lat, lon) {
    const gridSize = 1; // 1 degree grid
    const gridLat = Math.floor(lat / gridSize);
    const gridLon = Math.floor(lon / gridSize);
    return `${gridLat},${gridLon}`;
  }

  /**
   * Check if aircraft is in any airspace
   */
  checkAircraftAirspace(aircraft) {
    if (!aircraft.lat || !aircraft.lon) {
      return null;
    }
    
    const gridKey = this.getGridKey(aircraft.lat, aircraft.lon);
    const candidateAirspaces = this.airspaceIndex.get(gridKey) || [];
    
    const currentAirspaces = [];
    
    for (const airspaceId of candidateAirspaces) {
      const airspace = this.airspaces.get(airspaceId);
      if (airspace && this.isPointInAirspace(aircraft.lat, aircraft.lon, airspace)) {
        currentAirspaces.push({
          id: airspace.id,
          name: airspace.name,
          type: airspace.type,
          metadata: airspace.metadata
        });
      }
    }
    
    return currentAirspaces;
  }

  /**
   * Check if point is inside airspace
   */
  isPointInAirspace(lat, lon, airspace) {
    for (const polygon of airspace.polygons) {
      if (this.isPointInPolygon(lat, lon, polygon)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Point in polygon test using ray casting algorithm
   */
  isPointInPolygon(lat, lon, polygon) {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lon;
      const yi = polygon[i].lat;
      const xj = polygon[j].lon;
      const yj = polygon[j].lat;
      
      if (((yi > lat) !== (yj > lat)) &&
          (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  /**
   * Update aircraft airspace status and generate events
   */
  updateAircraftAirspace(aircraft) {
    const currentAirspaces = this.checkAircraftAirspace(aircraft);
    const previousAirspaces = this.aircraftAirspace.get(aircraft.icao24) || [];
    
    // Check for airspace entries
    const newAirspaces = currentAirspaces.filter(current => 
      !previousAirspaces.some(prev => prev.id === current.id)
    );
    
    // Check for airspace exits
    const exitedAirspaces = previousAirspaces.filter(prev => 
      !currentAirspaces.some(current => current.id === prev.id)
    );
    
    // Update current airspaces
    this.aircraftAirspace.set(aircraft.icao24, currentAirspaces);
    
    // Generate events
    for (const airspace of newAirspaces) {
      this.generateAirspaceEvent('entry', aircraft, airspace);
    }
    
    for (const airspace of exitedAirspaces) {
      this.generateAirspaceEvent('exit', aircraft, airspace);
    }
    
    return {
      current: currentAirspaces,
      new: newAirspaces,
      exited: exitedAirspaces
    };
  }

  /**
   * Generate airspace-related events
   */
  generateAirspaceEvent(eventType, aircraft, airspace) {
    const event = {
      id: `${aircraft.icao24}_${airspace.id}_${eventType}_${Date.now()}`,
      timestamp: new Date(),
      type: `airspace:${eventType}`,
      aircraft: {
        icao24: aircraft.icao24,
        callsign: aircraft.callsign,
        lat: aircraft.lat,
        lon: aircraft.lon,
        altitude: aircraft.altitude,
        speed: aircraft.speed,
        heading: aircraft.heading
      },
      airspace: airspace,
      metadata: {
        eventType: eventType,
        airspaceType: airspace.type,
        airspaceName: airspace.name
      }
    };
    
    this.events.push(event);
    
    // Trigger callbacks
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Error in airspace event callback', { error: error.message });
      }
    });
    
    this.logger.info(`Airspace ${eventType} event generated`, {
      aircraft: aircraft.icao24,
      airspace: airspace.name,
      type: airspace.type
    });
  }

  /**
   * Get airspace information for visualization
   */
  getAirspaceForVisualization(center, range) {
    this.logger.debug('getAirspaceForVisualization called', { center, range, airspaceCount: this.airspaces.size });
    
    const airspaces = [];
    
    for (const [id, airspace] of this.airspaces) {
      if (this.isAirspaceInRange(airspace, center, range)) {
        airspaces.push({
          id: airspace.id,
          name: airspace.name,
          type: airspace.type,
          polygons: airspace.polygons,
          bounds: airspace.bounds,
          metadata: airspace.metadata,
          color: this.getAirspaceColor(airspace.type)
        });
      }
    }
    
    this.logger.debug('getAirspaceForVisualization returning', { count: airspaces.length });
    return airspaces;
  }

  /**
   * Check if airspace is within radar range
   */
  isAirspaceInRange(airspace, center, range) {
    const distance = this.calculateDistance(
      center.lat, center.lon,
      airspace.bounds.center.lat, airspace.bounds.center.lon
    );
    
    return distance <= range + Math.max(airspace.bounds.width, airspace.bounds.height) / 2;
  }

  /**
   * Get color for airspace type
   */
  getAirspaceColor(type) {
    const colors = {
      'Final_Approach': '#00FF00',
      'Final_Approach_20nm': '#00FF00',
      'ATZ': '#FFD700',
      'CTA': '#FFA500',
      'TMA': '#FFA500',
      'CTR': '#FF0000',
      'Danger_Area': '#FF00FF',
      'FIR': '#0000FF',
      'LARS': '#00FFFF',
      'Military': '#800080',
      'VOR': '#FFFF00',
      'Holding_Pattern': '#FF8000',
      'Airway_Lower': '#0080FF',
      'Airway_Upper': '#8000FF'
    };
    
    return colors[type] || '#808080';
  }

  /**
   * Calculate distance between two points (nautical miles)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth's radius in nautical miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Subscribe to airspace events
   */
  onAirspaceEvent(callback) {
    this.eventCallbacks.push(callback);
  }

  /**
   * Get airspace statistics
   */
  getStats() {
    return {
      totalAirspaces: this.airspaces.size,
      airspaceTypes: Object.fromEntries(
        Array.from(this.airspaceTypeCollections.entries()).map(([type, airspaces]) => [type, airspaces.length])
      ),
      spatialIndexCells: this.airspaceIndex.size,
      trackedAircraft: this.aircraftAirspace.size,
      totalEvents: this.events.length,
      performance: this.performance
    };
  }

  /**
   * Get recent airspace events
   */
  getRecentEvents(limit = 100) {
    return this.events.slice(-limit);
  }

  /**
   * Get airspace by type
   */
  getAirspacesByType(type) {
    const airspaces = this.airspaceTypeCollections.get(type) || [];
    this.logger.debug('getAirspacesByType called', { type, count: airspaces.length });
    return airspaces;
  }

  /**
   * Get all airspace types
   */
  getAirspaceTypes() {
    const types = Array.from(this.airspaceTypeCollections.keys());
    this.logger.debug('getAirspaceTypes called', { types, typeCount: types.length });
    return types;
  }

  /**
   * Get all airspaces
   */
  getAllAirspaces() {
    this.logger.debug('getAllAirspaces called', { airspaceCount: this.airspaces.size });
    return Array.from(this.airspaces.values());
  }

  /**
   * Get recent airspace events
   */
  getRecentAirspaceEvents(options = {}) {
    const { limit = 50, type = null, aircraft = null } = options;
    
    let filteredEvents = this.events;
    
    if (type) {
      filteredEvents = filteredEvents.filter(event => event.airspaceType === type);
    }
    
    if (aircraft) {
      filteredEvents = filteredEvents.filter(event => event.aircraft === aircraft);
    }
    
    return filteredEvents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Search airspaces
   */
  searchAirspaces(query) {
    const results = [];
    const searchTerm = query.toLowerCase();
    
    for (const [id, airspace] of this.airspaces) {
      if (airspace.name && airspace.name.toLowerCase().includes(searchTerm)) {
        results.push(airspace);
      } else if (airspace.type && airspace.type.toLowerCase().includes(searchTerm)) {
        results.push(airspace);
      }
    }
    
    return results;
  }

  /**
   * Get all airspaces at a specific position
   */
  getAirspacesAtPosition(lat, lon, altitude = null) {
    this.logger.debug('getAirspacesAtPosition called', { lat, lon, altitude, airspaceCount: this.airspaces.size });
    
    if (lat === null || lon === null || lat === undefined || lon === undefined) {
      this.logger.warn('getAirspacesAtPosition called with invalid coordinates', { lat, lon });
      return [];
    }
    
    const matchingAirspaces = [];
    
    for (const [id, airspace] of this.airspaces) {
      if (this.isPointInAirspace(lat, lon, airspace)) {
        // Check altitude if provided and airspace has altitude limits
        if (altitude !== null && airspace.metadata && airspace.metadata.floor !== undefined && airspace.metadata.ceiling !== undefined) {
          if (altitude >= airspace.metadata.floor && altitude <= airspace.metadata.ceiling) {
            matchingAirspaces.push(airspace);
          }
        } else {
          // No altitude check needed or no altitude data available
          matchingAirspaces.push(airspace);
        }
      }
    }
    
    this.logger.debug('getAirspacesAtPosition returning', { count: matchingAirspaces.length });
    return matchingAirspaces;
  }
}

module.exports = AirspaceService; 