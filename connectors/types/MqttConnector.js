const BaseConnector = require('../BaseConnector');
const mqtt = require('mqtt');

/**
 * MQTT Connector
 * 
 * Provides integration with MQTT brokers for publish/subscribe messaging.
 * Supports MQTT 3.1.1 and 5.0 protocols with TLS/SSL support.
 */
class MqttConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // MQTT client
    this.client = null;
    
    // Connection options
    this.connectionOptions = this.buildConnectionOptions();
    
    // Message history
    this.messageHistory = new Map();
    this.maxHistorySize = 1000;
    
    // Subscription tracking
    this.subscriptions = new Map();
    
    // Message queue for offline publishing
    this.messageQueue = [];
    this.maxQueueSize = 100;
    
    // Reconnection settings
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = this.config.maxReconnectAttempts || 10;
  }
  
  /**
   * Build MQTT connection options
   */
  buildConnectionOptions() {
    const { host, port, protocol, clientId, username, password, keepalive, reconnectPeriod, connectTimeout, clean, ca, cert, key, rejectUnauthorized } = this.config;
    
    const options = {
      clientId: clientId || `looking-glass-${this.id}-${Date.now()}`,
      keepalive: keepalive || 60,
      reconnectPeriod: reconnectPeriod || 1000,
      connectTimeout: connectTimeout || 30000,
      clean: clean !== false,
      reschedulePings: true,
      queueQoSZero: true
    };
    
    // Authentication
    if (username) options.username = username;
    if (password) options.password = password;
    
    // TLS/SSL options
    if (protocol === 'mqtts' || protocol === 'wss') {
      options.rejectUnauthorized = rejectUnauthorized !== false;
      if (ca) options.ca = ca;
      if (cert) options.cert = cert;
      if (key) options.key = key;
    }
    
    // MQTT 5.0 options
    if (this.config.protocolVersion === 5) {
      options.protocolVersion = 5;
      options.properties = this.config.properties || {};
    }
    
    return options;
  }
  
  /**
   * Perform connection to MQTT broker
   */
  async performConnect() {
    const { host, port, protocol } = this.config;
    
    if (!host) {
      throw new Error('Host is required for MQTT connection');
    }
    
    const url = `${protocol}://${host}:${port}`;
    
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(url, this.connectionOptions);
      
      this.client.on('connect', () => {
        this.reconnectAttempts = 0;
        console.log(`Connected to MQTT broker: ${url}`);
        
        // Process queued messages
        this.processMessageQueue();
        
        resolve();
      });
      
      this.client.on('message', (topic, message, packet) => {
        this.handleMessage(topic, message, packet);
      });
      
      this.client.on('error', (error) => {
        console.error('MQTT error:', error);
        this.emit('error', error);
      });
      
      this.client.on('close', () => {
        console.log('MQTT connection closed');
        this.emit('disconnected', {
          connectorId: this.id,
          timestamp: new Date().toISOString()
        });
      });
      
      this.client.on('reconnect', () => {
        this.reconnectAttempts++;
        console.log(`MQTT reconnecting... (attempt ${this.reconnectAttempts})`);
        
        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          console.error('Max reconnection attempts reached');
          this.client.end();
        }
      });
      
      this.client.on('offline', () => {
        console.log('MQTT client offline');
      });
    });
  }
  
  /**
   * Perform disconnection from MQTT broker
   */
  async performDisconnect() {
    if (this.client) {
      return new Promise((resolve) => {
        this.client.end(true, {}, () => {
          this.client = null;
          resolve();
        });
      });
    }
  }
  
  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'mqtt:publish':
        return this.executePublish(operation, parameters);
      
      case 'mqtt:subscribe':
        return this.executeSubscribe(operation, parameters);
      
      case 'mqtt:topics':
        return this.executeTopicManagement(operation, parameters);
      
      case 'mqtt:connection':
        return this.executeConnectionManagement(operation, parameters);
      
      case 'mqtt:history':
        return this.executeHistoryManagement(operation, parameters);
      
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }
  
  /**
   * Execute publish operations
   */
  async executePublish(operation, parameters) {
    switch (operation) {
      case 'publish':
        return this.publishMessage(parameters);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * Execute subscribe operations
   */
  async executeSubscribe(operation, parameters) {
    switch (operation) {
      case 'subscribe':
        return this.subscribeToTopic(parameters);
      
      case 'unsubscribe':
        return this.unsubscribeFromTopic(parameters);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * Execute topic management operations
   */
  async executeTopicManagement(operation, parameters) {
    switch (operation) {
      case 'list':
        return this.listTopics(parameters);
      
      case 'create':
        return this.createTopic(parameters);
      
      case 'delete':
        return this.deleteTopic(parameters);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * Execute connection management operations
   */
  async executeConnectionManagement(operation, parameters) {
    switch (operation) {
      case 'connect':
        return this.connect();
      
      case 'disconnect':
        return this.disconnect();
      
      case 'status':
        return this.getConnectionStatus(parameters);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * Execute history management operations
   */
  async executeHistoryManagement(operation, parameters) {
    switch (operation) {
      case 'read':
        return this.getMessageHistory(parameters);
      
      case 'clear':
        return this.clearMessageHistory(parameters);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * Publish message to MQTT topic
   */
  async publishMessage(parameters) {
    const { topic, payload, qos = 0, retain = false, properties = {} } = parameters;
    
    if (!topic) {
      throw new Error('Topic is required for publishing');
    }
    
    if (payload === undefined || payload === null) {
      throw new Error('Payload is required for publishing');
    }
    
    // Prepare message
    let message = payload;
    if (typeof payload === 'object') {
      message = JSON.stringify(payload);
    }
    
    // Publish options
    const options = {
      qos,
      retain,
      ...properties
    };
    
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        // Queue message if not connected
        this.queueMessage(topic, message, options);
        resolve({ queued: true, topic });
        return;
      }
      
      this.client.publish(topic, message, options, (error) => {
        if (error) {
          reject(new Error(`Failed to publish message: ${error.message}`));
        } else {
          // Emit publish event
          this.emit('message-published', {
            topic,
            payload: message,
            qos,
            retain,
            timestamp: new Date().toISOString()
          });
          
          resolve({ published: true, topic });
        }
      });
    });
  }
  
  /**
   * Subscribe to MQTT topic
   */
  async subscribeToTopic(parameters) {
    const { topic, qos = 0, options = {} } = parameters;
    
    if (!topic) {
      throw new Error('Topic is required for subscription');
    }
    
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        reject(new Error('MQTT client not connected'));
        return;
      }
      
      this.client.subscribe(topic, { qos, ...options }, (error, granted) => {
        if (error) {
          reject(new Error(`Failed to subscribe: ${error.message}`));
        } else {
          // Store subscription
          this.subscriptions.set(topic, {
            qos,
            options,
            timestamp: new Date().toISOString()
          });
          
          resolve({ subscribed: true, topic, granted });
        }
      });
    });
  }
  
  /**
   * Unsubscribe from MQTT topic
   */
  async unsubscribeFromTopic(parameters) {
    const { topic } = parameters;
    
    if (!topic) {
      throw new Error('Topic is required for unsubscription');
    }
    
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        reject(new Error('MQTT client not connected'));
        return;
      }
      
      this.client.unsubscribe(topic, (error) => {
        if (error) {
          reject(new Error(`Failed to unsubscribe: ${error.message}`));
        } else {
          // Remove subscription
          this.subscriptions.delete(topic);
          
          resolve({ unsubscribed: true, topic });
        }
      });
    });
  }
  
  /**
   * List topics (returns current subscriptions)
   */
  async listTopics(parameters) {
    const { pattern } = parameters;
    
    const topics = Array.from(this.subscriptions.keys());
    
    if (pattern) {
      // Simple pattern matching
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
      return topics.filter(topic => regex.test(topic));
    }
    
    return topics;
  }
  
  /**
   * Create topic (MQTT doesn't have topic creation, this is a placeholder)
   */
  async createTopic(parameters) {
    const { topic, properties = {} } = parameters;
    
    if (!topic) {
      throw new Error('Topic is required');
    }
    
    // In MQTT, topics are created implicitly when messages are published
    // This method is mainly for compatibility with the connector interface
    
    return { created: true, topic, properties };
  }
  
  /**
   * Delete topic (MQTT doesn't have topic deletion, this is a placeholder)
   */
  async deleteTopic(parameters) {
    const { topic } = parameters;
    
    if (!topic) {
      throw new Error('Topic is required');
    }
    
    // In MQTT, topics are not explicitly deleted
    // This method is mainly for compatibility with the connector interface
    
    return { deleted: true, topic };
  }
  
  /**
   * Get connection status
   */
  async getConnectionStatus(parameters) {
    if (!this.client) {
      return {
        connected: false,
        status: 'disconnected'
      };
    }
    
    return {
      connected: this.client.connected,
      status: this.client.connected ? 'connected' : 'disconnected',
      clientId: this.connectionOptions.clientId,
      subscriptions: this.subscriptions.size,
      messageHistory: this.messageHistory.size,
      queuedMessages: this.messageQueue.length
    };
  }
  
  /**
   * Get message history
   */
  async getMessageHistory(parameters) {
    const { topic, limit = 100, since } = parameters;
    
    let messages = Array.from(this.messageHistory.values());
    
    // Filter by topic
    if (topic) {
      messages = messages.filter(msg => msg.topic === topic);
    }
    
    // Filter by timestamp
    if (since) {
      const sinceDate = new Date(since);
      messages = messages.filter(msg => new Date(msg.timestamp) >= sinceDate);
    }
    
    // Apply limit
    if (limit) {
      messages = messages.slice(-limit);
    }
    
    return messages;
  }
  
  /**
   * Clear message history
   */
  async clearMessageHistory(parameters) {
    const { topic } = parameters;
    
    if (topic) {
      // Clear specific topic
      for (const [key, message] of this.messageHistory.entries()) {
        if (message.topic === topic) {
          this.messageHistory.delete(key);
        }
      }
    } else {
      // Clear all history
      this.messageHistory.clear();
    }
    
    return { cleared: true, topic: topic || 'all' };
  }
  
  /**
   * Handle incoming MQTT messages
   */
  handleMessage(topic, message, packet) {
    let payload = message.toString();
    
    // Try to parse as JSON
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      // Keep as string if not JSON
    }
    
    const messageData = {
      topic,
      payload,
      qos: packet.qos,
      retain: packet.retain,
      dup: packet.dup,
      messageId: packet.messageId,
      timestamp: new Date().toISOString(),
      properties: packet.properties || {}
    };
    
    // Store in history
    this.storeMessageInHistory(messageData);
    
    // Emit message received event
    this.emit('message-received', messageData);
    
    // Emit to event bus
    this.emit('connector:mqtt:message', {
      connectorId: this.id,
      event: 'message-received',
      data: messageData
    });
  }
  
  /**
   * Store message in history
   */
  storeMessageInHistory(messageData) {
    const key = `${messageData.topic}:${messageData.timestamp}`;
    this.messageHistory.set(key, messageData);
    
    // Limit history size
    if (this.messageHistory.size > this.maxHistorySize) {
      const firstKey = this.messageHistory.keys().next().value;
      this.messageHistory.delete(firstKey);
    }
  }
  
  /**
   * Queue message for later publishing
   */
  queueMessage(topic, message, options) {
    const queuedMessage = {
      topic,
      message,
      options,
      timestamp: new Date().toISOString()
    };
    
    this.messageQueue.push(queuedMessage);
    
    // Limit queue size
    if (this.messageQueue.length > this.maxQueueSize) {
      this.messageQueue.shift();
    }
  }
  
  /**
   * Process queued messages
   */
  async processMessageQueue() {
    if (!this.client || !this.client.connected) {
      return;
    }
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const queuedMessage of messages) {
      try {
        await this.publishMessage({
          topic: queuedMessage.topic,
          payload: queuedMessage.message,
          ...queuedMessage.options
        });
      } catch (error) {
        console.error('Failed to publish queued message:', error.message);
        // Re-queue failed messages
        this.queueMessage(queuedMessage.topic, queuedMessage.message, queuedMessage.options);
      }
    }
  }
  
  /**
   * Get capability definitions
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'mqtt:publish',
        name: 'Message Publishing',
        description: 'Publish messages to MQTT topics',
        category: 'messaging',
        operations: ['publish'],
        dataTypes: ['application/json', 'text/plain', 'application/octet-stream'],
        events: ['message-published', 'publish-error'],
        parameters: {
          topic: { type: 'string', required: true },
          payload: { type: 'any', required: true },
          qos: { type: 'number', enum: [0, 1, 2] },
          retain: { type: 'boolean' },
          properties: { type: 'object' }
        },
        requiresConnection: true
      },
      {
        id: 'mqtt:subscribe',
        name: 'Message Subscription',
        description: 'Subscribe to MQTT topics',
        category: 'messaging',
        operations: ['subscribe', 'unsubscribe'],
        dataTypes: ['application/json', 'text/plain', 'application/octet-stream'],
        events: ['message-received', 'subscription-error'],
        parameters: {
          topic: { type: 'string', required: true },
          qos: { type: 'number', enum: [0, 1, 2] },
          options: { type: 'object' }
        },
        requiresConnection: true
      },
      {
        id: 'mqtt:topics',
        name: 'Topic Management',
        description: 'Manage MQTT topics',
        category: 'messaging',
        operations: ['list', 'create', 'delete'],
        dataTypes: ['application/json'],
        events: [],
        parameters: {
          topic: { type: 'string', required: false },
          pattern: { type: 'string', required: false },
          properties: { type: 'object', required: false }
        },
        requiresConnection: false
      },
      {
        id: 'mqtt:connection',
        name: 'Connection Management',
        description: 'Manage MQTT broker connections',
        category: 'system',
        operations: ['connect', 'disconnect', 'status'],
        dataTypes: ['application/json'],
        events: ['connected', 'disconnected', 'error'],
        parameters: {},
        requiresConnection: false
      },
      {
        id: 'mqtt:history',
        name: 'Message History',
        description: 'Access message history and retained messages',
        category: 'data',
        operations: ['read', 'clear'],
        dataTypes: ['application/json'],
        events: [],
        parameters: {
          topic: { type: 'string', required: false },
          limit: { type: 'number', required: false },
          since: { type: 'string', required: false }
        },
        requiresConnection: false
      }
    ];
  }
  
  /**
   * Validate configuration
   */
  static validateConfig(config) {
    BaseConnector.validateConfig(config);
    
    const { host } = config.config || {};
    
    if (!host) {
      throw new Error('Host is required for MQTT connector');
    }
    
    return true;
  }
  
  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      type: 'mqtt',
      version: '1.0.0',
      description: 'MQTT broker connector for publish/subscribe messaging',
      author: 'Looking Glass Platform',
      capabilities: [
        'mqtt:publish',
        'mqtt:subscribe',
        'mqtt:topics',
        'mqtt:connection',
        'mqtt:history'
      ]
    };
  }
}

module.exports = MqttConnector; 