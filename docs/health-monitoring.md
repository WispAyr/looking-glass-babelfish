# Health Monitoring System

## Overview

The Health Monitoring System provides comprehensive monitoring and alerting capabilities for the Looking Glass platform. It tracks system health, performance metrics, connector status, and generates alerts for issues that require attention.

## Core Components

### Health Monitor
The central component that coordinates all health monitoring activities:
- **System Health Checks**: Memory, CPU, disk, and connection monitoring
- **Performance Metrics**: Response times, throughput, and resource utilization
- **Alert Management**: Threshold-based alerts with configurable severity levels
- **Health Reporting**: Comprehensive health status reporting
- **Trend Analysis**: Historical health data analysis

### Connector Health Monitor
Monitors the health of all connected connectors:
- **Connection Status**: Track connector connection states
- **Response Times**: Monitor connector response times
- **Error Rates**: Track connector error rates
- **Performance Metrics**: Monitor connector performance
- **Auto-recovery**: Automatic reconnection attempts

### Database Health Monitor
Monitors database health and performance:
- **Connection Pool**: Monitor database connection pool status
- **Query Performance**: Track query execution times
- **Database Size**: Monitor database growth
- **Index Performance**: Monitor index usage and performance
- **Backup Status**: Monitor backup completion and health

### System Metrics Collector
Collects and stores system performance metrics:
- **Resource Usage**: CPU, memory, disk, and network usage
- **Application Metrics**: Request rates, response times, error rates
- **Custom Metrics**: User-defined metrics and KPIs
- **Metric Aggregation**: Aggregate metrics over time periods
- **Metric Storage**: Efficient storage and retrieval of metrics

## Health Check Types

### System Health Checks

#### Memory Health Check
```javascript
{
  "type": "memory",
  "name": "Memory Usage Check",
  "description": "Monitor system memory usage",
  "thresholds": {
    "warning": 0.7,  // 70%
    "critical": 0.9  // 90%
  },
  "metrics": {
    "totalMemory": "Total system memory in bytes",
    "usedMemory": "Used memory in bytes",
    "freeMemory": "Free memory in bytes",
    "memoryUsage": "Memory usage percentage"
  }
}
```

#### CPU Health Check
```javascript
{
  "type": "cpu",
  "name": "CPU Usage Check",
  "description": "Monitor system CPU usage",
  "thresholds": {
    "warning": 0.7,  // 70%
    "critical": 0.9  // 90%
  },
  "metrics": {
    "cpuUsage": "CPU usage percentage",
    "loadAverage": "System load average",
    "processCount": "Number of running processes"
  }
}
```

#### Disk Health Check
```javascript
{
  "type": "disk",
  "name": "Disk Usage Check",
  "description": "Monitor disk usage and performance",
  "thresholds": {
    "warning": 0.8,  // 80%
    "critical": 0.95 // 95%
  },
  "metrics": {
    "diskUsage": "Disk usage percentage",
    "freeSpace": "Free disk space in bytes",
    "diskIO": "Disk I/O operations per second",
    "diskLatency": "Disk I/O latency in milliseconds"
  }
}
```

#### Network Health Check
```javascript
{
  "type": "network",
  "name": "Network Health Check",
  "description": "Monitor network connectivity and performance",
  "thresholds": {
    "latency": {
      "warning": 100,  // 100ms
      "critical": 500  // 500ms
    },
    "packetLoss": {
      "warning": 0.01, // 1%
      "critical": 0.05 // 5%
    }
  },
  "metrics": {
    "latency": "Network latency in milliseconds",
    "packetLoss": "Packet loss percentage",
    "bandwidth": "Network bandwidth usage",
    "connections": "Number of active connections"
  }
}
```

### Application Health Checks

#### API Health Check
```javascript
{
  "type": "api",
  "name": "API Health Check",
  "description": "Monitor API endpoints health",
  "endpoints": [
    {
      "url": "/api/health",
      "method": "GET",
      "expectedStatus": 200,
      "timeout": 5000
    },
    {
      "url": "/api/connectors",
      "method": "GET",
      "expectedStatus": 200,
      "timeout": 10000
    }
  ],
  "metrics": {
    "responseTime": "API response time in milliseconds",
    "statusCode": "HTTP status code",
    "availability": "API availability percentage"
  }
}
```

#### Database Health Check
```javascript
{
  "type": "database",
  "name": "Database Health Check",
  "description": "Monitor database health and performance",
  "queries": [
    {
      "name": "Connection Test",
      "sql": "SELECT 1",
      "timeout": 5000
    },
    {
      "name": "Performance Test",
      "sql": "SELECT COUNT(*) FROM events",
      "timeout": 10000
    }
  ],
  "metrics": {
    "connectionCount": "Number of active connections",
    "queryTime": "Query execution time in milliseconds",
    "databaseSize": "Database size in bytes",
    "indexUsage": "Index usage statistics"
  }
}
```

#### Connector Health Check
```javascript
{
  "type": "connector",
  "name": "Connector Health Check",
  "description": "Monitor connector health and status",
  "connectors": ["unifi-protect", "adsb", "aprs", "mqtt"],
  "metrics": {
    "connectionStatus": "Connector connection status",
    "responseTime": "Connector response time",
    "errorRate": "Connector error rate",
    "lastSeen": "Last successful communication"
  }
}
```

## Configuration

### Basic Health Monitoring Configuration
```json
{
  "health": {
    "enabled": true,
    "checkInterval": 30000,
    "alertRetention": 10,
    "metricsRetention": 7,
    "checks": {
      "system": {
        "enabled": true,
        "interval": 30000
      },
      "connectors": {
        "enabled": true,
        "interval": 60000
      },
      "database": {
        "enabled": true,
        "interval": 120000
      }
    }
  }
}
```

### Advanced Health Monitoring Configuration
```json
{
  "health": {
    "enabled": true,
    "checkInterval": 30000,
    "alertRetention": 10,
    "metricsRetention": 7,
    "thresholds": {
      "memory": {
        "warning": 0.7,
        "critical": 0.9
      },
      "cpu": {
        "warning": 0.7,
        "critical": 0.9
      },
      "disk": {
        "warning": 0.8,
        "critical": 0.95
      },
      "responseTime": {
        "warning": 1000,
        "critical": 5000
      }
    },
    "checks": {
      "system": {
        "enabled": true,
        "interval": 30000,
        "metrics": ["memory", "cpu", "disk", "network"]
      },
      "connectors": {
        "enabled": true,
        "interval": 60000,
        "autoReconnect": true,
        "maxReconnectAttempts": 5
      },
      "database": {
        "enabled": true,
        "interval": 120000,
        "connectionPool": {
          "maxConnections": 10,
          "minConnections": 2
        }
      },
      "api": {
        "enabled": true,
        "interval": 30000,
        "endpoints": [
          "/api/health",
          "/api/connectors",
          "/api/events"
        ]
      }
    },
    "alerts": {
      "enabled": true,
      "channels": ["telegram", "mqtt", "log"],
      "severity": {
        "info": ["log"],
        "warning": ["telegram", "log"],
        "critical": ["telegram", "mqtt", "log"]
      }
    }
  }
}
```

## Health Check Implementation

### System Health Check
```javascript
async performSystemHealthCheck() {
  const checks = {
    memory: await this.checkMemoryHealth(),
    cpu: await this.checkCPUHealth(),
    disk: await this.checkDiskHealth(),
    network: await this.checkNetworkHealth()
  };
  
  const overallHealth = this.calculateOverallHealth(checks);
  
  return {
    healthy: overallHealth.healthy,
    checks,
    overallHealth,
    timestamp: Date.now()
  };
}

async checkMemoryHealth() {
  const memUsage = process.memoryUsage();
  const memoryUsage = memUsage.heapUsed / memUsage.heapTotal;
  
  return {
    healthy: memoryUsage < this.config.thresholds.memory.critical,
    warning: memoryUsage > this.config.thresholds.memory.warning,
    critical: memoryUsage > this.config.thresholds.memory.critical,
    metrics: {
      totalMemory: memUsage.heapTotal,
      usedMemory: memUsage.heapUsed,
      freeMemory: memUsage.heapTotal - memUsage.heapUsed,
      memoryUsage: memoryUsage
    }
  };
}
```

### Connector Health Check
```javascript
async performConnectorHealthCheck() {
  const connectorChecks = {};
  
  for (const connectorId of this.connectorRegistry.getConnectorIds()) {
    const connector = this.connectorRegistry.getConnector(connectorId);
    
    try {
      const health = await connector.performHealthCheck();
      connectorChecks[connectorId] = {
        healthy: health.healthy,
        status: connector.getStatus(),
        lastSeen: connector.getLastSeen(),
        responseTime: health.responseTime,
        errorRate: health.errorRate,
        details: health.details
      };
    } catch (error) {
      connectorChecks[connectorId] = {
        healthy: false,
        status: 'error',
        error: error.message,
        lastSeen: connector.getLastSeen()
      };
    }
  }
  
  return {
    healthy: Object.values(connectorChecks).every(check => check.healthy),
    connectors: connectorChecks,
    timestamp: Date.now()
  };
}
```

### Database Health Check
```javascript
async performDatabaseHealthCheck() {
  try {
    const startTime = Date.now();
    
    // Test basic connectivity
    await this.database.query('SELECT 1');
    const responseTime = Date.now() - startTime;
    
    // Get database statistics
    const stats = await this.getDatabaseStats();
    
    return {
      healthy: true,
      responseTime,
      metrics: {
        connectionCount: stats.connectionCount,
        databaseSize: stats.databaseSize,
        tableCount: stats.tableCount,
        indexCount: stats.indexCount
      },
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: Date.now()
    };
  }
}
```

## Alert System

### Alert Types

#### System Alerts
```javascript
{
  "type": "system",
  "severity": "critical",
  "title": "High Memory Usage",
  "message": "System memory usage is at 95%",
  "details": {
    "memoryUsage": 0.95,
    "threshold": 0.9,
    "totalMemory": "8GB",
    "usedMemory": "7.6GB"
  },
  "timestamp": "2022-01-01T12:00:00.000Z",
  "acknowledged": false
}
```

#### Connector Alerts
```javascript
{
  "type": "connector",
  "severity": "warning",
  "title": "Connector Disconnected",
  "message": "UniFi Protect connector is disconnected",
  "details": {
    "connectorId": "unifi-protect",
    "status": "disconnected",
    "lastSeen": "2022-01-01T11:45:00.000Z",
    "error": "Connection timeout"
  },
  "timestamp": "2022-01-01T12:00:00.000Z",
  "acknowledged": false
}
```

#### Performance Alerts
```javascript
{
  "type": "performance",
  "severity": "warning",
  "title": "High Response Time",
  "message": "API response time is 3.2 seconds",
  "details": {
    "endpoint": "/api/events",
    "responseTime": 3200,
    "threshold": 1000,
    "averageResponseTime": 2800
  },
  "timestamp": "2022-01-01T12:00:00.000Z",
  "acknowledged": false
}
```

### Alert Configuration
```json
{
  "alerts": {
    "enabled": true,
    "channels": {
      "telegram": {
        "enabled": true,
        "chatId": "{{config.telegram.chatId}}",
        "severities": ["warning", "critical"]
      },
      "mqtt": {
        "enabled": true,
        "topic": "system/alerts",
        "severities": ["critical"]
      },
      "log": {
        "enabled": true,
        "severities": ["info", "warning", "critical"]
      }
    },
    "rules": {
      "memory": {
        "warning": {
          "threshold": 0.7,
          "message": "Memory usage is high: {{memoryUsage}}%"
        },
        "critical": {
          "threshold": 0.9,
          "message": "Critical memory usage: {{memoryUsage}}%"
        }
      },
      "connector": {
        "disconnected": {
          "message": "Connector {{connectorId}} is disconnected"
        },
        "highErrorRate": {
          "threshold": 0.1,
          "message": "High error rate for {{connectorId}}: {{errorRate}}%"
        }
      }
    }
  }
}
```

## Metrics Collection

### System Metrics
```javascript
{
  "timestamp": "2022-01-01T12:00:00.000Z",
  "system": {
    "memory": {
      "total": 8589934592,
      "used": 6442450944,
      "free": 2147483648,
      "usage": 0.75
    },
    "cpu": {
      "usage": 0.45,
      "loadAverage": [1.2, 1.1, 1.0],
      "processCount": 45
    },
    "disk": {
      "total": 107374182400,
      "used": 64424509440,
      "free": 42949672960,
      "usage": 0.6
    },
    "network": {
      "bytesIn": 1024000,
      "bytesOut": 512000,
      "connections": 25
    }
  }
}
```

### Application Metrics
```javascript
{
  "timestamp": "2022-01-01T12:00:00.000Z",
  "application": {
    "requests": {
      "total": 1250,
      "successful": 1200,
      "failed": 50,
      "rate": 25.5
    },
    "responseTime": {
      "average": 125,
      "p95": 250,
      "p99": 500
    },
    "events": {
      "processed": 5000,
      "rate": 100.0,
      "queueSize": 23
    },
    "connectors": {
      "total": 8,
      "connected": 7,
      "disconnected": 1
    }
  }
}
```

### Custom Metrics
```javascript
{
  "timestamp": "2022-01-01T12:00:00.000Z",
  "custom": {
    "motionEvents": {
      "count": 150,
      "rate": 3.0,
      "averageConfidence": 0.75
    },
    "aircraftDetected": {
      "count": 25,
      "rate": 0.5,
      "emergencyCount": 1
    },
    "speedViolations": {
      "count": 5,
      "rate": 0.1,
      "averageSpeed": 120
    }
  }
}
```

## API Reference

### Health Status

#### Get Overall Health
```bash
GET /health
```
Returns overall system health status.

#### Get Detailed Health
```bash
GET /health/detailed
```
Returns detailed health status for all components.

#### Get System Health
```bash
GET /health/system
```
Returns system-specific health information.

#### Get Connector Health
```bash
GET /health/connectors
```
Returns health status of all connectors.

#### Get Database Health
```bash
GET /health/database
```
Returns database health information.

### Metrics

#### Get System Metrics
```bash
GET /health/metrics
```
Returns current system metrics.

#### Get Historical Metrics
```bash
GET /health/metrics/history?hours=24
```
Returns historical metrics for the specified time period.

#### Get Custom Metrics
```bash
GET /health/metrics/custom
```
Returns custom application metrics.

### Alerts

#### Get Active Alerts
```bash
GET /health/alerts
```
Returns all active alerts.

#### Acknowledge Alert
```bash
POST /health/alerts/{alertId}/acknowledge
```
Acknowledges an alert.

#### Get Alert History
```bash
GET /health/alerts/history
```
Returns alert history.

### Kubernetes Health Checks

#### Readiness Check
```bash
GET /ready
```
Kubernetes readiness check endpoint.

#### Liveness Check
```bash
GET /live
```
Kubernetes liveness check endpoint.

## Monitoring Dashboard

### Health Overview
The health monitoring dashboard provides:
- **System Status**: Overall system health indicator
- **Component Status**: Health status of individual components
- **Performance Metrics**: Real-time performance metrics
- **Active Alerts**: Current active alerts
- **Trend Charts**: Historical health data visualization

### Connector Status
- **Connection Status**: Visual indicators for connector states
- **Response Times**: Connector response time charts
- **Error Rates**: Connector error rate tracking
- **Last Seen**: Last successful communication timestamps

### Performance Monitoring
- **Resource Usage**: CPU, memory, disk usage charts
- **Response Times**: API response time tracking
- **Throughput**: Request and event processing rates
- **Error Tracking**: Error rate and type analysis

## Troubleshooting

### Common Health Issues

#### High Memory Usage
**Symptoms**: Memory usage above 90%
**Solutions**:
- Check for memory leaks in application code
- Increase system memory
- Optimize data structures and algorithms
- Implement memory pooling

#### High CPU Usage
**Symptoms**: CPU usage above 90%
**Solutions**:
- Identify CPU-intensive operations
- Optimize algorithms and data processing
- Use worker threads for heavy tasks
- Implement caching strategies

#### Database Performance Issues
**Symptoms**: Slow query execution, connection timeouts
**Solutions**:
- Optimize database queries
- Add database indexes
- Increase connection pool size
- Monitor and optimize database configuration

#### Connector Connection Issues
**Symptoms**: Connectors frequently disconnecting
**Solutions**:
- Check network connectivity
- Verify connector configuration
- Implement exponential backoff reconnection
- Monitor external service availability

### Debug Mode
Enable debug logging for detailed troubleshooting:

```json
{
  "health": {
    "debug": true,
    "logLevel": "debug",
    "enableDetailedLogging": true,
    "enableMetricLogging": true
  }
}
```

### Health Check Testing
Test individual health checks:

```bash
# Test system health check
curl http://localhost:3000/health/system

# Test connector health check
curl http://localhost:3000/health/connectors

# Test database health check
curl http://localhost:3000/health/database
```

## Integration Examples

### Telegram Alert Integration
```javascript
// Configure Telegram alerts
const alertConfig = {
  channel: 'telegram',
  chatId: '{{config.telegram.chatId}}',
  severities: ['warning', 'critical']
};

// Send health alert
await healthMonitor.sendAlert({
  type: 'system',
  severity: 'critical',
  title: 'System Health Alert',
  message: 'Critical system issue detected',
  details: { /* alert details */ }
});
```

### MQTT Integration
```javascript
// Publish health metrics to MQTT
const metrics = await healthMonitor.getMetrics();
await mqttConnector.publish('system/health', {
  timestamp: new Date().toISOString(),
  metrics: metrics
});
```

### Custom Health Check
```javascript
// Create custom health check
class CustomHealthCheck extends BaseHealthCheck {
  async performCheck() {
    // Custom health check logic
    const result = await this.customOperation();
    
    return {
      healthy: result.success,
      metrics: {
        customMetric: result.value
      },
      timestamp: Date.now()
    };
  }
}

// Register custom health check
healthMonitor.registerCheck('custom', new CustomHealthCheck());
```

---

The Health Monitoring System provides comprehensive monitoring and alerting capabilities to ensure the Looking Glass platform operates reliably and efficiently. 