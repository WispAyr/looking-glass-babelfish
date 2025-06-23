# NOTAM Connector

## Overview

The NOTAM (Notice to Airmen) Connector integrates with the UK NOTAM archive to fetch, parse, and analyze NOTAM data. It provides geospatial visualization, proximity alerts, and temporal analysis capabilities for aviation safety and operational awareness.

## ✅ **Recent Integration Enhancements**

### Prestwick Airport Integration
The NOTAM connector now integrates seamlessly with the Prestwick Airport connector to provide automatic NOTAM checking for aircraft operations:

- **Automatic NOTAM Checking**: Checks for relevant NOTAMs when aircraft approach, land, or take off from EGPK
- **Telegram Notifications**: Sends instant NOTAM alerts via Telegram with formatted messages
- **Proximity Alerts**: Real-time alerts when aircraft approach NOTAM-affected areas
- **Operational Integration**: Works with ADSB connector for real-time aircraft tracking

### Telegram Integration (✅ **Now Working**)
With the recent Telegram connector fix, NOTAM notifications now work reliably:

```javascript
// NOTAM alert via Telegram (now working)
await telegramConnector.execute('telegram:send', 'text', {
  chatId: prestwickConfig.telegramChatId,
  text: `🚨 NOTAM Alert: ${notam.description}`,
  parseMode: 'HTML'
});
```

### Enhanced Capabilities
- **Real-time NOTAM Polling**: Automatically fetches NOTAM data from the UK NOTAM archive XML feed
- **Geospatial Analysis**: Converts NOTAM data to geospatial format for map visualization
- **Proximity Alerts**: Generates alerts when aircraft approach NOTAM areas
- **Temporal Analysis**: Analyzes NOTAM validity periods and patterns
- **Map Integration**: Displays NOTAM data on spatial visualization maps
- **Event Emission**: Emits events for new, updated, and expired NOTAMs
- **Prestwick Integration**: Automatic NOTAM checking for Glasgow Prestwick Airport operations

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
    },
    "prestwickIntegration": {
      "enabled": true,
      "airportCode": "EGPK",
      "airportPosition": {
        "lat": 55.5074,
        "lon": -4.5933
      },
      "notificationRadius": 50
    }
  }
}
```

### Advanced Configuration with Prestwick Integration

```json
{
  "config": {
    "prestwickIntegration": {
      "enabled": true,
      "airportCode": "EGPK",
      "airportPosition": {
        "lat": 55.5074,
        "lon": -4.5933
      },
      "notificationRadius": 50,
      "telegramNotifications": {
        "enabled": true,
        "chatId": "-1001242323336",
        "messageTemplate": "🚨 NOTAM Alert for EGPK: {notam.description}"
      },
      "checkOnEvents": [
        "aircraft:approach",
        "aircraft:landing",
        "aircraft:takeoff"
      ]
    },
    "proximityAlerts": {
      "enabled": true,
      "defaultRadius": 10,
      "alertLevels": {
        "critical": 5,
        "warning": 10,
        "info": 20
      }
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
| `prestwickIntegration.enabled` | boolean | true | Enable Prestwick Airport integration |
| `prestwickIntegration.airportCode` | string | "EGPK" | Prestwick Airport ICAO code |
| `prestwickIntegration.notificationRadius` | number | 50 | Radius for NOTAM notifications (km) |
| `proximityAlerts.enabled` | boolean | true | Enable proximity alerts |

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
// Find NOTAMs near Prestwick Airport
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
// Check aircraft proximity to Prestwick
const alerts = await connector.execute('notam:proximity', 'check', {
  aircraftPosition: { lat: 55.5, lon: -4.6 },
  radius: 10,
  airportCode: 'EGPK'
});

// Monitor proximity with notifications
const nearbyNotams = await connector.execute('notam:proximity', 'monitor', {
  aircraftPosition: { lat: 55.5, lon: -4.6 },
  radius: 10,
  sendNotifications: true
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

### 5. Prestwick Integration (`notam:prestwick`) (✅ **New**)

Integrates with Prestwick Airport operations.

**Operations:**
- `checkApproach`: Check NOTAMs for approaching aircraft
- `checkLanding`: Check NOTAMs for landing aircraft
- `checkTakeoff`: Check NOTAMs for departing aircraft
- `sendNotification`: Send NOTAM alert via Telegram

**Example:**
```javascript
// Check NOTAMs for approaching aircraft
const notamAlerts = await connector.execute('notam:prestwick', 'checkApproach', {
  aircraft: {
    callsign: 'BA123',
    position: { lat: 55.5, lon: -4.6 },
    altitude: 3000
  }
});

// Send NOTAM notification
await connector.execute('notam:prestwick', 'sendNotification', {
  notam: notamData,
  aircraft: aircraftData,
  eventType: 'approach'
});
```

### 6. Map Visualization (`notam:map:visualization`)

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

### `notam:proximity` (✅ **New**)
Emitted when aircraft approach NOTAM-affected areas.

```javascript
connector.on('notam:proximity', (data) => {
  console.log('Aircraft approaching NOTAM area:', data.aircraft.callsign);
  console.log('NOTAM:', data.notam.notamNumber);
});
```

### `notam:prestwick` (✅ **New**)
Emitted for Prestwick Airport NOTAM events.

```javascript
connector.on('notam:prestwick', (data) => {
  console.log('Prestwick NOTAM event:', data.eventType);
  console.log('Aircraft:', data.aircraft.callsign);
  console.log('NOTAM:', data.notam.notamNumber);
});
```

## Integration Examples

### Prestwick Airport Integration
```javascript
// In Prestwick Airport connector
this.eventBus.subscribe('aircraft:approach', async (event) => {
  // Check for relevant NOTAMs
  const notamAlerts = await this.notamConnector.execute('notam:prestwick', 'checkApproach', {
    aircraft: event.aircraft
  });
  
  // Send notifications for any relevant NOTAMs
  for (const notam of notamAlerts) {
    await this.telegramConnector.execute('telegram:send', 'text', {
      chatId: this.telegramConfig.chatId,
      text: `🚨 NOTAM Alert for ${event.aircraft.callsign}: ${notam.description}`,
      parseMode: 'HTML'
    });
  }
});
```

### ADSB Integration
```javascript
// In ADSB connector
this.eventBus.subscribe('aircraft:detected', async (event) => {
  // Check if aircraft is near Prestwick
  const distanceToPrestwick = this.calculateDistance(
    event.aircraft.position,
    { lat: 55.5074, lon: -4.5933 }
  );
  
  if (distanceToPrestwick < 50) {
    // Check for relevant NOTAMs
    const notamAlerts = await this.notamConnector.execute('notam:proximity', 'check', {
      aircraftPosition: event.aircraft.position,
      radius: 10
    });
    
    // Process NOTAM alerts
    for (const alert of notamAlerts) {
      this.eventBus.publishEvent('notam:proximity', {
        aircraft: event.aircraft,
        notam: alert.notam,
        distance: alert.distance
      });
    }
  }
});
```

## Testing

### Unit Tests
```javascript
describe('NOTAM Connector', () => {
  test('should fetch NOTAM data', async () => {
    const notams = await connector.execute('notam:tracking', 'read');
    expect(notams.length).toBeGreaterThan(0);
  });
  
  test('should analyze geospatial data', async () => {
    const nearbyNotams = await connector.execute('notam:geospatial', 'analyze', {
      lat: 55.5074,
      lon: -4.5933,
      radius: 50
    });
    expect(Array.isArray(nearbyNotams)).toBe(true);
  });
});
```

### Integration Tests
```javascript
describe('NOTAM Integration', () => {
  test('should integrate with Prestwick Airport', async () => {
    const notamAlerts = await connector.execute('notam:prestwick', 'checkApproach', {
      aircraft: {
        callsign: 'TEST123',
        position: { lat: 55.5, lon: -4.6 },
        altitude: 3000
      }
    });
    
    expect(Array.isArray(notamAlerts)).toBe(true);
  });
  
  test('should send Telegram notifications', async () => {
    await connector.execute('notam:prestwick', 'sendNotification', {
      notam: { notamNumber: 'TEST123', description: 'Test NOTAM' },
      aircraft: { callsign: 'TEST123' },
      eventType: 'approach'
    });
    
    // Verify notification was sent
  });
});
```

## Performance Considerations

### Data Management
- **Caching**: Cache NOTAM data to reduce API calls
- **Incremental Updates**: Only fetch new or updated NOTAMs
- **Data Cleanup**: Remove expired NOTAMs from memory
- **Compression**: Compress NOTAM data for storage

### Proximity Calculations
- **Spatial Indexing**: Use spatial indexes for fast proximity queries
- **Radius Optimization**: Optimize radius calculations for performance
- **Batch Processing**: Process multiple aircraft positions in batches
- **Background Processing**: Run proximity checks in background threads

## Troubleshooting

### Common Issues

#### NOTAM Data Not Loading
- Check network connectivity to NOTAM archive
- Verify NOTAM URL is accessible
- Check XML parsing for malformed data
- Review polling interval settings

#### Proximity Alerts Not Working
- Verify aircraft position data is valid
- Check radius settings for proximity calculations
- Ensure NOTAM geospatial data is properly converted
- Review event subscription setup

#### Telegram Notifications Not Sending
- Verify Telegram connector is properly registered
- Check chat ID configuration
- Ensure bot has permission to send messages
- Review message template formatting

### Debug Commands
```javascript
// Check NOTAM data status
const status = await connector.execute('notam:tracking', 'status');

// Test proximity calculation
const proximity = await connector.execute('notam:proximity', 'test', {
  position: { lat: 55.5074, lon: -4.5933 },
  radius: 10
});

// Test Prestwick integration
const testResult = await connector.execute('notam:prestwick', 'test', {
  aircraft: { callsign: 'TEST123', position: { lat: 55.5, lon: -4.6 } }
});
```

## Future Enhancements

### Planned Features
1. **Multi-Airport Support**: Extend beyond Prestwick to other UK airports
2. **Advanced Analytics**: NOTAM trend analysis and reporting
3. **Machine Learning**: Predictive NOTAM analysis
4. **Real-time Updates**: WebSocket-based real-time NOTAM updates
5. **International NOTAMs**: Support for international NOTAM sources

### Scalability Improvements
1. **Distributed Processing**: Multi-node NOTAM processing
2. **Database Storage**: Move from memory to persistent database
3. **API Integration**: Direct integration with NOTAM APIs
4. **Load Balancing**: Distribute NOTAM processing load

---

The NOTAM Connector provides comprehensive NOTAM integration for aviation safety and operational awareness, with enhanced capabilities for Prestwick Airport operations and reliable Telegram notifications. 