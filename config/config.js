require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
    killPort: process.env.KILL_PORT === 'true' || true,
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }
  },

  // Unifi Protect Configuration
  unifi: {
    // Default device configuration (can be overridden per device)
    default: {
      host: process.env.UNIFI_HOST || '10.0.0.1',
      port: process.env.UNIFI_PORT || 443,
      protocol: process.env.UNIFI_PROTOCOL || 'https',
      apiKey: process.env.UNIFI_API_KEY || 'wye3aapIuxAz2omKg4WFdCSncRBfSzPx',
      username: process.env.UNIFI_USERNAME,
      password: process.env.UNIFI_PASSWORD,
      verifySSL: process.env.UNIFI_VERIFY_SSL !== 'false',
      timeout: parseInt(process.env.UNIFI_TIMEOUT) || 10000
    },
    
    // Multiple device support
    devices: [
      {
        id: 'communications-van',
        name: 'Communications Van',
        host: '10.0.0.1',
        port: 443,
        protocol: 'https',
        apiKey: 'wye3aapIuxAz2omKg4WFdCSncRBfSzPx',
        verifySSL: false,
        description: 'Primary Unifi Protect system in communications van'
      }
      // Add more devices as needed
    ]
  },

  // MQTT Configuration (for future broker functionality)
  mqtt: {
    enabled: process.env.MQTT_ENABLED === 'true',
    broker: {
      host: process.env.MQTT_BROKER_HOST || 'localhost',
      port: parseInt(process.env.MQTT_BROKER_PORT) || 1883,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: process.env.MQTT_CLIENT_ID || 'babelfish-lookingglass'
    },
    topics: {
      events: 'unifi/events',
      cameras: 'unifi/cameras',
      system: 'unifi/system',
      control: 'unifi/control'
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: process.env.LOG_FILE || 'logs/babelfish.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  },

  // Dashboard Configuration
  dashboard: {
    enabled: process.env.DASHBOARD_ENABLED !== 'false',
    refreshInterval: parseInt(process.env.DASHBOARD_REFRESH_INTERVAL) || 5000,
    maxEvents: parseInt(process.env.DASHBOARD_MAX_EVENTS) || 100,
    maxAlerts: parseInt(process.env.DASHBOARD_MAX_ALERTS) || 50,
    retentionHours: parseInt(process.env.DASHBOARD_RETENTION_HOURS) || 24,
    realTimeUpdates: {
      enabled: process.env.DASHBOARD_REALTIME_ENABLED !== 'false',
      maxSubscribers: parseInt(process.env.DASHBOARD_MAX_SUBSCRIBERS) || 100
    },
    speedAlerts: {
      enabled: process.env.SPEED_ALERTS_ENABLED !== 'false',
      threshold: parseInt(process.env.SPEED_ALERT_THRESHOLD) || 30,
      cooldownMinutes: parseInt(process.env.SPEED_ALERT_COOLDOWN) || 5
    }
  },

  // Health Monitoring Configuration
  health: {
    enabled: process.env.HEALTH_MONITORING_ENABLED !== 'false',
    checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
    memoryThreshold: parseFloat(process.env.HEALTH_MEMORY_THRESHOLD) || 0.8, // 80%
    cpuThreshold: parseFloat(process.env.HEALTH_CPU_THRESHOLD) || 0.7, // 70%
    diskThreshold: parseFloat(process.env.HEALTH_DISK_THRESHOLD) || 0.9, // 90%
    connectionThreshold: parseInt(process.env.HEALTH_CONNECTION_THRESHOLD) || 1000,
    errorThreshold: parseInt(process.env.HEALTH_ERROR_THRESHOLD) || 100,
    alertRetention: parseInt(process.env.HEALTH_ALERT_RETENTION) || 10
  },

  // Security Configuration
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    },
    strictRateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.STRICT_RATE_LIMIT_MAX) || 10, // limit each IP to 10 requests per windowMs
      message: 'Too many requests to sensitive endpoint, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    },
    helmet: {
      enabled: process.env.HELMET_ENABLED !== 'false',
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'", "https:", "data:", "https://cdnjs.cloudflare.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    },
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
        
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    },
    apiKeys: process.env.API_KEYS?.split(',') || [],
    requestValidation: {
      enabled: process.env.REQUEST_VALIDATION_ENABLED !== 'false',
      strictMode: process.env.REQUEST_VALIDATION_STRICT === 'true'
    }
  },

  // API Configuration
  api: {
    version: 'v1',
    prefix: '/api',
    timeout: parseInt(process.env.API_TIMEOUT) || 30000,
    retries: parseInt(process.env.API_RETRIES) || 3
  },

  // WebSocket Configuration
  websocket: {
    enabled: true,
    pingInterval: 25000,
    pingTimeout: 5000,
    maxPayload: 16 * 1024 * 1024 // 16MB
  },

  // Event Processing Configuration
  events: {
    batchSize: parseInt(process.env.EVENT_BATCH_SIZE) || 100,
    processingInterval: parseInt(process.env.EVENT_PROCESSING_INTERVAL) || 5000,
    retentionDays: parseInt(process.env.EVENT_RETENTION_DAYS) || 30,
    realTimeUpdates: process.env.REAL_TIME_UPDATES !== 'false'
  },

  // Cache Configuration
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes
    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000
  },

  // Flow System Configuration
  flow: {
    enabled: process.env.FLOW_ENABLED !== 'false',
    eventBus: {
      maxEvents: parseInt(process.env.EVENT_BUS_MAX_EVENTS) || 1000,
      processingInterval: parseInt(process.env.EVENT_BUS_PROCESSING_INTERVAL) || 100
    },
    ruleEngine: {
      maxRules: parseInt(process.env.RULE_ENGINE_MAX_RULES) || 100,
      executionTimeout: parseInt(process.env.RULE_EXECUTION_TIMEOUT) || 30000
    },
    actionFramework: {
      maxActions: parseInt(process.env.ACTION_FRAMEWORK_MAX_ACTIONS) || 50,
      executionTimeout: parseInt(process.env.ACTION_EXECUTION_TIMEOUT) || 10000
    },
    orchestrator: {
      maxFlows: parseInt(process.env.ORCHESTRATOR_MAX_FLOWS) || 50,
      flowExecutionTimeout: parseInt(process.env.FLOW_EXECUTION_TIMEOUT) || 60000
    }
  },

  // Entity Management Configuration
  entities: {
    enabled: process.env.ENTITIES_ENABLED !== 'false',
    autoDiscovery: {
      enabled: process.env.ENTITY_AUTO_DISCOVERY_ENABLED !== 'false',
      refreshInterval: parseInt(process.env.ENTITY_DISCOVERY_REFRESH_INTERVAL) || 300000
    },
    storage: {
      type: process.env.ENTITY_STORAGE_TYPE || 'memory',
      maxEntities: parseInt(process.env.ENTITY_STORAGE_MAX_ENTITIES) || 1000
    }
  },

  // Analytics and Zone Management Configuration
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED !== 'false',
    zoneManager: {
      enabled: process.env.ZONE_MANAGER_ENABLED !== 'false',
      maxZones: parseInt(process.env.ZONE_MANAGER_MAX_ZONES) || 100,
      maxZoneCameras: parseInt(process.env.ZONE_MANAGER_MAX_CAMERAS) || 50,
      analyticsRetention: parseInt(process.env.ZONE_ANALYTICS_RETENTION) || 1000
    },
    analyticsEngine: {
      enabled: process.env.ANALYTICS_ENGINE_ENABLED !== 'false',
      maxEvents: parseInt(process.env.ANALYTICS_MAX_EVENTS) || 10000,
      maxPlateTracking: parseInt(process.env.ANALYTICS_MAX_PLATES) || 1000,
      speedCalculation: {
        enabled: process.env.SPEED_CALCULATION_ENABLED !== 'false',
        minTimeBetweenDetections: parseInt(process.env.SPEED_MIN_TIME) || 1000, // 1 second
        maxTimeBetweenDetections: parseInt(process.env.SPEED_MAX_TIME) || 300000 // 5 minutes
      },
      peopleCounting: {
        enabled: process.env.PEOPLE_COUNTING_ENABLED !== 'false',
        maxOccupancyHistory: parseInt(process.env.OCCUPANCY_HISTORY_MAX) || 1000
      }
    },
    plateRecognition: {
      enabled: process.env.PLATE_RECOGNITION_ENABLED !== 'false',
      confidenceThreshold: parseFloat(process.env.PLATE_CONFIDENCE_THRESHOLD) || 0.8,
      maxTrackingTime: parseInt(process.env.PLATE_MAX_TRACKING_TIME) || 3600000 // 1 hour
    }
  },

  // Speed Calculation System Configuration
  speedCalculation: {
    enabled: process.env.SPEED_CALCULATION_ENABLED !== 'false',
    minTimeBetweenDetections: parseInt(process.env.SPEED_MIN_TIME) || 1000, // 1 second
    maxTimeBetweenDetections: parseInt(process.env.SPEED_MAX_TIME) || 300000, // 5 minutes
    minSpeedThreshold: parseInt(process.env.SPEED_MIN_THRESHOLD) || 5, // 5 km/h
    maxSpeedThreshold: parseInt(process.env.SPEED_MAX_THRESHOLD) || 200, // 200 km/h
    confidenceThreshold: parseFloat(process.env.SPEED_CONFIDENCE_THRESHOLD) || 0.8,
    retentionHours: parseInt(process.env.SPEED_RETENTION_HOURS) || 24,
    alerts: {
      enabled: process.env.SPEED_ALERTS_ENABLED !== 'false',
      threshold: parseInt(process.env.SPEED_ALERT_THRESHOLD) || 100, // km/h
      highThreshold: parseInt(process.env.SPEED_ALERT_HIGH) || 120, // km/h
      mediumThreshold: parseInt(process.env.SPEED_ALERT_MEDIUM) || 100 // km/h
    },
    realTimeUpdates: process.env.SPEED_REALTIME_UPDATES !== 'false',
    webGuiIntegration: process.env.SPEED_WEBGUI_INTEGRATION !== 'false'
  },

  // Airport Vector Service Configuration
  airportVector: {
    enabled: process.env.AIRPORT_VECTOR_ENABLED !== 'false',
    dataPath: process.env.AIRPORT_VECTOR_DATA_PATH || './config',
    autoLoad: process.env.AIRPORT_VECTOR_AUTO_LOAD !== 'false'
  },

  // Coastline Vector Service Configuration
  coastlineVector: {
    enabled: process.env.COASTLINE_VECTOR_ENABLED !== 'false',
    dataPath: process.env.COASTLINE_VECTOR_DATA_PATH || './aviationdata',
    autoLoad: process.env.COASTLINE_VECTOR_AUTO_LOAD !== 'false',
    spatialIndex: {
      gridSize: parseFloat(process.env.COASTLINE_GRID_SIZE) || 1.0, // degrees
      enabled: process.env.COASTLINE_SPATIAL_INDEX !== 'false'
    },
    display: {
      defaultColor: process.env.COASTLINE_DEFAULT_COLOR || '#0066cc',
      defaultWidth: parseInt(process.env.COASTLINE_DEFAULT_WIDTH) || 2,
      defaultOpacity: parseFloat(process.env.COASTLINE_DEFAULT_OPACITY) || 0.8
    }
  },

  // Airspace Service Configuration
  airspace: {
    enabled: process.env.AIRSPACE_ENABLED !== 'false',
    airspaceDataPath: process.env.AIRSPACE_DATA_PATH || './aviationdata/OUT_UK_Airspace',
    enableAirspaceAwareness: process.env.AIRSPACE_AWARENESS_ENABLED !== 'false',
    airspaceTypes: process.env.AIRSPACE_TYPES?.split(',') || ['FA', 'ATZ', 'CTA', 'CTR', 'DA', 'FIR', 'LARS', 'MIL'],
    logLevel: process.env.AIRSPACE_LOG_LEVEL || 'info',
    display: {
      defaultColor: process.env.AIRSPACE_DEFAULT_COLOR || '#ff0000',
      defaultOpacity: parseFloat(process.env.AIRSPACE_DEFAULT_OPACITY) || 0.3,
      showLabels: process.env.AIRSPACE_SHOW_LABELS !== 'false',
      showBoundaries: process.env.AIRSPACE_SHOW_BOUNDARIES !== 'false'
    },
    performance: {
      maxAirspaces: parseInt(process.env.AIRSPACE_MAX_AIRSPACES) || 10000,
      spatialIndexEnabled: process.env.AIRSPACE_SPATIAL_INDEX !== 'false',
      cacheEnabled: process.env.AIRSPACE_CACHE_ENABLED !== 'false'
    }
  },

  // Vector Optimization Service Configuration
  vectorOptimization: {
    enabled: process.env.VECTOR_OPTIMIZATION_ENABLED !== 'false',
    maxPolygonPoints: parseInt(process.env.VECTOR_MAX_POLYGON_POINTS) || 1000,
    simplificationTolerance: parseFloat(process.env.VECTOR_SIMPLIFICATION_TOLERANCE) || 0.001,
    optimizationLevel: process.env.VECTOR_OPTIMIZATION_LEVEL || 'medium', // low, medium, high
    display: {
      defaultColors: {
        'CTR': '#ff0000',
        'CTA': '#ff6600',
        'TMA': '#ff9900',
        'ATZ': '#ffff00',
        'FA': '#00ff00',
        'DA': '#ff00ff',
        'FIR': '#00ffff',
        'LARS': '#0000ff',
        'MIL': '#800080'
      }
    }
  },

  // Database Configuration
  database: {
    path: process.env.DATABASE_PATH || 'data/babelfish.db',
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS) || 10,
    connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT) || 30000,
    queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT) || 10000,
    enableWAL: process.env.DATABASE_ENABLE_WAL !== 'false',
    enableForeignKeys: process.env.DATABASE_ENABLE_FOREIGN_KEYS !== 'false',
    journalMode: process.env.DATABASE_JOURNAL_MODE || 'WAL',
    synchronous: process.env.DATABASE_SYNCHRONOUS || 'NORMAL',
    cacheSize: parseInt(process.env.DATABASE_CACHE_SIZE) || 10000,
    tempStore: process.env.DATABASE_TEMP_STORE || 'MEMORY'
  }
};

// Environment-specific overrides
if (config.server.environment === 'production') {
  config.security.helmet.enabled = true;
  config.logging.level = 'warn';
  config.cache.enabled = true;
  config.analytics.enabled = true;
  config.dashboard.enabled = true;
} else if (config.server.environment === 'development') {
  config.security.helmet.enabled = false;
  config.logging.level = 'debug';
  config.cache.enabled = false;
  config.analytics.enabled = true;
  config.dashboard.enabled = true;
}

module.exports = config; 