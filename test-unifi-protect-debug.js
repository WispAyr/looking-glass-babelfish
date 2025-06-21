#!/usr/bin/env node

/**
 * Debug UniFi Protect Connector Test
 * Tests authentication with detailed logging
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

async function testUniFiProtectDebug() {
  console.log('🔍 UniFi Protect Debug Test');
  console.log('Testing authentication with detailed logging\n');
  
  const connector = new UnifiProtectConnector(config);
  
  // Enable debug logging
  connector.setDebugMode(true);
  
  console.log('📋 Configuration:');
  console.log(`   Host: ${config.config.host}:${config.config.port}`);
  console.log(`   Protocol: ${config.config.protocol}`);
  console.log(`   Username: ${config.config.username}`);
  console.log(`   API Key: ${config.config.apiKey.substring(0, 8)}...`);
  console.log(`   Verify SSL: ${config.config.verifySSL}`);
  console.log();
  
  try {
    console.log('🔐 Test 1: Testing direct API key authentication...');
    
    // Test direct API key request
    const testResponse = await connector.makeRequest('GET', '/proxy/network/integration/v1/sites', null, {
      'X-API-KEY': config.config.apiKey
    });
    
    console.log('✅ Direct API key test response:', testResponse);
    
  } catch (error) {
    console.log('❌ Direct API key test failed:', error.message);
  }
  
  try {
    console.log('\n🔐 Test 2: Testing login authentication...');
    
    // Test login request
    const loginResponse = await connector.makeRequest('POST', '/api/auth/login', {
      username: config.config.username,
      password: config.config.password,
      remember: true
    });
    
    console.log('✅ Login test response:', loginResponse);
    
  } catch (error) {
    console.log('❌ Login test failed:', error.message);
  }
  
  try {
    console.log('\n🔐 Test 3: Testing bootstrap with API key...');
    
    // Test bootstrap with API key
    const bootstrapResponse = await connector.makeRequest('GET', '/proxy/protect/api/bootstrap', null, {
      'X-API-KEY': config.config.apiKey
    });
    
    console.log('✅ Bootstrap test response:', bootstrapResponse);
    
  } catch (error) {
    console.log('❌ Bootstrap test failed:', error.message);
  }
  
  try {
    console.log('\n🔐 Test 4: Testing bootstrap without auth...');
    
    // Test bootstrap without authentication
    const bootstrapNoAuthResponse = await connector.makeRequest('GET', '/proxy/protect/api/bootstrap');
    
    console.log('✅ Bootstrap no auth test response:', bootstrapNoAuthResponse);
    
  } catch (error) {
    console.log('❌ Bootstrap no auth test failed:', error.message);
  }
  
  try {
    console.log('\n🔐 Test 5: Testing network API...');
    
    // Test network API
    const networkResponse = await connector.makeRequest('GET', '/proxy/network/integration/v1/sites');
    
    console.log('✅ Network API test response:', networkResponse);
    
  } catch (error) {
    console.log('❌ Network API test failed:', error.message);
  }
  
  console.log('\n🔍 Debug Information:');
  console.log('   - Check if UniFi Protect is installed on the system');
  console.log('   - Verify the API key is valid and not expired');
  console.log('   - Check if the system is accessible at 10.0.0.1:443');
  console.log('   - Verify SSL certificate if using HTTPS');
  console.log('   - Check firewall settings');
  
  console.log('\n✨ Debug test completed');
}

// Run the test
testUniFiProtectDebug().catch(error => {
  console.error('💥 Debug test crashed:', error);
  process.exit(1);
}); 