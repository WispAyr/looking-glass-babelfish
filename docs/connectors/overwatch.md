# Overwatch Connector

## Overview

The Overwatch Connector is the central event processing and orchestration system for the Looking Glass platform. It provides comprehensive event management, flow orchestration, rule engine capabilities, and system health monitoring.

## Features

### Event Processing
- **Event Enhancement**: Automatically enhances events with metadata, categories, and priorities
- **Event Filtering**: Advanced filtering capabilities with multiple criteria
- **Event Routing**: Intelligent routing of events to appropriate handlers
- **Event Deduplication**: Prevents duplicate event processing
- **Event History**: Maintains comprehensive event history with configurable retention

### Flow Orchestration
- **Flow Management**: Create, edit, enable, and disable automation flows
- **Flow Execution**: Execute complex multi-step workflows
- **Flow Monitoring**: Real-time monitoring of flow execution
- **Flow Statistics**: Track flow performance and success rates
- **Auto-generation**: Automatically generate flows for new event types

### Rule Engine
- **Complex Conditions**: Support for multiple condition types and operators
- **Action Execution**: Execute multiple actions per rule
- **Rule Chaining**: Chain rules together for complex workflows
- **Performance Optimization**: Efficient rule matching and execution
- **Rule Templates**: Pre-built rule templates for common scenarios

### System Health Monitoring
- **Connector Health**: Monitor health of all connected connectors
- **System Metrics**: Track system performance and resource usage
- **Alert Management**: Generate and manage system alerts
- **Performance Monitoring**: Monitor response times and throughput
- **Resource Tracking**: Track memory, CPU, and network usage

## Configuration

### Basic Configuration
```json
{
  "id": "overwatch",
  "type": "overwatch",
  "name": "Event Orchestration System",
  "description": "Central event processing and orchestration",
  "config": {
    "enableEventProcessing": true,
    "enableFlowOrchestration": true,
    "enableRuleEngine": true,
    "maxEvents": 1000,
    "processingInterval": 100,
    "eventRetentionHours": 24,
    "healthCheckInterval": 30000,
    "autoConnect": true,
    "defaultConnectors": ["unifi-protect", "adsb", "aprs"]
  }
}
```

### Advanced Configuration
```json
{
  "id": "overwatch-advanced",
  "type": "overwatch",
  "name": "Advanced Overwatch System",
  "config": {
    "enableEventProcessing": true,
    "enableFlowOrchestration": true,
    "enableRuleEngine": true,
    "maxEvents": 5000,
    "processingInterval": 50,
    "eventRetentionHours": 72,
    "healthCheckInterval": 15000,
    "autoConnect": true,
    "defaultConnectors": ["unifi-protect", "adsb", "aprs", "mqtt", "telegram"],
    "eventFilterPresets": {
      "all": {
        "name": "All Events",
        "description": "Show all events from all connectors",
        "filters": {}
      },
      "security": {
        "name": "Security Events",
        "description": "Show security-related events only",
        "filters": {
          "eventType": ["motion", "smartDetect", "loitering", "intrusion"],
          "priority": ["high", "critical"]
        }
      },
      "aircraft": {
        "name": "Aircraft Events",
        "description": "Show aircraft-related events only",
        "filters": {
          "source": ["adsb"],
          "eventType": ["aircraft:detected", "aircraft:emergency", "aircraft:zone"]
        }
      },
      "system": {
        "name": "System Events",
        "description": "Show system health and status events",
        "filters": {
          "eventType": ["system:status", "connector:status", "health:check"]
        }
      }
    },
    "flowTemplates": {
      "motion-to-telegram": {
        "name": "Motion to Telegram",
        "description": "Send motion events to Telegram",
        "triggers": ["motion"],
        "actions": ["telegram:send"],
        "conditions": {
          "confidence": { "operator": ">=", "value": 0.5 }
        }
      },
      "emergency-aircraft": {
        "name": "Emergency Aircraft Alert",
        "description": "Alert on emergency aircraft",
        "triggers": ["aircraft:emergency"],
        "actions": ["telegram:send", "mqtt:publish"],
        "conditions": {
          "squawk": { "operator": "in", "value": ["7500", "7600", "7700"] }
        }
      }
    }
  }
}
```

## Capabilities

### Event Processing Capabilities
- `overwatch:events` - Event processing and enhancement
- `overwatch:filtering` - Event filtering and routing
- `overwatch:history` - Event history management
- `overwatch:metrics` - Event metrics and statistics

### Flow Management Capabilities
- `overwatch:flows` - Flow orchestration and management
- `overwatch:flow:templates` - Flow template management
- `overwatch:flow:execution` - Flow execution and monitoring
- `overwatch:flow:statistics` - Flow performance statistics

### Rule Engine Capabilities
- `overwatch:rules` - Rule engine and automation
- `overwatch:rule:templates` - Rule template management
- `overwatch:rule:execution` - Rule execution and monitoring
- `overwatch:rule:statistics` - Rule performance statistics

### System Management Capabilities
- `overwatch:health` - System health monitoring
- `overwatch:connectors` - Connector status management
- `overwatch:system` - System metrics and monitoring
- `overwatch:alerts` - Alert generation and management

## API Reference

### Event Management

#### Get Event Stream
```bash
GET /api/overwatch/events/stream
```
Returns a Server-Sent Events stream of real-time events.

#### Get Event History
```bash
GET /api/overwatch/events/history?limit=100&filter=security
```
Returns historical events with optional filtering.

#### Set Event Filter
```bash
POST /api/overwatch/events/filter
{
  "filters": {
    "eventType": ["motion", "smartDetect"],
    "priority": ["high", "critical"],
    "source": ["unifi-protect"]
  }
}
```

### Flow Management

#### List Flows
```bash
GET /api/overwatch/flows
```
Returns all configured flows.

#### Create Flow
```bash
POST /api/overwatch/flows
{
  "name": "Motion Alert Flow",
  "description": "Send motion alerts to Telegram",
  "triggers": ["motion"],
  "actions": [
    {
      "type": "telegram:send",
      "parameters": {
        "chatId": "123456789",
        "message": "Motion detected on camera {{device}}"
      }
    }
  ],
  "conditions": {
    "confidence": { "operator": ">=", "value": 0.5 }
  }
}
```

#### Update Flow
```bash
PUT /api/overwatch/flows/{flowId}
{
  "enabled": true,
  "actions": [
    {
      "type": "telegram:send",
      "parameters": {
        "chatId": "123456789",
        "message": "Motion detected on camera {{device}} at {{timestamp}}"
      }
    }
  ]
}
```

#### Execute Flow
```bash
POST /api/overwatch/flows/{flowId}/execute
{
  "event": {
    "type": "motion",
    "device": "camera-1",
    "confidence": 0.8
  }
}
```

### Rule Management

#### List Rules
```bash
GET /api/overwatch/rules
```
Returns all configured rules.

#### Create Rule
```bash
POST /api/overwatch/rules
{
  "name": "High Confidence Motion",
  "description": "Rule for high confidence motion events",
  "conditions": {
    "eventType": "motion",
    "confidence": { "operator": ">=", "value": 0.8 }
  },
  "actions": [
    {
      "type": "telegram:send",
      "parameters": {
        "chatId": "123456789",
        "message": "High confidence motion detected!"
      }
    }
  ]
}
```

### System Health

#### Get System Health
```bash
GET /api/overwatch/health
```
Returns overall system health status.

#### Get Connector Health
```bash
GET /api/overwatch/health/connectors
```
Returns health status of all connectors.

#### Get System Metrics
```bash
GET /api/overwatch/metrics
```
Returns system performance metrics.

## Event Enhancement

The Overwatch Connector automatically enhances events with additional metadata:

### Motion Events
```javascript
{
  "type": "motion",
  "source": "unifi-protect",
  "data": {
    "device": "camera-1",
    "start": 1640995200000,
    "end": 1640995260000
  },
  "enhanced": {
    "category": "security",
    "priority": "normal",
    "duration": 60,
    "snapshotUrl": "https://host/snapshot/camera-1/1640995200000",
    "thumbnailUrl": "https://host/thumbnail/camera-1/1640995200000",
    "metadata": {
      "connectorType": "unifi-protect",
      "eventType": "motion",
      "timestamp": "2022-01-01T12:00:00.000Z",
      "processed": true
    }
  }
}
```

### Aircraft Events
```javascript
{
  "type": "aircraft:detected",
  "source": "adsb",
  "data": {
    "icao24": "a1b2c3",
    "callsign": "BA123",
    "altitude": 35000,
    "speed": 450,
    "squawk": "1234"
  },
  "enhanced": {
    "category": "aircraft",
    "priority": "normal",
    "isEmergency": false,
    "metadata": {
      "connectorType": "adsb",
      "eventType": "aircraft:detected",
      "timestamp": "2022-01-01T12:00:00.000Z",
      "processed": true
    }
  }
}
```

### Emergency Aircraft Events
```javascript
{
  "type": "aircraft:emergency",
  "source": "adsb",
  "data": {
    "icao24": "a1b2c3",
    "callsign": "BA123",
    "squawk": "7700"
  },
  "enhanced": {
    "category": "aircraft",
    "priority": "critical",
    "isEmergency": true,
    "emergencyType": "general",
    "metadata": {
      "connectorType": "adsb",
      "eventType": "aircraft:emergency",
      "timestamp": "2022-01-01T12:00:00.000Z",
      "processed": true
    }
  }
}
```

## Flow Templates

### Motion to Telegram Flow
```json
{
  "name": "Motion to Telegram",
  "description": "Send motion events to Telegram",
  "triggers": ["motion"],
  "actions": [
    {
      "type": "telegram:send",
      "parameters": {
        "chatId": "{{config.telegram.chatId}}",
        "message": "🚨 Motion detected on camera {{device}}\n\n📅 Time: {{timestamp}}\n🎯 Confidence: {{confidence}}%\n📍 Location: {{location}}",
        "parseMode": "HTML"
      }
    }
  ],
  "conditions": {
    "confidence": { "operator": ">=", "value": 0.5 }
  }
}
```

### Emergency Aircraft Alert Flow
```json
{
  "name": "Emergency Aircraft Alert",
  "description": "Alert on emergency aircraft",
  "triggers": ["aircraft:emergency"],
  "actions": [
    {
      "type": "telegram:send",
      "parameters": {
        "chatId": "{{config.telegram.chatId}}",
        "message": "🚨 EMERGENCY AIRCRAFT DETECTED\n\n✈️ Callsign: {{callsign}}\n🆘 Squawk: {{squawk}}\n📍 Position: {{lat}}, {{lon}}\n🛩️ Altitude: {{altitude}}ft\n💨 Speed: {{speed}}kts",
        "parseMode": "HTML"
      }
    },
    {
      "type": "mqtt:publish",
      "parameters": {
        "topic": "aircraft/emergency",
        "message": {
          "icao24": "{{icao24}}",
          "callsign": "{{callsign}}",
          "squawk": "{{squawk}}",
          "timestamp": "{{timestamp}}"
        }
      }
    }
  ],
  "conditions": {
    "squawk": { "operator": "in", "value": ["7500", "7600", "7700"] }
  }
}
```

### Speed Violation Alert Flow
```json
{
  "name": "Speed Violation Alert",
  "description": "Alert on speed violations",
  "triggers": ["speed:violation"],
  "actions": [
    {
      "type": "telegram:send",
      "parameters": {
        "chatId": "{{config.telegram.chatId}}",
        "message": "🚗 SPEED VIOLATION DETECTED\n\n🚙 Plate: {{plateNumber}}\n⚡ Speed: {{speed}} km/h\n📏 Limit: {{speedLimit}} km/h\n📍 Location: {{location}}\n📅 Time: {{timestamp}}",
        "parseMode": "HTML"
      }
    }
  ],
  "conditions": {
    "speed": { "operator": ">", "value": 100 }
  }
}
```

## Rule Templates

### High Confidence Motion Rule
```json
{
  "name": "High Confidence Motion",
  "description": "Rule for high confidence motion events",
  "conditions": {
    "eventType": "motion",
    "confidence": { "operator": ">=", "value": 0.8 }
  },
  "actions": [
    {
      "type": "telegram:send",
      "parameters": {
        "chatId": "{{config.telegram.chatId}}",
        "message": "🔍 High confidence motion detected on {{device}}"
      }
    }
  ]
}
```

### Connector Status Rule
```json
{
  "name": "Connector Status Alert",
  "description": "Alert when connector status changes",
  "conditions": {
    "eventType": "connector:status",
    "status": { "operator": "!=", "value": "connected" }
  },
  "actions": [
    {
      "type": "telegram:send",
      "parameters": {
        "chatId": "{{config.telegram.chatId}}",
        "message": "⚠️ Connector {{connectorId}} status: {{status}}"
      }
    }
  ]
}
```

## Health Monitoring

### System Health Check
```javascript
{
  "healthy": true,
  "checks": {
    "eventProcessing": {
      "healthy": true,
      "details": {
        "eventsPerSecond": 15.2,
        "queueSize": 23,
        "processingTime": 45
      }
    },
    "flowExecution": {
      "healthy": true,
      "details": {
        "activeFlows": 5,
        "flowsPerSecond": 2.1,
        "successRate": 0.98
      }
    },
    "ruleEngine": {
      "healthy": true,
      "details": {
        "activeRules": 12,
        "rulesPerSecond": 8.5,
        "successRate": 0.99
      }
    },
    "connectors": {
      "healthy": true,
      "details": {
        "totalConnectors": 8,
        "connectedConnectors": 7,
        "failedConnectors": 1
      }
    }
  },
  "timestamp": "2022-01-01T12:00:00.000Z",
  "uptime": 86400000
}
```

### Connector Health Status
```javascript
{
  "connectors": {
    "unifi-protect": {
      "healthy": true,
      "status": "connected",
      "lastSeen": "2022-01-01T12:00:00.000Z",
      "responseTime": 125,
      "errorRate": 0.01
    },
    "adsb": {
      "healthy": true,
      "status": "connected",
      "lastSeen": "2022-01-01T12:00:00.000Z",
      "responseTime": 89,
      "errorRate": 0.005
    },
    "aprs": {
      "healthy": false,
      "status": "disconnected",
      "lastSeen": "2022-01-01T11:45:00.000Z",
      "error": "Connection timeout"
    }
  }
}
```

## Performance Optimization

### Event Processing Optimization
- **Batch Processing**: Process events in batches for better throughput
- **Parallel Processing**: Use worker threads for event processing
- **Memory Management**: Implement efficient memory usage patterns
- **Database Optimization**: Use indexes and efficient queries

### Flow Execution Optimization
- **Caching**: Cache frequently used flow configurations
- **Lazy Loading**: Load flow definitions on demand
- **Connection Pooling**: Reuse connections for external services
- **Timeout Management**: Implement proper timeout handling

### Rule Engine Optimization
- **Rule Indexing**: Index rules for faster matching
- **Condition Optimization**: Optimize condition evaluation
- **Action Batching**: Batch similar actions together
- **Error Recovery**: Implement robust error recovery mechanisms

## Troubleshooting

### Common Issues

#### High Event Queue Size
**Symptoms**: Events are not being processed quickly enough
**Solutions**:
- Increase `processingInterval` in configuration
- Add more worker threads
- Optimize event processing logic
- Check for slow external service calls

#### Flow Execution Failures
**Symptoms**: Flows are not executing or failing
**Solutions**:
- Check flow configuration syntax
- Verify action parameters
- Check external service connectivity
- Review flow execution logs

#### Rule Engine Performance
**Symptoms**: Slow rule evaluation
**Solutions**:
- Optimize rule conditions
- Use rule indexing
- Reduce number of active rules
- Cache rule evaluation results

### Debug Mode
Enable debug logging for detailed troubleshooting:

```json
{
  "config": {
    "debug": true,
    "logLevel": "debug",
    "enableEventLogging": true,
    "enableFlowLogging": true,
    "enableRuleLogging": true
  }
}
```

### Health Monitoring
Monitor system health through the API:

```bash
# Get overall health
GET /api/overwatch/health

# Get detailed metrics
GET /api/overwatch/metrics

# Get connector status
GET /api/overwatch/health/connectors

# Get event statistics
GET /api/overwatch/events/stats
```

## Integration Examples

### UniFi Protect Integration
```javascript
// Subscribe to motion events from UniFi Protect
overwatchConnector.eventBus.subscribe('motion', (event) => {
  if (event.source === 'unifi-protect') {
    // Process motion event
    console.log('Motion detected:', event.data);
  }
});
```

### ADSB Integration
```javascript
// Subscribe to aircraft events from ADSB
overwatchConnector.eventBus.subscribe('aircraft:detected', (event) => {
  if (event.source === 'adsb') {
    // Process aircraft event
    console.log('Aircraft detected:', event.data);
  }
});
```

### Telegram Integration
```javascript
// Execute Telegram send action
await overwatchConnector.executeCapability('overwatch:flows', 'execute', {
  flowId: 'motion-to-telegram',
  event: {
    type: 'motion',
    device: 'camera-1',
    confidence: 0.8
  }
});
```

---

The Overwatch Connector provides a comprehensive solution for event processing, flow orchestration, and system monitoring in the Looking Glass platform. 