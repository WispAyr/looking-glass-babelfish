# ADSB Connector Documentation

## Overview

The ADSB Connector provides integration with dump1090 ADS-B receivers to track aircraft positions, monitor spatial zones, and generate intelligent events based on aircraft behavior. It supports real-time radar display, emergency situation monitoring, and spatial zone management for aviation applications.

## Features

- **Real-time Aircraft Tracking**: Monitor aircraft positions, movements, and status
- **Spatial Zone Management**: Define and monitor zones for aircraft behavior
- **Radar Display**: Real-time visualization of aircraft positions
- **Smart Events**: Generate intelligent events based on aircraft patterns
- **Emergency Monitoring**: Detect and handle emergency situations
- **Zone Violations**: Track aircraft entering/exiting defined zones

## Configuration

### Basic Configuration

```json
{
  "id": "adsb-connector",
  "type": "adsb",
  "name": "ADSB Receiver",
  "description": "Connector for dump1090 ADS-B receiver",
  "config": {
    "url": "http://10.0.1.180/skyaware/data/aircraft.json",
    "pollInterval": 5000,
    "emergencyCodes": ["7500", "7600", "7700"],
    "radarRange": 50,
    "radarCenter": {
      "lat": 51.5074,
      "lon": -0.1278
    }
  }
}
```

### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | `http://10.0.1.180/skyaware/data/aircraft.json` | dump1090 aircraft data URL |
| `pollInterval` | number | `5000` | Polling interval in milliseconds |
| `emergencyCodes` | array | `["7500", "7600", "7700"]` | Emergency squawk codes to monitor |
| `maxAircraftAge` | number | `300000` | Maximum age of aircraft data (5 minutes) |
| `radarRange` | number | `50` | Radar display range in nautical miles |
| `radarCenter` | object | `{lat: 0, lon: 0}` | Center coordinates for radar display |
| `displayMode` | string | `"all"` | Radar display mode (all, filtered, emergency) |
| `showTrails` | boolean | `true` | Show aircraft trails on radar |
| `trailLength` | number | `10` | Number of trail points to display |

## Capabilities

### 1. Aircraft Tracking (`aircraft:tracking`)

Track aircraft positions, movements, and status changes.

**Operations:**
- `get` - Retrieve current aircraft data
- `subscribe` - Subscribe to aircraft updates
- `filter` - Filter aircraft by criteria
- `history` - Get aircraft history

**Events:**
- `aircraft:appeared` - New aircraft detected
- `aircraft:disappeared` - Aircraft no longer visible
- `aircraft:moved` - Aircraft position changed
- `aircraft:emergency` - Emergency situation detected

**Example:**
```javascript
// Get all aircraft
const result = await connector.execute('aircraft:tracking', 'get', {});

// Get specific aircraft
const aircraft = await connector.execute('aircraft:tracking', 'get', {
  icao24: 'ABCD1234567890'
});

// Filter aircraft
const filtered = await connector.execute('aircraft:tracking', 'get', {
  filter: {
    emergency: true,
    min_altitude: 1000,
    within_range: {
      center: { lat: 51.5074, lon: -0.1278 },
      range: 25
    }
  }
});
```

### 2. Zone Management (`zones:management`)

Define and manage spatial zones for aircraft monitoring.

**Operations:**
- `create` - Create a new zone
- `update` - Update zone properties
- `delete` - Delete a zone
- `list` - List all zones
- `monitor` - Monitor zone violations

**Events:**
- `zone:entered` - Aircraft entered zone
- `zone:exited` - Aircraft exited zone
- `zone:violation` - Zone violation detected

**Zone Types:**
- `parking` - Aircraft parking stands
- `taxiway` - Taxiway areas
- `runway` - Runway areas
- `approach` - Approach paths
- `departure` - Departure paths
- `emergency` - Emergency areas
- `custom` - Custom zones

**Example:**
```javascript
// Create a runway zone
const runway = await connector.execute('zones:management', 'create', {
  name: 'Runway 27L',
  zoneType: 'runway',
  coordinates: [
    { lat: 51.5074, lon: -0.1278 },
    { lat: 51.5084, lon: -0.1278 },
    { lat: 51.5084, lon: -0.1268 },
    { lat: 51.5074, lon: -0.1268 }
  ],
  properties: {
    runwayNumber: '27L',
    length: 3902,
    width: 50
  }
});

// List all zones
const zones = await connector.execute('zones:management', 'list', {});

// List active zones
const activeZones = await connector.execute('zones:management', 'list', {
  active: true
});
```

### 3. Radar Display (`radar:display`)

Real-time radar display of aircraft positions.

**Operations:**
- `get` - Get radar display data
- `configure` - Configure radar settings
- `filter` - Filter radar data
- `export` - Export radar data

**Example:**
```javascript
// Get radar display
const radar = await connector.execute('radar:display', 'get', {
  range: 50,
  center: { lat: 51.5074, lon: -0.1278 },
  filter: {
    emergency: false,
    min_altitude: 1000
  }
});

// Configure radar
const config = await connector.execute('radar:display', 'configure', {
  range: 100,
  displayMode: 'filtered',
  showTrails: true,
  trailLength: 20
});
```

### 4. Smart Events (`events:smart`)

Generate intelligent events based on aircraft behavior and zones.

**Operations:**
- `generate` - Generate smart events
- `configure` - Configure event rules
- `list` - List smart events
- `subscribe` - Subscribe to smart events

**Event Types:**
- `low_altitude` - Aircraft flying below 1000ft
- `high_speed` - Aircraft flying above 500 knots
- `rapid_descent` - Aircraft descending rapidly
- `zone_violation` - Aircraft violating zone rules

**Example:**
```javascript
// Generate smart events
const events = await connector.execute('events:smart', 'generate', {});

// List recent events
const recentEvents = await connector.execute('events:smart', 'list', {
  since: new Date(Date.now() - 3600000).toISOString() // Last hour
});

// List high priority events
const highPriority = await connector.execute('events:smart', 'list', {
  priority: 'high'
});
```

### 5. Emergency Monitoring (`emergency:monitoring`)

Monitor and handle emergency situations.

**Operations:**
- `monitor` - Monitor emergency situations
- `alert` - Send emergency alerts
- `log` - Log emergency events
- `escalate` - Escalate emergency situations

**Emergency Codes:**
- `7500` - Aircraft hijacking
- `7600` - Radio failure
- `7700` - General emergency

**Example:**
```javascript
// Get emergency events
const emergencies = await connector.execute('emergency:monitoring', 'monitor', {});

// Get active emergencies
const active = await connector.execute('emergency:monitoring', 'monitor', {
  status: 'active'
});
```

## Aircraft Data Structure

Each aircraft object contains the following properties:

```javascript
{
  icao24: "ABCD1234567890",        // ICAO 24-bit address
  callsign: "BAW123",              // Aircraft callsign
  lat: 51.5074,                    // Latitude
  lon: -0.1278,                    // Longitude
  altitude: 35000,                 // Altitude in feet
  speed: 450,                      // Ground speed in knots
  track: 270,                      // Track angle in degrees
  vertical_rate: 1000,             // Vertical rate in feet/minute
  squawk: "1234",                  // Transponder code
  emergency: false,                // Emergency status
  timestamp: 1640995200000,        // Last update timestamp
  last_seen: 1640995200000,        // Last seen timestamp
  messages: 150,                   // Number of messages received
  seen: 30,                        // Seconds since first seen
  rssi: -45.2                      // Signal strength
}
```

## Zone Data Structure

Each zone object contains the following properties:

```javascript
{
  id: "zone_1234567890",           // Unique zone identifier
  name: "Runway 27L",              // Zone name
  type: "runway",                  // Zone type
  coordinates: [                   // Zone boundary coordinates
    { lat: 51.5074, lon: -0.1278 },
    { lat: 51.5084, lon: -0.1278 },
    { lat: 51.5084, lon: -0.1268 },
    { lat: 51.5074, lon: -0.1268 }
  ],
  properties: {                    // Zone-specific properties
    runwayNumber: "27L",
    length: 3902,
    width: 50
  },
  created: "2024-01-01T12:00:00Z", // Creation timestamp
  active: true,                    // Zone active status
  violations: []                   // Zone violation history
}
```

## Event Data Structure

Each event object contains the following properties:

```javascript
{
  type: "low_altitude",            // Event type
  aircraft: {                      // Aircraft data
    icao24: "ABCD1234567890",
    callsign: "BAW123",
    // ... other aircraft properties
  },
  priority: "medium",              // Event priority (low, medium, high, critical)
  timestamp: "2024-01-01T12:00:00Z", // Event timestamp
  details: {                       // Event-specific details
    altitude: 800,
    threshold: 1000
  }
}
```

## Spatial Calculations

The connector includes utility functions for spatial calculations:

### Distance Calculation
```javascript
const distance = spatialUtils.calculateDistance(lat1, lon1, lat2, lon2);
// Returns distance in nautical miles
```

### Point in Polygon
```javascript
const isInside = spatialUtils.pointInPolygon(point, polygon);
// Returns true if point is inside polygon
```

### Bearing Calculation
```javascript
const bearing = spatialUtils.calculateBearing(lat1, lon1, lat2, lon2);
// Returns bearing in degrees (0-360)
```

## Integration with Map Connector

The ADSB connector integrates with the Map connector to provide spatial visualization:

```javascript
// Register with map connector
await mapConnector.execute('integration:connector', 'register', {
  connectorId: 'adsb-connector',
  context: {
    type: 'aircraft',
    capabilities: ['aircraft:tracking', 'zones:management']
  }
});

// Create spatial elements for aircraft
await mapConnector.execute('spatial:config', 'create', {
  elementType: 'aircraft',
  position: { lat: 51.5074, lon: -0.1278 },
  properties: {
    icao24: 'ABCD1234567890',
    callsign: 'BAW123',
    altitude: 35000
  }
});
```

## Error Handling

The connector handles various error conditions:

- **Connection Errors**: Network connectivity issues with dump1090
- **Data Parsing Errors**: Invalid JSON responses from dump1090
- **Zone Validation Errors**: Invalid zone coordinates or properties
- **Spatial Calculation Errors**: Invalid coordinate data

## Performance Considerations

- **Polling Interval**: Adjust based on network capacity and update frequency needs
- **Data Retention**: Aircraft history and events are limited to prevent memory issues
- **Zone Complexity**: Complex polygons may impact performance
- **Concurrent Operations**: Multiple simultaneous operations are supported

## Security Considerations

- **Network Security**: Ensure dump1090 URL is accessible and secure
- **Data Privacy**: Aircraft data may contain sensitive information
- **Zone Access**: Control access to zone management operations
- **Emergency Handling**: Ensure proper escalation procedures for emergency events

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Verify dump1090 URL is correct and accessible
   - Check network connectivity
   - Verify dump1090 is running and responding

2. **No Aircraft Data**
   - Check if dump1090 is receiving ADS-B signals
   - Verify antenna connection and positioning
   - Check dump1090 logs for errors

3. **Zone Violations Not Detected**
   - Verify zone coordinates are correct
   - Check if zone is active
   - Ensure aircraft have valid position data

4. **High Memory Usage**
   - Reduce data retention periods
   - Limit number of zones
   - Increase polling interval

### Debug Mode

Enable debug mode for detailed logging:

```javascript
connector.setDebugMode(true);
```

### Statistics

Get connector statistics:

```javascript
const stats = connector.getStats();
console.log('Aircraft count:', stats.aircraft.current);
console.log('Zone violations:', stats.zones.violations);
console.log('Performance:', stats.performance);
```

## API Reference

### Methods

#### `getAircraft(parameters)`
Retrieve aircraft data with optional filtering.

#### `createZone(parameters)`
Create a new spatial zone.

#### `getRadarDisplay(parameters)`
Get radar display data.

#### `generateSmartEvents()`
Generate smart events based on current data.

#### `getEmergencyEvents(parameters)`
Get emergency events.

#### `getStats()`
Get connector statistics.

### Events

#### `aircraft:updated`
Emitted when aircraft data is updated.

#### `aircraft:appeared`
Emitted when a new aircraft is detected.

#### `aircraft:disappeared`
Emitted when an aircraft is no longer visible.

#### `aircraft:emergency`
Emitted when an emergency situation is detected.

#### `zone:entered`
Emitted when an aircraft enters a zone.

#### `zone:exited`
Emitted when an aircraft exits a zone.

#### `event:generated`
Emitted when a smart event is generated.

## Examples

### Basic Setup
```javascript
const ADSBConnector = require('./connectors/types/ADSBConnector');

const connector = new ADSBConnector({
  id: 'adsb-connector',
  name: 'ADSB Receiver',
  config: {
    url: 'http://10.0.1.180/skyaware/data/aircraft.json',
    pollInterval: 5000
  }
});

await connector.connect();
```

### Zone Monitoring
```javascript
// Create approach zone
const approachZone = await connector.execute('zones:management', 'create', {
  name: 'Approach Path 27L',
  zoneType: 'approach',
  coordinates: [
    { lat: 51.5074, lon: -0.1278 },
    { lat: 51.5174, lon: -0.1278 },
    { lat: 51.5174, lon: -0.1178 },
    { lat: 51.5074, lon: -0.1178 }
  ]
});

// Listen for zone events
connector.on('zone:entered', (violation) => {
  console.log(`Aircraft ${violation.icao24} entered ${violation.zoneName}`);
});
```

### Emergency Monitoring
```javascript
// Listen for emergency events
connector.on('aircraft:emergency', (emergency) => {
  console.log(`EMERGENCY: Aircraft ${emergency.aircraft.icao24} squawking ${emergency.squawk}`);
  
  // Send alert
  await connector.execute('emergency:monitoring', 'alert', {
    emergencyCode: emergency.squawk,
    aircraft: emergency.aircraft,
    priority: 'critical'
  });
});
```

### Radar Integration
```javascript
// Get radar data for web interface
app.get('/api/radar', async (req, res) => {
  const radarData = await connector.execute('radar:display', 'get', {
    range: 50,
    center: { lat: 51.5074, lon: -0.1278 },
    filter: { emergency: false }
  });
  
  res.json(radarData);
});
```

This documentation provides a comprehensive guide to using the ADSB connector for aircraft tracking, zone monitoring, and radar display functionality. 