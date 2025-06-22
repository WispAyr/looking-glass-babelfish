# NOTAM Connector

## Overview

The NOTAM (Notice to Airmen) Connector integrates with the UK NOTAM archive to fetch, parse, and analyze NOTAM data. It provides geospatial visualization, proximity alerts, and temporal analysis capabilities for aviation safety and operational awareness.

## Features

- **Real-time NOTAM Polling**: Automatically fetches NOTAM data from the UK NOTAM archive XML feed
- **Geospatial Analysis**: Converts NOTAM data to geospatial format for map visualization
- **Proximity Alerts**: Generates alerts when aircraft approach NOTAM areas
- **Temporal Analysis**: Analyzes NOTAM validity periods and patterns
- **Map Integration**: Displays NOTAM data on spatial visualization maps
- **Event Emission**: Emits events for new, updated, and expired NOTAMs

## Configuration

### Basic Configuration

```json
{
  "id": "notam-main",
  "type": "notam",
  "name": "UK NOTAM Data",
  "description": "UK NOTAM data integration with geospatial analysis and proximity alerts",
  "config": {
    "notamUrl": "https://github.com/Jonty/uk-notam-archive/blob/main/data/PIB.xml",
    "pollInterval": 1200000,
    "ukBounds": {
      "north": 60.8604,
      "south": 49.1623,
      "east": 1.7633,
      "west": -8.6500
    }
  }
}
```

### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `notamUrl` | string | UK NOTAM archive URL | URL to the NOTAM XML feed |
| `pollInterval` | number | 1200000 (20 min) | Polling interval in milliseconds |
| `ukBounds` | object | UK bounds | Bounding box for UK airspace |

## Capabilities

### 1. NOTAM Tracking (`notam:tracking`)

Tracks and monitors NOTAM data.

**Operations:**
- `read`: Fetch latest NOTAM data
- `list`: Get filtered list of NOTAMs
- `get`: Get specific NOTAM by ID

**Example:**
```javascript
// Get all active NOTAMs
const activeNotams = await connector.execute('notam:tracking', 'list', {
  status: 'active'
});

// Get specific NOTAM
const notam = await connector.execute('notam:tracking', 'get', {
  notamId: 'notam-A1234/24'
});
```

### 2. Geospatial Analysis (`notam:geospatial`)

Converts NOTAM data to geospatial format and provides spatial analysis.

**Operations:**
- `convert`: Convert NOTAM to geospatial format
- `analyze`: Analyze NOTAMs within radius of point
- `query`: Query NOTAMs by spatial bounds

**Example:**
```javascript
// Find NOTAMs near a position
const nearbyNotams = await connector.execute('notam:geospatial', 'analyze', {
  lat: 55.5074,
  lon: -4.5933,
  radius: 50
});

// Query NOTAMs in bounds
const notamsInBounds = await connector.execute('notam:geospatial', 'query', {
  bounds: {
    north: 60.0,
    south: 50.0,
    east: 2.0,
    west: -10.0
  }
});
```

### 3. Proximity Alerts (`notam:proximity`)

Generates alerts when aircraft approach NOTAM areas.

**Operations:**
- `monitor`: Monitor aircraft proximity to NOTAMs
- `alert`: Generate proximity alert
- `check`: Check proximity for specific aircraft

**Example:**
```javascript
// Check aircraft proximity
const alerts = await connector.execute('notam:proximity', 'check', {
  aircraftPosition: { lat: 55.5, lon: -4.6 },
  radius: 10
});

// Monitor proximity
const nearbyNotams = await connector.execute('notam:proximity', 'monitor', {
  aircraftPosition: { lat: 55.5, lon: -4.6 },
  radius: 10
});
```

### 4. Temporal Analysis (`notam:temporal`)

Analyzes NOTAM temporal patterns and validity.

**Operations:**
- `analyze`: Analyze NOTAMs in time range
- `validate`: Validate NOTAM temporal data
- `expire`: Check for expired NOTAMs

**Example:**
```javascript
// Analyze NOTAMs in time range
const analysis = await connector.execute('notam:temporal', 'analyze', {
  startTime: new Date('2024-01-01T00:00:00Z'),
  endTime: new Date('2024-01-03T00:00:00Z')
});

// Validate NOTAM
const validation = await connector.execute('notam:temporal', 'validate', {
  notamId: 'notam-A1234/24'
});
```

### 5. Map Visualization (`notam:map:visualization`)

Displays NOTAM data on maps.

**Operations:**
- `display`: Display NOTAM on map
- `update`: Update NOTAM display
- `remove`: Remove NOTAM from map

**Example:**
```javascript
// Display NOTAM on map
await connector.execute('notam:map:visualization', 'display', {
  notamId: 'notam-A1234/24',
  mapId: 'map-main'
});

// Update NOTAM display
await connector.execute('notam:map:visualization', 'update', {
  notamId: 'notam-A1234/24',
  mapId: 'map-main',
  updates: { status: 'active' }
});
```

## Events

The NOTAM connector emits the following events:

### `notam:new`
Emitted when a new NOTAM is discovered.

```javascript
connector.on('notam:new', (data) => {
  console.log('New NOTAM:', data.notam.notamNumber);
});
```

### `notam:updated`
Emitted when an existing NOTAM is updated.

```javascript
connector.on('notam:updated', (data) => {
  console.log('NOTAM updated:', data.notam.notamNumber);
});
```

### `notam:expired`
Emitted when a NOTAM expires.

```javascript
connector.on('notam:expired', (data) => {
  console.log('NOTAM expired:', data.notam.notamNumber);
});
```

### `notam:proximity`
Emitted when an aircraft approaches a NOTAM area.

```javascript
connector.on('notam:proximity', (data) => {
  console.log('Proximity alert:', data.nearbyNotams.length, 'NOTAMs nearby');
});
```

## Data Structure

### NOTAM Object

```javascript
{
  id: 'notam-A1234/24',
  notamNumber: 'A1234/24',
  title: 'Runway Maintenance',
  description: 'Runway 12/30 closed for maintenance',
  startTime: Date,
  endTime: Date,
  category: 'maintenance',
  priority: 'normal',
  affectedArea: 'EGPK',
  position: {
    lat: 55.5074,
    lon: -4.5933
  },
  status: 'active',
  rawData: {} // Original XML data
}
```

### Geospatial Format

```javascript
{
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-4.5933, 55.5074]
  },
  properties: {
    id: 'notam-A1234/24',
    notamNumber: 'A1234/24',
    title: 'Runway Maintenance',
    description: 'Runway 12/30 closed for maintenance',
    startTime: Date,
    endTime: Date,
    status: 'active',
    category: 'maintenance',
    priority: 'normal'
  }
}
```

## Integration Examples

### Aircraft Proximity Monitoring

```javascript
// Monitor aircraft proximity to NOTAMs
const adsbConnector = connectorRegistry.getConnector('adsb-main');
const notamConnector = connectorRegistry.getConnector('notam-main');

adsbConnector.on('aircraft:updated', async (data) => {
  const aircraft = data.aircraft;
  
  // Check proximity to NOTAMs
  const proximityAlerts = await notamConnector.execute('notam:proximity', 'check', {
    aircraftPosition: { lat: aircraft.lat, lon: aircraft.lon },
    radius: 10
  });
  
  if (proximityAlerts.length > 0) {
    console.log(`Aircraft ${aircraft.callsign} approaching NOTAM areas:`, proximityAlerts);
  }
});
```

### Map Visualization

```javascript
// Display NOTAMs on map
const mapConnector = connectorRegistry.getConnector('map-main');
const notamConnector = connectorRegistry.getConnector('notam-main');

// Get active NOTAMs
const activeNotams = await notamConnector.execute('notam:tracking', 'list', {
  status: 'active'
});

// Display each NOTAM on map
for (const notam of activeNotams) {
  await notamConnector.execute('notam:map:visualization', 'display', {
    notamId: notam.id,
    mapId: 'map-main'
  });
}
```

### Telegram Notifications

```javascript
// Send NOTAM alerts via Telegram
const telegramConnector = connectorRegistry.getConnector('telegram-main');
const notamConnector = connectorRegistry.getConnector('notam-main');

notamConnector.on('notam:new', async (data) => {
  const notam = data.notam;
  
  await telegramConnector.execute('telegram:send', 'message', {
    chatId: '@notam_alerts',
    text: `🚨 New NOTAM: ${notam.notamNumber}\n${notam.title}\n${notam.description}`
  });
});

notamConnector.on('notam:proximity', async (data) => {
  const { aircraftPosition, nearbyNotams } = data;
  
  await telegramConnector.execute('telegram:send', 'message', {
    chatId: '@notam_alerts',
    text: `⚠️ Aircraft approaching ${nearbyNotams.length} NOTAM areas`
  });
});
```

## Testing

Run the NOTAM connector test:

```bash
node test-notam-connector.js
```

## Troubleshooting

### Common Issues

1. **XML Parsing Errors**: Check if the NOTAM XML feed is accessible and properly formatted
2. **No NOTAMs Found**: Verify the XML structure matches expected format
3. **Geospatial Issues**: Ensure coordinates are valid lat/lon values
4. **Polling Failures**: Check network connectivity and XML feed availability

### Debug Mode

Enable debug mode for detailed logging:

```javascript
const notamConnector = new NOTAMConnector(config);
notamConnector.setDebugMode(true);
```

### Statistics

Monitor connector performance:

```javascript
const stats = notamConnector.getStats();
console.log('NOTAM Connector Stats:', stats);
```

## Dependencies

- `axios`: HTTP client for fetching XML data
- `xml2js`: XML parsing library
- `crypto`: For generating unique IDs

## Related Documentation

- [Connector Architecture](../connector-architecture.md)
- [Map System](../realtime-map-system.md)
- [Event System](../automagic-event-system.md) 