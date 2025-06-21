# UniFi Protect Connector

The UniFi Protect Connector provides comprehensive integration with Ubiquiti's UniFi Protect video management system. It supports camera management, real-time video streaming, motion detection, smart detection, doorbell rings, recording access, and automatic camera discovery with entity management.

## Features

- **Camera Management**: List, get, and update camera settings
- **Real-time Video Streaming**: Access live video streams via RTSP and HTTP
- **Motion Detection**: Subscribe to motion detection events with real-time notifications
- **Smart Detection**: Person, vehicle, and animal detection events with enhanced analytics
- **Doorbell Rings**: Real-time doorbell ring notifications
- **Recording Management**: List, download, and manage recordings
- **System Information**: Get system status, version, and configuration
- **User Management**: Manage system users and permissions
- **Automatic Camera Discovery**: Automatically discover and create entities for cameras
- **Real-time Events**: Subscribe to all camera events via WebSocket binary protocol
- **Entity Management**: Create and manage camera entities in the application
- **Session Management**: Automatic session handling and reconnection
- **Event Deduplication**: Prevents duplicate event processing
- **Bootstrap Caching**: Efficient device state management
- **Enhanced Smart Events Analytics**: Comprehensive smart detection analysis and pattern recognition

## Smart Detection Features

The connector provides advanced smart detection capabilities with comprehensive analytics:

### Supported Detection Types
- **Person Detection**: Human detection with confidence scoring
- **Vehicle Detection**: Car, truck, motorcycle detection with tracking
- **Animal Detection**: Pet and wildlife detection
- **Package Detection**: Package and object detection
- **Face Detection**: Facial recognition and detection
- **Generic Detection**: Other smart detection types

### Smart Detection Analytics
- **Confidence Scoring**: Track detection confidence levels
- **Pattern Recognition**: Identify unusual detection patterns
- **Cross-Zone Tracking**: Track objects moving between zones
- **Frequency Analysis**: Monitor detection frequency patterns
- **Historical Analysis**: Store and analyze detection history
- **Real-time Alerts**: Immediate notifications for smart events

### Smart Detection Context
Each smart detection event includes rich context data:
```json
{
  "objectType": "person",
  "confidence": 0.85,
  "zone": "zone-1",
  "location": { "x": 100, "y": 200 },
  "trackingId": "track-123",
  "boundingBox": { "x": 50, "y": 100, "width": 200, "height": 300 },
  "attributes": {
    "direction": "entering",
    "speed": "walking",
    "clothing": "dark"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Smart Detection API Endpoints

#### Get Smart Detection Analytics
```http
GET /api/analytics/smart-detections
GET /api/analytics/smart-detections?cameraId=camera-123
GET /api/analytics/smart-detections?objectType=person&limit=50
```

#### Get Camera-Specific Smart Analytics
```http
GET /api/analytics/smart-detections/{cameraId}
GET /api/analytics/smart-detections/{cameraId}?objectType=vehicle&timeRange=60
```

#### Get Smart Detection Patterns
```http
GET /api/analytics/smart-patterns
GET /api/analytics/smart-patterns?cameraId=camera-123&objectType=person
```

### Smart Detection Dashboard Integration

The dashboard provides comprehensive smart detection insights:

- **Real-time Smart Event Alerts**: Immediate notifications for smart detections
- **Smart Detection Summary**: Overview of all detection types and counts
- **Confidence Statistics**: Average, min, and max confidence levels
- **Pattern Analysis**: High-frequency and low-confidence pattern alerts
- **Cross-Zone Tracking**: Vehicle and person movement across zones
- **Historical Trends**: Smart detection patterns over time

### Smart Detection MQTT Topics

Smart detection events are automatically published to MQTT:

- `camera/events/smartDetected` - All smart detection events
- `camera/events/smartDetected/{objectType}` - Type-specific events
- `camera/events/smartDetected/{cameraId}` - Camera-specific events

Example MQTT payload:
```json
{
  "eventType": "smartDetected",
  "cameraId": "camera-123",
  "entityId": "camera-camera-123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "source": "unifi-protect-websocket",
  "connectorId": "van-unifi",
  "eventData": {
    "objectType": "person",
    "confidence": 0.85,
    "zone": "zone-1",
    "trackingId": "track-123",
    "attributes": {
      "direction": "entering"
    }
  },
  "metadata": {
    "rule": "camera-events-mqtt-rule",
    "processed": true
  }
}
```

## Authentication

The connector uses API key authentication with the `X-API-KEY` header for all requests. This is the standard authentication method for UniFi APIs.

**Important**: API keys may expire or become invalid. If you receive 401 Unauthorized errors, you may need to generate a new API key from the UniFi Network Controller.

### Authentication Methods

1. **API Key Only**: Simple authentication using just the API key
2. **Username/Password + API Key**: Full authentication with session management
3. **Bootstrap Authentication**: Advanced authentication flow for full Protect access

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

### Advanced Configuration with Full Features

```json
{
  "id": "unifi-protect",
  "type": "unifi-protect",
  "name": "UniFi Protect System",
  "description": "UniFi Protect video management system with full features",
  "config": {
    "host": "192.168.1.1",
    "port": 443,
    "protocol": "https",
    "apiKey": "your-api-key-here",
    "username": "your-username",
    "password": "your-password",
    "verifySSL": false,
    "autoDiscovery": {
      "enabled": true,
      "refreshInterval": 300000,
      "createEntities": true,
      "subscribeToEvents": true,
      "eventTypes": ["motion", "smart", "ring", "recording", "connection"]
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
| `username` | string | optional | Username for full authentication |
| `password` | string | optional | Password for full authentication |
| `verifySSL` | boolean | true | Whether to verify SSL certificates |
| `timeout` | number | 10000 | Request timeout in milliseconds |
| `rateLimit.requests` | number | 100 | Maximum requests per window |
| `rateLimit.window` | number | 60000 | Rate limit window in milliseconds |

## API Endpoints

The connector supports both UniFi Network Controller and UniFi Protect APIs:

### Network API (UniFi Network Controller)
- Base URL: `/proxy/network/integration/v1`
- Used for: Sites, devices, network information
- Status: ✅ Supported

### Protect API (UniFi Protect)
- Base URL: `/proxy/protect/v1`
- Used for: Cameras, recordings, motion events
- Status: ✅ Supported (when Protect is installed)

## Real-time Events

The connector supports real-time events via WebSocket using the correct endpoint and protocol based on community findings:

### WebSocket Connection Details

**Preferred Method:**
- WebSocket is the default and recommended way to receive real-time events from UniFi Protect.
- REST API polling is **only** used as a fallback if WebSocket is not available or fails to connect.
- If WebSocket is working, polling is disabled and not used.

**WebSocket Requirements:**
- **Port 80** (HTTP, not HTTPS)
- **Correct path**: `/proxy/protect/integration/v1/subscribe/events` (use "integration", not "integrations")
- **Protocol switching**: HTTP to WebSocket upgrade
- **API key authentication**: X-API-KEY header

**Working URL**: `ws://unifi:80/proxy/protect/integration/v1/subscribe/events`

### Event Types

- **Motion Events**: Real-time motion detection
- **Smart Detection**: Person, vehicle, animal detection
- **Doorbell Rings**: Doorbell ring notifications
- **Recording Events**: Recording status updates

### Fallback: REST API Polling
- Only enabled if WebSocket is not available or fails to connect.
- Not recommended for normal operation.

### Event Subscription

```javascript
// Subscribe to motion events
const motionSub = await connector.subscribeToMotionEvents({ 
  cameraId: 'camera-id' 
});

// Subscribe to smart detection
const smartSub = await connector.subscribeToSmartEvents({ 
  cameraId: 'camera-id',
  types: ['person', 'vehicle'] 
});

// Subscribe to doorbell rings
const ringSub = await connector.subscribeToRingEvents({ 
  cameraId: 'camera-id' 
});

// Subscribe to all real-time events
const realtimeSub = await connector.subscribeToRealtimeEvents({
  eventTypes: ['motion', 'smart', 'ring'],
  deviceIds: ['camera-id']
});
```

### Event Listening

```javascript
connector.on('event:motion', (event) => {
  console.log('Motion detected:', event.motionData);
});

connector.on('event:ring', (event) => {
  console.log('Doorbell ring:', event.ringData);
});

connector.on('event:smart', (event) => {
  console.log('Smart detection:', event.smartData);
});
```

## Video Streaming

The connector supports both RTSP and HTTP video streaming:

### RTSP Streaming

```javascript
const rtspUrl = await connector.getStreamUrl({
  cameraId: 'camera-id',
  quality: 'high',
  format: 'rtsp'
});
```

### HTTP Streaming

```javascript
const httpUrl = await connector.getStreamUrl({
  cameraId: 'camera-id',
  quality: 'medium',
  format: 'http',
  duration: 60
});
```

### Stream Sessions

```javascript
// Start a stream session
const session = await connector.startVideoStream({
  cameraId: 'camera-id',
  quality: 'high',
  format: 'http',
  duration: 30
});

// Stop a stream session
connector.stopVideoStream(session.id);

// Get active streams
const activeStreams = connector.getActiveStreams();
```

## Capabilities

### Camera Management

- **Operations**: `list`, `get`, `update`
- **Description**: Manage camera devices and their settings
- **Parameters**:
  - `cameraId` (string, optional): Specific camera ID
  - `siteId` (string, optional): Site ID

### Video Stream

- **Operations**: `read`, `start`, `stop`
- **Description**: Stream video from camera with RTSP and HTTP support
- **Parameters**:
  - `cameraId` (string, required): Camera ID
  - `quality` (string, optional): Stream quality (low/medium/high)
  - `format` (string, optional): Stream format (rtsp/http)
  - `duration` (number, optional): Stream duration in seconds

### Camera Snapshot

- **Operations**: `read`
- **Description**: Get still image from camera
- **Parameters**:
  - `cameraId` (string, required): Camera ID
  - `quality` (string, optional): Image quality (low/medium/high)

### Motion Detection Events

- **Operations**: `subscribe`, `unsubscribe`
- **Description**: Subscribe to motion detection events
- **Parameters**:
  - `cameraId` (string, required): Camera ID
  - `sensitivity` (number, optional): Motion sensitivity (0-100)

### Smart Detection Events

- **Operations**: `subscribe`, `unsubscribe`
- **Description**: Subscribe to smart detection events (person, vehicle, etc.)
- **Parameters**:
  - `cameraId` (string, required): Camera ID
  - `types` (array, optional): Detection types (person/vehicle/animal)

### Doorbell Ring Events

- **Operations**: `subscribe`, `unsubscribe`
- **Description**: Subscribe to doorbell ring events
- **Parameters**:
  - `cameraId` (string, required): Camera ID

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

### Real-time Events

- **Operations**: `subscribe`, `unsubscribe`
- **Description**: Subscribe to all real-time events from UniFi Protect
- **Parameters**:
  - `eventTypes` (array, optional): Event types to subscribe to
  - `deviceIds` (array, optional): Device IDs to monitor

## WebSocket Protocol

The connector implements WebSocket connections with proper HTTP to WebSocket protocol switching:

### Connection Process

1. **HTTP Handshake**: Initial HTTP request with WebSocket upgrade headers
2. **Protocol Switching**: Server responds with 101 Switching Protocols
3. **WebSocket Connection**: Full-duplex communication established
4. **Event Subscription**: JSON messages sent to subscribe to events
5. **Event Reception**: Real-time events received as JSON or binary data

### Headers Used

```javascript
{
  'X-API-KEY': 'your-api-key',
  'Upgrade': 'websocket',
  'Connection': 'Upgrade',
  'Sec-WebSocket-Version': '13',
  'Sec-WebSocket-Key': 'base64-encoded-key'
}
```

### Message Format

The connector handles both JSON and binary message formats:

**JSON Messages** (for subscriptions):
```javascript
{
  "action": "subscribe",
  "newUpdateId": "motion"
}
```

**Binary Messages** (for events):
- Header Frame (8 bytes) - Packet type, payload format, compression info
- Action Frame - Action type, device ID, model key  
- Data Frame - Actual payload data

### Automatic Reconnection

- Exponential backoff reconnection strategy
- Automatic session token refresh
- Event deduplication to prevent duplicates
- Graceful handling of connection failures
- Proper handling of HTTP redirects (302) and protocol switches (101)

## Troubleshooting

### 401 Unauthorized Errors
1. Check if the API key is valid and not expired
2. Verify the API key format (should be a string like `6pXhUX2-hnWonI8abmazH4kGRdVLp4r8`)
3. Ensure you're using the correct header: `X-API-KEY`
4. Try generating a new API key from the UniFi Network Controller

### Protect API Not Available
If Protect API endpoints return 401 or 404:
1. Verify UniFi Protect is installed on the system
2. Check if Protect requires separate authentication
3. The system may only have UniFi Network Controller without Protect
4. The connector will fall back to Network API functionality

### WebSocket Connection Issues
1. **Port 80 Required**: WebSocket only works on port 80 (HTTP), not port 443 (HTTPS)
2. **Correct Path**: Use `/proxy/protect/integration/v1/subscribe/events` (not "integrations")
3. **Protocol Switching**: Ensure proper HTTP to WebSocket upgrade headers
4. **API Key**: Verify the API key is valid and sent in X-API-KEY header
5. **SSL Verification**: Disable SSL verification for self-signed certificates
6. **Firewall**: Ensure port 80 is accessible for WebSocket connections
7. **Redirects**: The connector handles HTTP 302 redirects automatically
8. **Fallback**: The connector will fall back to REST API polling if WebSocket fails

### Testing WebSocket Connection

Use the provided test script to verify WebSocket connectivity:

```bash
node test-unifi-protect-websocket.js
```

This will test all known endpoints and provide detailed debugging information.

### Video Streaming Issues
1. Verify camera is online and accessible
2. Check network connectivity to camera
3. Ensure proper authentication credentials
4. Try different quality settings (low/medium/high)

### Real-time Events Not Working
1. Check WebSocket connection status
2. Verify event subscriptions are active
3. Ensure cameras are configured for motion/smart detection
4. Check firewall settings for WebSocket connections

## Examples

### Basic Usage

```javascript
const connector = new UnifiProtectConnector(config);

// Connect and authenticate
await connector.connect();

// List cameras
const cameras = await connector.listCameras();

// Subscribe to motion events
connector.on('event:motion', (event) => {
  console.log('Motion detected:', event.motionData);
});

// Get video stream
const streamUrl = await connector.getStreamUrl({
  cameraId: cameras[0].id,
  quality: 'high',
  format: 'rtsp'
});
```

### Advanced Usage

```javascript
// Subscribe to multiple event types
await connector.subscribeToRealtimeEvents({
  eventTypes: ['motion', 'smart', 'ring'],
  deviceIds: ['camera-1', 'camera-2']
});

// Start video stream session
const session = await connector.startVideoStream({
  cameraId: 'camera-id',
  quality: 'high',
  format: 'http',
  duration: 60
});

// Get camera snapshot
const snapshot = await connector.getCameraSnapshot({
  cameraId: 'camera-id',
  quality: 'high'
});
```

## References

- [hjdhjd/unifi-protect](https://github.com/hjdhjd/unifi-protect) - Complete UniFi Protect API implementation
- [Protect Updates API Documentation](https://github.com/hjdhjd/unifi-protect/blob/main/README.md) - Binary protocol details
- [UniFi Protect API Reference](https://github.com/hjdhjd/unifi-protect/blob/main/src/protect-types.ts) - Type definitions