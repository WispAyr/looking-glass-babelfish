#!/usr/bin/env node

/**
 * Test script for the connector system
 * This script tests the basic functionality of the connector registry and connectors
 */

const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const UnifiProtectConnector = require('./connectors/types/UnifiProtectConnector');
const MqttConnector = require('./connectors/types/MqttConnector');

async function testConnectors() {
  console.log('🔍 Testing connector connections...');
  
  try {
    // Create connector registry
    const connectorRegistry = new ConnectorRegistry();
    
    // Initialize and load configuration
    await connectorRegistry.initialize();
    
    // Auto-discover connector types
    await connectorRegistry.autoDiscoverTypes();
    
    console.log(`\n📋 Found ${connectorRegistry.getConnectors().length} connectors:`);
    connectorRegistry.getConnectors().forEach(connector => {
      console.log(`  - ${connector.id} (${connector.type}) - Status: ${connector.status}`);
    });
    
    // Try to connect all connectors
    console.log('\n🔌 Attempting to connect all connectors...');
    const connectionResults = await connectorRegistry.connectAll();
    
    console.log('\n📊 Connection Results:');
    connectionResults.forEach(result => {
      if (result.status === 'connected') {
        console.log(`  ✅ ${result.id}: Connected`);
      } else {
        console.log(`  ❌ ${result.id}: ${result.status} - ${result.error}`);
      }
    });
    
    // Get final status
    const finalStatus = connectorRegistry.getStatus();
    console.log(`\n📈 Final Status:`);
    console.log(`  Total connectors: ${finalStatus.totalConnectors}`);
    console.log(`  Connected: ${finalStatus.connectedConnectors}`);
    console.log(`  Failed: ${finalStatus.totalConnectors - finalStatus.connectedConnectors}`);
    
    // Show detailed status for each connector
    console.log('\n🔍 Detailed Connector Status:');
    finalStatus.connectors.forEach(connector => {
      console.log(`  ${connector.id}:`);
      console.log(`    Type: ${connector.type}`);
      console.log(`    Status: ${connector.status}`);
      console.log(`    Capabilities: ${connector.capabilities.length}`);
      if (connector.status !== 'connected') {
        const connectorInstance = connectorRegistry.getConnector(connector.id);
        if (connectorInstance && connectorInstance.lastError) {
          console.log(`    Last Error: ${connectorInstance.lastError.message}`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testConnectors(); 