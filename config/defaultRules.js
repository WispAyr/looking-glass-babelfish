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

  // UniFi Protect Smart Detect Zone Rule
  {
    id: 'unifi-smart-detect-zone-rule',
    name: 'UniFi Protect Smart Detect Zone',
    description: 'Handle smart detect zone events from UniFi Protect cameras',
    conditions: {
      eventType: 'smartDetectZone',
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🤖 Smart Detection Alert: {{data.smartDetectTypes.0}} detected on camera {{deviceId}}',
          priority: 'medium',
          channels: ['gui']
        }
      },
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'unifi/events/smart-detect-zone',
          payload: {
            type: 'smartDetectZone',
            cameraId: '{{deviceId}}',
            detectionTypes: '{{data.smartDetectTypes}}',
            confidence: '{{data.score}}',
            timestamp: '{{timestamp}}',
            source: '{{source}}'
          },
          qos: 1
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Smart detect zone event processed',
          data: {
            rule: 'unifi-smart-detect-zone-rule',
            eventType: '{{type}}',
            cameraId: '{{deviceId}}',
            detectionTypes: '{{data.smartDetectTypes}}',
            confidence: '{{data.score}}'
          }
        }
      },
      {
        type: 'store_data',
        parameters: {
          key: 'smart_detections',
          value: {
            cameraId: '{{deviceId}}',
            detectionTypes: '{{data.smartDetectTypes}}',
            confidence: '{{data.score}}',
            timestamp: '{{timestamp}}',
            eventId: '{{eventId}}'
          },
          ttl: 3600 // 1 hour
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
  },

  // Telegram Motion Alert Rule
  {
    id: 'telegram-motion-alert-rule',
    name: 'Telegram Motion Alert',
    description: 'Send motion detection alerts to Telegram channel',
    conditions: {
      eventType: 'motionDetected',
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'telegram_send',
        parameters: {
          connectorId: 'telegram-bot',
          operation: 'text',
          chatId: '@fhNYM0MnPJQ2NjE8',
          text: '🚨 *Motion Detected* 🚨\n\n📹 Camera: {{data.cameraId}}\n📍 Location: {{data.entityId}}\n⏰ Time: {{timestamp}}\n\nMotion activity detected on your UniFi Protect system.',
          parseMode: 'Markdown'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Motion alert sent to Telegram',
          data: {
            rule: 'telegram-motion-alert-rule',
            eventType: '{{type}}',
            cameraId: '{{data.cameraId}}',
            telegramChat: '@fhNYM0MnPJQ2NjE8'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'telegram',
      priority: 2
    }
  },

  // Telegram Smart Detect Alert Rule
  {
    id: 'telegram-smart-detect-alert-rule',
    name: 'Telegram Smart Detect Alert',
    description: 'Send smart detection alerts to Telegram channel',
    conditions: {
      eventType: 'smartDetected',
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'telegram_send',
        parameters: {
          connectorId: 'telegram-bot',
          operation: 'text',
          chatId: '@fhNYM0MnPJQ2NjE8',
          text: '🤖 *Smart Detection Alert* 🤖\n\n📹 Camera: {{data.cameraId}}\n📍 Location: {{data.entityId}}\n🔍 Detection: {{data.event.type}}\n⏰ Time: {{timestamp}}\n\nSmart detection triggered on your UniFi Protect system.',
          parseMode: 'Markdown'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Smart detect alert sent to Telegram',
          data: {
            rule: 'telegram-smart-detect-alert-rule',
            eventType: '{{type}}',
            cameraId: '{{data.cameraId}}',
            telegramChat: '@fhNYM0MnPJQ2NjE8'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'telegram',
      priority: 2
    }
  },

  // Telegram Recording Event Rule
  {
    id: 'telegram-recording-event-rule',
    name: 'Telegram Recording Event',
    description: 'Send recording event notifications to Telegram channel',
    conditions: {
      eventType: 'recordingEvent',
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'telegram_send',
        parameters: {
          connectorId: 'telegram-bot',
          operation: 'text',
          chatId: '@fhNYM0MnPJQ2NjE8',
          text: '📹 *Recording Event* 📹\n\n📹 Camera: {{data.cameraId}}\n📍 Location: {{data.entityId}}\n🎬 Action: {{data.event.action}}\n⏰ Time: {{timestamp}}\n\nRecording event occurred on your UniFi Protect system.',
          parseMode: 'Markdown'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Recording event sent to Telegram',
          data: {
            rule: 'telegram-recording-event-rule',
            eventType: '{{type}}',
            cameraId: '{{data.cameraId}}',
            telegramChat: '@fhNYM0MnPJQ2NjE8'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'telegram',
      priority: 1
    }
  },

  // Telegram Connection Event Rule
  {
    id: 'telegram-connection-event-rule',
    name: 'Telegram Connection Event',
    description: 'Send connection status changes to Telegram channel',
    conditions: {
      eventType: 'connectionEvent',
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'telegram_send',
        parameters: {
          connectorId: 'telegram-bot',
          operation: 'text',
          chatId: '@fhNYM0MnPJQ2NjE8',
          text: '🔌 *Connection Event* 🔌\n\n📹 Camera: {{data.cameraId}}\n📍 Location: {{data.entityId}}\n🔗 Status: {{data.event.status}}\n⏰ Time: {{timestamp}}\n\nCamera connection status changed on your UniFi Protect system.',
          parseMode: 'Markdown'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Connection event sent to Telegram',
          data: {
            rule: 'telegram-connection-event-rule',
            eventType: '{{type}}',
            cameraId: '{{data.cameraId}}',
            telegramChat: '@fhNYM0MnPJQ2NjE8'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'telegram',
      priority: 1
    }
  },

  // Telegram Camera Added/Removed Rule
  {
    id: 'telegram-camera-management-rule',
    name: 'Telegram Camera Management',
    description: 'Send camera addition/removal notifications to Telegram channel',
    conditions: {
      eventType: ['cameraAdded', 'cameraRemoved'],
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'telegram_send',
        parameters: {
          connectorId: 'telegram-bot',
          operation: 'text',
          chatId: '@fhNYM0MnPJQ2NjE8',
          text: '📷 *Camera Management* 📷\n\n📹 Camera: {{data.cameraId}}\n📍 Location: {{data.entityId}}\n🔄 Action: {{type}}\n⏰ Time: {{timestamp}}\n\nCamera {{#if (eq type "cameraAdded")}}added to{{else}}removed from{{/if}} your UniFi Protect system.',
          parseMode: 'Markdown'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Camera management event sent to Telegram',
          data: {
            rule: 'telegram-camera-management-rule',
            eventType: '{{type}}',
            cameraId: '{{data.cameraId}}',
            telegramChat: '@fhNYM0MnPJQ2NjE8'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'telegram',
      priority: 1
    }
  },

  // ADSB Emergency Squawk Rule
  {
    id: 'adsb-emergency-squawk-rule',
    name: 'ADSB Emergency Squawk Alert',
    description: 'Alert on emergency squawk codes from aircraft',
    conditions: {
      eventType: 'emergency:detected',
      source: 'adsb-main'
    },
    actions: [
      {
        type: 'telegram_send',
        parameters: {
          connectorId: 'telegram-bot',
          operation: 'text',
          chatId: '@fhNYM0MnPJQ2NjE8',
          text: '🚨 *EMERGENCY SQUAWK DETECTED* 🚨\n\n✈️ Aircraft: {{data.aircraft.callsign}} ({{data.aircraft.icao24}})\n🆘 Emergency Type: {{data.emergencyType}}\n🔢 Squawk: {{data.squawk}}\n📍 Position: {{data.aircraft.lat}}, {{data.aircraft.lon}}\n🛫 Altitude: {{data.aircraft.altitude}}ft\n⏰ Time: {{timestamp}}\n\nEmergency squawk code detected on aircraft!',
          parseMode: 'Markdown'
        }
      },
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'adsb/events/emergency',
          payload: {
            type: 'emergency:detected',
            aircraft: '{{data.aircraft.icao24}}',
            callsign: '{{data.aircraft.callsign}}',
            emergencyType: '{{data.emergencyType}}',
            squawk: '{{data.squawk}}',
            timestamp: '{{timestamp}}',
            source: '{{source}}'
          },
          qos: 2
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'warn',
          message: 'Emergency squawk detected',
          data: {
            rule: 'adsb-emergency-squawk-rule',
            aircraft: '{{data.aircraft.icao24}}',
            emergencyType: '{{data.emergencyType}}',
            squawk: '{{data.squawk}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'adsb',
      priority: 3
    }
  },

  // ADSB Airspace Entry Rule
  {
    id: 'adsb-airspace-entry-rule',
    name: 'ADSB Airspace Entry Alert',
    description: 'Alert when aircraft enter controlled airspace',
    conditions: {
      eventType: 'airspace:entry',
      source: 'adsb-main'
    },
    actions: [
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'adsb/events/airspace-entry',
          payload: {
            type: 'airspace:entry',
            aircraft: '{{data.aircraft.icao24}}',
            callsign: '{{data.aircraft.callsign}}',
            airspace: '{{data.airspace.name}}',
            airspaceType: '{{data.airspace.type}}',
            timestamp: '{{timestamp}}',
            source: '{{source}}'
          },
          qos: 1
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Aircraft entered airspace',
          data: {
            rule: 'adsb-airspace-entry-rule',
            aircraft: '{{data.aircraft.icao24}}',
            airspace: '{{data.airspace.name}}',
            airspaceType: '{{data.airspace.type}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'adsb',
      priority: 2
    }
  },

  // ADSB Approach Detection Rule
  {
    id: 'adsb-approach-detection-rule',
    name: 'ADSB Approach Detection',
    description: 'Alert when aircraft are on approach',
    conditions: {
      eventType: 'approach:detected',
      source: 'adsb-main'
    },
    actions: [
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'adsb/events/approach',
          payload: {
            type: 'approach:detected',
            aircraft: '{{data.aircraft.icao24}}',
            callsign: '{{data.aircraft.callsign}}',
            runway: '{{data.airspace.name}}',
            airport: '{{data.metadata.airport}}',
            confidence: '{{data.metadata.confidence}}',
            timestamp: '{{timestamp}}',
            source: '{{source}}'
          },
          qos: 1
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Aircraft on approach detected',
          data: {
            rule: 'adsb-approach-detection-rule',
            aircraft: '{{data.aircraft.icao24}}',
            runway: '{{data.airspace.name}}',
            airport: '{{data.metadata.airport}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'adsb',
      priority: 2
    }
  },

  // ADSB Status Monitoring Rule
  {
    id: 'adsb-status-monitoring-rule',
    name: 'ADSB Status Monitoring',
    description: 'Monitor ADSB system status and performance',
    conditions: {
      eventType: 'adsb:status',
      source: 'adsb-main'
    },
    actions: [
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'adsb/status',
          payload: {
            type: 'adsb:status',
            aircraftCount: '{{data.aircraftCount}}',
            activeFlights: '{{data.activeFlights}}',
            responseTime: '{{data.responseTime}}',
            pollCount: '{{data.metadata.pollCount}}',
            timestamp: '{{timestamp}}',
            source: '{{source}}'
          },
          qos: 0,
          retain: true
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'debug',
          message: 'ADSB status update',
          data: {
            rule: 'adsb-status-monitoring-rule',
            aircraftCount: '{{data.aircraftCount}}',
            activeFlights: '{{data.activeFlights}}',
            responseTime: '{{data.responseTime}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'adsb',
      priority: 0
    }
  },

  // UniFi Protect Motion Rule
  {
    id: 'unifi-motion-rule',
    name: 'UniFi Protect Motion Detection',
    description: 'Handle motion events from UniFi Protect cameras',
    conditions: {
      eventType: 'motion',
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'unifi/events/motion',
          payload: {
            type: 'motion',
            cameraId: '{{data.cameraId}}',
            entityId: '{{data.entityId}}',
            timestamp: '{{timestamp}}',
            source: '{{source}}',
            metadata: {
              rule: 'unifi-motion-rule',
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
          message: 'Motion event processed from UniFi Protect',
          data: {
            rule: 'unifi-motion-rule',
            eventType: '{{type}}',
            cameraId: '{{data.cameraId}}',
            source: '{{source}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'unifi',
      priority: 1
    }
  }
];

module.exports = {
  ...defaultRules,
  enableRemotionVideoRenders: false,
}; 