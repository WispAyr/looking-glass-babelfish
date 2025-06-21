const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const winston = require('winston');
const { promisify } = require('util');

/**
 * Enhanced Database Service
 * 
 * Provides connection pooling, query optimization, and better error handling
 * for improved performance and reliability.
 */
class DatabaseService {
  constructor(config = {}) {
    this.config = {
      databasePath: config.databasePath || path.join(__dirname, '../data/babelfish.db'),
      maxConnections: config.maxConnections || 10,
      connectionTimeout: config.connectionTimeout || 30000,
      queryTimeout: config.queryTimeout || 10000,
      enableWAL: config.enableWAL !== false,
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

    // Connection pool
    this.connectionPool = [];
    this.activeConnections = 0;
    this.maxConnections = this.config.maxConnections;

    // Query statistics
    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      lastQueryTime: null
    };

    // Prepared statements cache
    this.preparedStatements = new Map();

    this.logger.info('Database Service initialized', this.config);
  }

  /**
   * Initialize database
   */
  async initialize() {
    try {
      // Create database directory if it doesn't exist
      const dbDir = path.dirname(this.config.databasePath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize database with WAL mode for better concurrency
      await this.createTables();
      
      if (this.config.enableWAL) {
        await this.enableWALMode();
      }

      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get database connection from pool
   */
  async getConnection() {
    // Return existing connection if available
    if (this.connectionPool.length > 0) {
      const connection = this.connectionPool.pop();
      this.activeConnections++;
      return connection;
    }

    // Create new connection if under limit
    if (this.activeConnections < this.maxConnections) {
      const connection = await this.createConnection();
      this.activeConnections++;
      return connection;
    }

    // Wait for connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Database connection timeout'));
      }, this.config.connectionTimeout);

      const checkConnection = () => {
        if (this.connectionPool.length > 0) {
          clearTimeout(timeout);
          const connection = this.connectionPool.pop();
          this.activeConnections++;
          resolve(connection);
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(connection) {
    if (connection && this.activeConnections > 0) {
      this.connectionPool.push(connection);
      this.activeConnections--;
    }
  }

  /**
   * Create new database connection
   */
  async createConnection() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.config.databasePath, (err) => {
        if (err) {
          reject(err);
        } else {
          // Configure connection
          db.configure('busyTimeout', this.config.queryTimeout);
          resolve(db);
        }
      });
    });
  }

  /**
   * Execute query with connection pooling
   */
  async executeQuery(sql, params = []) {
    const startTime = Date.now();
    let connection;

    try {
      connection = await this.getConnection();
      const query = promisify(connection.all.bind(connection));
      
      const result = await query(sql, params);
      
      // Update statistics
      const duration = Date.now() - startTime;
      this.updateQueryStats(true, duration);
      
      if (duration > 1000) { // Log slow queries
        this.logger.warn('Slow query detected', { sql, duration, params });
        this.stats.slowQueries++;
      }

      return result;
    } catch (error) {
      this.updateQueryStats(false, Date.now() - startTime);
      this.logger.error('Query execution failed:', { sql, params, error: error.message });
      throw error;
    } finally {
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * Execute single row query
   */
  async executeSingleQuery(sql, params = []) {
    const startTime = Date.now();
    let connection;

    try {
      connection = await this.getConnection();
      const query = promisify(connection.get.bind(connection));
      
      const result = await query(sql, params);
      
      const duration = Date.now() - startTime;
      this.updateQueryStats(true, duration);
      
      return result;
    } catch (error) {
      this.updateQueryStats(false, Date.now() - startTime);
      this.logger.error('Single query execution failed:', { sql, params, error: error.message });
      throw error;
    } finally {
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * Execute transaction
   */
  async executeTransaction(queries) {
    const startTime = Date.now();
    let connection;

    try {
      connection = await this.getConnection();
      const run = promisify(connection.run.bind(connection));
      
      await run('BEGIN TRANSACTION');
      
      const results = [];
      for (const query of queries) {
        const result = await run(query.sql, query.params || []);
        results.push(result);
      }
      
      await run('COMMIT');
      
      const duration = Date.now() - startTime;
      this.updateQueryStats(true, duration);
      
      return results;
    } catch (error) {
      if (connection) {
        try {
          await promisify(connection.run.bind(connection))('ROLLBACK');
        } catch (rollbackError) {
          this.logger.error('Transaction rollback failed:', rollbackError);
        }
      }
      
      this.updateQueryStats(false, Date.now() - startTime);
      this.logger.error('Transaction failed:', { queries, error: error.message });
      throw error;
    } finally {
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * Update query statistics
   */
  updateQueryStats(success, duration) {
    this.stats.totalQueries++;
    this.stats.lastQueryTime = new Date().toISOString();
    
    if (success) {
      this.stats.successfulQueries++;
      this.stats.averageQueryTime = 
        (this.stats.averageQueryTime * (this.stats.successfulQueries - 1) + duration) / 
        this.stats.successfulQueries;
    } else {
      this.stats.failedQueries++;
    }
  }

  /**
   * Create database tables
   */
  async createTables() {
    const tables = [
      // Connectors table
      `CREATE TABLE IF NOT EXISTS connectors (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT,
        status TEXT DEFAULT 'disconnected',
        capabilities TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Entities table
      `CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        connector_id TEXT,
        properties TEXT,
        location TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (connector_id) REFERENCES connectors(id)
      )`,

      // Events table
      `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE
      )`,

      // Analytics table
      `CREATE TABLE IF NOT EXISTS analytics (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        entity_id TEXT,
        data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entity_id) REFERENCES entities(id)
      )`,

      // Rules table
      `CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        conditions TEXT,
        actions TEXT,
        enabled BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Maps table
      `CREATE TABLE IF NOT EXISTS maps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config TEXT,
        elements TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Configurations table
      `CREATE TABLE IF NOT EXISTS configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category, name, version)
      )`
    ];

    for (const table of tables) {
      await this.executeQuery(table);
    }
  }

  /**
   * Enable WAL mode for better concurrency
   */
  async enableWALMode() {
    try {
      await this.executeQuery('PRAGMA journal_mode=WAL');
      await this.executeQuery('PRAGMA synchronous=NORMAL');
      await this.executeQuery('PRAGMA cache_size=10000');
      await this.executeQuery('PRAGMA temp_store=MEMORY');
      this.logger.info('WAL mode enabled');
    } catch (error) {
      this.logger.warn('Failed to enable WAL mode:', error);
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    const stats = await this.executeQuery(`
      SELECT 
        (SELECT COUNT(*) FROM connectors) as connector_count,
        (SELECT COUNT(*) FROM entities) as entity_count,
        (SELECT COUNT(*) FROM events) as event_count,
        (SELECT COUNT(*) FROM analytics) as analytics_count,
        (SELECT COUNT(*) FROM rules) as rule_count,
        (SELECT COUNT(*) FROM maps) as map_count
    `);

    return {
      ...this.stats,
      activeConnections: this.activeConnections,
      poolSize: this.connectionPool.length,
      databaseStats: stats[0] || {}
    };
  }

  /**
   * Close all connections
   */
  async close() {
    this.logger.info('Closing database connections...');
    
    // Close all connections in pool
    for (const connection of this.connectionPool) {
      connection.close();
    }
    
    this.connectionPool = [];
    this.activeConnections = 0;
    
    this.logger.info('Database connections closed');
  }

  /**
   * Execute run query (INSERT, UPDATE, DELETE)
   */
  async run(sql, params = []) {
    const startTime = Date.now();
    let connection;

    try {
      connection = await this.getConnection();
      const query = promisify(connection.run.bind(connection));
      
      const result = await query(sql, params);
      
      const duration = Date.now() - startTime;
      this.updateQueryStats(true, duration);
      
      return result;
    } catch (error) {
      this.updateQueryStats(false, Date.now() - startTime);
      this.logger.error('Run query execution failed:', { sql, params, error: error.message });
      throw error;
    } finally {
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * Alias for executeQuery (for compatibility)
   */
  async all(sql, params = []) {
    return this.executeQuery(sql, params);
  }

  /**
   * Get configuration from database
   */
  async getConfiguration(category, name) {
    const sql = 'SELECT * FROM configurations WHERE category = ? AND name = ? ORDER BY version DESC LIMIT 1';
    const result = await this.executeSingleQuery(sql, [category, name]);
    
    if (result) {
      return {
        ...result,
        config: JSON.parse(result.config)
      };
    }
    
    return null;
  }

  /**
   * Save configuration to database
   */
  async saveConfiguration(category, name, config) {
    const sql = `
      INSERT INTO configurations (category, name, config, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const now = new Date().toISOString();
    const configJson = JSON.stringify(config);
    
    return this.run(sql, [category, name, configJson, 1, now, now]);
  }
}

module.exports = DatabaseService; 