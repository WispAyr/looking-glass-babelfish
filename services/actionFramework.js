const winston = require('winston');

/**
 * Action Framework
 * 
 * Provides standard actions for connectors and external integrations.
 * Handles action execution, parameter validation, and result processing.
 */
class ActionFramework {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger || winston.createLogger();
    
    // Action registry
    this.actions = new Map();
    
    // Action execution stats
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      lastExecution: null
    };
    
    // Initialize standard actions
    this.initializeStandardActions();
    
    this.logger.info('Action Framework initialized');
  }
  
  /**
   * Initialize standard actions
   */
  initializeStandardActions() {
    // MQTT Actions
    this.registerAction('mqtt_publish', this.mqttPublish.bind(this));
    this.registerAction('mqtt_subscribe', this.mqttSubscribe.bind(this));
    
    // Notification Actions
    this.registerAction('send_notification', this.sendNotification.bind(this));
    this.registerAction('send_email', this.sendEmail.bind(this));
    this.registerAction('send_sms', this.sendSMS.bind(this));
    this.registerAction('slack_notify', this.slackNotify.bind(this));
    this.registerAction('telegram_send', this.telegramSend.bind(this));
    
    // Connector Actions
    this.registerAction('connector_execute', this.connectorExecute.bind(this));
    this.registerAction('connector_connect', this.connectorConnect.bind(this));
    this.registerAction('connector_disconnect', this.connectorDisconnect.bind(this));
    
    // System Actions
    this.registerAction('log_event', this.logEvent.bind(this));
    this.registerAction('store_data', this.storeData.bind(this));
    this.registerAction('http_request', this.httpRequest.bind(this));
    
    // Utility Actions
    this.registerAction('delay', this.delay.bind(this));
    this.registerAction('transform_data', this.transformData.bind(this));
    this.registerAction('conditional_action', this.conditionalAction.bind(this));
  }
  
  /**
   * Register an action
   */
  registerAction(type, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Action handler must be a function');
    }
    
    this.actions.set(type, handler);
    this.logger.debug(`Action registered: ${type}`);
    
    return true;
  }
  
  /**
   * Execute an action
   */
  async executeAction(action, context) {
    if (!action) {
      throw new Error('Action is required but was undefined or null');
    }
    
    if (!action.type) {
      throw new Error('Action type is required but was undefined or null');
    }
    
    const handler = this.actions.get(action.type);
    if (!handler) {
      throw new Error(`Unknown action type: ${action.type}`);
    }
    
    try {
      this.stats.totalExecutions++;
      this.stats.lastExecution = new Date().toISOString();
      
      const result = await handler(action, context);
      
      this.stats.successfulExecutions++;
      this.logger.debug(`Action executed successfully: ${action.type}`);
      
      return {
        success: true,
        result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.stats.failedExecutions++;
      this.logger.error(`Action execution failed: ${action.type}`, error);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * MQTT Publish Action
   */
  async mqttPublish(action, context) {
    const { topic, payload, message, qos = 0, retain = false } = action.parameters || {};
    
    if (!topic) {
      throw new Error('MQTT topic is required');
    }
    
    // Get MQTT connector - try to find by type first, then by common IDs
    let mqttConnector = null;
    if (context.connectors) {
      // Try to find MQTT connector by type
      for (const [id, connector] of context.connectors) {
        if (connector.type === 'mqtt' || connector.config?.type === 'mqtt') {
          mqttConnector = connector;
          break;
        }
      }
      
      // If not found by type, try common MQTT connector IDs
      if (!mqttConnector) {
        const commonMqttIds = ['mqtt', 'mqtt-broker-main', 'mqtt-main', 'mqtt-broker'];
        for (const id of commonMqttIds) {
          if (context.connectors.has(id)) {
            mqttConnector = context.connectors.get(id);
            break;
          }
        }
      }
    }
    
    // Graceful degradation - log warning but don't throw error
    if (!mqttConnector) {
      this.logger.warn('MQTT connector not available - skipping MQTT publish action', {
        topic,
        action: action.type,
        context: context.event?.source || 'unknown'
      });
      return {
        success: false,
        error: 'MQTT connector not available',
        topic,
        timestamp: new Date().toISOString()
      };
    }
    
    // Check if MQTT connector is connected
    if (!mqttConnector.connected) {
      this.logger.warn('MQTT connector not connected - skipping MQTT publish action', {
        topic,
        connectorId: mqttConnector.id,
        action: action.type
      });
      return {
        success: false,
        error: 'MQTT connector not connected',
        topic,
        connectorId: mqttConnector.id,
        timestamp: new Date().toISOString()
      };
    }
    
    // Use payload if provided, otherwise fall back to message
    const messageToSend = payload || message;
    const finalPayload = typeof messageToSend === 'string' ? messageToSend : JSON.stringify(messageToSend);
    
    this.logger.debug(`Publishing to MQTT topic: ${topic}`, {
      payload: finalPayload,
      qos,
      retain,
      connectorId: mqttConnector.id
    });
    
    try {
      return await mqttConnector.execute('mqtt:publish', 'publish', {
        topic,
        message: finalPayload,
        qos,
        retain
      });
    } catch (error) {
      this.logger.error('Failed to publish MQTT message', {
        topic,
        error: error.message,
        connectorId: mqttConnector.id
      });
      return {
        success: false,
        error: error.message,
        topic,
        connectorId: mqttConnector.id,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * MQTT Subscribe Action
   */
  async mqttSubscribe(action, context) {
    const { topic, qos = 0 } = action.parameters || {};
    
    if (!topic) {
      throw new Error('MQTT topic is required');
    }
    
    // Get MQTT connector - try to find by type first, then by common IDs
    let mqttConnector = null;
    if (context.connectors) {
      // Try to find MQTT connector by type
      for (const [id, connector] of context.connectors) {
        if (connector.type === 'mqtt' || connector.config?.type === 'mqtt') {
          mqttConnector = connector;
          break;
        }
      }
      
      // If not found by type, try common MQTT connector IDs
      if (!mqttConnector) {
        const commonMqttIds = ['mqtt', 'mqtt-broker-main', 'mqtt-main', 'mqtt-broker'];
        for (const id of commonMqttIds) {
          if (context.connectors.has(id)) {
            mqttConnector = context.connectors.get(id);
            break;
          }
        }
      }
    }
    
    // Graceful degradation - log warning but don't throw error
    if (!mqttConnector) {
      this.logger.warn('MQTT connector not available - skipping MQTT subscribe action', {
        topic,
        action: action.type,
        context: context.event?.source || 'unknown'
      });
      return {
        success: false,
        error: 'MQTT connector not available',
        topic,
        timestamp: new Date().toISOString()
      };
    }
    
    // Check if MQTT connector is connected
    if (!mqttConnector.connected) {
      this.logger.warn('MQTT connector not connected - skipping MQTT subscribe action', {
        topic,
        connectorId: mqttConnector.id,
        action: action.type
      });
      return {
        success: false,
        error: 'MQTT connector not connected',
        topic,
        connectorId: mqttConnector.id,
        timestamp: new Date().toISOString()
      };
    }
    
    try {
      return await mqttConnector.execute('mqtt:subscribe', 'subscribe', {
        topic,
        qos
      });
    } catch (error) {
      this.logger.error('Failed to subscribe to MQTT topic', {
        topic,
        error: error.message,
        connectorId: mqttConnector.id
      });
      return {
        success: false,
        error: error.message,
        topic,
        connectorId: mqttConnector.id,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Send Notification Action
   */
  async sendNotification(action, context) {
    const { message, priority = 'normal', channels = ['gui'] } = action.parameters || {};
    
    if (!message) {
      throw new Error('Notification message is required');
    }
    
    const notification = {
      id: `notification-${Date.now()}`,
      message,
      priority,
      channels,
      timestamp: new Date().toISOString(),
      source: context.event?.source || 'rule-engine'
    };
    
    // Emit notification event
    context.eventBus?.emit('notification', notification);
    
    return notification;
  }
  
  /**
   * Send Email Action
   */
  async sendEmail(action, context) {
    const { to, subject, body, from } = action.parameters || {};
    
    if (!to || !subject || !body) {
      throw new Error('Email requires to, subject, and body parameters');
    }
    
    // This would integrate with an email service
    this.logger.info(`Email would be sent: ${to} - ${subject}`);
    
    return {
      sent: true,
      to,
      subject,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Send SMS Action
   */
  async sendSMS(action, context) {
    const { to, message } = action.parameters || {};
    
    if (!to || !message) {
      throw new Error('SMS requires to and message parameters');
    }
    
    // This would integrate with an SMS service
    this.logger.info(`SMS would be sent: ${to} - ${message}`);
    
    return {
      sent: true,
      to,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Slack Notify Action
   */
  async slackNotify(action, context) {
    const { channel, message, attachments } = action.parameters || {};
    
    if (!message) {
      throw new Error('Slack message is required');
    }
    
    // This would integrate with Slack API
    this.logger.info(`Slack notification would be sent: ${channel || '#general'} - ${message}`);
    
    return {
      sent: true,
      channel: channel || '#general',
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Telegram Send Action
   */
  async telegramSend(action, context) {
    const { connectorId, operation, chatId, text, photo, document, location, parseMode, keyboard } = action.parameters || {};
    
    if (!connectorId) {
      throw new Error('Telegram send requires connectorId');
    }
    
    if (!operation) {
      throw new Error('Telegram send requires operation');
    }
    
    const connector = context.connectors?.get(connectorId);
    if (!connector) {
      throw new Error(`Telegram connector not found: ${connectorId}`);
    }
    
    // Prepare parameters based on operation
    const parameters = {
      chatId,
      parseMode
    };
    
    switch (operation) {
      case 'text':
        if (!text) {
          throw new Error('Text operation requires text parameter');
        }
        parameters.text = text;
        break;
      case 'photo':
        if (!photo) {
          throw new Error('Photo operation requires photo parameter');
        }
        parameters.photo = photo;
        if (text) parameters.caption = text;
        break;
      case 'document':
        if (!document) {
          throw new Error('Document operation requires document parameter');
        }
        parameters.document = document;
        if (text) parameters.caption = text;
        break;
      case 'location':
        if (!location || !location.latitude || !location.longitude) {
          throw new Error('Location operation requires latitude and longitude');
        }
        parameters.latitude = location.latitude;
        parameters.longitude = location.longitude;
        break;
      default:
        throw new Error(`Unknown Telegram operation: ${operation}`);
    }
    
    // Add keyboard if provided
    if (keyboard) {
      parameters.reply_markup = keyboard;
    }
    
    this.logger.debug(`Sending Telegram message: ${operation} to ${chatId}`);
    
    return await connector.execute('telegram:send', operation, parameters);
  }
  
  /**
   * Connector Execute Action
   */
  async connectorExecute(action, context) {
    const { connectorId, capabilityId, operation, parameters } = action.parameters || {};
    
    if (!connectorId || !capabilityId || !operation) {
      throw new Error('Connector execute requires connectorId, capabilityId, and operation');
    }
    
    const connector = context.connectors?.get(connectorId);
    if (!connector) {
      throw new Error(`Connector not found: ${connectorId}`);
    }
    
    return await connector.execute(capabilityId, operation, parameters || {});
  }
  
  /**
   * Connector Connect Action
   */
  async connectorConnect(action, context) {
    const { connectorId } = action.parameters || {};
    
    if (!connectorId) {
      throw new Error('Connector connect requires connectorId');
    }
    
    const connector = context.connectors?.get(connectorId);
    if (!connector) {
      throw new Error(`Connector not found: ${connectorId}`);
    }
    
    return await connector.connect();
  }
  
  /**
   * Connector Disconnect Action
   */
  async connectorDisconnect(action, context) {
    const { connectorId } = action.parameters || {};
    
    if (!connectorId) {
      throw new Error('Connector disconnect requires connectorId');
    }
    
    const connector = context.connectors?.get(connectorId);
    if (!connector) {
      throw new Error(`Connector not found: ${connectorId}`);
    }
    
    return await connector.disconnect();
  }
  
  /**
   * Log Event Action
   */
  async logEvent(action, context) {
    const { level = 'info', message, data } = action.parameters || {};
    
    const logMessage = message || `Rule execution: ${context.rule?.name}`;
    const logData = {
      ...data,
      ruleId: context.rule?.id,
      eventId: context.event?.id,
      timestamp: new Date().toISOString()
    };
    
    this.logger.log(level, logMessage, logData);
    
    return {
      logged: true,
      level,
      message: logMessage,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Store Data Action
   */
  async storeData(action, context) {
    const { key, value, ttl } = action.parameters || {};
    
    if (!key) {
      throw new Error('Store data requires a key');
    }
    
    const cache = context.cache;
    if (!cache) {
      throw new Error('Cache not available');
    }
    
    await cache.set(key, value, ttl);
    
    return {
      stored: true,
      key,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * HTTP Request Action
   */
  async httpRequest(action, context) {
    const { method = 'GET', url, headers, body, timeout = 10000 } = action.parameters || {};
    
    if (!url) {
      throw new Error('HTTP request requires a URL');
    }
    
    // This would use axios or similar for HTTP requests
    this.logger.info(`HTTP request would be made: ${method} ${url}`);
    
    return {
      requested: true,
      method,
      url,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Delay Action
   */
  async delay(action, context) {
    const { duration = 1000 } = action.parameters || {};
    
    await new Promise(resolve => setTimeout(resolve, duration));
    
    return {
      delayed: true,
      duration,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Transform Data Action
   */
  async transformData(action, context) {
    const { input, transform } = action.parameters || {};
    
    if (!input || !transform) {
      throw new Error('Transform data requires input and transform parameters');
    }
    
    let result = input;
    
    // Apply transformations
    if (transform.type === 'template') {
      result = this.applyTemplate(input, transform.template);
    } else if (transform.type === 'function' && typeof transform.function === 'function') {
      result = transform.function(input, context);
    }
    
    return {
      transformed: true,
      input,
      output: result,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Conditional Action
   */
  async conditionalAction(action, context) {
    const { condition, trueAction, falseAction } = action.parameters || {};
    
    if (!condition) {
      throw new Error('Conditional action requires a condition');
    }
    
    const conditionResult = this.evaluateCondition(condition, context);
    const actionToExecute = conditionResult ? trueAction : falseAction;
    
    if (actionToExecute) {
      return await this.executeAction(actionToExecute, context);
    }
    
    return {
      conditionResult,
      executed: !!actionToExecute,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Apply template transformation
   */
  applyTemplate(input, template) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return input[key] || match;
    });
  }
  
  /**
   * Evaluate condition
   */
  evaluateCondition(condition, context) {
    if (typeof condition === 'function') {
      return condition(context);
    }
    
    if (typeof condition === 'string') {
      // Simple string-based condition evaluation
      return !!condition;
    }
    
    return !!condition;
  }
  
  /**
   * Get available actions
   */
  getAvailableActions() {
    return Array.from(this.actions.keys());
  }
  
  /**
   * Get action statistics
   */
  getStats() {
    return {
      ...this.stats,
      availableActions: this.actions.size
    };
  }
}

module.exports = ActionFramework; 