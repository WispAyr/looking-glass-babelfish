const SystemVisualizerConnector = require('./connectors/types/SystemVisualizerConnector');
const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const { exec } = require('child_process');

async function testRealSystemVisualizer() {
  console.log('🚀 Testing System Visualizer with REAL Connectors');
  console.log('=' .repeat(60));

  // Kill any process using port 3001
  exec('lsof -ti:3001 | xargs kill -9', async (error, stdout, stderr) => {
    if (error) {
      console.log('No process found on port 3001 or already free');
    } else {
      console.log('✅ Freed port 3001');
    }
    
    // Create connector registry
    const connectorRegistry = new ConnectorRegistry();
    
    try {
      // Initialize registry and auto-discover connector types
      await connectorRegistry.initialize();
      await connectorRegistry.autoDiscoverTypes();
      
      console.log('📋 Available connector types:');
      const types = connectorRegistry.getTypes();
      types.forEach(type => {
        console.log(`   • ${type.type} (${type.metadata?.version || 'unknown'})`);
      });

      // Load real connectors from config
      console.log('\n🔧 Loading real connectors from config...');
      const config = require('./config/connectors.json');
      
      // Filter out system-visualizer to avoid conflicts
      const realConnectors = config.connectors.filter(c => c.type !== 'system-visualizer');
      
      console.log(`📊 Found ${realConnectors.length} real connectors to test:`);
      realConnectors.forEach(connector => {
        console.log(`   • ${connector.name} (${connector.type})`);
      });

      // Create and connect real connectors
      console.log('\n🔌 Creating and connecting real connectors...');
      const connectedConnectors = [];
      
      for (const connectorConfig of realConnectors.slice(0, 5)) { // Limit to 5 for testing
        try {
          console.log(`   Connecting ${connectorConfig.name}...`);
          const connector = await connectorRegistry.createConnector(connectorConfig);
          
          // Try to connect (some might fail due to missing config, that's OK)
          try {
            await connector.connect();
            console.log(`   ✅ ${connectorConfig.name} connected successfully`);
            connectedConnectors.push(connector);
          } catch (connectError) {
            console.log(`   ⚠️  ${connectorConfig.name} connection failed (expected for some connectors): ${connectError.message}`);
            // Still add to registry for visualization
            connectedConnectors.push(connector);
          }
        } catch (error) {
          console.log(`   ❌ Failed to create ${connectorConfig.name}: ${error.message}`);
        }
      }

      console.log(`\n✅ Successfully loaded ${connectedConnectors.length} real connectors`);

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

      // Set up visualizer with real connector registry
      visualizer.setConnectorRegistry(connectorRegistry);
      
      await visualizer.connect();
      console.log('✅ System Visualizer connected successfully');
      console.log(`🌐 Web interface available at: http://localhost:${visualizer.config.port}`);
      console.log('📊 Real-time data flow visualization enabled');
      
      // Test capabilities with real connectors
      console.log('\n🔍 Testing Real Connector Capabilities:');
      
      const connectors = connectorRegistry.getConnectors();
      connectors.forEach(connector => {
        if (connector.getCapabilityDefinitions) {
          const capabilities = connector.getCapabilityDefinitions();
          console.log(`   ${connector.name}: ${capabilities.length} capabilities`);
          capabilities.forEach(cap => {
            console.log(`     • ${cap.name} (${cap.id})`);
          });
        }
      });

      // Test data flow with real connectors
      console.log('\n📊 Testing Real Data Flow:');
      
      const systemData = await visualizer.execute('visualization:system', 'get', {});
      console.log('✅ System data retrieval:', systemData.success ? 'SUCCESS' : 'FAILED');
      
      const connectorData = await visualizer.execute('visualization:connectors', 'list', {});
      console.log('✅ Connector listing:', connectorData.success ? 'SUCCESS' : 'FAILED');
      
      const dataFlow = await visualizer.execute('visualization:dataflow', 'track', {});
      console.log('✅ Data flow tracking:', dataFlow.success ? 'SUCCESS' : 'FAILED');
      
      const metrics = await visualizer.execute('visualization:metrics', 'collect', {});
      console.log('✅ Metrics collection:', metrics.success ? 'SUCCESS' : 'FAILED');

      // Show real relationships
      console.log('\n🔗 Real Connector Relationships:');
      const relationships = await visualizer.execute('visualization:connectors', 'analyze', {});
      if (relationships.success && relationships.data) {
        relationships.data.forEach(rel => {
          console.log(`   ${rel.from} → ${rel.to} (${rel.type})`);
          if (rel.capabilities) {
            rel.capabilities.forEach(cap => {
              console.log(`     • ${cap.description}`);
            });
          }
        });
      }

      console.log('\n🎯 Real System Features:');
      console.log('   • Real connector capabilities from actual connector classes');
      console.log('   • Real relationship discovery based on capability matching');
      console.log('   • Real connector statistics (when connectors are active)');
      console.log('   • Real data flow based on actual capability patterns');
      console.log('   • Real WebSocket communication for live updates');
      console.log('   • Real connector registry integration');
      
      console.log('\n🌐 Open http://localhost:3001 to see the REAL system visualization!');
      console.log('💡 Note: Some connectors may show as disconnected if they require external services');
      
      // Keep the process running
      console.log('\n⏳ Keeping visualizer running... (Press Ctrl+C to stop)');
      
    } catch (error) {
      console.error('❌ Error testing real system visualizer:', error);
    }
  });
}

// Run the test
testRealSystemVisualizer(); 