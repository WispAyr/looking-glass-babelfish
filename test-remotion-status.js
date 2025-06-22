const RemotionConnector = require('./connectors/types/RemotionConnector');
const path = require('path');
const fs = require('fs');

async function testRemotionStatus() {
  console.log('🎬 Testing Remotion Status...\n');

  try {
    // Check if Remotion project exists
    const remotionProjectPath = path.join(__dirname, 'remotion-project');
    const packageJsonPath = path.join(remotionProjectPath, 'package.json');
    
    if (!fs.existsSync(remotionProjectPath)) {
      console.log('❌ Remotion project directory not found');
      return;
    }
    
    if (!fs.existsSync(packageJsonPath)) {
      console.log('❌ Remotion package.json not found');
      return;
    }
    
    console.log('✅ Remotion project directory exists');
    
    // Check package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log('✅ Package.json found:', packageJson.name);
    console.log('✅ Remotion version:', packageJson.dependencies.remotion);
    
    // Check FlightPathComponent
    const flightPathPath = path.join(remotionProjectPath, 'FlightPathComponent.jsx');
    if (fs.existsSync(flightPathPath)) {
      console.log('✅ FlightPathComponent.jsx exists');
    } else {
      console.log('❌ FlightPathComponent.jsx not found');
    }
    
    // Create Remotion Connector
    const remotion = new RemotionConnector({
      id: 'remotion-test',
      type: 'remotion',
      name: 'Test Remotion Connector',
      description: 'Test instance for Remotion video rendering',
      config: {
        outputDir: './renders',
        templatesDir: './templates',
        remotionProjectDir: './remotion-project',
        defaultFps: 30,
        defaultDuration: 10,
        quality: 'medium'
      }
    });

    console.log('✅ Remotion connector created');

    // Set up mock connector registry for testing
    const mockConnectorRegistry = {
      getConnectorsByType: (type) => {
        if (type === 'adsb') {
          return [{
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
      },
      getConnectors: () => []
    };
    
    remotion.setConnectorRegistry(mockConnectorRegistry);
    console.log('✅ Mock connector registry set up');

    // Test capability definitions
    const capabilities = RemotionConnector.getCapabilityDefinitions();
    console.log('✅ Capabilities:', capabilities.map(c => c.id));

    // Test metadata
    const metadata = RemotionConnector.getMetadata();
    console.log('✅ Metadata:', metadata.name, metadata.version);

    // Test template creation
    const template = await remotion.execute('template-management', 'create', {
      id: 'flight-path',
      name: 'Flight Path Template',
      description: 'Flight path visualization template',
      componentName: 'FlightPathComponent',
      componentPath: 'FlightPathComponent.jsx',
      width: 1920,
      height: 1080
    });

    console.log('✅ Template created:', template.id);

    // Create event timeline template
    const eventTimelineTemplate = await remotion.execute('template-management', 'create', {
      id: 'event-timeline',
      name: 'Event Timeline Template',
      description: 'Event timeline visualization template',
      componentName: 'EventTimelineComponent',
      componentPath: 'EventTimelineComponent.jsx',
      width: 1920,
      height: 1080
    });

    console.log('✅ Event timeline template created:', eventTimelineTemplate.id);

    // Test template listing
    const templates = await remotion.execute('template-management', 'list');
    console.log('✅ Templates found:', templates.length);

    // Test render stats
    const stats = remotion.getRenderStats();
    console.log('✅ Render stats:', {
      totalRenders: stats.totalRenders,
      activeRenders: stats.activeRenders,
      queuedRenders: stats.queuedRenders,
      templates: stats.templates
    });

    // Test video rendering capability (this will queue but not actually render)
    const renderResult = await remotion.execute('video-rendering', 'render', {
      templateId: 'flight-path',
      data: { 
        flightData: [
          { lat: 55.5074, lon: -4.5933 },
          { lat: 55.5075, lon: -4.5934 },
          { lat: 55.5076, lon: -4.5935 }
        ],
        callsign: 'TEST123',
        registration: 'G-TEST',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date().toISOString()
      },
      duration: 5,
      fps: 30
    });

    console.log('✅ Render job created:', renderResult.renderId);

    // Test flight visualization capability
    const flightResult = await remotion.execute('flight-visualization', 'create-flight-video', {
      callsign: 'TEST123',
      registration: 'G-TEST',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString()
    });

    console.log('✅ Flight video job created:', flightResult.renderId);

    // Test event timeline capability
    const timelineResult = await remotion.execute('event-timeline', 'create-event-timeline', {
      eventTypes: ['motion', 'smartDetectZone'],
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString()
    });

    console.log('✅ Event timeline job created:', timelineResult.renderId);

    console.log('\n🎉 Remotion is working properly!');
    console.log('\n📋 Summary:');
    console.log(`- Templates: ${templates.length}`);
    console.log(`- Active renders: ${stats.activeRenders}`);
    console.log(`- Total renders: ${stats.totalRenders}`);
    console.log(`- Capabilities: ${capabilities.length}`);

  } catch (error) {
    console.error('❌ Remotion test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testRemotionStatus(); 