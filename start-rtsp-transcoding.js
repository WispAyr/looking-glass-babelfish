#!/usr/bin/env node

const RTSPTranscodingService = require('./services/rtspTranscodingService');

async function startRTSPTranscoding() {
  console.log('🚀 Starting RTSP Transcoding Service with Auto-Detection...');
  
  const service = new RTSPTranscodingService();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down RTSP transcoding...');
    service.stopAll();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down RTSP transcoding...');
    service.stopAll();
    process.exit(0);
  });
  
  // Start transcoding for all discovered cameras
  await service.startAll();
  
  // Keep the process running
  console.log('⏳ RTSP transcoding service is running. Press Ctrl+C to stop.');
  
  // Status check and camera refresh every 30 seconds
  setInterval(async () => {
    const status = service.getStatus();
    console.log(`📊 Status: ${status.active}/${status.total} cameras active`);
    
    // Refresh camera discovery every 5 minutes
    if (Date.now() % 300000 < 30000) {
      await service.refreshCameras();
    }
  }, 30000);
}

startRTSPTranscoding().catch(console.error);
