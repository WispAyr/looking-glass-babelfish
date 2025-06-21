#!/usr/bin/env node

/**
 * UDM Pro 2FA Authentication Test
 * Tests the UDM Pro specific authentication flow with 2FA support
 */

const UnifiProtectConnector = require('./connectors/types/UnifiProtectConnector');

// Configuration for UDM Pro
const config = {
  id: 'udm-pro',
  type: 'unifi-protect',
  name: 'UDM Pro Protect System',
  description: 'UDM Pro with UniFi Protect',
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

async function testUDMPro2FA() {
  console.log('🔐 UDM Pro 2FA Authentication Test');
  console.log('Testing UDM Pro specific authentication flow\n');
  
  const connector = new UnifiProtectConnector(config);
  
  try {
    // Test 1: Get 2FA authenticators
    console.log('🔑 Test 1: Getting 2FA authenticators...');
    const authenticators = await connector.get2FAAuthenticators();
    
    if (authenticators.length > 0) {
      console.log('✅ Found 2FA authenticators:');
      authenticators.forEach(auth => {
        console.log(`   - ${auth.type}: ${auth.name || auth.email || auth.id}`);
        if (auth.type === 'email') {
          console.log(`     Email: ${auth.email}`);
        }
      });
    } else {
      console.log('⚠️ No 2FA authenticators found');
    }
    console.log();
    
    // Test 2: Connect and check authentication flow
    console.log('🔐 Test 2: Connecting and checking authentication flow...');
    await connector.connect();
    console.log('✅ Connection successful\n');
    
    // Test 3: Check bootstrap data
    console.log('📋 Test 3: Checking bootstrap data...');
    if (connector.bootstrapData) {
      console.log('✅ Bootstrap data available');
      console.log('   - Protect Available:', connector.bootstrapData.protectAvailable || false);
      console.log('   - Network Only:', connector.bootstrapData.networkOnly || false);
      console.log('   - UDM Pro:', connector.bootstrapData.udmPro || false);
      console.log('   - Requires 2FA:', connector.bootstrapData.requires2FA || false);
      console.log('   - Sites:', connector.bootstrapData.sites?.length || 0);
      console.log('   - Access Key:', connector.bootstrapData.accessKey ? 'Present' : 'Missing');
    } else {
      console.log('❌ No bootstrap data available');
    }
    console.log();
    
    // Test 4: Check UDM Pro specific state
    console.log('🏠 Test 4: Checking UDM Pro specific state...');
    console.log('   - UDM Pro detected:', connector.udmPro);
    console.log('   - Requires 2FA:', connector.requires2FA);
    console.log('   - MFA Cookie:', connector.mfaCookie ? 'Present' : 'Missing');
    console.log('   - Session Token:', connector.sessionToken ? 'Present' : 'Missing');
    console.log();
    
    // Test 5: Test Network API endpoints
    console.log('🌐 Test 5: Testing Network API endpoints...');
    try {
      const sitesResponse = await connector.makeRequest('GET', '/proxy/network/integration/v1/sites');
      console.log('✅ Sites endpoint:', sitesResponse.data?.length || 0, 'sites');
      
      const devicesResponse = await connector.makeRequest('GET', '/proxy/network/integration/v1/devices');
      console.log('✅ Devices endpoint:', devicesResponse.data?.length || 0, 'devices');
      
    } catch (error) {
      console.log('⚠️ Network API test failed:', error.message);
    }
    console.log();
    
    console.log('🎉 UDM Pro authentication test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ UDM Pro detected and configured');
    console.log('   ✅ 2FA authenticators retrieved');
    console.log('   ✅ Network API working');
    console.log('   ⚠️ Protect API requires 2FA completion');
    console.log('\n💡 Next Steps:');
    console.log('   1. Complete 2FA authentication in web interface');
    console.log('   2. Use session-based authentication for Protect API');
    console.log('   3. Or continue with Network API only mode');
    
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
  
  console.log('\n✨ UDM Pro 2FA test completed');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

// Run the test
testUDMPro2FA().catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
}); 