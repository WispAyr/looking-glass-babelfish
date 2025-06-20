/**
 * Default Rules for Babelfish Looking Glass
 * 
 * These rules are automatically loaded when the rule engine starts.
 * They provide basic event processing and notification capabilities.
 */

const defaultRules = [
  // Camera Events to MQTT Rule (NEW - Routes all camera events to MQTT)
  {
    id: 'camera-events-mqtt-rule',
    name: 'Camera Events to MQTT',
    description: 'Route all camera events to MQTT for external processing',
    conditions: {
      eventType: ['motionDetected', 'smartDetected', 'recordingEvent', 'connectionEvent', 'cameraAdded', 'cameraRemoved'],
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'camera/events/{{type}}',
          payload: {
            eventType: '{{type}}',
            cameraId: '{{data.cameraId}}',
            entityId: '{{data.entityId}}',
            timestamp: '{{timestamp}}',
            source: '{{source}}',
            connectorId: '{{data.connectorId}}',
            eventData: '{{data.event}}',
            metadata: {
              rule: 'camera-events-mqtt-rule',
              processed: true
            }
          },
          qos: 1,
          retain: false
        }
      },
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'camera/events/all',
          payload: {
            eventType: '{{type}}',
            cameraId: '{{data.cameraId}}',
            entityId: '{{data.entityId}}',
            timestamp: '{{timestamp}}',
            source: '{{source}}',
            connectorId: '{{data.connectorId}}',
            eventData: '{{data.event}}',
            metadata: {
              rule: 'camera-events-mqtt-rule',
              processed: true
            }
          },
          qos: 1,
          retain: false
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Camera event routed to MQTT',
          data: {
            rule: 'camera-events-mqtt-rule',
            eventType: '{{type}}',
            cameraId: '{{data.cameraId}}',
            topic: 'camera/events/{{type}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'mqtt',
      priority: 1
    }
  },

  // Motion Detection Rule
  {
    id: 'motion-notification-rule',
    name: 'Motion Detection Notification',
    description: 'Send notification when motion is detected',
    conditions: {
      eventType: 'motion',
      source: 'communications-van'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: 'Motion detected on van camera',
          priority: 'normal',
          channels: ['gui']
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Motion event processed',
          data: {
            rule: 'motion-notification-rule',
            source: '{{source}}',
            timestamp: '{{timestamp}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'notification',
      priority: 1
    }
  },

  // Smart Detect Zone Rule
  {
    id: 'smart-detect-alert-rule',
    name: 'Smart Detect Zone Alert',
    description: 'Handle smart detect zone events with enhanced alerts',
    conditions: {
      eventType: 'smartDetectZone',
      source: 'communications-van'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: 'Smart detect zone triggered - potential security event',
          priority: 'high',
          channels: ['gui', 'slack']
        }
      },
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'unifi/events/smart-detect',
          payload: {
            type: 'smartDetectZone',
            source: '{{source}}',
            timestamp: '{{timestamp}}',
            priority: 'high'
          },
          qos: 1
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'warn',
          message: 'Smart detect zone event - security alert',
          data: {
            rule: 'smart-detect-alert-rule',
            eventType: '{{type}}',
            source: '{{source}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'security',
      priority: 2
    }
  },

  // Ring Event Rule
  {
    id: 'ring-notification-rule',
    name: 'Doorbell Ring Notification',
    description: 'Handle doorbell ring events',
    conditions: {
      eventType: 'ring',
      source: 'communications-van'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: 'Doorbell ring detected at van',
          priority: 'normal',
          channels: ['gui']
        }
      },
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'unifi/events/ring',
          payload: {
            type: 'ring',
            source: '{{source}}',
            timestamp: '{{timestamp}}'
          },
          qos: 0
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'notification',
      priority: 1
    }
  },

  // LCD Message Rule
  {
    id: 'lcd-message-log-rule',
    name: 'LCD Message Logging',
    description: 'Log LCD message events for monitoring',
    conditions: {
      eventType: 'lcdMessage',
      source: 'communications-van'
    },
    actions: [
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'LCD message displayed',
          data: {
            rule: 'lcd-message-log-rule',
            message: '{{data.message}}',
            source: '{{source}}'
          }
        }
      },
      {
        type: 'store_data',
        parameters: {
          key: 'lcd_messages',
          value: {
            message: '{{data.message}}',
            timestamp: '{{timestamp}}',
            source: '{{source}}'
          },
          ttl: 86400 // 24 hours
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'logging',
      priority: 0
    }
  },

  // Time-based Motion Rule (Night Mode)
  {
    id: 'night-motion-alert-rule',
    name: 'Night Motion Alert',
    description: 'Enhanced motion alerts during night hours',
    conditions: {
      eventType: 'motion',
      source: 'communications-van',
      timeRange: {
        start: '22:00',
        end: '06:00'
      }
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🚨 NIGHT MOTION ALERT: Motion detected during night hours',
          priority: 'high',
          channels: ['gui', 'slack', 'email']
        }
      },
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'unifi/events/night-motion',
          payload: {
            type: 'motion',
            source: '{{source}}',
            timestamp: '{{timestamp}}',
            priority: 'high',
            timeOfDay: 'night'
          },
          qos: 2
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'warn',
          message: 'Night motion alert triggered',
          data: {
            rule: 'night-motion-alert-rule',
            source: '{{source}}',
            timeOfDay: 'night'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'security',
      priority: 3
    }
  },

  // System Health Monitoring Rule
  {
    id: 'system-health-rule',
    name: 'System Health Monitoring',
    description: 'Monitor system health and connectivity',
    conditions: {
      eventType: 'system',
      source: 'communications-van'
    },
    actions: [
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'System health check',
          data: {
            rule: 'system-health-rule',
            source: '{{source}}',
            status: '{{data.status}}'
          }
        }
      },
      {
        type: 'store_data',
        parameters: {
          key: 'system_health',
          value: {
            status: '{{data.status}}',
            timestamp: '{{timestamp}}',
            source: '{{source}}'
          },
          ttl: 3600 // 1 hour
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'monitoring',
      priority: 0
    }
  },

  // Multiple Motion Events Rule
  {
    id: 'multiple-motion-rule',
    name: 'Multiple Motion Events',
    description: 'Detect and alert on multiple motion events in short time',
    conditions: {
      eventType: 'motion',
      source: 'communications-van',
      custom: (event) => {
        // This would need to be implemented with state tracking
        // For now, just a placeholder
        return true;
      }
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '⚠️ Multiple motion events detected - possible activity',
          priority: 'medium',
          channels: ['gui']
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Multiple motion events detected',
          data: {
            rule: 'multiple-motion-rule',
            source: '{{source}}'
          }
        }
      }
    ],
    metadata: {
      enabled: false, // Disabled by default - needs state tracking
      category: 'security',
      priority: 2
    }
  }
];

module.exports = defaultRules; 