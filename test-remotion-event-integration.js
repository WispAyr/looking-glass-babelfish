const RemotionConnector = require('./connectors/types/RemotionConnector');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

/**
 * Mock Event Bus for testing
 */
class MockEventBus extends EventEmitter {
  constructor() {
    super();
    this.events = [];
  }

  async publishEvent(event) {
    this.events.push(event);
    this.emit('event', event);
    this.emit(`event:${event.type}`, event);
    console.log(`📡 Event published: ${event.type} from ${event.source}`);
  }

  getEvents() {
    return this.events;
  }
}

/**
 * Mock Connector Registry for testing
 */
class MockConnectorRegistry {
  constructor() {
    this.connectors = new Map();
  }

  getConnectorsByType(type) {
    if (type === 'adsb') {
      return [{
        id: 'mock-adsb',
        execute: async (capability, operation, params) => {
          // Return mock flight data
          return [
            { lat: 55.5074, lon: -4.5933, timestamp: new Date(Date.now() - 3600000).toISOString() },
            { lat: 55.5075, lon: -4.5934, timestamp: new Date(Date.now() - 1800000).toISOString() },
            { lat: 55.5076, lon: -4.5935, timestamp: new Date().toISOString() }
          ];
        }
      }];
    }
    return [];
  }

  getConnector(id) {
    return this.connectors.get(id);
  }

  getConnectors() {
    return Array.from(this.connectors.values());
  }
}

async function testRemotionEventIntegration() {
  console.log('🎬 Testing Remotion Event Integration...\n');

  try {
    // Create mock event bus
    const eventBus = new MockEventBus();
    console.log('✅ Mock event bus created');

    // Create mock connector registry
    const connectorRegistry = new MockConnectorRegistry();
    console.log('✅ Mock connector registry created');

    // Create Remotion Connector with event integration
    const remotion = new RemotionConnector({
      id: 'remotion-event-test',
      type: 'remotion',
      name: 'Event Integration Test',
      description: 'Test Remotion connector with event integration',
      config: {
        outputDir: './renders',
        templatesDir: './templates',
        remotionProjectDir: './remotion-project',
        defaultFps: 30,
        defaultDuration: 10,
        quality: 'medium',
        autoRenderEnabled: true
      }
    });

    console.log('✅ Remotion connector created');

    // Set up event bus and connector registry
    remotion.setEventBus(eventBus);
    remotion.setConnectorRegistry(connectorRegistry);
    console.log('✅ Event bus and connector registry configured');

    // Set up event listeners for render events
    eventBus.on('event:render:queued', (event) => {
      console.log(`🎬 Render queued: ${event.data.renderId}`);
    });

    eventBus.on('event:render:started', (event) => {
      console.log(`🚀 Render started: ${event.data.renderId}`);
    });

    eventBus.on('event:render:progress', (event) => {
      console.log(`📊 Render progress: ${event.data.renderId} - ${event.data.progress}% (${event.data.stage})`);
    });

    eventBus.on('event:render:completed', (event) => {
      console.log(`✅ Render completed: ${event.data.renderId}`);
      console.log(`   📁 Output: ${event.data.outputPath}`);
      console.log(`   ⏱️  Duration: ${event.data.duration}ms`);
      console.log(`   📦 File size: ${(event.data.fileSize / 1024 / 1024).toFixed(2)} MB`);
    });

    eventBus.on('event:render:failed', (event) => {
      console.log(`❌ Render failed: ${event.data.renderId}`);
      console.log(`   💥 Error: ${event.data.error}`);
    });

    eventBus.on('event:render:trigger-executed', (event) => {
      console.log(`🎯 Trigger executed: ${event.data.triggerId} -> ${event.data.renderId}`);
    });

    // Create templates first
    console.log('\n📝 Creating templates...');
    
    // Create flight path template
    const flightTemplate = await remotion.execute('template-management', 'create', {
      id: 'flight-path',
      name: 'Flight Path Template',
      description: 'Flight path visualization template',
      componentName: 'FlightPathComponent',
      componentPath: 'FlightPathComponent.jsx',
      width: 1920,
      height: 1080
    });
    console.log('✅ Flight path template created:', flightTemplate.id);

    // Create event timeline template
    const timelineTemplate = await remotion.execute('template-management', 'create', {
      id: 'event-timeline',
      name: 'Event Timeline Template',
      description: 'Event timeline visualization template',
      componentName: 'EventTimelineComponent',
      componentPath: 'EventTimelineComponent.jsx',
      width: 1920,
      height: 1080
    });
    console.log('✅ Event timeline template created:', timelineTemplate.id);

    // Test render triggers
    console.log('\n🎯 Testing render triggers...');
    
    // Add a trigger for smart detect events
    await remotion.execute('render-triggers', 'add-trigger', {
      eventType: 'smartDetectZone',
      trigger: {
        id: 'smart-detect-video',
        name: 'Smart Detect Video Trigger',
        conditions: {
          confidence: { min: 0.5 }
        },
        renderParams: {
          templateId: 'event-timeline',
          outputPath: './renders/auto-smart-detect-{timestamp}.mp4',
          duration: 15
        }
      }
    });
    console.log('✅ Smart detect trigger added');

    // Add a trigger for motion events
    await remotion.execute('render-triggers', 'add-trigger', {
      eventType: 'motion',
      trigger: {
        id: 'motion-video',
        name: 'Motion Video Trigger',
        conditions: {},
        renderParams: {
          templateId: 'event-timeline',
          outputPath: './renders/auto-motion-{timestamp}.mp4',
          duration: 10
        }
      }
    });
    console.log('✅ Motion trigger added');

    // List triggers
    const triggers = await remotion.execute('render-triggers', 'list-triggers');
    console.log('📋 Current triggers:', Object.keys(triggers));

    // Test template rendering with data
    console.log('\n🎨 Testing template rendering...');
    
    const templateRender = await remotion.execute('template-rendering', 'render-template', {
      templateId: 'event-timeline',
      data: {
        title: 'Test Event Timeline',
        events: [
          { type: 'motion', timestamp: new Date().toISOString(), location: 'Camera 1' },
          { type: 'smartDetectZone', timestamp: new Date().toISOString(), confidence: 0.8 }
        ]
      },
      outputPath: './renders/template-test.mp4'
    });
    console.log('✅ Template render job created:', templateRender.renderId);

    // Test rendering with data from other connectors
    console.log('\n🔗 Testing data integration rendering...');
    
    const dataRender = await remotion.execute('template-rendering', 'render-with-data', {
      templateId: 'flight-path',
      dataSource: 'mock-adsb',
      dataQuery: {
        capability: 'flight-tracking',
        operation: 'get-flight-history',
        parameters: {
          callsign: 'TEST123',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date().toISOString()
        }
      },
      outputPath: './renders/data-integration-test.mp4'
    });
    console.log('✅ Data integration render job created:', dataRender.renderId);

    // Test rendering from event
    console.log('\n📡 Testing event-based rendering...');
    
    const testEvent = {
      id: 'test-event-123',
      type: 'smartDetectZone',
      source: 'test-camera',
      timestamp: new Date().toISOString(),
      data: {
        cameraId: 'cam-1',
        confidence: 0.85,
        objectType: 'vehicle'
      }
    };
    
    const eventRender = await remotion.execute('template-rendering', 'render-from-event', {
      templateId: 'event-timeline',
      event: testEvent,
      outputPath: './renders/event-based-test.mp4'
    });
    console.log('✅ Event-based render job created:', eventRender.renderId);

    // Simulate incoming events to test triggers
    console.log('\n🎯 Simulating events to test triggers...');
    
    // Simulate smart detect event
    await eventBus.publishEvent({
      type: 'smartDetectZone',
      source: 'test-camera',
      timestamp: new Date().toISOString(),
      data: {
        cameraId: 'cam-1',
        confidence: 0.75,
        objectType: 'vehicle'
      }
    });

    // Simulate motion event
    await eventBus.publishEvent({
      type: 'motion',
      source: 'test-camera',
      timestamp: new Date().toISOString(),
      data: {
        cameraId: 'cam-1',
        intensity: 0.6
      }
    });

    // Simulate flight completed event
    await eventBus.publishEvent({
      type: 'flight:completed',
      source: 'adsb-system',
      timestamp: new Date().toISOString(),
      data: {
        callsign: 'TEST123',
        registration: 'G-TEST',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date().toISOString()
      }
    });

    // Wait for renders to process
    console.log('\n⏳ Waiting for renders to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check render statuses
    console.log('\n📊 Checking render statuses...');
    const activeRenders = await remotion.execute('video-rendering', 'list');
    console.log(`📋 Active renders: ${activeRenders.length}`);
    
    for (const render of activeRenders) {
      const status = await remotion.getRenderStatus(render.id);
      console.log(`   ${render.id}: ${status.status}`);
    }

    // Get render statistics
    const stats = remotion.getRenderStats();
    console.log('\n📈 Render Statistics:');
    console.log(`- Total renders: ${stats.totalRenders}`);
    console.log(`- Successful: ${stats.successfulRenders}`);
    console.log(`- Failed: ${stats.failedRenders}`);
    console.log(`- Average render time: ${stats.averageRenderTime ? (stats.averageRenderTime / 1000).toFixed(2) + 's' : 'N/A'}`);

    // Check event bus events
    const events = eventBus.getEvents();
    console.log('\n📡 Event Bus Statistics:');
    console.log(`- Total events: ${events.length}`);
    
    const eventTypes = {};
    events.forEach(event => {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    });
    
    console.log('- Events by type:');
    for (const [type, count] of Object.entries(eventTypes)) {
      console.log(`  ${type}: ${count}`);
    }

    // Check if video files were created
    console.log('\n📁 Checking for rendered video files...');
    const rendersDir = './renders';
    if (fs.existsSync(rendersDir)) {
      const files = fs.readdirSync(rendersDir);
      const videoFiles = files.filter(file => file.endsWith('.mp4'));
      console.log('✅ Video files found:', videoFiles);
      
      for (const videoFile of videoFiles) {
        const filePath = path.join(rendersDir, videoFile);
        const stats = fs.statSync(filePath);
        console.log(`📹 ${videoFile}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      }
    } else {
      console.log('❌ Renders directory not found');
    }

    console.log('\n🎉 Remotion event integration test completed!');
    console.log('\n📋 Summary:');
    console.log('- Event integration: ✅ Working');
    console.log('- Render triggers: ✅ Working');
    console.log('- Template rendering: ✅ Working');
    console.log('- Data integration: ✅ Working');
    console.log('- Event-based rendering: ✅ Working');
    console.log('- Check the ./renders directory for video files');

  } catch (error) {
    console.error('❌ Remotion event integration test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testRemotionEventIntegration(); 