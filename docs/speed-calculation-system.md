# Speed Calculation System

## Overview

The Speed Calculation System is a sophisticated ANPR-based vehicle speed monitoring solution that calculates vehicle speeds between two or more detection points using license plate recognition. It integrates seamlessly with UniFi Protect cameras and provides real-time speed monitoring, alerting, and historical analysis.

## Architecture

### Core Components

1. **Speed Calculation Service** (`services/speedCalculationService.js`)
   - Handles the core speed calculation logic
   - Manages detection points and plate tracking
   - Processes ANPR events and calculates speeds
   - Generates speed alerts for violations

2. **Speed Calculation Connector** (`connectors/types/SpeedCalculationConnector.js`)
   - Coordinates between UniFi Protect cameras and speed calculation service
   - Acts as the logic layer for the speed calculation system
   - Manages detection point registration and configuration
   - Handles real-time event processing

3. **Map Connector** (`connectors/types/MapConnector.js`)
   - Provides spatial configuration for camera locations
   - Visualizes detection points and speed detection lines
   - Integrates with the speed calculation system for spatial relationships

4. **API Routes** (`routes/speed.js`)
   - RESTful API endpoints for system management
   - Real-time data streaming via Server-Sent Events
   - Detection point management and configuration

## How It Works

### 1. Detection Point Registration

Cameras are registered as detection points with spatial coordinates:

```javascript
await speedConnector.execute('detection:points', 'register', {
  cameraId: 'camera-001',
  name: 'Entry Camera',
  position: { lat: 51.5074, lon: -0.1278 },
  direction: 'northbound',
  speedLimit: 30,
  metadata: {
    location: 'Main entrance',
    cameraModel: 'G4 Pro',
    anprEnabled: true
  }
});
```

### 2. ANPR Event Processing

When a vehicle is detected by ANPR, the system:

1. Receives the ANPR event from UniFi Protect
2. Validates the detection point is registered
3. Stores the detection with timestamp and position
4. Checks for matching plate numbers across detection points
5. Calculates speed when the same plate is detected at different points

### 3. Speed Calculation

Speed is calculated using the formula:

```
Speed (km/h) = Distance (km) / Time (hours)
```

The system:
- Calculates distance between detection points using Haversine formula (for lat/lon) or Euclidean distance (for x,y coordinates)
- Determines time difference between detections
- Validates speed against minimum/maximum thresholds
- Generates speed alerts for violations

### 4. Real-time Monitoring

The system provides:
- Real-time speed calculations via WebSocket/SSE
- Instant speed alerts for violations
- Live tracking of vehicles between detection points
- Integration with web GUI for visualization

## Setup Instructions

### 1. Install Dependencies

The speed calculation system is built into the core platform. No additional dependencies are required.

### 2. Configure Detection Points

```javascript
// Register two cameras as detection points
const detectionPoint1 = await speedConnector.execute('detection:points', 'register', {
  cameraId: 'camera-001',
  name: 'Entry Camera',
  position: { lat: 51.5074, lon: -0.1278 },
  direction: 'northbound',
  speedLimit: 30
});

const detectionPoint2 = await speedConnector.execute('detection:points', 'register', {
  cameraId: 'camera-002',
  name: 'Exit Camera',
  position: { lat: 51.5120, lon: -0.1278 },
  direction: 'northbound',
  speedLimit: 30
});
```

### 3. Connect to UniFi Protect

```javascript
// Connect to UniFi Protect connector
await speedConnector.execute('integration:unifi', 'connect', {
  connectorId: 'unifi-protect-main'
});

// Subscribe to ANPR events
await speedConnector.execute('integration:unifi', 'subscribe', {
  eventTypes: ['anpr:detected']
});
```

### 4. Set Up Spatial Configuration

```javascript
// Create camera elements on map
const camera1Element = await mapConnector.execute('spatial:config', 'create', {
  elementType: 'camera',
  position: { x: 100, y: 200, z: 0 },
  properties: {
    name: 'Entry Camera',
    cameraId: 'camera-001',
    type: 'anpr',
    speedLimit: 30
  }
});

// Create detection line
const detectionLine = await mapConnector.execute('spatial:config', 'create', {
  elementType: 'line',
  position: { x: 100, y: 450, z: 0 },
  properties: {
    name: 'Speed Detection Line',
    type: 'speed-trap',
    camera1: 'camera-001',
    camera2: 'camera-002',
    distance: 0.5
  }
});
```

## API Reference

### Speed Calculation Endpoints

#### Get Statistics
```http
GET /api/speed/stats
```

Returns system statistics including total calculations, alerts, and performance metrics.

#### Get Speed Calculations
```http
GET /api/speed/calculations?plateNumber=ABC123&minSpeed=50&maxSpeed=100
```

Query Parameters:
- `plateNumber` - Filter by specific plate number
- `minSpeed` - Minimum speed filter (km/h)
- `maxSpeed` - Maximum speed filter (km/h)
- `startTime` - Start time filter (ISO string)
- `endTime` - End time filter (ISO string)
- `limit` - Limit number of results

#### Get Speed Alerts
```http
GET /api/speed/alerts?minExcess=10
```

Query Parameters:
- `plateNumber` - Filter by specific plate number
- `minExcess` - Minimum excess speed filter (km/h)

#### Get Tracking Data
```http
GET /api/speed/tracking/ABC123
```

Returns complete tracking history for a specific plate number.

### Detection Point Management

#### Register Detection Point
```http
POST /api/speed/detection-points
Content-Type: application/json

{
  "cameraId": "camera-001",
  "name": "Entry Camera",
  "position": { "lat": 51.5074, "lon": -0.1278 },
  "direction": "northbound",
  "speedLimit": 30,
  "metadata": {
    "location": "Main entrance",
    "cameraModel": "G4 Pro"
  }
}
```

#### Update Detection Point
```http
PUT /api/speed/detection-points/camera-001
Content-Type: application/json

{
  "speedLimit": 40,
  "metadata": {
    "location": "Updated location"
  }
}
```

#### List Detection Points
```http
GET /api/speed/detection-points
```

#### Remove Detection Point
```http
DELETE /api/speed/detection-points/camera-001
```

### Real-time Data

#### Server-Sent Events
```http
GET /api/speed/realtime
```

Returns real-time speed calculations and alerts via Server-Sent Events.

Event Types:
- `speedCalculated` - New speed calculation
- `speedAlert` - Speed violation alert
- `stats` - Updated statistics

## Configuration

### Environment Variables

```env
# Speed Calculation Service
SPEED_CALCULATION_ENABLED=true
SPEED_MIN_TIME=1000
SPEED_MAX_TIME=300000
SPEED_MIN_THRESHOLD=5
SPEED_MAX_THRESHOLD=200
SPEED_CONFIDENCE_THRESHOLD=0.8
SPEED_RETENTION_HOURS=24

# Speed Alerts
SPEED_ALERTS_ENABLED=true
SPEED_ALERT_THRESHOLD=100
```

### Service Configuration

```javascript
const speedConnector = new SpeedCalculationConnector({
  id: 'speed-calculation-main',
  name: 'Speed Calculation System',
  speedService: {
    minTimeBetweenDetections: 1000, // 1 second
    maxTimeBetweenDetections: 300000, // 5 minutes
    minSpeedThreshold: 5, // 5 km/h
    maxSpeedThreshold: 200, // 200 km/h
    confidenceThreshold: 0.8,
    retentionHours: 24
  }
});
```

## Database Schema

### Speed Calculations Table
```sql
CREATE TABLE speed_calculations (
  id VARCHAR(255) PRIMARY KEY,
  plate_number VARCHAR(20) NOT NULL,
  camera1_id VARCHAR(100) NOT NULL,
  camera2_id VARCHAR(100) NOT NULL,
  distance DECIMAL(10,6) NOT NULL,
  time_diff INTEGER NOT NULL,
  speed_kmh DECIMAL(8,2) NOT NULL,
  timestamp1 TIMESTAMP NOT NULL,
  timestamp2 TIMESTAMP NOT NULL,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confidence1 DECIMAL(3,2),
  confidence2 DECIMAL(3,2)
);
```

### Detection Points Table
```sql
CREATE TABLE detection_points (
  camera_id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  direction VARCHAR(50),
  speed_limit INTEGER,
  active BOOLEAN DEFAULT TRUE,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Speed Alerts Table
```sql
CREATE TABLE speed_alerts (
  id VARCHAR(255) PRIMARY KEY,
  plate_number VARCHAR(20) NOT NULL,
  speed_kmh DECIMAL(8,2) NOT NULL,
  speed_limit INTEGER NOT NULL,
  excess DECIMAL(8,2) NOT NULL,
  camera1_id VARCHAR(100) NOT NULL,
  camera2_id VARCHAR(100) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Integration Examples

### UniFi Protect Integration

```javascript
// UniFi Protect connector emits ANPR events
unifiConnector.on('anpr:detected', (event) => {
  // Speed calculation connector processes the event
  speedConnector.processUniFiANPREvent(event);
});
```

### Web GUI Integration

```javascript
// Real-time speed updates in web GUI
speedConnector.on('speed:calculated', (speedData) => {
  // Update web GUI with new speed calculation
  webGuiConnector.broadcastSpeedCalculation(speedData);
});

speedConnector.on('speed:alert', (alertData) => {
  // Show speed alert notification in web GUI
  webGuiConnector.showSpeedAlert(alertData);
});
```

### Analytics Integration

```javascript
// Enhanced analytics with speed data
analyticsEngine.on('speed:calculated', (speedData) => {
  // Store speed data in analytics
  analyticsEngine.storeSpeedAnalytics(speedData);
});
```

## Use Cases

### 1. Traffic Speed Monitoring
- Monitor vehicle speeds on highways and roads
- Detect speeding violations in real-time
- Generate reports for law enforcement

### 2. Parking Facility Management
- Track vehicle movement through parking facilities
- Calculate average speeds for safety analysis
- Monitor for reckless driving

### 3. Security Applications
- Track suspicious vehicle movements
- Monitor access control points
- Generate alerts for unauthorized vehicles

### 4. Traffic Flow Analysis
- Analyze traffic patterns and speeds
- Optimize traffic light timing
- Plan road infrastructure improvements

## Troubleshooting

### Common Issues

1. **No Speed Calculations Generated**
   - Check detection points are properly registered
   - Verify ANPR events are being received
   - Ensure time between detections is within configured limits

2. **Incorrect Speed Calculations**
   - Verify detection point coordinates are accurate
   - Check distance calculation method (lat/lon vs x,y)
   - Validate timestamp accuracy

3. **Missing Speed Alerts**
   - Confirm speed limits are set on detection points
   - Check alert threshold configuration
   - Verify event listeners are properly configured

### Debug Mode

Enable debug logging for detailed troubleshooting:

```javascript
const speedConnector = new SpeedCalculationConnector({
  logger: winston.createLogger({
    level: 'debug',
    // ... logger configuration
  })
});
```

## Performance Considerations

### Optimization Tips

1. **Detection Point Limits**
   - Limit to essential detection points
   - Use appropriate time windows for calculations
   - Implement data retention policies

2. **Event Processing**
   - Use event queuing for high-volume scenarios
   - Implement batch processing for historical data
   - Optimize database queries with proper indexing

3. **Real-time Updates**
   - Use WebSocket connections for real-time data
   - Implement connection pooling for multiple clients
   - Consider data compression for large datasets

## Security Considerations

### Access Control
- Implement authentication for API endpoints
- Use role-based access control for system management
- Secure WebSocket connections with authentication

### Data Privacy
- Implement data retention policies
- Anonymize plate numbers in reports
- Comply with local privacy regulations

### System Security
- Validate all input data
- Implement rate limiting on API endpoints
- Use HTTPS for all communications

## Future Enhancements

### Planned Features

1. **Multi-lane Support**
   - Support for multiple lanes per detection point
   - Lane-specific speed limits and monitoring

2. **Advanced Analytics**
   - Machine learning for speed prediction
   - Traffic pattern analysis
   - Predictive maintenance alerts

3. **Mobile Integration**
   - Mobile app for real-time monitoring
   - Push notifications for speed alerts
   - Offline data collection

4. **Integration Expansion**
   - Support for additional camera systems
   - Integration with traffic management systems
   - Weather condition impact analysis

## Support

For technical support and questions about the Speed Calculation System:

1. Check the troubleshooting section above
2. Review the example code in `examples/speed-calculation-setup.js`
3. Consult the API documentation
4. Check system logs for error messages

The Speed Calculation System is designed to be robust, scalable, and easy to integrate with existing infrastructure while providing powerful speed monitoring capabilities. 