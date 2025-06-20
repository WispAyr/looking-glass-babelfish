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
- `camera:recording:management` - Manage camera recordings
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

## API Examples

### Create a Connector

```bash
curl -X POST http://localhost:3000/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-unifi",
    "type": "unifi-protect",
    "name": "My Unifi System",
    "config": {
      "host": "192.168.1.100",
      "port": 443,
      "protocol": "https",
      "apiKey": "my-api-key"
    }
  }'
```

### Execute a Connector Operation

```bash
curl -X POST http://localhost:3000/api/connectors/my-unifi/execute \
  -H "Content-Type: application/json" \
  -d '{
    "capabilityId": "camera:management",
    "operation": "list",
    "parameters": {
      "siteId": "default"
    }
  }'
```

### Connect a Connector

```bash
curl -X POST http://localhost:3000/api/connectors/my-unifi/connect
```

### Get Connector Status

```bash
curl http://localhost:3000/api/connectors/status
```

## WebSocket Events

The server broadcasts connector events via WebSocket:

- `connectorConnected` - Connector connected successfully
- `connectorDisconnected` - Connector disconnected
- `connectorOperationCompleted` - Connector operation completed
- `connectorOperationError` - Connector operation failed

## Configuration

### Connector Configuration File

Connectors are configured in `config/connectors.json`:

```json
{
  "connectors": [
    {
      "id": "communications-van",
      "type": "unifi-protect",
      "name": "Communications Van System",
      "description": "Primary Unifi Protect system",
      "config": {
        "host": "10.0.0.1",
        "port": 443,
        "protocol": "https",
        "apiKey": "your-api-key"
      },
      "capabilities": {
        "enabled": [
          "camera:management",
          "camera:video:stream",
          "camera:event:motion"
        ],
        "disabled": [
          "system:users"
        ]
      }
    }
  ]
}
```

### Environment Variables

You can also configure connectors using environment variables:

```bash
# Unifi Protect
UNIFI_HOST=10.0.0.1
UNIFI_PORT=443
UNIFI_API_KEY=your-api-key

# MQTT
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=user
MQTT_PASSWORD=password
```

## Creating Custom Connectors

### 1. Extend BaseConnector

```javascript
const BaseConnector = require('../BaseConnector');

class MyCustomConnector extends BaseConnector {
  constructor(config) {
    super(config);
    // Initialize your connector
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
  
  static getCapabilityDefinitions() {
    return [
      {
        id: 'my:capability',
        name: 'My Capability',
        description: 'Description of my capability',
        category: 'custom',
        operations: ['read', 'write'],
        dataTypes: ['application/json'],
        events: ['data-received'],
        parameters: {
          param1: { type: 'string', required: true }
        }
      }
    ];
  }
  
  static getMetadata() {
    return {
      type: 'my-custom',
      version: '1.0.0',
      description: 'My custom connector',
      author: 'Your Name'
    };
  }
}

module.exports = MyCustomConnector;
```

### 2. Register the Connector

```javascript
const MyCustomConnector = require('./connectors/types/MyCustomConnector');
connectorRegistry.registerType('my-custom', MyCustomConnector);
```

### 3. Create an Instance

```json
{
  "id": "my-instance",
  "type": "my-custom",
  "name": "My Custom Connector",
  "config": {
    "endpoint": "https://api.example.com",
    "apiKey": "your-key"
  }
}
```

## Capability Matching

The system can automatically match connectors based on their capabilities:

```javascript
// Find connectors that can publish to MQTT
const publishers = registry.findConnectorsByCapability('mqtt:publish');

// Find matches between motion detection and MQTT publishing
const matches = registry.findCapabilityMatches('camera:event:motion', 'mqtt:publish');
```

## Event Handling

Connectors emit events that can be listened to:

```javascript
// Listen for connector events
connector.on('connected', (data) => {
  console.log('Connector connected:', data);
});

connector.on('operation-completed', (data) => {
  console.log('Operation completed:', data);
});

connector.on('error', (error) => {
  console.error('Connector error:', error);
});
```

## Performance Considerations

### Rate Limiting

Connectors support rate limiting to prevent overwhelming external services:

```json
{
  "config": {
    "rateLimit": {
      "requests": 100,
      "window": 60000
    }
  }
}
```

### Connection Pooling

Connectors automatically manage connections and implement connection pooling where appropriate.

### Caching

Connectors can cache frequently accessed data to improve performance.

## Security

### API Key Management

Store API keys securely using environment variables or encrypted configuration.

### SSL/TLS

Connectors support SSL/TLS for secure communication:

```json
{
  "config": {
    "protocol": "https",
    "verifySSL": true,
    "ca": "/path/to/ca.crt",
    "cert": "/path/to/client.crt",
    "key": "/path/to/client.key"
  }
}
```

### Access Control

Disable unnecessary capabilities to limit connector access:

```json
{
  "capabilities": {
    "enabled": ["read-only-capabilities"],
    "disabled": ["admin-capabilities"]
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check host and port configuration
   - Verify network connectivity
   - Check firewall settings

2. **Authentication Failed**
   - Verify API keys or credentials
   - Check permissions
   - Ensure credentials are not expired

3. **Capability Not Found**
   - Check if capability is enabled
   - Verify capability ID spelling
   - Ensure connector supports the capability

### Debug Mode

Enable debug mode for detailed logging:

```javascript
connector.setDebugMode(true);
```

### Logs

Check the application logs for detailed error information:

```bash
tail -f logs/app.log
```

## Future Features

### Visual Programming Interface

The future interface will allow users to:

1. **Drag and Drop Connectors** - Visual representation of connector instances
2. **Wire Connections** - Visual lines between connectors
3. **Configure Pipelines** - Transform rules and filter conditions
4. **Monitor and Debug** - Real-time data flow and performance metrics

### Example Workflow

```
[Unifi Camera] → [Motion Detection] → [MQTT Broker] → [Database]
     ↓              ↓                    ↓              ↓
  Video Stream   Object Detection    Message Pub    Event Storage
```

## Support

For issues and questions:

1. Check the documentation in `docs/connectors/`
2. Review the test script `test-connectors.js`
3. Check the application logs
4. Create an issue in the project repository

## Contributing

To add new connectors:

1. Create the connector class extending `BaseConnector`
2. Implement required methods
3. Define capabilities
4. Add documentation
5. Create tests
6. Submit a pull request 