const winston = require('winston');

/**
 * Prestwick Airport Aircraft Operations Service
 * Tracks aircraft approaching, landing, and taking off at EGPK
 */
class PrestwickAirportService {
  constructor(config = {}) {
    this.config = {
      airportCode: 'EGPK',
      airportName: 'Prestwick Airport',
      latitude: 55.5094,
      longitude: -4.5867,
      elevation: 20, // meters
      approachRadius: 50000, // 50km approach radius
      runwayThreshold: 5000, // 5km runway threshold
      ...config
    };

    // Runway definitions for EGPK
    this.runways = {
      '12': {
        name: 'Runway 12',
        heading: 120,
        latitude: 55.5094,
        longitude: -4.5867,
        length: 2987, // meters
        threshold: {
          latitude: 55.5094,
          longitude: -4.5867
        }
      },
      '30': {
        name: 'Runway 30',
        heading: 300,
        latitude: 55.5094,
        longitude: -4.5867,
        length: 2987, // meters
        threshold: {
          latitude: 55.5094,
          longitude: -4.5867
        }
      }
    };

    // Aircraft tracking state
    this.trackedAircraft = new Map();
    this.aircraftHistory = [];
    this.maxHistorySize = 1000;

    // Event callbacks
    this.eventCallbacks = {
      approach: [],
      landing: [],
      takeoff: [],
      departure: []
    };

    // Statistics
    this.stats = {
      totalApproaches: 0,
      totalLandings: 0,
      totalTakeoffs: 0,
      totalDepartures: 0,
      lastUpdate: new Date().toISOString()
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'prestwick-airport' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  /**
   * Calculate distance between two points in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
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
   * Calculate bearing between two points
   */
  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = this.toRadians(lon2 - lon1);
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * (180 / Math.PI);
    return (bearing + 360) % 360;
  }

  /**
   * Determine which runway an aircraft is approaching
   */
  determineRunway(aircraftLat, aircraftLon, aircraftHeading) {
    const distances = {};
    
    for (const [runwayId, runway] of Object.entries(this.runways)) {
      const distance = this.calculateDistance(
        aircraftLat, aircraftLon,
        runway.threshold.latitude, runway.threshold.longitude
      );
      
      const bearing = this.calculateBearing(
        aircraftLat, aircraftLon,
        runway.threshold.latitude, runway.threshold.longitude
      );
      
      // Calculate heading difference
      let headingDiff = Math.abs(aircraftHeading - bearing);
      if (headingDiff > 180) {
        headingDiff = 360 - headingDiff;
      }
      
      // Score based on distance and heading alignment
      const distanceScore = Math.max(0, 1 - (distance / this.config.approachRadius));
      const headingScore = Math.max(0, 1 - (headingDiff / 45)); // 45 degrees tolerance
      const score = (distanceScore * 0.7) + (headingScore * 0.3);
      
      distances[runwayId] = {
        distance,
        bearing,
        headingDiff,
        score,
        runway
      };
    }
    
    // Return the runway with the best score
    const bestRunway = Object.entries(distances).reduce((best, [id, data]) => {
      return data.score > best.score ? { id, ...data } : best;
    }, { id: null, score: 0 });
    
    return bestRunway.id ? { id: bestRunway.id, ...bestRunway } : null;
  }

  /**
   * Process aircraft position update
   */
  processAircraftUpdate(aircraftData) {
    const {
      icao24,
      callsign,
      registration,
      latitude,
      longitude,
      altitude,
      speed,
      heading,
      squawk,
      timestamp
    } = aircraftData;

    if (!icao24 || !latitude || !longitude) {
      return null;
    }

    const distance = this.calculateDistance(
      latitude, longitude,
      this.config.latitude, this.config.longitude
    );

    // Only track aircraft within approach radius
    if (distance > this.config.approachRadius) {
      // Remove from tracking if aircraft is too far
      if (this.trackedAircraft.has(icao24)) {
        this.trackedAircraft.delete(icao24);
      }
      return null;
    }

    const runwayInfo = this.determineRunway(latitude, longitude, heading);
    const aircraftState = this.determineAircraftState(aircraftData, distance, runwayInfo);

    // Update tracked aircraft
    const previousState = this.trackedAircraft.get(icao24);
    this.trackedAircraft.set(icao24, {
      ...aircraftData,
      distance,
      runwayInfo,
      state: aircraftState,
      timestamp: timestamp || new Date().toISOString()
    });

    // Check for state transitions
    if (previousState && previousState.state !== aircraftState) {
      this.handleStateTransition(icao24, previousState, aircraftState, aircraftData);
    }

    // Add to history
    this.addToHistory({
      icao24,
      callsign,
      registration,
      latitude,
      longitude,
      altitude,
      speed,
      heading,
      squawk,
      distance,
      runwayInfo,
      state: aircraftState,
      timestamp: timestamp || new Date().toISOString()
    });

    return {
      icao24,
      callsign,
      registration,
      distance,
      runwayInfo,
      state: aircraftState,
      altitude,
      speed,
      heading
    };
  }

  /**
   * Determine aircraft state based on position and altitude
   */
  determineAircraftState(aircraftData, distance, runwayInfo) {
    const { altitude, speed, heading } = aircraftData;
    
    // Approach: Aircraft descending and within approach radius
    if (altitude < 3000 && altitude > 500 && distance < this.config.approachRadius && speed > 50) {
      return 'approach';
    }
    
    // Landing: Very low altitude near runway
    if (altitude < 500 && distance < this.config.runwayThreshold) {
      return 'landing';
    }
    
    // Takeoff: Low altitude, increasing, near runway
    if (altitude < 1000 && distance < this.config.runwayThreshold && speed > 100) {
      return 'takeoff';
    }
    
    // Departure: Climbing away from airport
    if (altitude > 1000 && distance > this.config.runwayThreshold && speed > 100) {
      return 'departure';
    }
    
    // En route: High altitude, not in approach pattern
    if (altitude > 3000) {
      return 'en_route';
    }
    
    return 'unknown';
  }

  /**
   * Handle aircraft state transitions
   */
  handleStateTransition(icao24, previousState, newState, aircraftData) {
    const event = {
      id: `prestwick-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: `aircraft:${newState}`,
      source: 'prestwick-airport',
      timestamp: new Date().toISOString(),
      data: {
        icao24,
        callsign: aircraftData.callsign,
        registration: aircraftData.registration,
        previousState,
        newState,
        runway: previousState.runwayInfo?.id || 'unknown',
        runwayName: previousState.runwayInfo?.runway?.name || 'Unknown Runway',
        altitude: aircraftData.altitude,
        speed: aircraftData.speed,
        heading: aircraftData.heading,
        distance: previousState.distance,
        squawk: aircraftData.squawk,
        airport: {
          code: this.config.airportCode,
          name: this.config.airportName,
          latitude: this.config.latitude,
          longitude: this.config.longitude
        }
      }
    };

    // Update statistics
    switch (newState) {
      case 'approach':
        this.stats.totalApproaches++;
        break;
      case 'landing':
        this.stats.totalLandings++;
        break;
      case 'takeoff':
        this.stats.totalTakeoffs++;
        break;
      case 'departure':
        this.stats.totalDepartures++;
        break;
    }

    this.stats.lastUpdate = new Date().toISOString();

    // Log the event
    this.logger.info(`Aircraft ${newState} event`, {
      icao24,
      callsign: aircraftData.callsign,
      runway: event.data.runway,
      altitude: aircraftData.altitude,
      speed: aircraftData.speed
    });

    // Trigger callbacks
    if (this.eventCallbacks[newState]) {
      this.eventCallbacks[newState].forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          this.logger.error('Error in event callback', { error: error.message });
        }
      });
    }

    return event;
  }

  /**
   * Add aircraft data to history
   */
  addToHistory(aircraftData) {
    this.aircraftHistory.unshift(aircraftData);
    
    // Keep only the last maxHistorySize entries
    if (this.aircraftHistory.length > this.maxHistorySize) {
      this.aircraftHistory = this.aircraftHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Register event callback
   */
  on(eventType, callback) {
    if (this.eventCallbacks[eventType]) {
      this.eventCallbacks[eventType].push(callback);
    }
  }

  /**
   * Get tracked aircraft
   */
  getTrackedAircraft() {
    return Array.from(this.trackedAircraft.values());
  }

  /**
   * Get aircraft history
   */
  getAircraftHistory(limit = 100) {
    return this.aircraftHistory.slice(0, limit);
  }

  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Get runway information
   */
  getRunways() {
    return { ...this.runways };
  }

  /**
   * Get airport configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.aircraftHistory = [];
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalApproaches: 0,
      totalLandings: 0,
      totalTakeoffs: 0,
      totalDepartures: 0,
      lastUpdate: new Date().toISOString()
    };
  }
}

module.exports = PrestwickAirportService; 