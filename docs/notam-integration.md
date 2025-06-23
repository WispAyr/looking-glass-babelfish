# NOTAM Integration

## Overview

The NOTAM (Notice to Airmen) integration provides real-time access to aviation safety information with geospatial analysis and proximity alerts. This system is particularly integrated with the Prestwick Airport connector to automatically check for NOTAMs affecting aircraft operations.

## Features

### 🔍 **Geospatial Analysis**
- Query NOTAMs by location and radius
- Filter by category and priority
- Real-time proximity calculations
- Spatial visualization on maps

### ⚠️ **Proximity Alerts**
- Automatic NOTAM checking for aircraft operations
- Configurable alert thresholds
- Real-time notifications via Telegram
- Distance-based filtering

### 🕒 **Temporal Analysis**
- Track NOTAM validity periods
- Automatic expiration handling
- Time-based filtering and alerts
- Historical NOTAM analysis

### 📱 **Telegram Integration**
- Instant NOTAM alerts via Telegram
- Formatted messages with priority indicators
- Configurable notification settings
- Operation-specific alerts (approach, landing, takeoff)

## Architecture

### Components

1. **NOTAM Connector** (`connectors/types/NOTAMConnector.js`)
   - Fetches NOTAM data from UK NOTAM archive
   - Provides geospatial analysis capabilities
   - Manages NOTAM lifecycle and expiration

2. **Prestwick Airport Service** (`services/prestwickAirportService.js`)
   - Integrates with NOTAM connector
   - Checks NOTAMs for aircraft operations
   - Generates proximity alerts

3. **Prestwick Airport Connector** (`connectors/types/PrestwickAirportConnector.js`)
   - Orchestrates NOTAM checking for aircraft events
   - Sends Telegram notifications
   - Manages NOTAM configuration

### Data Flow

```
Aircraft Event → Prestwick Service → NOTAM Query → Alert Generation → Telegram Notification
```

## Configuration

### NOTAM Connector Configuration

```javascript
{
  "id": "notam-main",
  "type": "notam",
  "name": "UK NOTAM Data",
  "config": {
    "notamUrl": "https://github.com/Jonty/uk-notam-archive/blob/main/data/PIB.xml",
    "pollInterval": 1200000, // 20 minutes
    "ukBounds": {
      "north": 60.8604,
      "south": 49.1623,
      "east": 1.7633,
      "west": -8.6500
    }
  }
}
```

### Prestwick Airport NOTAM Configuration

```javascript
{
  "id": "prestwick-airport",
  "type": "prestwick-airport",
  "name": "Prestwick Airport",
  "config": {
    "prestwick": {
      "airportCode": "EGPK",
      "latitude": 55.5094,
      "longitude": -4.5867,
      "approachRadius": 50000
    },
    "notam": {
      "enabled": true,
      "searchRadius": 50,
      "checkOnApproach": true,
      "checkOnLanding": true,
      "checkOnTakeoff": true,
      "priorityThreshold": "medium"
    },
    "telegram": {
      "enabled": true,
      "chatId": "-1001242323336",
      "notifyNotams": true
    }
  }
}
```

## API Reference

### NOTAM Integration Capability

#### Operations

- `query_notams` - Query NOTAMs by location and criteria
- `check_notams` - Check specific NOTAM details
- `get_notam_alerts` - Get NOTAM alerts for aircraft operations
- `configure_notam_monitoring` - Configure NOTAM monitoring settings

#### Parameters

```javascript
// Query NOTAMs
{
  "radius": 50,                    // Search radius in km
  "category": "runway",           // NOTAM category filter
  "priority": "high",             // Priority filter
  "aircraftPosition": {           // Aircraft position
    "lat": 55.5094,
    "lon": -4.5867
  }
}

// Configure monitoring
{
  "enabled": true,                // Enable/disable NOTAM checking
  "searchRadius": 30,             // Search radius in km
  "checkOnApproach": true,        // Check on approach operations
  "checkOnLanding": true,         // Check on landing operations
  "checkOnTakeoff": true,         // Check on takeoff operations
  "priorityThreshold": "medium"   // Minimum priority for alerts
}
```

### Example Usage

```javascript
// Query NOTAMs around Prestwick
const notams = await prestwickConnector.executeCapability('notam:integration', 'query_notams', {
  radius: 50,
  category: null,
  priority: null,
  aircraftPosition: { lat: 55.5094, lon: -4.5867 }
});

// Configure NOTAM monitoring
const config = await prestwickConnector.executeCapability('notam:integration', 'configure_notam_monitoring', {
  enabled: true,
  searchRadius: 30,
  checkOnApproach: true,
  checkOnLanding: true,
  checkOnTakeoff: true,
  priorityThreshold: 'medium'
});
```

## NOTAM Categories

The system recognizes the following NOTAM categories:

- **runway** - Runway closures, maintenance, or restrictions
- **approach** - Approach procedure changes or restrictions
- **landing** - Landing restrictions or requirements
- **takeoff** - Takeoff restrictions or requirements
- **airport** - General airport operations
- **navigation** - Navigation aid changes or restrictions

## Priority Levels

- **high** - Critical safety information (red alerts)
- **medium** - Important operational information (yellow alerts)
- **low** - General information (green alerts)

## Telegram Notifications

### Message Format

NOTAM alerts are sent via Telegram with the following format:

```
🔴 NOTAM Alert - Prestwick Airport

🛬 APPROACH Operation

NOTAM: A1234/23
Title: Runway 12 Closure
Category: runway
Priority: HIGH
Distance: 5km

Description: Runway 12 closed for maintenance...

Time: 22/06/2025, 19:04:24
```

### Configuration

```javascript
{
  "telegram": {
    "enabled": true,
    "chatId": "-1001242323336",
    "notifyNotams": true
  }
}
```

## Testing

Run the NOTAM integration test:

```bash
node test-prestwick-notam-integration.js
```

This test demonstrates:
- NOTAM connector setup and connection
- Querying NOTAMs around Prestwick
- Checking NOTAMs for aircraft operations
- Configuring NOTAM monitoring
- Simulating aircraft events with NOTAM checking

## Monitoring and Statistics

The system tracks the following metrics:

- **notamQueries** - Number of NOTAM queries performed
- **notamAlerts** - Number of NOTAM alerts generated
- **lastActivity** - Timestamp of last activity

### Status Information

```javascript
const status = prestwickConnector.getStatus();
console.log({
  notamConnected: status.notamConnected,
  notamQueries: status.stats.notamQueries,
  notamAlerts: status.stats.notamAlerts,
  notamConfig: status.notamConfig
});
```

## Troubleshooting

### Common Issues

1. **NOTAM connector not found**
   - Ensure NOTAM connector is configured and running
   - Check connector registry for proper registration

2. **No NOTAM alerts received**
   - Verify NOTAM data is being fetched successfully
   - Check search radius and priority threshold settings
   - Ensure aircraft position data is accurate

3. **Telegram notifications not working**
   - Verify Telegram connector is connected
   - Check chat ID configuration
   - Ensure NOTAM notifications are enabled

### Debug Logging

Enable debug logging to troubleshoot NOTAM integration:

```javascript
// In your configuration
{
  "logging": {
    "level": "debug",
    "notam": true
  }
}
```

## Future Enhancements

- **Multi-airport support** - Extend to other airports beyond Prestwick
- **Advanced filtering** - More sophisticated NOTAM filtering options
- **Historical analysis** - Track NOTAM patterns over time
- **Integration with other aviation systems** - Connect with flight planning systems
- **Mobile alerts** - Push notifications for mobile devices 