#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function setupRTSPTranscoding() {
  console.log('🚀 Setting up RTSP Transcoding for 5-Grid Display...');
  
  // Check if ffmpeg is available
  try {
    const ffmpegCheck = spawn('ffmpeg', ['-version']);
    ffmpegCheck.on('close', (code) => {
      if (code === 0) {
        console.log('✅ FFmpeg is available');
        setupTranscodingServices();
      } else {
        console.log('❌ FFmpeg not found. Please install FFmpeg first.');
        console.log('   macOS: brew install ffmpeg');
        console.log('   Ubuntu: sudo apt install ffmpeg');
        console.log('   Windows: Download from https://ffmpeg.org/');
      }
    });
  } catch (error) {
    console.log('❌ FFmpeg not found. Please install FFmpeg first.');
  }
}

async function setupTranscodingServices() {
  console.log('📹 Setting up RTSP to HLS transcoding...');
  
  // Create streams directory
  const streamsDir = path.join(__dirname, 'public', 'streams');
  if (!fs.existsSync(streamsDir)) {
    fs.mkdirSync(streamsDir, { recursive: true });
    console.log('✅ Created streams directory');
  }
  
  // Create dynamic transcoding configuration that auto-detects cameras
  const transcodingConfig = {
    autoDetect: true,
    connectors: {
      unifiProtect: {
        enabled: true,
        connectors: ['unifi-protect-main'], // Add your UniFi connector IDs
        streamFormat: 'rtsps',
        quality: 'high'
      },
      hikvision: {
        enabled: true,
        connectors: [], // Will be auto-detected
        streamFormat: 'rtsp',
        quality: 'high'
      },
      ankkeDvr: {
        enabled: true,
        connectors: [], // Will be auto-detected
        streamFormat: 'rtsp',
        quality: 'high'
      }
    },
    cameras: [], // Will be populated dynamically
    segmentDuration: 2,
    hlsListSize: 5,
    maxConcurrentStreams: 16
  };
  
  // Save configuration
  const configPath = path.join(__dirname, 'rtsp-transcoding-config.json');
  fs.writeFileSync(configPath, JSON.stringify(transcodingConfig, null, 2));
  console.log('✅ Created RTSP transcoding configuration');
  
  // Create enhanced transcoding service with auto-detection
  const transcodingService = `
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class RTSPTranscodingService {
  constructor() {
    this.processes = new Map();
    this.config = this.loadConfig();
    this.connectorRegistry = null;
    this.cameraCache = new Map();
    this.lastDiscovery = 0;
    this.discoveryInterval = 30000; // 30 seconds
  }
  
  loadConfig() {
    try {
      const configPath = path.join(__dirname, 'rtsp-transcoding-config.json');
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('Failed to load RTSP transcoding config:', error);
      return { cameras: [], autoDetect: true };
    }
  }
  
  setConnectorRegistry(registry) {
    this.connectorRegistry = registry;
  }
  
  async discoverCameras() {
    if (!this.connectorRegistry) {
      console.log('No connector registry available for camera discovery');
      return [];
    }
    
    const now = Date.now();
    if (now - this.lastDiscovery < this.discoveryInterval) {
      return Array.from(this.cameraCache.values());
    }
    
    console.log('🔍 Discovering cameras from all connectors...');
    const cameras = [];
    
    // Discover from UniFi Protect connectors
    if (this.config.connectors.unifiProtect.enabled) {
      const unifiCameras = await this.discoverUnifiCameras();
      cameras.push(...unifiCameras);
    }
    
    // Discover from Hikvision connectors
    if (this.config.connectors.hikvision.enabled) {
      const hikvisionCameras = await this.discoverHikvisionCameras();
      cameras.push(...hikvisionCameras);
    }
    
    // Discover from Ankke DVR connectors
    if (this.config.connectors.ankkeDvr.enabled) {
      const ankkeCameras = await this.discoverAnkkeCameras();
      cameras.push(...ankkeCameras);
    }
    
    // Update cache
    this.cameraCache.clear();
    cameras.forEach(camera => {
      this.cameraCache.set(camera.id, camera);
    });
    
    this.lastDiscovery = now;
    console.log(\`✅ Discovered \${cameras.length} cameras total\`);
    
    return cameras;
  }
  
  async discoverUnifiCameras() {
    const cameras = [];
    
    for (const [connectorId, connector] of this.connectorRegistry.connectors.entries()) {
      if (connector.type === 'unifi-protect' && connector.isConnected) {
        try {
          console.log(\`🔍 Discovering cameras from UniFi Protect connector: \${connectorId}\`);
          const result = await connector.executeCapability('camera:management', 'list', {});
          
          if (result.success && result.cameras) {
            const unifiCameras = result.cameras.map(camera => ({
              id: \`unifi-\${camera.id}\`,
              name: camera.name || \`UniFi Camera \${camera.id}\`,
              connectorId: connectorId,
              connectorType: 'unifi-protect',
              cameraId: camera.id,
              streamFormat: 'rtsps',
              quality: this.config.connectors.unifiProtect.quality,
              hlsPath: \`/streams/unifi-\${camera.id}.m3u8\`,
              segmentDuration: this.config.segmentDuration,
              enabled: true,
              metadata: {
                type: camera.type,
                model: camera.model,
                hasLocation: camera.hasLocation,
                isMotionDetected: camera.isMotionDetected
              }
            }));
            
            cameras.push(...unifiCameras);
            console.log(\`✅ Found \${unifiCameras.length} UniFi cameras from \${connectorId}\`);
          }
        } catch (error) {
          console.error(\`❌ Failed to discover UniFi cameras from \${connectorId}:\`, error.message);
        }
      }
    }
    
    return cameras;
  }
  
  async discoverHikvisionCameras() {
    const cameras = [];
    
    for (const [connectorId, connector] of this.connectorRegistry.connectors.entries()) {
      if (connector.type === 'hikvision' && connector.isConnected) {
        try {
          console.log(\`🔍 Discovering cameras from Hikvision connector: \${connectorId}\`);
          const result = await connector.executeCapability('hikvision:camera', 'list', {});
          
          if (result && Array.isArray(result)) {
            const hikvisionCameras = result.map(camera => ({
              id: \`hikvision-\${connectorId}-\${camera.id}\`,
              name: camera.name || \`Hikvision Camera \${camera.id}\`,
              connectorId: connectorId,
              connectorType: 'hikvision',
              cameraId: camera.id,
              streamFormat: 'rtsp',
              quality: this.config.connectors.hikvision.quality,
              hlsPath: \`/streams/hikvision-\${connectorId}-\${camera.id}.m3u8\`,
              segmentDuration: this.config.segmentDuration,
              enabled: camera.enabled,
              metadata: {
                videoCodecType: camera.videoCodecType,
                videoResolutionWidth: camera.videoResolutionWidth,
                videoResolutionHeight: camera.videoResolutionHeight,
                videoFrameRate: camera.videoFrameRate
              }
            }));
            
            cameras.push(...hikvisionCameras);
            console.log(\`✅ Found \${hikvisionCameras.length} Hikvision cameras from \${connectorId}\`);
          }
        } catch (error) {
          console.error(\`❌ Failed to discover Hikvision cameras from \${connectorId}:\`, error.message);
        }
      }
    }
    
    return cameras;
  }
  
  async discoverAnkkeCameras() {
    const cameras = [];
    
    for (const [connectorId, connector] of this.connectorRegistry.connectors.entries()) {
      if (connector.type === 'ankke-dvr' && connector.isConnected) {
        try {
          console.log(\`🔍 Discovering cameras from Ankke DVR connector: \${connectorId}\`);
          const result = await connector.executeCapability('ankke:camera', 'list', {});
          
          if (result && Array.isArray(result)) {
            const ankkeCameras = result.map(camera => ({
              id: \`ankke-\${connectorId}-\${camera.channel}\`,
              name: camera.name || \`Ankke Camera \${camera.channel}\`,
              connectorId: connectorId,
              connectorType: 'ankke-dvr',
              cameraId: camera.channel,
              streamFormat: 'rtsp',
              quality: this.config.connectors.ankkeDvr.quality,
              hlsPath: \`/streams/ankke-\${connectorId}-\${camera.channel}.m3u8\`,
              segmentDuration: this.config.segmentDuration,
              enabled: camera.enabled,
              metadata: {
                type: camera.type,
                resolution: camera.resolution,
                fps: camera.fps,
                bitrate: camera.bitrate
              }
            }));
            
            cameras.push(...ankkeCameras);
            console.log(\`✅ Found \${ankkeCameras.length} Ankke cameras from \${connectorId}\`);
          }
        } catch (error) {
          console.error(\`❌ Failed to discover Ankke cameras from \${connectorId}:\`, error.message);
        }
      }
    }
    
    return cameras;
  }
  
  async getStreamUrl(camera) {
    try {
      const connector = this.connectorRegistry.getConnector(camera.connectorId);
      if (!connector) {
        throw new Error(\`Connector \${camera.connectorId} not found\`);
      }
      
      switch (camera.connectorType) {
        case 'unifi-protect':
          return await connector.executeCapability('camera:video:stream', 'read', {
            cameraId: camera.cameraId,
            quality: camera.quality,
            format: camera.streamFormat
          });
        
        case 'hikvision':
          return await connector.executeCapability('hikvision:stream', 'url', {
            channelId: camera.cameraId,
            streamType: 'main',
            protocol: 'rtsp'
          });
        
        case 'ankke-dvr':
          // Ankke DVR typically uses standard RTSP URLs
          const config = connector.config;
          return \`rtsp://\${config.username}:\${config.password}@\${config.host}:\${config.port}/cam/realmonitor?channel=\${camera.cameraId}&subtype=0\`;
        
        default:
          throw new Error(\`Unsupported connector type: \${camera.connectorType}\`);
      }
    } catch (error) {
      console.error(\`Failed to get stream URL for camera \${camera.id}:\`, error.message);
      throw error;
    }
  }
  
  async startTranscoding(cameraId) {
    const camera = this.cameraCache.get(cameraId);
    if (!camera) {
      console.error(\`Camera \${cameraId} not found in cache\`);
      return;
    }
    
    if (this.processes.has(cameraId)) {
      console.log(\`Transcoding already running for \${cameraId}\`);
      return;
    }
    
    if (!camera.enabled) {
      console.log(\`Camera \${cameraId} is disabled, skipping transcoding\`);
      return;
    }
    
    try {
      // Get stream URL from connector
      const streamUrl = await this.getStreamUrl(camera);
      
      const outputDir = path.join(__dirname, 'public', 'streams');
      const playlistPath = path.join(outputDir, \`\${cameraId}.m3u8\`);
      const segmentPath = path.join(outputDir, \`\${cameraId}_%03d.ts\`);
      
      const ffmpegArgs = [
        '-i', streamUrl,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-f', 'hls',
        '-hls_time', camera.segmentDuration.toString(),
        '-hls_list_size', this.config.hlsListSize.toString(),
        '-hls_flags', 'delete_segments',
        '-hls_segment_filename', segmentPath,
        playlistPath
      ];
      
      const process = spawn('ffmpeg', ffmpegArgs);
      
      process.stdout.on('data', (data) => {
        console.log(\`[\${cameraId}] FFmpeg: \${data}\`);
      });
      
      process.stderr.on('data', (data) => {
        console.log(\`[\${cameraId}] FFmpeg: \${data}\`);
      });
      
      process.on('close', (code) => {
        console.log(\`[\${cameraId}] FFmpeg process exited with code \${code}\`);
        this.processes.delete(cameraId);
      });
      
      process.on('error', (error) => {
        console.error(\`[\${cameraId}] FFmpeg error: \${error}\`);
        this.processes.delete(cameraId);
      });
      
      this.processes.set(cameraId, process);
      console.log(\`Started transcoding for \${cameraId} (\${camera.name})\`);
      
    } catch (error) {
      console.error(\`Failed to start transcoding for \${cameraId}:\`, error.message);
    }
  }
  
  async stopTranscoding(cameraId) {
    const process = this.processes.get(cameraId);
    if (process) {
      process.kill('SIGTERM');
      this.processes.delete(cameraId);
      console.log(\`Stopped transcoding for \${cameraId}\`);
    }
  }
  
  async startAll() {
    console.log('Starting RTSP transcoding for all discovered cameras...');
    const cameras = await this.discoverCameras();
    
    // Limit concurrent streams
    const activeCameras = cameras.filter(c => c.enabled).slice(0, this.config.maxConcurrentStreams);
    
    for (const camera of activeCameras) {
      await this.startTranscoding(camera.id);
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  async stopAll() {
    console.log('Stopping all RTSP transcoding...');
    this.processes.forEach((process, cameraId) => {
      this.stopTranscoding(cameraId);
    });
  }
  
  getStatus() {
    return {
      total: this.cameraCache.size,
      active: this.processes.size,
      cameras: Array.from(this.cameraCache.values()).map(camera => ({
        id: camera.id,
        name: camera.name,
        connectorType: camera.connectorType,
        enabled: camera.enabled,
        active: this.processes.has(camera.id)
      }))
    };
  }
  
  async refreshCameras() {
    console.log('Refreshing camera discovery...');
    await this.discoverCameras();
  }
}

module.exports = RTSPTranscodingService;
`;
  
  const servicePath = path.join(__dirname, 'services', 'rtspTranscodingService.js');
  fs.writeFileSync(servicePath, transcodingService);
  console.log('✅ Created enhanced RTSP transcoding service with auto-detection');
  
  // Create startup script
  const startupScript = `#!/usr/bin/env node

const RTSPTranscodingService = require('./services/rtspTranscodingService');

async function startRTSPTranscoding() {
  console.log('🚀 Starting RTSP Transcoding Service with Auto-Detection...');
  
  const service = new RTSPTranscodingService();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\\n🛑 Shutting down RTSP transcoding...');
    service.stopAll();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\\n🛑 Shutting down RTSP transcoding...');
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
    console.log(\`📊 Status: \${status.active}/\${status.total} cameras active\`);
    
    // Refresh camera discovery every 5 minutes
    if (Date.now() % 300000 < 30000) {
      await service.refreshCameras();
    }
  }, 30000);
}

startRTSPTranscoding().catch(console.error);
`;
  
  const startupPath = path.join(__dirname, 'start-rtsp-transcoding.js');
  fs.writeFileSync(startupPath, startupScript);
  fs.chmodSync(startupPath, '755');
  console.log('✅ Created RTSP transcoding startup script');
  
  // Create integration with main server
  const integrationCode = `
// Add to your main server.js or routes

const RTSPTranscodingService = require('./services/rtspTranscodingService');

// Initialize transcoding service
const transcodingService = new RTSPTranscodingService();

// Set connector registry when available
if (connectorRegistry) {
  transcodingService.setConnectorRegistry(connectorRegistry);
}

// Add routes for transcoding control
app.get('/api/transcoding/status', async (req, res) => {
  try {
    const status = transcodingService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/transcoding/cameras', async (req, res) => {
  try {
    const cameras = await transcodingService.discoverCameras();
    res.json({
      success: true,
      data: cameras,
      count: cameras.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/transcoding/start/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;
    await transcodingService.startTranscoding(cameraId);
    res.json({ 
      success: true, 
      message: \`Started transcoding for \${cameraId}\` 
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/transcoding/stop/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;
    transcodingService.stopTranscoding(cameraId);
    res.json({ 
      success: true, 
      message: \`Stopped transcoding for \${cameraId}\` 
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/transcoding/start-all', async (req, res) => {
  try {
    await transcodingService.startAll();
    res.json({ 
      success: true, 
      message: 'Started all transcoding' 
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/transcoding/stop-all', async (req, res) => {
  try {
    transcodingService.stopAll();
    res.json({ 
      success: true, 
      message: 'Stopped all transcoding' 
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/transcoding/refresh', async (req, res) => {
  try {
    await transcodingService.refreshCameras();
    res.json({ 
      success: true, 
      message: 'Camera discovery refreshed' 
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Serve HLS streams
app.use('/streams', express.static(path.join(__dirname, 'public', 'streams')));
`;
  
  const integrationPath = path.join(__dirname, 'rtsp-integration-example.js');
  fs.writeFileSync(integrationPath, integrationCode);
  console.log('✅ Created server integration example');
  
  console.log('\\n🎉 Enhanced RTSP Transcoding Setup Complete!');
  console.log('\\n📋 Features:');
  console.log('  ✅ Auto-detection of cameras from all connectors');
  console.log('  ✅ Support for UniFi Protect, Hikvision, and Ankke DVR');
  console.log('  ✅ Dynamic camera discovery and management');
  console.log('  ✅ Automatic stream URL generation');
  console.log('  ✅ Concurrent stream limiting');
  console.log('  ✅ Real-time status monitoring');
  console.log('\\n📋 Next Steps:');
  console.log('1. Add the integration code to your main server');
  console.log('2. Start transcoding: node start-rtsp-transcoding.js');
  console.log('3. Open 5-grid-display-rtsp.html in your browser');
  console.log('\\n🔧 API Endpoints:');
  console.log('  • GET /api/transcoding/status - Get transcoding status');
  console.log('  • GET /api/transcoding/cameras - List discovered cameras');
  console.log('  • POST /api/transcoding/start-all - Start all transcoding');
  console.log('  • POST /api/transcoding/stop-all - Stop all transcoding');
  console.log('  • POST /api/transcoding/refresh - Refresh camera discovery');
  console.log('\\n💡 The system will automatically detect and use all your active cameras!');
}

setupRTSPTranscoding().catch(console.error); 