# ADSB Connector with BaseStation.sqb Integration

## Overview

The ADSB Connector now includes comprehensive integration with BaseStation.sqb databases, providing enhanced aircraft identification and registration data lookup capabilities. This integration enriches real-time aircraft tracking with historical registration information, manufacturer details, and operator data.

## Features

### 🔍 **Enhanced Aircraft Identification**
- **Registration Lookup**: Automatic lookup of aircraft registration data from BaseStation database
- **Manufacturer Information**: Aircraft manufacturer and type details
- **Operator Data**: Aircraft owner and operator information
- **Display Names**: Intelligent display names using registration or callsign
- **Caching**: Efficient caching of registration data for performance

### 📊 **Database Operations**
- **Aircraft Search**: Search aircraft by registration, manufacturer, type, or operator
- **Registration Lookup**: Direct lookup by ICAO24 address
- **Data Export**: Export aircraft data in JSON or CSV formats
- **Statistics**: Database performance and usage statistics
- **Registry Management**: Automatic loading and caching of aircraft registry

### 🚀 **Performance Optimizations**
- **Connection Pooling**: Efficient database connection management
- **Query Caching**: Cache frequently accessed registration data
- **Batch Loading**: Pre-load aircraft registry on startup
- **Error Handling**: Graceful fallback when database is unavailable

## Configuration

### Basic Configuration

```json
{
  "id": "adsb-main",
  "type": "adsb",
  "name": "ADSB Receiver with BaseStation Integration",
  "description": "Primary ADSB aircraft data receiver with BaseStation.sqb database integration",
  "config": {
    "url": "http://10.0.1.180/skyaware/data/aircraft.json",
    "pollInterval": 5000,
    "radarRange": 0.5,
    "radarCenter": {
      "lat": 55.5074,
      "lon": -4.5933
    },
    "enableBaseStationIntegration": true,
    "baseStationDbPath": "./aviationdata/BaseStation.sqb"
  }
}
```

### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enableBaseStationIntegration` | boolean | `true` | Enable BaseStation database integration |
| `baseStationDbPath` | string | `./aviationdata/BaseStation.sqb` | Path to BaseStation.sqb database file |
| `url` | string | `http://10.0.1.180/skyaware/data/aircraft.json` | dump1090 aircraft data URL |
| `pollInterval` | number | `5000` | Polling interval in milliseconds |
| `radarRange` | number | `0.5` | Radar display range in nautical miles |
| `radarCenter` | object | `{lat: 55.5074, lon: -4.5933}` | Radar center coordinates |

## Capabilities

### 1. BaseStation Database (`basestation:database`)

Access aircraft registration data from BaseStation.sqb database.

**Operations:**
- `search` - Search aircraft by various criteria
- `lookup` - Lookup aircraft registration by ICAO24
- `stats` - Get database statistics and performance metrics
- `export` - Export aircraft data in various formats

**Events:**
- `database:connected` - BaseStation database connected
- `database:error` - Database connection error
- `registry:loaded` - Aircraft registry loaded

**Example:**
```javascript
// Search for Boeing aircraft
const boeingAircraft = await connector.execute('basestation:database', 'search', {
  manufacturer: 'Boeing',
  limit: 10
});

// Lookup specific aircraft
const aircraft = await connector.execute('basestation:database', 'lookup', {
  icao24: 'ABCD1234567890'
});

// Get database statistics
const stats = await connector.execute('basestation:database', 'stats', {});

// Export aircraft data
const exportData = await connector.execute('basestation:database', 'export', {
  manufacturer: 'Airbus',
  format: 'csv',
  limit: 100
});
```

### 2. Enhanced Aircraft Tracking (`aircraft:tracking`)

Aircraft tracking now includes registration data from BaseStation database.

**Enhanced Aircraft Object:**
```javascript
{
  icao24: "ABCD1234567890",
  callsign: "BAW123",
  displayName: "G-BOAC", // Registration or callsign
  registration: "G-BOAC",
  icaoTypeCode: "B744",
  type: "Boeing 747-400",
  manufacturer: "Boeing",
  operatorFlagCode: "G",
  serialNo: "12345",
  yearBuilt: "1990",
  owner: "British Airways",
  operator: "British Airways",
  lat: 51.5074,
  lon: -0.1278,
  altitude: 35000,
  speed: 450,
  track: 270,
  emergency: false,
  timestamp: 1640995200000
}
```

## Database Schema

The BaseStation.sqb database contains the following key tables:

### Aircraft Table
```sql
CREATE TABLE Aircraft (
  ModeS TEXT PRIMARY KEY,           -- ICAO24 address
  Registration TEXT,                -- Aircraft registration
  ICAOTypeCode TEXT,                -- ICAO type code
  Type TEXT,                        -- Aircraft type
  Manufacturer TEXT,                -- Manufacturer
  OperatorFlagCode TEXT,            -- Operator flag code
  SerialNo TEXT,                    -- Serial number
  YearBuilt TEXT,                   -- Year built
  Owner TEXT,                       -- Aircraft owner
  Operator TEXT                     -- Aircraft operator
);
```

## Usage Examples

### 1. Enhanced Aircraft Monitoring

```javascript
const connector = new ADSBConnector({
  config: {
    enableBaseStationIntegration: true,
    baseStationDbPath: './aviationdata/BaseStation.sqb'
  }
});

// Aircraft events now include registration data
connector.on('aircraft:appeared', (aircraft) => {
  console.log(`Aircraft: ${aircraft.displayName}`);
  if (aircraft.registration) {
    console.log(`Registration: ${aircraft.registration}`);
    console.log(`Type: ${aircraft.manufacturer} ${aircraft.type}`);
    console.log(`Operator: ${aircraft.operator}`);
  }
});
```

### 2. Aircraft Search and Filtering

```javascript
// Search for specific aircraft types
const airbusAircraft = await connector.execute('basestation:database', 'search', {
  manufacturer: 'Airbus',
  type: 'A320',
  limit: 50
});

// Filter real-time aircraft by registration
const realTimeAircraft = await connector.execute('aircraft:tracking', 'get', {
  filter: {
    hasRegistration: true,
    manufacturer: 'Boeing'
  }
});
```

### 3. Data Export and Analysis

```javascript
// Export aircraft data for analysis
const exportData = await connector.execute('basestation:database', 'export', {
  manufacturer: 'Boeing',
  format: 'csv',
  limit: 1000
});

// Get database performance statistics
const stats = await connector.execute('basestation:database', 'stats', {});
console.log('Cache hit rate:', stats.baseStation.cacheHitRate);
console.log('Total queries:', stats.baseStation.queries);
```

## Performance Considerations

### Caching Strategy
- **Registry Cache**: Aircraft registry loaded on startup and cached in memory
- **Query Cache**: Individual aircraft lookups cached for subsequent requests
- **Cache Hit Rate**: Monitor cache performance via statistics

### Database Optimization
- **Read-Only Access**: Database opened in read-only mode for safety
- **Connection Pooling**: Efficient connection management
- **Query Optimization**: Indexed queries on ModeS field

### Error Handling
- **Graceful Degradation**: System continues without BaseStation data if database unavailable
- **Connection Retry**: Automatic retry on connection failures
- **Logging**: Comprehensive error logging for troubleshooting

## Troubleshooting

### Common Issues

1. **Database Not Found**
   ```
   Error: Failed to connect to BaseStation database
   Solution: Verify baseStationDbPath points to valid BaseStation.sqb file
   ```

2. **Permission Denied**
   ```
   Error: EACCES: permission denied
   Solution: Ensure read permissions on BaseStation.sqb file
   ```

3. **Database Locked**
   ```
   Error: database is locked
   Solution: Ensure BaseStation application is not writing to database
   ```

### Performance Monitoring

Monitor BaseStation integration performance:

```javascript
const stats = await connector.execute('basestation:database', 'stats', {});
console.log('BaseStation Performance:', {
  enabled: stats.baseStation.enabled,
  connected: stats.baseStation.connected,
  registrySize: stats.baseStation.registrySize,
  cacheHitRate: stats.baseStation.cacheHitRate,
  queries: stats.baseStation.queries
});
```

## Integration with Other Systems

### Map Integration
Aircraft with registration data are automatically displayed on maps with enhanced information:

```javascript
// Aircraft elements on map include registration data
const aircraftElement = {
  type: 'aircraft',
  position: { lat: aircraft.lat, lon: aircraft.lon },
  properties: {
    icao24: aircraft.icao24,
    displayName: aircraft.displayName,
    registration: aircraft.registration,
    type: aircraft.type,
    manufacturer: aircraft.manufacturer,
    operator: aircraft.operator
  }
};
```

### Event System Integration
Enhanced aircraft events include registration data for better event processing:

```javascript
// Smart events can use registration data
connector.on('event:generated', (event) => {
  if (event.aircraft.registration) {
    console.log(`Event for ${event.aircraft.registration}: ${event.type}`);
  }
});
```

## Migration from Previous Version

### Automatic Migration
The integration is backward compatible. Existing configurations will work with BaseStation integration disabled by default.

### Enable Integration
To enable BaseStation integration, add to your connector configuration:

```json
{
  "config": {
    "enableBaseStationIntegration": true,
    "baseStationDbPath": "./aviationdata/BaseStation.sqb"
  }
}
```

### Verify Integration
Test the integration using the provided test script:

```bash
node test-adsb-basestation-integration.js
```

## Future Enhancements

### Planned Features
- **Historical Flight Data**: Integration with BaseStation flight history
- **Operator Analytics**: Operator-specific analytics and reporting
- **Fleet Management**: Fleet tracking and management capabilities
- **Advanced Filtering**: More sophisticated aircraft filtering options

### API Extensions
- **Bulk Operations**: Batch aircraft lookups and updates
- **Real-time Updates**: Live database updates and notifications
- **Custom Queries**: Support for custom SQL queries
- **Data Synchronization**: Sync with external aircraft databases 