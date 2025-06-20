#!/usr/bin/env node

/**
 * Test script for the connector system
 * This script tests the basic functionality of the connector registry and connectors
 */

const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const UnifiProtectConnector = require('./connectors/types/UnifiProtectConnector');
const MqttConnector = require('./connectors/types/MqttConnector');

async function testConnectorSystem() {
  console.log('🧪 Testing Connector System...\n');
  
  // Create connector registry
  const registry = new ConnectorRegistry();
  
  // Register connector types
  console.log('📝 Registering connector types...');
  registry.registerType('unifi-protect', UnifiProtectConnector);
  registry.registerType('mqtt', MqttConnector);
  
  // Test connector types
  console.log('\n📋 Available connector types:');
  const types = registry.getTypes();
  types.forEach(type => {
    console.log(`  - ${type.type} (${type.metadata.version}): ${type.metadata.description}`);
  });
  
  // Test creating connectors
  console.log('\n🔧 Creating test connectors...');
  
  try {
    // Create Unifi Protect connector (will fail to connect but should create successfully)
    const unifiConfig = {
      id: 'test-unifi',
      type: 'unifi-protect',
      name: 'Test Unifi Protect',
      description: 'Test connector for Unifi Protect',
      config: {
        host: '10.0.0.1',
        port: 443,
        protocol: 'https',
        apiKey: 'test-api-key',
        verifySSL: false,
        timeout: 5000
      }
    };
    
    const unifiConnector = await registry.createConnector(unifiConfig);
    console.log(`  ✅ Created Unifi Protect connector: ${unifiConnector.id}`);
    
    // Test capabilities
    console.log(`  📊 Capabilities: ${unifiConnector.getEnabledCapabilities().map(cap => cap.id).join(', ')}`);
    
    // Create MQTT connector (will fail to connect but should create successfully)
    const mqttConfig = {
      id: 'test-mqtt',
      type: 'mqtt',
      name: 'Test MQTT Broker',
      description: 'Test connector for MQTT',
      config: {
        host: 'localhost',
        port: 1883,
        protocol: 'mqtt',
        clientId: 'test-client',
        timeout: 5000
      }
    };
    
    const mqttConnector = await registry.createConnector(mqttConfig);
    console.log(`  ✅ Created MQTT connector: ${mqttConnector.id}`);
    
    // Test capabilities
    console.log(`  📊 Capabilities: ${mqttConnector.getEnabledCapabilities().map(cap => cap.id).join(', ')}`);
    
    // Test connector listing
    console.log('\n📋 All connectors:');
    const connectors = registry.getConnectors();
    connectors.forEach(connector => {
      console.log(`  - ${connector.id} (${connector.type}): ${connector.status}`);
    });
    
    // Test capability matching
    console.log('\n🔗 Testing capability matching...');
    const matches = registry.findCapabilityMatches('camera:event:motion', 'mqtt:publish');
    console.log(`  Found ${matches.length} matches between motion events and MQTT publishing`);
    
    // Test finding connectors by capability
    console.log('\n🔍 Finding connectors by capability...');
    const motionConnectors = registry.findConnectorsByCapability('camera:event:motion');
    console.log(`  Connectors with motion detection: ${motionConnectors.map(c => c.id).join(', ')}`);
    
    const publishConnectors = registry.findConnectorsByCapability('mqtt:publish');
    console.log(`  Connectors with MQTT publishing: ${publishConnectors.map(c => c.id).join(', ')}`);
    
    // Test connector status
    console.log('\n📊 System status:');
    const status = registry.getStatus();
    console.log(`  Total connectors: ${status.totalConnectors}`);
    console.log(`  Connected connectors: ${status.connectedConnectors}`);
    console.log(`  Connector types: ${status.connectorTypes}`);
    
    // Test connector operations (without connecting)
    console.log('\n⚡ Testing connector operations...');
    
    try {
      // Test Unifi Protect operations
      const cameras = await unifiConnector.execute('camera:management', 'list', { siteId: 'default' });
      console.log(`  ✅ Unifi Protect: Listed ${cameras.length} cameras`);
    } catch (error) {
      console.log(`  ❌ Unifi Protect: ${error.message}`);
    }
    
    try {
      // Test MQTT operations
      const mqttStatus = await mqttConnector.execute('mqtt:connection', 'status');
      console.log(`  ✅ MQTT: Connection status - ${mqttStatus.connected ? 'Connected' : 'Disconnected'}`);
    } catch (error) {
      console.log(`  ❌ MQTT: ${error.message}`);
    }
    
    // Test configuration updates
    console.log('\n⚙️ Testing configuration updates...');
    await registry.updateConnector('test-unifi', {
      config: { timeout: 10000 }
    });
    console.log('  ✅ Updated Unifi Protect connector configuration');
    
    // Test capability management
    console.log('\n🎛️ Testing capability management...');
    unifiConnector.setCapabilityEnabled('system:users', true);
    console.log('  ✅ Enabled system:users capability');
    
    unifiConnector.setCapabilityEnabled('system:users', false);
    console.log('  ✅ Disabled system:users capability');
    
    // Test connector removal
    console.log('\n🗑️ Testing connector removal...');
    await registry.removeConnector('test-unifi');
    console.log('  ✅ Removed Unifi Protect connector');
    
    await registry.removeConnector('test-mqtt');
    console.log('  ✅ Removed MQTT connector');
    
    // Final status
    console.log('\n📊 Final system status:');
    const finalStatus = registry.getStatus();
    console.log(`  Total connectors: ${finalStatus.totalConnectors}`);
    console.log(`  Connected connectors: ${finalStatus.connectedConnectors}`);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
testConnectorSystem().catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
}); 