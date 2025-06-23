
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
