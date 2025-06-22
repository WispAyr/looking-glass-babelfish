const RemotionConnector = require('./connectors/types/RemotionConnector');

async function testRemotionConnector() {
  console.log('🧪 Testing RemotionConnector...\n');

  try {
    // Create Remotion Connector
    const remotion = new RemotionConnector({
      id: 'remotion-test',
      type: 'remotion',
      name: 'Test Remotion Connector',
      description: 'Test instance for Remotion video rendering',
      config: {
        outputDir: './test-renders',
        templatesDir: './test-templates',
        remotionProjectDir: './test-remotion-project',
        defaultFps: 30,
        defaultDuration: 10,
        quality: 'medium'
      }
    });

    console.log('✅ Remotion connector created');

    // Test capability definitions
    const capabilities = RemotionConnector.getCapabilityDefinitions();
    console.log('✅ Capabilities:', capabilities.map(c => c.id));

    // Test metadata
    const metadata = RemotionConnector.getMetadata();
    console.log('✅ Metadata:', metadata.name, metadata.version);

    // Test template creation
    const template = await remotion.execute('template-management', 'create', {
      id: 'test-template',
      name: 'Test Template',
      description: 'A test video template',
      componentName: 'TestComponent',
      componentPath: 'TestComponent.jsx',
      width: 1920,
      height: 1080
    });

    console.log('✅ Template created:', template.id);

    // Test template listing
    const templates = await remotion.execute('template-management', 'list');
    console.log('✅ Templates found:', templates.length);

    // Test render stats
    const stats = remotion.getRenderStats();
    console.log('✅ Render stats:', stats);

    // Test video rendering (this will queue but not actually render without Remotion)
    const renderResult = await remotion.execute('video-rendering', 'render', {
      templateId: 'test-template',
      data: { test: 'data' },
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

    console.log('\n🎉 All RemotionConnector tests passed!');
    console.log('\n📋 Summary:');
    console.log(`- Templates: ${templates.length}`);
    console.log(`- Active renders: ${stats.activeRenders}`);
    console.log(`- Total renders: ${stats.totalRenders}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testRemotionConnector(); 