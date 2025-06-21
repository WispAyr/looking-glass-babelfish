# Line Crossing Speed Detection

## Overview

The Line Crossing Speed Detection system integrates UniFi Protect's line crossing events with the speed calculation service to provide accurate vehicle and person speed monitoring without requiring ANPR (Automatic Number Plate Recognition). This system uses object tracking IDs to correlate line crossing events across multiple cameras and calculate speeds based on spatial relationships and time differences.

## Architecture

### Core Components

1. **UniFi Protect Connector** - Captures `smartDetectLine` events from cameras
2. **Speed Calculation Service** - Processes line crossing events and calculates speeds
3. **Speed Calculation Connector** - Coordinates between UniFi Protect and speed calculation
4. **Event Bus** - Routes line crossing events through the system
5. **Rule Engine** - Handles speed violation alerts and automation

### Event Flow

```
UniFi Protect Camera → smartDetectLine Event → UniFi Protect Connector → 
Event Bus → Speed Calculation Service → Speed Calculation → 
Rule Engine → Alerts/Actions
```

## Setup Instructions

### 1. Configure UniFi Protect Cameras

#### Enable Line Crossing Detection

1. **Access UniFi Protect Web Interface**
   - Navigate to your UniFi Protect NVR
   - Go to the camera settings

2. **Configure Smart Detection**
   - Enable "Smart Detection" for each camera
   - Select "Line Crossing" as a detection type
   - Configure object types (Vehicle, Person, etc.)

3. **Set Up Detection Lines**
   - Draw lines across the camera view where you want to detect crossings
   - Configure line direction (in/out)
   - Set confidence thresholds

#### Example Camera Configuration

```javascript
// Camera 1: Entry Point
{
  cameraId: 'camera-001',
  name: 'Entry Camera',
  smartDetection: {
    enabled: true,
    lineCrossing: {
      enabled: true,
      lines: [
        {
          id: 'entry-line-1',
          name: 'Entry Speed Detection Line',
          direction: 'in',
          objectTypes: ['vehicle', 'person'],
          confidence: 0.8
        }
      ]
    }
  }
}

// Camera 2: Exit Point
{
  cameraId: 'camera-002',
  name: 'Exit Camera',
  smartDetection: {
    enabled: true,
    lineCrossing: {
      enabled: true,
      lines: [
        {
          id: 'exit-line-1',
          name: 'Exit Speed Detection Line',
          direction: 'out',
          objectTypes: ['vehicle', 'person'],
          confidence: 0.8
        }
      ]
    }
  }
}
```

### 2. Register Detection Points

#### Using the Speed Calculation Connector

```javascript
// Register entry detection point
await speedConnector.execute('detection:points', 'register', {
  cameraId: 'camera-001',
  name: 'Entry Camera',
  position: { lat: 51.5074, lon: -0.1278 },
  direction: 'northbound',
  speedLimit: 30,
  type: 'lineCrossing',
  metadata: {
    location: 'Main entrance',
    lineId: 'entry-line-1',
    objectTypes: ['vehicle', 'person']
  }
});

// Register exit detection point
await speedConnector.execute('detection:points', 'register', {
  cameraId: 'camera-002',
  name: 'Exit Camera',
  position: { lat: 51.5120, lon: -0.1278 },
  direction: 'northbound',
  speedLimit: 30,
  type: 'lineCrossing',
  metadata: {
    location: 'Main exit',
    lineId: 'exit-line-1',
    objectTypes: ['vehicle', 'person']
  }
});
```

### 3. Connect to UniFi Protect

```javascript
// Connect to UniFi Protect connector
await speedConnector.execute('integration:unifi', 'connect', {
  connectorId: 'unifi-protect-main'
});

// Subscribe to line crossing events
await speedConnector.execute('integration:unifi', 'subscribe', {
  eventTypes: ['smartDetectLine']
});
```

### 4. Configure Speed Calculation Rules

```javascript
// Vehicle speed calculation rule
const vehicleRule = {
  id: 'vehicle-speed-calculation',
  name: 'Vehicle Speed Calculation',
  conditions: {
    eventType: 'lineCrossing',
    objectType: 'vehicle',
    cameras: ['camera-001', 'camera-002'],
    timeWindow: 300000 // 5 minutes
  },
  actions: [
    {
      type: 'calculateSpeed',
      parameters: {
        minTimeBetweenDetections: 1000, // 1 second
        maxTimeBetweenDetections: 300000, // 5 minutes
        minSpeedThreshold: 5, // 5 km/h
        maxSpeedThreshold: 200 // 200 km/h
      }
    },
    {
      type: 'generateAlert',
      parameters: {
        threshold: 35, // Alert if speed > 35 km/h
        alertType: 'speedViolation'
      }
    }
  ]
};

// Person speed calculation rule
const personRule = {
  id: 'person-speed-calculation',
  name: 'Person Speed Calculation',
  conditions: {
    eventType: 'lineCrossing',
    objectType: 'person',
    cameras: ['camera-001', 'camera-002'],
    timeWindow: 600000 // 10 minutes
  },
  actions: [
    {
      type: 'calculateSpeed',
      parameters: {
        minTimeBetweenDetections: 5000, // 5 seconds
        maxTimeBetweenDetections: 600000, // 10 minutes
        minSpeedThreshold: 1, // 1 km/h
        maxSpeedThreshold: 50 // 50 km/h
      }
    },
    {
      type: 'generateAlert',
      parameters: {
        threshold: 20, // Alert if speed > 20 km/h (running)
        alertType: 'personSpeedViolation'
      }
    }
  ]
};
```

## Event Structure

### Line Crossing Event Format

```javascript
{
  type: 'smartDetectLine',
  cameraId: 'camera-001',
  trackingId: 'vehicle-001',
  objectType: 'vehicle',
  timestamp: '2024-01-15T10:30:00.000Z',
  data: {
    lineId: 'entry-line-1',
    crossingDirection: 'in', // 'in' or 'out'
    confidence: 0.95,
    boundingBox: {
      x: 100,
      y: 200,
      width: 80,
      height: 40
    },
    smartDetectTypes: ['vehicle'],
    score: 0.95,
    zone: 'main-zone'
  }
}
```

### Speed Calculation Result

```javascript
{
  calculationId: 'vehicle-001-1705312200000-1705312320000',
  trackingId: 'vehicle-001',
  objectType: 'vehicle',
  camera1: 'camera-001',
  camera2: 'camera-002',
  timestamp1: '2024-01-15T10:30:00.000Z',
  timestamp2: '2024-01-15T10:32:00.000Z',
  timeDifference: 120000, // milliseconds
  distance: 0.5, // kilometers
  speedKmh: 15.0,
  speedMph: 9.3,
  speedLimit: 30,
  violation: false,
  excessSpeed: 0,
  confidence: 0.93
}
```

## API Endpoints

### Get Line Crossing Events

```http
GET /api/speed/line-crossing-events?cameraId=camera-001&objectType=vehicle&startTime=2024-01-15T10:00:00Z&endTime=2024-01-15T11:00:00Z
```

### Get Speed Calculations by Tracking ID

```http
GET /api/speed/tracking/vehicle-001
```

### Get Speed Alerts

```http
GET /api/speed/alerts?minExcess=10&objectType=vehicle
```

### Register Detection Point

```http
POST /api/speed/detection-points
Content-Type: application/json

{
  "cameraId": "camera-001",
  "name": "Entry Camera",
  "position": { "lat": 51.5074, "lon": -0.1278 },
  "direction": "northbound",
  "speedLimit": 30,
  "type": "lineCrossing",
  "metadata": {
    "lineId": "entry-line-1",
    "objectTypes": ["vehicle", "person"]
  }
}
```

## Configuration Examples

### Single Camera with Multiple Lines

For scenarios where you have one camera monitoring multiple lines:

```javascript
// Register multiple detection points for the same camera
await speedConnector.execute('detection:points', 'register', {
  cameraId: 'camera-001',
  name: 'Multi-Line Camera',
  position: { lat: 51.5074, lon: -0.1278 },
  direction: 'northbound',
  speedLimit: 30,
  type: 'lineCrossing',
  metadata: {
    lineId: 'line-1',
    objectTypes: ['vehicle']
  }
});

await speedConnector.execute('detection:points', 'register', {
  cameraId: 'camera-001',
  name: 'Multi-Line Camera',
  position: { lat: 51.5074, lon: -0.1278 },
  direction: 'northbound',
  speedLimit: 30,
  type: 'lineCrossing',
  metadata: {
    lineId: 'line-2',
    objectTypes: ['vehicle']
  }
});
```

### Multi-Camera Speed Trap

For complex speed trap setups with multiple cameras:

```javascript
// Entry camera
await speedConnector.execute('detection:points', 'register', {
  cameraId: 'entry-cam',
  name: 'Speed Trap Entry',
  position: { lat: 51.5074, lon: -0.1278 },
  direction: 'northbound',
  speedLimit: 30,
  type: 'lineCrossing'
});

// Middle camera (optional)
await speedConnector.execute('detection:points', 'register', {
  cameraId: 'middle-cam',
  name: 'Speed Trap Middle',
  position: { lat: 51.5097, lon: -0.1278 },
  direction: 'northbound',
  speedLimit: 30,
  type: 'lineCrossing'
});

// Exit camera
await speedConnector.execute('detection:points', 'register', {
  cameraId: 'exit-cam',
  name: 'Speed Trap Exit',
  position: { lat: 51.5120, lon: -0.1278 },
  direction: 'northbound',
  speedLimit: 30,
  type: 'lineCrossing'
});
```

## Troubleshooting

### Common Issues

1. **No Line Crossing Events Received**
   - Verify UniFi Protect line crossing is enabled
   - Check camera smart detection settings
   - Ensure line crossing confidence threshold is appropriate

2. **Speed Calculations Not Generated**
   - Verify detection points are registered correctly
   - Check time window settings (min/max time between detections)
   - Ensure tracking IDs are consistent across cameras

3. **Inaccurate Speed Calculations**
   - Verify camera positions are accurate (GPS coordinates)
   - Check distance calculations between detection points
   - Review time synchronization between cameras

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
// Set log level to debug
const config = {
  logging: {
    level: 'debug'
  }
};

// Monitor line crossing events
speedConnector.on('lineCrossing:detected', (data) => {
  console.log('Line crossing detected:', data);
});

// Monitor speed calculations
speedConnector.on('speed:calculated', (data) => {
  console.log('Speed calculated:', data);
});
```

## Performance Considerations

### Optimization Tips

1. **Filter Object Types**: Only subscribe to relevant object types (vehicle, person)
2. **Adjust Time Windows**: Set appropriate min/max time between detections
3. **Confidence Thresholds**: Use higher confidence thresholds to reduce false positives
4. **Distance Validation**: Implement distance checks to ensure logical movement patterns

### Monitoring

Monitor system performance using the health endpoints:

```http
GET /api/health/metrics
GET /api/speed/stats
```

## Integration with Other Systems

### MQTT Integration

Line crossing events can be published to MQTT for external systems:

```javascript
// MQTT topic structure
'unifi/line-crossing/{cameraId}/{objectType}'
'unifi/speed-calculation/{trackingId}'
'unifi/speed-alerts/{alertType}'
```

### WebSocket Real-time Updates

Subscribe to real-time line crossing and speed calculation events:

```javascript
// WebSocket events
socket.on('lineCrossingDetected', (data) => {
  console.log('Line crossing:', data);
});

socket.on('speedCalculated', (data) => {
  console.log('Speed calculated:', data);
});

socket.on('speedAlert', (data) => {
  console.log('Speed alert:', data);
});
```

## Best Practices

1. **Camera Placement**: Position cameras to capture clear line crossing events
2. **Line Configuration**: Draw lines perpendicular to expected movement direction
3. **Object Tracking**: Ensure consistent object tracking across cameras
4. **Time Synchronization**: Keep all cameras synchronized to accurate time
5. **Regular Calibration**: Periodically verify distance calculations and speed accuracy
6. **Alert Thresholds**: Set realistic speed violation thresholds based on local conditions 