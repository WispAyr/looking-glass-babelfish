# ANKKE DVR Connector

## Overview

The ANKKE DVR Connector provides integration with ANKKE DVR systems for camera management, video streaming, motion detection, and recording management. It supports HTTP API and RTSP streaming protocols.

## Features

- **Camera Management**: Enable/disable cameras, take snapshots, get camera information
- **Video Streaming**: Start/stop streams, get stream URLs, manage active streams
- **Recording Management**: Start/stop recordings, list recordings, download/delete recordings
- **Motion Detection**: Enable/disable motion detection, configure sensitivity
- **PTZ Control**: Pan, tilt, zoom control with preset management
- **Event Management**: Subscribe to events, manage notifications
- **System Management**: Get device information, system configuration

## Configuration

```json
{
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

### Configuration Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `host` | string | Yes | - | ANKKE DVR IP address |
| `port` | number | No | 80 | ANKKE DVR port |
| `protocol` | string | No | "http" | Connection protocol (http/https) |
| `username` | string | Yes | - | DVR username |
| `password` | string | Yes | - | DVR password |
| `timeout` | number | No | 10000 | Request timeout in milliseconds |
| `maxReconnectAttempts` | number | No | 5 | Maximum reconnection attempts |
| `reconnectInterval` | number | No | 30000 | Reconnection interval in milliseconds |

## Capabilities

### Camera Management (`ankke:camera`)

#### Operations

- **list**: List all cameras with optional filtering
- **info**: Get detailed camera information
- **enable**: Enable a camera
- **disable**: Disable a camera
- **snapshot**: Take a snapshot from a camera

#### Example Usage

```javascript
// List all cameras
await connector.executeCapability('ankke:camera', 'list');

// Get camera info
await connector.executeCapability('ankke:camera', 'info', { channel: 1 });

// Take snapshot
await connector.executeCapability('ankke:camera', 'snapshot', { 
  channel: 1, 
  quality: 'high' 
});
```

### Video Streaming (`ankke:stream`)

#### Operations

- **start**: Start a video stream
- **stop**: Stop a video stream
- **list**: List active streams
- **url**: Get stream URL

#### Example Usage

```javascript
// Start stream
const stream = await connector.executeCapability('ankke:stream', 'start', {
  channel: 1,
  type: 'main',
  format: 'h264'
});

// Get stream URL
const url = await connector.executeCapability('ankke:stream', 'url', {
  channel: 1,
  type: 'main',
  format: 'h264'
});
```

### Recording Management (`ankke:recording`)

#### Operations

- **start**: Start recording
- **stop**: Stop recording
- **list**: List recordings
- **download**: Download recording
- **delete**: Delete recording

#### Example Usage

```javascript
// Start recording
await connector.executeCapability('ankke:recording', 'start', {
  channel: 1,
  type: 'manual'
});

// List recordings
const recordings = await connector.executeCapability('ankke:recording', 'list', {
  channel: 1,
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-01-02T00:00:00Z'
});
```

### Motion Detection (`ankke:motion`)

#### Operations

- **enable**: Enable motion detection
- **disable**: Disable motion detection
- **configure**: Configure motion detection settings
- **status**: Get motion detection status

#### Example Usage

```javascript
// Enable motion detection
await connector.executeCapability('ankke:motion', 'enable', {
  channel: 1,
  sensitivity: 50
});

// Get motion status
const status = await connector.executeCapability('ankke:motion', 'status', {
  channel: 1
});
```

### PTZ Control (`ankke:ptz`)

#### Operations

- **move**: Move PTZ camera
- **stop**: Stop PTZ movement
- **preset**: Set PTZ preset
- **zoom**: Control zoom

#### Example Usage

```javascript
// Move PTZ
await connector.executeCapability('ankke:ptz', 'move', {
  channel: 1,
  direction: 'up',
  speed: 50
});

// Stop PTZ
await connector.executeCapability('ankke:ptz', 'stop', {
  channel: 1
});
```

### Event Management (`ankke:event`)

#### Operations

- **list**: List events
- **subscribe**: Subscribe to events
- **unsubscribe**: Unsubscribe from events

### System Management (`ankke:system`)

#### Operations

- **info**: Get system information
- **reboot**: Reboot system
- **config**: Get system configuration

## API Endpoints

The connector uses the following ANKKE DVR API endpoints:

- `/cgi-bin/guest/Login.cgi` - Authentication
- `/cgi-bin/guest/DeviceInfo.cgi` - Device information
- `/cgi-bin/guest/CameraList.cgi` - Camera discovery
- `/cgi-bin/guest/ChannelList.cgi` - Channel discovery
- `/cgi-bin/guest/Stream.cgi` - Video streaming
- `/cgi-bin/guest/Snapshot.cgi` - Snapshots
- `/cgi-bin/guest/Recording.cgi` - Recording management
- `/cgi-bin/guest/Motion.cgi` - Motion detection
- `/cgi-bin/guest/PTZ.cgi` - PTZ control
- `/cgi-bin/guest/Event.cgi` - Event management

## Error Handling

The connector includes comprehensive error handling for:

- Authentication failures
- Network connectivity issues
- Invalid parameters
- Device-specific errors
- Timeout handling

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify username and password
   - Check if the DVR supports the authentication method
   - Ensure the user has appropriate permissions

2. **Connection Timeout**
   - Verify the DVR IP address and port
   - Check network connectivity
   - Increase timeout value if needed

3. **Camera Not Found**
   - Verify channel numbers
   - Check if cameras are properly connected
   - Ensure cameras are enabled in DVR settings

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
// Set log level to debug
connector.setLogLevel('debug');
```

## Security Considerations

- Use HTTPS when possible for secure communication
- Store credentials securely
- Implement proper access controls
- Regularly update firmware and credentials

## Limitations

- Maximum 16 concurrent streams
- Limited to ANKKE DVR API capabilities
- Some features may require specific DVR models
- RTSP streaming may require additional configuration 