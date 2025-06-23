#!/usr/bin/env node

const { spawn } = require('child_process');

// Free port 3002 before starting
async function freePort(port) {
  return new Promise((resolve) => {
    const lsof = spawn('lsof', ['-ti', port]);
    let pids = '';
    
    lsof.stdout.on('data', (data) => {
      pids += data.toString();
    });
    
    lsof.on('close', () => {
      if (pids.trim()) {
        const kill = spawn('kill', ['-9', ...pids.trim().split('\n')]);
        kill.on('close', () => {
          console.log(`Freed port ${port}`);
          resolve();
        });
      } else {
        console.log(`Port ${port} is already free`);
        resolve();
      }
    });
  });
}

async function setup5GridSimple() {
  console.log('🚀 Setting up 5-Grid Display System (Simple)...');
  
  // Free port first
  await freePort(3002);
  
  // Import the display manager connector
  const DisplayManagerConnector = require('./connectors/types/DisplayManagerConnector');
  
  // Create display manager instance
  const displayManager = new DisplayManagerConnector({
    id: 'display-manager-main',
    displayConfig: {
      port: 3002,
      host: 'localhost',
      baseUrl: 'http://localhost:3002',
      refreshInterval: 1000
    },
    zoneConfig: {
      enabled: true,
      defaultZone: 'main',
      zones: ['main', 'secondary', 'emergency', 'noc', 'command', 'operations']
    }
  });
  
  try {
    // Connect to display manager
    await displayManager.performConnect();
    console.log('✅ Connected to Display Manager on port 3002');
    
    // Create 5 displays
    const displays = [
      {
        id: 'display-1',
        name: 'ADSB Radar',
        description: 'Primary ADSB radar display',
        zone: 'main',
        template: 'radar',
        content: {
          type: 'radar',
          url: 'http://localhost:3000/radar',
          refreshInterval: 5000
        }
      },
      {
        id: 'display-2', 
        name: 'Camera Grid',
        description: 'UniFi Protect camera grid',
        zone: 'secondary',
        template: 'camera-grid',
        content: {
          type: 'camera-grid',
          url: 'http://localhost:3000/unifi',
          refreshInterval: 2000
        }
      },
      {
        id: 'display-3',
        name: 'System Status',
        description: 'System health and connector status',
        zone: 'noc',
        template: 'system-status',
        content: {
          type: 'system-status',
          url: 'http://localhost:3000/system',
          refreshInterval: 10000
        }
      },
      {
        id: 'display-4',
        name: 'Map View',
        description: 'Interactive map with aircraft and APRS',
        zone: 'operations',
        template: 'map',
        content: {
          type: 'map',
          url: 'http://localhost:3000/map.html',
          refreshInterval: 3000
        }
      },
      {
        id: 'display-5',
        name: 'Alarm Dashboard',
        description: 'Alarm manager and notification center',
        zone: 'emergency',
        template: 'alarm-dashboard',
        content: {
          type: 'alarm-dashboard',
          url: 'http://localhost:3000/alarms',
          refreshInterval: 1000
        }
      }
    ];
    
    console.log('📺 Creating 5 grid displays...');
    
    // Create each display
    for (const display of displays) {
      console.log(`Creating ${display.name}...`);
      
      await displayManager.executeCapability('display:management', 'create', {
        displayId: display.id,
        content: {
          name: display.name,
          description: display.description,
          zone: display.zone,
          template: display.template,
          url: display.content.url,
          refreshInterval: display.content.refreshInterval
        }
      });
      
      // Activate the display
      await displayManager.executeCapability('display:management', 'activate', {
        displayId: display.id
      });
      
      console.log(`✅ ${display.name} created and activated`);
    }
    
    // Get display manager status
    const status = displayManager.getDisplayManagerStatus();
    console.log('\n📊 Display Manager Status:');
    console.log(`Active Displays: ${status.activeDisplays}`);
    console.log(`Total Views: ${status.totalViews}`);
    console.log(`WebSocket Connections: ${status.websocketConnections}`);
    
    console.log('\n🎉 5-Grid Display System Setup Complete!');
    console.log('\n📱 Access your displays:');
    console.log('• Display Manager GUI: http://localhost:3002/manager');
    console.log('• Individual Displays:');
    displays.forEach((display, index) => {
      console.log(`  ${index + 1}. ${display.name}: http://localhost:3002/display/${display.id}`);
    });
    
    console.log('\n🔧 Management:');
    console.log('• View all displays: http://localhost:3002/manager');
    console.log('• API Status: http://localhost:3002/api/status');
    console.log('• API Displays: http://localhost:3002/api/displays');
    
    // Keep the process running
    console.log('\n⏳ Display manager is running on port 3002. Press Ctrl+C to stop.');
    
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down display manager...');
      await displayManager.performDisconnect();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error setting up displays:', error);
    process.exit(1);
  }
}

// Run the setup
setup5GridSimple().catch(console.error); 