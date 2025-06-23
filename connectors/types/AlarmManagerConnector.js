const BaseConnector = require('../BaseConnector');
const EventEmitter = require('events');

/**
 * Rule Engine for processing alarm rules
 */
class RuleEngine {
  constructor() {
    this.rules = new Map();
  }

  registerRule(rule) {
    this.rules.set(rule.id, rule);
  }

  evaluateEvent(event) {
    const triggeredRules = [];
    
    for (const rule of this.rules.values()) {
      if (this.matchesConditions(rule.conditions, event)) {
        triggeredRules.push(rule);
      }
    }
    
    return triggeredRules;
  }

  matchesConditions(conditions, event) {
    // Check event type
    if (conditions.eventType && conditions.eventType !== event.type) {
      return false;
    }

    // Check source
    if (conditions.eventSource && conditions.eventSource !== event.source) {
      return false;
    }

    // Check severity
    if (conditions.severity && event.severity) {
      const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
      if (severityLevels[event.severity] < severityLevels[conditions.severity]) {
        return false;
      }
    }

    return true;
  }

  parseTime(timeStr) {
    return new Date(timeStr);
  }

  getRules() {
    return Array.from(this.rules.values());
  }
}

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
      throw new Error(`Channel ${channel} not configured`);
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
          throw new Error(`Unsupported channel: ${channel}`);
      }
    } catch (error) {
      console.error(`Failed to send notification via ${channel}:`, error);
      throw error;
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
 * Manages alarm rules, conditions, and notifications with database persistence.
 * Integrates with Telegram, MQTT, and other notification channels.
 */
class AlarmManagerConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    this.ruleEngine = new RuleEngine();
    this.notificationManager = new NotificationManager();
    this.commandProcessor = new CommandProcessor(this);
    this.escalationManager = new EscalationManager();
    
    this.channels = {};
    this.rules = [];
    this.alarmService = null;
    
    // Event types to listen for
    this.eventTypes = [
      'motion', 'smartDetectZone', 'camera', 'system',
      'aircraft:detected', 'aircraft:emergency', 'squawk:analysis',
      'notam:alert', 'speed:violation', 'intrusion', 'doorbell'
    ];
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
        operations: ['create', 'read', 'update', 'delete', 'list'],
        dataTypes: ['rule', 'condition', 'action'],
        events: ['rule:created', 'rule:updated', 'rule:deleted', 'alarm:triggered'],
        parameters: {
          ruleId: { type: 'string', required: false },
          category: { type: 'string', required: false }
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
      this.logger.info('Connecting Alarm Manager Connector');
      
      // Initialize alarm service
      const AlarmManagerService = require('../../services/alarmManagerService');
      this.alarmService = new AlarmManagerService();
      await this.alarmService.initialize();
      
      // Load rules from database
      await this.loadRulesFromDatabase();
      
      // Set up notification channels
      await this.setupNotificationChannels();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Set up command processor
      this.setupCommandProcessor();
      
      this.logger.info('Alarm Manager Connector connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect Alarm Manager Connector', error);
      throw error;
    }
  }

  /**
   * Load rules from database
   */
  async loadRulesFromDatabase() {
    try {
      const rules = await this.alarmService.getEnabledRules();
      this.rules = rules;
      
      // Register rules with rule engine
      this.ruleEngine.rules.clear();
      for (const rule of rules) {
        this.ruleEngine.registerRule(rule);
      }
      
      this.logger.info(`Rule engine initialized with ${rules.length} rules`);
    } catch (error) {
      this.logger.error('Failed to load rules from database:', error);
    }
  }

  /**
   * Set up notification channels
   */
  async setupNotificationChannels() {
    if (this.connectorRegistry) {
      // Get existing Telegram connector from registry
      const telegramConnector = this.connectorRegistry.getConnector('telegram-bot-main');
      if (telegramConnector) {
        this.channels.telegram = telegramConnector;
        this.notificationManager.registerChannel('telegram', telegramConnector);
        this.logger.info('Telegram notification channel configured');
      }
      
      // Set up MQTT channel
      const mqttConnector = this.connectorRegistry.getConnector('mqtt-broker-main');
      if (mqttConnector) {
        this.channels.mqtt = mqttConnector;
        this.notificationManager.registerChannel('mqtt', mqttConnector);
        this.logger.info('MQTT notification channel configured');
      }
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    if (this.eventBus) {
      this.eventTypes.forEach(eventType => {
        this.eventBus.subscribe(eventType, (event) => {
          this.processEvent(event);
        });
      });
      
      this.logger.info(`Event listeners set up for ${this.eventTypes.length} event types`);
    }
  }

  /**
   * Set up command processor
   */
  setupCommandProcessor() {
    if (this.channels.telegram) {
      // Listen for Telegram commands
      this.channels.telegram.on('message', (msg) => {
        if (msg.text && msg.text.startsWith('/')) {
          this.commandProcessor.processCommand(msg);
        }
      });
      
      this.logger.info('Command processor configured for Telegram');
    }
  }

  /**
   * Process an event
   */
  async processEvent(event) {
    try {
      // Evaluate event against rules
      const triggeredRules = this.ruleEngine.evaluateEvent(event);
      
      if (triggeredRules.length === 0) {
        this.logger.debug('No rules matched for event:', event.type);
        return;
      }
      
      // Process each triggered rule
      for (const rule of triggeredRules) {
        await this.processRule(rule, event);
      }
    } catch (error) {
      this.logger.error('Error processing event:', error);
    }
  }

  /**
   * Process a rule against an event
   */
  async processRule(rule, event) {
    try {
      this.logger.info(`Rule "${rule.name}" triggered for event: ${event.type}`);
      
      // Record alarm trigger
      const alarmId = await this.alarmService.recordAlarmTrigger(
        rule.id,
        event.type,
        event.source,
        event
      );
      
      // Start escalation
      this.escalationManager.startEscalation(alarmId, rule);
      
      // Execute actions
      for (const action of rule.actions) {
        switch (action.type) {
          case 'notification':
            // Send notification to all specified channels
            for (const channel of action.config.channels || ['telegram']) {
              const message = this.interpolateTemplate(action.config.message, event, rule);
              await this.sendNotification(channel, message, { 
                priority: action.config.priority || rule.priority || 'medium' 
              });
            }
            break;
            
          case 'webhook':
            await this.executeWebhook(action, event, rule);
            break;
            
          case 'mqtt':
            await this.publishMQTT(action, event, rule);
            break;
            
          default:
            this.logger.warn(`Unknown action type: ${action.type}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing rule ${rule.name}:`, error);
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
      if (!this.channels.mqtt) {
        throw new Error('MQTT channel not configured');
      }

      const topic = this.interpolateTemplate(action.config.topic, event, rule);
      const message = this.interpolateTemplate(action.config.message, event, rule);

      await this.channels.mqtt.execute('mqtt:publish', 'message', {
        topic,
        message: JSON.stringify({
          event,
          rule,
          message,
          timestamp: Date.now()
        }),
        qos: action.config.qos || 1
      });

      this.logger.debug(`MQTT message published to topic: ${topic}`);
    } catch (error) {
      this.logger.error(`MQTT publish failed: ${error.message}`);
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
      .replace(/\{\{event\.data\.(\w+)\}\}/g, (match, key) => {
        return event.data && event.data[key] ? event.data[key] : '';
      });
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
        return await this.alarmService.createRule(parameters);
      case 'read':
        return await this.alarmService.getRule(parameters.ruleId);
      case 'update':
        return await this.alarmService.updateRule(parameters.ruleId, parameters);
      case 'delete':
        return await this.alarmService.deleteRule(parameters.ruleId);
      case 'list':
        return await this.alarmService.getAllRules();
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
        return await this.alarmService.getAlarmHistory(parameters.limit, parameters.offset, parameters.filters);
      case 'stats':
        return await this.alarmService.getStats();
      case 'acknowledge':
        return await this.alarmService.acknowledgeAlarm(parameters.alarmId, parameters.userId, parameters.notes);
      case 'resolve':
        return await this.alarmService.resolveAlarm(parameters.alarmId, parameters.userId);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Get all rules (for compatibility)
   */
  async getAllRules() {
    return await this.alarmService.getAllRules();
  }

  /**
   * Get statistics
   */
  async getStats() {
    return await this.alarmService.getStats();
  }

  /**
   * Get alarm history
   */
  async getAlarmHistory(limit = 100, offset = 0, filters = {}) {
    return await this.alarmService.getAlarmHistory(limit, offset, filters);
  }

  /**
   * Disconnect the connector
   */
  async performDisconnect() {
    try {
      this.logger.info('Disconnecting Alarm Manager Connector');
      
      if (this.alarmService) {
        await this.alarmService.close();
      }
      
      this.logger.info('Alarm Manager Connector disconnected successfully');
    } catch (error) {
      this.logger.error('Error during disconnect:', error);
    }
  }

  /**
   * Send notification through configured channels
   */
  async sendNotification(channel, message, options = {}) {
    return await this.notificationManager.sendNotification(channel, message, options);
  }
}

module.exports = AlarmManagerConnector; 