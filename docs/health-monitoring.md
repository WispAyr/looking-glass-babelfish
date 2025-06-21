# Health Monitoring System

## Overview

The Health Monitoring System provides real-time monitoring of system health, performance metrics, and resource usage. It helps identify potential issues before they become critical and provides insights into system performance.

## Features

### Health Checks
- **Memory Usage**: Monitors RAM utilization and alerts when thresholds are exceeded
- **CPU Usage**: Tracks CPU utilization across all cores
- **Disk Usage**: Monitors available disk space
- **Connection Count**: Tracks active database and network connections
- **Error Rate**: Monitors system error frequency

### Performance Metrics
- **Query Performance**: Database query execution times and success rates
- **Response Times**: API endpoint response times
- **Throughput**: Events processed per second
- **Resource Utilization**: Memory, CPU, and network usage trends

### Alerting
- **Threshold-based Alerts**: Automatic alerts when metrics exceed configured thresholds
- **Trend Analysis**: Identifies performance degradation over time
- **Alert Retention**: Configurable alert history retention

## Configuration

### Environment Variables

```bash
# Health Monitoring Configuration
HEALTH_MONITORING_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
HEALTH_MEMORY_THRESHOLD=0.8
HEALTH_CPU_THRESHOLD=0.7
HEALTH_DISK_THRESHOLD=0.9
HEALTH_CONNECTION_THRESHOLD=1000
HEALTH_ERROR_THRESHOLD=100
HEALTH_ALERT_RETENTION=10
```

### Configuration Object

```javascript
{
  health: {
    enabled: true,
    checkInterval: 30000, // 30 seconds
    memoryThreshold: 0.8, // 80%
    cpuThreshold: 0.7, // 70%
    diskThreshold: 0.9, // 90%
    connectionThreshold: 1000,
    errorThreshold: 100,
    alertRetention: 10
  }
}
```

## API Endpoints

### Basic Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "v18.17.0"
}
```

### Detailed Health Status
```bash
GET /health/detailed
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "memory": {
      "status": "healthy",
      "value": 0.65,
      "threshold": 0.8
    },
    "cpu": {
      "status": "healthy",
      "value": 0.45,
      "threshold": 0.7
    },
    "disk": {
      "status": "healthy",
      "value": 0.3,
      "threshold": 0.9
    },
    "connections": {
      "status": "healthy",
      "value": 25,
      "threshold": 1000
    },
    "errors": {
      "status": "healthy",
      "value": 5,
      "threshold": 100
    }
  },
  "alerts": [
    {
      "type": "memory",
      "message": "High memory usage: 85.2%",
      "timestamp": "2024-01-15T10:25:00.000Z",
      "severity": "warning"
    }
  ],
  "metrics": {
    "uptime": 3600,
    "totalRequests": 1500,
    "averageResponseTime": 45,
    "errorRate": 0.02,
    "activeConnections": 25
  }
}
```

### Database Health
```bash
GET /health/database
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "stats": {
    "totalQueries": 1500,
    "successfulQueries": 1485,
    "failedQueries": 15,
    "averageQueryTime": 12.5,
    "slowQueries": 3,
    "lastQueryTime": "2024-01-15T10:29:55.000Z",
    "activeConnections": 5,
    "poolSize": 5,
    "databaseStats": {
      "connector_count": 8,
      "entity_count": 150,
      "event_count": 2500,
      "analytics_count": 500,
      "rule_count": 25,
      "map_count": 3
    }
  }
}
```

### Connector Health
```bash
GET /health/connectors
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "connectors": [
    {
      "id": "unifi-protect-1",
      "type": "unifi-protect",
      "name": "UniFi Protect",
      "status": "connected",
      "lastActivity": "2024-01-15T10:29:45.000Z",
      "errors": 0,
      "messagesSent": 150,
      "messagesReceived": 300
    }
  ],
  "total": 8,
  "connected": 7,
  "disconnected": 1
}
```

### Performance Metrics
```bash
GET /health/metrics
```

Response:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "system": {
    "uptime": 3600,
    "totalRequests": 1500,
    "averageResponseTime": 45,
    "errorRate": 0.02,
    "activeConnections": 25,
    "memory": {
      "total": 8589934592,
      "free": 3006477107,
      "used": 5583457485
    },
    "cpu": 8,
    "loadAverage": [1.2, 1.1, 0.9]
  },
  "database": {
    "totalQueries": 1500,
    "successfulQueries": 1485,
    "failedQueries": 15,
    "averageQueryTime": 12.5,
    "slowQueries": 3
  },
  "connectors": {
    "total": 8,
    "connected": 7
  }
}
```

### System Information
```bash
GET /health/system
```

Response:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "system": {
    "platform": "linux",
    "arch": "x64",
    "nodeVersion": "v18.17.0",
    "uptime": 3600,
    "memory": {
      "total": 8589934592,
      "free": 3006477107,
      "used": 5583457485
    },
    "cpu": {
      "cores": 8,
      "loadAverage": [1.2, 1.1, 0.9]
    },
    "network": ["eth0", "lo"]
  },
  "process": {
    "pid": 12345,
    "memoryUsage": {
      "rss": 52428800,
      "heapTotal": 20971520,
      "heapUsed": 15728640,
      "external": 1048576
    },
    "cpuUsage": {
      "user": 1500000,
      "system": 500000
    }
  }
}
```

### Kubernetes Health Checks

#### Readiness Check
```bash
GET /ready
```

Response:
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Liveness Check
```bash
GET /live
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Integration

### Event Bus Integration
The health monitor emits events that can be processed by the flow system:

```javascript
// Health update event
{
  type: 'health:update',
  data: {
    status: 'healthy',
    checks: { /* health check results */ },
    alerts: [ /* current alerts */ ]
  }
}

// Health alert event
{
  type: 'health:alert',
  data: {
    type: 'memory',
    message: 'High memory usage: 85.2%',
    severity: 'warning'
  }
}
```

### MQTT Integration
Health metrics are published to MQTT topics:

```bash
# Health status updates
babelfish/health/status

# Health alerts
babelfish/health/alerts

# Performance metrics
babelfish/health/metrics
```

## Monitoring and Alerting

### Threshold Configuration
Configure thresholds based on your system requirements:

```javascript
// Conservative thresholds for production
{
  memoryThreshold: 0.7,    // Alert at 70% memory usage
  cpuThreshold: 0.6,       // Alert at 60% CPU usage
  diskThreshold: 0.8,      // Alert at 80% disk usage
  connectionThreshold: 500, // Alert at 500 connections
  errorThreshold: 50       // Alert at 50 errors
}

// Aggressive thresholds for development
{
  memoryThreshold: 0.9,    // Alert at 90% memory usage
  cpuThreshold: 0.8,       // Alert at 80% CPU usage
  diskThreshold: 0.95,     // Alert at 95% disk usage
  connectionThreshold: 1000, // Alert at 1000 connections
  errorThreshold: 100      // Alert at 100 errors
}
```

### Alert Actions
Configure automated actions for health alerts:

```javascript
// Example rule for memory alerts
{
  id: 'memory-alert-action',
  name: 'Memory Alert Action',
  conditions: [
    {
      type: 'health:alert',
      field: 'type',
      operator: 'equals',
      value: 'memory'
    }
  ],
  actions: [
    {
      type: 'send_notification',
      parameters: {
        channel: 'slack',
        message: 'High memory usage detected: {{alert.message}}'
      }
    },
    {
      type: 'log_event',
      parameters: {
        level: 'warning',
        message: 'Memory alert: {{alert.message}}'
      }
    }
  ]
}
```

## Troubleshooting

### Common Issues

#### Health Checks Failing
- Check if the health monitor service is running
- Verify configuration values are correct
- Check system resources manually

#### High Memory Usage
- Review memory-intensive operations
- Check for memory leaks in connectors
- Consider increasing system memory

#### High CPU Usage
- Identify CPU-intensive operations
- Check for infinite loops or blocking operations
- Consider optimizing database queries

#### Database Connection Issues
- Check database server status
- Verify connection pool configuration
- Review query performance

### Debug Mode
Enable debug logging for health monitoring:

```bash
LOG_LEVEL=debug npm start
```

### Manual Health Check
Test health endpoints manually:

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed health status
curl http://localhost:3000/health/detailed

# Performance metrics
curl http://localhost:3000/health/metrics
```

## Best Practices

1. **Set Appropriate Thresholds**: Configure thresholds based on your system's capacity and requirements
2. **Monitor Trends**: Watch for gradual performance degradation over time
3. **Set Up Alerting**: Configure notifications for critical health issues
4. **Regular Reviews**: Periodically review and adjust health monitoring configuration
5. **Documentation**: Keep track of health monitoring configuration and any changes made 