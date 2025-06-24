/**
 * Default Rules for Babelfish Looking Glass
 * 
 * These rules are automatically loaded when the rule engine starts.
 * They provide basic event processing and notification capabilities.
 * 
 * NOTE: Temporarily configured for Telegram-only notifications until system is fully working.
 */

const defaultRules = [
  // Camera Events to MQTT Rule (DISABLED - Focus on Telegram)
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
      enabled: false, // Temporarily disabled
      category: 'mqtt',
      priority: 1
    }
  },

  // Ring Event Rule (CHANGED TO TELEGRAM)
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
          message: '🚪 <b>Doorbell Ring Detected</b>\n\n📍 <b>Location:</b> Communications Van\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Someone is at the door</i>',
          priority: 'normal',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Doorbell ring event processed',
          data: {
            rule: 'ring-notification-rule',
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

  // LCD Message Rule (CHANGED TO TELEGRAM)
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
        type: 'send_notification',
        parameters: {
          message: '📺 <b>LCD Message Displayed</b>\n\n💬 <b>Message:</b> {{data.message}}\n📍 <b>Source:</b> {{source}}\n🕐 <b>Time:</b> {{timestamp}}',
          priority: 'low',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
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
      }
    ],
    metadata: {
      enabled: true,
      category: 'logging',
      priority: 0
    }
  },

  // UniFi Protect Smart Detect Zone Rule (CHANGED TO TELEGRAM)
  {
    id: 'unifi-smart-detect-zone-rule',
    name: 'UniFi Protect Smart Detection Zone',
    description: 'Handle smart detection zone events from UniFi Protect cameras',
    conditions: {
      eventType: 'smartDetectZone',
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🤖 <b>Smart Detection Alert</b>\n\n📷 <b>Camera:</b> {{deviceId}}\n🔍 <b>Detection:</b> {{data.smartDetectTypes.0}}\n📊 <b>Confidence:</b> {{data.score}}%\n📍 <b>Source:</b> {{source}}\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>AI-powered detection triggered on security camera</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
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
      }
    ],
    metadata: {
      enabled: true,
      category: 'security',
      priority: 2
    }
  },

  // Time-based Motion Rule (Night Mode) - CHANGED TO TELEGRAM
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
          message: '🚨 <b>NIGHT MOTION ALERT</b> 🚨\n\n🌙 <b>Time:</b> Night Hours (22:00-06:00)\n📍 <b>Source:</b> {{source}}\n🕐 <b>Detected:</b> {{timestamp}}\n\n<i>Motion detected during night hours - potential security concern</i>',
          priority: 'high',
          channels: ['telegram'],
          parseMode: 'HTML'
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

  // System Health Monitoring Rule (CHANGED TO TELEGRAM)
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
        type: 'send_notification',
        parameters: {
          message: '💻 <b>System Health Check</b>\n\n📊 <b>Status:</b> {{data.status}}\n📍 <b>Source:</b> {{source}}\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>System health monitoring active</i>',
          priority: 'low',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
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
      }
    ],
    metadata: {
      enabled: true,
      category: 'monitoring',
      priority: 0
    }
  },

  // Multiple Motion Events Rule (CHANGED TO TELEGRAM)
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
          message: '⚠️ <b>Multiple Motion Events</b>\n\n🔄 <b>Status:</b> Multiple motion events detected\n📍 <b>Source:</b> {{source}}\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Possible activity detected - multiple motion events in short time</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
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

  // UniFi Motion Detection Rule (CHANGED TO TELEGRAM)
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
        type: 'send_notification',
        parameters: {
          message: '🎥 <b>Motion Detected - UniFi Protect</b>\n\n📷 <b>Camera:</b> {{deviceId}}\n📍 <b>Source:</b> {{source}}\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Motion activity detected on security camera</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
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
            cameraId: '{{deviceId}}',
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

  // UniFi Smart Detection Rule (CHANGED TO TELEGRAM)
  {
    id: 'unifi-smart-detect-rule',
    name: 'UniFi Protect Smart Detection',
    description: 'Handle smart detection events from UniFi Protect cameras',
    conditions: {
      eventType: 'smartDetectZone',
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🤖 <b>Smart Detection - UniFi Protect</b>\n\n📷 <b>Camera:</b> {{deviceId}}\n🔍 <b>Detection:</b> {{data.smartDetectTypes.0}}\n📊 <b>Confidence:</b> {{data.score}}%\n📍 <b>Source:</b> {{source}}\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>AI-powered detection triggered on security camera</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Smart detection event processed from UniFi Protect',
          data: {
            rule: 'unifi-smart-detect-rule',
            eventType: '{{type}}',
            cameraId: '{{deviceId}}',
            detectionType: '{{data.smartDetectTypes.0}}',
            confidence: '{{data.score}}'
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

  // UniFi General Events Rule (CHANGED TO TELEGRAM)
  {
    id: 'unifi-general-events-rule',
    name: 'UniFi Protect General Events',
    description: 'Handle general events from UniFi Protect cameras (recording, connection, camera management)',
    conditions: {
      eventType: ['recordingEvent', 'connectionEvent', 'cameraAdded', 'cameraRemoved'],
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '📹 <b>UniFi Protect Event</b>\n\n📷 <b>Camera:</b> {{deviceId}}\n🔄 <b>Event:</b> {{type}}\n📍 <b>Source:</b> {{source}}\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>System event occurred on UniFi Protect camera</i>',
          priority: 'low',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'UniFi Protect event processed',
          data: {
            rule: 'unifi-general-events-rule',
            eventType: '{{type}}',
            cameraId: '{{deviceId}}',
            source: '{{source}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'monitoring',
      priority: 1
    }
  },

  // ADSB Emergency Alert Rule (CHANGED TO TELEGRAM)
  {
    id: 'adsb-emergency-alert-rule',
    name: 'ADSB Emergency Alert',
    description: 'Alert on emergency squawk codes and emergency events',
    conditions: {
      eventType: 'aircraft:emergency',
      source: 'adsb-main'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🚨 <b>EMERGENCY AIRCRAFT ALERT</b> 🚨\n\n✈️ <b>Aircraft:</b> {{data.icao24}}\n📞 <b>Callsign:</b> {{data.callsign}}\n🚨 <b>Emergency:</b> {{data.emergencyType}}\n🔢 <b>Squawk:</b> {{data.squawk}}\n📍 <b>Location:</b> {{data.latitude}}°, {{data.longitude}}°\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Emergency aircraft detected - immediate attention required</i>',
          priority: 'critical',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'error',
          message: 'Emergency aircraft detected',
          data: {
            rule: 'adsb-emergency-alert-rule',
            aircraft: '{{data.icao24}}',
            callsign: '{{data.callsign}}',
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

  // ADSB Airspace Entry Rule (CHANGED TO TELEGRAM)
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
        type: 'send_notification',
        parameters: {
          message: '🛩️ <b>Aircraft Entered Airspace</b>\n\n✈️ <b>Aircraft:</b> {{data.aircraft.icao24}}\n📞 <b>Callsign:</b> {{data.aircraft.callsign}}\n🏢 <b>Airspace:</b> {{data.airspace.name}}\n📋 <b>Type:</b> {{data.airspace.type}}\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Aircraft has entered controlled airspace</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
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

  // ADSB Approach Detection Rule (CHANGED TO TELEGRAM)
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
        type: 'send_notification',
        parameters: {
          message: '🛬 <b>Aircraft on Approach</b>\n\n✈️ <b>Aircraft:</b> {{data.aircraft.icao24}}\n📞 <b>Callsign:</b> {{data.aircraft.callsign}}\n🛣️ <b>Runway:</b> {{data.airspace.name}}\n🏢 <b>Airport:</b> {{data.metadata.airport}}\n📊 <b>Confidence:</b> {{data.metadata.confidence}}%\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Aircraft detected on approach to runway</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
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

  // ADSB Status Monitoring Rule (CHANGED TO TELEGRAM)
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
        type: 'send_notification',
        parameters: {
          message: '📡 <b>ADSB System Status</b>\n\n✈️ <b>Aircraft Tracked:</b> {{data.aircraftCount}}\n🛫 <b>Active Flights:</b> {{data.activeFlights}}\n⚡ <b>Response Time:</b> {{data.responseTime}}ms\n🔄 <b>Poll Count:</b> {{data.metadata.pollCount}}\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>ADSB system status update</i>',
          priority: 'low',
          channels: ['telegram'],
          parseMode: 'HTML'
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

  // Prestwick Airport Notification Rule (REMOVED MQTT)
  {
    id: 'prestwick-airport-notification-rule',
    name: 'Prestwick Airport Notifications',
    description: 'Handle aircraft notifications from Prestwick Airport Connector',
    conditions: {
      eventType: 'alarm:notification',
      source: 'prestwick-airport'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '{{message}}',
          priority: '{{priority}}',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Prestwick airport notification processed',
          data: {
            rule: 'prestwick-airport-notification-rule',
            eventType: '{{data.eventType}}',
            aircraft: '{{data.aircraft.icao24}}',
            callsign: '{{data.aircraft.callsign}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'prestwick',
      priority: 2
    }
  },

  // Prestwick Aircraft Operations Rule
  {
    id: 'prestwick-aircraft-operations-rule',
    name: 'Prestwick Aircraft Operations',
    description: 'Handle aircraft operation events from Prestwick Airport',
    conditions: {
      eventType: ['prestwick:approach', 'prestwick:landing', 'prestwick:takeoff', 'prestwick:departure', 'prestwick:en_route'],
      source: 'prestwick-airport'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '✈️ <b>Aircraft Operation - EGPK</b>\n\n🆔 <b>ICAO:</b> {{data.icao24}}\n📻 <b>Callsign:</b> {{data.callsign}}\n🛫 <b>Registration:</b> {{data.registration}}\n📍 <b>Operation:</b> {{type}}\n🛫 <b>Altitude:</b> {{data.altitude}}ft\n🛩️ <b>Speed:</b> {{data.speed}}kts\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Aircraft {{type}} at Prestwick Airport</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Prestwick aircraft operation processed',
          data: {
            rule: 'prestwick-aircraft-operations-rule',
            eventType: '{{type}}',
            aircraft: '{{data.icao24}}',
            callsign: '{{data.callsign}}',
            operation: '{{type}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'prestwick',
      priority: 2
    }
  },

  // Prestwick Ground Movement Rule
  {
    id: 'prestwick-ground-movement-rule',
    name: 'Prestwick Ground Movement',
    description: 'Handle ground movement events from Prestwick Airport',
    conditions: {
      eventType: 'prestwick:ground:movement',
      source: 'prestwick-airport'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🚗 <b>Ground Movement - EGPK</b>\n\n🆔 <b>ICAO:</b> {{data.icao24}}\n📻 <b>Callsign:</b> {{data.callsign}}\n🛫 <b>Registration:</b> {{data.registration}}\n📍 <b>Movement:</b> {{data.movementType}}\n📊 <b>Confidence:</b> {{data.confidence}}%\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Aircraft ground movement detected at Prestwick</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Prestwick ground movement processed',
          data: {
            rule: 'prestwick-ground-movement-rule',
            aircraft: '{{data.icao24}}',
            movementType: '{{data.movementType}}',
            confidence: '{{data.confidence}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'prestwick',
      priority: 2
    }
  },

  // Prestwick Taxi Movement Rule
  {
    id: 'prestwick-taxi-movement-rule',
    name: 'Prestwick Taxi Movement',
    description: 'Handle taxi movement events from Prestwick Airport',
    conditions: {
      eventType: 'prestwick:taxi:movement',
      source: 'prestwick-airport'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🚗 <b>Taxi Movement - EGPK</b>\n\n🆔 <b>ICAO:</b> {{data.icao24}}\n📻 <b>Callsign:</b> {{data.callsign}}\n🛫 <b>Registration:</b> {{data.registration}}\n📍 <b>Phase:</b> {{data.taxiPhase}}\n📊 <b>Confidence:</b> {{data.confidence}}%\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Aircraft taxiing at Prestwick Airport</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Prestwick taxi movement processed',
          data: {
            rule: 'prestwick-taxi-movement-rule',
            aircraft: '{{data.icao24}}',
            taxiPhase: '{{data.taxiPhase}}',
            confidence: '{{data.confidence}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'prestwick',
      priority: 2
    }
  },

  // Prestwick Parking Status Rule
  {
    id: 'prestwick-parking-status-rule',
    name: 'Prestwick Parking Status',
    description: 'Handle parking status events from Prestwick Airport',
    conditions: {
      eventType: 'prestwick:parking:status',
      source: 'prestwick-airport'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🅿️ <b>Parking Status - EGPK</b>\n\n🆔 <b>ICAO:</b> {{data.icao24}}\n📻 <b>Callsign:</b> {{data.callsign}}\n🛫 <b>Registration:</b> {{data.registration}}\n📍 <b>Area:</b> {{data.parkingArea}}\n📊 <b>Confidence:</b> {{data.confidence}}%\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Aircraft parking status at Prestwick</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Prestwick parking status processed',
          data: {
            rule: 'prestwick-parking-status-rule',
            aircraft: '{{data.icao24}}',
            parkingArea: '{{data.parkingArea}}',
            confidence: '{{data.confidence}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'prestwick',
      priority: 2
    }
  },

  // Prestwick Helicopter Action Rule
  {
    id: 'prestwick-helicopter-action-rule',
    name: 'Prestwick Helicopter Action',
    description: 'Handle helicopter action events from Prestwick Airport',
    conditions: {
      eventType: 'prestwick:helicopter:action',
      source: 'prestwick-airport'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🚁 <b>Helicopter Action - EGPK</b>\n\n🆔 <b>ICAO:</b> {{data.icao24}}\n📻 <b>Callsign:</b> {{data.callsign}}\n🛫 <b>Registration:</b> {{data.registration}}\n📍 <b>Action:</b> {{data.action}}\n📊 <b>Confidence:</b> {{data.confidence}}%\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Helicopter activity at Prestwick Airport</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Prestwick helicopter action processed',
          data: {
            rule: 'prestwick-helicopter-action-rule',
            aircraft: '{{data.icao24}}',
            action: '{{data.action}}',
            confidence: '{{data.confidence}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'prestwick',
      priority: 2
    }
  },

  // Prestwick NOTAM Alert Rule
  {
    id: 'prestwick-notam-alert-rule',
    name: 'Prestwick NOTAM Alert',
    description: 'Handle NOTAM alert events from Prestwick Airport',
    conditions: {
      eventType: 'prestwick:notam:alert',
      source: 'prestwick-airport'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '⚠️ <b>NOTAM Alert - EGPK</b>\n\n📋 <b>NOTAM:</b> {{data.notamNumber}}\n📝 <b>Title:</b> {{data.title}}\n🎯 <b>Priority:</b> {{data.priority}}\n📍 <b>Category:</b> {{data.category}}\n📏 <b>Distance:</b> {{data.distance}}km\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>NOTAM affecting Prestwick operations</i>',
          priority: 'high',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'warn',
          message: 'Prestwick NOTAM alert processed',
          data: {
            rule: 'prestwick-notam-alert-rule',
            notamNumber: '{{data.notamNumber}}',
            priority: '{{data.priority}}',
            category: '{{data.category}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'prestwick',
      priority: 3
    }
  },

  // Prestwick New NOTAM Rule
  {
    id: 'prestwick-new-notam-rule',
    name: 'Prestwick New NOTAM',
    description: 'Handle new NOTAM events from Prestwick Airport',
    conditions: {
      eventType: 'prestwick:notam:new',
      source: 'prestwick-airport'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🆕 <b>NEW NOTAM - EGPK</b>\n\n📋 <b>NOTAM:</b> {{data.notamNumber}}\n📝 <b>Title:</b> {{data.title}}\n🎯 <b>Priority:</b> {{data.priority}}\n📍 <b>Category:</b> {{data.category}}\n📏 <b>Distance:</b> {{data.distance}}km\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>New NOTAM detected affecting Prestwick</i>',
          priority: 'high',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Prestwick new NOTAM processed',
          data: {
            rule: 'prestwick-new-notam-rule',
            notamNumber: '{{data.notamNumber}}',
            priority: '{{data.priority}}',
            category: '{{data.category}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'prestwick',
      priority: 3
    }
  },

  // NOTAM Alert Rule (Telegram Only)
  {
    id: 'notam-alert-telegram-rule',
    name: 'NOTAM Alert - Telegram Only',
    description: 'Send NOTAM alerts to Telegram only',
    conditions: {
      eventType: 'alarm:notification',
      source: 'prestwick-airport',
      data: {
        type: 'notam:alert'
      }
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '{{message}}',
          priority: 'high',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'warn',
          message: 'NOTAM alert sent to Telegram',
          data: {
            rule: 'notam-alert-telegram-rule',
            notamNumber: '{{data.notamAlert.notamNumber}}',
            priority: '{{data.notamAlert.priority}}',
            operationType: '{{data.notamAlert.operationType}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'aviation',
      priority: 3
    }
  },

  // Airspace Events Rule (CHANGED TO TELEGRAM ONLY)
  {
    id: 'airspace-events-rule',
    name: 'Airspace Events',
    description: 'Handle airspace boundary events from Prestwick Airport',
    conditions: {
      eventType: ['airspace:entered', 'airspace:exited', 'airspace:approach_zone', 'airspace:terminal_area'],
      source: 'prestwick-airport'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🛩️ <b>Airspace Event - EGPK</b>\n\n✈️ <b>Aircraft:</b> {{data.callsign}} ({{data.registration}})\n🆔 <b>ICAO:</b> {{data.icao24}}\n📍 <b>Event:</b> {{type}}\n📏 <b>Distance:</b> {{data.distance}}m\n🛫 <b>Altitude:</b> {{data.altitude}}ft\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Aircraft {{type}} EGPK airspace</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Airspace event processed',
          data: {
            rule: 'airspace-events-rule',
            eventType: '{{type}}',
            aircraft: '{{data.icao24}}',
            callsign: '{{data.callsign}}',
            distance: '{{data.distance}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'aviation',
      priority: 2
    }
  },

  // ADSB Aircraft Detection Rule
  {
    id: 'adsb-aircraft-detection-rule',
    name: 'ADSB Aircraft Detection',
    description: 'Notify when new aircraft are detected via ADSB',
    conditions: {
      eventType: 'aircraft:detected',
      source: 'adsb-main'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '✈️ <b>New Aircraft Detected</b>\n\n🆔 <b>ICAO:</b> {{data.aircraft.icao24}}\n📻 <b>Callsign:</b> {{data.aircraft.callsign || "Unknown"}}\n📍 <b>Altitude:</b> {{data.aircraft.altitude || "Unknown"}} ft\n🛩️ <b>Type:</b> {{data.aircraft.type || "Unknown"}}\n\n🕐 <i>{{timestamp}}</i>',
          priority: 'normal',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'New aircraft detected via ADSB',
          data: {
            rule: 'adsb-aircraft-detection-rule',
            icao24: '{{data.aircraft.icao24}}',
            callsign: '{{data.aircraft.callsign}}',
            altitude: '{{data.aircraft.altitude}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'aviation',
      priority: 1
    }
  },

  // ADSB Aircraft Emergency Rule (CHANGED TO TELEGRAM ONLY)
  {
    id: 'aircraft-emergency-alert',
    name: 'Aircraft Emergency Alert',
    description: 'High priority alert for emergency aircraft',
    conditions: {
      eventType: 'aircraft:emergency',
      source: 'adsb-main'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🚨 <b>EMERGENCY AIRCRAFT ALERT</b> 🚨\n\n🆔 <b>ICAO:</b> {{data.aircraft.icao24}}\n📻 <b>Callsign:</b> {{data.aircraft.callsign || "Unknown"}}\n⚠️ <b>Squawk:</b> {{data.aircraft.squawk}}\n📍 <b>Altitude:</b> {{data.aircraft.altitude || "Unknown"}} ft\n🛩️ <b>Type:</b> {{data.aircraft.type || "Unknown"}}\n\n🕐 <i>{{timestamp}}</i>',
          priority: 'high',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'error',
          message: 'Emergency aircraft detected',
          data: {
            eventType: '{{eventType}}',
            source: '{{source}}',
            timestamp: '{{timestamp}}',
            icao24: '{{data.aircraft.icao24}}',
            callsign: '{{data.aircraft.callsign}}'
          }
        }
      }
    ],
    metadata: {
      autoGenerated: false,
      category: 'aviation',
      connectorType: 'adsb',
      createdAt: '2025-06-23T00:00:00.000Z',
      version: '1.0.0'
    },
    enabled: true
  },

  // ADSB Airspace Entry Rule
  {
    id: 'adsb-airspace-entry-rule',
    name: 'ADSB Airspace Entry',
    description: 'Notify when aircraft enter controlled airspace',
    conditions: {
      eventType: 'airspace:entry',
      source: 'adsb-main'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🛫 <b>Aircraft Entering Airspace</b>\n\n🆔 <b>ICAO:</b> {{data.aircraft.icao24}}\n📻 <b>Callsign:</b> {{data.aircraft.callsign || "Unknown"}}\n🏢 <b>Airspace:</b> {{data.airspace}}\n📍 <b>Altitude:</b> {{data.aircraft.altitude || "Unknown"}} ft\n\n🕐 <i>{{timestamp}}</i>',
          priority: 'normal',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Aircraft entering controlled airspace',
          data: {
            rule: 'adsb-airspace-entry-rule',
            icao24: '{{data.aircraft.icao24}}',
            airspace: '{{data.airspace}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'aviation',
      priority: 1
    }
  },

  // ADSB Airspace Exit Rule
  {
    id: 'adsb-airspace-exit-rule',
    name: 'ADSB Airspace Exit',
    description: 'Notify when aircraft exit controlled airspace',
    conditions: {
      eventType: 'airspace:exit',
      source: 'adsb-main'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🛬 <b>Aircraft Exiting Airspace</b>\n\n🆔 <b>ICAO:</b> {{data.aircraft.icao24}}\n📻 <b>Callsign:</b> {{data.aircraft.callsign || "Unknown"}}\n🏢 <b>Airspace:</b> {{data.airspace}}\n📍 <b>Altitude:</b> {{data.aircraft.altitude || "Unknown"}} ft\n\n🕐 <i>{{timestamp}}</i>',
          priority: 'normal',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Aircraft exiting controlled airspace',
          data: {
            rule: 'adsb-airspace-exit-rule',
            icao24: '{{data.aircraft.icao24}}',
            airspace: '{{data.airspace}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'aviation',
      priority: 1
    }
  },

  // ADSB Squawk Code Analysis Rule
  {
    id: 'adsb-squawk-analysis-rule',
    name: 'ADSB Squawk Code Analysis',
    description: 'Analyze and notify about interesting squawk codes',
    conditions: {
      eventType: 'squawk:analysis',
      source: 'adsb-main'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🔍 <b>Squawk Code Analysis</b>\n\n🆔 <b>ICAO:</b> {{data.aircraft.icao24}}\n📻 <b>Callsign:</b> {{data.aircraft.callsign || "Unknown"}}\n⚠️ <b>Squawk:</b> {{data.squawk}}\n📋 <b>Category:</b> {{data.category}}\n🎯 <b>Priority:</b> {{data.priority}}\n\n🕐 <i>{{timestamp}}</i>',
          priority: '{{data.priority}}',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Squawk code analysis completed',
          data: {
            rule: 'adsb-squawk-analysis-rule',
            icao24: '{{data.aircraft.icao24}}',
            squawk: '{{data.squawk}}',
            category: '{{data.category}}'
          }
        }
      }
    ],
    metadata: {
      enabled: true,
      category: 'aviation',
      priority: 2
    }
  },

  // UniFi Motion Detection Rule (NEW)
  {
    id: 'unifi-motion-notification-rule',
    name: 'UniFi Motion Detection Notification',
    description: 'Send notification when motion is detected on UniFi cameras',
    conditions: {
      eventType: 'motion',
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🎥 <b>Motion Detected</b>\n\n📷 <b>Camera:</b> {{deviceId}}\n🕐 <b>Time:</b> {{timestamp}}\n📍 <b>Source:</b> UniFi Protect\n\n<i>Motion activity detected on security camera</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'mqtt_publish',
        parameters: {
          topic: 'unifi/events/motion',
          payload: {
            type: 'motion',
            cameraId: '{{deviceId}}',
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
          message: 'UniFi motion event processed',
          data: {
            rule: 'unifi-motion-notification-rule',
            eventType: '{{type}}',
            cameraId: '{{deviceId}}'
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

  // Test Motion Alert Rule
  {
    id: 'test-motion-alert',
    name: 'Test Motion Alert',
    description: 'Test rule for motion detection events',
    conditions: {
      eventType: 'motion',
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🚨 <b>Motion Alert</b>\n\n📷 <b>Camera:</b> {{deviceId}}\n🕐 <b>Time:</b> {{timestamp}}\n📍 <b>Source:</b> {{source}}\n\n<i>Motion detection triggered</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Motion event from {{source}}',
          data: {
            eventType: '{{eventType}}',
            source: '{{source}}',
            timestamp: '{{timestamp}}'
          }
        }
      }
    ],
    metadata: {
      autoGenerated: false,
      category: 'security',
      connectorType: 'unifi-protect',
      createdAt: '2025-06-23T00:00:00.000Z',
      version: '1.0.0'
    },
    enabled: true
  },
  {
    id: 'smart-detection-alert',
    name: 'Smart Detection Alert',
    description: 'Alert for smart detection events (vehicle, person, etc.)',
    conditions: {
      eventType: 'smartDetectLine',
      source: 'unifi-protect-websocket'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🤖 <b>Smart Detection Alert</b>\n\n📷 <b>Camera:</b> {{deviceId}}\n🔍 <b>Detection:</b> {{data.smartDetectTypes.0}}\n🕐 <b>Time:</b> {{timestamp}}\n📍 <b>Source:</b> {{source}}\n\n<i>AI-powered detection triggered</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'info',
          message: 'Smart detection event from {{source}}',
          data: {
            eventType: '{{eventType}}',
            source: '{{source}}',
            timestamp: '{{timestamp}}',
            detectionType: '{{data.smartDetectTypes.0}}'
          }
        }
      }
    ],
    metadata: {
      autoGenerated: false,
      category: 'security',
      connectorType: 'unifi-protect',
      createdAt: '2025-06-23T00:00:00.000Z',
      version: '1.0.0'
    },
    enabled: true
  },
  {
    id: 'system-health-alert',
    name: 'System Health Alert',
    description: 'Alert for system health issues',
    conditions: {
      eventType: 'system:health',
      severity: 'high'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '💻 <b>System Health Alert</b>\n\n⚠️ <b>Status:</b> {{data.status}}\n🔧 <b>Component:</b> {{data.component || "System"}}\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>System health issue detected</i>',
          priority: 'high',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'error',
          message: 'System health issue detected',
          data: {
            eventType: '{{eventType}}',
            source: '{{source}}',
            timestamp: '{{timestamp}}',
            status: '{{data.status}}'
          }
        }
      }
    ],
    metadata: {
      autoGenerated: false,
      category: 'system',
      connectorType: 'system',
      createdAt: '2025-06-23T00:00:00.000Z',
      version: '1.0.0'
    },
    enabled: true
  },
  {
    id: 'speed-violation-alert',
    name: 'Speed Violation Alert',
    description: 'Alert for vehicle speed violations',
    conditions: {
      eventType: 'speed:violation',
      source: 'speed-calculation-main'
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🚗 <b>Speed Violation Alert</b>\n\n⚡ <b>Speed:</b> {{data.speed}} km/h\n📍 <b>Location:</b> {{data.location || "Unknown"}}\n🚦 <b>Limit:</b> {{data.limit || "Unknown"}} km/h\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Vehicle speed violation detected</i>',
          priority: 'medium',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'warn',
          message: 'Speed violation detected',
          data: {
            eventType: '{{eventType}}',
            source: '{{source}}',
            timestamp: '{{timestamp}}',
            speed: '{{data.speed}}',
            location: '{{data.location}}'
          }
        }
      }
    ],
    metadata: {
      autoGenerated: false,
      category: 'analytics',
      connectorType: 'speed-calculation',
      createdAt: '2025-06-23T00:00:00.000Z',
      version: '1.0.0'
    },
    enabled: true
  },
  {
    id: 'connector-dependency-alert',
    name: 'Connector Dependency Alert',
    description: 'Alert when critical connector dependencies fail',
    conditions: {
      eventType: 'dependency-failed',
      critical: true
    },
    actions: [
      {
        type: 'send_notification',
        parameters: {
          message: '🚨 <b>Critical Dependency Failure</b>\n\n🔗 <b>Connector:</b> {{connectorId}}\n❌ <b>Missing:</b> {{dependencyId}}\n⚠️ <b>Error:</b> {{error}}\n🕐 <b>Time:</b> {{timestamp}}\n\n<i>Critical system dependency is unavailable</i>',
          priority: 'high',
          channels: ['telegram'],
          parseMode: 'HTML'
        }
      },
      {
        type: 'log_event',
        parameters: {
          level: 'error',
          message: 'Critical connector dependency failed',
          data: {
            connectorId: '{{connectorId}}',
            dependencyId: '{{dependencyId}}',
            error: '{{error}}',
            critical: '{{critical}}'
          }
        }
      }
    ],
    metadata: {
      autoGenerated: false,
      category: 'system',
      connectorType: 'system',
      createdAt: '2025-06-23T00:00:00.000Z',
      version: '1.0.0'
    },
    enabled: true
  }
];

module.exports = defaultRules; 