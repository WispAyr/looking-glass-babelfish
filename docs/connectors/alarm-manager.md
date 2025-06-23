# Alarm Manager Connector

## Overview

The Alarm Manager Connector provides centralized alarm management across all system components, offering multi-channel notifications, configurable alarm rules, and comprehensive alarm tracking. It serves as the central hub for all alarm-related activities in the Babelfish Looking Glass platform.

## Features

### 🚨 **Centralized Alarm Management**
- **Unified Alarm Handling**: Single point of control for all system alarms
- **Multi-Source Integration**: Collects alarms from all connectors and services
- **Alarm Categorization**: Organize alarms by severity, type, and source
- **Alarm History**: Comprehensive logging and analysis of all alarm activities

### 📢 **Multi-Channel Notifications**
- **Telegram Integration**: Instant notifications via Telegram bot
- **MQTT Publishing**: Real-time alarm broadcasts to MQTT topics
- **Email Notifications**: Configurable email alerts
- **Custom Channels**: Extensible notification system for custom integrations
- **Notification Templates**: Predefined message templates for different alarm types

### ⚙️ **Configurable Alarm Rules**
- **Rule Engine**: Flexible rule-based alarm generation
- **Conditional Logic**: Complex conditions for alarm triggering
- **Escalation Rules**: Automatic escalation based on time and severity
- **Suppression Rules**: Prevent alarm flooding with intelligent suppression
- **Time-Based Rules**: Schedule-based alarm activation

### 📊 **Alarm Management Interface**
- **Real-time Dashboard**: Live alarm status and management
- **Alarm Acknowledgment**: User acknowledgment and status tracking
- **Alarm Resolution**: Mark alarms as resolved with notes
- **Alarm Assignment**: Assign alarms to specific users or teams
- **Alarm Search**: Advanced search and filtering capabilities

## Configuration

### Basic Configuration
```json
{
  "id": "alarm-manager-main",
  "type": "alarm-manager",
  "name": "Main Alarm Manager",
  "description": "Centralized alarm management system",
  "config": {
    "enabled": true,
    "notificationChannels": {
      "telegram": {
        "enabled": true,
        "connectorId": "telegram-bot-main",
        "chatId": "-1001242323336"
      },
      "mqtt": {
        "enabled": true,
        "topic": "alarms/notifications",
        "qos": 1
      },
      "email": {
        "enabled": false,
        "smtp": {
          "host": "smtp.gmail.com",
          "port": 587,
          "secure": false
        },
        "from": "alarms@yourdomain.com",
        "to": ["admin@yourdomain.com"]
      }
    },
    "alarmRules": {
      "motion": {
        "enabled": true,
        "severity": "medium",
        "suppression": {
          "enabled": true,
          "window": 300000,
          "maxAlarms": 5
        }
      },
      "emergency": {
        "enabled": true,
        "severity": "critical",
        "escalation": {
          "enabled": true,
          "delay": 60000,
          "escalateTo": "high"
        }
      }
    },
    "retention": {
      "alarmHistory": 30,
      "acknowledgmentHistory": 90,
      "resolutionHistory": 365
    }
  },
  "capabilities": {
    "enabled": [
      "alarm:management",
      "alarm:notifications",
      "alarm:acknowledgment",
      "alarm:rules"
    ],
    "disabled": []
  }
}
```

### Advanced Configuration
```json
{
  "config": {
    "escalationPolicies": {
      "critical": {
        "levels": [
          {
            "delay": 0,
            "channels": ["telegram", "mqtt"],
            "message": "Critical alarm: {alarm.description}"
          },
          {
            "delay": 300000,
            "channels": ["telegram", "mqtt", "email"],
            "message": "CRITICAL ALARM ESCALATION: {alarm.description}"
          }
        ]
      },
      "high": {
        "levels": [
          {
            "delay": 0,
            "channels": ["telegram"],
            "message": "High priority alarm: {alarm.description}"
          }
        ]
      }
    },
    "suppressionRules": {
      "motion": {
        "window": 300000,
        "maxAlarms": 5,
        "groupBy": "source"
      },
      "system": {
        "window": 60000,
        "maxAlarms": 3,
        "groupBy": "type"
      }
    }
  }
}
```

## Capabilities

### Alarm Management
```javascript
// Create a new alarm
const alarm = await alarmManager.execute('alarm:management', 'create', {
  type: 'motion',
  severity: 'medium',
  source: 'camera-1',
  description: 'Motion detected in restricted area',
  data: {
    cameraId: 'camera-1',
    confidence: 0.85,
    location: { lat: 55.5074, lon: -4.5933 }
  }
});

// Get alarm by ID
const alarm = await alarmManager.execute('alarm:management', 'get', {
  alarmId: 'alarm-123'
});

// List alarms with filters
const alarms = await alarmManager.execute('alarm:management', 'list', {
  severity: ['critical', 'high'],
  status: 'active',
  source: 'camera-1',
  limit: 50
});
```

### Alarm Notifications
```javascript
// Send notification for alarm
await alarmManager.execute('alarm:notifications', 'send', {
  alarmId: 'alarm-123',
  channels: ['telegram', 'mqtt'],
  message: 'Custom notification message'
});

// Configure notification channels
await alarmManager.execute('alarm:notifications', 'configure', {
  channel: 'telegram',
  enabled: true,
  settings: {
    chatId: '-1001242323336',
    parseMode: 'HTML'
  }
});
```

### Alarm Acknowledgment
```javascript
// Acknowledge an alarm
await alarmManager.execute('alarm:acknowledgment', 'acknowledge', {
  alarmId: 'alarm-123',
  userId: 'user-456',
  notes: 'Investigating the issue'
});

// Resolve an alarm
await alarmManager.execute('alarm:acknowledgment', 'resolve', {
  alarmId: 'alarm-123',
  userId: 'user-456',
  resolution: 'Issue resolved - false alarm',
  notes: 'Motion was caused by wildlife'
});
```

### Alarm Rules
```javascript
// Create a new alarm rule
await alarmManager.execute('alarm:rules', 'create', {
  name: 'emergency-squawk',
  enabled: true,
  conditions: {
    eventType: 'emergency:squawk',
    severity: 'critical'
  },
  actions: {
    createAlarm: true,
    notifyChannels: ['telegram', 'mqtt'],
    escalation: {
      enabled: true,
      delay: 30000
    }
  }
});

// List alarm rules
const rules = await alarmManager.execute('alarm:rules', 'list', {
  enabled: true
});
```

## Event Integration

### Subscribing to Events
```javascript
// Subscribe to motion events
alarmManager.eventBus.subscribe('motion', (event) => {
  alarmManager.processMotionEvent(event);
});

// Subscribe to emergency squawk events
alarmManager.eventBus.subscribe('emergency:squawk', (event) => {
  alarmManager.processEmergencySquawkEvent(event);
});

// Subscribe to system health events
alarmManager.eventBus.subscribe('system:health', (event) => {
  alarmManager.processSystemHealthEvent(event);
});
```

### Event Processing
```javascript
async processMotionEvent(event) {
  // Check if alarm should be created
  const shouldCreateAlarm = await this.evaluateAlarmRule('motion', event);
  
  if (shouldCreateAlarm) {
    const alarm = await this.createAlarm({
      type: 'motion',
      severity: 'medium',
      source: event.source,
      description: `Motion detected on ${event.data.device}`,
      data: event.data
    });
    
    // Send notifications
    await this.sendNotifications(alarm);
  }
}

async processEmergencySquawkEvent(event) {
  const alarm = await this.createAlarm({
    type: 'emergency:squawk',
    severity: 'critical',
    source: event.source,
    description: `Emergency squawk code: ${event.data.squawk}`,
    data: event.data
  });
  
  // Immediate notification for emergency
  await this.sendNotifications(alarm, ['telegram', 'mqtt']);
}
```

## API Endpoints

### Alarm Management
```http
# Create alarm
POST /alarms
{
  "type": "motion",
  "severity": "medium",
  "source": "camera-1",
  "description": "Motion detected",
  "data": { ... }
}

# Get alarm
GET /alarms/{alarmId}

# List alarms
GET /alarms?severity=critical&status=active&limit=50

# Update alarm
PUT /alarms/{alarmId}
{
  "status": "acknowledged",
  "notes": "Investigating"
}

# Delete alarm
DELETE /alarms/{alarmId}
```

### Alarm Acknowledgment
```http
# Acknowledge alarm
POST /alarms/{alarmId}/acknowledge
{
  "userId": "user-456",
  "notes": "Investigating the issue"
}

# Resolve alarm
POST /alarms/{alarmId}/resolve
{
  "userId": "user-456",
  "resolution": "Issue resolved",
  "notes": "False alarm"
}
```

### Alarm Rules
```http
# Create rule
POST /alarms/rules
{
  "name": "emergency-squawk",
  "enabled": true,
  "conditions": { ... },
  "actions": { ... }
}

# List rules
GET /alarms/rules

# Update rule
PUT /alarms/rules/{ruleId}
{
  "enabled": false
}

# Delete rule
DELETE /alarms/rules/{ruleId}
```

## Integration Examples

### UniFi Protect Integration
```javascript
// In UniFi Protect connector
this.eventBus.subscribe('motion', (event) => {
  // Create alarm for motion events
  this.alarmManager.execute('alarm:management', 'create', {
    type: 'motion',
    severity: 'medium',
    source: event.device,
    description: `Motion detected on camera ${event.device}`,
    data: event
  });
});
```

### ADSB Integration
```javascript
// In ADSB connector
this.eventBus.subscribe('emergency:squawk', (event) => {
  // Create critical alarm for emergency squawk codes
  this.alarmManager.execute('alarm:management', 'create', {
    type: 'emergency:squawk',
    severity: 'critical',
    source: event.aircraft,
    description: `Emergency squawk code ${event.squawk} from ${event.aircraft}`,
    data: event
  });
});
```

### Prestwick Airport Integration
```javascript
// In Prestwick Airport connector
this.eventBus.subscribe('aircraft:approach', (event) => {
  // Create alarm for aircraft approaching
  this.alarmManager.execute('alarm:management', 'create', {
    type: 'aircraft:approach',
    severity: 'low',
    source: event.aircraft,
    description: `Aircraft ${event.callsign} approaching EGPK`,
    data: event
  });
});
```

## Testing

### Unit Tests
```javascript
describe('Alarm Manager Connector', () => {
  let alarmManager;
  
  beforeEach(() => {
    alarmManager = new AlarmManagerConnector({
      enabled: true,
      notificationChannels: {
        telegram: { enabled: true }
      }
    });
  });
  
  test('should create alarm', async () => {
    const alarm = await alarmManager.execute('alarm:management', 'create', {
      type: 'test',
      severity: 'medium',
      description: 'Test alarm'
    });
    
    expect(alarm.id).toBeDefined();
    expect(alarm.status).toBe('active');
  });
  
  test('should send notifications', async () => {
    const alarm = await alarmManager.execute('alarm:management', 'create', {
      type: 'test',
      severity: 'critical',
      description: 'Test alarm'
    });
    
    await alarmManager.execute('alarm:notifications', 'send', {
      alarmId: alarm.id,
      channels: ['telegram']
    });
    
    // Verify notification was sent
  });
});
```

### Integration Tests
```javascript
describe('Alarm Manager Integration', () => {
  test('should process motion events', async () => {
    const alarmManager = new AlarmManagerConnector(config);
    const unifiConnector = new UniFiProtectConnector(config);
    
    await alarmManager.connect();
    await unifiConnector.connect();
    
    // Simulate motion event
    unifiConnector.eventBus.publishEvent('motion', {
      device: 'camera-1',
      confidence: 0.85
    });
    
    // Verify alarm was created
    const alarms = await alarmManager.execute('alarm:management', 'list', {
      type: 'motion'
    });
    
    expect(alarms.length).toBeGreaterThan(0);
  });
});
```

## Performance Considerations

### Alarm Suppression
- **Time-based suppression**: Prevent alarm flooding within time windows
- **Source-based grouping**: Group alarms by source to reduce duplicates
- **Type-based suppression**: Suppress alarms of the same type
- **Configurable thresholds**: Adjust suppression parameters per alarm type

### Notification Optimization
- **Batch notifications**: Group multiple alarms in single notifications
- **Channel prioritization**: Send to high-priority channels first
- **Retry logic**: Automatic retry for failed notifications
- **Rate limiting**: Prevent notification spam

### Database Optimization
- **Indexed queries**: Fast alarm retrieval and filtering
- **Partitioned storage**: Separate active and historical alarms
- **Cleanup jobs**: Automatic cleanup of old alarm data
- **Compression**: Compress historical alarm data

## Security

### Access Control
- **User-based acknowledgment**: Track who acknowledged alarms
- **Role-based permissions**: Different access levels for alarm management
- **Audit logging**: Complete audit trail of alarm activities
- **API authentication**: Secure API access with authentication

### Data Protection
- **Encrypted storage**: Encrypt sensitive alarm data
- **Secure notifications**: Secure transmission of alarm notifications
- **Data retention**: Configurable data retention policies
- **Privacy compliance**: GDPR and privacy regulation compliance

## Troubleshooting

### Common Issues

#### Alarms Not Being Created
- Check alarm rules configuration
- Verify event subscriptions
- Check connector connectivity
- Review alarm suppression settings

#### Notifications Not Sending
- Verify notification channel configuration
- Check connector dependencies (Telegram, MQTT)
- Review notification templates
- Check rate limiting settings

#### Performance Issues
- Review alarm suppression rules
- Check database performance
- Monitor notification queue
- Review cleanup job schedules

### Debug Commands
```javascript
// Enable debug logging
alarmManager.setLogLevel('debug');

// Check alarm manager status
const status = await alarmManager.execute('alarm:management', 'status');

// Test notification channels
await alarmManager.execute('alarm:notifications', 'test', {
  channel: 'telegram',
  message: 'Test notification'
});

// List active alarms
const activeAlarms = await alarmManager.execute('alarm:management', 'list', {
  status: 'active'
});
```

## Future Enhancements

### Planned Features
1. **Advanced Analytics**: Alarm trend analysis and reporting
2. **Machine Learning**: Predictive alarm analysis
3. **Mobile App**: Mobile alarm management interface
4. **Webhook Integration**: Custom webhook notifications
5. **Alarm Correlation**: Intelligent alarm correlation and grouping

### Scalability Improvements
1. **Distributed Architecture**: Multi-node alarm management
2. **Database Clustering**: High-availability database setup
3. **Message Queuing**: Asynchronous alarm processing
4. **Load Balancing**: Distribute alarm processing load

---

The Alarm Manager Connector provides a robust foundation for centralized alarm management, enabling organizations to effectively monitor, respond to, and track all system events through a unified interface. 