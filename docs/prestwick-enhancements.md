# Prestwick Airport Connector Enhancements

## Overview
This document outlines the enhancements made to the Prestwick Airport Connector to address the user's requirements for aircraft database integration, alarm center rules, and airspace event emission.

## Changes Made

### 1. Aircraft Database Enhancement ✅

**Problem**: The Prestwick connector was not looking up aircraft in the database to enhance information.

**Solution**: 
- Added `AircraftDataService` integration to the Prestwick connector
- Created `enhanceAircraftData()` method that looks up aircraft registration data
- Enhanced aircraft information includes:
  - Registration number
  - Aircraft type
  - Manufacturer
  - Operator flag code
  - Serial number
  - Year built
  - Owner information
  - Country of registration

**Implementation**:
```javascript
// Enhanced aircraft data is now included in all notifications
const enhancedData = await this.enhanceAircraftData(processedData);
```

### 2. Alarm Center Rules for NOTAMs ✅

**Problem**: No specific rules for NOTAM alerts in the alarm center.

**Solution**:
- Added `notam-alert-telegram-rule` specifically for NOTAM alerts
- Rule only sends to Telegram (as requested)
- High priority notifications for NOTAM events
- Includes NOTAM number, priority, and operation type

**Rule Configuration**:
```javascript
{
  id: 'notam-alert-telegram-rule',
  name: 'NOTAM Alert - Telegram Only',
  conditions: {
    eventType: 'alarm:notification',
    source: 'prestwick-airport',
    data: { type: 'notam:alert' }
  },
  actions: [
    {
      type: 'send_notification',
      parameters: {
        message: '{{message}}',
        priority: 'high',
        channels: ['telegram'],
        parseMode: 'HTML'
      }
    }
  ]
}
```

### 3. Airspace Event Emission ✅

**Problem**: The Prestwick connector was not emitting airspace events related to EGPK.

**Solution**:
- Added `emitAirspaceEvent()` method for airspace boundary events
- Added `checkAirspaceBoundary()` method for boundary detection
- Added distance tracking for aircraft
- Emits events for:
  - Aircraft entering EGPK airspace
  - Aircraft exiting EGPK airspace
  - Aircraft in approach zone (within 10km)
  - Aircraft in terminal area (within 5km)

**Airspace Events**:
- `airspace:entered` - Aircraft enters EGPK control zone
- `airspace:exited` - Aircraft exits EGPK control zone
- `airspace:approach_zone` - Aircraft in approach zone
- `airspace:terminal_area` - Aircraft in terminal area

**Rule Added**:
```javascript
{
  id: 'airspace-events-rule',
  name: 'Airspace Events',
  conditions: {
    eventType: ['airspace:entered', 'airspace:exited', 'airspace:approach_zone', 'airspace:terminal_area'],
    source: 'prestwick-airport'
  }
}
```

### 4. Enhanced Notification Messages ✅

**Improvements**:
- Aircraft notifications now include enhanced database information
- Registration numbers, aircraft types, and manufacturer details
- Distance information for airspace events
- Better formatting and emoji usage

**Example Enhanced Message**:
```
🛬 <b>Approaching at Prestwick Airport (EGPK)</b>

Flight: <b>BA1234</b>
Registration: <b>G-ABCD</b>
Type: <b>Boeing 737-800</b>
ICAO24: <code>A12345</code>
Altitude: <b>2000ft</b>
Speed: <b>150kts</b>
Distance: <b>15km</b>

Time: <i>2025-01-20 14:30:00</i>
```

## Data Flow

### Current Flow:
```
ADSB Connector → Prestwick Connector → Alarm Center → Telegram
```

### Enhanced Flow:
```
ADSB Connector → Prestwick Connector → Aircraft Database Enhancement → Airspace Detection → Alarm Center → Telegram
```

## Statistics Tracking

The connector now tracks:
- `aircraftEnhanced` - Number of aircraft enhanced with database data
- `airspaceEvents` - Number of airspace boundary events emitted
- Enhanced aircraft information in all notifications

## Configuration

### Aircraft Data Service
```javascript
{
  "aircraftData": {
    "baseStationPath": "./aviationdata/BaseStation.sqb",
    "enableBaseStation": true,
    "enableTracking": true
  }
}
```

### Airspace Detection
- Approach radius: 50km (configurable)
- Approach zone: 10km
- Terminal area: 5km
- Distance tracking for boundary detection

## Testing

To test the enhancements:

1. **Aircraft Enhancement**:
   ```bash
   # Check if aircraft data is being enhanced
   curl http://localhost:3001/api/prestwick/aircraft/tracked
   ```

2. **Airspace Events**:
   ```bash
   # Monitor airspace events
   curl http://localhost:3001/api/events?type=airspace
   ```

3. **NOTAM Alerts**:
   ```bash
   # Test NOTAM alert rule
   curl http://localhost:3001/api/alarms/test
   ```

## Future Improvements

1. **Duplicate Rule Cleanup**: Remove redundant motion and smart detection rules
2. **Alarm Center Interface**: Fix issues with rule management interface
3. **Performance Optimization**: Cache frequently accessed aircraft data
4. **Additional Airspace Zones**: Add more granular airspace boundary detection

## Files Modified

- `connectors/types/PrestwickAirportConnector.js` - Main enhancements
- `config/defaultRules.js` - Added NOTAM and airspace rules
- `docs/prestwick-enhancements.md` - This documentation

## Conclusion

The Prestwick Airport Connector now:
- ✅ Enhances aircraft data with database information
- ✅ Has specific NOTAM alert rules for Telegram
- ✅ Emits airspace events for EGPK
- ✅ Provides enhanced notification messages
- ✅ Tracks comprehensive statistics

The system now provides a complete aircraft monitoring solution with enhanced data, proper alarm center integration, and comprehensive airspace event tracking. 