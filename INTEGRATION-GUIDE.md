# RTSP Transcoding Integration Guide

This guide shows how to integrate the enhanced RTSP transcoding service with your main Looking Glass server.

## 🚀 Quick Integration

### 1. Add to your main `server.js`

Add this code to your main server file:

```javascript
// Add near the top with other requires
const RTSPTranscodingService = require('./services/rtspTranscodingService');

// Add after connector registry initialization
const transcodingService = new RTSPTranscodingService();

// Set connector registry when available
if (connectorRegistry) {
  transcodingService.setConnectorRegistry(connectorRegistry);
}

// Add these routes to your Express app
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
      message: `Started transcoding for ${cameraId}` 
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
      message: `Stopped transcoding for ${cameraId}` 
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
```

### 2. Start the transcoding service

```bash
# Start transcoding service
node start-rtsp-transcoding.js
```

### 3. Open the 5-grid display

```bash
# Open the enhanced display
node open-5-grid-rtsp.js
```

## 🔧 Configuration

### Camera Auto-Detection

The system automatically detects cameras from:
- **UniFi Protect connectors** - Uses RTSPS streams
- **Hikvision connectors** - Uses RTSP streams  
- **Ankke DVR connectors** - Uses RTSP streams

### Configuration File

Edit `rtsp-transcoding-config.json` to customize:

```json
{
  "autoDetect": true,
  "connectors": {
    "unifiProtect": {
      "enabled": true,
      "connectors": ["unifi-protect-main"],
      "streamFormat": "rtsps",
      "quality": "high"
    },
    "hikvision": {
      "enabled": true,
      "connectors": [],
      "streamFormat": "rtsp",
      "quality": "high"
    },
    "ankkeDvr": {
      "enabled": true,
      "connectors": [],
      "streamFormat": "rtsp",
      "quality": "high"
    }
  },
  "segmentDuration": 2,
  "hlsListSize": 5,
  "maxConcurrentStreams": 16
}
```

## 📊 API Endpoints

### Get Transcoding Status
```bash
GET /api/transcoding/status
```

### List Discovered Cameras
```bash
GET /api/transcoding/cameras
```

### Start All Transcoding
```bash
POST /api/transcoding/start-all
```

### Stop All Transcoding
```bash
POST /api/transcoding/stop-all
```

### Start Individual Camera
```bash
POST /api/transcoding/start/{cameraId}
```

### Stop Individual Camera
```bash
POST /api/transcoding/stop/{cameraId}
```

### Refresh Camera Discovery
```bash
POST /api/transcoding/refresh
```

## 🎯 Features

### Auto-Detection
- Automatically discovers cameras from all connected connectors
- Supports UniFi Protect, Hikvision, and Ankke DVR systems
- Real-time camera status monitoring

### Dynamic Management
- Start/stop individual camera transcoding
- Concurrent stream limiting (16 streams max)
- Automatic stream URL generation

### Real-time Monitoring
- Live camera status display
- Transcoding process monitoring
- Error handling and recovery

### Browser Compatibility
- HLS.js for modern browsers
- Native HLS support for Safari
- Fallback handling for unsupported browsers

## 🔍 Troubleshooting

### Common Issues

1. **No cameras discovered**
   - Check connector connections
   - Verify camera credentials
   - Review connector logs

2. **Streams not loading**
   - Ensure FFmpeg is installed
   - Check transcoding service is running
   - Verify network connectivity

3. **Performance issues**
   - Reduce concurrent streams
   - Lower video quality settings
   - Check system resources

### Debug Commands

```bash
# Check transcoding status
curl http://localhost:3000/api/transcoding/status

# List discovered cameras
curl http://localhost:3000/api/transcoding/cameras

# Start all transcoding
curl -X POST http://localhost:3000/api/transcoding/start-all

# Check FFmpeg installation
ffmpeg -version
```

## 🚀 Usage

1. **Start your main server** with the integration code
2. **Start transcoding service**: `node start-rtsp-transcoding.js`
3. **Open 5-grid display**: `node open-5-grid-rtsp.js`
4. **Select RTSP mode** in the display controls
5. **Monitor camera status** in the bottom-left panel

The system will automatically detect and display all your active cameras! 