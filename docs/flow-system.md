# Flow System

## Overview

The Flow System is a powerful automation and orchestration engine that enables complex workflows and decision trees in the Looking Glass platform. It provides a flexible, event-driven architecture for creating sophisticated automation rules and multi-step processes.

## Core Components

### Flow Orchestrator
The central component that manages flow execution, scheduling, and monitoring:
- **Flow Management**: Create, update, delete, and manage flows
- **Flow Execution**: Execute flows based on triggers and conditions
- **Flow Monitoring**: Real-time monitoring of flow execution
- **Flow Statistics**: Track performance and success rates
- **Flow Templates**: Pre-built flow templates for common scenarios

### Rule Engine
Advanced rule processing with complex conditions and actions:
- **Condition Evaluation**: Support for multiple condition types and operators
- **Action Execution**: Execute multiple actions per rule
- **Rule Chaining**: Chain rules together for complex workflows
- **Performance Optimization**: Efficient rule matching and execution
- **Rule Templates**: Pre-built rule templates for common scenarios

### Action Framework
Extensible action system for automated responses:
- **Built-in Actions**: Common actions like notifications, MQTT publishing, logging
- **Custom Actions**: Extensible framework for custom actions
- **Action Chaining**: Chain multiple actions together
- **Error Handling**: Robust error handling and retry mechanisms
- **Context Sharing**: Share context between actions in a flow

### Event Bus
Central event processing system:
- **Event Normalization**: Standardizes events from all sources
- **Event Routing**: Routes events to appropriate flows and rules
- **Event Storage**: Maintains event history with configurable limits
- **Real-time Broadcasting**: Sends events to WebSocket clients and MQTT

## Flow Definition

### Basic Flow Structure
```json
{
  "id": "motion-alert-flow",
  "name": "Motion Alert Flow",
  "description": "Send motion alerts to Telegram",
  "enabled": true,
  "triggers": ["motion"],
  "conditions": {
    "confidence": { "operator": ">=", "value": 0.5 }
  },
  "actions": [
    {
      "type": "telegram:send",
      "parameters": {
        "chatId": "{{config.telegram.chatId}}",
        "message": "🚨 Motion detected on camera {{device}}",
        "parseMode": "HTML"
      }
    }
  ],
  "metadata": {
    "created": "2022-01-01T12:00:00.000Z",
    "updated": "2022-01-01T12:00:00.000Z",
    "version": "1.0.0"
  }
}
```

### Advanced Flow with Multiple Actions
```json
{
  "id": "emergency-aircraft-flow",
  "name": "Emergency Aircraft Alert",
  "description": "Comprehensive emergency aircraft alerting",
  "enabled": true,
  "triggers": ["aircraft:emergency"],
  "conditions": {
    "squawk": { "operator": "in", "value": ["7500", "7600", "7700"] }
  },
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
    },
    {
      "type": "log",
      "parameters": {
        "level": "warn",
        "message": "Emergency aircraft detected: {{callsign}} ({{squawk}})"
      }
    }
  ],
  "errorHandling": {
    "retryCount": 3,
    "retryDelay": 5000,
    "onError": "continue"
  }
}
```

### Conditional Flow with Branches
```json
{
  "id": "smart-motion-flow",
  "name": "Smart Motion Processing",
  "description": "Process motion events based on confidence and type",
  "enabled": true,
  "triggers": ["motion", "smartdetect"],
  "actions": [
    {
      "type": "condition",
      "parameters": {
        "condition": "{{confidence}} >= 0.8",
        "onTrue": [
          {
            "type": "telegram:send",
            "parameters": {
              "chatId": "{{config.telegram.chatId}}",
              "message": "🔍 High confidence motion: {{device}}"
            }
          }
        ],
        "onFalse": [
          {
            "type": "log",
            "parameters": {
              "level": "info",
              "message": "Low confidence motion: {{device}} ({{confidence}})"
            }
          }
        ]
      }
    },
    {
      "type": "condition",
      "parameters": {
        "condition": "{{eventType}} == 'smartdetect'",
        "onTrue": [
          {
            "type": "telegram:send",
            "parameters": {
              "chatId": "{{config.telegram.chatId}}",
              "message": "👤 Smart detection: {{detectionType}} on {{device}}"
            }
          }
        ]
      }
    }
  ]
}
```

## Rule Definition

### Basic Rule Structure
```json
{
  "id": "high-confidence-motion",
  "name": "High Confidence Motion Rule",
  "description": "Rule for high confidence motion events",
  "enabled": true,
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
  ],
  "priority": 1,
  "metadata": {
    "created": "2022-01-01T12:00:00.000Z",
    "updated": "2022-01-01T12:00:00.000Z"
  }
}
```

### Complex Rule with Multiple Conditions
```json
{
  "id": "critical-security-event",
  "name": "Critical Security Event Rule",
  "description": "Rule for critical security events",
  "enabled": true,
  "conditions": {
    "and": [
      {
        "eventType": { "operator": "in", "value": ["motion", "smartdetect", "intrusion"] }
      },
      {
        "confidence": { "operator": ">=", "value": 0.9 }
      },
      {
        "or": [
          { "priority": "high" },
          { "priority": "critical" }
        ]
      }
    ]
  },
  "actions": [
    {
      "type": "telegram:send",
      "parameters": {
        "chatId": "{{config.telegram.chatId}}",
        "message": "🚨 CRITICAL SECURITY EVENT\n\n📹 Device: {{device}}\n🎯 Type: {{eventType}}\n📊 Confidence: {{confidence}}\n⏰ Time: {{timestamp}}",
        "parseMode": "HTML"
      }
    },
    {
      "type": "mqtt:publish",
      "parameters": {
        "topic": "security/critical",
        "message": {
          "event": "{{eventType}}",
          "device": "{{device}}",
          "confidence": "{{confidence}}",
          "timestamp": "{{timestamp}}"
        }
      }
    }
  ],
  "priority": 10
}
```

## Action Types

### Built-in Actions

#### Telegram Send Action
```json
{
  "type": "telegram:send",
  "parameters": {
    "chatId": "{{config.telegram.chatId}}",
    "message": "Your message here",
    "parseMode": "HTML",
    "disableWebPagePreview": true,
    "disableNotification": false
  }
}
```

#### MQTT Publish Action
```json
{
  "type": "mqtt:publish",
  "parameters": {
    "topic": "your/topic",
    "message": {
      "key": "value",
      "timestamp": "{{timestamp}}"
    },
    "qos": 1,
    "retain": false
  }
}
```

#### Log Action
```json
{
  "type": "log",
  "parameters": {
    "level": "info",
    "message": "Log message with {{variables}}",
    "context": {
      "flowId": "{{flowId}}",
      "eventId": "{{eventId}}"
    }
  }
}
```

#### HTTP Request Action
```json
{
  "type": "http:request",
  "parameters": {
    "method": "POST",
    "url": "https://api.example.com/webhook",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer {{config.apiKey}}"
    },
    "body": {
      "event": "{{eventType}}",
      "data": "{{data}}"
    },
    "timeout": 10000
  }
}
```

#### Database Action
```json
{
  "type": "database:insert",
  "parameters": {
    "table": "events",
    "data": {
      "event_type": "{{eventType}}",
      "device": "{{device}}",
      "timestamp": "{{timestamp}}",
      "confidence": "{{confidence}}"
    }
  }
}
```

#### Delay Action
```json
{
  "type": "delay",
  "parameters": {
    "duration": 5000
  }
}
```

#### Condition Action
```json
{
  "type": "condition",
  "parameters": {
    "condition": "{{confidence}} >= 0.8",
    "onTrue": [
      {
        "type": "telegram:send",
        "parameters": {
          "chatId": "{{config.telegram.chatId}}",
          "message": "High confidence event"
        }
      }
    ],
    "onFalse": [
      {
        "type": "log",
        "parameters": {
          "level": "info",
          "message": "Low confidence event"
        }
      }
    ]
  }
}
```

### Custom Actions
You can create custom actions by extending the Action Framework:

```javascript
class CustomAction extends BaseAction {
  static getMetadata() {
    return {
      name: 'Custom Action',
      description: 'Description of custom action',
      version: '1.0.0'
    };
  }
  
  static validateParameters(parameters) {
    const errors = [];
    
    if (!parameters.message) {
      errors.push('Message is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  async execute(context) {
    const { message } = this.parameters;
    
    // Custom action logic here
    console.log('Custom action executed:', message);
    
    return {
      success: true,
      result: 'Custom action completed'
    };
  }
}
```

## Condition Operators

### Comparison Operators
- `==` - Equal to
- `!=` - Not equal to
- `>` - Greater than
- `>=` - Greater than or equal to
- `<` - Less than
- `<=` - Less than or equal to
- `in` - Value is in array
- `not_in` - Value is not in array
- `contains` - String contains substring
- `starts_with` - String starts with prefix
- `ends_with` - String ends with suffix
- `regex` - Regular expression match

### Logical Operators
- `and` - All conditions must be true
- `or` - At least one condition must be true
- `not` - Negate a condition

### Example Conditions
```json
{
  "conditions": {
    "and": [
      {
        "eventType": { "operator": "in", "value": ["motion", "smartdetect"] }
      },
      {
        "confidence": { "operator": ">=", "value": 0.5 }
      },
      {
        "or": [
          { "priority": "high" },
          { "priority": "critical" }
        ]
      }
    ]
  }
}
```

## Variable Substitution

### Event Variables
- `{{eventType}}` - Type of the event
- `{{device}}` - Device identifier
- `{{confidence}}` - Confidence score
- `{{timestamp}}` - Event timestamp
- `{{data}}` - Full event data object
- `{{source}}` - Event source connector

### Flow Variables
- `{{flowId}}` - Current flow ID
- `{{flowName}}` - Current flow name
- `{{executionId}}` - Flow execution ID

### Configuration Variables
- `{{config.telegram.chatId}}` - Telegram chat ID from config
- `{{config.mqtt.broker}}` - MQTT broker from config
- `{{config.apiKey}}` - API key from config

### Custom Variables
You can define custom variables in flows:

```json
{
  "variables": {
    "alertThreshold": 0.8,
    "notificationChannel": "telegram",
    "retryCount": 3
  },
  "actions": [
    {
      "type": "condition",
      "parameters": {
        "condition": "{{confidence}} >= {{alertThreshold}}",
        "onTrue": [
          {
            "type": "{{notificationChannel}}:send",
            "parameters": {
              "message": "High confidence alert"
            }
          }
        ]
      }
    }
  ]
}
```

## Error Handling

### Flow-Level Error Handling
```json
{
  "errorHandling": {
    "retryCount": 3,
    "retryDelay": 5000,
    "onError": "continue",
    "fallbackActions": [
      {
        "type": "log",
        "parameters": {
          "level": "error",
          "message": "Flow execution failed: {{error}}"
        }
      }
    ]
  }
}
```

### Action-Level Error Handling
```json
{
  "type": "telegram:send",
  "parameters": {
    "chatId": "{{config.telegram.chatId}}",
    "message": "Alert message"
  },
  "errorHandling": {
    "retryCount": 2,
    "retryDelay": 1000,
    "onError": "skip",
    "fallback": {
      "type": "log",
      "parameters": {
        "level": "warn",
        "message": "Telegram send failed, logged instead"
      }
    }
  }
}
```

## Flow Templates

### Motion Alert Template
```json
{
  "name": "Motion Alert",
  "description": "Send motion alerts to Telegram",
  "triggers": ["motion"],
  "actions": [
    {
      "type": "telegram:send",
      "parameters": {
        "chatId": "{{config.telegram.chatId}}",
        "message": "🚨 Motion detected on {{device}}\n\n📅 Time: {{timestamp}}\n🎯 Confidence: {{confidence}}%",
        "parseMode": "HTML"
      }
    }
  ],
  "conditions": {
    "confidence": { "operator": ">=", "value": 0.5 }
  }
}
```

### Emergency Aircraft Template
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
        "message": "🚨 EMERGENCY AIRCRAFT\n\n✈️ {{callsign}}\n🆘 Squawk: {{squawk}}\n📍 {{lat}}, {{lon}}\n🛩️ {{altitude}}ft",
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
          "squawk": "{{squawk}}"
        }
      }
    }
  ],
  "conditions": {
    "squawk": { "operator": "in", "value": ["7500", "7600", "7700"] }
  }
}
```

### Speed Violation Template
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
        "message": "🚗 SPEED VIOLATION\n\n🚙 {{plateNumber}}\n⚡ {{speed}} km/h\n📏 Limit: {{speedLimit}} km/h\n📍 {{location}}",
        "parseMode": "HTML"
      }
    }
  ],
  "conditions": {
    "speed": { "operator": ">", "value": 100 }
  }
}
```

## API Reference

### Flow Management

#### List Flows
```bash
GET /api/flows
```
Returns all configured flows.

#### Get Flow
```bash
GET /api/flows/{flowId}
```
Returns a specific flow by ID.

#### Create Flow
```bash
POST /api/flows
{
  "name": "My Flow",
  "description": "Description of my flow",
  "triggers": ["motion"],
  "actions": [...]
}
```

#### Update Flow
```bash
PUT /api/flows/{flowId}
{
  "enabled": true,
  "actions": [...]
}
```

#### Delete Flow
```bash
DELETE /api/flows/{flowId}
```

#### Enable/Disable Flow
```bash
POST /api/flows/{flowId}/enable
POST /api/flows/{flowId}/disable
```

#### Execute Flow
```bash
POST /api/flows/{flowId}/execute
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
GET /api/rules
```

#### Create Rule
```bash
POST /api/rules
{
  "name": "My Rule",
  "conditions": {...},
  "actions": [...]
}
```

#### Update Rule
```bash
PUT /api/rules/{ruleId}
```

#### Delete Rule
```bash
DELETE /api/rules/{ruleId}
```

### Flow Statistics

#### Get Flow Statistics
```bash
GET /api/flows/statistics
```

#### Get Flow Execution History
```bash
GET /api/flows/{flowId}/executions
```

#### Get Flow Performance Metrics
```bash
GET /api/flows/{flowId}/metrics
```

## Performance Optimization

### Flow Execution Optimization
- **Caching**: Cache frequently used flow configurations
- **Lazy Loading**: Load flow definitions on demand
- **Parallel Execution**: Execute independent actions in parallel
- **Connection Pooling**: Reuse connections for external services

### Rule Engine Optimization
- **Rule Indexing**: Index rules for faster matching
- **Condition Optimization**: Optimize condition evaluation
- **Action Batching**: Batch similar actions together
- **Error Recovery**: Implement robust error recovery mechanisms

### Event Processing Optimization
- **Event Batching**: Process events in batches
- **Event Deduplication**: Prevent duplicate event processing
- **Event Filtering**: Filter events early in the pipeline
- **Event Routing**: Route events efficiently to appropriate flows

## Monitoring and Debugging

### Flow Execution Monitoring
```javascript
{
  "flowId": "motion-alert-flow",
  "executionId": "exec-123",
  "status": "running",
  "startTime": "2022-01-01T12:00:00.000Z",
  "currentAction": 2,
  "totalActions": 3,
  "actions": [
    {
      "index": 0,
      "type": "condition",
      "status": "completed",
      "result": true,
      "duration": 5
    },
    {
      "index": 1,
      "type": "telegram:send",
      "status": "completed",
      "result": { "messageId": 123 },
      "duration": 150
    },
    {
      "index": 2,
      "type": "log",
      "status": "running",
      "startTime": "2022-01-01T12:00:01.000Z"
    }
  ]
}
```

### Debug Mode
Enable debug logging for detailed troubleshooting:

```json
{
  "config": {
    "debug": true,
    "logLevel": "debug",
    "enableFlowLogging": true,
    "enableRuleLogging": true,
    "enableActionLogging": true
  }
}
```

### Health Monitoring
Monitor flow system health:

```bash
# Get flow system status
GET /api/flows/status

# Get flow system health
GET /api/flows/health

# Get flow system metrics
GET /api/flows/metrics
```

## Integration Examples

### UniFi Protect Integration
```javascript
// Subscribe to motion events
eventBus.subscribe('motion', (event) => {
  if (event.source === 'unifi-protect') {
    // Execute motion alert flow
    flowOrchestrator.executeFlow('motion-alert-flow', event);
  }
});
```

### ADSB Integration
```javascript
// Subscribe to aircraft events
eventBus.subscribe('aircraft:emergency', (event) => {
  if (event.source === 'adsb') {
    // Execute emergency aircraft flow
    flowOrchestrator.executeFlow('emergency-aircraft-flow', event);
  }
});
```

### Custom Integration
```javascript
// Create custom flow
const customFlow = {
  id: 'custom-flow',
  name: 'Custom Flow',
  triggers: ['custom:event'],
  actions: [
    {
      type: 'http:request',
      parameters: {
        method: 'POST',
        url: 'https://api.example.com/webhook',
        body: { event: '{{eventType}}', data: '{{data}}' }
      }
    }
  ]
};

// Register and execute flow
flowOrchestrator.createFlow(customFlow);
```

---

The Flow System provides a powerful and flexible foundation for creating sophisticated automation workflows in the Looking Glass platform. 