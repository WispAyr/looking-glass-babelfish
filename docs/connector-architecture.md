# Connector Architecture - Looking Glass

## Overview

The Looking Glass platform uses a connector-based architecture where different systems and protocols are abstracted into pluggable connectors. This allows for:

- **Modularity**: Each connector is self-contained and can be developed independently
- **Scalability**: Multiple instances of the same connector type can be used
- **Flexibility**: New connectors can be added without modifying core application logic
- **Interoperability**: Connectors can communicate capabilities and pair automatically
- **Future Integration**: Visual programming interface for wiring connectors together

## Core Concepts

### Connector
A connector is a self-contained module that:
- Implements a specific protocol or API (e.g., Unifi Protect, MQTT, HTTP, etc.)
- Exposes capabilities and operations it can perform
- Handles authentication and connection management
- Provides standardized interfaces for data exchange
- Can be instantiated multiple times with different configurations

### Capability
A capability defines what a connector can do:
- **Operations**: Actions the connector can perform (read, write, subscribe, etc.)
- **Data Types**: Types of data the connector can handle
- **Events**: Events the connector can emit or listen for
- **Resources**: Resources the connector can access (cameras, sensors, etc.)

### Connector Instance
A specific instance of a connector with:
- Unique identifier
- Configuration (endpoints, credentials, etc.)
- Connection state
- Runtime data

## Architecture Components

### 1. Connector Registry
Manages all available connector types and instances:
```javascript
{
  "unifi-protect": {
    type: "unifi-protect",
    version: "1.0.0",
    capabilities: [...],
    instances: {
      "communications-van": { ... },
      "backup-system": { ... }
    }
  }
}
```

### 2. Capability Matching Engine
Matches connector capabilities for automatic pairing:
```javascript
// Example: Match camera connectors with storage connectors
const matches = capabilityEngine.findMatches(
  "camera:video:stream", 
  "storage:video:record"
);
```

### 3. Event Bus
Centralized event system for connector communication:
```javascript
eventBus.emit("connector:unifi-protect:event", {
  connectorId: "communications-van",
  event: "motion-detected",
  data: { cameraId: "cam-1", timestamp: "..." }
});
```

### 4. Data Pipeline
Standardized data flow between connectors:
```javascript
pipeline.process({
  source: "unifi-protect:communications-van",
  destination: "mqtt:broker-1",
  transform: "event-to-mqtt-message",
  data: eventData
});
```

## Connector Interface

### Base Connector Class
```javascript
class BaseConnector {
  constructor(config) {
    this.id = config.id;
    this.type = config.type;
    this.config = config;
    this.capabilities = this.getCapabilities();
    this.status = 'disconnected';
  }

  // Must be implemented by each connector
  async connect() { throw new Error('Not implemented'); }
  async disconnect() { throw new Error('Not implemented'); }
  async getCapabilities() { throw new Error('Not implemented'); }
  
  // Optional hooks
  async onConnect() {}
  async onDisconnect() {}
  async onError(error) {}
  
  // Standard methods
  async emit(event, data) {
    eventBus.emit(`connector:${this.type}:${event}`, {
      connectorId: this.id,
      data
    });
  }
}
```

### Capability Definition
```javascript
{
  id: "camera:video:stream",
  name: "Video Stream",
  description: "Stream video from camera",
  category: "camera",
  operations: ["read"],
  dataTypes: ["video/rtsp", "video/mp4"],
  events: ["stream-started", "stream-stopped", "stream-error"],
  parameters: {
    cameraId: { type: "string", required: true },
    quality: { type: "string", enum: ["low", "medium", "high"] }
  }
}
```

## Connector Types

### 1. Data Source Connectors
- **Unifi Protect**: Camera feeds, events, recordings
- **HTTP APIs**: REST APIs, webhooks
- **Databases**: SQL, NoSQL databases
- **File Systems**: Local/remote file access
- **IoT Devices**: Sensors, actuators

### 2. Data Destination Connectors
- **MQTT Brokers**: Message publishing
- **Databases**: Data storage
- **File Systems**: File storage
- **HTTP Endpoints**: Web services
- **Email/SMS**: Notifications

### 3. Processing Connectors
- **Image Processing**: Video analysis, object detection
- **Data Transformers**: Format conversion, filtering
- **Aggregators**: Data combination, statistics
- **Schedulers**: Time-based operations

### 4. Control Connectors
- **Automation**: Rule engines, workflows
- **User Interfaces**: Web UIs, mobile apps
- **External Systems**: Third-party integrations

## Configuration Management

### Connector Configuration
```javascript
{
  id: "communications-van",
  type: "unifi-protect",
  name: "Communications Van System",
  description: "Primary Unifi Protect system in communications van",
  config: {
    host: "10.0.0.1",
    port: 443,
    protocol: "https",
    apiKey: "6pXhUX2-hnWonI8abmazH4kGRdVLp4r8",
    verifySSL: true,
    timeout: 10000
  },
  capabilities: {
    enabled: ["camera:video:stream", "camera:event:motion"],
    disabled: ["camera:recording:download"]
  },
  connections: {
    inputs: ["mqtt:broker-1"],
    outputs: ["database:events", "file:recordings"]
  }
}
```

### Dynamic Configuration
Connectors can be configured at runtime:
```javascript
// Add new connector instance
await connectorRegistry.addConnector({
  type: "unifi-protect",
  config: { host: "192.168.1.100", apiKey: "..." }
});

// Update existing connector
await connectorRegistry.updateConnector("communications-van", {
  config: { timeout: 15000 }
});

// Enable/disable capabilities
await connectorRegistry.updateCapabilities("communications-van", {
  enabled: ["camera:video:stream"],
  disabled: ["camera:event:motion"]
});
```

## Event System

### Event Types
```javascript
// Connector lifecycle events
"connector:connected"
"connector:disconnected"
"connector:error"

// Data events
"connector:data:received"
"connector:data:processed"
"connector:data:transmitted"

// Capability events
"connector:capability:enabled"
"connector:capability:disabled"
"connector:capability:matched"
```

### Event Handling
```javascript
// Subscribe to events
eventBus.on("connector:unifi-protect:event", (data) => {
  console.log(`Event from ${data.connectorId}:`, data.event);
});

// Emit events
connector.emit("motion-detected", {
  cameraId: "cam-1",
  timestamp: new Date().toISOString(),
  confidence: 0.85
});
```

## Data Flow

### Pipeline Definition
```javascript
const pipeline = {
  id: "motion-to-mqtt",
  name: "Motion Events to MQTT",
  description: "Send motion events to MQTT broker",
  source: {
    connector: "unifi-protect:communications-van",
    capability: "camera:event:motion"
  },
  destination: {
    connector: "mqtt:broker-1",
    capability: "mqtt:publish"
  },
  transform: {
    type: "mapping",
    rules: [
      { from: "cameraId", to: "device" },
      { from: "timestamp", to: "time" },
      { from: "confidence", to: "score" }
    ]
  },
  filters: [
    { field: "confidence", operator: ">=", value: 0.5 }
  ]
};
```

### Pipeline Execution
```javascript
// Register pipeline
await pipelineEngine.register(pipeline);

// Pipeline automatically processes data
// Source connector emits event
// Pipeline transforms and routes to destination
// Destination connector receives processed data
```

## Future Vision: Visual Programming Interface

### Node-RED Style Interface
The future interface will allow users to:

1. **Drag and Drop Connectors**
   - Visual representation of connector instances
   - Connection status indicators
   - Configuration panels

2. **Wire Connections**
   - Visual lines between connectors
   - Data flow visualization
   - Real-time data preview

3. **Configure Pipelines**
   - Transform rules
   - Filter conditions
   - Error handling

4. **Monitor and Debug**
   - Real-time data flow
   - Performance metrics
   - Error logs

### Example Workflow
```
[Unifi Camera] → [Motion Detection] → [MQTT Broker] → [Database]
     ↓              ↓                    ↓              ↓
  Video Stream   Object Detection    Message Pub    Event Storage
```

## Implementation Guidelines

### Creating a New Connector

1. **Extend BaseConnector**
```javascript
class UnifiProtectConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.api = null;
  }

  async connect() {
    // Implementation specific to Unifi Protect
  }

  getCapabilities() {
    return [
      {
        id: "camera:video:stream",
        name: "Video Stream",
        // ... capability definition
      }
    ];
  }
}
```

2. **Register Connector Type**
```javascript
connectorRegistry.registerType("unifi-protect", UnifiProtectConnector);
```

3. **Define Capabilities**
```javascript
// In connector implementation
static getCapabilityDefinitions() {
  return [
    // ... capability definitions
  ];
}
```

### Best Practices

1. **Error Handling**: Always implement proper error handling and recovery
2. **Logging**: Use structured logging for debugging and monitoring
3. **Configuration**: Support both static and dynamic configuration
4. **Testing**: Write comprehensive tests for each connector
5. **Documentation**: Document capabilities, configuration, and usage
6. **Security**: Implement proper authentication and authorization
7. **Performance**: Optimize for the specific use case

## Migration Path

### Phase 1: Refactor Existing Code
- Extract Unifi Protect logic into connector
- Create base connector infrastructure
- Implement capability system

### Phase 2: Add New Connectors
- MQTT connector
- HTTP API connector
- Database connector
- File system connector

### Phase 3: Visual Interface
- Basic drag-and-drop interface
- Simple wiring capabilities
- Configuration panels

### Phase 4: Advanced Features
- Complex transformations
- Conditional logic
- Error handling workflows
- Performance optimization

This architecture provides a solid foundation for building a scalable, extensible system that can grow with your needs while maintaining simplicity and usability. 