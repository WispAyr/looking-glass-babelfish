# Babelfish Looking Glass

A comprehensive IoT and device management platform with advanced connector architecture, event processing, and automated entity discovery.

## Features

- **Connector Architecture**: Modular connector system for integrating with various IoT devices and services
- **Event Processing**: Real-time event processing with rule engine and action framework
- **Entity Management**: Automatic discovery and management of devices and resources
- **WebSocket Support**: Real-time communication and event broadcasting
- **MQTT Integration**: Message queuing and device communication
- **UniFi Protect Integration**: Camera management, video streaming, and motion detection
- **Auto-Discovery**: Automatic device discovery and entity creation
- **REST API**: Comprehensive API for system management and integration

## Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn
- UniFi Protect system (optional)
- MQTT broker (optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bablefish-lookingglass

# Install dependencies
npm install

# Copy environment configuration
cp env.example .env

# Edit configuration
nano .env
```

### Configuration

Edit the `.env` file with your settings:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# UniFi Protect Configuration
UNIFI_HOST=192.168.1.1
UNIFI_PORT=443
UNIFI_API_KEY=your-api-key-here
UNIFI_VERIFY_SSL=false

# MQTT Configuration
MQTT_ENABLED=true
MQTT_HOST=localhost
MQTT_PORT=1883

# Entity Management
ENTITIES_ENABLED=true
ENTITY_AUTO_DISCOVERY_ENABLED=true
ENTITY_DISCOVERY_REFRESH_INTERVAL=300000
```

### Running the Application

```bash
# Start the server
npm start

# Or run in development mode
npm run dev
```

The application will be available at `http://localhost:3000`

## Architecture

### Core Components

#### Connector System
- **BaseConnector**: Abstract base class for all connectors
- **ConnectorRegistry**: Manages connector instances and capabilities
- **UniFi Protect Connector**: Integration with UniFi Protect systems
- **MQTT Connector**: Message queuing and device communication

#### Entity Management
- **EntityManager**: Manages devices and resources as entities
- **Auto-Discovery**: Automatic device discovery and entity creation
- **Entity Events**: Real-time entity lifecycle events

#### Event Processing
- **EventBus**: Central event routing and normalization
- **RuleEngine**: Configurable rule processing and action execution
- **ActionFramework**: Extensible action system
- **FlowOrchestrator**: Coordinates event flows and rule execution

#### Services
- **Cache**: In-memory caching system
- **MQTTBroker**: MQTT message broker
- **EventProcessor**: Event filtering and processing

### Entity Management System

The platform includes a comprehensive entity management system that automatically discovers and manages devices and resources:

#### Features
- **Automatic Discovery**: Automatically discover devices from connected systems
- **Entity Creation**: Create entities for discovered devices with metadata
- **Event Integration**: Subscribe to device events and update entities
- **Lifecycle Management**: Handle entity creation, updates, and deletion
- **Real-time Updates**: WebSocket events for entity changes

#### Entity Types
- **Cameras**: UniFi Protect cameras with motion detection and recording
- **Devices**: IoT devices and sensors
- **Services**: External services and APIs
- **Resources**: System resources and configurations

#### Auto-Discovery
- **Periodic Discovery**: Regular discovery of new devices
- **Event-Driven Discovery**: Discovery triggered by system events
- **Manual Discovery**: On-demand discovery via API
- **Configuration-Based**: Discovery rules based on connector configuration

## API Reference

### Entity Management

#### Get All Entities
```http
GET /api/entities
```

Query Parameters:
- `type` - Filter by entity type
- `source` - Filter by source
- `connectorId` - Filter by connector ID
- `status` - Filter by status
- `limit` - Limit number of results

#### Get Entity by ID
```http
GET /api/entities/{id}
```

#### Create Entity
```http
POST /api/entities
Content-Type: application/json

{
  "type": "camera",
  "name": "Front Door Camera",
  "description": "Camera monitoring front door",
  "data": {
    "capabilities": ["motion", "recording"],
    "settings": {}
  },
  "metadata": {
    "source": "unifi-protect",
    "connectorId": "unifi-protect"
  }
}
```

#### Update Entity
```http
PUT /api/entities/{id}
Content-Type: application/json

{
  "status": "connected",
  "data": {
    "lastEvent": "2024-01-15T10:30:00Z"
  }
}
```

#### Delete Entity
```http
DELETE /api/entities/{id}
```

#### Entity Statistics
```http
GET /api/entities/stats
```

#### Discovery Management
```http
POST /api/entities/discovery
POST /api/entities/discovery/start
POST /api/entities/discovery/stop
```

### Connector Management

#### Get All Connectors
```http
GET /api/connectors
```

#### Get Connector by ID
```http
GET /api/connectors/{id}
```

#### Create Connector
```http
POST /api/connectors
Content-Type: application/json

{
  "id": "unifi-protect",
  "type": "unifi-protect",
  "name": "UniFi Protect System",
  "config": {
    "host": "192.168.1.1",
    "apiKey": "your-api-key"
  }
}
```

### Event Management

#### Get Events
```http
GET /api/events
```

#### Get Event Filters
```http
GET /api/events/filters
```

## WebSocket Events

The application provides real-time WebSocket events for monitoring system state:

### Entity Events
- `entityCreated` - New entity created
- `entityUpdated` - Entity updated
- `entityDeleted` - Entity deleted

### Camera Events
- `motionDetected` - Motion detected on camera
- `smartDetected` - Smart detection on camera
- `recordingEvent` - Recording event on camera
- `connectionEvent` - Connection event on camera
- `cameraAdded` - New camera added
- `cameraRemoved` - Camera removed

### Discovery Events
- `discoveryCompleted` - Device discovery completed
- `discoveryError` - Discovery error occurred

### Connector Events
- `connectorEvent` - General connector event
- `connectorWebSocketConnected` - Connector WebSocket connected
- `connectorWebSocketDisconnected` - Connector WebSocket disconnected
- `connectorWebSocketError` - Connector WebSocket error

## Configuration

### Connector Configuration

Connectors are configured in `config/connectors.json`:

```json
{
  "connectors": [
    {
      "id": "unifi-protect",
      "type": "unifi-protect",
      "name": "UniFi Protect System",
      "config": {
        "host": "192.168.1.1",
        "apiKey": "your-api-key",
        "autoDiscovery": {
          "enabled": true,
          "createEntities": true,
          "subscribeToEvents": true
        }
      }
    }
  ]
}
```

### Environment Variables

Key environment variables:

```bash
# Server
PORT=3000
NODE_ENV=development

# UniFi Protect
UNIFI_HOST=192.168.1.1
UNIFI_API_KEY=your-api-key

# MQTT
MQTT_ENABLED=true
MQTT_HOST=localhost

# Entity Management
ENTITIES_ENABLED=true
ENTITY_AUTO_DISCOVERY_ENABLED=true
```

## Development

### Project Structure

```
bablefish-lookingglass/
├── config/                 # Configuration files
├── connectors/            # Connector implementations
├── docs/                  # Documentation
├── routes/                # API routes
├── services/              # Core services
├── logs/                  # Application logs
├── server.js             # Main application entry
└── package.json          # Dependencies and scripts
```

### Adding New Connectors

1. Create connector class extending `BaseConnector`
2. Implement required methods
3. Register connector type in `ConnectorRegistry`
4. Add configuration to `config/connectors.json`

### Adding New Entity Types

1. Define entity structure in `EntityManager`
2. Implement entity creation logic
3. Add event handling for entity lifecycle
4. Update API endpoints if needed

## Troubleshooting

### Common Issues

1. **Connection Errors**: Check network connectivity and credentials
2. **Entity Discovery**: Verify auto-discovery is enabled in connector config
3. **WebSocket Issues**: Check firewall settings and WebSocket support
4. **API Errors**: Verify API endpoints and authentication

### Debug Mode

Enable debug logging:

```bash
# Set environment variable
DEBUG=true npm start

# Or enable in code
connector.setDebugMode(true);
```

### Health Check

Check system health:

```bash
curl http://localhost:3000/health
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## License

[License information]

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation in `/docs`
- Review configuration examples 