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
      apiKey: process.env.UNIFI_API_KEY || '6pXhUX2-hnWonI8abmazH4kGRdVLp4r8',
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
        apiKey: '6pXhUX2-hnWonI8abmazH4kGRdVLp4r8',
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
} else if (config.server.environment === 'development') {
  config.security.helmet.enabled = false;
  config.logging.level = 'debug';
  config.cache.enabled = false;
}

module.exports = config; 