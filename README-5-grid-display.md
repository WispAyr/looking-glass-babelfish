# 5-Grid Command Center Display System

A comprehensive multi-display system for command center environments with support for web interfaces and RTSP camera streams.

## 🎯 Overview

The 5-Grid Display System provides a flexible, real-time command center interface that can display:
- **Web-based interfaces** (ADSB radar, system status, maps, etc.)
- **RTSP camera streams** (via HLS transcoding)
- **Mixed mode** (combination of web and camera feeds)

## 📺 Display Layout

```
┌─────────────┬─────────────┬─────────────┐
│             │             │             │
│  Display 1  │  Display 2  │  Display 3  │
│ ADSB Radar  │Camera Grid  │System Status│
│             │   (3x3)     │             │
├─────────────┼─────────────┼─────────────┤
│             │             │             │
│  Display 4  │  Display 5  │             │
│  Map View   │   Alarms    │             │
│             │             │             │
└─────────────┴─────────────┴─────────────┘
```

## 🚀 Quick Start

### 1. Basic Web-Only Display
```bash
# Open the basic 5-grid display
node open-5-grid.js
```

### 2. RTSP-Compatible Display
```bash
# Set up RTSP transcoding
node setup-rtsp-transcoding.js

# Open RTSP-compatible display
node open-5-grid-rtsp.js
```

## 📋 Display Contents

### Display 1: ADSB Radar
- **Content**: Real-time aircraft tracking and radar visualization
- **URL**: `http://localhost:3000/radar`
- **Refresh**: Every 5 seconds
- **Features**: Aircraft positions, flight paths, emergency codes

### Display 2: Camera Grid
- **Content**: 3x3 grid of camera feeds
- **Web Mode**: UniFi Protect interface
- **RTSP Mode**: Live camera streams via HLS
- **Refresh**: Every 2 seconds
- **Features**: Motion detection, recording status

### Display 3: System Status
- **Content**: System health and connector status
- **URL**: `http://localhost:3000/system`
- **Refresh**: Every 10 seconds
- **Features**: Connector health, performance metrics

### Display 4: Map View
- **Content**: Interactive map with aircraft and APRS data
- **URL**: `http://localhost:3000/map.html`
- **Refresh**: Every 3 seconds
- **Features**: Aircraft positions, APRS stations, airspace

### Display 5: Alarm Dashboard
- **Content**: Alarm manager and notification center
- **URL**: `http://localhost:3000/alarms`
- **Refresh**: Every 1 second
- **Features**: Real-time alerts, notification history

## 🔧 RTSP Stream Support

### Prerequisites
- **FFmpeg** installed on your system
- **Camera credentials** configured
- **Network access** to RTSP streams

### Setup Process

1. **Install FFmpeg**:
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu
   sudo apt install ffmpeg
   
   # Windows
   # Download from https://ffmpeg.org/
   ```

2. **Configure Cameras**:
   ```bash
   # Edit the configuration file
   nano rtsp-transcoding-config.json
   ```

3. **Update Camera Credentials**:
   ```json
   {
     "cameras": [
       {
         "id": "camera-1",
         "name": "Front Door",
         "rtspUrl": "rtsp://username:password@192.168.1.100:554/stream1",
         "hlsPath": "/streams/camera-1.m3u8"
       }
     ]
   }
   ```

4. **Start Transcoding Service**:
   ```bash
   node start-rtsp-transcoding.js
   ```

### Supported Camera Systems

- **UniFi Protect**: RTSPS streams via API
- **Hikvision**: Standard RTSP streams
- **Ankke DVR**: RTSP streams
- **Generic RTSP**: Any standard RTSP camera

## 🎮 Controls

### Stream Type Selection
- **Web Interfaces**: Standard web pages
- **RTSP Streams**: Live camera feeds
- **Mixed Mode**: Web interfaces + camera grid

### Manual Controls
- **Refresh All**: Reload all displays
- **Auto Refresh**: Toggle automatic refresh (30s intervals)
- **Status**: Show connection status
- **Fullscreen**: Toggle fullscreen mode

### Keyboard Shortcuts
- `Ctrl+1`: Switch to web interfaces mode
- `Ctrl+2`: Switch to RTSP streams mode
- `Ctrl+3`: Switch to mixed mode
- `Ctrl+R`: Refresh all displays
- `F11`: Toggle fullscreen

## 🔌 API Integration

### Transcoding API Endpoints

```bash
# Get transcoding status
GET /api/transcoding/status

# Start all transcoding
POST /api/transcoding/start-all

# Stop all transcoding
POST /api/transcoding/stop-all

# Start individual camera
POST /api/transcoding/start/camera-1

# Stop individual camera
POST /api/transcoding/stop/camera-1
```

### Display Manager API

```bash
# Get display status
GET /display/api/status

# Get all displays
GET /display/api/displays

# Create display
POST /display/api/displays

# Activate display
POST /display/api/displays/{id}/activate
```

## 🛠️ Configuration

### Display Manager Configuration
```json
{
  "displayConfig": {
    "port": 3002,
    "host": "localhost",
    "baseUrl": "http://localhost:3002",
    "refreshInterval": 1000
  },
  "zoneConfig": {
    "enabled": true,
    "defaultZone": "main",
    "zones": ["main", "secondary", "emergency", "noc", "command", "operations"]
  }
}
```

### RTSP Transcoding Configuration
```json
{
  "cameras": [
    {
      "id": "camera-1",
      "name": "Front Door",
      "rtspUrl": "rtsp://username:password@192.168.1.100:554/stream1",
      "hlsPath": "/streams/camera-1.m3u8",
      "segmentDuration": 2,
      "quality": "high"
    }
  ]
}
```

## 🔍 Troubleshooting

### Common Issues

1. **RTSP Streams Not Loading**:
   - Check camera credentials
   - Verify network connectivity
   - Ensure FFmpeg is installed
   - Check transcoding service is running

2. **Web Interfaces Not Loading**:
   - Verify main server is running on port 3000
   - Check network connectivity
   - Review browser console for errors

3. **Performance Issues**:
   - Reduce refresh intervals
   - Lower video quality settings
   - Check system resources

### Debug Commands

```bash
# Check transcoding status
curl http://localhost:3000/api/transcoding/status

# Check display manager status
curl http://localhost:3002/api/status

# View transcoding logs
tail -f logs/transcoding.log

# Test RTSP stream
ffmpeg -i "rtsp://username:password@192.168.1.100:554/stream1" -t 10 test.mp4
```

## 📊 Performance Optimization

### Recommended Settings

- **Segment Duration**: 2-4 seconds for low latency
- **HLS List Size**: 5-10 segments for memory efficiency
- **Video Quality**: 720p for good balance of quality/performance
- **Refresh Intervals**: 1-5 seconds depending on content type

### Resource Requirements

- **CPU**: 2+ cores for transcoding
- **RAM**: 4GB+ for multiple streams
- **Network**: 100Mbps+ for multiple RTSP streams
- **Storage**: SSD recommended for HLS segments

## 🔐 Security Considerations

### Network Security
- Use VPN for remote camera access
- Implement firewall rules
- Use strong passwords for cameras
- Enable HTTPS for web interfaces

### Access Control
- Implement user authentication
- Use role-based access control
- Log all access attempts
- Regular security updates

## 🚀 Advanced Features

### Custom Displays
- Add new display types via configuration
- Custom templates for specific use cases
- Dynamic content loading
- Real-time data integration

### Automation
- Scheduled display changes
- Event-triggered layouts
- Automatic failover
- Health monitoring

### Integration
- MQTT event integration
- Telegram notifications
- Database logging
- External API connections

## 📝 Development

### Adding New Display Types

1. **Create Display Template**:
   ```javascript
   {
     id: 'custom-display',
     name: 'Custom Display',
     template: 'custom',
     content: {
       type: 'custom',
       url: 'http://localhost:3000/custom',
       refreshInterval: 5000
     }
   }
   ```

2. **Add to Configuration**:
   ```json
   {
     "displays": [
       {
         "id": "display-6",
         "name": "Custom Display",
         "template": "custom"
       }
     ]
   }
   ```

3. **Update Grid Layout**:
   ```css
   .grid-container {
     grid-template-columns: 1fr 1fr 1fr 1fr;
     grid-template-rows: 1fr 1fr;
   }
   ```

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review system logs
- Test individual components
- Verify network connectivity

## 📄 License

This project is part of the Looking Glass platform and follows the same licensing terms. 