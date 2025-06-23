const BaseConnector = require('../BaseConnector');
const express = require('express');
const path = require('path');

class SystemVisualizerConnector extends BaseConnector {
  constructor(config = {}) {
    super({
      id: config.id || 'system-visualizer-main',
      type: 'system-visualizer',
      name: config.name || 'System Architecture Visualizer',
      description: config.description || 'Real-time visualization of system connectors and data flow',
      config: {
        port: config.port || 3001,
        updateInterval: config.updateInterval || 1000,
        enableWebSocket: config.enableWebSocket !== false,
        enableDataFlow: config.enableDataFlow !== false,
        enableMetrics: config.enableMetrics !== false,
        theme: config.theme || 'dark',
        layout: config.layout || 'force-directed',
        ...config
      }
    });

    this.app = null;
    this.server = null;
    this.websocket = null;
    this.connectorRegistry = null;
    this.eventBus = null;
    this.updateTimer = null;
    this.systemData = {
      connectors: [],
      relationships: [],
      dataFlow: [],
      metrics: {},
      lastUpdate: null
    };
  }

  static getCapabilityDefinitions() {
    return [
      {
        id: 'visualization:system',
        description: 'System architecture visualization capabilities',
        operations: ['get', 'update', 'subscribe']
      },
      {
        id: 'visualization:connectors',
        description: 'Connector relationship visualization',
        operations: ['list', 'analyze', 'monitor']
      },
      {
        id: 'visualization:dataflow',
        description: 'Real-time data flow visualization',
        operations: ['track', 'analyze', 'alert']
      },
      {
        id: 'visualization:metrics',
        description: 'System metrics visualization',
        operations: ['collect', 'display', 'export']
      }
    ];
  }

  async performConnect() {
    try {
      await this.initializeWebServer();
      await this.initializeWebSocket();
      await this.startDataCollection();
      
      this.status = 'connected';
      this.lastConnected = new Date();
      
      this.logger.info('System Visualizer connected successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect System Visualizer:', error);
      this.lastError = error.message;
      return false;
    }
  }

  async performDisconnect() {
    try {
      if (this.updateTimer) {
        clearInterval(this.updateTimer);
        this.updateTimer = null;
      }

      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      if (this.server) {
        this.server.close();
        this.server = null;
      }

      this.status = 'disconnected';
      this.logger.info('System Visualizer disconnected');
      return true;
    } catch (error) {
      this.logger.error('Error disconnecting System Visualizer:', error);
      return false;
    }
  }

  async initializeWebServer() {
    this.app = express();
    
    // Serve static files
    this.app.use(express.static(path.join(__dirname, '../../public/system-visualizer')));
    
    // API endpoints
    this.app.get('/api/system-data', (req, res) => {
      res.json({
        success: true,
        data: this.systemData
      });
    });

    this.app.get('/api/connectors', (req, res) => {
      const connectors = this.connectorRegistry ? this.connectorRegistry.getConnectors() : [];
      res.json({
        success: true,
        data: connectors.map(c => ({
          id: c.id,
          type: c.type,
          name: c.name,
          status: c.status,
          lastConnected: c.lastConnected,
          lastError: c.lastError
        }))
      });
    });

    this.app.get('/api/relationships', (req, res) => {
      res.json({
        success: true,
        data: this.analyzeConnectorRelationships()
      });
    });

    this.app.get('/api/metrics', (req, res) => {
      res.json({
        success: true,
        data: this.collectSystemMetrics()
      });
    });

    // Main visualization page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../public/system-visualizer/index.html'));
    });

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port, () => {
        this.logger.info(`System Visualizer running on http://localhost:${this.config.port}`);
        resolve();
      });
      
      this.server.on('error', reject);
    });
  }

  async initializeWebSocket() {
    if (!this.config.enableWebSocket) return;

    const WebSocket = require('ws');
    this.websocket = new WebSocket.Server({ server: this.server });

    this.websocket.on('connection', (ws) => {
      this.logger.info('Client connected to System Visualizer WebSocket');
      
      // Send initial data
      ws.send(JSON.stringify({
        type: 'system-data',
        data: this.systemData
      }));

      ws.on('close', () => {
        this.logger.info('Client disconnected from System Visualizer WebSocket');
      });
    });
  }

  async startDataCollection() {
    this.updateTimer = setInterval(() => {
      this.updateSystemData();
    }, this.config.updateInterval);
  }

  updateSystemData() {
    if (!this.connectorRegistry) return;

    const connectors = this.connectorRegistry.getConnectors();
    
    // Update connector data
    this.systemData.connectors = connectors.map(connector => ({
      id: connector.id,
      type: connector.type,
      name: connector.name,
      status: connector.status || 'unknown',
      lastConnected: connector.lastConnected,
      lastError: connector.lastError,
      capabilities: connector.getCapabilities ? connector.getCapabilities() : [],
      stats: connector.stats || {}
    }));

    // Update relationships
    this.systemData.relationships = this.analyzeConnectorRelationships();

    // Update data flow
    if (this.config.enableDataFlow) {
      this.systemData.dataFlow = this.trackDataFlow();
    }

    // Update metrics
    if (this.config.enableMetrics) {
      this.systemData.metrics = this.collectSystemMetrics();
    }

    this.systemData.lastUpdate = new Date();

    // Broadcast to WebSocket clients
    if (this.websocket) {
      this.websocket.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(JSON.stringify({
            type: 'system-data',
            data: this.systemData
          }));
        }
      });
    }
  }

  analyzeConnectorRelationships() {
    const relationships = [];
    const connectors = this.connectorRegistry.getConnectors();

    // Build relationships based on actual connector capabilities
    connectors.forEach(sourceConnector => {
      const sourceCapabilities = sourceConnector.getCapabilityDefinitions ? sourceConnector.getCapabilityDefinitions() : [];
      
      connectors.forEach(targetConnector => {
        if (sourceConnector.id === targetConnector.id) return; // Skip self
        
        const targetCapabilities = targetConnector.getCapabilityDefinitions ? targetConnector.getCapabilityDefinitions() : [];
        
        // Find capability matches between connectors
        const matches = this.findCapabilityMatches(sourceCapabilities, targetCapabilities);
        
        if (matches.length > 0) {
          relationships.push({
            from: sourceConnector.id,
            to: targetConnector.id,
            type: 'capability-match',
            description: `Capability match: ${matches.map(m => m.description).join(', ')}`,
            strength: 'strong',
            capabilities: matches
          });
        }
      });
    });

    return relationships;
  }

  findCapabilityMatches(sourceCapabilities, targetCapabilities) {
    const matches = [];
    
    // Define capability flow patterns
    const flowPatterns = {
      // Data producers to consumers
      'adsb:aircraft': ['map:visualization', 'radar:tracking', 'overwatch:events'],
      'camera:video:stream': ['map:visualization', 'speed:calculation', 'overwatch:events'],
      'camera:event:motion': ['map:visualization', 'telegram:send', 'overwatch:events'],
      'camera:event:smartdetect': ['map:visualization', 'telegram:send', 'overwatch:events'],
      
      // Event producers to consumers
      'overwatch:events': ['telegram:send', 'web-gui:pages', 'map:visualization'],
      'mqtt:publish': ['overwatch:events', 'web-gui:components'],
      'mqtt:subscribe': ['overwatch:events', 'web-gui:components'],
      
      // Notification flows
      'telegram:send': ['web-gui:components'],
      'telegram:receive': ['overwatch:events'],
      
      // Visualization flows
      'map:visualization': ['web-gui:pages'],
      'web-gui:pages': ['web-gui:components'],
      
      // Analysis flows
      'speed:calculation': ['map:visualization', 'telegram:send', 'overwatch:events'],
      'squawk:analysis': ['map:visualization', 'telegram:send', 'overwatch:events']
    };

    sourceCapabilities.forEach(sourceCap => {
      const targetPatterns = flowPatterns[sourceCap.id] || [];
      
      targetCapabilities.forEach(targetCap => {
        if (targetPatterns.includes(targetCap.id)) {
          matches.push({
            source: sourceCap.id,
            target: targetCap.id,
            description: `${sourceCap.name} → ${targetCap.name}`,
            type: this.getFlowType(sourceCap.id, targetCap.id)
          });
        }
      });
    });

    return matches;
  }

  getFlowType(sourceCapability, targetCapability) {
    // Determine flow type based on capability patterns
    if (sourceCapability.includes('emergency') || targetCapability.includes('emergency')) {
      return 'emergency';
    }
    if (sourceCapability.includes('military') || targetCapability.includes('military')) {
      return 'military';
    }
    if (sourceCapability.includes('event') || targetCapability.includes('event')) {
      return 'event';
    }
    return 'data';
  }

  trackDataFlow() {
    const dataFlow = [];
    const now = new Date();
    const connectors = this.connectorRegistry.getConnectors();

    // Track actual capability-based data flow
    connectors.forEach(connector => {
      if (!connector.stats || !connector.getCapabilityDefinitions) return;

      const capabilities = connector.getCapabilityDefinitions();
      const messagesSent = connector.stats.messagesSent || 0;
      const messagesReceived = connector.stats.messagesReceived || 0;

      // Find connectors that can consume this connector's capabilities
      const consumers = this.findCapabilityConsumers(connector, connectors);
      
      if (messagesSent > 0 && consumers.length > 0) {
        const messagesPerConsumer = Math.floor(messagesSent / consumers.length);
        
        consumers.forEach(consumer => {
          const flowType = this.determineCapabilityFlowType(connector, consumer);
          
          dataFlow.push({
            timestamp: now,
            source: connector.id,
            target: consumer.id,
            type: flowType,
            volume: messagesPerConsumer,
            description: `${connector.name} → ${consumer.name}`,
            capability: this.getCapabilityDescription(connector, consumer)
          });
        });
      }

      // Track special events based on connector type and capabilities
      this.trackSpecialEvents(connector, dataFlow, now);
    });

    return dataFlow.slice(-100);
  }

  findCapabilityConsumers(producer, allConnectors) {
    const consumers = [];
    const producerCapabilities = producer.getCapabilityDefinitions();
    
    allConnectors.forEach(consumer => {
      if (consumer.id === producer.id) return;
      
      const consumerCapabilities = consumer.getCapabilityDefinitions ? consumer.getCapabilityDefinitions() : [];
      const matches = this.findCapabilityMatches(producerCapabilities, consumerCapabilities);
      
      if (matches.length > 0) {
        consumers.push(consumer);
      }
    });
    
    return consumers;
  }

  determineCapabilityFlowType(producer, consumer) {
    const producerCapabilities = producer.getCapabilityDefinitions();
    const consumerCapabilities = consumer.getCapabilityDefinitions ? consumer.getCapabilityDefinitions() : [];
    
    // Check for emergency flows
    if (producerCapabilities.some(cap => cap.id.includes('emergency')) ||
        consumerCapabilities.some(cap => cap.id.includes('emergency'))) {
      return 'emergency';
    }
    
    // Check for military flows
    if (producerCapabilities.some(cap => cap.id.includes('military')) ||
        consumerCapabilities.some(cap => cap.id.includes('military'))) {
      return 'military';
    }
    
    // Check for event flows
    if (producerCapabilities.some(cap => cap.id.includes('event')) ||
        consumerCapabilities.some(cap => cap.id.includes('event'))) {
      return 'event';
    }
    
    return 'data';
  }

  getCapabilityDescription(producer, consumer) {
    const producerCapabilities = producer.getCapabilityDefinitions();
    const consumerCapabilities = consumer.getCapabilityDefinitions ? consumer.getCapabilityDefinitions() : [];
    
    const matches = this.findCapabilityMatches(producerCapabilities, consumerCapabilities);
    if (matches.length > 0) {
      return matches[0].description;
    }
    
    return `${producer.type} → ${consumer.type}`;
  }

  trackSpecialEvents(connector, dataFlow, timestamp) {
    // Track emergency events from ADSB
    if (connector.type === 'adsb' && connector.stats.emergencyEvents > 0) {
      const mapConnector = this.systemData.connectors.find(c => c.type === 'map');
      if (mapConnector) {
        dataFlow.push({
          timestamp,
          source: connector.id,
          target: mapConnector.id,
          type: 'emergency',
          volume: connector.stats.emergencyEvents,
          description: 'Emergency aircraft data',
          capability: 'adsb:aircraft → map:visualization'
        });
      }
    }

    // Track military events from ADSB
    if (connector.type === 'adsb' && connector.stats.militaryEvents > 0) {
      const mapConnector = this.systemData.connectors.find(c => c.type === 'map');
      if (mapConnector) {
        dataFlow.push({
          timestamp,
          source: connector.id,
          target: mapConnector.id,
          type: 'military',
          volume: connector.stats.militaryEvents,
          description: 'Military aircraft data',
          capability: 'adsb:aircraft → map:visualization'
        });
      }
    }

    // Track motion events from cameras
    if (connector.type === 'unifi-protect' && connector.stats.motionEvents > 0) {
      const mapConnector = this.systemData.connectors.find(c => c.type === 'map');
      if (mapConnector) {
        dataFlow.push({
          timestamp,
          source: connector.id,
          target: mapConnector.id,
          type: 'event',
          volume: connector.stats.motionEvents,
          description: 'Motion detection events',
          capability: 'camera:event:motion → map:visualization'
        });
      }
    }
  }

  collectSystemMetrics() {
    const metrics = {
      totalConnectors: this.systemData.connectors.length,
      connectedConnectors: this.systemData.connectors.filter(c => c.status === 'connected').length,
      disconnectedConnectors: this.systemData.connectors.filter(c => c.status === 'disconnected').length,
      errorConnectors: this.systemData.connectors.filter(c => c.lastError).length,
      totalMessages: 0,
      totalErrors: 0,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };

    // Aggregate connector stats
    this.systemData.connectors.forEach(connector => {
      if (connector.stats) {
        metrics.totalMessages += connector.stats.messagesReceived || 0;
        metrics.totalMessages += connector.stats.messagesSent || 0;
        metrics.totalErrors += connector.stats.errors || 0;
      }
    });

    return metrics;
  }

  setConnectorRegistry(registry) {
    this.connectorRegistry = registry;
  }

  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  async execute(capability, operation, params = {}) {
    switch (capability) {
      case 'visualization:system':
        return this.handleSystemVisualization(operation, params);
      case 'visualization:connectors':
        return this.handleConnectorVisualization(operation, params);
      case 'visualization:dataflow':
        return this.handleDataFlowVisualization(operation, params);
      case 'visualization:metrics':
        return this.handleMetricsVisualization(operation, params);
      default:
        throw new Error(`Unknown capability: ${capability}`);
    }
  }

  handleSystemVisualization(operation, params) {
    switch (operation) {
      case 'get':
        return { success: true, data: this.systemData };
      case 'update':
        this.updateSystemData();
        return { success: true, message: 'System data updated' };
      case 'subscribe':
        return { success: true, url: `ws://localhost:${this.config.port}` };
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  handleConnectorVisualization(operation, params) {
    switch (operation) {
      case 'list':
        return { success: true, data: this.systemData.connectors };
      case 'analyze':
        return { success: true, data: this.analyzeConnectorRelationships() };
      case 'monitor':
        return { success: true, data: this.collectSystemMetrics() };
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  handleDataFlowVisualization(operation, params) {
    switch (operation) {
      case 'track':
        return { success: true, data: this.trackDataFlow() };
      case 'analyze':
        return { success: true, data: this.analyzeDataFlowPatterns() };
      case 'alert':
        return { success: true, data: this.getDataFlowAlerts() };
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  handleMetricsVisualization(operation, params) {
    switch (operation) {
      case 'collect':
        return { success: true, data: this.collectSystemMetrics() };
      case 'display':
        return { success: true, data: this.formatMetricsForDisplay() };
      case 'export':
        return { success: true, data: this.exportMetrics(params.format) };
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  analyzeDataFlowPatterns() {
    // Analyze data flow patterns for insights
    const patterns = {
      highTrafficConnectors: [],
      errorProneConnectors: [],
      dataBottlenecks: [],
      recommendations: []
    };

    this.systemData.connectors.forEach(connector => {
      if (connector.stats && connector.stats.messagesReceived > 1000) {
        patterns.highTrafficConnectors.push(connector.id);
      }
      if (connector.stats && connector.stats.errors > 10) {
        patterns.errorProneConnectors.push(connector.id);
      }
    });

    return patterns;
  }

  getDataFlowAlerts() {
    const alerts = [];

    this.systemData.connectors.forEach(connector => {
      if (connector.status === 'disconnected') {
        alerts.push({
          level: 'warning',
          connector: connector.id,
          message: `Connector ${connector.name} is disconnected`
        });
      }
      if (connector.lastError) {
        alerts.push({
          level: 'error',
          connector: connector.id,
          message: `Connector ${connector.name} has error: ${connector.lastError}`
        });
      }
    });

    return alerts;
  }

  formatMetricsForDisplay() {
    return {
      summary: {
        totalConnectors: this.systemData.connectors.length,
        connected: this.systemData.connectors.filter(c => c.status === 'connected').length,
        health: this.calculateSystemHealth()
      },
      details: this.collectSystemMetrics()
    };
  }

  calculateSystemHealth() {
    const total = this.systemData.connectors.length;
    const connected = this.systemData.connectors.filter(c => c.status === 'connected').length;
    return total > 0 ? (connected / total) * 100 : 100;
  }

  exportMetrics(format = 'json') {
    const data = this.collectSystemMetrics();
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  convertToCSV(data) {
    // Simple CSV conversion for metrics
    const lines = ['Metric,Value'];
    Object.entries(data).forEach(([key, value]) => {
      lines.push(`${key},${value}`);
    });
    return lines.join('\n');
  }
}

module.exports = SystemVisualizerConnector;
