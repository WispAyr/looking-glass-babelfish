const FlowBuilder = require('./services/flowBuilder');
const EventBus = require('./services/eventBus');

async function testFlowSystem() {
  console.log('🧪 Testing Flow System...\n');

  // Initialize Flow Builder
  const flowBuilder = new FlowBuilder({
    flowsDir: './config/flows',
    autoSave: true,
    maxFlows: 100
  });

  await flowBuilder.initialize();

  // Initialize Event Bus
  const eventBus = new EventBus({
    maxEvents: 1000,
    retentionPeriod: 24 * 60 * 60 * 1000 // 24 hours
  });

  // Connect them
  eventBus.flowBuilder = flowBuilder;
  global.flowBuilder = flowBuilder;
  global.eventBus = eventBus;

  console.log('✅ Flow Builder and Event Bus initialized\n');

  // Test creating a flow from template
  try {
    const flow = await flowBuilder.createFromTemplate('loitering-telegram', {
      name: 'Test Loitering Flow',
      description: 'Test flow for loitering detection'
    });

    console.log('✅ Created flow from template:', flow.name);
    console.log('   - ID:', flow.id);
    console.log('   - Nodes:', flow.nodes.length);
    console.log('   - Connections:', flow.connections.length);
    console.log('   - Enabled:', flow.enabled);
    console.log();

    // Test flow validation
    const errors = flowBuilder.validateFlow(flow);
    if (errors.length === 0) {
      console.log('✅ Flow validation passed');
    } else {
      console.log('❌ Flow validation failed:', errors);
    }
    console.log();

    // Test flow execution (mock)
    console.log('🧪 Testing flow execution...');
    
    // Simulate a loitering event
    const mockEvent = {
      type: 'smartDetectLoiterZone',
      data: {
        device: 'test-camera-1',
        confidence: 75,
        duration: 10000,
        timestamp: new Date().toISOString(),
        detectionTypes: ['person'],
        start: Date.now() - 10000,
        end: Date.now()
      },
      timestamp: new Date().toISOString()
    };

    console.log('📡 Publishing mock loitering event...');
    eventBus.publishEvent('smartDetectLoiterZone', mockEvent.data);

    console.log('✅ Flow system test completed successfully!\n');

    // List all flows
    const flows = flowBuilder.listFlows();
    console.log('📋 Available flows:');
    flows.forEach(flow => {
      console.log(`   - ${flow.name} (${flow.id}) - ${flow.enabled ? 'Enabled' : 'Disabled'}`);
    });

  } catch (error) {
    console.error('❌ Flow system test failed:', error);
  }
}

// Run the test
testFlowSystem().catch(console.error); 