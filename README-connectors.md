# Looking Glass Connector System

## Overview

The Looking Glass platform uses a modular connector-based architecture that allows you to integrate with various systems and protocols through a unified interface. This system provides:

- **Modularity**: Each connector is self-contained and can be developed independently
- **Scalability**: Multiple instances of the same connector type can be used
- **Flexibility**: New connectors can be added without modifying core application logic
- **Interoperability**: Connectors can communicate capabilities and pair automatically
- **Future Integration**: Visual programming interface for wiring connectors together

## Quick Start

### 1. Test the Connector System

Run the test script to verify everything is working:

```bash
node test-connectors.js
```

### 2. Start the Server

The server automatically loads connectors from `config/connectors.json`:

```bash
npm start
```

### 3. Access the Connector API

Once the server is running, you can access the connector management API:

- **List all connectors**: `GET /api/connectors`
- **Get connector details**: `GET /api/connectors/:id`
- **Create connector**: `POST /api/connectors`
- **Update connector**: `PUT /api/connectors/:id`
- **Delete connector**: `DELETE /api/connectors/:id`
- **Connect connector**: `POST /api/connectors/:id/connect`
- **Disconnect connector**: `POST /api/connectors/:id/disconnect`
- **Execute operation**: `POST /api/connectors/:id/execute`

## Available Connectors

### Unifi Protect Connector

Integrates with Ubiquiti's Unifi Protect video management system.

**Capabilities:**
- `camera:management` - Manage camera devices and settings
- `camera:video:stream` - Stream video from cameras
- `camera:event:motion` - Subscribe to motion detection events
- `camera:event:smartdetect` - Subscribe to smart detection events
- `camera:event:doorbell` - Subscribe to doorbell ring events
- `camera:recording:management` - Manage camera recordings
- `camera:snapshot` - Get camera snapshots
- `system:info` - Get system information
- `system:users` - Manage system users

**Configuration:**
```json
{
  "id": "communications-van",
  "type": "unifi-protect",
  "name": "Communications Van System",
  "config": {
    "host": "10.0.0.1",
    "port": 443,
    "protocol": "https",
    "apiKey": "your-api-key",
    "verifySSL": true,
    "timeout": 10000
  }
}
```

### ANKKE DVR Connector

Integrates with ANKKE DVR systems for camera management, video streaming, and recording.

**Capabilities:**
- `ankke:camera` - Camera management (list, info, enable/disable, snapshots)
- `ankke:stream` - Video streaming (start/stop, list, URL generation)
- `ankke:recording` - Recording management (start/stop, list, download/delete)
- `ankke:motion` - Motion detection (enable/disable, configure, status)
- `ankke:ptz` - PTZ control (move, stop, preset, zoom)
- `ankke:event` - Event management (list, subscribe/unsubscribe)
- `ankke:system` - System management (info, reboot, config)

**Configuration:**
```json
{
  "id": "ankke-dvr-1",
  "type": "ankke-dvr",
  "name": "ANKKE DVR System",
  "config": {
    "host": "192.168.1.100",
    "port": 80,
    "protocol": "http",
    "username": "admin",
    "password": "password",
    "timeout": 10000,
    "maxReconnectAttempts": 5,
    "reconnectInterval": 30000
  }
}
```

### Hikvision Connector

Integrates with Hikvision IP cameras, DVRs, and NVRs using ISAPI REST API.

**Capabilities:**
- `hikvision:camera` - Camera management (list, info, enable/disable, snapshots, config)
- `hikvision:stream` - Video streaming (start/stop, list, URL, config)
- `hikvision:recording` - Recording management (start/stop, list, download/delete, schedule)
- `hikvision:motion` - Motion detection (enable/disable, configure, status, areas)
- `hikvision:ptz` - PTZ control (move, stop, preset, goto, zoom, list-presets)
- `hikvision:event` - Event management (list, subscribe/unsubscribe, triggers)
- `hikvision:system` - System management (info, reboot, config, network, users)

**Configuration:**
```json
{
  "id": "hikvision-1",
  "type": "hikvision",
  "name": "Hikvision System",
  "config": {
    "host": "192.168.1.100",
    "port": 80,
    "protocol": "http",
    "username": "admin",
    "password": "password",
    "timeout": 15000,
    "maxReconnectAttempts": 5,
    "reconnectInterval": 30000
  }
}
```

### MQTT Connector

Provides MQTT publish/subscribe messaging capabilities.

**Capabilities:**
- `mqtt:publish` - Publish messages to MQTT topics
- `mqtt:subscribe` - Subscribe to MQTT topics
- `mqtt:topics` - Manage MQTT topics
- `mqtt:connection` - Manage MQTT connections
- `mqtt:history` - Access message history

**Configuration:**
```json
{
  "id": "mqtt-broker-1",
  "type": "mqtt",
  "name": "Primary MQTT Broker",
  "config": {
    "host": "localhost",
    "port": 1883,
    "protocol": "mqtt",
    "clientId": "looking-glass-client",
    "username": "user",
    "password": "password"
  }
}
```

### Telegram Connector

Provides integration with Telegram Bot API for messaging and notifications.

**Capabilities:**
- `telegram:send` - Send text messages, photos, documents, and locations
- `telegram:receive` - Receive and process incoming messages
- `telegram:chat` - Manage chat information and members
- `telegram:media` - Download and upload files
- `telegram:keyboard` - Send inline and reply keyboards
- `telegram:webhook` - Manage webhook configuration

**Configuration:**
```json
{
  "id": "telegram-bot",
  "type": "telegram",
  "name": "Babelfish Bot",
  "description": "Telegram bot for notifications",
  "config": {
    "token": "YOUR_BOT_TOKEN_HERE",
    "mode": "polling",
    "pollingInterval": 1000,
    "pollingTimeout": 10,
    "maxReconnectAttempts": 5
  },
  "capabilities": {
    "enabled": [
      "telegram:send",
      "telegram:receive",
      "telegram:keyboard"
    ],
    "disabled": [
      "telegram:webhook"
    ]
  }
}
```

### LLM Connector

Provides integration with Large Language Models for AI-powered automation and decision making.

**Capabilities:**
- `llm:chat` - Chat with LLM models
- `llm:completion` - Generate text completions
- `llm:analysis` - Analyze data and events
- `llm:decision` - Make automated decisions
- `llm:translation` - Translate text between languages
- `llm:summarization` - Summarize text and data

**Configuration:**
```json
{
  "id": "llm-assistant",
  "type": "llm",
  "name": "AI Assistant",
  "description": "LLM integration for automation",
  "config": {
    "provider": "openai",
    "apiKey": "your-api-key",
    "model": "gpt-4",
    "maxTokens": 1000,
    "temperature": 0.7
  }
}
```

### ADSB Connector

Provides Automatic Dependent Surveillance-Broadcast (ADSB) aircraft tracking capabilities.

**Capabilities:**
- `adsb:aircraft` - Track aircraft positions and data
- `adsb:radar` - Radar visualization and display
- `adsb:zones` - Define and monitor airspace zones
- `adsb:filtering` - Filter aircraft by various criteria
- `adsb:emergency` - Monitor emergency squawk codes
- `adsb:export` - Export aircraft data

**Configuration:**
```json
{
  "id": "adsb-tracker",
  "type": "adsb",
  "name": "ADSB Aircraft Tracker",
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
  }
}
```

### APRS Connector

Provides Automatic Packet Reporting System (APRS) amateur radio station tracking and weather data.

**Capabilities:**
- `aprs:stations` - Track APRS stations and positions
- `aprs:weather` - Weather station data and monitoring
- `aprs:messages` - APRS text message monitoring
- `aprs:map` - Automatic map integration
- `aprs:filtering` - Filter stations by type and location
- `aprs:export` - Export APRS data

**Configuration:**
```json
{
  "id": "aprs-tracker",
  "type": "aprs",
  "name": "APRS Station Tracker",
  "config": {
    "apiKey": "your-aprs-api-key",
    "bounds": {
      "minLat": 49.0,
      "maxLat": 61.0,
      "minLon": -8.0,
      "maxLon": 2.0
    },
    "updateInterval": 30000
  }
}
```

### Map Connector

Provides spatial visualization and real-time map integration capabilities.

**Capabilities:**
- `map:spatial` - Spatial element management
- `map:visualization` - Real-time map visualization
- `map:integration` - Connector data integration
- `map:zones` - Zone definition and management
- `map:events` - Event visualization on maps
- `map:export` - Export map configurations

**Configuration:**
```json
{
  "id": "main-map",
  "type": "map",
  "name": "Main Map System",
  "config": {
    "autoRegisterConnectors": true,
    "enableWebSockets": true,
    "defaultCenter": {
      "lat": 51.5074,
      "lon": -0.1278,
      "zoom": 10
    }
  }
}
```

### Web GUI Connector

Provides modern web interface with component system and real-time updates.

**Capabilities:**
- `gui:pages` - Page management and routing
- `gui:components` - Component library and management
- `gui:layout` - Layout configuration and editing
- `gui:themes` - Theme management and customization
- `gui:real-time` - Real-time updates and WebSocket integration
- `gui:responsive` - Responsive design and mobile support

**Configuration:**
```json
{
  "id": "web-gui",
  "type": "web-gui",
  "name": "Web Interface",
  "config": {
    "port": 3000,
    "enableWebSockets": true,
    "enableSSE": true,
    "defaultTheme": "dark",
    "autoReload": true
  }
}
```

### Speed Calculation Connector

Provides ANPR-based vehicle speed monitoring and calculation capabilities.

**Capabilities:**
- `speed:calculation` - Calculate vehicle speeds between detection points
- `speed:anpr` - ANPR integration and plate recognition
- `speed:tracking` - Vehicle tracking across detection points
- `speed:alerts` - Speed violation alerts and notifications
- `speed:analytics` - Speed analytics and reporting
- `speed:export` - Export speed data

**Configuration:**
```json
{
  "id": "speed-monitor",
  "type": "speed-calculation",
  "name": "Speed Monitoring System",
  "config": {
    "minTimeBetweenDetections": 1000,
    "maxTimeBetweenDetections": 300000,
    "minSpeedThreshold": 5,
    "maxSpeedThreshold": 200,
    "confidenceThreshold": 0.8
  }
}
```

### Overwatch Connector

Central event processing and orchestration system for managing all events and flows.

**Capabilities:**
- `overwatch:events` - Event processing and enhancement
- `overwatch:flows` - Flow orchestration and management
- `overwatch:rules` - Rule engine and automation
- `overwatch:filtering` - Event filtering and routing
- `overwatch:metrics` - System metrics and monitoring
- `overwatch:health` - System health monitoring

**Configuration:**
```json
{
  "id": "overwatch",
  "type": "overwatch",
  "name": "Event Orchestration System",
  "config": {
    "enableEventProcessing": true,
    "enableFlowOrchestration": true,
    "enableRuleEngine": true,
    "maxEvents": 1000,
    "processingInterval": 100
  }
}
```

## Connector Management

### Creating Connectors

Connectors are defined in `config/connectors.json`:

```json
[
  {
    "id": "unique-connector-id",
    "type": "connector-type",
    "name": "Human Readable Name",
    "description": "Optional description",
    "config": {
      // Connector-specific configuration
    },
    "capabilities": {
      "enabled": ["capability1", "capability2"],
      "disabled": ["capability3"]
    }
  }
]
```

### Connector Lifecycle

1. **Discovery**: Connectors are discovered and loaded from configuration
2. **Validation**: Configuration is validated against connector requirements
3. **Initialization**: Connectors are initialized with their configuration
4. **Connection**: Connectors establish connections to their respective systems
5. **Operation**: Connectors begin normal operation and event processing
6. **Monitoring**: Health monitoring tracks connector status and performance
7. **Disconnection**: Connectors gracefully disconnect when stopped

### Capability System

Each connector defines its capabilities through the `getCapabilityDefinitions()` method:

```javascript
static getCapabilityDefinitions() {
  return [
    {
      id: 'my:capability',
      name: 'My Capability',
      description: 'Description of what this capability does',
      category: 'category',
      operations: ['create', 'read', 'update', 'delete'],
      dataTypes: ['my-data'],
      events: ['my:event']
    }
  ];
}
```

### Event System

Connectors can publish and subscribe to events:

```javascript
// Publish an event
this.eventBus.publishEvent('my:event', {
  source: this.id,
  data: eventData,
  timestamp: Date.now()
});

// Subscribe to events
this.eventBus.subscribe('other:event', (event) => {
  // Handle event
});
```

## Testing Connectors

### Individual Connector Tests

```bash
# Test specific connectors
node test-unifi-protect.js
node test-mqtt-connector.js
node test-telegram-connector.js
node test-adsb-connector.js
node test-aprs-connector.js
node test-speed-calculation-system.js
```

### Integration Tests

```bash
# Test connector integrations
node test-adsb-map-integration.js
node test-map-unifi-sync.js
node test-llm-autonomous-system.js
```

### System Tests

```bash
# Test complete system
node test-connectors.js
node test-flow-system.js
node test-health-monitoring.js
```

## Development

### Adding New Connectors

1. **Create Connector Class**
   ```javascript
   const BaseConnector = require('../BaseConnector');
   
   class MyConnector extends BaseConnector {
     static getCapabilityDefinitions() {
       return [
         {
           id: 'my:capability',
           name: 'My Capability',
           description: 'Description',
           category: 'custom',
           operations: ['execute'],
           dataTypes: ['my-data'],
           events: ['my:event']
         }
       ];
     }
     
     static getMetadata() {
       return {
         name: 'My Connector',
         description: 'Description of my connector',
         version: '1.0.0',
         author: 'Your Name'
       };
     }
     
     static validateConfig(config) {
       // Validate configuration
       return { valid: true };
     }
     
     async performConnect() {
       // Implement connection logic
     }
     
     async performDisconnect() {
       // Implement disconnection logic
     }
     
     async executeCapability(capabilityId, operation, parameters) {
       // Implement capability execution
     }
   }
   
   module.exports = MyConnector;
   ```

2. **Register Connector**
   Add the connector to `connectors/types/` and update the registry.

3. **Create Documentation**
   Add documentation in `docs/connectors/`.

4. **Create Tests**
   Add test file following the existing pattern.

### Best Practices

- **Error Handling**: Implement robust error handling and recovery
- **Logging**: Use structured logging for debugging and monitoring
- **Configuration**: Validate all configuration parameters
- **Events**: Publish meaningful events for system integration
- **Health Checks**: Implement health monitoring capabilities
- **Documentation**: Maintain comprehensive documentation
- **Testing**: Create thorough test coverage

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check network connectivity
   - Verify configuration parameters
   - Check authentication credentials
   - Review connector logs

2. **Event Processing Issues**
   - Verify event bus connectivity
   - Check event format and structure
   - Review event filtering rules
   - Monitor event processing performance

3. **Performance Issues**
   - Monitor resource usage
   - Check connection pooling
   - Review event processing intervals
   - Optimize database queries

### Debug Mode

Enable debug logging for detailed troubleshooting:

```javascript
// In connector configuration
{
  "debug": true,
  "logLevel": "debug"
}
```

### Health Monitoring

Monitor connector health through the API:

```bash
GET /api/connectors/:id/health
GET /health/connectors
```

## API Reference

### Connector Management

- `GET /api/connectors` - List all connectors
- `GET /api/connectors/:id` - Get connector details
- `POST /api/connectors` - Create new connector
- `PUT /api/connectors/:id` - Update connector
- `DELETE /api/connectors/:id` - Delete connector

### Connector Operations

- `POST /api/connectors/:id/connect` - Connect connector
- `POST /api/connectors/:id/disconnect` - Disconnect connector
- `POST /api/connectors/:id/execute` - Execute capability
- `GET /api/connectors/:id/status` - Get connector status
- `GET /api/connectors/:id/health` - Get connector health

### Event Management

- `GET /api/events` - List recent events
- `POST /api/events` - Publish event
- `GET /api/events/stream` - Stream events (SSE)
- `GET /api/events/stats` - Get event statistics

---

For more detailed information about specific connectors, see the documentation in the `docs/connectors/` directory.