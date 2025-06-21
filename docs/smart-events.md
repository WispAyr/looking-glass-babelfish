# Smart Events Integration

This document provides comprehensive information about the smart events integration in the Babelfish Looking Glass application, including smart detection analytics, pattern recognition, and real-time processing.

## Overview

Smart events integration provides advanced analytics and real-time processing for UniFi Protect smart detection events. The system processes person, vehicle, animal, package, and face detection events with confidence scoring, pattern recognition, and cross-zone tracking.

## Smart Detection Types

### Person Detection
- **Description**: Human detection with confidence scoring and tracking
- **Confidence Range**: 0.0 - 1.0
- **Attributes**: Direction, speed, clothing, pose
- **Use Cases**: Security monitoring, people counting, access control

### Vehicle Detection
- **Description**: Car, truck, motorcycle detection with tracking
- **Confidence Range**: 0.0 - 1.0
- **Attributes**: Vehicle type, color, direction, speed
- **Use Cases**: Traffic monitoring, parking management, security

### Animal Detection
- **Description**: Pet and wildlife detection
- **Confidence Range**: 0.0 - 1.0
- **Attributes**: Animal type, size, behavior
- **Use Cases**: Wildlife monitoring, pet tracking, security

### Package Detection
- **Description**: Package and object detection
- **Confidence Range**: 0.0 - 1.0
- **Attributes**: Package size, location, movement
- **Use Cases**: Package delivery monitoring, security

### Face Detection
- **Description**: Facial recognition and detection
- **Confidence Range**: 0.0 - 1.0
- **Attributes**: Face orientation, expression, recognition
- **Use Cases**: Access control, security, analytics

## Smart Detection Context

Each smart detection event includes comprehensive context data:

```json
{
  "objectType": "person",
  "confidence": 0.85,
  "zone": "zone-1",
  "location": {
    "x": 100,
    "y": 200
  },
  "trackingId": "track-123",
  "boundingBox": {
    "x": 50,
    "y": 100,
    "width": 200,
    "height": 300
  },
  "attributes": {
    "direction": "entering",
    "speed": "walking",
    "clothing": "dark",
    "pose": "standing"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Analytics Engine Integration

### Smart Detection Processing

The analytics engine processes smart detection events with the following capabilities:

1. **Event Enrichment**: Adds context and metadata to raw events
2. **Confidence Analysis**: Tracks confidence levels and identifies anomalies
3. **Pattern Recognition**: Identifies unusual detection patterns
4. **Cross-Zone Tracking**: Tracks objects moving between zones
5. **Historical Analysis**: Stores and analyzes detection history

### Pattern Recognition

The system identifies several types of patterns:

#### High Frequency Patterns
- **Description**: Unusual detection frequency for specific object types
- **Threshold**: More than 2 detections per minute
- **Use Case**: Identify potential system issues or unusual activity

#### Low Confidence Patterns
- **Description**: Detections with consistently low confidence
- **Threshold**: Confidence below 0.3
- **Use Case**: Identify potential false positives or system calibration issues

#### Cross-Zone Patterns
- **Description**: Objects moving between multiple zones
- **Use Case**: Track movement patterns and identify unusual routes

#### Zone Activity Patterns
- **Description**: Multiple detections in specific zones
- **Use Case**: Identify high-activity areas and potential security concerns

## API Endpoints

### Smart Detection Analytics

#### Get All Smart Detection Analytics
```http
GET /api/analytics/smart-detections
```

**Query Parameters:**
- `cameraId` (optional): Filter by specific camera
- `objectType` (optional): Filter by object type (person, vehicle, animal, package, face)
- `limit` (optional): Number of recent detections to return (default: 50)
- `timeRange` (optional): Time range in minutes for filtering

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalDetections": 150,
      "personDetections": 75,
      "vehicleDetections": 45,
      "animalDetections": 20,
      "packageDetections": 5,
      "faceDetections": 3,
      "genericDetections": 2
    },
    "confidenceStats": {
      "average": 0.78,
      "min": 0.25,
      "max": 0.95
    },
    "cameras": {
      "camera-123": {
        "totalDetections": 50,
        "detectionTypes": {
          "person": 30,
          "vehicle": 15,
          "animal": 5
        },
        "confidenceStats": {
          "average": 0.82,
          "min": 0.30,
          "max": 0.95
        },
        "recentDetections": [...],
        "cameraName": "Front Door Camera"
      }
    },
    "recentDetections": [...]
  },
  "count": 3
}
```

#### Get Camera-Specific Smart Analytics
```http
GET /api/analytics/smart-detections/{cameraId}
```

**Query Parameters:**
- `objectType` (optional): Filter by object type
- `limit` (optional): Number of recent detections to return (default: 50)
- `timeRange` (optional): Time range in minutes for filtering

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDetections": 50,
    "lastDetection": "2024-01-15T10:30:00.000Z",
    "detectionTypes": {
      "person": 30,
      "vehicle": 15,
      "animal": 5
    },
    "confidenceStats": {
      "average": 0.82,
      "min": 0.30,
      "max": 0.95
    },
    "recentDetections": [...],
    "cameraName": "Front Door Camera",
    "cameraStatus": "online"
  },
  "cameraId": "camera-123"
}
```

#### Get Smart Detection Patterns
```http
GET /api/analytics/smart-patterns
```

**Query Parameters:**
- `cameraId` (optional): Filter by specific camera
- `objectType` (optional): Filter by object type
- `timeRange` (optional): Time range in minutes (default: 60)

**Response:**
```json
{
  "success": true,
  "data": {
    "highFrequency": [
      {
        "objectType": "person",
        "frequency": 3.2,
        "count": 15,
        "cameraId": "camera-123"
      }
    ],
    "lowConfidence": [
      {
        "cameraId": "camera-123",
        "count": 8,
        "averageConfidence": 0.25,
        "detections": [...]
      }
    ],
    "crossZone": [],
    "unusualActivity": [],
    "timeBased": {
      "hourly": {},
      "daily": {},
      "weekly": {}
    }
  },
  "filters": {
    "cameraId": "camera-123",
    "objectType": "person",
    "timeRange": 60
  }
}
```

## Dashboard Integration

### Smart Detection Dashboard

The dashboard provides comprehensive smart detection insights:

#### Real-time Alerts
- **Smart Detection Alerts**: Immediate notifications for new detections
- **Pattern Alerts**: Notifications for unusual patterns
- **Confidence Alerts**: Notifications for low-confidence detections
- **Cross-Zone Alerts**: Notifications for cross-zone movement

#### Smart Detection Summary
- **Total Detections**: Overall detection count
- **Detection Types**: Breakdown by object type
- **Confidence Statistics**: Average, min, and max confidence
- **Recent Activity**: Latest detections with details

#### Pattern Analysis
- **High Frequency Patterns**: Unusual detection frequency
- **Low Confidence Patterns**: Potential false positives
- **Cross-Zone Patterns**: Movement between zones
- **Zone Activity**: High-activity zones

### Dashboard API

#### Get Dashboard Smart Detection Data
```http
GET /api/dashboard/smart-detections
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalDetections": 150,
      "personDetections": 75,
      "vehicleDetections": 45,
      "animalDetections": 20,
      "packageDetections": 5,
      "faceDetections": 3,
      "genericDetections": 2
    },
    "confidenceStats": {
      "average": 0.78,
      "min": 0.25,
      "max": 0.95
    },
    "recentDetections": [...],
    "patterns": {
      "highFrequency": 2,
      "lowConfidence": 5,
      "crossZone": 1
    }
  }
}
```

## MQTT Integration

### Smart Detection MQTT Topics

Smart detection events are automatically published to MQTT topics:

#### Event Topics
- `camera/events/smartDetected` - All smart detection events
- `camera/events/smartDetected/{objectType}` - Type-specific events
- `camera/events/smartDetected/{cameraId}` - Camera-specific events

#### Pattern Topics
- `camera/patterns/high-frequency` - High frequency pattern alerts
- `camera/patterns/low-confidence` - Low confidence pattern alerts
- `camera/patterns/cross-zone` - Cross-zone movement alerts

### MQTT Message Format

#### Smart Detection Event
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
      "direction": "entering",
      "speed": "walking",
      "clothing": "dark"
    }
  },
  "metadata": {
    "rule": "camera-events-mqtt-rule",
    "processed": true
  }
}
```

#### Pattern Alert
```json
{
  "eventType": "smartPattern",
  "patternType": "high-frequency",
  "cameraId": "camera-123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "objectType": "person",
    "frequency": 3.2,
    "count": 15,
    "detections": [...]
  }
}
```

## Configuration

### Smart Detection Configuration

Smart detection can be configured in the connector configuration:

```json
{
  "config": {
    "autoDiscovery": {
      "eventTypes": ["motion", "smart", "recording", "connection"]
    },
    "events": {
      "types": ["motion", "smart", "recording", "connection"],
      "smartDetection": {
        "enabled": true,
        "confidenceThreshold": 0.3,
        "patternDetection": true,
        "crossZoneTracking": true,
        "retentionHours": 24
      }
    }
  }
}
```

### Configuration Options

- **enabled**: Enable/disable smart detection processing
- **confidenceThreshold**: Minimum confidence for processing (default: 0.3)
- **patternDetection**: Enable pattern recognition (default: true)
- **crossZoneTracking**: Enable cross-zone tracking (default: true)
- **retentionHours**: How long to retain detection data (default: 24)

## Usage Examples

### Basic Smart Detection Monitoring

```javascript
// Subscribe to smart detection events
connector.on('smart:detected', (data) => {
  console.log(`Smart detection: ${data.smartContext.objectType} on camera ${data.cameraId}`);
  console.log(`Confidence: ${(data.smartContext.confidence * 100).toFixed(1)}%`);
});

// Subscribe to pattern alerts
connector.on('smart:pattern:high-frequency', (data) => {
  console.log(`High frequency pattern detected: ${data.objectType}`);
  console.log(`Frequency: ${data.frequency.toFixed(1)}/min`);
});
```

### API Usage Examples

```javascript
// Get smart detection analytics
const response = await fetch('/api/analytics/smart-detections?objectType=person&limit=20');
const analytics = await response.json();

// Get camera-specific analytics
const cameraResponse = await fetch('/api/analytics/smart-detections/camera-123');
const cameraAnalytics = await cameraResponse.json();

// Get pattern analysis
const patternResponse = await fetch('/api/analytics/smart-patterns?cameraId=camera-123');
const patterns = await patternResponse.json();
```

### MQTT Subscription Example

```javascript
// Subscribe to smart detection events
mqtt.subscribe('camera/events/smartDetected', (message) => {
  const event = JSON.parse(message);
  console.log(`Smart detection: ${event.eventData.objectType}`);
});

// Subscribe to pattern alerts
mqtt.subscribe('camera/patterns/+', (message) => {
  const alert = JSON.parse(message);
  console.log(`Pattern alert: ${alert.patternType}`);
});
```

## Troubleshooting

### Common Issues

1. **No Smart Detection Events**
   - Check if smart detection is enabled on cameras
   - Verify WebSocket connection is active
   - Check confidence threshold settings

2. **Low Confidence Detections**
   - Adjust camera positioning and lighting
   - Check camera firmware version
   - Review smart detection settings in UniFi Protect

3. **Missing Pattern Alerts**
   - Verify pattern detection is enabled in configuration
   - Check analytics engine is running
   - Review pattern thresholds

### Debug Information

Enable debug logging for smart detection:

```javascript
// Enable debug logging
logger.level = 'debug';

// Check smart detection status
const status = await connector.getSmartDetectionStatus();
console.log('Smart detection status:', status);
```

## Performance Considerations

### Memory Usage
- Smart detection data is retained in memory for real-time processing
- Historical data is limited to prevent memory issues
- Consider adjusting retention settings for large deployments

### Processing Load
- Pattern recognition adds computational overhead
- Cross-zone tracking requires additional processing
- Consider disabling features for high-camera-count deployments

### Network Usage
- Smart detection events increase MQTT traffic
- Real-time analytics updates increase API traffic
- Monitor network usage in large deployments 