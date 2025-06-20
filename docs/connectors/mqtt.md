# MQTT Connector

## Overview

The MQTT connector provides integration with MQTT (Message Queuing Telemetry Transport) brokers for publish/subscribe messaging. It enables real-time communication between different systems and devices in the Looking Glass platform.

## Capabilities

### Core Capabilities

#### 1. Message Publishing
- **ID**: `mqtt:publish`
- **Operations**: `write`
- **Data Types**: `application/json`, `text/plain`, `application/octet-stream`
- **Events**: `message-published`, `publish-error`
- **Parameters**:
  - `topic` (string, required): MQTT topic to publish to
  - `payload` (any, required): Message payload
  - `qos` (number, optional): Quality of Service (0, 1, 2)
  - `retain` (boolean, optional): Retain flag
  - `properties` (object, optional): MQTT 5.0 properties

#### 2. Message Subscription
- **ID**: `mqtt:subscribe`
- **Operations**: `subscribe`, `unsubscribe`
- **Data Types**: `application/json`, `text/plain`, `application/octet-stream`
- **Events**: `message-received`, `subscription-error`
- **Parameters**:
  - `topic` (string, required): MQTT topic to subscribe to
  - `qos` (number, optional): Quality of Service (0, 1, 2)
  - `options` (object, optional): Subscription options

#### 3. Topic Management
- **ID**: `mqtt:topics`
- **Operations**: `list`, `create`, `delete`
- **Data Types**: `application/json`
- **Description**: Manage MQTT topics and their properties

#### 4. Connection Management
- **ID**: `mqtt:connection`
- **Operations**: `connect`, `disconnect`, `status`
- **Data Types**: `application/json`
- **Events**: `connected`, `disconnected`, `error`
- **Description**: Manage MQTT broker connections

#### 5. Message History
- **ID**: `mqtt:history`
- **Operations**: `read`, `clear`
- **Data Types**: `application/json`
- **Description**: Access message history and retained messages

## Configuration

### Basic Configuration
```javascript
{
  id: "broker-1",
  type: "mqtt",
  name: "Primary MQTT Broker",
  description: "Main MQTT broker for system communication",
  config: {
    host: "localhost",
    port: 1883,
    protocol: "mqtt",
    clientId: "looking-glass-client",
    username: "user",
    password: "password",
    keepalive: 60,
    reconnectPeriod: 1000,
    connectTimeout: 30000,
    clean: true
  }
}
```

### Advanced Configuration
```javascript
{
  id: "secure-broker",
  type: "mqtt",
  name: "Secure MQTT Broker",
  description: "TLS-enabled MQTT broker for secure communication",
  config: {
    host: "mqtt.example.com",
    port: 8883,
    protocol: "mqtts",
    clientId: "looking-glass-secure",
    username: "secure-user",
    password: "secure-password",
    keepalive: 60,
    reconnectPeriod: 1000,
    connectTimeout: 30000,
    clean: true,
    // TLS/SSL options
    ca: "/path/to/ca.crt",
    cert: "/path/to/client.crt",
    key: "/path/to/client.key",
    rejectUnauthorized: true,
    // Advanced options
    maxReconnectAttempts: 10,
    reschedulePings: true,
    queueQoSZero: true,
    // MQTT 5.0 options
    protocolVersion: 5,
    properties: {
      sessionExpiryInterval: 3600,
      receiveMaximum: 100,
      maximumPacketSize: 1024 * 1024
    }
  },
  capabilities: {
    enabled: [
      "mqtt:publish",
      "mqtt:subscribe",
      "mqtt:connection"
    ],
    disabled: [
      "mqtt:topics" // Disable topic management for security
    ]
  }
}
```

### Multiple Broker Configuration
```javascript
{
  id: "broker-cluster",
  type: "mqtt",
  name: "MQTT Broker Cluster",
  description: "Multiple MQTT brokers for high availability",
  config: {
    brokers: [
      {
        host: "broker1.example.com",
        port: 1883,
        weight: 1
      },
      {
        host: "broker2.example.com",
        port: 1883,
        weight: 1
      },
      {
        host: "broker3.example.com",
        port: 1883,
        weight: 0.5
      }
    ],
    clientId: "looking-glass-cluster",
    username: "cluster-user",
    password: "cluster-password",
    // Load balancing options
    loadBalancing: "round-robin", // or "weighted", "least-connections"
    failover: true,
    healthCheck: {
      interval: 30000,
      timeout: 5000
    }
  }
}
```

## Usage Examples

### 1. Publish Message
```javascript
const connector = await connectorRegistry.getConnector("broker-1");

// Publish simple message
await connector.execute("mqtt:publish", "write", {
  topic: "sensors/temperature",
  payload: {
    device: "temp-sensor-1",
    value: 23.5,
    unit: "celsius",
    timestamp: new Date().toISOString()
  },
  qos: 1,
  retain: false
});

// Publish with MQTT 5.0 properties
await connector.execute("mqtt:publish", "write", {
  topic: "alerts/security",
  payload: "Motion detected at front door",
  qos: 2,
  retain: true,
  properties: {
    contentType: "text/plain",
    messageExpiryInterval: 3600,
    userProperties: {
      priority: "high",
      category: "security"
    }
  }
});
```

### 2. Subscribe to Topics
```javascript
const connector = await connectorRegistry.getConnector("broker-1");

// Subscribe to single topic
await connector.execute("mqtt:subscribe", "subscribe", {
  topic: "sensors/+/temperature",
  qos: 1
});

// Subscribe to multiple topics
await connector.execute("mqtt:subscribe", "subscribe", {
  topics: [
    { topic: "sensors/+/temperature", qos: 1 },
    { topic: "alerts/#", qos: 2 },
    { topic: "status/+/online", qos: 0 }
  ]
});

// Listen for messages
connector.on("message-received", (data) => {
  console.log("Message received:", {
    topic: data.topic,
    payload: data.payload,
    qos: data.qos,
    retain: data.retain
  });
});
```

### 3. Connection Management
```javascript
const connector = await connectorRegistry.getConnector("broker-1");

// Check connection status
const status = await connector.execute("mqtt:connection", "status");
console.log("Connection status:", status);

// Listen for connection events
connector.on("connected", () => {
  console.log("Connected to MQTT broker");
});

connector.on("disconnected", () => {
  console.log("Disconnected from MQTT broker");
});

connector.on("error", (error) => {
  console.error("MQTT error:", error);
});
```

### 4. Topic Management
```javascript
const connector = await connectorRegistry.getConnector("broker-1");

// List available topics
const topics = await connector.execute("mqtt:topics", "list", {
  pattern: "sensors/#"
});

console.log("Available topics:", topics);

// Create topic with properties
await connector.execute("mqtt:topics", "create", {
  topic: "sensors/new-sensor",
  properties: {
    description: "New temperature sensor",
    retention: "retained",
    maxQos: 2
  }
});
```

### 5. Message History
```javascript
const connector = await connectorRegistry.getConnector("broker-1");

// Get message history
const history = await connector.execute("mqtt:history", "read", {
  topic: "sensors/temperature",
  limit: 100,
  since: "2024-01-15T00:00:00Z"
});

console.log("Message history:", history);

// Clear message history
await connector.execute("mqtt:history", "clear", {
  topic: "sensors/temperature"
});
```

## Event Handling

### Message Events
```javascript
// Message received
{
  event: "message-received",
  data: {
    topic: "sensors/temp-sensor-1/temperature",
    payload: {
      device: "temp-sensor-1",
      value: 23.5,
      unit: "celsius",
      timestamp: "2024-01-15T10:30:45.123Z"
    },
    qos: 1,
    retain: false,
    dup: false,
    messageId: 12345,
    properties: {
      contentType: "application/json",
      userProperties: {
        location: "room-101"
      }
    }
  }
}

// Message published
{
  event: "message-published",
  data: {
    topic: "alerts/security",
    payload: "Motion detected",
    qos: 2,
    retain: true,
    messageId: 12346
  }
}
```

### Connection Events
```javascript
// Connected
{
  event: "connected",
  data: {
    clientId: "looking-glass-client",
    broker: "mqtt://localhost:1883",
    timestamp: "2024-01-15T10:30:45.123Z"
  }
}

// Disconnected
{
  event: "disconnected",
  data: {
    clientId: "looking-glass-client",
    reason: "client_disconnect",
    timestamp: "2024-01-15T10:35:12.456Z"
  }
}

// Error
{
  event: "error",
  data: {
    error: "ECONNREFUSED",
    message: "Connection refused",
    timestamp: "2024-01-15T10:30:45.123Z"
  }
}
```

## Error Handling

### Common Errors
```javascript
// Connection error
{
  error: "CONNECTION_FAILED",
  message: "Failed to connect to MQTT broker",
  details: {
    host: "localhost",
    port: 1883,
    reason: "ECONNREFUSED"
  }
}

// Authentication error
{
  error: "AUTHENTICATION_FAILED",
  message: "Invalid username or password",
  details: {
    username: "user",
    reason: "Not authorized"
  }
}

// Topic error
{
  error: "TOPIC_ERROR",
  message: "Invalid topic format",
  details: {
    topic: "invalid/topic/#/",
    reason: "Wildcard in middle of topic"
  }
}

// QoS error
{
  error: "QOS_ERROR",
  message: "Unsupported QoS level",
  details: {
    qos: 3,
    supportedQos: [0, 1, 2]
  }
}
```

### Error Recovery
```javascript
const connector = await connectorRegistry.getConnector("broker-1");

try {
  await connector.execute("mqtt:publish", "write", {
    topic: "test/message",
    payload: "Hello World"
  });
} catch (error) {
  if (error.error === "CONNECTION_FAILED") {
    // Attempt to reconnect
    await connector.execute("mqtt:connection", "connect");
    await connector.execute("mqtt:publish", "write", {
      topic: "test/message",
      payload: "Hello World"
    });
  } else if (error.error === "AUTHENTICATION_FAILED") {
    // Update credentials and retry
    await connector.updateConfig({
      username: "new-user",
      password: "new-password"
    });
    await connector.execute("mqtt:publish", "write", {
      topic: "test/message",
      payload: "Hello World"
    });
  }
}
```

## Performance Considerations

### Message Batching
```javascript
// Batch multiple messages
const messages = [
  { topic: "sensors/temp-1", payload: { value: 23.5 } },
  { topic: "sensors/temp-2", payload: { value: 24.1 } },
  { topic: "sensors/temp-3", payload: { value: 22.8 } }
];

await connector.execute("mqtt:publish", "write", {
  messages: messages,
  batchSize: 10,
  batchDelay: 100
});
```

### QoS Selection
- **QoS 0**: At most once delivery (fire and forget)
- **QoS 1**: At least once delivery (acknowledged)
- **QoS 2**: Exactly once delivery (guaranteed)

### Connection Pooling
- Reuse connections when possible
- Implement connection pooling for high-throughput scenarios
- Monitor connection health and reconnect as needed

## Security

### Authentication
```javascript
// Username/password authentication
{
  username: "user",
  password: "password"
}

// Certificate-based authentication
{
  cert: "/path/to/client.crt",
  key: "/path/to/client.key",
  ca: "/path/to/ca.crt"
}

// Token-based authentication
{
  username: "token-user",
  password: "jwt-token-here"
}
```

### Topic Security
```javascript
// Use topic prefixes for security
const secureTopics = {
  public: "public/",
  private: "private/",
  admin: "admin/"
};

// Validate topic access
function validateTopicAccess(topic, userRole) {
  if (topic.startsWith("admin/") && userRole !== "admin") {
    throw new Error("Access denied to admin topics");
  }
}
```

### Message Encryption
```javascript
// Encrypt sensitive payloads
const encryptedPayload = await encrypt(payload, encryptionKey);

await connector.execute("mqtt:publish", "write", {
  topic: "secure/data",
  payload: encryptedPayload,
  properties: {
    contentType: "application/encrypted"
  }
});
```

## Integration Examples

### With Unifi Protect Connector
```javascript
// Motion event → MQTT message
const pipeline = {
  id: "motion-to-mqtt",
  source: {
    connector: "unifi-protect:communications-van",
    capability: "camera:event:motion"
  },
  destination: {
    connector: "mqtt:broker-1",
    capability: "mqtt:publish"
  },
  transform: {
    topic: "security/motion/{cameraId}",
    payload: {
      device: "{cameraId}",
      time: "{timestamp}",
      confidence: "{confidence}",
      location: "{cameraName}"
    },
    qos: 1,
    retain: false
  }
};
```

### With Database Connector
```javascript
// MQTT message → Database record
const pipeline = {
  id: "mqtt-to-database",
  source: {
    connector: "mqtt:broker-1",
    capability: "mqtt:subscribe"
  },
  destination: {
    connector: "database:sensors",
    capability: "database:insert"
  },
  transform: {
    topic: "sensors/+/temperature",
    table: "temperature_readings",
    data: {
      device_id: "{topic.parts[1]}",
      value: "{payload.value}",
      unit: "{payload.unit}",
      timestamp: "{payload.timestamp}"
    }
  }
};
```

### With HTTP Connector
```javascript
// MQTT message → HTTP webhook
const pipeline = {
  id: "mqtt-to-webhook",
  source: {
    connector: "mqtt:broker-1",
    capability: "mqtt:subscribe"
  },
  destination: {
    connector: "http:webhook-service",
    capability: "http:post"
  },
  transform: {
    topic: "alerts/security",
    url: "https://api.example.com/webhooks/security",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer {webhook_token}"
    },
    body: {
      alert: "{payload}",
      source: "mqtt",
      timestamp: "{timestamp}"
    }
  }
};
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check broker host and port
   - Verify broker is running
   - Check firewall settings

2. **Authentication Failed**
   - Verify username and password
   - Check certificate files
   - Ensure user has proper permissions

3. **Message Not Received**
   - Check topic subscription
   - Verify QoS settings
   - Check message format

4. **High Latency**
   - Optimize QoS settings
   - Use message batching
   - Check network connectivity

### Debug Mode
```javascript
const connector = await connectorRegistry.getConnector("broker-1");

// Enable debug logging
connector.setDebugMode(true);

// Monitor all MQTT operations
connector.on("debug", (data) => {
  console.log("MQTT Debug:", data);
});
```

This connector provides robust MQTT integration with support for both MQTT 3.1.1 and 5.0 protocols, enabling flexible messaging patterns in the Looking Glass platform. 