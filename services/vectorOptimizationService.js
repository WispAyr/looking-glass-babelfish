/**
 * Vector Optimization Service
 * 
 * Optimizes vector graphics for radar display performance and clarity.
 * Provides polygon simplification, bounding box filtering, and efficient rendering.
 */

const path = require('path');
const winston = require('winston');

class VectorOptimizationService {
  constructor(config = {}) {
    this.config = {
      simplificationTolerance: config.simplificationTolerance || 0.0001, // Degrees
      maxPolygonPoints: config.maxPolygonPoints || 100,
      enableCaching: config.enableCaching !== false,
      cacheExpiry: config.cacheExpiry || 300000, // 5 minutes
      ...config
    };

    // Create logger
    this.logger = winston.createLogger({
      level: config.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'vector-optimization' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });

    // Cache for optimized vectors
    this.vectorCache = new Map();
    this.cacheTimestamps = new Map();

    this.logger.info('Vector Optimization Service initialized', {
      simplificationTolerance: this.config.simplificationTolerance,
      maxPolygonPoints: this.config.maxPolygonPoints,
      enableCaching: this.config.enableCaching
    });
  }

  /**
   * Optimize polygon for display
   */
  optimizePolygon(polygon, options = {}) {
    const cacheKey = this.generateCacheKey(polygon, options);
    
    if (this.config.enableCaching && this.vectorCache.has(cacheKey)) {
      const cached = this.vectorCache.get(cacheKey);
      if (Date.now() - this.cacheTimestamps.get(cacheKey) < this.config.cacheExpiry) {
        return cached;
      }
    }

    let optimized = [...polygon];
    
    // Simplify polygon if too many points
    if (optimized.length > this.config.maxPolygonPoints) {
      optimized = this.simplifyPolygon(optimized, options.tolerance || this.config.simplificationTolerance);
    }

    // Calculate bounding box
    const bounds = this.calculateBoundingBox(optimized);
    
    // Calculate center point
    const center = this.calculateCenter(optimized);

    const result = {
      points: optimized,
      bounds,
      center,
      originalPointCount: polygon.length,
      optimizedPointCount: optimized.length,
      reduction: ((polygon.length - optimized.length) / polygon.length * 100).toFixed(1) + '%'
    };

    if (this.config.enableCaching) {
      this.vectorCache.set(cacheKey, result);
      this.cacheTimestamps.set(cacheKey, Date.now());
    }

    return result;
  }

  /**
   * Simplify polygon using Douglas-Peucker algorithm
   */
  simplifyPolygon(points, tolerance) {
    if (points.length <= 2) return points;

    const findPerpendicularDistance = (point, lineStart, lineEnd) => {
      const A = point.lat - lineStart.lat;
      const B = point.lon - lineStart.lon;
      const C = lineEnd.lat - lineStart.lat;
      const D = lineEnd.lon - lineStart.lon;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      
      if (lenSq === 0) return Math.sqrt(A * A + B * B);
      
      const param = dot / lenSq;
      let xx, yy;

      if (param < 0) {
        xx = lineStart.lat;
        yy = lineStart.lon;
      } else if (param > 1) {
        xx = lineEnd.lat;
        yy = lineEnd.lon;
      } else {
        xx = lineStart.lat + param * C;
        yy = lineStart.lon + param * D;
      }

      const dx = point.lat - xx;
      const dy = point.lon - yy;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const douglasPeucker = (points, tolerance) => {
      if (points.length <= 2) return points;

      let maxDistance = 0;
      let index = 0;

      for (let i = 1; i < points.length - 1; i++) {
        const distance = findPerpendicularDistance(points[i], points[0], points[points.length - 1]);
        if (distance > maxDistance) {
          maxDistance = distance;
          index = i;
        }
      }

      if (maxDistance > tolerance) {
        const firstLine = douglasPeucker(points.slice(0, index + 1), tolerance);
        const secondLine = douglasPeucker(points.slice(index), tolerance);
        return [...firstLine.slice(0, -1), ...secondLine];
      } else {
        return [points[0], points[points.length - 1]];
      }
    };

    return douglasPeucker(points, tolerance);
  }

  /**
   * Calculate bounding box for polygon
   */
  calculateBoundingBox(points) {
    if (!points || points.length === 0) return null;

    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLon = points[0].lon;
    let maxLon = points[0].lon;

    for (const point of points) {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLon = Math.min(minLon, point.lon);
      maxLon = Math.max(maxLon, point.lon);
    }

    return {
      minLat,
      maxLat,
      minLon,
      maxLon,
      width: maxLon - minLon,
      height: maxLat - minLat
    };
  }

  /**
   * Calculate center point of polygon
   */
  calculateCenter(points) {
    if (!points || points.length === 0) return null;

    let sumLat = 0;
    let sumLon = 0;

    for (const point of points) {
      sumLat += point.lat;
      sumLon += point.lon;
    }

    return {
      lat: sumLat / points.length,
      lon: sumLon / points.length
    };
  }

  /**
   * Check if polygon intersects with radar view
   */
  isInRadarView(polygon, radarConfig) {
    const bounds = this.calculateBoundingBox(polygon);
    if (!bounds) return false;

    const center = radarConfig.center;
    const range = radarConfig.range;

    // Convert range from nautical miles to degrees (approximate)
    const rangeDegrees = range / 60; // 1 degree ≈ 60 nautical miles

    const radarBounds = {
      minLat: center.lat - rangeDegrees,
      maxLat: center.lat + rangeDegrees,
      minLon: center.lon - rangeDegrees,
      maxLon: center.lon + rangeDegrees
    };

    return !(bounds.maxLat < radarBounds.minLat ||
             bounds.minLat > radarBounds.maxLat ||
             bounds.maxLon < radarBounds.minLon ||
             bounds.minLon > radarBounds.maxLon);
  }

  /**
   * Optimize multiple polygons for radar display
   */
  optimizePolygonsForRadar(polygons, radarConfig, options = {}) {
    const optimized = [];
    const filtered = [];

    for (const polygon of polygons) {
      // Check if polygon is in radar view
      if (!this.isInRadarView(polygon.points || polygon, radarConfig)) {
        filtered.push(polygon.id || 'unknown');
        continue;
      }

      const points = polygon.points || polygon;
      const optimizedPolygon = this.optimizePolygon(points, options);

      optimized.push({
        id: polygon.id,
        type: polygon.type,
        name: polygon.name,
        color: polygon.color || this.getDefaultColor(polygon.type),
        opacity: polygon.opacity || 0.2,
        ...optimizedPolygon
      });
    }

    this.logger.debug('Polygons optimized for radar', {
      total: polygons.length,
      optimized: optimized.length,
      filtered: filtered.length,
      radarRange: radarConfig.range
    });

    return {
      polygons: optimized,
      stats: {
        total: polygons.length,
        optimized: optimized.length,
        filtered: filtered.length
      }
    };
  }

  /**
   * Get default color for airspace type
   */
  getDefaultColor(type) {
    const colorMap = {
      'CTR': '#FF00FF', // Magenta
      'CTA': '#FF8000', // Orange
      'TMA': '#FFFF00', // Yellow
      'ATZ': '#00FFFF', // Cyan
      'FA': '#00FF00',  // Green
      'DA': '#FF0000',  // Red
      'FIR': '#8000FF', // Purple
      'LARS': '#0080FF', // Blue
      'MIL': '#FF0080'  // Pink
    };

    return colorMap[type] || '#808080'; // Default gray
  }

  /**
   * Generate cache key for polygon
   */
  generateCacheKey(polygon, options) {
    const key = {
      points: polygon.length,
      tolerance: options.tolerance || this.config.simplificationTolerance,
      maxPoints: options.maxPoints || this.config.maxPolygonPoints
    };
    return JSON.stringify(key);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.vectorCache.clear();
    this.cacheTimestamps.clear();
    this.logger.info('Vector cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.vectorCache.size,
      oldestEntry: Math.min(...this.cacheTimestamps.values()),
      newestEntry: Math.max(...this.cacheTimestamps.values())
    };
  }
}

module.exports = VectorOptimizationService; 