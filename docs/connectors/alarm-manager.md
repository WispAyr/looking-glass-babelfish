# Alarm Manager Connector

## Overview

The Alarm Manager Connector is a comprehensive rule-based alarm system that processes events from all connectors and triggers appropriate actions based on configurable rules. It manages 27 pre-configured rules covering security, aviation, system monitoring, and analytics.

## Features

### Rule Management
- **27 Pre-configured Rules**: Comprehensive set of rules for various system events
- **Visual Rule Editor**: Modern web interface for creating and editing rules
- **Rule Testing**: Test rules with sample events to verify behavior
- **Import/Export**: Backup and restore rule configurations
- **Real-time Updates**: Live rule status and statistics

### Event Processing
- **Multi-source Events**: Processes events from UniFi Protect, ADSB, speed calculation, and more
- **Condition Matching**: Flexible event type and source filtering
- **Action Execution**: Send notifications, publish MQTT messages, log events
- **Template Interpolation**: Dynamic message generation with event data

### Notification Channels
- **Telegram**: Real-time notifications via Telegram bot
- **MQTT**: Publish events to MQTT topics
- **Web GUI**: Display notifications in web interface
- **Logging**: Structured logging of all events

## Web Interface

Access the alarm manager at `/alarms` to get a comprehensive view of all rules and their status.

### Features
- **Dashboard**: Overview of rule statistics and system status
- **Rule Grid**: Visual display of all rules with filtering and search
- **Rule Editor**: Modal-based editor for creating and modifying rules
- **Real-time Testing**: Test rules with custom event data
- **Bulk Operations**: Import/export rule sets

### Filtering Options
- **Category**: Security, Aviation, System, Analytics, MQTT, General
- **Connector Type**: UniFi Protect, ADSB, Speed Calculation, System, General
- **Status**: Enabled/Disabled rules
- **Search**: Text search across rule names, descriptions, and IDs

## Rule Structure

Each rule follows this structure:

```javascript
{
  id: "unique-rule-id",
  name: "Human Readable Name",
  description: "Rule description",
  conditions: {
    eventType: "event-type",
    source: "connector-source",
    severity: "low|medium|high"
  },
  actions: [
    {
      type: "send_notification|mqtt_publish|log_event",
      parameters: {
        // Action-specific parameters
      }
    }
  ],
  metadata: {
    category: "security|aviation|system|analytics|mqtt|general",
    connectorType: "unifi-protect|adsb|speed-calculation|system|general",
    version: "1.0.0",
    createdAt: "2025-06-23T00:00:00.000Z"
  },
  enabled: true
}
```

## Pre-configured Rules

### Security Rules (6 rules)
- Motion detection alerts
- Smart detection zone monitoring
- Intrusion detection
- Camera status monitoring

### Aviation Rules (6 rules)
- Aircraft emergency alerts
- ADSB status monitoring
- Aircraft tracking events
- Aviation system health

### System Rules (3 rules)
- System health monitoring
- Connector status alerts
- Error event handling

### Analytics Rules (2 rules)
- Speed violation detection
- Performance monitoring

### MQTT Rules (1 rule)
- Camera events to MQTT routing

### General Rules (9 rules)
- Default notifications
- Logging rules
- Monitoring rules

## API Endpoints

### Rule Management
- `GET /alarms/api` - List all rules (with filtering)
- `GET /alarms/api/:id` - Get specific rule
- `POST /alarms/api` - Create new rule
- `PUT /alarms/api/:id` - Update rule
- `DELETE /alarms/api/:id` - Delete rule

### Rule Operations
- `POST /alarms/api/toggle` - Enable/disable rule
- `POST /alarms/api/test` - Test rule with event data
- `POST /alarms/api/import` - Import rules from JSON
- `GET /alarms/api/export` - Export all rules to JSON

### Statistics
- `GET /alarms/api/stats` - Get rule statistics
- `GET /alarms/api/history` - Get alarm history

## Configuration

The Alarm Manager Connector is configured in `config/connectors.json`:

```json
{
  "id": "alarm-manager-main",
  "type": "alarm-manager",
  "name": "Main Alarm Manager",
  "config": {
    "defaultChatId": "your-telegram-chat-id"
  }
}
```

## Event Types

The connector listens for these event types:
- `motion` - Motion detection events
- `smartDetectZone` - Smart detection zone events
- `smartDetectLine` - Smart detection line events
- `aircraft:detected` - Aircraft detection events
- `aircraft:emergency` - Emergency aircraft events
- `adsb:status` - ADSB system status
- `speed:violation` - Speed violation events
- `system:health` - System health events
- `connector:status` - Connector status changes
- And many more...

## Usage Examples

### Creating a New Rule
```javascript
const rule = {
  name: "Custom Motion Alert",
  description: "Alert for motion on specific camera",
  conditions: {
    eventType: "motion",
    source: "unifi-protect-websocket"
  },
  actions: [
    {
      type: "send_notification",
      parameters: {
        message: "Motion detected on camera {{deviceId}}",
        priority: "medium",
        channels: ["telegram", "gui"]
      }
    }
  ],
  metadata: {
    category: "security",
    connectorType: "unifi-protect"
  },
  enabled: true
};

await alarmManager.execute('alarm:management', 'create', rule);
```

### Testing a Rule
```javascript
const testResult = await alarmManager.execute('alarm:management', 'test', {
  ruleId: 'rule-id',
  eventData: {
    type: 'motion',
    source: 'unifi-protect-websocket',
    data: { deviceId: 'camera-1' }
  }
});

console.log('Would match:', testResult.wouldMatch);
```

### Getting Statistics
```javascript
const stats = await alarmManager.execute('alarm:management', 'stats');
console.log('Total rules:', stats.total);
console.log('Enabled rules:', stats.enabled);
console.log('By category:', stats.byCategory);
```

## Troubleshooting

### Common Issues

1. **Rules not loading**: Check that `config/defaultRules.js` exists and exports an array
2. **Notifications not sending**: Verify Telegram and MQTT connectors are configured
3. **Events not matching**: Check event type and source in rule conditions
4. **GUI not updating**: Ensure WebSocket connections are working

### Debug Mode

Enable debug logging to see detailed event processing:

```javascript
// In your application startup
process.env.DEBUG = 'alarm-manager:*';
```

## Future Enhancements

- **Visual Flow Builder**: Drag-and-drop rule creation
- **Advanced Conditions**: Time-based, geographic, and complex logic
- **Rule Templates**: Pre-built rule templates for common scenarios
- **Performance Analytics**: Rule execution metrics and optimization
- **Mobile App**: Native mobile notifications and management

The Alarm Manager Connector provides a robust foundation for centralized alarm management, enabling organizations to effectively monitor, respond to, and track all system events through a unified interface. 