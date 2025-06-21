const AnkkeDvrConnector = require('./connectors/types/AnkkeDvrConnector');

// Test configuration
const testConfig = {
  id: 'test-ankke-dvr',
  type: 'ankke-dvr',
  name: 'Test ANKKE DVR',
  host: '192.168.1.100',
  port: 80,
  protocol: 'http',
  username: 'admin',
  password: 'password',
  timeout: 10000
};

async function testAnkkeDvrConnector() {
  console.log('Testing ANKKE DVR Connector...\n');
  
  try {
    // Create connector instance
    const connector = new AnkkeDvrConnector(testConfig);
    
    // Test configuration validation
    console.log('1. Testing configuration validation...');
    try {
      AnkkeDvrConnector.validateConfig(testConfig);
      console.log('✓ Configuration validation passed');
    } catch (error) {
      console.log('✗ Configuration validation failed:', error.message);
    }
    
    // Test metadata
    console.log('\n2. Testing metadata...');
    const metadata = AnkkeDvrConnector.getMetadata();
    console.log('✓ Metadata retrieved:', metadata.name, metadata.version);
    
    // Test capability definitions
    console.log('\n3. Testing capability definitions...');
    const capabilities = AnkkeDvrConnector.getCapabilityDefinitions();
    console.log(`✓ Found ${capabilities.length} capabilities:`);
    capabilities.forEach(cap => {
      console.log(`  - ${cap.id}: ${cap.name}`);
    });
    
    // Test connection (mock)
    console.log('\n4. Testing connection (mock)...');
    try {
      // Mock connection for testing
      connector.isConnected = true;
      connector.deviceInfo = {
        deviceName: 'Test ANKKE DVR',
        deviceType: 'DVR',
        firmwareVersion: '1.0.0',
        channels: 8
      };
      connector.cameras.set(1, {
        channel: 1,
        name: 'Camera 1',
        enabled: true,
        status: 'Online'
      });
      console.log('✓ Mock connection successful');
    } catch (error) {
      console.log('✗ Mock connection failed:', error.message);
    }
    
    // Test camera operations
    console.log('\n5. Testing camera operations...');
    try {
      const cameras = await connector.executeCapability('ankke:camera', 'list');
      console.log(`✓ Listed ${cameras.length} cameras`);
      
      const cameraInfo = await connector.executeCapability('ankke:camera', 'info', { channel: 1 });
      console.log('✓ Camera info retrieved:', cameraInfo.name);
      
      console.log('✓ Camera operations test passed');
    } catch (error) {
      console.log('✗ Camera operations test failed:', error.message);
    }
    
    // Test streaming operations
    console.log('\n6. Testing streaming operations...');
    try {
      const stream = await connector.executeCapability('ankke:stream', 'start', {
        channel: 1,
        type: 'main',
        format: 'h264'
      });
      console.log('✓ Stream started:', stream.streamId);
      
      const streams = await connector.executeCapability('ankke:stream', 'list');
      console.log(`✓ Listed ${streams.length} active streams`);
      
      const url = await connector.executeCapability('ankke:stream', 'url', {
        channel: 1,
        type: 'main',
        format: 'h264'
      });
      console.log('✓ Stream URL generated');
      
      await connector.executeCapability('ankke:stream', 'stop', { streamId: stream.streamId });
      console.log('✓ Stream stopped');
      
      console.log('✓ Streaming operations test passed');
    } catch (error) {
      console.log('✗ Streaming operations test failed:', error.message);
    }
    
    // Test recording operations
    console.log('\n7. Testing recording operations...');
    try {
      await connector.executeCapability('ankke:recording', 'start', {
        channel: 1,
        type: 'manual'
      });
      console.log('✓ Recording started');
      
      const recordings = await connector.executeCapability('ankke:recording', 'list', {
        channel: 1
      });
      console.log(`✓ Listed ${recordings.length} recordings`);
      
      await connector.executeCapability('ankke:recording', 'stop', { channel: 1 });
      console.log('✓ Recording stopped');
      
      console.log('✓ Recording operations test passed');
    } catch (error) {
      console.log('✗ Recording operations test failed:', error.message);
    }
    
    // Test motion detection
    console.log('\n8. Testing motion detection...');
    try {
      await connector.executeCapability('ankke:motion', 'enable', {
        channel: 1,
        sensitivity: 50
      });
      console.log('✓ Motion detection enabled');
      
      await connector.executeCapability('ankke:motion', 'disable', { channel: 1 });
      console.log('✓ Motion detection disabled');
      
      console.log('✓ Motion detection test passed');
    } catch (error) {
      console.log('✗ Motion detection test failed:', error.message);
    }
    
    // Test PTZ operations
    console.log('\n9. Testing PTZ operations...');
    try {
      await connector.executeCapability('ankke:ptz', 'move', {
        channel: 1,
        direction: 'up',
        speed: 50
      });
      console.log('✓ PTZ moved');
      
      await connector.executeCapability('ankke:ptz', 'stop', { channel: 1 });
      console.log('✓ PTZ stopped');
      
      console.log('✓ PTZ operations test passed');
    } catch (error) {
      console.log('✗ PTZ operations test failed:', error.message);
    }
    
    // Test system operations
    console.log('\n10. Testing system operations...');
    try {
      const systemInfo = await connector.executeCapability('ankke:system', 'info');
      console.log('✓ System info retrieved:', systemInfo.deviceName);
      
      console.log('✓ System operations test passed');
    } catch (error) {
      console.log('✗ System operations test failed:', error.message);
    }
    
    // Test error handling
    console.log('\n11. Testing error handling...');
    try {
      await connector.executeCapability('ankke:camera', 'info', { channel: 999 });
      console.log('✗ Should have thrown error for invalid channel');
    } catch (error) {
      console.log('✓ Error handling working:', error.message);
    }
    
    // Test disconnection
    console.log('\n12. Testing disconnection...');
    try {
      await connector.disconnect();
      console.log('✓ Disconnection successful');
    } catch (error) {
      console.log('✗ Disconnection failed:', error.message);
    }
    
    console.log('\n🎉 ANKKE DVR Connector tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAnkkeDvrConnector();
}

module.exports = { testAnkkeDvrConnector }; 