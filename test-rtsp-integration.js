#!/usr/bin/env node

const RTSPTranscodingService = require('./services/rtspTranscodingService');

async function testRTSPIntegration() {
  console.log('🧪 Testing RTSP Transcoding Integration...');
  
  try {
    // Create transcoding service
    const transcodingService = new RTSPTranscodingService();
    console.log('✅ RTSP transcoding service created');
    
    // Test status method
    const status = transcodingService.getStatus();
    console.log('✅ Status method works:', status);
    
    // Test camera discovery (without connector registry)
    const cameras = await transcodingService.discoverCameras();
    console.log('✅ Camera discovery works:', cameras.length, 'cameras found');
    
    console.log('\n🎉 RTSP Integration Test Passed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Start your main server: node server.js');
    console.log('2. Test the API: curl http://localhost:3000/api/transcoding/status');
    console.log('3. Open 5-grid display: node open-5-grid-rtsp.js');
    
  } catch (error) {
    console.error('❌ RTSP Integration Test Failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testRTSPIntegration().catch(console.error); 