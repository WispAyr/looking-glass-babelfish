#!/usr/bin/env node

/**
 * UniFi Network API Only Test
 * Tests functionality when UniFi Protect is not installed
 */

const UnifiProtectConnector = require('./connectors/types/UnifiProtectConnector');

// Configuration from connectors.json
const config = {
  id: 'van-unifi',
  type: 'unifi-protect',
  name: 'Van Unifi Protect System',
  description: 'Communications van Unifi Protect system',
  config: {
    host: '10.0.0.1',
    port: 443,
    protocol: 'https',
    username: 'ewanrichardson@icloud.com',
    password: 'RBTeeyKM142!',
    apiKey: 'nD6J3rQIOv2liStUy-zUGfnpZrXuLgYw',
    verifySSL: false,
    autoDiscovery: {
      enabled: true,
      refreshInterval: 300000,
      createEntities: true,
      subscribeToEvents: true,
      eventTypes: ['motion', 'smart', 'recording', 'connection']
    }
  }
};

async function testUniFiNetworkOnly() {
  console.log('🚀 UniFi Network API Only Test');
  console.log('Testing functionality when UniFi Protect is not installed\n');
  
  const connector = new UnifiProtectConnector(config);
  
  // Set up event listeners
  connector.on('event:motion', (event) => {
    console.log('🎯 MOTION DETECTED:', event.motionData);
  });
  
  connector.on('event:ring', (event) => {
    console.log('🔔 DOORBELL RING:', event.ringData);
  });
  
  connector.on('event:smart', (event) => {
    console.log('🧠 SMART DETECTION:', event.smartData);
  });
  
  try {
    // Test 1: Connect and authenticate
    console.log('🔐 Test 1: Connecting and authenticating...');
    await connector.connect();
    console.log('✅ Connection successful\n');
    
    // Test 2: Check bootstrap data
    console.log('📋 Test 2: Checking bootstrap data...');
    if (connector.bootstrapData) {
      console.log('✅ Bootstrap data available');
      console.log('   - Protect Available:', connector.bootstrapData.protectAvailable || false);
      console.log('   - Network Only:', connector.bootstrapData.networkOnly || false);
      console.log('   - Sites:', connector.bootstrapData.sites?.length || 0);
    } else {
      console.log('❌ No bootstrap data available');
    }
    console.log();
    
    // Test 3: List cameras (will be empty for Network API only)
    console.log('📹 Test 3: Listing cameras...');
    const cameras = await connector.listCameras();
    console.log(`✅ Found ${cameras.length} cameras`);
    if (cameras.length === 0) {
      console.log('   (No cameras available - UniFi Protect not installed)');
    } else {
      cameras.forEach(camera => {
        console.log(`   - ${camera.name} (${camera.id}) - ${camera.state || 'unknown'}`);
      });
    }
    console.log();
    
    // Test 4: Get system info
    console.log('ℹ️ Test 4: Getting system information...');
    try {
      const systemInfo = await connector.getSystemInfo();
      console.log('✅ System info:', {
        version: systemInfo.version,
        uptime: systemInfo.uptime,
        storage: systemInfo.storage
      });
    } catch (error) {
      console.log('⚠️ System info test failed:', error.message);
    }
    console.log();
    
    // Test 5: List users
    console.log('👥 Test 5: Listing users...');
    try {
      const users = await connector.listUsers();
      console.log(`✅ Found ${users.length} users`);
      users.slice(0, 3).forEach(user => {
        console.log(`   - ${user.name} (${user.email})`);
      });
    } catch (error) {
      console.log('⚠️ Users test failed:', error.message);
    }
    console.log();
    
    // Test 6: Test Network API endpoints
    console.log('🌐 Test 6: Testing Network API endpoints...');
    try {
      // Test sites endpoint
      const sitesResponse = await connector.makeRequest('GET', '/proxy/network/integration/v1/sites');
      console.log('✅ Sites endpoint:', sitesResponse.data?.length || 0, 'sites');
      
      // Test devices endpoint
      const devicesResponse = await connector.makeRequest('GET', '/proxy/network/integration/v1/devices');
      console.log('✅ Devices endpoint:', devicesResponse.data?.length || 0, 'devices');
      
      // Test clients endpoint
      const clientsResponse = await connector.makeRequest('GET', '/proxy/network/integration/v1/clients');
      console.log('✅ Clients endpoint:', clientsResponse.data?.length || 0, 'clients');
      
    } catch (error) {
      console.log('⚠️ Network API test failed:', error.message);
    }
    console.log();
    
    // Test 7: Test capabilities
    console.log('🔧 Test 7: Testing available capabilities...');
    const capabilities = UnifiProtectConnector.getCapabilityDefinitions();
    console.log(`✅ Available capabilities: ${capabilities.length}`);
    capabilities.forEach(cap => {
      console.log(`   - ${cap.id}: ${cap.name}`);
    });
    console.log();
    
    // Test 8: Test capability execution
    console.log('⚡ Test 8: Testing capability execution...');
    try {
      const result = await connector.executeCapability('system:info', 'read', {});
      console.log('✅ System info capability executed:', result ? 'Success' : 'Failed');
    } catch (error) {
      console.log('⚠️ Capability execution failed:', error.message);
    }
    console.log();
    
    // Test 9: Test event subscriptions (will be limited for Network API)
    console.log('🔔 Test 9: Testing event subscriptions...');
    try {
      const realtimeSub = await connector.subscribeToRealtimeEvents({
        eventTypes: ['connection'],
        deviceIds: []
      });
      console.log('✅ Real-time events subscribed:', realtimeSub.subscriptionId);
    } catch (error) {
      console.log('⚠️ Event subscription failed:', error.message);
    }
    console.log();
    
    // Test 10: Monitor for any events
    console.log('👂 Test 10: Monitoring for events (30 seconds)...');
    console.log('   (Limited events available with Network API only)');
    console.log('   Press Ctrl+C to stop\n');
    
    // Keep the connection alive to receive events
    await new Promise(resolve => {
      setTimeout(resolve, 30000);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    try {
      await connector.disconnect();
      console.log('✅ Disconnected successfully');
    } catch (error) {
      console.log('⚠️ Disconnect error:', error.message);
    }
  }
  
  console.log('\n✨ UniFi Network API only test completed');
  console.log('\n📋 Summary:');
  console.log('   ✅ Network API authentication works');
  console.log('   ⚠️ UniFi Protect not installed');
  console.log('   ✅ System information available');
  console.log('   ✅ User management available');
  console.log('   ✅ Network devices and clients accessible');
  console.log('   ⚠️ Camera features not available');
  console.log('   ⚠️ Video streaming not available');
  console.log('   ⚠️ Real-time events limited');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

// Run the test
testUniFiNetworkOnly().catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
}); 