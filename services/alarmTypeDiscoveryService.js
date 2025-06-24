const ConnectorRegistry = require('../connectors/ConnectorRegistry');

class AlarmTypeDiscoveryService {
  constructor() {
    this.connectorRegistry = null;
    this.discoveredTypes = new Map();
    this.lastDiscovery = 0;
    this.discoveryInterval = 60000; // 1 minute
  }

  setConnectorRegistry(registry) {
    this.connectorRegistry = registry;
  }

  async discoverAllAlarmTypes() {
    if (!this.connectorRegistry) {
      console.log('No connector registry available for alarm type discovery');
      return [];
    }

    const now = Date.now();
    if (now - this.lastDiscovery < this.discoveryInterval) {
      return Array.from(this.discoveredTypes.values());
    }

    console.log('🔍 Discovering alarm types from all connectors...');
    const alarmTypes = [];

    // Get all connectors
    const connectors = this.connectorRegistry.getConnectors();

    for (const [connectorId, connector] of connectors) {
      try {
        const connectorTypes = await this.discoverConnectorAlarmTypes(connectorId, connector);
        alarmTypes.push(...connectorTypes);
      } catch (error) {
        console.error(`Failed to discover alarm types from ${connectorId}:`, error.message);
      }
    }

    // Update cache
    this.discoveredTypes.clear();
    alarmTypes.forEach(type => {
      this.discoveredTypes.set(type.id, type);
    });

    this.lastDiscovery = now;
    console.log(`✅ Discovered ${alarmTypes.length} alarm types from ${connectors.size} connectors`);

    return alarmTypes;
  }

  async discoverConnectorAlarmTypes(connectorId, connector) {
    const types = [];

    // Get capability definitions
    if (typeof connector.getCapabilityDefinitions === 'function') {
      try {
        const capabilities = connector.getCapabilityDefinitions();
        for (const capability of capabilities) {
          if (capability.events) {
            for (const eventType of capability.events) {
              types.push({
                id: `${connectorId}:${eventType}`,
                name: `${connector.name || connectorId} - ${eventType}`,
                eventType: eventType,
                source: connectorId,
                connectorType: connector.type,
                category: capability.category || 'general',
                description: capability.description || `Events from ${connector.name || connectorId}`,
                severity: this.determineSeverity(eventType),
                channels: this.determineChannels(eventType, connector.type),
                parameters: capability.parameters || {},
                enabled: true
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to get capabilities from ${connectorId}:`, error.message);
      }
    }

    // Add static event types if defined
    if (connector.eventTypes && Array.isArray(connector.eventTypes)) {
      for (const eventType of connector.eventTypes) {
        const existingType = types.find(t => t.eventType === eventType);
        if (!existingType) {
          types.push({
            id: `${connectorId}:${eventType}`,
            name: `${connector.name || connectorId} - ${eventType}`,
            eventType: eventType,
            source: connectorId,
            connectorType: connector.type,
            category: this.determineCategory(eventType),
            description: `Events from ${connector.name || connectorId}`,
            severity: this.determineSeverity(eventType),
            channels: this.determineChannels(eventType, connector.type),
            parameters: {},
            enabled: true
          });
        }
      }
    }

    // Add common event types based on connector type
    const commonTypes = this.getCommonEventTypes(connector.type);
    for (const eventType of commonTypes) {
      const existingType = types.find(t => t.eventType === eventType);
      if (!existingType) {
        types.push({
          id: `${connectorId}:${eventType}`,
          name: `${connector.name || connectorId} - ${eventType}`,
          eventType: eventType,
          source: connectorId,
          connectorType: connector.type,
          category: this.determineCategory(eventType),
          description: `Common ${eventType} events from ${connector.name || connectorId}`,
          severity: this.determineSeverity(eventType),
          channels: this.determineChannels(eventType, connector.type),
          parameters: {},
          enabled: true
        });
      }
    }

    return types;
  }

  determineCategory(eventType) {
    const categoryMap = {
      // Security events
      'motion': 'security',
      'smartDetectZone': 'security',
      'smartDetectLine': 'security',
      'intrusion': 'security',
      'doorbell': 'security',
      'camera': 'security',
      
      // Aviation events
      'aircraft:detected': 'aviation',
      'aircraft:emergency': 'aviation',
      'aircraft:appeared': 'aviation',
      'aircraft:updated': 'aviation',
      'aircraft:disappeared': 'aviation',
      'squawk:analysis': 'aviation',
      'notam:alert': 'aviation',
      
      // System events
      'system': 'system',
      'connector:status': 'system',
      'system:health': 'system',
      'error': 'system',
      
      // Communication events
      'mqtt': 'communication',
      'telegram': 'communication',
      
      // Analytics events
      'speed:violation': 'analytics',
      'analytics': 'analytics',
      
      // Default
      'default': 'general'
    };

    return categoryMap[eventType] || 'general';
  }

  determineSeverity(eventType) {
    const severityMap = {
      // High severity
      'aircraft:emergency': 'high',
      'intrusion': 'high',
      'error': 'high',
      'system:health': 'high',
      
      // Medium severity
      'motion': 'medium',
      'smartDetectZone': 'medium',
      'smartDetectLine': 'medium',
      'aircraft:detected': 'medium',
      'squawk:analysis': 'medium',
      'notam:alert': 'medium',
      'speed:violation': 'medium',
      
      // Low severity
      'aircraft:appeared': 'low',
      'aircraft:updated': 'low',
      'aircraft:disappeared': 'low',
      'doorbell': 'low',
      'camera': 'low',
      'connector:status': 'low',
      'mqtt': 'low',
      'telegram': 'low',
      
      // Default
      'default': 'medium'
    };

    return severityMap[eventType] || 'medium';
  }

  determineChannels(eventType, connectorType) {
    const channels = ['gui']; // Always include GUI

    // Add Telegram for important events
    if (this.determineSeverity(eventType) === 'high' || 
        this.determineSeverity(eventType) === 'medium') {
      channels.push('telegram');
    }

    // Add MQTT for system events
    if (eventType === 'system' || eventType === 'connector:status' || 
        eventType === 'system:health' || eventType === 'error') {
      channels.push('mqtt');
    }

    // Add specific channels based on connector type
    switch (connectorType) {
      case 'telegram':
        channels.push('telegram');
        break;
      case 'mqtt':
        channels.push('mqtt');
        break;
      case 'unifi-protect':
      case 'hikvision':
      case 'ankke-dvr':
        channels.push('telegram', 'mqtt');
        break;
      case 'adsb':
      case 'prestwick-airport':
        channels.push('telegram', 'mqtt');
        break;
    }

    return [...new Set(channels)]; // Remove duplicates
  }

  getCommonEventTypes(connectorType) {
    const commonTypes = {
      'unifi-protect': ['motion', 'smartDetectZone', 'smartDetectLine', 'camera', 'system'],
      'hikvision': ['motion', 'camera', 'system'],
      'ankke-dvr': ['motion', 'camera', 'system'],
      'adsb': ['aircraft:detected', 'aircraft:emergency', 'aircraft:appeared', 'aircraft:updated', 'aircraft:disappeared'],
      'prestwick-airport': ['alarm:notification', 'aircraft:detected', 'aircraft:emergency'],
      'telegram': ['telegram:message', 'telegram:command'],
      'mqtt': ['mqtt:message', 'mqtt:status'],
      'aprs': ['aprs:station', 'aprs:weather', 'aprs:message'],
      'notam': ['notam:alert', 'notam:update'],
      'speed-calculation': ['speed:violation', 'speed:detection'],
      'overwatch': ['overwatch:event', 'overwatch:flow'],
      'system-visualizer': ['system:status', 'system:health'],
      'display-manager': ['display:status', 'display:event'],
      'radar': ['radar:aircraft', 'radar:zone'],
      'map': ['map:update', 'map:event'],
      'web-gui': ['gui:event', 'gui:status'],
      'remotion': ['remotion:render', 'remotion:status'],
      'alarm-manager': ['alarm:triggered', 'alarm:cleared']
    };

    return commonTypes[connectorType] || [];
  }

  async generateDefaultRules() {
    const alarmTypes = await this.discoverAllAlarmTypes();
    const rules = [];

    for (const alarmType of alarmTypes) {
      const rule = this.createDefaultRule(alarmType);
      rules.push(rule);
    }

    return rules;
  }

  createDefaultRule(alarmType) {
    const rule = {
      id: `auto-${alarmType.id}`,
      name: `Auto: ${alarmType.name}`,
      description: `Automatically generated rule for ${alarmType.eventType} events from ${alarmType.source}`,
      conditions: {
        eventType: alarmType.eventType,
        source: alarmType.source
      },
      actions: [
        {
          type: 'send_notification',
          parameters: {
            message: this.generateDefaultMessage(alarmType),
            priority: alarmType.severity,
            channels: alarmType.channels
          }
        },
        {
          type: 'log_event',
          parameters: {
            level: alarmType.severity === 'high' ? 'error' : 
                   alarmType.severity === 'medium' ? 'warn' : 'info',
            message: `${alarmType.eventType} event from ${alarmType.source}`,
            data: {
              eventType: '{{eventType}}',
              source: '{{source}}',
              timestamp: '{{timestamp}}',
              severity: alarmType.severity
            }
          }
        }
      ],
      metadata: {
        autoGenerated: true,
        category: alarmType.category,
        connectorType: alarmType.connectorType,
        createdAt: new Date().toISOString(),
        version: '1.0.0'
      },
      enabled: alarmType.enabled
    };

    // Add MQTT action for system events
    if (alarmType.channels.includes('mqtt')) {
      rule.actions.push({
        type: 'mqtt_publish',
        parameters: {
          topic: `${alarmType.source}/${alarmType.eventType}`,
          payload: {
            type: '{{eventType}}',
            source: '{{source}}',
            timestamp: '{{timestamp}}',
            severity: alarmType.severity,
            category: alarmType.category
          }
        }
      });
    }

    return rule;
  }

  generateDefaultMessage(alarmType) {
    const messageTemplates = {
      'motion': '🚨 Motion detected on camera {{deviceId}}',
      'smartDetectZone': '🤖 Smart detection ({{data.smartDetectTypes.0}}) on camera {{deviceId}}',
      'smartDetectLine': '🤖 Smart detection line ({{data.smartDetectTypes.0}}) on camera {{deviceId}}',
      'intrusion': '🚨 Intrusion detected on camera {{deviceId}}',
      'doorbell': '🔔 Doorbell ring detected',
      'aircraft:detected': '✈️ Aircraft detected: {{data.aircraft.icao24}}',
      'aircraft:emergency': '🚨 Emergency aircraft: {{data.aircraft.icao24}}',
      'aircraft:appeared': '✈️ Aircraft appeared: {{data.aircraft.icao24}}',
      'aircraft:updated': '✈️ Aircraft updated: {{data.aircraft.icao24}}',
      'aircraft:disappeared': '✈️ Aircraft disappeared: {{data.aircraft.icao24}}',
      'squawk:analysis': '🚨 Squawk code analysis: {{data.squawk}}',
      'notam:alert': '⚠️ NOTAM alert: {{data.notam}}',
      'speed:violation': '🚗 Speed violation detected: {{data.speed}} km/h',
      'system:health': '💻 System health alert: {{data.status}}',
      'error': '❌ Error occurred: {{data.error}}',
      'connector:status': '🔌 Connector status: {{data.status}}',
      'default': '📢 Event: {{eventType}} from {{source}}'
    };

    return messageTemplates[alarmType.eventType] || messageTemplates.default;
  }

  async getAlarmTypesForUI() {
    const alarmTypes = await this.discoverAllAlarmTypes();
    
    // Group by category
    const grouped = {};
    for (const alarmType of alarmTypes) {
      if (!grouped[alarmType.category]) {
        grouped[alarmType.category] = [];
      }
      grouped[alarmType.category].push(alarmType);
    }

    return {
      categories: Object.keys(grouped),
      types: grouped,
      total: alarmTypes.length
    };
  }

  async refreshAlarmTypes() {
    console.log('Refreshing alarm type discovery...');
    this.lastDiscovery = 0; // Force refresh
    return await this.discoverAllAlarmTypes();
  }
}

module.exports = AlarmTypeDiscoveryService; 