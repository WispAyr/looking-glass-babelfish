#!/usr/bin/env node

/**
 * Comprehensive UniFi Protect Connector Test
 * Tests all features: authentication, real-time events, video streaming, and binary protocol
 */

const UnifiProtectConnector = require('./connectors/types/UnifiProtectConnector');

// Configuration for the communications van
const config = {
  id: 'communications-van-protect',
  type: 'unifi-protect',
  name: 'Communications Van UniFi Protect',
  description: 'UniFi Protect system in the communications van',
  config: {
    host: '10.0.0.1',
    port: 443,
    protocol: 'https',
    apiKey: 'wye3aapIuxAz2omKg4WFdCSncRBfSzPx', // Updated API key
    username: 'ewanrichardson@icloud.com',
    password: 'your-password-here', // Replace with valid password
    verifySSL: false,
    autoDiscovery: {
      enabled: true,
      refreshInterval: 300000,
      createEntities: true,
      subscribeToEvents: true,
      eventTypes: ['motion', 'smart', 'ring', 'recording', 'connection']
    }
  }
};

async function testUniFiProtect() {
  console.log('🚀 UniFi Protect Full Integration Test');
  console.log('Based on https://github.com/hjdhjd/unifi-protect\n');
  
  const connector = new UnifiProtectConnector(config);
  
  // Set up event listeners for real-time events
  connector.on('event:motion', (event) => {
    console.log('🎯 MOTION DETECTED:', {
      camera: event.motionData.cameraName,
      timestamp: event.motionData.timestamp,
      cameraId: event.motionData.cameraId
    });
  });
  
  connector.on('event:ring', (event) => {
    console.log('🔔 DOORBELL RING:', {
      camera: event.ringData.cameraName,
      timestamp: event.ringData.timestamp,
      cameraId: event.ringData.cameraId
    });
  });
  
  connector.on('event:smart', (event) => {
    console.log('🧠 SMART DETECTION:', {
      camera: event.smartData.cameraName,
      timestamp: event.smartData.timestamp,
      cameraId: event.smartData.cameraId
    });
  });
  
  connector.on('stream:started', (session) => {
    console.log('📹 STREAM STARTED:', {
      sessionId: session.id,
      cameraId: session.cameraId,
      format: session.format,
      quality: session.quality
    });
  });
  
  connector.on('stream:stopped', (session) => {
    console.log('⏹️ STREAM STOPPED:', {
      sessionId: session.id,
      cameraId: session.cameraId,
      duration: session.endTime - session.startTime
    });
  });
  
  connector.on('websocket:connected', () => {
    console.log('🔌 WebSocket connected - listening for real-time events');
  });
  
  connector.on('websocket:disconnected', (data) => {
    console.log('🔌 WebSocket disconnected:', data.reason);
  });
  
  try {
    // Test 1: Connect and authenticate
    console.log('🔐 Test 1: Connecting and authenticating...');
    await connector.connect();
    console.log('✅ Connection successful\n');
    
    // Test 2: List cameras
    console.log('📹 Test 2: Listing cameras...');
    const cameras = await connector.listCameras();
    console.log(`✅ Found ${cameras.length} cameras:`);
    cameras.forEach(camera => {
      console.log(`   - ${camera.name} (${camera.id}) - ${camera.state || 'unknown'}`);
    });
    console.log();
    
    if (cameras.length > 0) {
      const testCamera = cameras[0];
      
      // Test 3: Get camera details
      console.log(`📷 Test 3: Getting details for camera ${testCamera.name}...`);
      const cameraDetails = await connector.getCamera({ cameraId: testCamera.id });
      console.log('✅ Camera details:', {
        name: cameraDetails.name,
        model: cameraDetails.model,
        firmware: cameraDetails.firmware,
        capabilities: cameraDetails.capabilities
      });
      console.log();
      
      // Test 4: Get stream URL
      console.log('🎥 Test 4: Getting video stream URL...');
      try {
        const rtspUrl = await connector.getStreamUrl({
          cameraId: testCamera.id,
          quality: 'high',
          format: 'rtsp'
        });
        console.log('✅ RTSP Stream URL:', rtspUrl);
        
        const httpUrl = await connector.getStreamUrl({
          cameraId: testCamera.id,
          quality: 'medium',
          format: 'http',
          duration: 60
        });
        console.log('✅ HTTP Stream URL:', httpUrl);
      } catch (error) {
        console.log('⚠️ Stream URL test failed (may need valid credentials):', error.message);
      }
      console.log();
      
      // Test 5: Start video stream session
      console.log('🎬 Test 5: Starting video stream session...');
      try {
        const streamSession = await connector.startVideoStream({
          cameraId: testCamera.id,
          quality: 'medium',
          format: 'http',
          duration: 30
        });
        console.log('✅ Stream session started:', streamSession.id);
        
        // Stop stream after 5 seconds
        setTimeout(() => {
          connector.stopVideoStream(streamSession.id);
        }, 5000);
      } catch (error) {
        console.log('⚠️ Stream session test failed:', error.message);
      }
      console.log();
      
      // Test 6: Get camera snapshot
      console.log('📸 Test 6: Getting camera snapshot...');
      try {
        const snapshot = await connector.getCameraSnapshot({
          cameraId: testCamera.id,
          quality: 'high'
        });
        console.log('✅ Snapshot obtained, size:', snapshot.length, 'bytes');
      } catch (error) {
        console.log('⚠️ Snapshot test failed:', error.message);
      }
      console.log();
      
      // Test 7: Subscribe to events
      console.log('🔔 Test 7: Subscribing to events...');
      try {
        const motionSub = await connector.subscribeToMotionEvents({ cameraId: testCamera.id });
        console.log('✅ Motion events subscribed:', motionSub.subscriptionId);
        
        const smartSub = await connector.subscribeToSmartEvents({ 
          cameraId: testCamera.id,
          types: ['person', 'vehicle']
        });
        console.log('✅ Smart events subscribed:', smartSub.subscriptionId);
        
        const ringSub = await connector.subscribeToRingEvents({ cameraId: testCamera.id });
        console.log('✅ Ring events subscribed:', ringSub.subscriptionId);
        
        const realtimeSub = await connector.subscribeToRealtimeEvents({
          eventTypes: ['motion', 'smart', 'ring'],
          deviceIds: [testCamera.id]
        });
        console.log('✅ Real-time events subscribed:', realtimeSub.subscriptionId);
      } catch (error) {
        console.log('⚠️ Event subscription test failed:', error.message);
      }
      console.log();
      
      // Test 8: Get system info
      console.log('ℹ️ Test 8: Getting system information...');
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
      
      // Test 9: List recordings
      console.log('📼 Test 9: Listing recordings...');
      try {
        const recordings = await connector.listRecordings({
          cameraId: testCamera.id,
          limit: 5
        });
        console.log(`✅ Found ${recordings.length} recordings`);
        recordings.slice(0, 3).forEach(recording => {
          console.log(`   - ${recording.startTime} (${recording.type})`);
        });
      } catch (error) {
        console.log('⚠️ Recordings test failed:', error.message);
      }
      console.log();
    }
    
    // Test 10: Monitor real-time events
    console.log('👂 Test 10: Monitoring real-time events for 30 seconds...');
    console.log('   (Move in front of cameras or ring doorbells to see events)');
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
  
  console.log('\n✨ UniFi Protect integration test completed');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

// Run the test
testUniFiProtect().catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
}); 