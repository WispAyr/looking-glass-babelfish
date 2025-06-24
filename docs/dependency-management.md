# Connector Dependency Management System

## Overview

The Looking Glass platform includes a robust dependency management system that allows connectors to declare their dependencies on other connectors and gracefully handle when those dependencies are not available. This prevents cascading failures and enables connectors to operate in degraded modes when possible.

## Key Features

- **Dependency Declaration**: Connectors can declare required and optional dependencies
- **Automatic Health Checking**: System automatically checks dependency availability
- **Graceful Degradation**: Connectors can fall back to reduced functionality
- **Alarm Integration**: Critical dependency failures trigger system alarms
- **Capability Validation**: Dependencies can specify required capabilities

## How It Works

### 1. Declaring Dependencies

Connectors declare their dependencies by overriding the `initializeDependencies()` method:

```javascript
initializeDependencies() {
  // Critical dependency - connector cannot function without this
  this.declareDependency('adsb-main', {
    required: true,
    critical: true,
    description: 'ADSB connector for aircraft data',
    capabilities: ['aircraft:tracking'],
    fallback: 'degraded_mode'
  });
  
  // Optional dependency - connector can function without this
  this.declareDependency('telegram-bot-main', {
    required: false,
    critical: false,
    description: 'Telegram connector for notifications',
    capabilities: ['telegram:send'],
    fallback: 'notification_disabled'
  });
}
```

### 2. Dependency Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `required` | boolean | `true` | Whether the dependency is required for basic operation |
| `critical` | boolean | `true` | Whether failure should trigger system alarms |
| `capabilities` | array | `[]` | Required capabilities the dependency must have |
| `fallback` | string | `null` | Fallback mode to enter when dependency fails |
| `description` | string | auto-generated | Human-readable description |

### 3. Checking Dependencies

Connectors can check their dependencies at any time:

```javascript
const dependencyCheck = await this.checkDependencies();

if (!dependencyCheck.available) {
  console.log('Missing dependencies:', dependencyCheck.missing);
  console.log('Errors:', dependencyCheck.errors);
}
```

### 4. Using Dependencies Safely

```javascript
// Safe way to get a dependency
try {
  const adsbConnector = this.getDependency('adsb-main');
  // Use the connector...
} catch (error) {
  await this.handleDependencyFailure('adsb-main', error);
}
```

### 5. Handling Dependency Failures

The system automatically handles dependency failures:

```javascript
async handleDependencyFailure(connectorId, error) {
  const dependency = this.dependencies.get(connectorId);
  
  // Log the failure
  this.logger.warn(`Dependency failure: ${connectorId}`, error);
  
  // Send alarm if critical
  if (dependency.critical && this.alarmManager) {
    await this.alarmManager.sendNotification('system', {
      type: 'dependency_failure',
      severity: 'high',
      message: `Critical dependency failure: ${connectorId}`
    });
  }
  
  // Execute fallback if available
  if (dependency.fallback) {
    await this.executeFallback(connectorId, dependency.fallback);
  }
}
```

### 6. Implementing Fallbacks

Connectors can implement custom fallback logic:

```javascript
async executeFallback(connectorId, fallback) {
  switch (fallback) {
    case 'degraded_mode':
      this.logger.warn('Entering degraded mode - limited functionality');
      this.telegramConfig.enabled = false;
      this.notamConfig.enabled = false;
      break;
      
    case 'notification_disabled':
      this.logger.warn('Notifications disabled due to connector unavailability');
      this.telegramConfig.enabled = false;
      break;
      
    default:
      this.logger.warn(`Unknown fallback: ${fallback}`);
  }
}
```

## Example: Prestwick Airport Connector

The Prestwick Airport Connector demonstrates a complete dependency management implementation:

### Dependencies
- **ADSB Connector** (Critical): Required for aircraft tracking
- **Telegram Connector** (Optional): Used for notifications
- **NOTAM Connector** (Optional): Used for airspace information

### Fallback Modes
- **degraded_mode**: Disables notifications and NOTAM integration
- **notification_disabled**: Disables Telegram notifications
- **notam_disabled**: Disables NOTAM integration

### Connection Process
1. Check all dependencies on startup
2. Connect to available dependencies
3. Handle failures gracefully
4. Enter appropriate fallback modes

## System Integration

### Alarm System Integration

The system includes a rule for monitoring dependency failures:

```javascript
{
  id: 'connector-dependency-alert',
  name: 'Connector Dependency Alert',
  conditions: {
    eventType: 'dependency-failed',
    critical: true
  },
  actions: [
    {
      type: 'send_notification',
      parameters: {
        message: '🚨 Critical dependency failure: {{dependencyId}} is not available for {{connectorId}}',
        priority: 'high',
        channels: ['telegram', 'gui']
      }
    }
  ]
}
```

### Health Monitoring

Dependency status is included in connector health checks:

```javascript
async performHealthCheck() {
  const dependencyCheck = await this.checkDependencies();
  
  return {
    healthy: dependencyCheck.available,
    details: {
      dependencies: dependencyCheck.details,
      missing: dependencyCheck.missing,
      errors: dependencyCheck.errors
    }
  };
}
```

## Best Practices

### 1. Declare Dependencies Early
Initialize dependencies in the constructor or `initializeDependencies()` method.

### 2. Use Appropriate Criticality Levels
- **Critical**: Connector cannot function without this dependency
- **Required**: Connector needs this for full functionality
- **Optional**: Nice to have, but not essential

### 3. Implement Meaningful Fallbacks
Provide fallback modes that maintain core functionality when possible.

### 4. Log Dependency Status
Include dependency status in health checks and logging.

### 5. Test Dependency Scenarios
Test your connector with various dependency combinations:
- All dependencies available
- Critical dependencies missing
- Optional dependencies missing
- Dependencies becoming unavailable during operation

## Testing

Use the provided test script to verify dependency management:

```bash
node test-dependency-management.js
```

This script demonstrates:
- Dependency declaration
- Health checking
- Failure handling
- Fallback execution

## Benefits

1. **Resilience**: System continues operating even when some components fail
2. **Predictability**: Clear dependency relationships and failure modes
3. **Maintainability**: Easy to understand and modify dependency requirements
4. **Monitoring**: Automatic detection and alerting of dependency issues
5. **Flexibility**: Connectors can operate in various degraded modes

## Future Enhancements

- **Dependency Graphs**: Visual representation of connector dependencies
- **Automatic Recovery**: Automatic reconnection when dependencies become available
- **Load Balancing**: Multiple instances of the same dependency type
- **Circuit Breakers**: Prevent cascading failures with circuit breaker patterns 