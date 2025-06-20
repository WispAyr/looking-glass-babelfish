# UniFi Protect Connector

The UniFi Protect Connector provides integration with Ubiquiti's UniFi Protect video management system. It supports camera management, video streaming, motion detection, recording access, and automatic camera discovery with entity management.

## Features

- **Camera Management**: List, get, and update camera settings
- **Video Streaming**: Access live video streams from cameras
- **Motion Detection**: Subscribe to motion detection events
- **Recording Management**: List, download, and manage recordings
- **System Information**: Get system status and configuration
- **User Management**: Manage system users and permissions
- **Automatic Camera Discovery**: Automatically discover and create entities for cameras
- **Event Subscription**: Subscribe to camera events (motion, smart detection, recording, connection)
- **Entity Management**: Create and manage camera entities in the application

## Configuration

### Basic Configuration

```json
{
  "id": "unifi-protect",
  "type": "unifi-protect",
  "name": "UniFi Protect System",
  "description": "UniFi Protect video management system",
  "config": {
    "host": "192.168.1.1",
    "port": 443,
    "protocol": "https",
    "apiKey": "your-api-key-here",
    "verifySSL": false
  }
}
```

### Advanced Configuration with Auto-Discovery

```json
{
  "id": "unifi-protect",
  "type": "unifi-protect",
  "name": "UniFi Protect System",
  "description": "UniFi Protect video management system with auto-discovery",
  "config": {
    "host": "192.168.1.1",
    "port": 443,
    "protocol": "https",
    "apiKey": "your-api-key-here",
    "verifySSL": false,
    "autoDiscovery": {
      "enabled": true,
      "refreshInterval": 300000,
      "createEntities": true,
      "subscribeToEvents": true,
      "eventTypes": ["motion", "smart", "recording", "connection"]
    },
    "entities": {
      "enabled": true,
      "autoCreate": true,
      "autoUpdate": true,
      "metadata": {
        "source": "unifi-protect",
        "connectorId": "unifi-protect"
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | required | UniFi Protect host IP address |
| `port` | number | 443 | UniFi Protect port |
| `protocol` | string | "https" | Protocol (http/https) |
| `apiKey` | string | required | UniFi Protect API key |
| `verifySSL` | boolean | true | Whether to verify SSL certificates |
| `timeout` | number | 10000 | Request timeout in milliseconds |
| `rateLimit.requests` | number | 100 | Maximum requests per window |
| `rateLimit.window` | number | 60000 | Rate limit window in milliseconds |

### Auto-Discovery Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoDiscovery.enabled` | boolean | false | Enable automatic camera discovery |
| `autoDiscovery.refreshInterval` | number | 300000 | Discovery refresh interval (5 minutes) |
| `autoDiscovery.createEntities` | boolean | false | Create entities for discovered cameras |
| `autoDiscovery.subscribeToEvents` | boolean | false | Subscribe to events for discovered cameras |
| `autoDiscovery.eventTypes` | array | ["motion", "smart", "recording", "connection"] | Event types to subscribe to |

## Capabilities

### Camera Management

- **Operations**: `list`, `get`, `update`
- **Description**: Manage camera devices and their settings
- **Parameters**:
  - `cameraId` (string, optional): Specific camera ID
  - `siteId` (string, optional): Site ID

### Video Stream

- **Operations**: `read`
- **Description**: Stream video from camera
- **Parameters**:
  - `cameraId` (string, required): Camera ID
  - `quality` (string, optional): Stream quality (low/medium/high)
  - `format` (string, optional): Stream format (rtsp/mp4)

### Motion Detection Events

- **Operations**: `subscribe`, `unsubscribe`
- **Description**: Subscribe to motion detection events
- **Parameters**:
  - `cameraId` (string, required): Camera ID
  - `sensitivity` (number, optional): Motion sensitivity (0-100)
  - `area` (object, optional): Motion detection area

### Recording Management

- **Operations**: `list`, `get`, `download`, `delete`
- **Description**: Manage camera recordings
- **Parameters**:
  - `cameraId` (string, optional): Camera ID
  - `startTime` (string, optional): Start time for recordings
  - `endTime` (string, optional): End time for recordings
  - `type` (string, optional): Recording type (motion/continuous/timelapse)

### System Information

- **Operations**: `read`
- **Description**: Get system status, version, and configuration

### User Management

- **Operations**: `list`, `get`, `create`, `update`, `delete`
- **Description**: Manage system users and permissions
- **Parameters**:
  - `userId` (string, optional): User ID
  - `userData` (object, optional): User data for create/update

## Automatic Camera Discovery

The connector can automatically discover cameras and create entities for them in the application. This feature includes:

### Discovery Process

1. **Initial Discovery**: When the connector connects, it automatically discovers all cameras
2. **Entity Creation**: Creates entities for each discovered camera with metadata
3. **Event Subscription**: Subscribes to events for each camera based on configuration
4. **Periodic Refresh**: Refreshes the camera list at configured intervals

### Entity Structure

Each camera entity includes:

```json
{
  "id": "camera-{cameraId}",
  "type": "camera",
  "name": "Camera Name",
  "description": "Camera Description",
  "status": "connected",
  "data": {
    "capabilities": {
      "motion": true,
      "recording": true,
      "smart": true,
      "audio": true,
      "speaker": true,
      "lcd": false,
      "sdCard": true
    },
    "settings": {
      "recording": {},
      "motion": {},
      "smart": {}
    }
  },
  "metadata": {
    "source": "unifi-protect",
    "connectorId": "unifi-protect",
    "cameraId": "original-camera-id",
    "model": "UVC-G3-Flex",
    "firmware": "4.42.18",
    "mac": "00:11:22:33:44:55",
    "ip": "192.168.1.100"
  }
}
```

### Event Types

The connector can subscribe to and process the following event types:

#### Motion Events
- **Trigger**: Motion detected on camera
- **Data**: Motion state, score, detection zone
- **Entity Updates**: Updates camera entity with last motion event

#### Smart Detection Events
- **Trigger**: Smart detection (person, vehicle, etc.) detected
- **Data**: Detection type, score, object information
- **Entity Updates**: Updates camera entity with last smart event

#### Recording Events
- **Trigger**: Recording started, stopped, or completed
- **Data**: Recording type, status, duration
- **Entity Updates**: Updates camera entity with last recording event

#### Connection Events
- **Trigger**: Camera connection status changes
- **Data**: Connection state, IP address, MAC address
- **Entity Updates**: Updates camera entity status and connection info

## API Endpoints

### Entity Management

- `GET /api/entities` - List all entities
- `GET /api/entities/:id` - Get specific entity
- `POST /api/entities` - Create new entity
- `PUT /api/entities/:id` - Update entity
- `DELETE /api/entities/:id` - Delete entity
- `GET /api/entities/stats` - Get entity statistics
- `POST /api/entities/discovery` - Trigger manual discovery
- `POST /api/entities/discovery/start` - Start auto-discovery
- `POST /api/entities/discovery/stop` - Stop auto-discovery

### Query Parameters

- `type` - Filter by entity type
- `source` - Filter by source
- `connectorId` - Filter by connector ID
- `status` - Filter by status
- `limit` - Limit number of results

## WebSocket Events

The connector emits the following WebSocket events:

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
- `discoveryCompleted` - Camera discovery completed
- `discoveryError` - Camera discovery error

## Usage Examples

### Basic Camera Operations

```javascript
// List all cameras
const cameras = await connector.execute('camera:management', 'list');

// Get specific camera
const camera = await connector.execute('camera:management', 'get', {
  cameraId: 'camera-id'
});

// Subscribe to motion events
await connector.execute('camera:event:motion', 'subscribe', {
  cameraId: 'camera-id'
});
```

### Entity Management

```javascript
// Get all camera entities
const response = await fetch('/api/entities?type=camera');
const entities = await response.json();

// Get specific camera entity
const response = await fetch('/api/entities/camera-camera-id');
const entity = await response.json();

// Trigger manual discovery
await fetch('/api/entities/discovery', { method: 'POST' });
```

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check host, port, and API key
2. **SSL Errors**: Set `verifySSL: false` for self-signed certificates
3. **Rate Limiting**: Adjust rate limit settings if needed
4. **WebSocket Issues**: WebSocket connection is optional, REST API polling is used as backup

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
connector.setDebugMode(true);
```

### Health Check

Check connector status:

```javascript
const status = connector.getStatus();
console.log(status);
```

## Security Considerations

- Store API keys securely
- Use HTTPS when possible
- Implement proper access controls
- Monitor API usage and rate limits
- Regularly rotate API keys