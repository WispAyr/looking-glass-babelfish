# Configuration System

## Overview

The Configuration System provides a centralized, flexible, and extensible way to manage all aspects of the Looking Glass platform. It supports multiple configuration sources, validation, and dynamic updates.

## Configuration Sources

### Environment Variables
Configuration can be provided via environment variables for easy deployment:

```bash
# Database Configuration
DATABASE_PATH=data/babelfish.db
DATABASE_BACKUP_ENABLED=true
DATABASE_BACKUP_INTERVAL=86400000

# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=logs/babelfish.log

# Health Monitoring
HEALTH_CHECK_INTERVAL=30000
HEALTH_MEMORY_THRESHOLD=0.8
HEALTH_CPU_THRESHOLD=0.7
HEALTH_DISK_THRESHOLD=0.9

# Connector Configuration
UNIFI_HOST=192.168.1.100
UNIFI_PORT=443
UNIFI_API_KEY=your-api-key
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=user
MQTT_PASSWORD=password
TELEGRAM_BOT_TOKEN=your-bot-token
```

### Configuration Files

#### Main Configuration File
```javascript
// config/config.js
module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    cors: {
      enabled: true,
      origin: ['http://localhost:3000', 'https://yourdomain.com']
    },
    rateLimit: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  },

  // Database Configuration
  database: {
    path: process.env.DATABASE_PATH || 'data/babelfish.db',
    backup: {
      enabled: process.env.DATABASE_BACKUP_ENABLED === 'true',
      interval: parseInt(process.env.DATABASE_BACKUP_INTERVAL) || 86400000,
      path: 'data/backups/'
    },
    connectionPool: {
      maxConnections: 10,
      minConnections: 2,
      acquireTimeout: 60000,
      idleTimeout: 300000
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: process.env.LOG_FILE || 'logs/babelfish.log',
    maxSize: '10m',
    maxFiles: 5
  },

  // Health Monitoring
  health: {
    enabled: true,
    checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    thresholds: {
      memory: parseFloat(process.env.HEALTH_MEMORY_THRESHOLD) || 0.8,
      cpu: parseFloat(process.env.HEALTH_CPU_THRESHOLD) || 0.7,
      disk: parseFloat(process.env.HEALTH_DISK_THRESHOLD) || 0.9
    },
    alertRetention: 10,
    metricsRetention: 7
  },

  // Flow System
  flow: {
    enabled: true,
    eventBus: {
      maxEvents: 1000,
      processingInterval: 100
    },
    ruleEngine: {
      maxRules: 100,
      executionTimeout: 30000
    },
    actionFramework: {
      maxActions: 50,
      executionTimeout: 10000
    },
    orchestrator: {
      maxFlows: 50,
      flowExecutionTimeout: 60000
    }
  },

  // Analytics System
  analytics: {
    enabled: true,
    retention: {
      events: 30, // days
      analytics: 90, // days
      speedCalculations: 365 // days
    },
    zones: {
      maxZones: 100,
      maxCamerasPerZone: 50
    }
  },

  // Map System
  map: {
    enabled: true,
    autoRegisterConnectors: true,
    enableWebSockets: true,
    defaultCenter: {
      lat: 51.5074,
      lon: -0.1278,
      zoom: 10
    }
  },

  // Speed Calculation
  speedCalculation: {
    enabled: true,
    minTimeBetweenDetections: 1000,
    maxTimeBetweenDetections: 300000,
    minSpeedThreshold: 5,
    maxSpeedThreshold: 200,
    confidenceThreshold: 0.8,
    alerts: {
      enabled: true,
      threshold: 100,
      highThreshold: 120
    }
  },

  // Radar System
  radar: {
    enabled: true,
    range: 50,
    center: {
      lat: 51.5074,
      lon: -0.1278
    },
    showTrails: true,
    trailLength: 20,
    sweepAnimation: true,
    sweepSpeed: 4
  },

  // GUI Configuration
  gui: {
    enabled: true,
    port: 3000,
    enableWebSockets: true,
    enableSSE: true,
    defaultTheme: 'dark',
    autoReload: true
  }
};
```

#### Connector Configuration
```json
// config/connectors.json
[
  {
    "id": "unifi-protect",
    "type": "unifi-protect",
    "name": "UniFi Protect System",
    "description": "Primary security camera system",
    "config": {
      "host": "192.168.1.100",
      "port": 443,
      "protocol": "https",
      "apiKey": "your-api-key",
      "verifySSL": true,
      "timeout": 10000
    },
    "capabilities": {
      "enabled": [
        "camera:management",
        "camera:video:stream",
        "camera:event:motion",
        "camera:event:smartdetect",
        "camera:recording:management"
      ],
      "disabled": [
        "system:users"
      ]
    },
    "metadata": {
      "version": "1.0.0",
      "author": "System Administrator",
      "tags": ["security", "video"]
    }
  },
  {
    "id": "mqtt-broker",
    "type": "mqtt",
    "name": "MQTT Broker",
    "description": "Primary MQTT broker for IoT communication",
    "config": {
      "host": "localhost",
      "port": 1883,
      "protocol": "mqtt",
      "clientId": "babelfish-client",
      "username": "user",
      "password": "password"
    },
    "capabilities": {
      "enabled": [
        "mqtt:publish",
        "mqtt:subscribe",
        "mqtt:topics"
      ]
    }
  },
  {
    "id": "telegram-bot",
    "type": "telegram",
    "name": "Telegram Bot",
    "description": "Notification and communication bot",
    "config": {
      "token": "your-bot-token",
      "mode": "polling",
      "pollingInterval": 1000,
      "pollingTimeout": 10
    },
    "capabilities": {
      "enabled": [
        "telegram:send",
        "telegram:receive",
        "telegram:keyboard"
      ]
    }
  },
  {
    "id": "adsb-tracker",
    "type": "adsb",
    "name": "ADSB Aircraft Tracker",
    "description": "Aircraft tracking and monitoring",
    "config": {
      "dataSource": "dump1090",
      "host": "localhost",
      "port": 30003,
      "protocol": "tcp",
      "range": 50,
      "center": {
        "lat": 51.5074,
        "lon": -0.1278
      }
    },
    "capabilities": {
      "enabled": [
        "adsb:aircraft",
        "adsb:radar",
        "adsb:zones"
      ]
    }
  },
  {
    "id": "aprs-tracker",
    "type": "aprs",
    "name": "APRS Station Tracker",
    "description": "APRS station and weather tracking",
    "config": {
      "apiKey": "your-aprs-api-key",
      "bounds": {
        "minLat": 49.0,
        "maxLat": 61.0,
        "minLon": -8.0,
        "maxLon": 2.0
      },
      "updateInterval": 30000
    },
    "capabilities": {
      "enabled": [
        "aprs:stations",
        "aprs:weather",
        "aprs:messages"
      ]
    }
  },
  {
    "id": "overwatch",
    "type": "overwatch",
    "name": "Event Orchestration System",
    "description": "Central event processing and orchestration",
    "config": {
      "enableEventProcessing": true,
      "enableFlowOrchestration": true,
      "enableRuleEngine": true,
      "maxEvents": 1000,
      "processingInterval": 100,
      "eventRetentionHours": 24,
      "healthCheckInterval": 30000,
      "autoConnect": true,
      "defaultConnectors": ["unifi-protect", "adsb", "aprs"]
    },
    "capabilities": {
      "enabled": [
        "overwatch:events",
        "overwatch:flows",
        "overwatch:rules",
        "overwatch:health"
      ]
    }
  }
]
```

#### Flow Configuration
```json
// config/flows.json
[
  {
    "id": "motion-alert-flow",
    "name": "Motion Alert Flow",
    "description": "Send motion alerts to Telegram",
    "enabled": true,
    "triggers": ["motion"],
    "conditions": {
      "confidence": { "operator": ">=", "value": 0.5 }
    },
    "actions": [
      {
        "type": "telegram:send",
        "parameters": {
          "chatId": "{{config.telegram.chatId}}",
          "message": "🚨 Motion detected on camera {{device}}\n\n📅 Time: {{timestamp}}\n🎯 Confidence: {{confidence}}%",
          "parseMode": "HTML"
        }
      }
    ],
    "errorHandling": {
      "retryCount": 3,
      "retryDelay": 5000,
      "onError": "continue"
    },
    "metadata": {
      "created": "2022-01-01T12:00:00.000Z",
      "updated": "2022-01-01T12:00:00.000Z",
      "version": "1.0.0"
    }
  },
  {
    "id": "emergency-aircraft-flow",
    "name": "Emergency Aircraft Alert",
    "description": "Alert on emergency aircraft",
    "enabled": true,
    "triggers": ["aircraft:emergency"],
    "conditions": {
      "squawk": { "operator": "in", "value": ["7500", "7600", "7700"] }
    },
    "actions": [
      {
        "type": "telegram:send",
        "parameters": {
          "chatId": "{{config.telegram.chatId}}",
          "message": "🚨 EMERGENCY AIRCRAFT DETECTED\n\n✈️ Callsign: {{callsign}}\n🆘 Squawk: {{squawk}}\n📍 Position: {{lat}}, {{lon}}\n🛩️ Altitude: {{altitude}}ft\n💨 Speed: {{speed}}kts",
          "parseMode": "HTML"
        }
      },
      {
        "type": "mqtt:publish",
        "parameters": {
          "topic": "aircraft/emergency",
          "message": {
            "icao24": "{{icao24}}",
            "callsign": "{{callsign}}",
            "squawk": "{{squawk}}",
            "timestamp": "{{timestamp}}"
          }
        }
      }
    ]
  }
]
```

#### Rule Configuration
```json
// config/rules.json
[
  {
    "id": "high-confidence-motion",
    "name": "High Confidence Motion Rule",
    "description": "Rule for high confidence motion events",
    "enabled": true,
    "conditions": {
      "eventType": "motion",
      "confidence": { "operator": ">=", "value": 0.8 }
    },
    "actions": [
      {
        "type": "telegram:send",
        "parameters": {
          "chatId": "{{config.telegram.chatId}}",
          "message": "🔍 High confidence motion detected on {{device}}"
        }
      }
    ],
    "priority": 1,
    "metadata": {
      "created": "2022-01-01T12:00:00.000Z",
      "updated": "2022-01-01T12:00:00.000Z"
    }
  },
  {
    "id": "connector-status-alert",
    "name": "Connector Status Alert",
    "description": "Alert when connector status changes",
    "enabled": true,
    "conditions": {
      "eventType": "connector:status",
      "status": { "operator": "!=", "value": "connected" }
    },
    "actions": [
      {
        "type": "telegram:send",
        "parameters": {
          "chatId": "{{config.telegram.chatId}}",
          "message": "⚠️ Connector {{connectorId}} status: {{status}}"
        }
      }
    ],
    "priority": 2
  }
]
```

#### Map Configuration
```json
// config/maps.json
[
  {
    "id": "main-map",
    "name": "Main Map System",
    "description": "Primary spatial visualization system",
    "config": {
      "autoRegisterConnectors": true,
      "enableWebSockets": true,
      "defaultCenter": {
        "lat": 51.5074,
        "lon": -0.1278,
        "zoom": 10
      },
      "layers": [
        {
          "id": "base-layer",
          "name": "Base Layer",
          "type": "tile",
          "url": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "enabled": true
        },
        {
          "id": "satellite-layer",
          "name": "Satellite Layer",
          "type": "tile",
          "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          "enabled": false
        }
      ]
    },
    "zones": [
      {
        "id": "zone-1",
        "name": "Main Entrance",
        "type": "security",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-0.128, 51.507],
            [-0.127, 51.507],
            [-0.127, 51.508],
            [-0.128, 51.508],
            [-0.128, 51.507]
          ]]
        },
        "properties": {
          "cameras": ["camera-1", "camera-2"],
          "alertThreshold": 0.7
        }
      }
    ]
  }
]
```

## Configuration Management

### Configuration Loading
The system loads configuration from multiple sources in order of priority:

1. **Environment Variables** (highest priority)
2. **Configuration Files** (config/*.js, config/*.json)
3. **Default Values** (lowest priority)

```javascript
// config/loader.js
class ConfigurationLoader {
  constructor() {
    this.config = {};
    this.sources = [];
  }

  async loadConfiguration() {
    // Load environment variables
    this.loadEnvironmentVariables();
    
    // Load configuration files
    await this.loadConfigurationFiles();
    
    // Apply defaults
    this.applyDefaults();
    
    // Validate configuration
    this.validateConfiguration();
    
    return this.config;
  }

  loadEnvironmentVariables() {
    // Load all environment variables with BABELFISH_ prefix
    Object.keys(process.env)
      .filter(key => key.startsWith('BABELFISH_'))
      .forEach(key => {
        const configKey = key.replace('BABELFISH_', '').toLowerCase();
        this.config[configKey] = process.env[key];
      });
  }

  async loadConfigurationFiles() {
    const configFiles = [
      'config/config.js',
      'config/connectors.json',
      'config/flows.json',
      'config/rules.json',
      'config/maps.json'
    ];

    for (const file of configFiles) {
      if (await this.fileExists(file)) {
        const config = await this.loadFile(file);
        this.mergeConfiguration(config);
      }
    }
  }

  applyDefaults() {
    this.config = {
      server: {
        port: 3000,
        host: '0.0.0.0',
        ...this.config.server
      },
      database: {
        path: 'data/babelfish.db',
        ...this.config.database
      },
      // ... other defaults
    };
  }

  validateConfiguration() {
    const errors = [];

    // Validate required fields
    if (!this.config.database?.path) {
      errors.push('Database path is required');
    }

    // Validate connector configurations
    if (this.config.connectors) {
      for (const connector of this.config.connectors) {
        const validation = this.validateConnectorConfig(connector);
        if (!validation.valid) {
          errors.push(`Connector ${connector.id}: ${validation.errors.join(', ')}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join('; ')}`);
    }
  }
}
```

### Configuration Validation

#### Connector Configuration Validation
```javascript
validateConnectorConfig(connector) {
  const errors = [];

  // Required fields
  if (!connector.id) {
    errors.push('Connector ID is required');
  }
  if (!connector.type) {
    errors.push('Connector type is required');
  }
  if (!connector.config) {
    errors.push('Connector configuration is required');
  }

  // Validate connector type
  const validTypes = [
    'unifi-protect',
    'mqtt',
    'telegram',
    'adsb',
    'aprs',
    'hikvision',
    'ankke-dvr',
    'llm',
    'map',
    'web-gui',
    'speed-calculation',
    'overwatch'
  ];

  if (!validTypes.includes(connector.type)) {
    errors.push(`Invalid connector type: ${connector.type}`);
  }

  // Type-specific validation
  switch (connector.type) {
    case 'unifi-protect':
      if (!connector.config.host) {
        errors.push('Host is required for UniFi Protect connector');
      }
      if (!connector.config.apiKey) {
        errors.push('API key is required for UniFi Protect connector');
      }
      break;
    case 'mqtt':
      if (!connector.config.host) {
        errors.push('Host is required for MQTT connector');
      }
      break;
    case 'telegram':
      if (!connector.config.token) {
        errors.push('Bot token is required for Telegram connector');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

#### Flow Configuration Validation
```javascript
validateFlowConfig(flow) {
  const errors = [];

  // Required fields
  if (!flow.id) {
    errors.push('Flow ID is required');
  }
  if (!flow.name) {
    errors.push('Flow name is required');
  }
  if (!flow.triggers || flow.triggers.length === 0) {
    errors.push('At least one trigger is required');
  }
  if (!flow.actions || flow.actions.length === 0) {
    errors.push('At least one action is required');
  }

  // Validate actions
  for (const action of flow.actions) {
    const actionValidation = this.validateActionConfig(action);
    if (!actionValidation.valid) {
      errors.push(`Action validation failed: ${actionValidation.errors.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Dynamic Configuration Updates

#### Runtime Configuration Updates
```javascript
class ConfigurationManager {
  constructor() {
    this.config = {};
    this.watchers = new Map();
  }

  async updateConfiguration(updates) {
    // Validate updates
    const validation = this.validateUpdates(updates);
    if (!validation.valid) {
      throw new Error(`Configuration update validation failed: ${validation.errors.join(', ')}`);
    }

    // Apply updates
    this.applyUpdates(updates);

    // Notify watchers
    this.notifyWatchers(updates);

    // Save to file
    await this.saveConfiguration();

    return { success: true };
  }

  watchConfiguration(path, callback) {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, []);
    }
    this.watchers.get(path).push(callback);
  }

  notifyWatchers(updates) {
    for (const [path, callbacks] of this.watchers) {
      if (this.pathMatches(path, updates)) {
        callbacks.forEach(callback => callback(updates));
      }
    }
  }
}
```

## Configuration API

### Configuration Management Endpoints

#### Get Configuration
```bash
GET /api/config
```
Returns the current configuration.

#### Get Configuration Section
```bash
GET /api/config/{section}
```
Returns a specific configuration section (e.g., connectors, flows, rules).

#### Update Configuration
```bash
PUT /api/config/{section}
{
  "connectors": [
    {
      "id": "new-connector",
      "type": "mqtt",
      "config": { ... }
    }
  ]
}
```

#### Validate Configuration
```bash
POST /api/config/validate
{
  "connectors": [...],
  "flows": [...],
  "rules": [...]
}
```

#### Export Configuration
```bash
GET /api/config/export
```
Exports the current configuration as a JSON file.

#### Import Configuration
```bash
POST /api/config/import
Content-Type: multipart/form-data
```
Imports configuration from a JSON file.

### Configuration Templates

#### Connector Templates
```bash
GET /api/config/templates/connectors
```
Returns available connector configuration templates.

#### Flow Templates
```bash
GET /api/config/templates/flows
```
Returns available flow configuration templates.

#### Rule Templates
```bash
GET /api/config/templates/rules
```
Returns available rule configuration templates.

## Environment-Specific Configuration

### Development Configuration
```javascript
// config/config.development.js
module.exports = {
  server: {
    port: 3000,
    host: 'localhost'
  },
  database: {
    path: 'data/babelfish-dev.db'
  },
  logging: {
    level: 'debug',
    format: 'console'
  },
  health: {
    checkInterval: 10000 // More frequent checks in development
  }
};
```

### Production Configuration
```javascript
// config/config.production.js
module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0'
  },
  database: {
    path: process.env.DATABASE_PATH || '/var/lib/babelfish/babelfish.db',
    backup: {
      enabled: true,
      interval: 86400000
    }
  },
  logging: {
    level: 'info',
    format: 'json',
    file: '/var/log/babelfish/babelfish.log'
  },
  health: {
    checkInterval: 30000,
    alertRetention: 10
  }
};
```

### Testing Configuration
```javascript
// config/config.test.js
module.exports = {
  server: {
    port: 0 // Use random port for testing
  },
  database: {
    path: ':memory:' // Use in-memory database for testing
  },
  logging: {
    level: 'error', // Minimal logging for tests
    format: 'console'
  },
  health: {
    enabled: false // Disable health checks for testing
  }
};
```

## Configuration Security

### Sensitive Data Handling
```javascript
class SecureConfiguration {
  constructor() {
    this.sensitiveFields = [
      'apiKey',
      'token',
      'password',
      'secret'
    ];
  }

  maskSensitiveData(config) {
    const masked = JSON.parse(JSON.stringify(config));
    this.maskObject(masked);
    return masked;
  }

  maskObject(obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        this.maskObject(value);
      } else if (this.sensitiveFields.includes(key)) {
        obj[key] = '***MASKED***';
      }
    }
  }

  encryptSensitiveData(config) {
    // Implementation for encrypting sensitive configuration data
  }

  decryptSensitiveData(config) {
    // Implementation for decrypting sensitive configuration data
  }
}
```

### Configuration Backup
```javascript
class ConfigurationBackup {
  constructor() {
    this.backupPath = 'data/backups/config/';
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${this.backupPath}config-${timestamp}.json`;
    
    const config = await this.loadCurrentConfiguration();
    await this.writeFile(backupFile, JSON.stringify(config, null, 2));
    
    return backupFile;
  }

  async restoreBackup(backupFile) {
    const config = await this.readFile(backupFile);
    await this.validateConfiguration(config);
    await this.applyConfiguration(config);
    
    return { success: true, backupFile };
  }

  async listBackups() {
    const files = await this.readDirectory(this.backupPath);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: `${this.backupPath}${file}`,
        size: await this.getFileSize(`${this.backupPath}${file}`),
        created: await this.getFileCreated(`${this.backupPath}${file}`)
      }))
      .sort((a, b) => b.created - a.created);
  }
}
```

## Configuration Migration

### Version Management
```javascript
class ConfigurationMigration {
  constructor() {
    this.currentVersion = '1.0.0';
    this.migrations = new Map();
    this.registerMigrations();
  }

  registerMigrations() {
    // Register migration from version 0.9.0 to 1.0.0
    this.migrations.set('0.9.0', {
      targetVersion: '1.0.0',
      migrate: (config) => this.migrateFrom090To100(config)
    });
  }

  async migrateConfiguration(config) {
    const version = config.version || '0.9.0';
    
    if (version === this.currentVersion) {
      return config; // No migration needed
    }

    let currentConfig = config;
    let currentVersion = version;

    while (currentVersion !== this.currentVersion) {
      const migration = this.migrations.get(currentVersion);
      if (!migration) {
        throw new Error(`No migration path from ${currentVersion} to ${this.currentVersion}`);
      }

      currentConfig = await migration.migrate(currentConfig);
      currentVersion = migration.targetVersion;
    }

    return currentConfig;
  }

  migrateFrom090To100(config) {
    // Migration logic from version 0.9.0 to 1.0.0
    const migrated = { ...config, version: '1.0.0' };

    // Example: Rename old field names
    if (migrated.connectors) {
      migrated.connectors = migrated.connectors.map(connector => {
        if (connector.type === 'unifi') {
          return { ...connector, type: 'unifi-protect' };
        }
        return connector;
      });
    }

    return migrated;
  }
}
```

---

The Configuration System provides a robust, flexible, and secure way to manage all aspects of the Looking Glass platform configuration. 