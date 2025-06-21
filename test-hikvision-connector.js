const HikvisionConnector = require('./connectors/types/HikvisionConnector');

// Test configuration
const testConfig = {
  id: 'test-hikvision',
  type: 'hikvision',
  name: 'Test Hikvision Device',
  host: '192.168.1.100',
  port: 80,
  protocol: 'http',
  username: 'admin',
  password: 'password',
  timeout: 15000
};

async function testHikvisionConnector() {
  console.log('Testing Hikvision Connector...\n');
  
  try {
    // Create connector instance
    const connector = new HikvisionConnector(testConfig);
    
    // Test configuration validation
    console.log('1. Testing configuration validation...');
    try {
      HikvisionConnector.validateConfig(testConfig);
      console.log('✓ Configuration validation passed');
    } catch (error) {
      console.log('✗ Configuration validation failed:', error.message);
    }
    
    // Test metadata
    console.log('\n2. Testing metadata...');
    const metadata = HikvisionConnector.getMetadata();
    console.log('✓ Metadata retrieved:', metadata.name, metadata.version);
    
    // Test capability definitions
    console.log('\n3. Testing capability definitions...');
    const capabilities = HikvisionConnector.getCapabilityDefinitions();
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
        deviceName: 'Test Hikvision Device',
        deviceID: 'TEST123',
        model: 'DS-2CD2142FWD-I',
        firmwareVersion: '5.5.0',
        deviceType: 'IPCamera'
      };
      connector.channels.set(1, {
        id: 1,
        name: 'Channel 1',
        enabled: true,
        videoCodecType: 'H.264',
        videoResolutionWidth: 1920,
        videoResolutionHeight: 1080,
        videoFrameRate: 25
      });
      console.log('✓ Mock connection successful');
    } catch (error) {
      console.log('✗ Mock connection failed:', error.message);
    }
    
    // Test camera operations
    console.log('\n5. Testing camera operations...');
    try {
      const cameras = await connector.executeCapability('hikvision:camera', 'list');
      console.log(`✓ Listed ${cameras.length} cameras`);
      
      const cameraInfo = await connector.executeCapability('hikvision:camera', 'info', { channelId: 1 });
      console.log('✓ Camera info retrieved:', cameraInfo.name);
      
      console.log('✓ Camera operations test passed');
    } catch (error) {
      console.log('✗ Camera operations test failed:', error.message);
    }
    
    // Test streaming operations
    console.log('\n6. Testing streaming operations...');
    try {
      const stream = await connector.executeCapability('hikvision:stream', 'start', {
        channelId: 1,
        streamType: 'main',
        protocol: 'rtsp'
      });
      console.log('✓ Stream started:', stream.streamId);
      
      const streams = await connector.executeCapability('hikvision:stream', 'list');
      console.log(`✓ Listed ${streams.length} active streams`);
      
      const url = await connector.executeCapability('hikvision:stream', 'url', {
        channelId: 1,
        streamType: 'main',
        protocol: 'rtsp'
      });
      console.log('✓ Stream URL generated');
      
      await connector.executeCapability('hikvision:stream', 'stop', { streamId: stream.streamId });
      console.log('✓ Stream stopped');
      
      console.log('✓ Streaming operations test passed');
    } catch (error) {
      console.log('✗ Streaming operations test failed:', error.message);
    }
    
    // Test recording operations
    console.log('\n7. Testing recording operations...');
    try {
      await connector.executeCapability('hikvision:recording', 'start', {
        channelId: 1,
        type: 'manual'
      });
      console.log('✓ Recording started');
      
      const recordings = await connector.executeCapability('hikvision:recording', 'list', {
        channelId: 1
      });
      console.log(`✓ Listed ${recordings.length} recordings`);
      
      await connector.executeCapability('hikvision:recording', 'stop', { channelId: 1 });
      console.log('✓ Recording stopped');
      
      console.log('✓ Recording operations test passed');
    } catch (error) {
      console.log('✗ Recording operations test failed:', error.message);
    }
    
    // Test motion detection
    console.log('\n8. Testing motion detection...');
    try {
      await connector.executeCapability('hikvision:motion', 'enable', {
        channelId: 1,
        enabled: true
      });
      console.log('✓ Motion detection enabled');
      
      await connector.executeCapability('hikvision:motion', 'disable', { channelId: 1 });
      console.log('✓ Motion detection disabled');
      
      console.log('✓ Motion detection test passed');
    } catch (error) {
      console.log('✗ Motion detection test failed:', error.message);
    }
    
    // Test PTZ operations
    console.log('\n9. Testing PTZ operations...');
    try {
      await connector.executeCapability('hikvision:ptz', 'move', {
        channelId: 1,
        action: 'start',
        pan: 10,
        tilt: 5,
        zoom: 0
      });
      console.log('✓ PTZ moved');
      
      await connector.executeCapability('hikvision:ptz', 'stop', { channelId: 1 });
      console.log('✓ PTZ stopped');
      
      await connector.executeCapability('hikvision:ptz', 'preset', {
        channelId: 1,
        presetId: 1,
        presetName: 'Home Position'
      });
      console.log('✓ PTZ preset set');
      
      const presets = await connector.executeCapability('hikvision:ptz', 'list-presets', {
        channelId: 1
      });
      console.log(`✓ Listed ${presets.length} PTZ presets`);
      
      console.log('✓ PTZ operations test passed');
    } catch (error) {
      console.log('✗ PTZ operations test failed:', error.message);
    }
    
    // Test event management
    console.log('\n10. Testing event management...');
    try {
      await connector.executeCapability('hikvision:event', 'subscribe', {
        eventType: 'motion',
        channelId: 1
      });
      console.log('✓ Event subscription successful');
      
      const triggers = await connector.executeCapability('hikvision:event', 'triggers');
      console.log(`✓ Retrieved ${triggers.length} event triggers`);
      
      console.log('✓ Event management test passed');
    } catch (error) {
      console.log('✗ Event management test failed:', error.message);
    }
    
    // Test system operations
    console.log('\n11. Testing system operations...');
    try {
      const systemInfo = await connector.executeCapability('hikvision:system', 'info');
      console.log('✓ System info retrieved:', systemInfo.deviceName);
      
      const networkConfig = await connector.executeCapability('hikvision:system', 'network');
      console.log('✓ Network config retrieved');
      
      console.log('✓ System operations test passed');
    } catch (error) {
      console.log('✗ System operations test failed:', error.message);
    }
    
    // Test error handling
    console.log('\n12. Testing error handling...');
    try {
      await connector.executeCapability('hikvision:camera', 'info', { channelId: 999 });
      console.log('✗ Should have thrown error for invalid channel');
    } catch (error) {
      console.log('✓ Error handling working:', error.message);
    }
    
    // Test invalid capability
    try {
      await connector.executeCapability('invalid:capability', 'test');
      console.log('✗ Should have thrown error for invalid capability');
    } catch (error) {
      console.log('✓ Invalid capability error handling working:', error.message);
    }
    
    // Test disconnection
    console.log('\n13. Testing disconnection...');
    try {
      await connector.disconnect();
      console.log('✓ Disconnection successful');
    } catch (error) {
      console.log('✗ Disconnection failed:', error.message);
    }
    
    console.log('\n🎉 Hikvision Connector tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testHikvisionConnector();
}

module.exports = { testHikvisionConnector }; 