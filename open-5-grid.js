#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function open5GridDisplay() {
  console.log('🚀 Opening 5-Grid Command Center Display...');
  
  const htmlPath = path.join(__dirname, '5-grid-display.html');
  
  // Check if the HTML file exists
  if (!fs.existsSync(htmlPath)) {
    console.error('❌ 5-grid-display.html not found!');
    console.log('Creating the file...');
    
    // Create the HTML content
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>5-Grid Command Center Display</title>
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
    </style>
</head>
<body>
    <div class="controls">
        <button onclick="refreshAll()">Refresh All</button>
        <button onclick="toggleAutoRefresh()" id="autoRefreshBtn">Auto Refresh</button>
        <button onclick="showStatus()">Status</button>
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
            <div class="loading-message" id="loading-5">Loading Alarm Dashboard...</div>
            <div class="error-message" id="error-5" style="display: none;">Failed to load Alarm Dashboard</div>
        </div>
    </div>

    <script>
        let autoRefreshInterval = null;
        let autoRefreshEnabled = false;

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

        function refreshAll() {
            for (let i = 1; i <= 5; i++) {
                const iframe = document.getElementById(\`iframe-\${i}\`);
                if (iframe) {
                    iframe.src = iframe.src;
                    setStatus(i.toString(), 'loading');
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
                autoRefreshInterval = setInterval(refreshAll, 30000); // Refresh every 30 seconds
                autoRefreshEnabled = true;
                btn.textContent = 'Stop Auto';
                btn.classList.add('active');
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
            alert('Display Status:\\n' + statuses.join('\\n'));
        }

        // Auto-refresh on page load
        setTimeout(() => {
            const onlineCount = document.querySelectorAll('.display-status.online').length;
            if (onlineCount < 5) {
                console.log(\`Only \${onlineCount}/5 displays loaded successfully. Consider refreshing.\`);
            }
        }, 5000);
    </script>
</body>
</html>`;
    
    fs.writeFileSync(htmlPath, htmlContent);
    console.log('✅ Created 5-grid-display.html');
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
    console.log('✅ Opened 5-Grid Display in browser');
    console.log('\n📱 5-Grid Command Center is now active!');
    console.log('\n🎯 Displays:');
    console.log('  1. ADSB Radar - Aircraft tracking and radar view');
    console.log('  2. Camera Grid - UniFi Protect camera feeds');
    console.log('  3. System Status - System health and connector status');
    console.log('  4. Map View - Interactive map with aircraft and APRS');
    console.log('  5. Alarm Dashboard - Alarm manager and notifications');
    console.log('\n🔧 Controls:');
    console.log('  • Refresh All - Reload all displays');
    console.log('  • Auto Refresh - Toggle automatic refresh every 30 seconds');
    console.log('  • Status - Show connection status of all displays');
    console.log('\n💡 Tips:');
    console.log('  • Make sure the main server is running on port 3000');
    console.log('  • Double-click any display to open it fullscreen');
    console.log('  • Use Ctrl+R to refresh all displays');
    
  } catch (error) {
    console.error('❌ Failed to open browser:', error.message);
    console.log('\n💡 You can manually open the file:');
    console.log(`   ${htmlPath}`);
  }
}

// Run the script
open5GridDisplay().catch(console.error); 