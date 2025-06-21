# Hikvision Connector

## Overview

The Hikvision Connector provides integration with Hikvision IP cameras, DVRs, and NVRs. It supports ISAPI REST API, RTSP streaming, and event management. Compatible with Hikvision cameras, DVRs, NVRs, and access control devices.

## Features

- **Camera Management**: Enable/disable cameras, take snapshots, get camera information
- **Video Streaming**: Start/stop streams, get stream URLs, manage active streams
- **Recording Management**: Start/stop recordings, list recordings, download/delete recordings
- **Motion Detection**: Enable/disable motion detection, configure sensitivity and areas
- **PTZ Control**: Pan, tilt, zoom control with preset management
- **Event Management**: Subscribe to events, manage notifications and triggers
- **System Management**: Get device information, system configuration, network settings

## Configuration

```json
{
  "type": "hikvision",
  "name": "Hikvision System",
  "config": {
    "host": "192.168.1.100",
    "port": 80,
    "protocol": "http",
    "username": "admin",
    "password": "password",
    "timeout": 15000,
    "maxReconnectAttempts": 5,
    "reconnectInterval": 30000
  }
}
```

### Configuration Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `host` | string | Yes | - | Hikvision device IP address |
| `port` | number | No | 80 | Hikvision device port |
| `protocol` | string | No | "http" | Connection protocol (http/https) |
| `username` | string | Yes | - | Device username |
| `password` | string | Yes | - | Device password |
| `timeout` | number | No | 15000 | Request timeout in milliseconds |
| `maxReconnectAttempts` | number | No | 5 | Maximum reconnection attempts |
| `reconnectInterval` | number | No | 30000 | Reconnection interval in milliseconds |

## Capabilities

### Camera Management (`hikvision:camera`)

#### Operations

- **list**: List all cameras with optional filtering
- **info**: Get detailed camera information
- **enable**: Enable a camera
- **disable**: Disable a camera
- **snapshot**: Take a snapshot from a camera
- **config**: Get camera configuration

#### Example Usage

```javascript
// List all cameras
await connector.executeCapability('hikvision:camera', 'list');

// Get camera info
await connector.executeCapability('hikvision:camera', 'info', { channelId: 1 });

// Take snapshot
await connector.executeCapability('hikvision:camera', 'snapshot', { 
  channelId: 1, 
  streamType: 'main' 
});
```

### Video Streaming (`hikvision:stream`)

#### Operations

- **start**: Start a video stream
- **stop**: Stop a video stream
- **list**: List active streams
- **url**: Get stream URL
- **config**: Get stream configuration

#### Example Usage

```javascript
// Start RTSP stream
const stream = await connector.executeCapability('hikvision:stream', 'start', {
  channelId: 1,
  streamType: 'main',
  protocol: 'rtsp'
});

// Get HTTP stream URL
const url = await connector.executeCapability('hikvision:stream', 'url', {
  channelId: 1,
  streamType: 'sub',
  protocol: 'http'
});
```

### Recording Management (`hikvision:recording`)

#### Operations

- **start**: Start recording
- **stop**: Stop recording
- **list**: List recordings
- **download**: Download recording
- **delete**: Delete recording
- **schedule**: Get recording schedule

#### Example Usage

```javascript
// Start recording
await connector.executeCapability('hikvision:recording', 'start', {
  channelId: 1,
  type: 'manual'
});

// List recordings
const recordings = await connector.executeCapability('hikvision:recording', 'list', {
  channelId: 1,
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-01-02T00:00:00Z'
});
```

### Motion Detection (`hikvision:motion`)

#### Operations

- **enable**: Enable motion detection
- **disable**: Disable motion detection
- **configure**: Configure motion detection settings
- **status**: Get motion detection status
- **areas**: Get motion detection areas

#### Example Usage

```javascript
// Enable motion detection
await connector.executeCapability('hikvision:motion', 'enable', {
  channelId: 1,
  enabled: true
});

// Get motion areas
const areas = await connector.executeCapability('hikvision:motion', 'areas', {
  channelId: 1
});
```

### PTZ Control (`hikvision:ptz`)

#### Operations

- **move**: Move PTZ camera
- **stop**: Stop PTZ movement
- **preset**: Set PTZ preset
- **goto**: Go to PTZ preset
- **zoom**: Control zoom
- **list-presets**: List PTZ presets

#### Example Usage

```javascript
// Move PTZ
await connector.executeCapability('hikvision:ptz', 'move', {
  channelId: 1,
  action: 'start',
  pan: 10,
  tilt: 5,
  zoom: 0
});

// Set PTZ preset
await connector.executeCapability('hikvision:ptz', 'preset', {
  channelId: 1,
  presetId: 1,
  presetName: 'Home Position'
});

// List presets
const presets = await connector.executeCapability('hikvision:ptz', 'list-presets', {
  channelId: 1
});
```

### Event Management (`hikvision:event`)

#### Operations

- **list**: List events
- **subscribe**: Subscribe to events
- **unsubscribe**: Unsubscribe from events
- **triggers**: Get event triggers

#### Example Usage

```javascript
// Subscribe to motion events
await connector.executeCapability('hikvision:event', 'subscribe', {
  eventType: 'motion',
  channelId: 1
});

// Get event triggers
const triggers = await connector.executeCapability('hikvision:event', 'triggers');
```

### System Management (`hikvision:system`)

#### Operations

- **info**: Get system information
- **reboot**: Reboot system
- **config**: Get system configuration
- **network**: Get network configuration
- **users**: Get user list

#### Example Usage

```javascript
// Get system info
const info = await connector.executeCapability('hikvision:system', 'info');

// Get network config
const network = await connector.executeCapability('hikvision:system', 'network');
```

## API Endpoints

The connector uses the following Hikvision ISAPI endpoints:

- `/ISAPI/System/deviceInfo` - Device information
- `/ISAPI/System/Network` - Network configuration
- `/ISAPI/System/Video/inputs/channels` - Camera channels
- `/ISAPI/Streaming` - Video streaming
- `/ISAPI/Streaming/channels` - Snapshots
- `/ISAPI/ContentMgmt/record` - Recording management
- `/ISAPI/PTZCtrl` - PTZ control
- `/ISAPI/Event/triggers` - Event management
- `/ISAPI/Security/users` - User management
- `/ISAPI/System` - System management

## RTSP Streaming

The connector supports RTSP streaming with the following URL format:

```
rtsp://username:password@host:port/Streaming/Channels/{channelId}01
rtsp://username:password@host:port/Streaming/Channels/{channelId}02
```

Where:
- `01` = Main stream
- `02` = Sub stream

## Error Handling

The connector includes comprehensive error handling for:

- Authentication failures
- Network connectivity issues
- Invalid parameters
- Device-specific errors
- Timeout handling
- XML parsing errors

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify username and password
   - Check if the device supports the authentication method
   - Ensure the user has appropriate permissions
   - Some devices require admin privileges

2. **Connection Timeout**
   - Verify the device IP address and port
   - Check network connectivity
   - Increase timeout value if needed
   - Some devices have slower response times

3. **Camera Not Found**
   - Verify channel IDs (usually start from 1)
   - Check if cameras are properly connected
   - Ensure cameras are enabled in device settings
   - Some devices require camera discovery first

4. **PTZ Not Working**
   - Verify the camera supports PTZ
   - Check PTZ permissions
   - Ensure PTZ is enabled in camera settings

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
- Use strong passwords
- Consider using API keys for newer devices

## Device Compatibility

The connector is compatible with:

- Hikvision IP cameras
- Hikvision DVRs
- Hikvision NVRs
- Hikvision access control devices
- Devices with ISAPI support

## Limitations

- Maximum 32 concurrent streams
- Limited to ISAPI API capabilities
- Some features may require specific device models
- RTSP streaming may require additional configuration
- XML-based API may be slower than binary protocols
- Some devices have rate limiting

## Advanced Features

### Event Subscription

The connector supports real-time event subscription:

```javascript
// Subscribe to multiple event types
await connector.executeCapability('hikvision:event', 'subscribe', {
  eventTypes: ['motion', 'lineCrossing', 'intrusion'],
  channelId: 1
});
```

### Custom XML Requests

For advanced users, the connector supports custom XML requests:

```javascript
// Custom XML request
const response = await connector.httpClient.post('/ISAPI/Custom/endpoint', xmlData, {
  headers: { 'Content-Type': 'application/xml' }
});
``` 