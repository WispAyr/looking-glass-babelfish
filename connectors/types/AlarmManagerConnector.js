const BaseConnector = require('../BaseConnector');
const EventEmitter = require('events');
const AlarmTypeDiscoveryService = require('../../services/alarmTypeDiscoveryService');

/**
 * Notification Manager for handling different notification channels
 */
class NotificationManager {
  constructor() {
    this.channels = new Map();
  }

  registerChannel(name, connector) {
    this.channels.set(name, connector);
  }

  async sendNotification(channel, message, options = {}) {
    const channelConnector = this.channels.get(channel);
    if (!channelConnector) {
      this.logger.warn(`Channel ${channel} not configured - skipping notification`, {
        channel,
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        options
      });
      return {
        success: false,
        error: `Channel ${channel} not configured`,
        channel,
        timestamp: new Date().toISOString()
      };
    }

    try {
      switch (channel) {
        case 'telegram':
          await channelConnector.execute('telegram:send', 'text', {
            chatId: options.chatId,
            text: message,
            parseMode: 'HTML',
            ...options
          });
          break;
          
        case 'mqtt':
          await channelConnector.execute('mqtt:publish', 'message', {
            topic: options.topic || 'alarms/notifications',
            message: JSON.stringify({
              message,
              timestamp: Date.now(),
              ...options
            }),
            qos: options.qos || 1
          });
          break;
          
        default:
          this.logger.warn(`Unsupported channel: ${channel} - skipping notification`, {
            channel,
            message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
            options
          });
          return {
            success: false,
            error: `Unsupported channel: ${channel}`,
            channel,
            timestamp: new Date().toISOString()
          };
      }
      
      return {
        success: true,
        channel,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error(`Failed to send notification via ${channel}:`, error);
      return {
        success: false,
        error: error.message,
        channel,
        timestamp: new Date().toISOString()
      };
    }
  }
}

/**
 * Command Processor for handling Telegram commands
 */
class CommandProcessor {
  constructor(alarmManager) {
    this.alarmManager = alarmManager;
    this.commands = new Map();
    this.setupCommands();
  }

  setupCommands() {
    this.commands.set('/status', this.handleStatusCommand.bind(this));
    this.commands.set('/alarms', this.handleAlarmsCommand.bind(this));
    this.commands.set('/rules', this.handleRulesCommand.bind(this));
    this.commands.set('/test', this.handleTestCommand.bind(this));
    this.commands.set('/menu', this.handleMenuCommand.bind(this));
    this.commands.set('/escalate', this.handleEscalationCommand.bind(this));
  }

  async processCommand(msg) {
    const command = msg.text.split(' ')[0].toLowerCase();
    const handler = this.commands.get(command);
    
    if (handler) {
      await handler(msg);
    } else {
      await this.handleUnknownCommand(msg);
    }
  }

  async handleStatusCommand(msg) {
    const stats = await this.alarmManager.getStats();
    const status = `
🤖 <b>Alarm Manager Status</b>

📊 <b>Rules:</b>
• Total: ${stats.rules.total_rules}
• Enabled: ${stats.rules.enabled_rules}
• Disabled: ${stats.rules.disabled_rules}

🚨 <b>Alarms:</b>
• Total: ${stats.alarms.total_alarms}
• Active: ${stats.alarms.active_alarms}
• Acknowledged: ${stats.alarms.acknowledged_alarms}
• Resolved: ${stats.alarms.resolved_alarms}

✅ System is operational
    `;
    
    await this.alarmManager.sendNotification('telegram', status, { priority: 'low' });
  }

  async handleAlarmsCommand(msg) {
    const history = await this.alarmManager.getAlarmHistory(10);
    
    if (history.length === 0) {
      await this.alarmManager.sendNotification('telegram', '✅ No recent alarms', { priority: 'low' });
      return;
    }
    
    const alarmsList = history.map(alarm => 
      `• ${alarm.ruleName || 'Unknown'} - ${alarm.status} (${new Date(alarm.triggeredAt).toLocaleString()})`
    ).join('\n');
    
    const message = `
🚨 <b>Recent Alarms</b>

${alarmsList}
    `;
    
    await this.alarmManager.sendNotification('telegram', message, { priority: 'low' });
  }

  async handleRulesCommand(msg) {
    const rules = await this.alarmManager.getAllRules();
    
    if (rules.length === 0) {
      await this.alarmManager.sendNotification('telegram', '📋 No rules configured', { priority: 'low' });
      return;
    }
    
    const rulesList = rules.map(rule => 
      `• ${rule.name} (${rule.priority}) - ${rule.enabled ? '✅' : '❌'}`
    ).join('\n');
    
    const message = `
📋 <b>Configured Rules</b>

${rulesList}
    `;
    
    await this.alarmManager.sendNotification('telegram', message, { priority: 'low' });
  }

  async handleTestCommand(msg) {
    const testEvent = {
      type: 'test',
      source: 'telegram',
      message: 'Test alarm triggered via Telegram command',
      timestamp: Date.now()
    };
    
    await this.alarmManager.processEvent(testEvent);
    await this.alarmManager.sendNotification('telegram', '🧪 Test alarm triggered successfully', { priority: 'low' });
  }

  async handleMenuCommand(msg) {
    const menu = `
🤖 <b>Alarm Manager Menu</b>

📊 <b>Status Commands:</b>
/status - System status
/alarms - Active alarms
/rules - Configured rules

⚙️ <b>Management Commands:</b>
/test - Test notification
/escalate - Escalation status
/menu - Show this menu

🔧 <b>Configuration:</b>
Rules and notifications are configured in the system configuration.
    `;
    
    await this.alarmManager.sendNotification('telegram', menu, { priority: 'low' });
  }

  async handleEscalationCommand(msg) {
    const escalations = Array.from(this.alarmManager.escalationManager.escalationTimeouts.keys());
    
    if (escalations.length === 0) {
      await this.alarmManager.sendNotification('telegram', '✅ No active escalations', { priority: 'low' });
      return;
    }
    
    const escalationList = escalations.map(id => `• Alarm ID: ${id}`).join('\n');
    
    const message = `
⏰ <b>Active Escalations</b>

${escalationList}
    `;
    
    await this.alarmManager.sendNotification('telegram', message, { priority: 'low' });
  }

  async handleUnknownCommand(msg) {
    const help = `
❓ <b>Unknown Command</b>

Use /menu to see available commands.
    `;
    
    await this.alarmManager.sendNotification('telegram', help, { priority: 'low' });
  }
}

/**
 * Escalation Manager for handling alarm escalations
 */
class EscalationManager {
  constructor() {
    this.escalationTimeouts = new Map();
    this.escalationLevels = [
      { delay: 5 * 60 * 1000, level: 1 }, // 5 minutes
      { delay: 15 * 60 * 1000, level: 2 }, // 15 minutes
      { delay: 30 * 60 * 1000, level: 3 }  // 30 minutes
    ];
  }

  startEscalation(alarmId, rule) {
    this.escalationLevels.forEach(({ delay, level }) => {
      const timeout = setTimeout(() => {
        this.escalate(alarmId, rule, level);
      }, delay);
      
      this.escalationTimeouts.set(`${alarmId}-${level}`, timeout);
    });
  }

  async escalate(alarmId, rule, level) {
    const message = `
🚨 <b>ALARM ESCALATION - Level ${level}</b>

Rule: ${rule.name}
Alarm ID: ${alarmId}
Time: ${new Date().toLocaleString()}

This alarm requires immediate attention!
    `;
    
    // Send escalation notification
    // This would typically go to higher-level personnel
    console.log(`Escalating alarm ${alarmId} to level ${level}`);
  }

  clearEscalation(alarmId) {
    this.escalationLevels.forEach(({ level }) => {
      const timeoutKey = `${alarmId}-${level}`;
      const timeout = this.escalationTimeouts.get(timeoutKey);
      if (timeout) {
        clearTimeout(timeout);
        this.escalationTimeouts.delete(timeoutKey);
      }
    });
  }
}

/**
 * Alarm Manager Connector
 * 
 * Manages alarm rules, notifications, and event processing
 */
class AlarmManagerConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // Use the main RuleEngine instead of creating our own
    this.ruleEngine = null; // Will be set by the server
    this.notificationManager = new NotificationManager();
    this.commandProcessor = new CommandProcessor(this);
    this.escalationManager = new EscalationManager();
    this.alarmTypeDiscovery = new AlarmTypeDiscoveryService();
    
    // Rate limiting for notifications to prevent spam
    this.notificationRateLimit = new Map(); // eventType -> lastNotificationTime
    this.rateLimitWindow = 30000; // 30 seconds between same event type notifications
    
    this.rules = [];
    this.alarmHistory = [];
    this.activeAlarms = new Map();
    this.alarmTypes = new Set();
    this.channels = new Map(); // Initialize channels Map
    this.eventTypes = ['motion', 'smartDetectZone', 'smartDetectLine', 'aircraft:emergency', 'aircraft:appeared', 'aircraft:updated', 'aircraft:moved', 'system:health', 'speed:violation', 'dependency-failed', 'alarm:notification'];
    
    this.rulesPath = config.rulesPath || './config/alarmRules.json';
    this.notificationChannels = config.notificationChannels || ['telegram', 'mqtt'];
    this.telegramConfig = config.telegram || {};
    this.mqttConfig = config.mqtt || {};
    
    // Alarm escalation settings
    this.escalationEnabled = config.escalationEnabled !== false;
    this.escalationLevels = config.escalationLevels || [
      { level: 1, delay: 300000, channels: ['telegram'] }, // 5 minutes
      { level: 2, delay: 900000, channels: ['telegram', 'mqtt'] }, // 15 minutes
      { level: 3, delay: 1800000, channels: ['telegram', 'mqtt', 'webhook'] } // 30 minutes
    ];
    
    // Command processing
    this.commandProcessingEnabled = config.commandProcessingEnabled !== false;
    this.commandPrefix = config.commandPrefix || '/';
    
    // Rate limiting
    this.rateLimitEnabled = config.rateLimitEnabled !== false;
    this.rateLimitWindow = config.rateLimitWindow || 30000; // 30 seconds
    
    // History settings
    this.maxHistorySize = config.maxHistorySize || 1000;
    this.historyRetentionDays = config.historyRetentionDays || 30;
    
    // Auto-cleanup
    this.autoCleanupEnabled = config.autoCleanupEnabled !== false;
    this.cleanupInterval = config.cleanupInterval || 3600000; // 1 hour
    
    this.logger.info('Alarm Manager Connector initialized', {
      notificationChannels: this.notificationChannels,
      escalationEnabled: this.escalationEnabled,
      commandProcessingEnabled: this.commandProcessingEnabled,
      rateLimitEnabled: this.rateLimitEnabled
    });
  }

  /**
   * Get capability definitions
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'alarm:management',
        name: 'Alarm Management',
        description: 'Manage alarm rules, conditions, and actions',
        category: 'alarms',
        operations: ['create', 'read', 'update', 'delete', 'list', 'toggle', 'test', 'import', 'export', 'stats'],
        dataTypes: ['rule', 'condition', 'action'],
        events: ['rule:created', 'rule:updated', 'rule:deleted', 'alarm:triggered'],
        parameters: {
          ruleId: { type: 'string', required: false },
          category: { type: 'string', required: false },
          connectorType: { type: 'string', required: false }
        }
      },
      {
        id: 'alarm:notifications',
        name: 'Alarm Notifications',
        description: 'Send notifications through various channels',
        category: 'alarms',
        operations: ['send', 'test'],
        dataTypes: ['notification'],
        events: ['notification:sent', 'notification:failed'],
        parameters: {
          channel: { type: 'string', required: true },
          message: { type: 'string', required: true },
          priority: { type: 'string', required: false }
        }
      },
      {
        id: 'alarm:history',
        name: 'Alarm History',
        description: 'Access alarm history and statistics',
        category: 'alarms',
        operations: ['list', 'stats', 'acknowledge', 'resolve'],
        dataTypes: ['alarm', 'statistics'],
        events: ['alarm:acknowledged', 'alarm:resolved'],
        parameters: {
          limit: { type: 'number', required: false },
          offset: { type: 'number', required: false },
          filters: { type: 'object', required: false }
        }
      }
    ];
  }

  /**
   * Validate configuration
   */
  static validateConfig(config) {
    const errors = [];
    
    if (!config.defaultChatId && !config.telegram?.chatId) {
      errors.push('Default chat ID or Telegram chat ID is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Initialize the connector
   */
  async performConnect() {
    try {
      // Note: RuleEngine will be set by the server after connector creation
      // No need to try to get it from connectorRegistry here
      
      // Setup notification channels
      await this.setupNotificationChannels();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Note: Auto-cleanup functionality not yet implemented
      // if (this.autoCleanupEnabled) {
      //   this.startAutoCleanup();
      // }
      
      this.connected = true;
      this.logger.info('Alarm Manager Connector connected successfully');
      
    } catch (error) {
      this.logger.error('Failed to connect Alarm Manager Connector:', error);
      throw error;
    }
  }

  /**
   * Set up notification channels
   */
  async setupNotificationChannels() {
    if (!this.connectorRegistry) return;
    
    // Set up Telegram channel
    const telegramConnector = this.connectorRegistry.getConnector('telegram-bot-main');
    if (telegramConnector) {
      this.channels.set('telegram', telegramConnector);
      console.log('[AlarmManager] Telegram notification channel FORCE registered (debug)');
    } else {
      console.log('[AlarmManager] Telegram connector not found in registry');
    }
    
    // Set up MQTT channel
    const mqttConnector = this.connectorRegistry.getConnector('mqtt-broker-main');
    if (mqttConnector && (mqttConnector.isConnected || (mqttConnector.status && mqttConnector.status.status === 'connected'))) {
      this.channels.set('mqtt', mqttConnector);
      console.log('MQTT notification channel configured');
    }
    
    // Set up GUI channel (for web interface) - always available
    this.channels.set('gui', {
      sendNotification: (message, options) => {
        // Send to web GUI via EventBus
        if (this.eventBus) {
          this.eventBus.publishEvent('alarm:notification', {
            message,
            options,
            timestamp: Date.now()
          });
        }
        return { success: true };
      }
    });
    console.log('GUI notification channel configured');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    if (!this.eventBus) return;
    
    this.eventTypes.forEach(eventType => {
      this.eventBus.subscribe(eventType, this.handleEvent.bind(this));
    });
    
    console.log(`Event listeners set up for ${this.eventTypes.length} event types`);
  }

  /**
   * Handle incoming events and process matching rules
   */
  async handleEvent(event) {
    try {
      console.log(`AlarmManagerConnector received event: ${event.type} from ${event.source}`);
      
      // Rate limiting: Check if we've recently processed this event type
      // Skip rate limiting for inter-connector events to ensure proper data flow
      const isInterConnectorEvent = event.source && (
        event.source.includes('adsb') || 
        event.source.includes('prestwick') || 
        event.source.includes('unifi-protect') ||
        event.type.includes('aircraft') ||
        event.type.includes('smartDetect')
      );
      
      if (!isInterConnectorEvent) {
        const now = Date.now();
        const lastNotification = this.notificationRateLimit.get(event.type);
        
        if (lastNotification && (now - lastNotification) < this.rateLimitWindow) {
          console.log(`Rate limiting: Skipping ${event.type} event (last processed ${Math.round((now - lastNotification) / 1000)}s ago)`);
          return;
        }
        
        // Update rate limit timestamp only for non-inter-connector events
        this.notificationRateLimit.set(event.type, now);
      }
      
      console.log(`Processing event: ${event.type} from ${event.source}`);
      
      // Find matching rules
      const matchingRules = this.findMatchingRules(event);
      
      if (matchingRules.length === 0) {
        console.log(`No rules matched for event: ${event.type}`);
        return;
      }
      
      console.log(`Event processed by ${matchingRules.length} rules: ${event.type}`);
      
      // Process each matching rule
      for (const rule of matchingRules) {
        await this.processRule(rule, event);
      }
      
    } catch (error) {
      console.error('Error processing event:', error);
    }
  }

  findMatchingRules(event) {
    if (!this.ruleEngine) {
      console.log('RuleEngine not available in AlarmManagerConnector');
      return [];
    }
    
    console.log(`Looking for rules matching event: ${event.type} from ${event.source}`);
    
    // Use the RuleEngine's findMatchingRules method instead of getRulesByEventType
    const matchingRules = this.ruleEngine.findMatchingRules(event).filter(rule => {
      if (!rule.metadata?.enabled) return false;
      
      const conditions = rule.conditions;
      
      // Check event type
      if (conditions.eventType && conditions.eventType !== event.type) {
        return false;
      }
      
      // Check source
      if (conditions.source && conditions.source !== event.source) {
        return false;
      }
      
      // Check severity
      if (conditions.severity && conditions.severity !== event.severity) {
        return false;
      }
      
      // Check custom conditions
      if (conditions.custom) {
        for (const [key, value] of Object.entries(conditions.custom)) {
          if (event.data && event.data[key] !== value) {
            return false;
          }
        }
      }
      
      return true;
    });
    
    console.log(`Found ${matchingRules.length} matching rules for event: ${event.type}`);
    return matchingRules;
  }

  /**
   * Process a rule against an event
   */
  async processRule(rule, event) {
    try {
      console.log(`Rule '${rule.name}' triggered for event: ${event.type}`);
      
      // Create alarm record
      const alarm = {
        id: `alarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ruleId: rule.id,
        ruleName: rule.name,
        eventType: event.type,
        source: event.source,
        severity: rule.priority || 'medium',
        message: this.interpolateTemplate(rule.description || 'Alarm triggered', event, rule),
        timestamp: Date.now(),
        status: 'active',
        data: event.data || {}
      };
      
      // Store alarm
      this.activeAlarms.set(alarm.id, alarm);
      this.addToHistory(alarm);
      
      // Execute rule actions
      for (const action of rule.actions) {
        await this.executeAction(action, event, rule, alarm);
      }
      
    } catch (error) {
      console.error(`Error processing rule ${rule.name}:`, error);
    }
  }

  async executeAction(action, event, rule, alarm) {
    try {
      switch (action.type) {
        case 'notification':
        case 'send_notification':
          // Send notification to all specified channels
          const channels = action.config?.channels || action.parameters?.channels || ['telegram'];
          const message = this.interpolateTemplate(action.config?.message || action.parameters?.message, event, rule);
          const priority = action.config?.priority || action.parameters?.priority || rule.priority || 'medium';
          
          for (const channel of channels) {
            try {
              const result = await this.sendNotification(channel, message, { priority, alarmId: alarm.id });
              
              if (result && result.success === false) {
                console.error(`Failed to send notification to ${channel}:`, result.error);
              }
            } catch (error) {
              console.error(`Error sending notification to ${channel}:`, error);
            }
          }
          break;
          
        case 'mqtt':
        case 'mqtt_publish':
          await this.publishMQTT(action, event, rule);
          break;
          
        case 'log_event':
          await this.logEvent(action, event, rule);
          break;
          
        case 'clear_alarm':
          await this.clearAlarm(action, event, rule);
          break;
          
        default:
          console.warn(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`Error executing action ${action.type}:`, error);
    }
  }

  /**
   * Execute webhook action
   */
  async executeWebhook(action, event, rule) {
    try {
      const url = this.interpolateTemplate(action.config.url, event, rule);
      const payload = {
        event,
        rule,
        timestamp: Date.now()
      };

      const response = await fetch(url, {
        method: action.config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...action.config.headers
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      this.logger.debug(`Webhook executed successfully: ${url}`);
    } catch (error) {
      this.logger.error(`Webhook execution failed: ${error.message}`);
    }
  }

  /**
   * Publish MQTT action
   */
  async publishMQTT(action, event, rule) {
    try {
      if (!this.channels.get('mqtt')) {
        this.logger.warn('MQTT channel not configured - skipping MQTT publish action', {
          action: action.type,
          eventType: event.type,
          source: event.source
        });
        return {
          success: false,
          error: 'MQTT channel not configured',
          timestamp: new Date().toISOString()
        };
      }

      const topic = this.interpolateTemplate(action.config?.topic || action.parameters?.topic, event, rule);
      const payload = action.config?.payload || action.parameters?.payload || {};
      
      // Interpolate payload values
      const interpolatedPayload = {};
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'string') {
          interpolatedPayload[key] = this.interpolateTemplate(value, event, rule);
        } else {
          interpolatedPayload[key] = value;
        }
      }

      await this.channels.get('mqtt').execute('mqtt:publish', 'message', {
        topic,
        payload: interpolatedPayload
      });
      
      return {
        success: true,
        topic,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Error publishing MQTT message:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Log event action
   */
  async logEvent(action, event, rule) {
    try {
      const level = action.parameters?.level || action.config?.level || 'info';
      const message = this.interpolateTemplate(action.parameters?.message || action.config?.message, event, rule);
      const data = action.parameters?.data || action.config?.data || {};
      
      // Interpolate data values
      const interpolatedData = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          interpolatedData[key] = this.interpolateTemplate(value, event, rule);
        } else {
          interpolatedData[key] = value;
        }
      }

      switch (level.toLowerCase()) {
        case 'error':
          this.logger.error(message, interpolatedData);
          break;
        case 'warn':
          this.logger.warn(message, interpolatedData);
          break;
        case 'debug':
          this.logger.debug(message, interpolatedData);
          break;
        default:
          this.logger.info(message, interpolatedData);
      }
      
    } catch (error) {
      console.error('Error logging event:', error);
    }
  }

  /**
   * Interpolate template variables in message
   */
  interpolateTemplate(template, event, rule) {
    return template
      .replace(/\{\{event\.type\}\}/g, event.type || '')
      .replace(/\{\{event\.source\}\}/g, event.source || '')
      .replace(/\{\{event\.severity\}\}/g, event.severity || '')
      .replace(/\{\{event\.message\}\}/g, event.message || '')
      .replace(/\{\{event\.timestamp\}\}/g, new Date(event.timestamp || Date.now()).toISOString())
      .replace(/\{\{rule\.name\}\}/g, rule.name || '')
      .replace(/\{\{rule\.priority\}\}/g, rule.priority || '')
      .replace(/\{\{type\}\}/g, event.type || '')
      .replace(/\{\{source\}\}/g, event.source || '')
      .replace(/\{\{message\}\}/g, event.message || '')
      .replace(/\{\{priority\}\}/g, rule.priority || 'medium')
      .replace(/\{\{timestamp\}\}/g, new Date(event.timestamp || Date.now()).toISOString())
      // Handle nested data properties
      .replace(/\{\{data\.([^}]+)\}\}/g, (match, path) => {
        const keys = path.split('.');
        let value = event.data;
        for (const key of keys) {
          if (value && typeof value === 'object' && key in value) {
            value = value[key];
          } else {
            return '';
          }
        }
        return value || '';
      });
  }

  /**
   * Set RuleEngine reference
   */
  setRuleEngine(ruleEngine) {
    this.ruleEngine = ruleEngine;
    this.logger.info('RuleEngine reference set for AlarmManagerConnector');
  }

  /**
   * Execute capability
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'alarm:management':
        return await this.executeAlarmManagement(operation, parameters);
      case 'alarm:notifications':
        return await this.executeAlarmNotifications(operation, parameters);
      case 'alarm:history':
        return await this.executeAlarmHistory(operation, parameters);
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }

  /**
   * Execute alarm management operations
   */
  async executeAlarmManagement(operation, parameters) {
    switch (operation) {
      case 'create':
        return await this.addRule(parameters);
      case 'read':
        if (parameters.ruleId) {
          return await this.getRule(parameters.ruleId);
        } else if (parameters.category) {
          return await this.getRulesByCategory(parameters.category);
        } else if (parameters.connectorType) {
          return await this.getRulesByConnectorType(parameters.connectorType);
        } else {
          return await this.getAllRules();
        }
      case 'update':
        return await this.updateRule(parameters.ruleId, parameters.updates);
      case 'delete':
        return await this.deleteRule(parameters.ruleId);
      case 'list':
        if (parameters.enabledOnly) {
          return await this.getEnabledRules();
        } else {
          return await this.getAllRules();
        }
      case 'toggle':
        return await this.toggleRule(parameters.ruleId, parameters.enabled);
      case 'test':
        return await this.testRule(parameters.ruleId, parameters.eventData);
      case 'import':
        return await this.importRules(parameters.rulesData);
      case 'export':
        return await this.exportRules();
      case 'stats':
        return await this.getRuleStats();
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute alarm notification operations
   */
  async executeAlarmNotifications(operation, parameters) {
    switch (operation) {
      case 'send':
        return await this.sendNotification(parameters.channel, parameters.message, parameters);
      case 'test':
        return await this.sendNotification('telegram', '🧪 Test notification from Alarm Manager', { priority: 'low' });
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute alarm history operations
   */
  async executeAlarmHistory(operation, parameters) {
    switch (operation) {
      case 'list':
        return await this.getAlarmHistory(parameters.limit, parameters.offset, parameters.filters);
      case 'stats':
        return await this.getStats();
      case 'acknowledge':
        return await this.acknowledgeAlarm(parameters.alarmId, parameters.userId, parameters.notes);
      case 'resolve':
        return await this.resolveAlarm(parameters.alarmId, parameters.userId);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Get all rules (for compatibility)
   */
  async getAllRules() {
    if (this.ruleEngine) {
      return this.ruleEngine.getRules();
    }
    return [];
  }

  /**
   * Get a specific rule by ID
   */
  async getRule(ruleId) {
    if (this.ruleEngine) {
      return this.ruleEngine.getRule(ruleId);
    }
    return null;
  }

  /**
   * Add a new rule
   */
  async addRule(rule) {
    if (!this.ruleEngine) {
      throw new Error('RuleEngine not available');
    }
    
    // Generate ID if not provided
    if (!rule.id) {
      rule.id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Set default metadata
    if (!rule.metadata) {
      rule.metadata = {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        autoGenerated: false
      };
    }
    
    // Set enabled by default
    if (rule.enabled === undefined) {
      rule.enabled = true;
    }
    
    const addedRule = this.ruleEngine.registerRule(rule);
    
    // Notify GUI
    if (this.eventBus) {
      this.eventBus.publishEvent('rule:created', {
        ruleId: rule.id,
        rule: rule,
        timestamp: Date.now()
      });
    }
    
    return addedRule;
  }

  /**
   * Update an existing rule
   */
  async updateRule(ruleId, updates) {
    if (!this.ruleEngine) {
      throw new Error('RuleEngine not available');
    }
    
    const existingRule = this.ruleEngine.getRule(ruleId);
    if (!existingRule) {
      throw new Error(`Rule ${ruleId} not found`);
    }
    
    // Update metadata
    if (!existingRule.metadata) {
      existingRule.metadata = {};
    }
    existingRule.metadata.updatedAt = new Date().toISOString();
    
    // Apply updates
    const updatedRule = { ...existingRule, ...updates };
    
    const result = this.ruleEngine.updateRule(ruleId, updatedRule);
    
    // Notify GUI
    if (this.eventBus) {
      this.eventBus.publishEvent('rule:updated', {
        ruleId: ruleId,
        rule: result,
        timestamp: Date.now()
      });
    }
    
    return result;
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId) {
    const existingRule = await this.getRule(ruleId);
    if (!existingRule) {
      throw new Error(`Rule ${ruleId} not found`);
    }
    
    const deletedRule = this.ruleEngine.removeRule(ruleId);
    
    // Notify GUI
    if (this.eventBus) {
      this.eventBus.publishEvent('rule:deleted', {
        ruleId: ruleId,
        timestamp: Date.now()
      });
    }
    
    return deletedRule;
  }

  /**
   * Enable/disable a rule
   */
  async toggleRule(ruleId, enabled) {
    return await this.updateRule(ruleId, { enabled });
  }

  /**
   * Get rules by category
   */
  async getRulesByCategory(category) {
    return this.rules.filter(rule => rule.metadata?.category === category);
  }

  /**
   * Get rules by connector type
   */
  async getRulesByConnectorType(connectorType) {
    return this.rules.filter(rule => rule.metadata?.connectorType === connectorType);
  }

  /**
   * Get enabled rules only
   */
  async getEnabledRules() {
    return this.rules.filter(rule => rule.enabled !== false);
  }

  /**
   * Get rule statistics
   */
  async getRuleStats() {
    if (!this.ruleEngine) {
      return {
        total: 0,
        enabled: 0,
        disabled: 0,
        byCategory: {},
        byConnectorType: {}
      };
    }
    
    const rules = this.ruleEngine.getRules();
    const stats = {
      total: rules.length,
      enabled: rules.filter(rule => rule.enabled !== false).length,
      disabled: rules.filter(rule => rule.enabled === false).length,
      byCategory: {},
      byConnectorType: {}
    };
    
    // Count by category
    rules.forEach(rule => {
      const category = rule.metadata?.category || 'general';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });
    
    // Count by connector type
    rules.forEach(rule => {
      const connectorType = rule.metadata?.connectorType || 'general';
      stats.byConnectorType[connectorType] = (stats.byConnectorType[connectorType] || 0) + 1;
    });
    
    return stats;
  }

  /**
   * Test a rule with sample event data
   */
  async testRule(ruleId, eventData = {}) {
    const rule = await this.getRule(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }
    
    // Create test event
    const testEvent = {
      type: eventData.type || rule.conditions?.eventType || 'test',
      source: eventData.source || rule.conditions?.source || 'test',
      data: eventData.data || {},
      timestamp: Date.now()
    };
    
    // Check if rule would match
    const matchingRules = this.findMatchingRules(testEvent);
    const wouldMatch = matchingRules.some(r => r.id === ruleId);
    
    return {
      rule,
      testEvent,
      wouldMatch,
      matchingRules: matchingRules.map(r => r.id)
    };
  }

  /**
   * Import rules from external source
   */
  async importRules(rulesData) {
    const importedRules = [];
    
    for (const ruleData of rulesData) {
      try {
        const rule = await this.addRule(ruleData);
        importedRules.push(rule);
      } catch (error) {
        console.error(`Failed to import rule ${ruleData.id}:`, error);
      }
    }
    
    return {
      total: rulesData.length,
      imported: importedRules.length,
      failed: rulesData.length - importedRules.length,
      rules: importedRules
    };
  }

  /**
   * Export rules to JSON
   */
  async exportRules() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      rules: this.rules
    };
  }

  /**
   * Get alarm statistics
   */
  async getStats() {
    const activeAlarms = Array.from(this.activeAlarms.values());
    const totalRules = this.rules.length;
    const enabledRules = this.rules.filter(rule => rule.enabled !== false).length;
    
    // Calculate statistics by priority
    const priorityStats = {};
    const statusStats = {};
    
    activeAlarms.forEach(alarm => {
      // Priority stats
      const priority = alarm.priority || 'medium';
      priorityStats[priority] = (priorityStats[priority] || 0) + 1;
      
      // Status stats
      const status = alarm.status || 'active';
      statusStats[status] = (statusStats[status] || 0) + 1;
    });
    
    return {
      totalAlarms: activeAlarms.length,
      totalRules,
      enabledRules,
      disabledRules: totalRules - enabledRules,
      priorityStats,
      statusStats,
      historySize: this.alarmHistory.length,
      channels: Array.from(this.channels.keys()),
      uptime: Date.now() - this.startTime,
      lastEvent: this.lastEventTime || null
    };
  }

  /**
   * Get alarm history
   */
  async getAlarmHistory(limit = 100, offset = 0, filters = {}) {
    let history = [...this.alarmHistory];
    
    // Apply filters
    if (filters.status) {
      history = history.filter(alarm => alarm.status === filters.status);
    }
    if (filters.ruleId) {
      history = history.filter(alarm => alarm.ruleId === filters.ruleId);
    }
    if (filters.eventType) {
      history = history.filter(alarm => alarm.eventType === filters.eventType);
    }
    
    // Apply pagination
    const start = offset;
    const end = start + limit;
    
    return history.slice(start, end);
  }

  /**
   * Disconnect the connector
   */
  async performDisconnect() {
    try {
      console.log('Disconnecting Alarm Manager Connector');
      
      // Clear active alarms
      this.activeAlarms.clear();
      
      // Clear event listeners
      if (this.eventBus) {
        this.eventTypes.forEach(eventType => {
          this.eventBus.unsubscribe(eventType, this.handleEvent.bind(this));
        });
      }
      
      this.connected = false;
      console.log('Alarm Manager Connector disconnected successfully');
      
    } catch (error) {
      console.error('Error during Alarm Manager disconnect:', error);
    }
  }

  /**
   * Send notification through configured channels
   */
  async sendNotification(channel, message, options = {}) {
    const channelConnector = this.channels.get(channel);
    if (!channelConnector) {
      this.logger.warn(`Channel ${channel} not configured - skipping notification`, {
        channel,
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        options
      });
      return {
        success: false,
        error: `Channel ${channel} not configured`,
        channel,
        timestamp: new Date().toISOString()
      };
    }

    try {
      switch (channel) {
        case 'telegram':
          await channelConnector.execute('telegram:send', 'text', {
            chatId: options.chatId,
            text: message,
            parseMode: 'HTML',
            ...options
          });
          break;
          
        case 'mqtt':
          await channelConnector.execute('mqtt:publish', 'message', {
            topic: options.topic || 'alarms/notifications',
            message: JSON.stringify({
              message,
              timestamp: Date.now(),
              ...options
            }),
            qos: options.qos || 1
          });
          break;
          
        default:
          this.logger.warn(`Unsupported channel: ${channel} - skipping notification`, {
            channel,
            message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
            options
          });
          return {
            success: false,
            error: `Unsupported channel: ${channel}`,
            channel,
            timestamp: new Date().toISOString()
          };
      }
      
      return {
        success: true,
        channel,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error(`Failed to send notification via ${channel}:`, error);
      return {
        success: false,
        error: error.message,
        channel,
        timestamp: new Date().toISOString()
      };
    }
  }

  async clearAlarm(action, event, rule) {
    try {
      const alarmId = action.parameters?.alarmId || action.config?.alarmId;
      
      if (alarmId) {
        await this.clearAlarmById(alarmId);
      } else {
        // Clear alarms matching the rule
        const alarmsToClear = Array.from(this.activeAlarms.values())
          .filter(alarm => alarm.ruleId === rule.id);
        
        for (const alarm of alarmsToClear) {
          await this.clearAlarmById(alarm.id);
        }
      }
      
    } catch (error) {
      console.error('Error clearing alarm:', error);
    }
  }

  async clearAlarmById(alarmId) {
    const alarm = this.activeAlarms.get(alarmId);
    if (!alarm) {
      console.warn(`Alarm ${alarmId} not found`);
      return;
    }
    
    // Update alarm status
    alarm.status = 'cleared';
    alarm.clearedAt = Date.now();
    
    // Remove from active alarms
    this.activeAlarms.delete(alarmId);
    
    // Add to history
    this.addToHistory(alarm);
    
    // Notify GUI
    if (this.eventBus) {
      this.eventBus.publishEvent('alarm:cleared', {
        alarmId,
        ruleId: alarm.ruleId,
        timestamp: Date.now()
      });
    }
    
    console.log(`Alarm ${alarmId} cleared`);
  }

  async clearAllAlarms() {
    const alarmIds = Array.from(this.activeAlarms.keys());
    
    for (const alarmId of alarmIds) {
      await this.clearAlarmById(alarmId);
    }
    
    console.log(`Cleared ${alarmIds.length} alarms`);
  }

  async clearAlarmsByRule(ruleId) {
    const alarmsToClear = Array.from(this.activeAlarms.values())
      .filter(alarm => alarm.ruleId === ruleId);
    
    for (const alarm of alarmsToClear) {
      await this.clearAlarmById(alarm.id);
    }
    
    console.log(`Cleared ${alarmsToClear.length} alarms for rule ${ruleId}`);
  }

  /**
   * Add alarm to history
   */
  addToHistory(alarm) {
    try {
      // Add to history array
      this.alarmHistory.unshift(alarm);
      
      // Limit history size
      if (this.alarmHistory.length > this.maxHistorySize) {
        this.alarmHistory = this.alarmHistory.slice(0, this.maxHistorySize);
      }
      
      this.logger.debug('Alarm added to history', {
        alarmId: alarm.id,
        historySize: this.alarmHistory.length
      });
    } catch (error) {
      this.logger.error('Error adding alarm to history:', error);
    }
  }
}

module.exports = AlarmManagerConnector;