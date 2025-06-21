const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

/**
 * Coastline Vector Service
 * 
 * Parses and manages coastline vector data for radar visualization.
 * Supports C15 format coastline data and provides spatial querying capabilities.
 */
class CoastlineVectorService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      dataPath: config.dataPath || path.join(__dirname, '../aviationdata'),
      enabled: config.enabled !== false,
      autoLoad: config.autoLoad !== false,
      ...config
    };
    
    // Coastline data storage
    this.coastlineData = {
      segments: [], // Individual coastline segments
      bounds: null  // Overall bounds of coastline data
    };
    
    // Spatial index for efficient queries
    this.spatialIndex = new Map();
    
    // Performance tracking
    this.stats = {
      totalSegments: 0,
      totalPoints: 0,
      lastUpdate: null,
      parseErrors: 0
    };
    
    this.logger = {
      info: (msg, data) => console.log(`[CoastlineVector] ${msg}`, data || ''),
      error: (msg, data) => console.error(`[CoastlineVector] ERROR: ${msg}`, data || ''),
      debug: (msg, data) => console.log(`[CoastlineVector] DEBUG: ${msg}`, data || '')
    };
    
    if (this.config.autoLoad) {
      this.loadCoastlineData();
    }
  }
  
  /**
   * Load coastline vector data from C15 file
   */
  async loadCoastlineData() {
    try {
      this.logger.info('Loading coastline vector data...');
      
      const filePath = path.join(this.config.dataPath, 'C15_COAST_N_Europe.out');
      const content = await fs.readFile(filePath, 'utf8');
      
      const segments = this.parseC15File(content);
      
      this.coastlineData.segments = segments;
      this.stats.totalSegments = segments.length;
      this.stats.totalPoints = segments.reduce((total, seg) => total + seg.coordinates.length, 0);
      
      // Calculate overall bounds
      this.coastlineData.bounds = this.calculateOverallBounds(segments);
      
      // Build spatial index
      this.buildSpatialIndex();
      
      this.stats.lastUpdate = new Date();
      
      this.logger.info('Coastline vector data loaded successfully', {
        segments: this.stats.totalSegments,
        points: this.stats.totalPoints,
        bounds: this.coastlineData.bounds
      });
      
      this.emit('data:loaded', this.stats);
      
    } catch (error) {
      this.logger.error('Failed to load coastline vector data', error);
      this.stats.parseErrors++;
      this.emit('error', error);
    }
  }
  
  /**
   * Parse C15 format coastline file
   */
  parseC15File(content) {
    const segments = [];
    const lines = content.split('\n');
    let currentSegment = null;
    let segmentId = 1;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and metadata
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('{') || trimmed.startsWith('$')) {
        continue;
      }
      
      // Parse coordinate line (format: lat+lon or lat+-lon)
      const coords = this.parseCoordinateLine(trimmed);
      if (coords) {
        if (!currentSegment) {
          currentSegment = {
            id: `coastline_${segmentId}`,
            type: 'coastline',
            coordinates: [],
            bounds: null
          };
        }
        currentSegment.coordinates.push(coords);
      } else {
        // End of segment (empty line or invalid coordinate)
        if (currentSegment && currentSegment.coordinates.length > 0) {
          // Calculate bounds for this segment
          currentSegment.bounds = this.calculateBounds(currentSegment.coordinates);
          segments.push(currentSegment);
          segmentId++;
        }
        currentSegment = null;
      }
    }
    
    // Add final segment if exists
    if (currentSegment && currentSegment.coordinates.length > 0) {
      currentSegment.bounds = this.calculateBounds(currentSegment.coordinates);
      segments.push(currentSegment);
    }
    
    return segments;
  }
  
  /**
   * Parse coordinate line from C15 format
   * Format: lat+lon or lat+-lon (e.g., "45.599593+-1.000045")
   */
  parseCoordinateLine(line) {
    try {
      // Handle different coordinate formats
      let lat, lon;
      
      if (line.includes('+-')) {
        // Format: lat+-lon (negative longitude)
        const parts = line.split('+-');
        lat = parseFloat(parts[0]);
        lon = -parseFloat(parts[1]);
      } else if (line.includes('+')) {
        // Format: lat+lon (positive longitude)
        const parts = line.split('+');
        lat = parseFloat(parts[0]);
        lon = parseFloat(parts[1]);
      } else {
        return null;
      }
      
      // Validate coordinates
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return null;
      }
      
      return { lat, lon };
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Calculate bounds for a set of coordinates
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
      minLat,
      maxLat,
      minLon,
      maxLon,
      center: {
        lat: (minLat + maxLat) / 2,
        lon: (minLon + maxLon) / 2
      }
    };
  }
  
  /**
   * Calculate overall bounds for all coastline segments
   */
  calculateOverallBounds(segments) {
    if (!segments || segments.length === 0) {
      return null;
    }
    
    let minLat = segments[0].bounds.minLat;
    let maxLat = segments[0].bounds.maxLat;
    let minLon = segments[0].bounds.minLon;
    let maxLon = segments[0].bounds.maxLon;
    
    for (const segment of segments) {
      if (segment.bounds) {
        minLat = Math.min(minLat, segment.bounds.minLat);
        maxLat = Math.max(maxLat, segment.bounds.maxLat);
        minLon = Math.min(minLon, segment.bounds.minLon);
        maxLon = Math.max(maxLon, segment.bounds.maxLon);
      }
    }
    
    return {
      minLat,
      maxLat,
      minLon,
      maxLon,
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
    
    // Create grid-based spatial index
    const gridSize = 1; // 1 degree grid
    
    for (const segment of this.coastlineData.segments) {
      if (!segment.bounds) continue;
      
      const minGridLat = Math.floor(segment.bounds.minLat / gridSize);
      const maxGridLat = Math.floor(segment.bounds.maxLat / gridSize);
      const minGridLon = Math.floor(segment.bounds.minLon / gridSize);
      const maxGridLon = Math.floor(segment.bounds.maxLon / gridSize);
      
      for (let lat = minGridLat; lat <= maxGridLat; lat++) {
        for (let lon = minGridLon; lon <= maxGridLon; lon++) {
          const key = `${lat},${lon}`;
          if (!this.spatialIndex.has(key)) {
            this.spatialIndex.set(key, []);
          }
          this.spatialIndex.get(key).push(segment);
        }
      }
    }
    
    this.logger.debug(`Built spatial index with ${this.spatialIndex.size} grid cells`);
  }
  
  /**
   * Get all coastline data
   */
  getAllData() {
    return {
      segments: this.coastlineData.segments,
      bounds: this.coastlineData.bounds,
      stats: this.stats
    };
  }
  
  /**
   * Get coastline segments within specified bounds
   */
  getSegmentsInBounds(bounds) {
    if (!bounds) {
      return this.coastlineData.segments;
    }
    
    return this.coastlineData.segments.filter(segment => {
      return segment.bounds && this.boundsIntersect(segment.bounds, bounds);
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
   * Get coastline segments near a point
   */
  getSegmentsNearPoint(point, radiusKm = 10) {
    const segments = [];
    
    for (const segment of this.coastlineData.segments) {
      for (const coord of segment.coordinates) {
        const distance = this.distanceToPoint(point, coord);
        if (distance <= radiusKm) {
          segments.push(segment);
          break; // Only add segment once
        }
      }
    }
    
    return segments;
  }
  
  /**
   * Calculate distance between two points in kilometers
   */
  distanceToPoint(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLon = this.toRadians(point2.lon - point1.lon);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Get coastline bounds
   */
  getCoastlineBounds() {
    return this.coastlineData.bounds;
  }
  
  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      spatialIndexSize: this.spatialIndex.size
    };
  }
  
  /**
   * Reload coastline data
   */
  async reload() {
    this.logger.info('Reloading coastline data...');
    await this.loadCoastlineData();
  }
}

module.exports = CoastlineVectorService; 