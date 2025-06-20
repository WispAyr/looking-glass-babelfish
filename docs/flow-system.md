# Flow System Documentation

## Overview

The Babelfish Looking Glass Flow System is a powerful event-driven automation platform that processes events from Unifi Protect systems and executes configurable rules and actions. It provides a complete solution for real-time monitoring, alerting, and automation.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Event Sources │    │   Event Bus     │    │   Rule Engine   │
│   (Unifi, etc.) │───▶│   (Central Hub) │───▶│   (Processing)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Flow Orchestrator│    │ Action Framework│
                       │ (Workflows)     │    │ (15+ Actions)   │
                       └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Web GUI       │    │   External      │
                       │   (Dashboard)   │    │   Integrations  │
                       └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. Event Bus

The Event Bus serves as the central nervous system of the flow system, handling all event routing and processing.

#### Features
- **Event Normalization**: Standardizes events from all sources
- **Event Routing**: Routes events to appropriate rules and subscribers
- **Event Storage**: Maintains event history with configurable limits
- **Real-time Broadcasting**: Sends events to WebSocket clients and MQTT

#### Event Format
```javascript
{
  id: "event-1234567890-abc123",
  type: "motion",
  source: "communications-van",
  timestamp: "2025-06-20T15:30:00.000Z",
  data: {
    cameraId: "camera-1",
    confidence: 0.95,
    location: "front-door"
  },
  metadata: {
    normalized: true,
    processed: false
  }
}
```

#### API Usage
```javascript
// Publish an event
await eventBus.publishEvent({
  type: 'motion',
  source: 'communications-van',
  data: { cameraId: 'camera-1' }
});

// Subscribe to events
const subscriberId = eventBus.subscribe('motion', (event) => {
  console.log('Motion detected:', event);
});

// Get events with filters
const events = eventBus.getEvents({
  type: 'motion',
  since: '2025-06-20T00:00:00.000Z',
  limit: 10
});
```

### 2. Rule Engine

The Rule Engine processes events and executes actions based on configurable rules.

#### Rule Structure
```javascript
{
  id: "motion-alert-rule",
  name: "Motion Detection Alert",
  description: "Send alert when motion is detected",
  conditions: {
    eventType: "motion",
    source: "communications-van",
    timeRange: {
      start: "22:00",
      end: "06:00"
    },
    data: {
      confidence: { $gte: 0.8 }
    }
  },
  actions: [
    {
      type: "send_notification",
      parameters: {
        message: "Motion detected during night hours",
        priority: "high",
        channels: ["gui", "slack"]
      }
    },
    {
      type: "log_event",
      parameters: {
        level: "warn",
        message: "Night motion alert"
      }
    }
  ],
  metadata: {
    enabled: true,
    category: "security",
    priority: 1
  }
}
```

#### Condition Types

##### Simple Conditions
```javascript
conditions: {
  eventType: "motion",
  source: "communications-van"
}
```

##### Time-based Conditions
```javascript
conditions: {
  timeRange: {
    start: "22:00",  // 10 PM
    end: "06:00"     // 6 AM
  }
}
```

##### Data-based Conditions
```javascript
conditions: {
  data: {
    confidence: { $gte: 0.8 },
    cameraId: "front-door"
  }
}
```

##### Custom Conditions
```javascript
conditions: {
  custom: (event) => {
    return event.data.confidence > 0.9 && 
           event.data.location === 'front-door';
  }
}
```

#### API Usage
```javascript
// Register a rule
const ruleId = ruleEngine.registerRule(ruleDefinition);

// Update a rule
const updatedRule = ruleEngine.updateRule(ruleId, updates);

// Enable/disable a rule
ruleEngine.setRuleEnabled(ruleId, true);

// Get all rules
const rules = ruleEngine.getRules();

// Get rule statistics
const stats = ruleEngine.getStats();
```

### 3. Action Framework

The Action Framework provides a comprehensive set of actions that can be executed by rules and flows.

#### Available Actions

##### Notification Actions
```javascript
{
  type: "send_notification",
  parameters: {
    message: "Alert message",
    priority: "high", // low, normal, high, critical
    channels: ["gui", "slack", "email"]
  }
}

{
  type: "send_email",
  parameters: {
    to: "admin@example.com",
    subject: "Security Alert",
    body: "Motion detected at front door"
  }
}

{
  type: "send_sms",
  parameters: {
    to: "+1234567890",
    message: "Security alert: Motion detected"
  }
}

{
  type: "slack_notify",
  parameters: {
    channel: "#security",
    message: "🚨 Security alert!",
    attachments: [...]
  }
}
```

##### MQTT Actions
```javascript
{
  type: "mqtt_publish",
  parameters: {
    topic: "unifi/events/motion",
    message: {
      type: "motion",
      source: "{{source}}",
      timestamp: "{{timestamp}}"
    },
    qos: 1
  }
}

{
  type: "mqtt_subscribe",
  parameters: {
    topic: "unifi/control/+",
    qos: 0
  }
}
```

##### Connector Actions
```javascript
{
  type: "connector_execute",
  parameters: {
    connectorId: "van-unifi",
    capabilityId: "camera:management",
    operation: "snapshot",
    parameters: {
      cameraId: "camera-1"
    }
  }
}

{
  type: "connector_connect",
  parameters: {
    connectorId: "van-unifi"
  }
}
```

##### System Actions
```javascript
{
  type: "log_event",
  parameters: {
    level: "info", // debug, info, warn, error
    message: "Event processed",
    data: {
      ruleId: "{{rule.id}}",
      eventId: "{{event.id}}"
    }
  }
}

{
  type: "store_data",
  parameters: {
    key: "motion_events",
    value: {
      timestamp: "{{timestamp}}",
      source: "{{source}}"
    },
    ttl: 86400 // 24 hours
  }
}

{
  type: "http_request",
  parameters: {
    method: "POST",
    url: "https://api.example.com/webhook",
    headers: {
      "Authorization": "Bearer token"
    },
    body: {
      event: "{{type}}",
      source: "{{source}}"
    }
  }
}
```

##### Utility Actions
```javascript
{
  type: "delay",
  parameters: {
    duration: 5000 // 5 seconds
  }
}

{
  type: "transform_data",
  parameters: {
    input: "{{data}}",
    transform: {
      type: "template",
      template: "Motion detected at {{location}} with {{confidence}} confidence"
    }
  }
}

{
  type: "conditional_action",
  parameters: {
    condition: "{{data.confidence > 0.9}}",
    trueAction: {
      type: "send_notification",
      parameters: {
        message: "High confidence motion detected"
      }
    },
    falseAction: {
      type: "log_event",
      parameters: {
        message: "Low confidence motion ignored"
      }
    }
  }
}
```

### 4. Flow Orchestrator

The Flow Orchestrator manages complex multi-step workflows and coordinates between all components.

#### Flow Structure
```javascript
{
  id: "security-alert-flow",
  name: "Security Alert Flow",
  description: "Complete security alert workflow",
  steps: [
    {
      id: "motion-detection",
      type: "rule",
      ruleId: "motion-notification-rule"
    },
    {
      id: "delay",
      type: "action",
      action: {
        type: "delay",
        parameters: { duration: 2000 }
      }
    },
    {
      id: "snapshot",
      type: "action",
      action: {
        type: "connector_execute",
        parameters: {
          connectorId: "van-unifi",
          capabilityId: "camera:management",
          operation: "snapshot"
        }
      }
    },
    {
      id: "notification",
      type: "action",
      action: {
        type: "send_notification",
        parameters: {
          message: "Security alert with snapshot captured"
        }
      }
    }
  ],
  metadata: {
    enabled: true,
    category: "security"
  }
}
```

#### Step Types

##### Rule Steps
```javascript
{
  id: "rule-step",
  type: "rule",
  ruleId: "motion-notification-rule"
}
```

##### Action Steps
```javascript
{
  id: "action-step",
  type: "action",
  action: {
    type: "send_notification",
    parameters: { message: "Alert" }
  }
}
```

##### Condition Steps
```javascript
{
  id: "condition-step",
  type: "condition",
  condition: "{{data.confidence > 0.8}}"
}
```

##### Transform Steps
```javascript
{
  id: "transform-step",
  type: "transform",
  input: "{{data}}",
  transform: {
    type: "template",
    template: "Alert: {{message}}"
  }
}
```

## Configuration

### Flow System Configuration
```javascript
// config/config.js
flow: {
  enabled: true,
  eventBus: {
    maxEvents: 1000,           // Maximum events to store
    processingInterval: 100    // Processing interval in ms
  },
  ruleEngine: {
    maxRules: 100,             // Maximum number of rules
    executionTimeout: 30000    // Rule execution timeout
  },
  actionFramework: {
    maxActions: 50,            // Maximum actions per rule
    executionTimeout: 10000    // Action execution timeout
  },
  orchestrator: {
    maxFlows: 50,              // Maximum number of flows
    flowExecutionTimeout: 60000 // Flow execution timeout
  }
}
```

### Environment Variables
```bash
# Enable/disable flow system
FLOW_ENABLED=true

# Event bus configuration
EVENT_BUS_MAX_EVENTS=1000
EVENT_BUS_PROCESSING_INTERVAL=100

# Rule engine configuration
RULE_ENGINE_MAX_RULES=100
RULE_EXECUTION_TIMEOUT=30000

# Action framework configuration
ACTION_FRAMEWORK_MAX_ACTIONS=50
ACTION_EXECUTION_TIMEOUT=10000

# Orchestrator configuration
ORCHESTRATOR_MAX_FLOWS=50
FLOW_EXECUTION_TIMEOUT=60000
```

## API Reference

### Flow Management

#### Get Flow System Status
```bash
GET /api/flows/status
```

Response:
```json
{
  "success": true,
  "status": {
    "eventBus": {
      "totalEvents": 150,
      "eventsByType": {
        "motion": 100,
        "smartDetectZone": 30,
        "ring": 20
      },
      "queueLength": 0,
      "subscriberCount": 5
    },
    "ruleEngine": {
      "totalRules": 7,
      "rulesExecuted": 45,
      "actionsExecuted": 120,
      "errors": 2
    },
    "actionFramework": {
      "totalExecutions": 120,
      "successfulExecutions": 118,
      "failedExecutions": 2,
      "availableActions": 15
    },
    "orchestrator": {
      "totalFlows": 2,
      "activeFlows": 0,
      "completedFlows": 45,
      "failedFlows": 0
    }
  }
}
```

#### List Flows
```bash
GET /api/flows
```

#### Create Flow
```bash
POST /api/flows
Content-Type: application/json

{
  "name": "My Flow",
  "description": "A custom flow",
  "steps": [...],
  "metadata": {
    "enabled": true,
    "category": "custom"
  }
}
```

#### Update Flow
```bash
PUT /api/flows/:id
Content-Type: application/json

{
  "name": "Updated Flow Name",
  "steps": [...]
}
```

#### Delete Flow
```bash
DELETE /api/flows/:id
```

#### Execute Flow
```bash
POST /api/flows/:id/execute
Content-Type: application/json

{
  "input": {
    "customData": "value"
  }
}
```

### Rule Management

#### List Rules
```bash
GET /api/rules
```

#### Create Rule
```bash
POST /api/rules
Content-Type: application/json

{
  "name": "My Rule",
  "conditions": {...},
  "actions": [...],
  "metadata": {
    "enabled": true,
    "category": "custom"
  }
}
```

#### Update Rule
```bash
PUT /api/rules/:id
Content-Type: application/json

{
  "name": "Updated Rule Name",
  "conditions": {...}
}
```

#### Delete Rule
```bash
DELETE /api/rules/:id
```

#### Enable/Disable Rule
```bash
POST /api/rules/:id/enable
Content-Type: application/json

{
  "enabled": true
}
```

### Action Management

#### List Available Actions
```bash
GET /api/actions
```

#### Get Action Statistics
```bash
GET /api/actions/stats
```

## Best Practices

### Rule Design

1. **Keep Rules Focused**: Each rule should handle one specific scenario
2. **Use Descriptive Names**: Clear, descriptive rule names help with maintenance
3. **Test Conditions**: Ensure conditions are specific and accurate
4. **Limit Actions**: Don't overload rules with too many actions
5. **Use Categories**: Organize rules with categories for better management

### Flow Design

1. **Plan Workflows**: Design flows before implementation
2. **Use Steps Logically**: Organize steps in logical order
3. **Handle Errors**: Include error handling in complex flows
4. **Test Flows**: Test flows with various inputs
5. **Monitor Performance**: Watch flow execution times and success rates

### Performance Optimization

1. **Efficient Conditions**: Use specific conditions to avoid unnecessary rule execution
2. **Action Batching**: Group related actions in single rules when possible
3. **Event Filtering**: Filter events at the source when possible
4. **Resource Management**: Monitor system resources and adjust limits
5. **Caching**: Use the cache action for frequently accessed data

## Troubleshooting

### Common Issues

#### Rules Not Executing
- Check if rules are enabled
- Verify event types match conditions
- Check rule conditions for accuracy
- Review server logs for errors

#### Actions Failing
- Verify action parameters
- Check connector availability
- Review action execution logs
- Test actions individually

#### Performance Issues
- Monitor event queue length
- Check rule execution times
- Review action success rates
- Adjust system limits if needed

#### Flow Execution Problems
- Verify flow steps are valid
- Check step dependencies
- Review flow execution logs
- Test individual steps

### Debugging

#### Enable Debug Logging
```bash
LOG_LEVEL=debug npm start
```

#### Monitor Real-time Events
```bash
tail -f logs/babelfish.log | grep -E "(event|rule|action|flow)"
```

#### Check System Status
```bash
curl http://localhost:3000/api/flows/status | jq .
```

## Examples

### Security Alert System
```javascript
// Rule: High-confidence motion during night hours
{
  "name": "Night Security Alert",
  "conditions": {
    "eventType": "motion",
    "timeRange": { "start": "22:00", "end": "06:00" },
    "data": { "confidence": { "$gte": 0.9 } }
  },
  "actions": [
    {
      "type": "send_notification",
      "parameters": {
        "message": "🚨 High-confidence motion during night hours",
        "priority": "critical",
        "channels": ["gui", "slack", "email"]
      }
    },
    {
      "type": "connector_execute",
      "parameters": {
        "connectorId": "van-unifi",
        "capabilityId": "camera:management",
        "operation": "snapshot"
      }
    },
    {
      "type": "mqtt_publish",
      "parameters": {
        "topic": "security/alerts/night-motion",
        "message": {
          "type": "night_motion",
          "priority": "critical",
          "timestamp": "{{timestamp}}"
        }
      }
    }
  ]
}
```

### Data Collection Flow
```javascript
// Flow: Collect and store event data
{
  "name": "Event Data Collection",
  "steps": [
    {
      "id": "collect-event",
      "type": "action",
      "action": {
        "type": "store_data",
        "parameters": {
          "key": "events_{{timestamp}}",
          "value": "{{data}}",
          "ttl": 86400
        }
      }
    },
    {
      "id": "transform-data",
      "type": "action",
      "action": {
        "type": "transform_data",
        "parameters": {
          "input": "{{data}}",
          "transform": {
            "type": "template",
            "template": "Event: {{type}} from {{source}} at {{timestamp}}"
          }
        }
      }
    },
    {
      "id": "log-summary",
      "type": "action",
      "action": {
        "type": "log_event",
        "parameters": {
          "level": "info",
          "message": "{{transform_data.output}}"
        }
      }
    }
  ]
}
```

This documentation provides a comprehensive guide to the Flow System. For more specific examples and advanced usage, refer to the API documentation and example configurations. 