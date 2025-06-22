# Connector Architecture

## Overview

The Looking Glass platform uses a modular connector-based architecture that enables integration with diverse systems and protocols through a unified interface. This architecture provides:

- **Modularity**: Each connector is self-contained and can be developed independently
- **Scalability**: Multiple instances of the same connector type can be used
- **Flexibility**: New connectors can be added without modifying core application logic
- **Interoperability**: Connectors can communicate capabilities and pair automatically
- **Extensibility**: Visual programming interface for wiring connectors together

## Architecture Components

### Core Components

#### BaseConnector
The foundation class that all connectors extend, providing:
- Common lifecycle management (connect, disconnect, health checks)
- Event bus integration
- Configuration validation
- Capability management
- Error handling and logging

#### ConnectorRegistry
Manages the discovery, registration, and lifecycle of all connectors:
- Dynamic connector loading
- Capability discovery and pairing
- Health monitoring
- Configuration management

#### EventBus
Central event processing system that:
- Normalizes events from all sources
- Routes events to appropriate subscribers
- Provides real-time event streaming
- Manages event history and deduplication

### Connector Types

#### Video & Security Connectors

**UniFi Protect Connector**
- Real-time video streaming and management
- Motion detection and smart detection events
- ANPR (Automatic Number Plate Recognition)
- Doorbell integration
- Recording management

**Hikvision Connector**
- IP camera integration via ISAPI REST API
- PTZ control and preset management
- Motion detection and event handling
- Recording and snapshot capabilities

**Ankke DVR Connector**
- DVR system integration
- Multi-channel video management
- Recording and playback control
- Motion detection configuration

#### Communication & Messaging Connectors

**MQTT Connector**
- IoT device communication
- Sensor data integration
- Automation triggers
- Message history and management

**Telegram Connector**
- Real-time notifications and alerts
- Two-way communication
- Media sharing capabilities
- Keyboard and webhook support

**LLM Connector**
- AI-powered automation and decision making
- Natural language processing
- Function calling for autonomous operations
- Multi-provider support (OpenAI, Anthropic, local models)

#### Aviation & Tracking Connectors

**ADSB Connector**
- Automatic Dependent Surveillance-Broadcast data processing
- Real-time aircraft tracking
- Emergency squawk code monitoring
- Radar visualization and zone management

**APRS Connector**
- Amateur radio station tracking
- Weather data integration
- Message monitoring
- Automatic map integration

#### Spatial & Visualization Connectors

**Map Connector**
- Spatial visualization and management
- Real-time map integration
- Zone definition and monitoring
- Event visualization on maps

**Web GUI Connector**
- Modern web interface with component system
- Real-time updates via WebSockets
- Responsive design and mobile support
- Theme management and customization

#### Analytics & Processing Connectors

**Speed Calculation Connector**
- ANPR-based vehicle speed monitoring
- Multi-point detection and tracking
- Speed violation alerts
- Historical analytics and reporting

**Overwatch Connector**
- Central event processing and orchestration
- Flow management and automation
- Rule engine and decision making
- System health monitoring

## Connector Lifecycle

### 1. Discovery
Connectors are discovered and loaded from configuration files:
```javascript
// config/connectors.json
[
  {
    "id": "unifi-protect-main",
    "type": "unifi-protect",
    "name": "Main Security System",
    "config": {
      "host": "192.168.1.100",
      "apiKey": "your-api-key"
    }
  }
]
```

### 2. Validation
Configuration is validated against connector requirements:
```javascript
static validateConfig(config) {
  const errors = [];
  
  if (!config.host) {
    errors.push('Host is required');
  }
  
  if (!config.apiKey) {
    errors.push('API key is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### 3. Initialization
Connectors are initialized with their configuration:
```javascript
constructor(config) {
  super(config);
  this.host = config.host;
  this.apiKey = config.apiKey;
  this.connected = false;
}
```

### 4. Connection
Connectors establish connections to their respective systems:
```javascript
async performConnect() {
  try {
    // Establish connection
    this.connection = await this.createConnection();
    this.connected = true;
    
    // Subscribe to events
    this.setupEventListeners();
    
    this.logger.info(`Connected to ${this.config.host}`);
  } catch (error) {
    this.logger.error(`Failed to connect: ${error.message}`);
    throw error;
  }
}
```

### 5. Operation
Connectors begin normal operation and event processing:
```javascript
setupEventListeners() {
  this.connection.on('event', (event) => {
    this.eventBus.publishEvent('motion', {
      source: this.id,
      data: event,
      timestamp: Date.now()
    });
  });
}
```

### 6. Monitoring
Health monitoring tracks connector status and performance:
```javascript
async performHealthCheck() {
  try {
    const status = await this.getSystemStatus();
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

### 7. Disconnection
Connectors gracefully disconnect when stopped:
```javascript
async performDisconnect() {
  try {
    if (this.connection) {
      await this.connection.close();
    }
    this.connected = false;
    this.logger.info('Disconnected successfully');
  } catch (error) {
    this.logger.error(`Error during disconnect: ${error.message}`);
  }
}
```

## Capability System

### Capability Definition
Each connector defines its capabilities through the `getCapabilityDefinitions()` method:

```javascript
static getCapabilityDefinitions() {
  return [
    {
      id: 'camera:management',
      name: 'Camera Management',
      description: 'Manage camera devices and settings',
      category: 'video',
      operations: ['list', 'get', 'update', 'delete'],
      dataTypes: ['camera'],
      events: ['camera:added', 'camera:updated', 'camera:deleted'],
      parameters: {
        siteId: { type: 'string', required: false },
        cameraId: { type: 'string', required: false }
      }
    }
  ];
}
```

### Capability Categories

#### Video & Security
- `camera:management` - Camera device management
- `camera:video:stream` - Video streaming capabilities
- `camera:event:motion` - Motion detection events
- `camera:event:smartdetect` - Smart detection events
- `camera:recording:management` - Recording management
- `camera:snapshot` - Snapshot capabilities

#### Communication
- `mqtt:publish` - MQTT message publishing
- `mqtt:subscribe` - MQTT topic subscription
- `telegram:send` - Telegram message sending
- `telegram:receive` - Telegram message receiving
- `llm:chat` - LLM conversation capabilities

#### Aviation & Tracking
- `adsb:aircraft` - Aircraft tracking
- `adsb:radar` - Radar visualization
- `aprs:stations` - APRS station tracking
- `aprs:weather` - Weather data

#### Spatial & Visualization
- `map:spatial` - Spatial element management
- `map:visualization` - Map visualization
- `gui:pages` - Web GUI page management
- `gui:components` - Component management

#### Analytics & Processing
- `speed:calculation` - Speed calculation
- `overwatch:events` - Event processing
- `overwatch:flows` - Flow management

### Capability Execution
Capabilities are executed through the `executeCapability()` method:

```javascript
async executeCapability(capabilityId, operation, parameters) {
  switch (capabilityId) {
    case 'camera:management':
      return await this.executeCameraManagement(operation, parameters);
    case 'camera:video:stream':
      return await this.executeVideoStream(operation, parameters);
    default:
      throw new Error(`Unknown capability: ${capabilityId}`);
  }
}
```

## Event System

### Event Publishing
Connectors publish events to the event bus:

```javascript
// Publish a motion event
this.eventBus.publishEvent('motion', {
  source: this.id,
  data: {
    device: cameraId,
    start: event.start,
    end: event.end,
    confidence: event.confidence
  },
  timestamp: Date.now()
});
```

### Event Subscription
Connectors can subscribe to events from other connectors:

```javascript
// Subscribe to motion events
this.eventBus.subscribe('motion', (event) => {
  if (event.source !== this.id) {
    this.processMotionEvent(event);
  }
});
```

### Event Types

#### Security Events
- `motion` - Motion detection events
- `smartdetect` - Smart detection events
- `doorbell` - Doorbell ring events
- `intrusion` - Intrusion detection events

#### Aviation Events
- `aircraft:detected` - Aircraft detection events
- `aircraft:emergency` - Emergency aircraft events
- `squawk:analysis` - Squawk code analysis events

#### System Events
- `connector:status` - Connector status changes
- `system:health` - System health events
- `error` - Error events

## Configuration Management

### Configuration Structure
```javascript
{
  "id": "unique-connector-id",
  "type": "connector-type",
  "name": "Human Readable Name",
  "description": "Optional description",
  "config": {
    // Connector-specific configuration
    "host": "192.168.1.100",
    "port": 443,
    "protocol": "https",
    "apiKey": "your-api-key"
  },
  "capabilities": {
    "enabled": ["capability1", "capability2"],
    "disabled": ["capability3"]
  },
  "metadata": {
    "version": "1.0.0",
    "author": "Your Name",
    "tags": ["security", "video"]
  }
}
```

### Environment Variables
Configuration can also be provided via environment variables:

```bash
# UniFi Protect
UNIFI_HOST=192.168.1.100
UNIFI_PORT=443
UNIFI_API_KEY=your-api-key

# MQTT
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=user
MQTT_PASSWORD=password
```

## Error Handling

### Error Types
- **Connection Errors**: Network connectivity issues
- **Authentication Errors**: Invalid credentials or permissions
- **Configuration Errors**: Invalid or missing configuration
- **Operation Errors**: Failed operations or timeouts
- **System Errors**: Internal system errors

### Error Handling Strategy
```javascript
async executeCapability(capabilityId, operation, parameters) {
  try {
    // Validate capability
    if (!this.capabilities.includes(capabilityId)) {
      throw new Error(`Capability not supported: ${capabilityId}`);
    }
    
    // Execute operation
    const result = await this.performOperation(operation, parameters);
    
    // Log success
    this.logger.debug(`Operation completed: ${capabilityId}.${operation}`);
    
    return result;
  } catch (error) {
    // Log error
    this.logger.error(`Operation failed: ${capabilityId}.${operation}`, error);
    
    // Update health status
    this.updateHealthStatus('error', error.message);
    
    // Re-throw for handling by caller
    throw error;
  }
}
```

## Health Monitoring

### Health Check Implementation
```javascript
async performHealthCheck() {
  const checks = {
    connection: await this.checkConnection(),
    authentication: await this.checkAuthentication(),
    capabilities: await this.checkCapabilities(),
    performance: await this.checkPerformance()
  };
  
  const healthy = Object.values(checks).every(check => check.healthy);
  
  return {
    healthy,
    checks,
    timestamp: Date.now(),
    uptime: Date.now() - this.startTime
  };
}
```

### Health Metrics
- **Connection Status**: Is the connector connected?
- **Response Time**: How quickly does the connector respond?
- **Error Rate**: What percentage of operations fail?
- **Resource Usage**: Memory, CPU, and network usage
- **Event Throughput**: Number of events processed per second

## Performance Optimization

### Connection Pooling
```javascript
class ConnectionPool {
  constructor(maxConnections = 10) {
    this.pool = [];
    this.maxConnections = maxConnections;
  }
  
  async getConnection() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    
    if (this.pool.length < this.maxConnections) {
      return await this.createConnection();
    }
    
    // Wait for available connection
    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }
}
```

### Event Batching
```javascript
class EventBatcher {
  constructor(batchSize = 10, batchTimeout = 1000) {
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
    this.batch = [];
    this.timer = null;
  }
  
  addEvent(event) {
    this.batch.push(event);
    
    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchTimeout);
    }
  }
  
  flush() {
    if (this.batch.length > 0) {
      this.eventBus.publishBatch(this.batch);
      this.batch = [];
    }
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
```

## Security Considerations

### Authentication
- API key management
- Token refresh mechanisms
- Secure credential storage
- Multi-factor authentication support

### Data Protection
- Encryption in transit (TLS/SSL)
- Encryption at rest
- Data anonymization
- Access control and permissions

### Network Security
- Firewall configuration
- VPN support
- Network segmentation
- Intrusion detection

## Testing Strategy

### Unit Testing
```javascript
describe('UniFi Protect Connector', () => {
  let connector;
  
  beforeEach(() => {
    connector = new UniFiProtectConnector({
      host: 'test-host',
      apiKey: 'test-key'
    });
  });
  
  test('should validate configuration', () => {
    const result = UniFiProtectConnector.validateConfig({
      host: 'test-host',
      apiKey: 'test-key'
    });
    
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
  test('should process events from UniFi to MQTT', async () => {
    // Setup connectors
    const unifiConnector = new UniFiProtectConnector(config);
    const mqttConnector = new MQTTConnector(config);
    
    // Connect both
    await unifiConnector.performConnect();
    await mqttConnector.performConnect();
    
    // Simulate motion event
    const event = { type: 'motion', device: 'camera-1' };
    unifiConnector.eventBus.publishEvent('motion', event);
    
    // Verify MQTT message
    await expect(mqttConnector).toReceiveMessage('motion', event);
  });
});
```

### Performance Testing
```javascript
describe('Performance Tests', () => {
  test('should handle high event throughput', async () => {
    const connector = new TestConnector();
    await connector.performConnect();
    
    const startTime = Date.now();
    const eventCount = 1000;
    
    // Publish events rapidly
    for (let i = 0; i < eventCount; i++) {
      connector.eventBus.publishEvent('test', { id: i });
    }
    
    const endTime = Date.now();
    const throughput = eventCount / ((endTime - startTime) / 1000);
    
    expect(throughput).toBeGreaterThan(100); // 100 events/second
  });
});
```

## Future Enhancements

### Visual Programming Interface
- Drag-and-drop connector wiring
- Visual flow builder
- Real-time data flow visualization
- Component marketplace

### Advanced Analytics
- Machine learning integration
- Predictive analytics
- Anomaly detection
- Performance optimization

### Cloud Integration
- Multi-site synchronization
- Cloud backup and restore
- Remote management
- Scalable deployment

### Edge Computing
- Distributed processing
- Local analytics
- Offline operation
- Edge-to-cloud synchronization

---

This architecture provides a solid foundation for building scalable, modular, and extensible systems that can integrate with virtually any external system or protocol. 