# ADSB Connector Documentation

## Overview

The ADSB Connector provides integration with dump1090 ADS-B receivers to track aircraft positions, monitor spatial zones, and generate intelligent events based on aircraft behavior. It supports real-time radar display, emergency situation monitoring, and spatial zone management for aviation applications.

**Enhanced Features:**
- **Real-time Aircraft Tracking**: Monitor aircraft positions, movements, and status
- **Spatial Zone Management**: Define and monitor zones for aircraft behavior
- **Radar Display**: Real-time visualization of aircraft positions
- **Smart Events**: Generate intelligent events based on aircraft patterns
- **Emergency Monitoring**: Detect and handle emergency situations
- **Zone Violations**: Track aircraft entering/exiting defined zones
- **UK Squawk Code Analysis**: Enhanced monitoring with UK aviation squawk code intelligence
- **BaseStation Database Integration**: Access aircraft registration data
- **Airspace Awareness**: Real-time airspace context and monitoring

## Configuration

### Basic Configuration

```json
{
  "id": "adsb-connector",
  "type": "adsb",
  "name": "ADSB Receiver",
  "description": "Connector for dump1090 ADS-B receiver with enhanced features",
  "config": {
    "url": "http://10.0.1.180/skyaware/data/aircraft.json",
    "pollInterval": 5000,
    "emergencyCodes": ["7500", "7600", "7700"],
    "radarRange": 50,
    "radarCenter": {
      "lat": 51.5074,
      "lon": -0.1278
    },
    "enableSquawkCodeAnalysis": true,
    "enableBaseStationIntegration": true,
    "enableAirspaceAwareness": true
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
| `enableSquawkCodeAnalysis` | boolean | `true` | Enable UK squawk code analysis |
| `enableBaseStationIntegration` | boolean | `true` | Enable BaseStation.sqb database integration |
| `enableAirspaceAwareness` | boolean | `true` | Enable airspace awareness features |
| `showSquawkInfo` | boolean | `true` | Show squawk information on radar display |

## Capabilities

### 1. Aircraft Tracking (`aircraft:tracking`)

Track aircraft positions, movements, and status.

**Operations:**
- `get` - Get current aircraft data
- `subscribe` - Subscribe to aircraft updates
- `filter` - Filter aircraft by criteria
- `history` - Get aircraft history

**Example:**
```javascript
// Get all aircraft
const aircraft = await connector.execute('aircraft:tracking', 'get', {});

// Filter aircraft by altitude
const highAltitude = await connector.execute('aircraft:tracking', 'filter', {
  min_altitude: 30000
});

// Get aircraft history
const history = await connector.execute('aircraft:tracking', 'history', {
  icao24: 'ABCD1234567890',
  hours: 24
});
```

### 2. Zone Management (`zones:management`)

Define and manage spatial zones for aircraft monitoring.

**Operations:**
- `create` - Create a new zone
- `update` - Update zone configuration
- `delete` - Delete a zone
- `list` - List all zones
- `monitor` - Monitor zone activity

**Example:**
```javascript
// Create a runway zone
const runwayZone = await connector.execute('zones:management', 'create', {
  name: 'Runway 27L',
  zoneType: 'runway',
  coordinates: [
    { lat: 51.5074, lon: -0.1278 },
    { lat: 51.5174, lon: -0.1278 },
    { lat: 51.5174, lon: -0.1178 },
    { lat: 51.5074, lon: -0.1178 }
  ]
});

// Monitor zone violations
connector.on('zone:entered', (violation) => {
  console.log(`Aircraft ${violation.icao24} entered ${violation.zoneName}`);
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
// Get radar data
const radar = await connector.execute('radar:display', 'get', {
  range: 50,
  center: { lat: 51.5074, lon: -0.1278 },
  filter: { emergency: false }
});

// Configure radar
await connector.execute('radar:display', 'configure', {
  showTrails: true,
  showSquawkInfo: true,
  showAirspace: true
});
```

### 4. Smart Events (`events:smart`)

Generate intelligent events based on aircraft behavior and zones.

**Operations:**
- `generate` - Generate smart events
- `configure` - Configure event rules
- `list` - List recent events
- `subscribe` - Subscribe to events

**Example:**
```javascript
// Generate smart events
const events = await connector.execute('events:smart', 'generate', {});

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

### 6. BaseStation Database (`basestation:database`)

Access aircraft registration data from BaseStation.sqb database.

**Operations:**
- `search` - Search aircraft by criteria
- `lookup` - Lookup aircraft by ICAO24
- `stats` - Get database statistics
- `export` - Export aircraft data

**Example:**
```javascript
// Search aircraft
const search = await connector.execute('basestation:database', 'search', {
  manufacturer: 'Boeing',
  type: '737',
  limit: 10
});

// Lookup aircraft
const aircraft = await connector.execute('basestation:database', 'lookup', {
  icao24: 'ABCD1234567890'
});
```

### 7. Squawk Code Analysis (`squawk:analysis`) ⭐ NEW

Analyze and manage UK aviation squawk codes for enhanced monitoring.

**Operations:**
- `lookup` - Lookup squawk code information
- `search` - Search squawk codes by criteria
- `analyze` - Analyze aircraft squawk code
- `stats` - Get squawk code statistics
- `categories` - Get available categories

**Squawk Code Categories:**
- `emergency` - Emergency codes (7500, 7600, 7700)
- `military` - Military aircraft codes
- `nato` - NATO operation codes
- `atc` - Air traffic control codes
- `emergency_services` - Emergency service codes
- `law_enforcement` - Police and law enforcement codes
- `offshore` - Offshore operations codes
- `conspicuity` - Conspicuity and monitoring codes
- `transit` - Transit and ORCAM codes
- `general` - General purpose codes

**Example:**
```javascript
// Lookup squawk code
const squawkInfo = await connector.execute('squawk:analysis', 'lookup', {
  code: '7500'
});

// Search military codes
const militaryCodes = await connector.execute('squawk:analysis', 'search', {
  category: 'military',
  limit: 10
});

// Get categories
const categories = await connector.execute('squawk:analysis', 'categories', {});

// Get statistics
const stats = await connector.execute('squawk:analysis', 'stats', {});
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
  rssi: -45.2,                     // Signal strength
  
  // Enhanced data (when available)
  registration: "G-ABCD",          // Aircraft registration
  type: "Boeing 737-800",          // Aircraft type
  manufacturer: "Boeing",          // Manufacturer
  operator: "British Airways",     // Operator
  
  // Squawk code analysis (when enabled)
  squawkInfo: {                    // Squawk code information
    code: "1234",
    description: "Assigned by London Control",
    category: "atc",
    priority: "normal",
    enhanced: {
      type: "atc",
      atcControlled: true,
      alertLevel: "medium"
    }
  },
  squawkCategory: "atc",           // Squawk category
  squawkPriority: "normal",        // Squawk priority
  squawkEnhanced: {                // Enhanced squawk data
    type: "atc",
    atcControlled: true,
    alertLevel: "medium"
  },
  
  // Airspace context (when enabled)
  airspace: [...],                 // Current airspace
  airspaceContext: "..."           // Airspace context description
}
```

## Zone Data Structure

Each zone object contains the following properties:

```javascript
{
  id: "zone_001",                  // Zone identifier
  name: "Runway 27L",              // Zone name
  zoneType: "runway",              // Zone type
  coordinates: [                   // Zone coordinates
    { lat: 51.5074, lon: -0.1278 },
    { lat: 51.5174, lon: -0.1278 },
    { lat: 51.5174, lon: -0.1178 },
    { lat: 51.5074, lon: -0.1178 }
  ],
  color: "#FF0000",                // Display color
  priority: "high",                // Zone priority
  active: true,                    // Zone status
  violations: 5,                   // Number of violations
  lastViolation: 1640995200000     // Last violation timestamp
}
```

## Squawk Code Data Structure

Each squawk code analysis contains the following properties:

```javascript
{
  code: "7500",                    // Squawk code
  found: true,                     // Whether code was found
  description: "Special Purpose Code – Hi-Jacking", // Code description
  category: "emergency",           // Code category
  authority: "UK CAA",             // Controlling authority
  special: true,                   // Whether it's a special code
  priority: "critical",            // Priority level
  enhanced: {                      // Enhanced information
    type: "emergency",
    requiresImmediateAttention: true,
    alertLevel: "critical"
  }
}
```

## Event Types

### Aircraft Events
- `aircraft:appeared` - New aircraft detected
- `aircraft:disappeared` - Aircraft no longer visible
- `aircraft:moved` - Aircraft position updated
- `aircraft:emergency` - Emergency situation detected

### Zone Events
- `zone:entered` - Aircraft entered zone
- `zone:exited` - Aircraft exited zone
- `zone:violation` - Zone violation detected

### Squawk Code Events ⭐ NEW
- `squawk:analyzed` - Squawk code analyzed
- `emergency:squawk` - Emergency squawk detected
- `military:squawk` - Military squawk detected
- `nato:squawk` - NATO squawk detected
- `atc:squawk` - ATC squawk detected

### Airspace Events
- `airspace:entry` - Aircraft entered airspace
- `airspace:exit` - Aircraft exited airspace
- `airspace:event` - Airspace-related event

### Smart Events
- `event:generated` - Smart event generated
- `event:pattern:detected` - Pattern detected
- `event:rule:triggered` - Rule triggered

## Integration Examples

### Basic Integration
```javascript
const ADSBConnector = require('./connectors/types/ADSBConnector');

const connector = new ADSBConnector({
  id: 'adsb-main',
  name: 'ADSB Receiver',
  config: {
    url: 'http://10.0.1.180/skyaware/data/aircraft.json',
    pollInterval: 5000,
    enableSquawkCodeAnalysis: true,
    enableBaseStationIntegration: true
  }
});

// Connect and start monitoring
await connector.connect();

// Listen for events
connector.on('aircraft:emergency', (emergency) => {
  console.log(`EMERGENCY: ${emergency.aircraft.icao24} squawking ${emergency.squawk}`);
});

connector.on('squawk:analyzed', (event) => {
  console.log(`Squawk Analysis: ${event.aircraft.icao24} - ${event.squawkInfo.description}`);
});
```

### Squawk Code Integration
```javascript
// Set up squawk code service
const SquawkCodeService = require('./services/squawkCodeService');
const squawkService = new SquawkCodeService();
await squawkService.initialize();

// Integrate with ADSB connector
connector.setSquawkCodeService(squawkService);

// Listen for squawk events
connector.on('emergency:squawk', (event) => {
  console.log(`🚨 EMERGENCY: ${event.aircraft.icao24} (${event.squawk})`);
  // Handle emergency situation
});

connector.on('military:squawk', (event) => {
  console.log(`⚔️  MILITARY: ${event.aircraft.icao24} (${event.squawk})`);
  // Handle military activity
});
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

## Performance Considerations

### Caching
- Squawk code lookups are cached for improved performance
- BaseStation database queries are cached
- Airspace calculations are optimized

### Memory Management
- Aircraft data is limited to recent entries
- Event history is capped to prevent memory issues
- Zone violations are tracked efficiently

### Network Optimization
- Polling intervals can be adjusted based on requirements
- Data filtering reduces network traffic
- Efficient JSON parsing and processing

## Troubleshooting

### Common Issues

1. **Squawk Code Service Not Initialized**
   - Ensure the squawk code data file exists
   - Check file permissions
   - Verify data file format

2. **BaseStation Database Connection Failed**
   - Verify database file path
   - Check file permissions
   - Ensure SQLite3 is available

3. **High Memory Usage**
   - Reduce aircraft history retention
   - Limit event history size
   - Adjust polling intervals

4. **Network Timeouts**
   - Increase timeout values
   - Check network connectivity
   - Verify dump1090 URL

### Debug Mode
Enable debug logging for detailed information:
```javascript
const connector = new ADSBConnector({
  config: {
    logLevel: 'debug'
  }
});
```

This documentation provides a comprehensive guide to using the enhanced ADSB connector with squawk code analysis, BaseStation integration, and airspace awareness for advanced aircraft monitoring and analysis. 