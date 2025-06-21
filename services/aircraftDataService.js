const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const winston = require('winston');

/**
 * Aircraft Data Service
 * 
 * Manages aircraft data storage and retrieval, integrating:
 * - BaseStation.sqb for aircraft registration data
 * - babelfish.db for real-time tracking and events
 * - Memory cache for performance
 */
class AircraftDataService {
  constructor(config = {}) {
    this.config = {
      baseStationPath: config.baseStationPath || path.join(__dirname, '../aviationdata/BaseStation.sqb'),
      babelfishPath: config.babelfishPath || path.join(__dirname, '../data/babelfish.db'),
      enableBaseStation: config.enableBaseStation !== false,
      enableTracking: config.enableTracking !== false,
      maxHistoryDays: config.maxHistoryDays || 30,
      cleanupInterval: config.cleanupInterval || 3600000, // 1 hour
      baseStationWriteMode: config.baseStationWriteMode || false,
      enableBaseStationFlightLogging: config.enableBaseStationFlightLogging || false,
      ...config
    };

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

    // Database connections
    this.baseStationDb = null;
    this.babelfishDb = null;
    
    // Memory cache
    this.aircraftRegistry = new Map(); // Registration data cache
    this.currentAircraft = new Map(); // Current aircraft positions
    this.flightHistory = new Map(); // Flight history cache
    
    // Statistics
    this.stats = {
      totalAircraft: 0,
      trackedAircraft: 0,
      totalFlights: 0,
      totalEvents: 0,
      lastUpdate: null
    };

    this.logger.info('Aircraft Data Service initialized', this.config);
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      this.logger.info('Initializing Aircraft Data Service...');
      
      // Initialize BaseStation database
      if (this.config.enableBaseStation) {
        await this.initializeBaseStation();
      }
      
      // Initialize babelfish database
      if (this.config.enableTracking) {
        await this.initializeBabelfish();
      }
      
      // Start cleanup timer
      this.startCleanupTimer();
      
      this.logger.info('Aircraft Data Service initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Aircraft Data Service', error);
      throw error;
    }
  }

  /**
   * Initialize BaseStation database connection
   */
  async initializeBaseStation() {
    return new Promise((resolve, reject) => {
      const mode = (this.config.enableBaseStationFlightLogging || this.config.baseStationWriteMode)
        ? sqlite3.OPEN_READWRITE
        : sqlite3.OPEN_READONLY;
      this.baseStationDb = new sqlite3.Database(this.config.baseStationPath, mode, (err) => {
        if (err) {
          this.logger.warn('Failed to connect to BaseStation database', { error: err.message });
          this.config.enableBaseStation = false;
          resolve(false);
        } else {
          this.logger.info('Connected to BaseStation database');
          this.loadAircraftRegistry();
          resolve(true);
        }
      });
    });
  }

  /**
   * Initialize babelfish database connection
   */
  async initializeBabelfish() {
    return new Promise((resolve, reject) => {
      this.babelfishDb = new sqlite3.Database(this.config.babelfishPath, (err) => {
        if (err) {
          this.logger.error('Failed to connect to babelfish database', { error: err.message });
          reject(err);
        } else {
          this.logger.info('Connected to babelfish database');
          this.createAircraftTables();
          resolve(true);
        }
      });
    });
  }

  /**
   * Create aircraft tables in babelfish database
   */
  async createAircraftTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS aircraft_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        icao24 TEXT NOT NULL,
        callsign TEXT,
        lat REAL,
        lon REAL,
        altitude INTEGER,
        speed REAL,
        track REAL,
        vertical_rate INTEGER,
        squawk TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        source TEXT DEFAULT 'adsb'
      )`,
      
      `CREATE TABLE IF NOT EXISTS aircraft_flights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        icao24 TEXT NOT NULL,
        callsign TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        start_lat REAL,
        start_lon REAL,
        end_lat REAL,
        end_lon REAL,
        max_altitude INTEGER,
        max_speed REAL,
        total_distance REAL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS aircraft_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        icao24 TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        source TEXT DEFAULT 'adsb'
      )`
    ];

    for (const table of tables) {
      await this.runQuery(table);
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_aircraft_positions_icao24 ON aircraft_positions(icao24)',
      'CREATE INDEX IF NOT EXISTS idx_aircraft_positions_timestamp ON aircraft_positions(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_aircraft_flights_icao24 ON aircraft_flights(icao24)',
      'CREATE INDEX IF NOT EXISTS idx_aircraft_flights_status ON aircraft_flights(status)',
      'CREATE INDEX IF NOT EXISTS idx_aircraft_events_icao24 ON aircraft_events(icao24)',
      'CREATE INDEX IF NOT EXISTS idx_aircraft_events_type ON aircraft_events(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_aircraft_events_timestamp ON aircraft_events(timestamp)'
    ];

    for (const index of indexes) {
      await this.runQuery(index);
    }

    this.logger.info('Aircraft tables created successfully');
  }

  /**
   * Load aircraft registry from BaseStation database
   */
  async loadAircraftRegistry() {
    if (!this.baseStationDb) return;

    const query = `
      SELECT 
        ModeS,
        Registration,
        ICAOTypeCode,
        Type,
        Manufacturer,
        OperatorFlagCode,
        SerialNo,
        YearBuilt,
        RegisteredOwners,
        Country
      FROM Aircraft 
      WHERE ModeS IS NOT NULL AND ModeS != ''
    `;

    return new Promise((resolve, reject) => {
      this.baseStationDb.all(query, [], (err, rows) => {
        if (err) {
          this.logger.error('Failed to load aircraft registry', { error: err.message });
          reject(err);
        } else {
          // Clear existing registry
          this.aircraftRegistry.clear();
          
          // Load aircraft data into registry
          for (const row of rows) {
            if (row.ModeS) {
              this.aircraftRegistry.set(row.ModeS.toUpperCase(), {
                icao24: row.ModeS.toUpperCase(),
                registration: row.Registration || null,
                icaoTypeCode: row.ICAOTypeCode || null,
                type: row.Type || null,
                manufacturer: row.Manufacturer || null,
                operatorFlagCode: row.OperatorFlagCode || null,
                serialNo: row.SerialNo || null,
                yearBuilt: row.YearBuilt || null,
                owner: row.RegisteredOwners || null,
                country: row.Country || null
              });
            }
          }
          
          this.stats.totalAircraft = this.aircraftRegistry.size;
          this.logger.info('Aircraft registry loaded', { 
            count: this.aircraftRegistry.size,
            databasePath: this.config.baseStationPath 
          });
          resolve(this.aircraftRegistry.size);
        }
      });
    });
  }

  /**
   * Store aircraft position
   */
  async storeAircraftPosition(aircraft) {
    if (!this.config.enableTracking || !this.babelfishDb) return;

    try {
      const query = `
        INSERT INTO aircraft_positions (
          icao24, callsign, lat, lon, altitude, speed, track, 
          vertical_rate, squawk, timestamp, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        aircraft.icao24,
        aircraft.callsign || null,
        aircraft.lat || null,
        aircraft.lon || null,
        aircraft.altitude || null,
        aircraft.speed || null,
        aircraft.track || null,
        aircraft.vertical_rate || null,
        aircraft.squawk || null,
        new Date().toISOString(),
        'adsb'
      ];

      await this.runQuery(query, params);
      
      // Update current aircraft cache
      this.currentAircraft.set(aircraft.icao24, {
        ...aircraft,
        lastUpdate: new Date()
      });

      this.stats.trackedAircraft = this.currentAircraft.size;
      this.stats.lastUpdate = new Date();

    } catch (error) {
      this.logger.error('Failed to store aircraft position', { 
        icao24: aircraft.icao24, 
        error: error.message 
      });
    }
  }

  /**
   * Store aircraft event
   */
  async storeAircraftEvent(icao24, eventType, eventData) {
    if (!this.config.enableTracking || !this.babelfishDb) return;

    try {
      const query = `
        INSERT INTO aircraft_events (icao24, event_type, event_data, timestamp, source)
        VALUES (?, ?, ?, ?, ?)
      `;

      const params = [
        icao24,
        eventType,
        JSON.stringify(eventData),
        new Date().toISOString(),
        'adsb'
      ];

      await this.runQuery(query, params);
      this.stats.totalEvents++;

    } catch (error) {
      this.logger.error('Failed to store aircraft event', { 
        icao24, 
        eventType, 
        error: error.message 
      });
    }
  }

  /**
   * Get aircraft registration data
   */
  async getAircraftRegistration(icao24) {
    const icao24Upper = icao24.toUpperCase();
    
    // Check cache first
    if (this.aircraftRegistry.has(icao24Upper)) {
      return this.aircraftRegistry.get(icao24Upper);
    }

    // Query database if not in cache
    if (this.baseStationDb) {
      const query = `
        SELECT 
          ModeS, Registration, ICAOTypeCode, Type, Manufacturer,
          OperatorFlagCode, SerialNo, YearBuilt, RegisteredOwners, Country
        FROM Aircraft 
        WHERE ModeS = ?
      `;

      return new Promise((resolve, reject) => {
        this.baseStationDb.get(query, [icao24Upper], (err, row) => {
          if (err) {
            this.logger.error('Failed to query aircraft registration', { icao24: icao24Upper, error: err.message });
            resolve(null);
          } else if (row) {
            const aircraft = {
              icao24: row.ModeS.toUpperCase(),
              registration: row.Registration || null,
              icaoTypeCode: row.ICAOTypeCode || null,
              type: row.Type || null,
              manufacturer: row.Manufacturer || null,
              operatorFlagCode: row.OperatorFlagCode || null,
              serialNo: row.SerialNo || null,
              yearBuilt: row.YearBuilt || null,
              owner: row.RegisteredOwners || null,
              country: row.Country || null
            };
            
            // Cache the result
            this.aircraftRegistry.set(icao24Upper, aircraft);
            resolve(aircraft);
          } else {
            resolve(null);
          }
        });
      });
    }

    return null;
  }

  /**
   * Search aircraft in registry
   */
  async searchAircraft(parameters = {}) {
    if (!this.baseStationDb) {
      return { aircraft: [], count: 0 };
    }

    try {
      let query = `
        SELECT 
          ModeS, Registration, ICAOTypeCode, Type, Manufacturer,
          OperatorFlagCode, SerialNo, YearBuilt, RegisteredOwners, Country
        FROM Aircraft 
        WHERE ModeS IS NOT NULL AND ModeS != ''
      `;
      
      const params = [];
      
      if (parameters.registration) {
        query += ` AND Registration LIKE ?`;
        params.push(`%${parameters.registration}%`);
      }
      
      if (parameters.manufacturer) {
        query += ` AND Manufacturer LIKE ?`;
        params.push(`%${parameters.manufacturer}%`);
      }
      
      if (parameters.type) {
        query += ` AND Type LIKE ?`;
        params.push(`%${parameters.type}%`);
      }
      
      if (parameters.icaoTypeCode) {
        query += ` AND ICAOTypeCode LIKE ?`;
        params.push(`%${parameters.icaoTypeCode}%`);
      }
      
      if (parameters.country) {
        query += ` AND Country LIKE ?`;
        params.push(`%${parameters.country}%`);
      }
      
      query += ` ORDER BY Registration LIMIT ?`;
      params.push(parameters.limit || 100);
      
      return new Promise((resolve, reject) => {
        this.baseStationDb.all(query, params, (err, rows) => {
          if (err) {
            this.logger.error('Failed to search aircraft', { error: err.message });
            resolve({ aircraft: [], count: 0 });
          } else {
            const aircraft = rows.map(row => ({
              icao24: row.ModeS.toUpperCase(),
              registration: row.Registration || null,
              icaoTypeCode: row.ICAOTypeCode || null,
              type: row.Type || null,
              manufacturer: row.Manufacturer || null,
              operatorFlagCode: row.OperatorFlagCode || null,
              serialNo: row.SerialNo || null,
              yearBuilt: row.YearBuilt || null,
              owner: row.RegisteredOwners || null,
              country: row.Country || null
            }));
            
            resolve({ aircraft, count: aircraft.length });
          }
        });
      });
    } catch (error) {
      this.logger.error('Failed to search aircraft', { error: error.message });
      return { aircraft: [], count: 0 };
    }
  }

  /**
   * Get aircraft position history
   */
  async getAircraftHistory(icao24, hours = 24) {
    if (!this.config.enableTracking || !this.babelfishDb) {
      return [];
    }

    const query = `
      SELECT * FROM aircraft_positions 
      WHERE icao24 = ? 
      AND timestamp >= datetime('now', '-${hours} hours')
      ORDER BY timestamp DESC
    `;

    try {
      return await this.getAllQuery(query, [icao24]);
    } catch (error) {
      this.logger.error('Failed to get aircraft history', { icao24, error: error.message });
      return [];
    }
  }

  /**
   * Get recent aircraft events
   */
  async getRecentEvents(hours = 24, eventType = null) {
    if (!this.config.enableTracking || !this.babelfishDb) {
      return [];
    }

    let query = `
      SELECT * FROM aircraft_events 
      WHERE timestamp >= datetime('now', '-${hours} hours')
    `;
    
    const params = [];
    
    if (eventType) {
      query += ` AND event_type = ?`;
      params.push(eventType);
    }
    
    query += ` ORDER BY timestamp DESC`;

    try {
      return await this.getAllQuery(query, params);
    } catch (error) {
      this.logger.error('Failed to get recent events', { error: error.message });
      return [];
    }
  }

  /**
   * Get statistics
   */
  async getStats() {
    if (!this.config.enableTracking || !this.babelfishDb) {
      return this.stats;
    }

    try {
      const queries = [
        'SELECT COUNT(*) as count FROM aircraft_positions WHERE timestamp >= datetime("now", "-1 hour")',
        'SELECT COUNT(*) as count FROM aircraft_flights WHERE status = "active"',
        'SELECT COUNT(*) as count FROM aircraft_events WHERE timestamp >= datetime("now", "-1 hour")'
      ];

      const results = await Promise.all(queries.map(query => this.getQuery(query)));
      
      return {
        ...this.stats,
        positionsLastHour: results[0]?.count || 0,
        activeFlights: results[1]?.count || 0,
        eventsLastHour: results[2]?.count || 0
      };
    } catch (error) {
      this.logger.error('Failed to get statistics', { error: error.message });
      return this.stats;
    }
  }

  /**
   * Run a query
   */
  async runQuery(query, params = []) {
    return new Promise((resolve, reject) => {
      this.babelfishDb.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  /**
   * Get a single row
   */
  async getQuery(query, params = []) {
    return new Promise((resolve, reject) => {
      this.babelfishDb.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get all rows
   */
  async getAllQuery(query, params = []) {
    return new Promise((resolve, reject) => {
      this.babelfishDb.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanupOldData();
    }, this.config.cleanupInterval);
  }

  /**
   * Cleanup old data
   */
  async cleanupOldData() {
    if (!this.config.enableTracking || !this.babelfishDb) return;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.maxHistoryDays);

      const queries = [
        `DELETE FROM aircraft_positions WHERE timestamp < ?`,
        `DELETE FROM aircraft_events WHERE timestamp < ?`,
        `UPDATE aircraft_flights SET status = 'completed' WHERE end_time < ? AND status = 'active'`
      ];

      for (const query of queries) {
        await this.runQuery(query, [cutoffDate.toISOString()]);
      }

      this.logger.info('Cleaned up old aircraft data', { cutoffDate: cutoffDate.toISOString() });
    } catch (error) {
      this.logger.error('Failed to cleanup old data', { error: error.message });
    }
  }

  /**
   * Close database connections
   */
  async close() {
    if (this.baseStationDb) {
      this.baseStationDb.close();
    }
    if (this.babelfishDb) {
      this.babelfishDb.close();
    }
    this.logger.info('Aircraft Data Service closed');
  }

  /**
   * Start a new flight in BaseStation.sqb Flights table
   */
  async startFlightInBaseStation({ sessionId, aircraftId, startTime, callsign, pos }) {
    if (!this.config.enableBaseStationFlightLogging || !this.baseStationDb) return null;
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO Flights (
          SessionID, AircraftID, StartTime, Callsign, FirstLat, FirstLon, FirstAltitude, FirstGroundSpeed, FirstVerticalRate, FirstTrack, FirstSquawk, FirstIsOnGround
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        sessionId,
        aircraftId,
        startTime,
        callsign || null,
        pos?.lat || null,
        pos?.lon || null,
        pos?.altitude || null,
        pos?.speed || null,
        pos?.vertical_rate || null,
        pos?.track || null,
        pos?.squawk || null,
        pos?.isOnGround ? 1 : 0
      ];
      this.baseStationDb.run(query, params, function(err) {
        if (err) {
          resolve(null);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * End a flight in BaseStation.sqb Flights table
   */
  async endFlightInBaseStation({ flightId, endTime, pos }) {
    if (!this.config.enableBaseStationFlightLogging || !this.baseStationDb) return;
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE Flights SET 
          EndTime = ?,
          LastLat = ?,
          LastLon = ?,
          LastAltitude = ?,
          LastGroundSpeed = ?,
          LastVerticalRate = ?,
          LastTrack = ?,
          LastSquawk = ?,
          LastIsOnGround = ?
        WHERE FlightID = ?
      `;
      const params = [
        endTime,
        pos?.lat || null,
        pos?.lon || null,
        pos?.altitude || null,
        pos?.speed || null,
        pos?.vertical_rate || null,
        pos?.track || null,
        pos?.squawk || null,
        pos?.isOnGround ? 1 : 0,
        flightId
      ];
      this.baseStationDb.run(query, params, function(err) {
        resolve(!err);
      });
    });
  }

  /**
   * Log a position update for a flight in BaseStation.sqb Flights table
   * (Updates Last* fields for the flight)
   */
  async logFlightPositionInBaseStation({ flightId, pos }) {
    if (!this.config.enableBaseStationFlightLogging || !this.baseStationDb) return;
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE Flights SET 
          LastLat = ?,
          LastLon = ?,
          LastAltitude = ?,
          LastGroundSpeed = ?,
          LastVerticalRate = ?,
          LastTrack = ?,
          LastSquawk = ?,
          LastIsOnGround = ?
        WHERE FlightID = ?
      `;
      const params = [
        pos?.lat || null,
        pos?.lon || null,
        pos?.altitude || null,
        pos?.speed || null,
        pos?.vertical_rate || null,
        pos?.track || null,
        pos?.squawk || null,
        pos?.isOnGround ? 1 : 0,
        flightId
      ];
      this.baseStationDb.run(query, params, function(err) {
        resolve(!err);
      });
    });
  }
}

module.exports = AircraftDataService; 