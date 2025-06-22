# APRS Connector

The APRS (Automatic Packet Reporting System) Connector integrates with the aprs.fi API to provide real-time tracking of UK amateur radio stations and weather data visualization on the map system.

## Overview

The APRS Connector fetches data from the aprs.fi API and provides:
- Real-time tracking of APRS stations within the UK
- Weather station data integration
- Map visualization with color-coded stations
- Station filtering and monitoring capabilities

## Features

### Station Tracking
- Tracks APRS stations by UK callsign prefixes (G*, M*, 2E*, etc.)
- Filters stations to UK geographic bounds
- Provides real-time position updates
- Tracks station status, course, speed, and altitude

### Weather Data
- Integrates weather station data from APRS
- Provides temperature, pressure, humidity, wind data
- Color-coded weather visualization on maps
- Real-time weather updates

### Map Visualization
- Automatic integration with the map system
- Color-coded station types:
  - Green: APRS stations
  - Blue: Weather stations  
  - Yellow: Items
  - Magenta: Objects
  - Red: Emergency stations
- Weather-based color coding for temperature conditions

### Message Monitoring
- Optional APRS text message monitoring
- Message history tracking
- Real-time message notifications

## Configuration

### Basic Configuration

```json
{
  "id": "aprs-main",
  "type": "aprs",
  "name": "APRS UK Tracking",
  "description": "APRS.fi API integration for UK amateur radio station tracking",
  "config": {
    "apiKey": "YOUR_APRS_API_KEY",
    "pollInterval": 30000,
    "ukBounds": {
      "north": 60.8604,
      "south": 49.1623,
      "east": 1.7633,
      "west": -8.6500
    }
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | required | APRS.fi API key |
| `pollInterval` | number | 30000 | Polling interval in milliseconds (5-300 seconds) |
| `ukBounds` | object | UK bounds | Geographic bounds for UK filtering |
| `enabled` | boolean | true | Enable/disable the connector |
| `autoConnect` | boolean | true | Automatically connect on startup |
| `enableWeatherData` | boolean | true | Enable weather data collection |
| `enableMessageMonitoring` | boolean | false | Enable message monitoring |
| `maxStations` | number | 1000 | Maximum number of stations to track |
| `stationFilter` | object | {} | Station filtering options |

### Station Filter Options

```json
{
  "stationFilter": {
    "activeOnly": true,
    "maxAgeHours": 24,
    "includeWeather": true,
    "includeMobile": true
  }
}
```

## API Key Setup

1. Visit [aprs.fi](https://aprs.fi/) and create an account
2. Go to "My account" settings
3. Copy your API key
4. Update the `apiKey` field in your connector configuration

## Capabilities

### aprs:tracking
- **Operations**: `read`, `subscribe`
- **Description**: Track APRS stations and their locations
- **Requires Connection**: Yes

### aprs:weather  
- **Operations**: `read`, `subscribe`
- **Description**: Access weather station data from APRS
- **Requires Connection**: Yes

### aprs:messages
- **Operations**: `read`, `subscribe`  
- **Description**: Monitor APRS text messages
- **Requires Connection**: Yes

### aprs:visualization
- **Operations**: `read`, `write`
- **Description**: Visualize APRS data on maps
- **Requires Connection**: No

## Usage Examples

### Get All Stations

```javascript
const stations = await connector.execute('aprs:tracking', 'read');
console.log(`Found ${stations.length} stations`);
```

### Get Active Stations Only

```javascript
const activeStations = await connector.execute('aprs:tracking', 'read', {
  active: true
});
console.log(`Found ${activeStations.length} active stations`);
```

### Get Weather Data

```javascript
const weather = await connector.execute('aprs:weather', 'read');
console.log(`Found ${weather.length} weather stations`);
```

### Get Visualization Data

```javascript
const vizData = await connector.execute('aprs:visualization', 'read');
console.log(`Stations: ${vizData.stations.length}, Weather: ${vizData.weather.length}`);
```

## Map Integration

The APRS connector automatically integrates with the map system:

1. **Automatic Registration**: Connector automatically registers with map connectors
2. **Real-time Updates**: Station and weather data updates are sent to maps in real-time
3. **Visual Elements**: Stations appear as colored markers on the map
4. **Weather Overlay**: Weather stations show temperature-based color coding

### Map Data Format

```javascript
{
  id: "aprs-G0RDI",
  type: "aprs-station", 
  name: "G0RDI",
  position: {
    lat: 55.5074,
    lng: -4.5933
  },
  properties: {
    symbol: "/#",
    comment: "Test station",
    lastSeen: "2024-01-01T12:00:00Z",
    course: 180,
    speed: 25,
    altitude: 100
  },
  style: {
    color: "#00ff00",
    size: 8,
    opacity: 0.8
  }
}
```

## Events

The connector emits various events for integration:

### Station Events
- `station:appeared` - New station detected
- `station:updated` - Station data updated
- `station:disappeared` - Station no longer visible

### Weather Events  
- `weather:updated` - Weather data updated
- `weather:alert` - Weather alert conditions

### Visualization Events
- `visualization:station` - Station data for map
- `visualization:weather` - Weather data for map

### Data Events
- `data:updated` - General data update
- `connection:status` - Connection status changes

## Testing

Run the test script to verify the connector:

```bash
node test-aprs-connector.js
```

This will:
- Test connector discovery and creation
- Validate configuration
- Test capability operations
- Verify map data formatting
- Check statistics and filtering

## Troubleshooting

### Common Issues

1. **API Key Invalid**
   - Ensure you have a valid API key from aprs.fi
   - Check the key is correctly set in configuration

2. **No Stations Found**
   - Verify UK bounds are correct
   - Check if stations are active within the time window
   - Ensure API rate limits aren't exceeded

3. **Map Not Showing Data**
   - Verify map connector is running
   - Check connector registration with map
   - Ensure visualization capability is enabled

4. **High API Usage**
   - Increase poll interval to reduce API calls
   - Implement caching if needed
   - Contact aprs.fi for rate limit increases

### Rate Limits

The aprs.fi API has rate limits:
- Free accounts: Limited requests per hour
- Paid accounts: Higher limits available
- Batch queries recommended for multiple stations

### Logging

Enable debug logging to troubleshoot:

```javascript
connector.setDebugMode(true);
```

## API Compliance

The connector follows aprs.fi API terms:
- Credits aprs.fi as data source
- Uses proper User-Agent header
- Respects rate limits
- Only requests data when needed
- Implements proper error handling

## Future Enhancements

- Message history and archiving
- Advanced filtering options
- Custom symbol mapping
- Integration with other radio systems
- Mobile station tracking
- Emergency alert system

## Support

For issues with the APRS connector:
1. Check the troubleshooting section
2. Review connector logs
3. Test with the provided test script
4. Verify API key and configuration

For aprs.fi API issues:
- Visit [aprs.fi API documentation](https://aprs.fi/page/api)
- Contact aprs.fi support
- Check API status and rate limits 