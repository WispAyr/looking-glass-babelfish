const mqtt = require('mqtt');
const EventEmitter = require('events');

class MQTTBroker extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.client = null;
    this.isConnected = false;
    this.subscribers = new Map();
    this.publishedMessages = [];
  }

  async initialize() {
    this.logger.info('Initializing MQTT Broker...');
    
    try {
      await this.connect();
      this.setupEventHandlers();
      this.logger.info('MQTT Broker initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MQTT Broker:', error);
      throw error;
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const options = {
        clientId: this.config.broker.clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
        keepalive: 60
      };

      if (this.config.broker.username) {
        options.username = this.config.broker.username;
        options.password = this.config.broker.password;
      }

      const url = `mqtt://${this.config.broker.host}:${this.config.broker.port}`;
      
      this.logger.info(`Connecting to MQTT broker at ${url}`);
      
      this.client = mqtt.connect(url, options);

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.info('Connected to MQTT broker');
        resolve();
      });

      this.client.on('error', (error) => {
        this.logger.error('MQTT connection error:', error);
        reject(error);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.warn('MQTT connection closed');
      });

      this.client.on('reconnect', () => {
        this.logger.info('Reconnecting to MQTT broker...');
      });
    });
  }

  setupEventHandlers() {
    this.client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleIncomingMessage(topic, data);
      } catch (error) {
        this.logger.error(`Failed to parse MQTT message from ${topic}:`, error);
      }
    });
  }

  handleIncomingMessage(topic, data) {
    this.logger.debug(`Received MQTT message on topic ${topic}:`, data);
    
    // Emit event for other parts of the application
    this.emit('message', { topic, data });
    
    // Handle specific topics
    switch (topic) {
      case this.config.topics.control:
        this.handleControlMessage(data);
        break;
      case this.config.topics.system:
        this.handleSystemMessage(data);
        break;
      default:
        this.logger.debug(`Unhandled MQTT topic: ${topic}`);
    }
  }

  handleControlMessage(data) {
    this.logger.info('Received control message:', data);
    
    // Handle different control commands
    switch (data.command) {
      case 'restart':
        this.emit('control:restart', data);
        break;
      case 'refresh':
        this.emit('control:refresh', data);
        break;
      case 'config':
        this.emit('control:config', data);
        break;
      default:
        this.logger.warn(`Unknown control command: ${data.command}`);
    }
  }

  handleSystemMessage(data) {
    this.logger.info('Received system message:', data);
    this.emit('system', data);
  }

  async publish(topic, data) {
    if (!this.isConnected) {
      this.logger.warn('MQTT not connected, cannot publish message');
      return false;
    }

    try {
      const message = JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        source: 'babelfish'
      });

      this.client.publish(topic, message, { qos: 1 }, (error) => {
        if (error) {
          this.logger.error(`Failed to publish to ${topic}:`, error);
        } else {
          this.logger.debug(`Published to ${topic}:`, data);
          
          // Store published message for debugging
          this.publishedMessages.push({
            topic,
            data,
            timestamp: new Date().toISOString()
          });

          // Keep only last 100 messages
          if (this.publishedMessages.length > 100) {
            this.publishedMessages = this.publishedMessages.slice(-100);
          }
        }
      });

      return true;
    } catch (error) {
      this.logger.error(`Error publishing to ${topic}:`, error);
      return false;
    }
  }

  async subscribe(topic, callback) {
    if (!this.isConnected) {
      this.logger.warn('MQTT not connected, cannot subscribe');
      return false;
    }

    try {
      this.client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          this.logger.error(`Failed to subscribe to ${topic}:`, error);
        } else {
          this.logger.info(`Subscribed to ${topic}`);
          this.subscribers.set(topic, callback);
        }
      });

      return true;
    } catch (error) {
      this.logger.error(`Error subscribing to ${topic}:`, error);
      return false;
    }
  }

  async unsubscribe(topic) {
    if (!this.isConnected) {
      return false;
    }

    try {
      this.client.unsubscribe(topic, (error) => {
        if (error) {
          this.logger.error(`Failed to unsubscribe from ${topic}:`, error);
        } else {
          this.logger.info(`Unsubscribed from ${topic}`);
          this.subscribers.delete(topic);
        }
      });

      return true;
    } catch (error) {
      this.logger.error(`Error unsubscribing from ${topic}:`, error);
      return false;
    }
  }

  publishEvent(event) {
    return this.publish(this.config.topics.events, {
      type: 'event',
      event: event
    });
  }

  publishCameraStatus(camera) {
    return this.publish(this.config.topics.cameras, {
      type: 'camera_status',
      camera: camera
    });
  }

  publishSystemStatus(status) {
    return this.publish(this.config.topics.system, {
      type: 'system_status',
      status: status
    });
  }

  publishHeartbeat() {
    return this.publish(this.config.topics.system, {
      type: 'heartbeat',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  }

  getStatus() {
    return {
      connected: this.isConnected,
      clientId: this.config.broker.clientId,
      broker: `${this.config.broker.host}:${this.config.broker.port}`,
      subscribers: this.subscribers.size,
      publishedMessages: this.publishedMessages.length
    };
  }

  getPublishedMessages(limit = 50) {
    return this.publishedMessages.slice(-limit);
  }

  async disconnect() {
    if (this.client) {
      this.logger.info('Disconnecting from MQTT broker...');
      
      return new Promise((resolve) => {
        this.client.end(true, () => {
          this.isConnected = false;
          this.logger.info('Disconnected from MQTT broker');
          resolve();
        });
      });
    }
  }
}

module.exports = MQTTBroker; 