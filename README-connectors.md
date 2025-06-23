# Looking Glass Connector System

## Overview

The Looking Glass platform uses a modular connector-based architecture that allows you to integrate with various systems and protocols through a unified interface. This system provides:

- **Modularity**: Each connector is self-contained and can be developed independently
- **Scalability**: Multiple instances of the same connector type can be used
- **Flexibility**: New connectors can be added without modifying core application logic
- **Interoperability**: Connectors can communicate capabilities and pair automatically
- **Future Integration**: Visual programming interface for wiring connectors together

## ✅ **Recent Updates & Fixes**

### Telegram Connector Integration Fixed
The Telegram connector was recently fixed to resolve a **409 Conflict error** that prevented proper integration:

**Problem**: The Telegram connector was not properly registered in the main server, causing:
- 409 Conflict errors when multiple instances tried to connect
- Telegram notifications not working with other connectors
- Integration failures with Prestwick Airport and other notification-dependent features

**Solution**: Added proper import and registration in `server.js`:
```javascript
// Added missing import
const TelegramConnector = require('./connectors/types/TelegramConnector');

// Added connector registration
connectorRegistry.registerType('telegram', TelegramConnector);
```

**Result**: 
- ✅ Telegram notifications now work correctly with all connectors
- ✅ Prestwick Airport NOTAM alerts function properly
- ✅ Alarm Manager notifications work as expected
- ✅ All Telegram-dependent features are operational

### New Connectors Added
- **Alarm Manager Connector**: Centralized alarm management with multi-channel notifications
- **NOTAM Connector**: UK NOTAM data integration with Prestwick Airport support
- **System Visualizer Connector**: Real-time system architecture visualization

### Enhanced Connectors
- **ADSB Connector**: Enhanced with UK squawk code analysis (442 codes categorized)
- **Prestwick Airport Connector**: Enhanced with NOTAM integration and Telegram notifications

## Quick Start

### 1. Test the Connector System

Run the test script to verify everything is working:

```bash
node test-connectors.js
```

### 2. Test Telegram Integration (✅ **Now Working**)

Test the Telegram connector functionality:

```bash
node test-telegram-simple.js
```

### 3. Start the Server

The server automatically loads connectors from `config/connectors.json`:

```bash
npm start
```

### 4. Access the Connector API

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

### Telegram Connector (✅ **Recently Fixed**)

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
  "id": "telegram-bot-main",
  "type": "telegram",
  "name": "Babelfish Bot",
  "description": "Telegram bot for notifications",
  "config": {
    "token": "YOUR_BOT_TOKEN_HERE",
    "defaultChatId": "YOUR_CHAT_ID_HERE",
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
    "disabled": ["telegram:webhook"]
  }
}
```

### ADSB Connector (✅ **Enhanced**)

Integrates with Automatic Dependent Surveillance-Broadcast data for aircraft tracking.

**Capabilities:**
- `adsb:aircraft` - Aircraft tracking and management
- `adsb:radar` - Radar visualization and display
- `adsb:squawk` - Squawk code analysis (✅ **New**)
- `adsb:filtering` - Aircraft filtering and search
- `adsb:export` - Data export capabilities

**Enhanced Features:**
- **Squawk Code Analysis**: 442 UK squawk codes with emergency detection
- **Categories**: Emergency, Military, NATO, ATC, Emergency Services, Law Enforcement, Offshore, Conspicuity, Transit
- **Emergency Detection**: Automatic detection of 7500, 7600, 7700 codes

**Configuration:**
```json
{
  "id": "adsb-main",
  "type": "adsb",
  "name": "ADSB Aircraft Tracking",
  "config": {
    "enableSquawkCodeAnalysis": true,
    "showSquawkInfo": true,
    "squawkCodeService": {
      "dataFile": "path/to/squawk/codes/file.ini",
      "enableCaching": true,
      "cacheExpiry": 3600000
    }
  }
}
```

### APRS Connector

Integrates with Amateur Radio Packet System for station tracking and weather data.

**Capabilities:**
- `aprs:stations` - APRS station tracking and management
- `aprs:weather` - Weather data integration
- `aprs:messages` - Message monitoring and display
- `aprs:map` - Automatic map integration

**Configuration:**
```json
{
  "id": "aprs-main",
  "type": "aprs",
  "name": "APRS Station Tracking",
  "config": {
    "ukBounds": {
      "north": 60.8604,
      "south": 49.1623,
      "east": 1.7633,
      "west": -8.6500
    },
    "pollInterval": 30000
  }
}
```

### NOTAM Connector (✅ **New**)

Integrates with UK NOTAM archive for aviation safety and operational awareness.

**Capabilities:**
- `notam:tracking` - NOTAM data tracking and monitoring
- `notam:geospatial` - Geospatial analysis and conversion
- `notam:proximity` - Proximity alerts for aircraft
- `notam:temporal` - Temporal analysis and validation
- `notam:prestwick` - Prestwick Airport integration (✅ **New**)
- `notam:map:visualization` - Map visualization

**Configuration:**
```json
{
  "id": "notam-main",
  "type": "notam",
  "name": "UK NOTAM Data",
  "config": {
    "notamUrl": "https://github.com/Jonty/uk-notam-archive/blob/main/data/PIB.xml",
    "pollInterval": 1200000,
    "prestwickIntegration": {
      "enabled": true,
      "airportCode": "EGPK",
      "airportPosition": {
        "lat": 55.5074,
        "lon": -4.5933
      },
      "notificationRadius": 50
    }
  }
}
```

### Alarm Manager Connector (✅ **New**)

Provides centralized alarm management across all system components.

**Capabilities:**
- `alarm:management` - Alarm creation and management
- `alarm:notifications` - Multi-channel alarm notifications
- `alarm:acknowledgment` - Alarm acknowledgment and status
- `alarm:rules` - Configurable alarm rules and escalation

**Configuration:**
```json
{
  "id": "alarm-manager-main",
  "type": "alarm-manager",
  "name": "Main Alarm Manager",
  "config": {
    "enabled": true,
    "notificationChannels": {
      "telegram": {
        "enabled": true,
        "connectorId": "telegram-bot-main",
        "chatId": "-1001242323336"
      },
      "mqtt": {
        "enabled": true,
        "topic": "alarms/notifications",
        "qos": 1
      }
    },
    "alarmRules": {
      "motion": {
        "enabled": true,
        "severity": "medium",
        "suppression": {
          "enabled": true,
          "window": 300000,
          "maxAlarms": 5
        }
      }
    }
  }
}
```

### Prestwick Airport Connector (✅ **Enhanced**)

Specialized connector for Glasgow Prestwick Airport (EGPK) operations.

**Capabilities:**
- `prestwick:aircraft` - Aircraft operations tracking
- `prestwick:notam` - NOTAM integration and checking
- `prestwick:notifications` - Telegram notifications for airport events
- `prestwick:ground` - Ground event detection and monitoring

**Enhanced Features:**
- **NOTAM Integration**: Automatic NOTAM checking for approach, landing, and takeoff
- **Telegram Notifications**: Instant alerts via Telegram (✅ **Now Working**)
- **ADSB Integration**: Real-time aircraft data integration

**Configuration:**
```json
{
  "id": "prestwick-airport",
  "type": "prestwick-airport",
  "name": "Glasgow Prestwick Airport",
  "config": {
    "airportCode": "EGPK",
    "airportPosition": {
      "lat": 55.5074,
      "lon": -4.5933
    },
    "telegramConfig": {
      "enabled": true,
      "chatId": "-1001242323336"
    },
    "notamIntegration": {
      "enabled": true,
      "checkRadius": 50
    }
  }
}
```

### System Visualizer Connector (✅ **Enhanced**)

Provides real-time system architecture visualization and monitoring.

**Capabilities:**
- `system:visualization` - System architecture visualization
- `system:metrics` - Real-time metrics and health monitoring
- `system:layouts` - Multiple layout algorithms (Force Directed, Circular, Hierarchical, Grid)
- `system:websocket` - WebSocket-based real-time updates

**Enhanced Features:**
- **Multiple Layouts**: Force Directed, Circular, Hierarchical, Grid algorithms
- **Real-time Updates**: WebSocket-based live updates
- **Interactive Features**: Node selection, highlighting, data flow visualization
- **Data Flow Categorization**: Emergency, Military, Data, Events

**Configuration:**
```json
{
  "id": "system-visualizer-main",
  "type": "system-visualizer",
  "name": "System Architecture Visualizer",
  "config": {
    "port": 3001,
    "layouts": ["force", "circular", "hierarchical", "grid"],
    "updateInterval": 5000,
    "websocket": {
      "enabled": true,
      "path": "/ws"
    }
  }
}
```

### Map Connector

Provides spatial visualization and management capabilities.

**Capabilities:**
- `map:spatial` - Spatial element management
- `map:visualization` - Map visualization and display
- `map:zones` - Zone definition and monitoring
- `map:events` - Event visualization on maps

**Configuration:**
```json
{
  "id": "map-main",
  "type": "map",
  "name": "Spatial Visualization",
  "config": {
    "center": {
      "lat": 55.5074,
      "lon": -4.5933
    },
    "zoom": 10,
    "layers": ["satellite", "terrain", "streets"]
  }
}
```

### Web GUI Connector

Provides modern web interface with component system.

**Capabilities:**
- `gui:pages` - Web GUI page management
- `gui:components` - Component management and configuration
- `gui:themes` - Theme management and customization
- `gui:websocket` - Real-time updates via WebSockets

**Configuration:**
```json
{
  "id": "web-gui-main",
  "type": "web-gui",
  "name": "Web Interface",
  "config": {
    "port": 3000,
    "theme": "dark",
    "components": ["dashboard", "map", "alarms", "analytics"]
  }
}
```

### Speed Calculation Connector

Provides ANPR-based vehicle speed monitoring.

**Capabilities:**
- `speed:calculation` - Speed calculation and monitoring
- `speed:anpr` - ANPR integration and plate recognition
- `speed:violations` - Speed violation detection and alerts
- `speed:analytics` - Speed analytics and reporting

**Configuration:**
```json
{
  "id": "speed-calculation-main",
  "type": "speed-calculation",
  "name": "Speed Monitoring",
  "config": {
    "detectionPoints": [
      {
        "id": "point-1",
        "position": { "lat": 55.5074, "lon": -4.5933 }
      },
      {
        "id": "point-2",
        "position": { "lat": 55.5074, "lon": -4.5933 }
      }
    ],
    "speedLimit": 30,
    "violationThreshold": 5
  }
}
```

### Overwatch Connector

Provides central event processing and orchestration.

**Capabilities:**
- `overwatch:events` - Event processing and management
- `overwatch:flows` - Flow management and automation
- `overwatch:rules` - Rule engine and decision making
- `overwatch:health` - System health monitoring

**Configuration:**
```json
{
  "id": "overwatch-main",
  "type": "overwatch",
  "name": "Event Orchestration",
  "config": {
    "eventProcessing": {
      "enabled": true,
      "maxConcurrent": 10
    },
    "flowManagement": {
      "enabled": true,
      "autoStart": true
    }
  }
}
```

### LLM Connector

Provides AI-powered automation and decision making.

**Capabilities:**
- `llm:chat` - LLM conversation capabilities
- `llm:function` - Function calling for autonomous operations
- `llm:analysis` - Data analysis and insights
- `llm:automation` - AI-powered automation

**Configuration:**
```json
{
  "id": "llm-main",
  "type": "llm",
  "name": "AI Assistant",
  "config": {
    "provider": "openai",
    "model": "gpt-4",
    "apiKey": "your-api-key",
    "maxTokens": 1000
  }
}
```

## Testing

### Test All Connectors
```bash
node test-connectors.js
```

### Test Specific Connectors
```bash
# Test Telegram integration (✅ Now Working)
node test-telegram-simple.js

# Test Prestwick Airport with Telegram
node test-prestwick-telegram.js
node test-prestwick-full-notifications.js

# Test ADSB with squawk codes
node test-squawk-code-integration.js

# Test NOTAM integration
node test-notam-integration.js
node test-prestwick-notam-integration.js

# Test Alarm Manager
node test-alarm-manager.js

# Test System Visualizer
node test-system-visualizer.js
```

## Troubleshooting

### Common Issues

#### Telegram 409 Conflict Error
**Problem**: `TelegramError: ETELEGRAM: 409 Conflict: terminated by other getUpdates request`

**Solution**: 
1. Ensure only one instance of the Telegram bot is running
2. Verify the connector is properly registered in `server.js`
3. Check that no other processes are using the same bot token

#### Connector Not Loading
1. Check connector configuration in `config/connectors.json`
2. Verify connector type is registered in `server.js`
3. Check for configuration validation errors
4. Review connector logs for specific error messages

#### Integration Issues
1. Verify all required connectors are running
2. Check event subscriptions and publishing
3. Review capability definitions and operations
4. Test individual connector functionality

### Debug Commands
```javascript
// Check connector status
const status = await connector.getStatus();

// Test connector capabilities
const capabilities = connector.getCapabilityDefinitions();

// Execute test operation
const result = await connector.execute('capability:test', 'operation', {});
```

## Future Enhancements

### Planned Connectors
1. **Email Connector**: Email notification and management
2. **SMS Connector**: SMS messaging capabilities
3. **Database Connector**: Database integration and management
4. **API Connector**: Generic API integration framework
5. **Cloud Connector**: Cloud service integration

### Scalability Improvements
1. **Distributed Architecture**: Multi-node connector deployment
2. **Load Balancing**: Distribute connector processing load
3. **High Availability**: Redundant connector configurations
4. **Performance Optimization**: Enhanced caching and processing

---

The connector system provides a robust foundation for integrating diverse systems and protocols, enabling the Looking Glass platform to adapt and scale to meet various operational requirements.