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

  // Security Configuration
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    },
    helmet: {
      enabled: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "ws:"]
        }
      }
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
      threshold: parseFloat(process.env.SPEED_ALERT_THRESHOLD) || 100, // km/h
      severity: {
        high: parseFloat(process.env.SPEED_ALERT_HIGH) || 120,
        medium: parseFloat(process.env.SPEED_ALERT_MEDIUM) || 100
      }
    }
  },

  // Database Configuration (for future use)
  database: {
    enabled: process.env.DB_ENABLED === 'true',
    type: process.env.DB_TYPE || 'sqlite',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    name: process.env.DB_NAME || 'babelfish',
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD
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