const SystemVisualizerConnector = require('./connectors/types/SystemVisualizerConnector');
const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const BaseConnector = require('./connectors/BaseConnector');

// Create mock connector class for testing
class MockConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.stats = config.stats || {};
    this.mockType = config.mockType || config.type; // Store the original type for capability mapping
  }

  static getMetadata() {
    return {
      name: 'Mock Connector',
      version: '1.0.0',
      description: 'Mock connector for testing'
    };
  }

  static getCapabilityDefinitions() {
    return [];
  }

  getCapabilityDefinitions() {
    // Return capabilities based on the mock type
    const capabilityMap = {
      'adsb': [
        {
          id: 'adsb:aircraft',
          name: 'Aircraft Data',
          description: 'Real-time aircraft tracking data',
          category: 'aviation',
          operations: ['track', 'monitor', 'analyze'],
          dataTypes: ['aircraft'],
          events: ['aircraft:detected', 'aircraft:emergency', 'aircraft:military']
        },
        {
          id: 'squawk:analysis',
          name: 'Squawk Code Analysis',
          description: 'Squawk code analysis and categorization',
          category: 'aviation',
          operations: ['analyze', 'lookup', 'search'],
          dataTypes: ['squawk'],
          events: ['squawk:analyzed', 'emergency:squawk', 'military:squawk']
        }
      ],
      'radar': [
        {
          id: 'radar:tracking',
          name: 'Radar Tracking',
          description: 'Radar-based aircraft tracking',
          category: 'aviation',
          operations: ['track', 'monitor'],
          dataTypes: ['aircraft'],
          events: ['aircraft:tracked']
        }
      ],
      'map': [
        {
          id: 'map:visualization',
          name: 'Map Visualization',
          description: 'Spatial data visualization',
          category: 'visualization',
          operations: ['display', 'update', 'highlight'],
          dataTypes: ['spatial', 'event'],
          events: ['map:updated']
        }
      ],
      'unifi-protect': [
        {
          id: 'camera:video:stream',
          name: 'Video Stream',
          description: 'Camera video streaming',
          category: 'video',
          operations: ['stream', 'record', 'snapshot'],
          dataTypes: ['video'],
          events: ['video:started', 'video:stopped']
        },
        {
          id: 'camera:event:motion',
          name: 'Motion Detection',
          description: 'Motion detection events',
          category: 'security',
          operations: ['detect', 'alert'],
          dataTypes: ['event'],
          events: ['motion:detected', 'motion:ended']
        },
        {
          id: 'camera:event:smartdetect',
          name: 'Smart Detection',
          description: 'Smart detection events (person, vehicle, etc.)',
          category: 'security',
          operations: ['detect', 'classify', 'alert'],
          dataTypes: ['event'],
          events: ['smartdetect:person', 'smartdetect:vehicle']
        }
      ],
      'mqtt': [
        {
          id: 'mqtt:publish',
          name: 'Message Publishing',
          description: 'Publish messages to topics',
          category: 'messaging',
          operations: ['publish', 'broadcast'],
          dataTypes: ['message'],
          events: ['message:published']
        },
        {
          id: 'mqtt:subscribe',
          name: 'Message Subscription',
          description: 'Subscribe to message topics',
          category: 'messaging',
          operations: ['subscribe', 'receive'],
          dataTypes: ['message'],
          events: ['message:received']
        }
      ],
      'telegram': [
        {
          id: 'telegram:send',
          name: 'Send Messages',
          description: 'Send messages via Telegram',
          category: 'communication',
          operations: ['send', 'notify'],
          dataTypes: ['message'],
          events: ['message:sent']
        },
        {
          id: 'telegram:receive',
          name: 'Receive Messages',
          description: 'Receive messages via Telegram',
          category: 'communication',
          operations: ['receive', 'listen'],
          dataTypes: ['message'],
          events: ['message:received']
        }
      ],
      'overwatch': [
        {
          id: 'overwatch:events',
          name: 'Event Processing',
          description: 'Process and route system events',
          category: 'orchestration',
          operations: ['process', 'route', 'filter'],
          dataTypes: ['event'],
          events: ['event:processed', 'event:routed']
        }
      ],
      'speed-calculation': [
        {
          id: 'speed:calculation',
          name: 'Speed Calculation',
          description: 'Calculate vehicle speeds from camera data',
          category: 'analytics',
          operations: ['calculate', 'analyze', 'alert'],
          dataTypes: ['speed'],
          events: ['speed:calculated', 'speed:violation']
        }
      ],
      'web-gui': [
        {
          id: 'web-gui:pages',
          name: 'Web Pages',
          description: 'Web interface pages',
          category: 'ui',
          operations: ['display', 'navigate'],
          dataTypes: ['page'],
          events: ['page:loaded', 'page:changed']
        },
        {
          id: 'web-gui:components',
          name: 'Web Components',
          description: 'Web interface components',
          category: 'ui',
          operations: ['render', 'update'],
          dataTypes: ['component'],
          events: ['component:updated']
        }
      ]
    };

    return capabilityMap[this.mockType] || [];
  }

  async connect() {
    this.status = 'connected';
    return true;
  }

  async disconnect() {
    this.status = 'disconnected';
    return true;
  }
}

async function testSystemVisualizer() {
  console.log('🚀 Testing Enhanced System Visualizer with Real-time Data Flow');
  console.log('=' .repeat(60));

  // Create connector registry
  const connectorRegistry = new ConnectorRegistry();
  
  // Register mock connector type
  connectorRegistry.registerType('mock', MockConnector);
  
  // Create mock connectors with realistic stats
  const mockConnectors = [
    {
      id: 'adsb-main',
      type: 'mock',
      mockType: 'adsb',
      name: 'ADSB Receiver',
      status: 'connected',
      stats: {
        messagesReceived: 1250,
        messagesSent: 980,
        errors: 2,
        emergencyEvents: 3,
        militaryEvents: 12
      }
    },
    {
      id: 'radar-main',
      type: 'mock',
      mockType: 'radar',
      name: 'Radar System',
      status: 'connected',
      stats: {
        messagesReceived: 890,
        messagesSent: 750,
        errors: 1
      }
    },
    {
      id: 'map-main',
      type: 'mock',
      mockType: 'map',
      name: 'Map Visualization',
      status: 'connected',
      stats: {
        messagesReceived: 2100,
        messagesSent: 0,
        errors: 0
      }
    },
    {
      id: 'unifi-protect-main',
      type: 'mock',
      mockType: 'unifi-protect',
      name: 'Security Cameras',
      status: 'connected',
      stats: {
        messagesReceived: 3400,
        messagesSent: 2800,
        errors: 5,
        motionEvents: 45,
        smartDetectEvents: 23
      }
    },
    {
      id: 'mqtt-main',
      type: 'mock',
      mockType: 'mqtt',
      name: 'MQTT Broker',
      status: 'connected',
      stats: {
        messagesReceived: 5600,
        messagesSent: 5200,
        errors: 3
      }
    },
    {
      id: 'telegram-main',
      type: 'mock',
      mockType: 'telegram',
      name: 'Telegram Bot',
      status: 'connected',
      stats: {
        messagesReceived: 45,
        messagesSent: 120,
        errors: 0
      }
    },
    {
      id: 'overwatch-main',
      type: 'mock',
      mockType: 'overwatch',
      name: 'System Monitor',
      status: 'connected',
      stats: {
        messagesReceived: 8900,
        messagesSent: 0,
        errors: 1
      }
    },
    {
      id: 'speed-calculation-main',
      type: 'mock',
      mockType: 'speed-calculation',
      name: 'Speed Detection',
      status: 'connected',
      stats: {
        messagesReceived: 1800,
        messagesSent: 1500,
        errors: 2
      }
    },
    {
      id: 'web-gui-main',
      type: 'mock',
      mockType: 'web-gui',
      name: 'Web Interface',
      status: 'connected',
      stats: {
        messagesReceived: 3200,
        messagesSent: 2800,
        errors: 0
      }
    }
  ];

  // Create and register mock connectors
  for (const connectorConfig of mockConnectors) {
    const connector = await connectorRegistry.createConnector(connectorConfig);
    await connector.connect();
  }

  // Create system visualizer
  const visualizer = new SystemVisualizerConnector({
    port: 3001,
    updateInterval: 1000,
    enableWebSocket: true,
    enableDataFlow: true,
    enableMetrics: true,
    theme: 'dark',
    layout: 'force-directed'
  });

  // Set up visualizer
  visualizer.setConnectorRegistry(connectorRegistry);
  
  try {
    await visualizer.connect();
    console.log('✅ System Visualizer initialized successfully');
    console.log(`🌐 Web interface available at: http://localhost:${visualizer.config.port}`);
    console.log('📊 Real-time data flow visualization enabled');
    console.log('🎨 Multiple layout options available (Force Directed, Circular, Hierarchical, Grid)');
    
    // Test different capabilities
    console.log('\n🔍 Testing Visualization Capabilities:');
    
    const systemData = await visualizer.execute('visualization:system', 'get', {});
    console.log('✅ System data retrieval:', systemData.success ? 'SUCCESS' : 'FAILED');
    
    const connectorData = await visualizer.execute('visualization:connectors', 'list', {});
    console.log('✅ Connector listing:', connectorData.success ? 'SUCCESS' : 'FAILED');
    
    const dataFlow = await visualizer.execute('visualization:dataflow', 'track', {});
    console.log('✅ Data flow tracking:', dataFlow.success ? 'SUCCESS' : 'FAILED');
    
    const metrics = await visualizer.execute('visualization:metrics', 'collect', {});
    console.log('✅ Metrics collection:', metrics.success ? 'SUCCESS' : 'FAILED');

    // Simulate real-time activity
    console.log('\n🔄 Simulating Real-time Activity:');
    
    let activityCounter = 0;
    const activityInterval = setInterval(() => {
      activityCounter++;
      
      // Update connector stats to simulate activity
      const connectors = connectorRegistry.getConnectors();
      connectors.forEach(connector => {
        if (connector.stats) {
          connector.stats.messagesReceived += Math.floor(Math.random() * 10);
          connector.stats.messagesSent += Math.floor(Math.random() * 8);
          
          // Simulate occasional errors
          if (Math.random() < 0.1) {
            connector.stats.errors += 1;
          }
          
          // Simulate emergency events for ADSB
          if (connector.name === 'ADSB Receiver' && Math.random() < 0.05) {
            connector.stats.emergencyEvents += 1;
          }
          
          // Simulate military events for ADSB
          if (connector.name === 'ADSB Receiver' && Math.random() < 0.1) {
            connector.stats.militaryEvents += 1;
          }
        }
      });
      
      console.log(`📈 Activity update ${activityCounter}: Updated connector statistics`);
      
      if (activityCounter >= 10) {
        clearInterval(activityInterval);
        console.log('\n✅ Real-time activity simulation completed');
        console.log('\n🎯 Visualizer Features Demonstrated:');
        console.log('   • Multiple layout algorithms (Force Directed, Circular, Hierarchical, Grid)');
        console.log('   • Real-time data flow visualization with animated particles');
        console.log('   • Interactive node selection and highlighting');
        console.log('   • Enhanced relationship analysis with strength indicators');
        console.log('   • Live metrics and system health monitoring');
        console.log('   • WebSocket-based real-time updates');
        console.log('   • Tooltip information on hover');
        console.log('   • Data flow categorization (Emergency, Military, Data, Events)');
        console.log('\n🌐 Open http://localhost:3001 to see the enhanced visualization!');
      }
    }, 2000);

  } catch (error) {
    console.error('❌ Error testing system visualizer:', error);
  }
}

// Run the test
testSystemVisualizer(); 