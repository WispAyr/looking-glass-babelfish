# Connector Structure Reference

This document provides a comprehensive reference for all connector types in the Babelfish Looking Glass system, their capabilities, and implementation patterns.

## Base Connector Structure

All connectors extend the `BaseConnector` class and follow a consistent pattern:

### Required Methods

```javascript
class MyConnector extends BaseConnector {
  // Static methods for metadata and validation
  static getCapabilityDefinitions() { /* ... */ }
  static getMetadata() { /* ... */ }
  static validateConfig(config) { /* ... */ }
  
  // Lifecycle methods
  async performConnect() { /* ... */ }
  async performDisconnect() { /* ... */ }
  async performHealthCheck() { /* ... */ }
  
  // Capability execution
  async executeCapability(capabilityId, operation, parameters) { /* ... */ }
}
```

### Base Properties

- `id`: Unique connector identifier
- `type`: Connector type (e.g., 'telegram', 'unifi-protect')
- `config`: Configuration object
- `connected`: Connection status
- `logger`: Logger instance
- `eventBus`: Event bus reference (set by registry)

## Connector Types

### 1. Telegram Connector (`TelegramConnector`)

**Purpose**: Send and receive Telegram messages and notifications

**Capabilities**:
- `telegram:send` - Send text, photo, document, location messages
- `telegram:receive` - Receive and process incoming messages
- `telegram:webhook` - Handle webhook events

**Configuration**:
```javascript
{
  "id": "telegram-main",
  "type": "telegram",
  "config": {
    "botToken": "your-bot-token",
    "chatId": "default-chat-id",
    "webhookUrl": "https://your-domain.com/webhook"
  }
}
```

**Key Methods**:
- `sendTextMessage(chatId, text, options)`
- `sendPhoto(chatId, photo, caption, options)`
- `sendDocument(chatId, document, caption, options)`
- `sendLocation(chatId, latitude, longitude, options)`

### 2. UniFi Protect Connector (`UniFiProtectConnector`)

**Purpose**: Integrate with UniFi Protect security cameras and NVR

**Capabilities**:
- `camera:management` - Manage camera devices and settings
- `camera:video:stream` - Video streaming capabilities
- `camera:event:motion` - Motion detection events
- `camera:event:smartdetect` - Smart detection events
- `camera:recording:management` - Recording management
- `camera:snapshot` - Snapshot capabilities

**Configuration**:
```javascript
{
  "id": "unifi-protect-main",
  "type": "unifi-protect",
  "config": {
    "host": "192.168.1.100",
    "port": 443,
    "apiKey": "your-api-key",
    "username": "admin",
    "password": "password"
  }
}
```

**Key Methods**:
- `getCameras()`
- `getMotionEvents(parameters)`
- `getSmartDetectEvents(parameters)`
- `getRecordings(parameters)`
- `takeSnapshot(cameraId)`

### 3. ADSB Connector (`ADSBConnector`)

**Purpose**: Process Automatic Dependent Surveillance-Broadcast data

**Capabilities**:
- `adsb:aircraft` - Aircraft tracking and monitoring
- `adsb:radar` - Radar visualization
- `adsb:emergency` - Emergency squawk code monitoring
- `adsb:airspace` - Airspace entry/exit detection

**Configuration**:
```javascript
{
  "id": "adsb-main",
  "type": "adsb",
  "config": {
    "dataSource": "http://10.0.1.180/skyaware/data/aircraft.json",
    "updateInterval": 5000,
    "emergencySquawks": ["7500", "7600", "7700"]
  }
}
```

**Key Methods**:
- `getAircraftList()`
- `getAircraftByIcao(icao)`
- `monitorSquawkCodes(codes)`
- `detectAirspaceEntry(airspace)`

### 4. MQTT Connector (`MQTTConnector`)

**Purpose**: Publish and subscribe to MQTT topics

**Capabilities**:
- `mqtt:publish` - Publish messages to topics
- `mqtt:subscribe` - Subscribe to topics
- `mqtt:history` - Message history management

**Configuration**:
```javascript
{
  "id": "mqtt-main",
  "type": "mqtt",
  "config": {
    "host": "localhost",
    "port": 1883,
    "username": "user",
    "password": "password",
    "clientId": "babelfish-mqtt"
  }
}
```

**Key Methods**:
- `publish(topic, message, options)`
- `subscribe(topic, callback)`
- `unsubscribe(topic)`
- `getMessageHistory(topic, limit)`

### 5. Map Connector (`MapConnector`)

**Purpose**: Spatial visualization and management

**Capabilities**:
- `map:spatial` - Spatial element management
- `map:visualization` - Map visualization
- `map:zones` - Zone definition and monitoring
- `map:events` - Event visualization on maps

**Configuration**:
```javascript
{
  "id": "map-main",
  "type": "map",
  "config": {
    "center": [55.5074, -4.5861],
    "zoom": 10,
    "layers": ["satellite", "terrain"],
    "zones": ["airspace", "speed-zones"]
  }
}
```

**Key Methods**:
- `addElement(element)`
- `updateElement(id, updates)`
- `removeElement(id)`
- `getElementsInBounds(bounds)`

### 6. Overwatch Connector (`OverwatchConnector`)

**Purpose**: System monitoring and management GUI

**Capabilities**:
- `overwatch:flows` - Flow management
- `overwatch:rules` - Rule management
- `overwatch:events` - Event monitoring
- `overwatch:connectors` - Connector management
- `overwatch:system` - System health monitoring

**Configuration**:
```javascript
{
  "id": "overwatch-main",
  "type": "overwatch",
  "config": {
    "maxEventHistory": 1000,
    "defaultConnectors": ["telegram", "unifi-protect", "adsb"],
    "webSocketPort": 3001
  }
}
```

**Key Methods**:
- `getEventStream(parameters)`
- `setEventFilter(parameters)`
- `getEventHistory(parameters)`
- `getConnectorStatus(connectorId)`
- `getSystemHealth()`

### 7. Speed Calculation Connector (`SpeedCalculationConnector`)

**Purpose**: Calculate vehicle speeds using ANPR data

**Capabilities**:
- `speed:calculation` - Speed calculation and monitoring
- `speed:violations` - Speed violation detection
- `speed:analytics` - Speed analytics and reporting

**Configuration**:
```javascript
{
  "id": "speed-calculation-main",
  "type": "speed-calculation",
  "config": {
    "detectionPoints": [
      { "id": "point1", "location": [55.5074, -4.5861] },
      { "id": "point2", "location": [55.5074, -4.5862] }
    ],
    "speedLimit": 30,
    "violationThreshold": 5
  }
}
```

**Key Methods**:
- `calculateSpeed(vehicleId, point1, point2)`
- `detectViolation(vehicleId, speed)`
- `getViolationHistory(parameters)`
- `getSpeedAnalytics(parameters)`

### 8. APRS Connector (`APRSConnector`)

**Purpose**: Amateur radio station tracking and weather data

**Capabilities**:
- `aprs:stations` - APRS station tracking
- `aprs:weather` - Weather data integration
- `aprs:messages` - Message monitoring

**Configuration**:
```javascript
{
  "id": "aprs-main",
  "type": "aprs",
  "config": {
    "apiUrl": "https://api.aprs.fi/v2/",
    "apiKey": "your-api-key",
    "region": "UK",
    "updateInterval": 30000
  }
}
```

**Key Methods**:
- `getStationsInRegion(region)`
- `getWeatherData(stationId)`
- `getMessages(stationId)`
- `trackStation(callsign)`

### 9. Web GUI Connector (`WebGUIConnector`)

**Purpose**: Modern web interface with component system

**Capabilities**:
- `gui:pages` - Web GUI page management
- `gui:components` - Component management
- `gui:themes` - Theme management
- `gui:websocket` - Real-time updates

**Configuration**:
```javascript
{
  "id": "web-gui-main",
  "type": "web-gui",
  "config": {
    "port": 3000,
    "theme": "dark",
    "components": ["dashboard", "alarms", "maps"],
    "websocket": true
  }
}
```

**Key Methods**:
- `renderPage(pageId, data)`
- `updateComponent(componentId, data)`
- `setTheme(theme)`
- `broadcastUpdate(event, data)`

### 10. Alarm Manager Connector (`AlarmManagerConnector`)

**Purpose**: Rule-based alarm system management

**Capabilities**:
- `alarm:rules` - Alarm rule management
- `alarm:events` - Alarm event processing
- `alarm:notifications` - Notification management
- `alarm:history` - Alarm history

**Configuration**:
```javascript
{
  "id": "alarm-manager-main",
  "type": "alarm-manager",
  "config": {
    "rulesFile": "config/defaultRules.js",
    "notificationChannels": ["telegram", "email"],
    "historyRetention": 30
  }
}
```

**Key Methods**:
- `addRule(rule)`
- `removeRule(ruleId)`
- `processEvent(event)`
- `sendNotification(channel, message)`

## Capability System

### Capability Definition Structure

```javascript
{
  id: 'capability:operation',
  name: 'Human Readable Name',
  description: 'Detailed description',
  category: 'category',
  operations: ['list', 'get', 'create', 'update', 'delete'],
  dataTypes: ['type1', 'type2'],
  events: ['event1', 'event2'],
  parameters: {
    param1: { type: 'string', required: true },
    param2: { type: 'number', required: false, default: 0 }
  }
}
```

### Capability Execution Pattern

```javascript
async executeCapability(capabilityId, operation, parameters) {
  switch (capabilityId) {
    case 'capability:operation':
      return await this.executeOperation(operation, parameters);
    default:
      throw new Error(`Unknown capability: ${capabilityId}`);
  }
}
```

## Event System

### Event Publishing

```javascript
this.eventBus.publishEvent('eventType', {
  source: this.id,
  data: eventData,
  timestamp: Date.now()
});
```

### Event Subscription

```javascript
this.eventBus.subscribe('eventType', (event) => {
  if (event.source !== this.id) {
    this.processEvent(event);
  }
});
```

## Health Monitoring

### Health Check Implementation

```javascript
async performHealthCheck() {
  try {
    const status = await this.checkConnection();
    return {
      healthy: status.online,
      details: status,
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: Date.now()
    };
  }
}
```

## Configuration Management

### Environment Variables

Connectors can be configured via environment variables:

```bash
# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id

# UniFi Protect
UNIFI_HOST=192.168.1.100
UNIFI_API_KEY=your-api-key

# MQTT
MQTT_HOST=localhost
MQTT_PORT=1883
```

### Configuration Validation

```javascript
static validateConfig(config) {
  const errors = [];
  
  if (!config.requiredField) {
    errors.push('Required field is missing');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

## Error Handling

### Standard Error Types

- **Connection Errors**: Network connectivity issues
- **Authentication Errors**: Invalid credentials
- **Configuration Errors**: Invalid configuration
- **Operation Errors**: Failed operations
- **System Errors**: Internal system errors

### Error Handling Pattern

```javascript
async executeCapability(capabilityId, operation, parameters) {
  try {
    // Validate capability
    if (!this.capabilities.includes(capabilityId)) {
      throw new Error(`Capability not supported: ${capabilityId}`);
    }
    
    // Execute operation
    const result = await this.performOperation(operation, parameters);
    
    this.logger.debug(`Operation completed: ${capabilityId}.${operation}`);
    return result;
  } catch (error) {
    this.logger.error(`Operation failed: ${capabilityId}.${operation}`, error);
    this.updateHealthStatus('error', error.message);
    throw error;
  }
}
```

## Testing Strategy

### Unit Testing

```javascript
describe('MyConnector', () => {
  let connector;
  
  beforeEach(() => {
    connector = new MyConnector(config);
  });
  
  test('should validate configuration', () => {
    const result = MyConnector.validateConfig(config);
    expect(result.valid).toBe(true);
  });
  
  test('should connect successfully', async () => {
    await connector.performConnect();
    expect(connector.connected).toBe(true);
  });
});
```

### Integration Testing

```javascript
describe('Connector Integration', () => {
  test('should process events correctly', async () => {
    const connector = new MyConnector(config);
    await connector.performConnect();
    
    const event = { type: 'test', data: 'test-data' };
    connector.eventBus.publishEvent('test', event);
    
    // Verify event processing
    expect(connector.processedEvents).toContain(event);
  });
});
```

## Best Practices

1. **Always implement required methods**: `performConnect`, `performDisconnect`, `performHealthCheck`
2. **Use capability-based architecture**: Define capabilities and implement `executeCapability`
3. **Proper error handling**: Catch and log errors appropriately
4. **Health monitoring**: Implement comprehensive health checks
5. **Event-driven design**: Use the event bus for communication
6. **Configuration validation**: Validate all configuration parameters
7. **Logging**: Use structured logging with appropriate levels
8. **Testing**: Write comprehensive unit and integration tests
9. **Documentation**: Document all capabilities and methods
10. **Security**: Implement proper authentication and authorization

## Migration Guide

When updating connector structures:

1. **Check capability definitions**: Ensure all capabilities are properly defined
2. **Update executeCapability**: Add new capability handlers
3. **Test health checks**: Verify health monitoring still works
4. **Update documentation**: Keep this reference updated
5. **Backward compatibility**: Maintain compatibility where possible
6. **Migration scripts**: Provide migration utilities if needed

This reference should be updated whenever connector structures change to ensure all developers have access to the latest patterns and implementations. 