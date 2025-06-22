# UniFi Protect API Documentation

## System Information
- **Host**: 10.0.0.1 (Communications Van)
- **API Key**: `wye3aapIuxAz2omKg4WFdCSncRBfSzPx`
- **Protocol**: HTTPS (port 443)
- **SSL Verification**: Disabled (self-signed certificate)

## Authentication

The UniFi Protect API uses API key authentication with the `X-API-KEY` header. The API key should be included in all requests.

**Headers Required:**
```
X-API-KEY: wye3aapIuxAz2omKg4WFdCSncRBfSzPx
Accept: application/json
Content-Type: application/json
```

## Base URL

**Important**: The correct base path for the new UniFi Protect API is:
```
https://10.0.0.1/proxy/protect/integration/v1/
```



## Available Endpoints

### 1. Application Information
- **GET** `/proxy/protect/integration/v1/meta/info`
  - Returns application version information
  - Response: `{"applicationVersion": "6.0.45"}`

### 2. Camera Management
- **GET** `/proxy/protect/integration/v1/cameras`
  - Returns list of all cameras
  - Response: Array of camera objects

- **GET** `/proxy/protect/integration/v1/cameras/{id}`
  - Returns specific camera details
  - Parameters: `id` (camera ID)

- **PATCH** `/proxy/protect/integration/v1/cameras/{id}`
  - Update camera settings
  - Parameters: `id` (camera ID)
  - Body: Camera settings object

### 3. Camera Streams
- **POST** `/proxy/protect/integration/v1/cameras/{id}/rtsps-stream`
  - Create RTSPS stream URLs
  - Parameters: `id` (camera ID)
  - Body: `{"qualities": ["high", "medium", "low", "package"]}`

- **GET** `/proxy/protect/integration/v1/cameras/{id}/rtsps-stream`
  - Get existing RTSPS stream URLs
  - Parameters: `id` (camera ID)

- **DELETE** `/proxy/protect/integration/v1/cameras/{id}/rtsps-stream`
  - Remove RTSPS streams
  - Parameters: `id` (camera ID), `qualities` (query parameter)

### 4. Camera Snapshots
- **GET** `/proxy/protect/integration/v1/cameras/{id}/snapshot`
  - Get camera snapshot image
  - Parameters: `id` (camera ID)
  - Query: `highQuality` (true/false, default: false)

### 5. Camera PTZ Control
- **POST** `/proxy/protect/integration/v1/cameras/{id}/ptz/patrol/start/{slot}`
  - Start PTZ patrol
  - Parameters: `id` (camera ID), `slot` (0-4)

- **POST** `/proxy/protect/integration/v1/cameras/{id}/ptz/patrol/stop`
  - Stop PTZ patrol
  - Parameters: `id` (camera ID)

- **POST** `/proxy/protect/integration/v1/cameras/{id}/ptz/goto/{slot}`
  - Move to PTZ preset
  - Parameters: `id` (camera ID), `slot` (preset number)

### 6. Camera Talkback
- **POST** `/proxy/protect/integration/v1/cameras/{id}/talkback-session`
  - Create talkback session
  - Parameters: `id` (camera ID)

### 7. Camera Microphone
- **POST** `/proxy/protect/integration/v1/cameras/{id}/disable-mic-permanently`
  - Permanently disable microphone
  - Parameters: `id` (camera ID)

### 8. Lights
- **GET** `/proxy/protect/integration/v1/lights`
  - Get all lights

- **GET** `/proxy/protect/integration/v1/lights/{id}`
  - Get specific light details
  - Parameters: `id` (light ID)

- **PATCH** `/proxy/protect/integration/v1/lights/{id}`
  - Update light settings
  - Parameters: `id` (light ID)

### 9. Sensors
- **GET** `/proxy/protect/integration/v1/sensors`
  - Get all sensors

- **GET** `/proxy/protect/integration/v1/sensors/{id}`
  - Get specific sensor details
  - Parameters: `id` (sensor ID)

- **PATCH** `/proxy/protect/integration/v1/sensors/{id}`
  - Update sensor settings
  - Parameters: `id` (sensor ID)

### 10. NVR Information
- **GET** `/proxy/protect/integration/v1/nvrs`
  - Get NVR details

### 11. Viewers
- **GET** `/proxy/protect/integration/v1/viewers`
  - Get all viewers

- **GET** `/proxy/protect/integration/v1/viewers/{id}`
  - Get specific viewer details
  - Parameters: `id` (viewer ID)

- **PATCH** `/proxy/protect/integration/v1/viewers/{id}`
  - Update viewer settings
  - Parameters: `id` (viewer ID)

### 12. Live Views
- **GET** `/proxy/protect/integration/v1/liveviews`
  - Get all live views

- **GET** `/proxy/protect/integration/v1/liveviews/{id}`
  - Get specific live view details
  - Parameters: `id` (live view ID)

- **PATCH** `/proxy/protect/integration/v1/liveviews/{id}`
  - Update live view configuration
  - Parameters: `id` (live view ID)

- **POST** `/proxy/protect/integration/v1/liveviews`
  - Create new live view

### 13. Chimes
- **GET** `/proxy/protect/integration/v1/chimes`
  - Get all chimes

- **GET** `/proxy/protect/integration/v1/chimes/{id}`
  - Get specific chime details
  - Parameters: `id` (chime ID)

- **PATCH** `/proxy/protect/integration/v1/chimes/{id}`
  - Update chime settings
  - Parameters: `id` (chime ID)

### 14. Alarm Manager
- **POST** `/proxy/protect/integration/v1/alarm-manager/webhook/{id}`
  - Send webhook to alarm manager
  - Parameters: `id` (alarm trigger ID)

### 15. Device Asset Files
- **GET** `/proxy/protect/integration/v1/files/{fileType}`
  - Get device asset files
  - Parameters: `fileType` (e.g., "animations")

- **POST** `/proxy/protect/integration/v1/files/{fileType}`
  - Upload device asset file
  - Parameters: `fileType` (e.g., "animations")
  - Body: multipart/form-data

## WebSocket Endpoints

### Real-time Updates
**Note**: WebSocket endpoints may require different authentication than REST API endpoints.

The following WebSocket endpoints are documented:
- **WebSocket** `/proxy/protect/v1/subscribe/devices`
  - Subscribe to device changes
  - Returns 302 redirect when accessed via HTTP (expected for WebSocket)

- **WebSocket** `/proxy/protect/v1/subscribe/events`
  - Subscribe to Protect events
  - Returns 302 redirect when accessed via HTTP (expected for WebSocket)

**Testing**: These endpoints return 302 redirects when accessed via HTTP, which is expected behavior for WebSocket endpoints. They should work when accessed via WebSocket protocol (wss://).

## Event Handling

**WebSocket Events**: The API documentation shows that real-time events are available via WebSocket subscriptions.

**Event Types**: Based on the documentation, events include:
- Motion events
- Smart detection events  
- Ring events (doorbells)
- Recording events
- Connection events

**Note**: WebSocket connections may require session-based authentication rather than API key authentication.

## Testing Examples

### Test Connection
```bash
curl -k -H "X-API-KEY: wye3aapIuxAz2omKg4WFdCSncRBfSzPx" \
     -H "Accept: application/json" \
     https://10.0.0.1/proxy/protect/integration/v1/meta/info
```

### Get Cameras
```bash
curl -k -H "X-API-KEY: wye3aapIuxAz2omKg4WFdCSncRBfSzPx" \
     -H "Accept: application/json" \
     https://10.0.0.1/proxy/protect/integration/v1/cameras
```

### Get Camera Snapshot
```bash
curl -k -H "X-API-KEY: wye3aapIuxAz2omKg4WFdCSncRBfSzPx" \
     -H "Accept: image/jpeg" \
     https://10.0.0.1/proxy/protect/integration/v1/cameras/{cameraId}/snapshot
```

## Notes

1. **Events Endpoint**: The `/events` endpoint appears to be unavailable in the current API version (404 error). Real-time events may only be available via WebSocket subscriptions.

2. **SSL Certificate**: The system uses a self-signed certificate, so SSL verification should be disabled in client applications.

3. **Rate Limiting**: The API includes rate limiting headers. Respect the rate limits to avoid being blocked.

4. **API Version**: This documentation is based on UniFi Protect API version 6.0.45.

## Error Responses

Common error responses:
- **404**: Endpoint not found
- **401**: Unauthorized (invalid API key)
- **500**: Internal server error

Error response format:
```json
{
  "error": "Error message",
  "name": "ERROR_TYPE",
  "entity": "entity_type",
  "id": "entity_id"
}
``` 