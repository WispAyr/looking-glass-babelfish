# Analytics and Zone Management System

The Babelfish Looking Glass platform includes a sophisticated analytics and zone management system that provides context-aware monitoring and derived intelligence from camera events.

## Overview

The analytics system processes camera events to derive meaningful context and insights, including:

- **Zone-based monitoring** with camera assignments
- **Cross-zone tracking** for objects and people
- **Speed calculations** for vehicles crossing zones
- **People counting** and occupancy tracking
- **Plate recognition** and vehicle tracking
- **Real-time alerts** for violations and events

## Architecture

### Core Components

1. **Zone Manager** (`services/zoneManager.js`)
   - Manages zone definitions and relationships
   - Handles camera-zone assignments
   - Provides zone analytics and statistics

2. **Analytics Engine** (`services/analyticsEngine.js`)
   - Processes camera events for analytics
   - Calculates derived metrics
   - Manages plate tracking and speed calculations

3. **Dashboard Service** (`services/dashboardService.js`)
   - Provides unified view of all monitoring data
   - Manages real-time updates
   - Handles alert generation

## Zone Management

### Zone Types

Zones can be categorized by type for different monitoring purposes:

- `entry` - Entry points to facilities
- `exit` - Exit points from facilities
- `parking` - Parking areas
- `security` - Security-sensitive areas
- `traffic` - Traffic monitoring zones
- `custom` - Custom zone types

### Zone Properties

```javascript
{
  id: "zone-123",
  name: "Main Entry",
  type: "entry",
  description: "Primary entry point",
  location: { x: 0, y: 0 },
  active: true,
  cameras: ["camera-001", "camera-002"],
  coverage: {
    "camera-001": { coverage: 0.8 },
    "camera-002": { coverage: 0.6 }
  }
}
```

### Camera Assignment

Cameras can be assigned to multiple zones, and zones can have multiple cameras:

```javascript
// Assign camera to zone
await zoneManager.assignCameraToZone('camera-001', 'zone-123', {
  coverage: 0.8,
  angle: 45,
  range: 50
});

// Get cameras for a zone
const cameras = zoneManager.getCamerasForZone('zone-123');

// Get zones for a camera
const zones = zoneManager.getZonesForCamera('camera-001');
```

## Analytics Processing

### Event Types

The analytics engine processes various event types:

- `motion` - Motion detection events
- `smartDetected` - Smart detection events (person, vehicle, animal)
- `plateDetected` - License plate detection
- `personDetected` - Person detection with tracking
- `vehicleDetected` - Vehicle detection

### Speed Calculations

When the same license plate is detected in different zones, the system automatically calculates speed:

```javascript
// Speed calculation result
{
  plateNumber: "ABC123",
  zone1Id: "entry-zone",
  zone2Id: "parking-zone",
  distance: 100, // meters
  timeDiff: 3600000, // milliseconds
  speedKmh: 100.0, // km/h
  timestamp1: "2024-01-15T10:00:00.000Z",
  timestamp2: "2024-01-15T10:01:00.000Z"
}
```

### People Counting

Real-time occupancy tracking per zone:

```javascript
// People count update
{
  zoneId: "parking-zone",
  count: 5,
  direction: "entered"
}
```

## API Endpoints

### Zone Management

#### List Zones
```http
GET /api/analytics/zones
```

Query Parameters:
- `type` - Filter by zone type
- `cameraId` - Filter zones by camera
- `active` - Filter by active status
- `limit` - Limit number of results

#### Create Zone
```http
POST /api/analytics/zones
Content-Type: application/json

{
  "name": "New Zone",
  "type": "custom",
  "description": "Zone description",
  "location": { "x": 0, "y": 0 },
  "active": true
}
```

#### Get Zone Details
```http
GET /api/analytics/zones/:zoneId
```

#### Assign Camera to Zone
```http
POST /api/analytics/zones/:zoneId/cameras/:cameraId
Content-Type: application/json

{
  "coverage": 0.8,
  "angle": 45,
  "range": 50
}
```

### Analytics

#### Get All Analytics
```http
GET /api/analytics
```

#### Get Camera Analytics
```http
GET /api/analytics/cameras/:cameraId
```

#### Get Zone Analytics
```http
GET /api/analytics/zones/:zoneId
```

#### Get Speed Calculations
```http
GET /api/analytics/speed
```

Query Parameters:
- `plateNumber` - Filter by plate number
- `minSpeed` - Minimum speed filter
- `maxSpeed` - Maximum speed filter

#### Get Plate Tracking
```http
GET /api/analytics/plates/:plateNumber
```

### Dashboard

#### Get Dashboard Data
```http
GET /api/analytics/dashboard
```

Query Parameters:
- `zones` - Comma-separated zone IDs to include
- `cameras` - Comma-separated camera IDs to include
- `realTime` - Include real-time updates

#### Get Overview
```http
GET /api/analytics/dashboard/overview
```

#### Real-time Updates
```http
GET /api/analytics/dashboard/realtime
```

Returns Server-Sent Events (SSE) stream with real-time updates.

## Configuration

### Environment Variables

```env
# Analytics System
ANALYTICS_ENABLED=true
ZONE_MANAGER_ENABLED=true
ANALYTICS_ENGINE_ENABLED=true

# Speed Calculations
SPEED_CALCULATION_ENABLED=true
SPEED_MIN_TIME=1000
SPEED_MAX_TIME=300000

# People Counting
PEOPLE_COUNTING_ENABLED=true
OCCUPANCY_HISTORY_MAX=1000

# Plate Recognition
PLATE_RECOGNITION_ENABLED=true
PLATE_CONFIDENCE_THRESHOLD=0.8
PLATE_MAX_TRACKING_TIME=3600000

# Dashboard
DASHBOARD_ENABLED=true
DASHBOARD_REFRESH_INTERVAL=5000
DASHBOARD_MAX_EVENTS=100
DASHBOARD_MAX_ALERTS=50

# Speed Alerts
SPEED_ALERTS_ENABLED=true
SPEED_ALERT_THRESHOLD=100
SPEED_ALERT_HIGH=120
SPEED_ALERT_MEDIUM=100
```

## Usage Examples

### Creating a Monitoring Setup

```javascript
// 1. Create zones
const entryZone = await zoneManager.createZone({
  name: 'Entry Zone',
  type: 'entry',
  location: { x: 0, y: 0 }
});

const parkingZone = await zoneManager.createZone({
  name: 'Parking Zone',
  type: 'parking',
  location: { x: 100, y: 0 }
});

// 2. Assign cameras
await zoneManager.assignCameraToZone('camera-001', entryZone.id);
await zoneManager.assignCameraToZone('camera-002', parkingZone.id);

// 3. Listen for events
analyticsEngine.on('speed:calculated', (data) => {
  if (data.speedKmh > 100) {
    console.log(`Speed violation: ${data.plateNumber} at ${data.speedKmh} km/h`);
  }
});

analyticsEngine.on('people:counted', (data) => {
  console.log(`Zone ${data.zoneId}: ${data.count} people`);
});
```

### Dashboard Integration

```javascript
// Subscribe to real-time updates
const eventSource = new EventSource('/api/analytics/dashboard/realtime');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  // Update dashboard UI
  updateOverview(data.overview);
  updateZones(data.zones);
  updateEvents(data.events);
  updateAlerts(data.alerts);
};
```

## Testing

Run the analytics system test:

```bash
node test-zone-analytics.js
```

This will:
1. Create test zones
2. Assign cameras
3. Simulate events
4. Demonstrate speed calculations
5. Show people counting
6. Display dashboard data

## Performance Considerations

- **Event Processing**: Events are processed asynchronously to avoid blocking
- **Memory Management**: Analytics data is limited to prevent memory issues
- **Real-time Updates**: SSE provides efficient real-time updates
- **Caching**: Frequently accessed data is cached for performance

## Future Enhancements

- **Machine Learning**: AI-powered anomaly detection
- **Predictive Analytics**: Traffic pattern prediction
- **Advanced Tracking**: Multi-camera object tracking
- **Geofencing**: GPS-based zone definitions
- **Integration**: Third-party analytics platform integration 