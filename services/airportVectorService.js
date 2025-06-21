const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

/**
 * Airport Vector Service
 * 
 * Parses and manages high-resolution airport vector data for radar visualization.
 * Supports multiple vector data formats and provides spatial querying capabilities.
 */
class AirportVectorService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      dataPath: config.dataPath || path.join(__dirname, '../config'),
      enabled: config.enabled !== false,
      autoLoad: config.autoLoad !== false,
      ...config
    };
    
    // Vector data storage
    this.airportData = {
      buildings: [], // AFB file - buildings
      markings: [],  // AFM file - markings
      layout: []     // AFP file - airfield layout
    };
    
    // Spatial index for efficient queries
    this.spatialIndex = new Map();
    
    // Performance tracking
    this.stats = {
      totalElements: 0,
      buildings: 0,
      markings: 0,
      layout: 0,
      lastUpdate: null,
      parseErrors: 0
    };
    
    this.logger = {
      info: (msg, data) => console.log(`[AirportVector] ${msg}`, data || ''),
      error: (msg, data) => console.error(`[AirportVector] ERROR: ${msg}`, data || ''),
      debug: (msg, data) => console.log(`[AirportVector] DEBUG: ${msg}`, data || '')
    };
    
    if (this.config.autoLoad) {
      this.loadAirportData();
    }
  }
  
  /**
   * Load all airport vector data files
   */
  async loadAirportData() {
    try {
      this.logger.info('Loading airport vector data...');
      
      // Load each file type
      await Promise.all([
        this.loadBuildingsData(),
        this.loadMarkingsData(),
        this.loadLayoutData()
      ]);
      
      // Build spatial index
      this.buildSpatialIndex();
      
      this.stats.lastUpdate = new Date();
      this.stats.totalElements = this.airportData.buildings.length + 
                                this.airportData.markings.length + 
                                this.airportData.layout.length;
      
      this.logger.info('Airport vector data loaded successfully', {
        buildings: this.airportData.buildings.length,
        markings: this.airportData.markings.length,
        layout: this.airportData.layout.length,
        total: this.stats.totalElements
      });
      
      this.emit('data:loaded', this.stats);
      
    } catch (error) {
      this.logger.error('Failed to load airport vector data', error);
      this.stats.parseErrors++;
      this.emit('error', error);
    }
  }
  
  /**
   * Parse AFB file (buildings)
   */
  async loadBuildingsData() {
    const filePath = path.join(this.config.dataPath, 'AFB_Prestwick_EGPK.out');
    const content = await fs.readFile(filePath, 'utf8');
    
    const buildings = [];
    const lines = content.split('\n');
    let currentBuilding = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('$')) {
        continue;
      }
      
      if (trimmed === '-1') {
        if (currentBuilding && currentBuilding.coordinates.length > 0) {
          buildings.push(currentBuilding);
        }
        currentBuilding = null;
        continue;
      }
      
      // Parse coordinate line
      const coords = this.parseCoordinateLine(trimmed);
      if (coords) {
        if (!currentBuilding) {
          currentBuilding = {
            id: `building_${buildings.length + 1}`,
            type: 'building',
            coordinates: [],
            bounds: null
          };
        }
        currentBuilding.coordinates.push(coords);
      }
    }
    
    // Add final building if exists
    if (currentBuilding && currentBuilding.coordinates.length > 0) {
      buildings.push(currentBuilding);
    }
    
    // Calculate bounds for each building
    buildings.forEach(building => {
      building.bounds = this.calculateBounds(building.coordinates);
    });
    
    this.airportData.buildings = buildings;
    this.stats.buildings = buildings.length;
    
    this.logger.info(`Loaded ${buildings.length} buildings`);
  }
  
  /**
   * Parse AFM file (markings)
   */
  async loadMarkingsData() {
    const filePath = path.join(this.config.dataPath, 'AFM_Prestwick_EGPK.out');
    const content = await fs.readFile(filePath, 'utf8');
    
    const markings = [];
    const lines = content.split('\n');
    let currentMarking = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('$')) {
        continue;
      }
      
      if (trimmed === '-1') {
        if (currentMarking && currentMarking.coordinates.length > 0) {
          markings.push(currentMarking);
        }
        currentMarking = null;
        continue;
      }
      
      // Parse coordinate line
      const coords = this.parseCoordinateLine(trimmed);
      if (coords) {
        if (!currentMarking) {
          currentMarking = {
            id: `marking_${markings.length + 1}`,
            type: 'marking',
            coordinates: [],
            bounds: null
          };
        }
        currentMarking.coordinates.push(coords);
      }
    }
    
    // Add final marking if exists
    if (currentMarking && currentMarking.coordinates.length > 0) {
      markings.push(currentMarking);
    }
    
    // Calculate bounds for each marking
    markings.forEach(marking => {
      marking.bounds = this.calculateBounds(marking.coordinates);
    });
    
    this.airportData.markings = markings;
    this.stats.markings = markings.length;
    
    this.logger.info(`Loaded ${markings.length} markings`);
  }
  
  /**
   * Parse AFP file (airfield layout)
   */
  async loadLayoutData() {
    const filePath = path.join(this.config.dataPath, 'AFP_Prestwick_EGPK_2.out');
    const content = await fs.readFile(filePath, 'utf8');
    
    const layout = [];
    const lines = content.split('\n');
    let currentLayout = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('$')) {
        continue;
      }
      
      if (trimmed === '-1') {
        if (currentLayout && currentLayout.coordinates.length > 0) {
          layout.push(currentLayout);
        }
        currentLayout = null;
        continue;
      }
      
      // Parse coordinate line
      const coords = this.parseCoordinateLine(trimmed);
      if (coords) {
        if (!currentLayout) {
          currentLayout = {
            id: `layout_${layout.length + 1}`,
            type: 'layout',
            coordinates: [],
            bounds: null
          };
        }
        currentLayout.coordinates.push(coords);
      }
    }
    
    // Add final layout if exists
    if (currentLayout && currentLayout.coordinates.length > 0) {
      layout.push(currentLayout);
    }
    
    // Calculate bounds for each layout element
    layout.forEach(layoutElement => {
      layoutElement.bounds = this.calculateBounds(layoutElement.coordinates);
    });
    
    this.airportData.layout = layout;
    this.stats.layout = layout.length;
    
    this.logger.info(`Loaded ${layout.length} layout elements`);
  }
  
  /**
   * Parse coordinate line in format "55.51330+-4.59330"
   */
  parseCoordinateLine(line) {
    try {
      // Handle the format "55.51330+-4.59330" (latitude+-longitude)
      const match = line.match(/^(\d+\.\d+)\+-(\d+\.\d+)$/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lon = -parseFloat(match[2]); // Negative for western longitude
        return { lat, lon };
      }
      
      // Alternative format check
      const parts = line.split('+-');
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lon = -parseFloat(parts[1]); // Negative for western longitude
        return { lat, lon };
      }
      
      return null;
    } catch (error) {
      this.logger.debug(`Failed to parse coordinate line: ${line}`, error);
      return null;
    }
  }
  
  /**
   * Calculate bounding box for a set of coordinates
   */
  calculateBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      return null;
    }
    
    let minLat = coordinates[0].lat;
    let maxLat = coordinates[0].lat;
    let minLon = coordinates[0].lon;
    let maxLon = coordinates[0].lon;
    
    for (const coord of coordinates) {
      minLat = Math.min(minLat, coord.lat);
      maxLat = Math.max(maxLat, coord.lat);
      minLon = Math.min(minLon, coord.lon);
      maxLon = Math.max(maxLon, coord.lon);
    }
    
    return {
      min: { lat: minLat, lon: minLon },
      max: { lat: maxLat, lon: maxLon },
      center: {
        lat: (minLat + maxLat) / 2,
        lon: (minLon + maxLon) / 2
      }
    };
  }
  
  /**
   * Build spatial index for efficient queries
   */
  buildSpatialIndex() {
    this.spatialIndex.clear();
    
    // Index all elements by type
    const allElements = [
      ...this.airportData.buildings.map(b => ({ ...b, category: 'buildings' })),
      ...this.airportData.markings.map(m => ({ ...m, category: 'markings' })),
      ...this.airportData.layout.map(l => ({ ...l, category: 'layout' }))
    ];
    
    for (const element of allElements) {
      this.spatialIndex.set(element.id, element);
    }
    
    this.logger.info(`Built spatial index with ${this.spatialIndex.size} elements`);
  }
  
  /**
   * Get all airport vector data
   */
  getAllData() {
    return {
      buildings: this.airportData.buildings,
      markings: this.airportData.markings,
      layout: this.airportData.layout,
      stats: this.stats
    };
  }
  
  /**
   * Get elements within a bounding box
   */
  getElementsInBounds(bounds, types = ['buildings', 'markings', 'layout']) {
    const elements = [];
    
    for (const type of types) {
      const typeData = this.airportData[type] || [];
      for (const element of typeData) {
        if (this.boundsIntersect(bounds, element.bounds)) {
          elements.push({ ...element, category: type });
        }
      }
    }
    
    return elements;
  }
  
  /**
   * Check if two bounding boxes intersect
   */
  boundsIntersect(bounds1, bounds2) {
    if (!bounds1 || !bounds2) return false;
    
    return !(bounds1.max.lat < bounds2.min.lat ||
             bounds1.min.lat > bounds2.max.lat ||
             bounds1.max.lon < bounds2.min.lon ||
             bounds1.min.lon > bounds2.max.lon);
  }
  
  /**
   * Get elements near a point
   */
  getElementsNearPoint(point, radiusKm = 1, types = ['buildings', 'markings', 'layout']) {
    const elements = [];
    
    for (const type of types) {
      const typeData = this.airportData[type] || [];
      for (const element of typeData) {
        if (this.distanceToPoint(point, element.bounds.center) <= radiusKm) {
          elements.push({ ...element, category: type });
        }
      }
    }
    
    return elements;
  }
  
  /**
   * Calculate distance between two points in kilometers
   */
  distanceToPoint(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLon = this.toRadians(point2.lon - point1.lon);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
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
   * Get airport bounds
   */
  getAirportBounds() {
    const allElements = [
      ...this.airportData.buildings,
      ...this.airportData.markings,
      ...this.airportData.layout
    ];
    
    if (allElements.length === 0) {
      return null;
    }
    
    let minLat = allElements[0].bounds.min.lat;
    let maxLat = allElements[0].bounds.max.lat;
    let minLon = allElements[0].bounds.min.lon;
    let maxLon = allElements[0].bounds.max.lon;
    
    for (const element of allElements) {
      minLat = Math.min(minLat, element.bounds.min.lat);
      maxLat = Math.max(maxLat, element.bounds.max.lat);
      minLon = Math.min(minLon, element.bounds.min.lon);
      maxLon = Math.max(maxLon, element.bounds.max.lon);
    }
    
    return {
      min: { lat: minLat, lon: minLon },
      max: { lat: maxLat, lon: maxLon },
      center: {
        lat: (minLat + maxLat) / 2,
        lon: (minLon + maxLon) / 2
      }
    };
  }
  
  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      airportBounds: this.getAirportBounds(),
      spatialIndexSize: this.spatialIndex.size
    };
  }
  
  /**
   * Reload airport data
   */
  async reload() {
    this.logger.info('Reloading airport vector data...');
    await this.loadAirportData();
  }
}

module.exports = AirportVectorService; 