#!/usr/bin/env node

/**
 * Session Token Test
 * Quick test to verify session token authentication for UDM Pro
 */

const UnifiProtectConnector = require('./connectors/types/UnifiProtectConnector');

// Configuration with session token (you'll need to add the token)
const config = {
  id: 'udm-pro-session',
  type: 'unifi-protect',
  name: 'UDM Pro with Session Token',
  description: 'UDM Pro using session token authentication',
  config: {
    host: '10.0.0.1',
    port: 443,
    protocol: 'https',
    username: 'ewanrichardson@icloud.com',
    password: 'RBTeeyKM142!',
    apiKey: 'nD6J3rQIOv2liStUy-zUGfnpZrXuLgYw',
    sessionToken: '', // PASTE YOUR SESSION TOKEN HERE
    verifySSL: false
  }
};

async function testSessionToken() {
  console.log('🔑 Session Token Test for UDM Pro');
  console.log('Testing session-based authentication\n');
  
  if (!config.config.sessionToken) {
    console.log('❌ No session token provided!');
    console.log('\n📋 To get your session token:');
    console.log('1. Go to https://10.0.0.1 in your browser');
    console.log('2. Open Developer Tools (F12)');
    console.log('3. Go to Console tab');
    console.log('4. Run: localStorage.getItem("TOKEN")');
    console.log('5. Copy the token and paste it in the config above');
    return;
  }
  
  const connector = new UnifiProtectConnector(config);
  
  try {
    console.log('🔐 Testing session token authentication...');
    await connector.connect();
    console.log('✅ Connection successful\n');
    
    console.log('📋 Bootstrap data:');
    if (connector.bootstrapData) {
      console.log('   - Protect Available:', connector.bootstrapData.protectAvailable || false);
      console.log('   - Network Only:', connector.bootstrapData.networkOnly || false);
      console.log('   - UDM Pro:', connector.bootstrapData.udmPro || false);
      console.log('   - Access Key:', connector.bootstrapData.accessKey ? 'Present' : 'Missing');
      console.log('   - Cameras:', connector.bootstrapData.cameras?.length || 0);
    }
    
    console.log('\n📹 Testing camera list...');
    const cameras = await connector.listCameras();
    console.log(`✅ Found ${cameras.length} cameras`);
    
    if (cameras.length > 0) {
      cameras.forEach(camera => {
        console.log(`   - ${camera.name} (${camera.id})`);
      });
    }
    
    console.log('\n🎉 Session token authentication successful!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await connector.disconnect();
  }
}

testSessionToken().catch(console.error); 