#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function open5GridRTSP() {
  console.log('🚀 Opening 5-Grid Command Center Display (RTSP Compatible)...');
  
  const htmlPath = path.join(__dirname, '5-grid-display-rtsp.html');
  
  // Check if the HTML file exists
  if (!fs.existsSync(htmlPath)) {
    console.error('❌ 5-grid-display-rtsp.html not found!');
    console.log('Creating the file...');
    
    // Create the HTML content (simplified version)
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>5-Grid Command Center Display (RTSP Compatible)</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #000;
            color: #fff;
            height: 100vh;
            overflow: hidden;
        }

        .grid-container {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 10px;
            height: 100vh;
            padding: 10px;
        }

        .display-frame {
            background: #1a1a1a;
            border: 2px solid #333;
            border-radius: 8px;
            position: relative;
            overflow: hidden;
            transition: all 0.3s ease;
        }

        .display-frame:hover {
            border-color: #00ff00;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        }

        .display-frame iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: #000;
        }

        .display-frame video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            background: #000;
        }

        .display-label {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #00ff00;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            z-index: 10;
        }

        .display-status {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ff0000;
            z-index: 10;
        }

        .display-status.online {
            background: #00ff00;
        }

        .display-status.loading {
            background: #ffff00;
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

        .controls {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #333;
            z-index: 100;
        }

        .controls button {
            background: #333;
            color: #fff;
            border: 1px solid #555;
            padding: 8px 12px;
            margin: 2px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }

        .controls button:hover {
            background: #555;
        }

        .controls button.active {
            background: #00ff00;
            color: #000;
        }

        .stream-selector {
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.8);
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #333;
            z-index: 100;
            max-width: 300px;
        }

        .stream-selector h3 {
            color: #00ff00;
            margin-bottom: 10px;
            font-size: 14px;
        }

        .stream-selector select {
            background: #333;
            color: #fff;
            border: 1px solid #555;
            padding: 5px;
            border-radius: 4px;
            width: 100%;
            margin-bottom: 5px;
        }

        .stream-selector button {
            background: #00ff00;
            color: #000;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            width: 100%;
        }

        .loading-message {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #00ff00;
            font-size: 18px;
            text-align: center;
        }

        .error-message {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #ff0000;
            font-size: 14px;
            text-align: center;
            background: rgba(255, 0, 0, 0.1);
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #ff0000;
        }

        .camera-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            gap: 2px;
            height: 100%;
        }

        .camera-cell {
            background: #000;
            border: 1px solid #333;
            position: relative;
            overflow: hidden;
        }

        .camera-cell video {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .camera-label {
            position: absolute;
            bottom: 5px;
            left: 5px;
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 2px 6px;
            border-radius: 2px;
            font-size: 10px;
        }
    </style>
</head>
<body>
    <div class="stream-selector">
        <h3>Stream Configuration</h3>
        <select id="streamType">
            <option value="web">Web Interfaces</option>
            <option value="rtsp">RTSP Streams</option>
            <option value="mixed">Mixed (Web + RTSP)</option>
        </select>
        <button onclick="applyStreamType()">Apply</button>
    </div>

    <div class="controls">
        <button onclick="refreshAll()">Refresh All</button>
        <button onclick="toggleAutoRefresh()" id="autoRefreshBtn">Auto Refresh</button>
        <button onclick="showStatus()">Status</button>
        <button onclick="toggleFullscreen()">Fullscreen</button>
    </div>

    <div class="grid-container">
        <!-- Display 1: ADSB Radar -->
        <div class="display-frame" id="display-1">
            <div class="display-label">ADSB Radar</div>
            <div class="display-status loading" id="status-1"></div>
            <iframe src="http://localhost:3000/radar" 
                    onload="setStatus('1', 'online')" 
                    onerror="setStatus('1', 'error')"
                    id="iframe-1"></iframe>
            <video id="video-1" style="display: none;" autoplay muted></video>
            <div class="loading-message" id="loading-1">Loading ADSB Radar...</div>
            <div class="error-message" id="error-1" style="display: none;">Failed to load ADSB Radar</div>
        </div>

        <!-- Display 2: Camera Grid -->
        <div class="display-frame" id="display-2">
            <div class="display-label">Camera Grid</div>
            <div class="display-status loading" id="status-2"></div>
            <iframe src="http://localhost:3000/unifi" 
                    onload="setStatus('2', 'online')" 
                    onerror="setStatus('2', 'error')"
                    id="iframe-2"></iframe>
            <div class="camera-grid" id="camera-grid-2" style="display: none;">
                <!-- Camera cells will be populated dynamically -->
            </div>
            <div class="loading-message" id="loading-2">Loading Camera Grid...</div>
            <div class="error-message" id="error-2" style="display: none;">Failed to load Camera Grid</div>
        </div>

        <!-- Display 3: System Status -->
        <div class="display-frame" id="display-3">
            <div class="display-label">System Status</div>
            <div class="display-status loading" id="status-3"></div>
            <iframe src="http://localhost:3000/system" 
                    onload="setStatus('3', 'online')" 
                    onerror="setStatus('3', 'error')"
                    id="iframe-3"></iframe>
            <video id="video-3" style="display: none;" autoplay muted></video>
            <div class="loading-message" id="loading-3">Loading System Status...</div>
            <div class="error-message" id="error-3" style="display: none;">Failed to load System Status</div>
        </div>

        <!-- Display 4: Map View -->
        <div class="display-frame" id="display-4">
            <div class="display-label">Map View</div>
            <div class="display-status loading" id="status-4"></div>
            <iframe src="http://localhost:3000/map.html" 
                    onload="setStatus('4', 'online')" 
                    onerror="setStatus('4', 'error')"
                    id="iframe-4"></iframe>
            <video id="video-4" style="display: none;" autoplay muted></video>
            <div class="loading-message" id="loading-4">Loading Map View...</div>
            <div class="error-message" id="error-4" style="display: none;">Failed to load Map View</div>
        </div>

        <!-- Display 5: Alarm Dashboard -->
        <div class="display-frame" id="display-5">
            <div class="display-label">Alarm Dashboard</div>
            <div class="display-status loading" id="status-5"></div>
            <iframe src="http://localhost:3000/alarms" 
                    onload="setStatus('5', 'online')" 
                    onerror="setStatus('5', 'error')"
                    id="iframe-5"></iframe>
            <video id="video-5" style="display: none;" autoplay muted></video>
            <div class="loading-message" id="loading-5">Loading Alarm Dashboard...</div>
            <div class="error-message" id="error-5" style="display: none;">Failed to load Alarm Dashboard</div>
        </div>
    </div>

    <script>
        let autoRefreshInterval = null;
        let autoRefreshEnabled = false;
        let currentStreamType = 'web';

        function setStatus(displayId, status) {
            const statusElement = document.getElementById(\`status-\${displayId}\`);
            const loadingElement = document.getElementById(\`loading-\${displayId}\`);
            const errorElement = document.getElementById(\`error-\${displayId}\`);
            
            statusElement.className = \`display-status \${status}\`;
            
            if (status === 'online') {
                loadingElement.style.display = 'none';
                errorElement.style.display = 'none';
            } else if (status === 'error') {
                loadingElement.style.display = 'none';
                errorElement.style.display = 'block';
            }
        }

        function applyStreamType() {
            const streamType = document.getElementById('streamType').value;
            currentStreamType = streamType;
            
            switch(streamType) {
                case 'web':
                    showWebInterfaces();
                    break;
                case 'rtsp':
                    showRTSPStreams();
                    break;
                case 'mixed':
                    showMixedStreams();
                    break;
            }
        }

        function showWebInterfaces() {
            for (let i = 1; i <= 5; i++) {
                const iframe = document.getElementById(\`iframe-\${i}\`);
                const video = document.getElementById(\`video-\${i}\`);
                const cameraGrid = document.getElementById(\`camera-grid-\${i}\`);
                
                if (iframe) iframe.style.display = 'block';
                if (video) video.style.display = 'none';
                if (cameraGrid) cameraGrid.style.display = 'none';
            }
        }

        function showRTSPStreams() {
            for (let i = 1; i <= 5; i++) {
                const iframe = document.getElementById(\`iframe-\${i}\`);
                const video = document.getElementById(\`video-\${i}\`);
                const cameraGrid = document.getElementById(\`camera-grid-\${i}\`);
                
                if (iframe) iframe.style.display = 'none';
                
                if (i === 2) {
                    if (cameraGrid) {
                        cameraGrid.style.display = 'grid';
                        loadCameraGrid();
                    }
                } else {
                    if (video) {
                        video.style.display = 'block';
                        loadRTSPStream(i);
                    }
                }
            }
        }

        function showMixedStreams() {
            showWebInterfaces();
            
            const iframe2 = document.getElementById('iframe-2');
            const cameraGrid2 = document.getElementById('camera-grid-2');
            
            if (iframe2) iframe2.style.display = 'none';
            if (cameraGrid2) {
                cameraGrid2.style.display = 'grid';
                loadCameraGrid();
            }
        }

        function loadCameraGrid() {
            const cameraGrid = document.getElementById('camera-grid-2');
            if (!cameraGrid) return;
            
            cameraGrid.innerHTML = '';
            
            const cameras = [
                { id: 'camera-1', name: 'Front Door', url: 'http://localhost:3000/streams/camera-1.m3u8' },
                { id: 'camera-2', name: 'Back Yard', url: 'http://localhost:3000/streams/camera-2.m3u8' },
                { id: 'camera-3', name: 'Driveway', url: 'http://localhost:3000/streams/camera-3.m3u8' },
                { id: 'camera-4', name: 'Side Gate', url: 'http://localhost:3000/streams/camera-4.m3u8' },
                { id: 'camera-5', name: 'Garage', url: 'http://localhost:3000/streams/camera-5.m3u8' },
                { id: 'camera-6', name: 'Pool Area', url: 'http://localhost:3000/streams/camera-6.m3u8' },
                { id: 'camera-7', name: 'Patio', url: 'http://localhost:3000/streams/camera-7.m3u8' },
                { id: 'camera-8', name: 'Garden', url: 'http://localhost:3000/streams/camera-8.m3u8' },
                { id: 'camera-9', name: 'Entrance', url: 'http://localhost:3000/streams/camera-9.m3u8' }
            ];
            
            cameras.forEach((camera, index) => {
                const cell = document.createElement('div');
                cell.className = 'camera-cell';
                
                const video = document.createElement('video');
                video.autoplay = true;
                video.muted = true;
                video.playsInline = true;
                
                const label = document.createElement('div');
                label.className = 'camera-label';
                label.textContent = camera.name;
                
                cell.appendChild(video);
                cell.appendChild(label);
                cameraGrid.appendChild(cell);
                
                loadHLSStream(video, camera.url);
            });
        }

        function loadRTSPStream(displayId) {
            const video = document.getElementById(\`video-\${displayId}\`);
            if (!video) return;
            
            const cameras = [
                'http://localhost:3000/streams/camera-1.m3u8',
                'http://localhost:3000/streams/camera-2.m3u8',
                'http://localhost:3000/streams/camera-3.m3u8',
                'http://localhost:3000/streams/camera-4.m3u8',
                'http://localhost:3000/streams/camera-5.m3u8'
            ];
            
            const cameraIndex = displayId - 1;
            const hlsUrl = cameras[cameraIndex] || cameras[0];
            
            loadHLSStream(video, hlsUrl);
        }

        function loadHLSStream(videoElement, hlsUrl) {
            if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(hlsUrl);
                hls.attachMedia(videoElement);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoElement.play();
                });
                hls.on(Hls.Events.ERROR, (event, data) => {
                    console.error('HLS Error:', data);
                    videoElement.style.display = 'none';
                });
            } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                videoElement.src = hlsUrl;
                videoElement.addEventListener('loadedmetadata', () => {
                    videoElement.play();
                });
            } else {
                console.error('HLS not supported');
                videoElement.style.display = 'none';
            }
        }

        function refreshAll() {
            if (currentStreamType === 'web') {
                for (let i = 1; i <= 5; i++) {
                    const iframe = document.getElementById(\`iframe-\${i}\`);
                    if (iframe) {
                        iframe.src = iframe.src;
                        setStatus(i.toString(), 'loading');
                    }
                }
            } else if (currentStreamType === 'rtsp') {
                loadCameraGrid();
                for (let i = 1; i <= 5; i++) {
                    if (i !== 2) {
                        const video = document.getElementById(\`video-\${i}\`);
                        if (video) {
                            loadRTSPStream(i);
                        }
                    }
                }
            }
        }

        function toggleAutoRefresh() {
            const btn = document.getElementById('autoRefreshBtn');
            
            if (autoRefreshEnabled) {
                if (autoRefreshInterval) {
                    clearInterval(autoRefreshInterval);
                    autoRefreshInterval = null;
                }
                autoRefreshEnabled = false;
                btn.textContent = 'Auto Refresh';
                btn.classList.remove('active');
            } else {
                autoRefreshInterval = setInterval(refreshAll, 30000);
                autoRefreshEnabled = true;
                btn.textContent = 'Stop Auto';
                btn.classList.add('active');
            }
        }

        function toggleFullscreen() {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen();
            }
        }

        function showStatus() {
            const statuses = [];
            for (let i = 1; i <= 5; i++) {
                const statusElement = document.getElementById(\`status-\${i}\`);
                const status = statusElement.classList.contains('online') ? 'Online' : 
                             statusElement.classList.contains('loading') ? 'Loading' : 'Error';
                statuses.push(\`Display \${i}: \${status}\`);
            }
            statuses.push(\`Stream Type: \${currentStreamType.toUpperCase()}\`);
            alert('Display Status:\\n' + statuses.join('\\n'));
        }

        // Load HLS.js library
        function loadHLSJS() {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
            script.onload = () => {
                console.log('HLS.js loaded successfully');
                setTimeout(applyStreamType, 1000);
            };
            script.onerror = () => {
                console.error('Failed to load HLS.js');
                currentStreamType = 'web';
                showWebInterfaces();
            };
            document.head.appendChild(script);
        }

        document.addEventListener('DOMContentLoaded', () => {
            loadHLSJS();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'F11':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'r':
                case 'R':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        refreshAll();
                    }
                    break;
                case '1':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        document.getElementById('streamType').value = 'web';
                        applyStreamType();
                    }
                    break;
                case '2':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        document.getElementById('streamType').value = 'rtsp';
                        applyStreamType();
                    }
                    break;
                case '3':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        document.getElementById('streamType').value = 'mixed';
                        applyStreamType();
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
    
    fs.writeFileSync(htmlPath, htmlContent);
    console.log('✅ Created 5-grid-display-rtsp.html');
  }
  
  // Open the HTML file in the default browser
  const platform = process.platform;
  let command;
  
  switch (platform) {
    case 'darwin': // macOS
      command = 'open';
      break;
    case 'win32': // Windows
      command = 'start';
      break;
    default: // Linux
      command = 'xdg-open';
      break;
  }
  
  try {
    spawn(command, [htmlPath]);
    console.log('✅ Opened 5-Grid Display (RTSP Compatible) in browser');
    console.log('\n📱 5-Grid Command Center with RTSP Support is now active!');
    console.log('\n🎯 Displays:');
    console.log('  1. ADSB Radar - Aircraft tracking and radar view');
    console.log('  2. Camera Grid - RTSP camera feeds (3x3 grid)');
    console.log('  3. System Status - System health and connector status');
    console.log('  4. Map View - Interactive map with aircraft and APRS');
    console.log('  5. Alarm Dashboard - Alarm manager and notifications');
    console.log('\n🔧 Stream Types:');
    console.log('  • Web Interfaces - Standard web pages');
    console.log('  • RTSP Streams - Live camera feeds via HLS');
    console.log('  • Mixed Mode - Web interfaces + camera grid');
    console.log('\n🔧 Controls:');
    console.log('  • Stream Selector - Choose display mode');
    console.log('  • Refresh All - Reload all displays');
    console.log('  • Auto Refresh - Toggle automatic refresh');
    console.log('  • Status - Show connection status');
    console.log('\n💡 RTSP Setup:');
    console.log('  • Run: node setup-rtsp-transcoding.js');
    console.log('  • Update camera credentials in config');
    console.log('  • Start transcoding service');
    console.log('\n⌨️  Keyboard Shortcuts:');
    console.log('  • Ctrl+1 - Web interfaces mode');
    console.log('  • Ctrl+2 - RTSP streams mode');
    console.log('  • Ctrl+3 - Mixed mode');
    console.log('  • Ctrl+R - Refresh all displays');
    console.log('  • F11 - Toggle fullscreen');
    
  } catch (error) {
    console.error('❌ Failed to open browser:', error.message);
    console.log('\n💡 You can manually open the file:');
    console.log(`   ${htmlPath}`);
  }
}

// Run the script
open5GridRTSP().catch(console.error); 