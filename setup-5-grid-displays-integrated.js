#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Free port 3000 before starting
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

async function setup5GridDisplaysIntegrated() {
  console.log('🚀 Setting up 5-Grid Display System (Integrated)...');
  
  // Free port first
  await freePort(3000);
  
  // Import the display manager connector
  const DisplayManagerConnector = require('./connectors/types/DisplayManagerConnector');
  
  // Create display manager instance with integration mode
  const displayManager = new DisplayManagerConnector({
    id: 'display-manager-main',
    displayConfig: {
      port: 3000,
      host: 'localhost',
      baseUrl: 'http://localhost:3000',
      refreshInterval: 1000,
      integrated: true // This will prevent creating its own server
    },
    zoneConfig: {
      enabled: true,
      defaultZone: 'main',
      zones: ['main', 'secondary', 'emergency', 'noc', 'command', 'operations']
    }
  });
  
  try {
    // Connect to display manager (this will integrate with main server)
    await displayManager.performConnect();
    console.log('✅ Connected to Display Manager (Integrated Mode)');
    
    // Create 5 displays in a grid layout
    const displays = [
      {
        id: 'display-1',
        name: 'ADSB Radar',
        description: 'Primary ADSB radar display',
        zone: 'main',
        template: 'radar',
        content: {
          type: 'radar',
          url: '/radar',
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
          url: '/unifi',
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
          url: '/system',
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
          url: '/map.html',
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
          url: '/alarms',
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
          refreshInterval: display.content.refreshInterval,
          layout: {
            grid: {
              row: Math.floor((displays.indexOf(display)) / 3),
              col: (displays.indexOf(display)) % 3,
              width: 1,
              height: 1
            }
          }
        }
      });
      
      // Activate the display
      await displayManager.executeCapability('display:management', 'activate', {
        displayId: display.id
      });
      
      console.log(`✅ ${display.name} created and activated`);
    }
    
    // Create a 5-grid view that combines all displays
    console.log('🎯 Creating 5-grid view...');
    
    await displayManager.executeCapability('display:views', 'create', {
      viewId: '5-grid-view',
      layout: {
        name: '5-Grid Command Center',
        description: 'Complete 5-display grid layout for command center operations',
        grid: {
          rows: 2,
          columns: 3,
          gap: '10px',
          displays: [
            { id: 'display-1', row: 0, col: 0, width: 1, height: 1 },
            { id: 'display-2', row: 0, col: 1, width: 1, height: 1 },
            { id: 'display-3', row: 0, col: 2, width: 1, height: 1 },
            { id: 'display-4', row: 1, col: 0, width: 1, height: 1 },
            { id: 'display-5', row: 1, col: 1, width: 1, height: 1 }
          ]
        }
      }
    });
    
    // Apply the 5-grid view
    await displayManager.executeCapability('display:views', 'apply', {
      viewId: '5-grid-view',
      screens: ['display-1', 'display-2', 'display-3', 'display-4', 'display-5']
    });
    
    console.log('✅ 5-grid view applied');
    
    // Create templates for each display type
    console.log('📋 Creating display templates...');
    
    const templates = [
      {
        id: 'radar',
        name: 'ADSB Radar Template',
        type: 'radar',
        content: {
          backgroundColor: '#000000',
          textColor: '#00ff00',
          borderColor: '#00ff00',
          title: 'ADSB Radar',
          showGrid: true,
          showLabels: true
        }
      },
      {
        id: 'camera-grid',
        name: 'Camera Grid Template',
        type: 'camera-grid',
        content: {
          backgroundColor: '#1a1a1a',
          textColor: '#ffffff',
          borderColor: '#333333',
          title: 'Camera Grid',
          gridSize: '3x3',
          showTimestamps: true
        }
      },
      {
        id: 'system-status',
        name: 'System Status Template',
        type: 'system-status',
        content: {
          backgroundColor: '#0a0a0a',
          textColor: '#00ffff',
          borderColor: '#00ffff',
          title: 'System Status',
          showMetrics: true,
          showAlerts: true
        }
      },
      {
        id: 'map',
        name: 'Interactive Map Template',
        type: 'map',
        content: {
          backgroundColor: '#000000',
          textColor: '#ffffff',
          borderColor: '#444444',
          title: 'Interactive Map',
          showControls: true,
          showLayers: true
        }
      },
      {
        id: 'alarm-dashboard',
        name: 'Alarm Dashboard Template',
        type: 'alarm-dashboard',
        content: {
          backgroundColor: '#1a0000',
          textColor: '#ff0000',
          borderColor: '#ff0000',
          title: 'Alarm Dashboard',
          showPriority: true,
          showHistory: true
        }
      }
    ];
    
    for (const template of templates) {
      await displayManager.executeCapability('display:templates', 'create', {
        templateId: template.id,
        content: template.content,
        type: template.type
      });
      
      console.log(`✅ Template ${template.name} created`);
    }
    
    // Get display manager status
    const status = displayManager.getDisplayManagerStatus();
    console.log('\n📊 Display Manager Status:');
    console.log(`Active Displays: ${status.activeDisplays}`);
    console.log(`Total Views: ${status.totalViews}`);
    console.log(`WebSocket Connections: ${status.websocketConnections}`);
    console.log(`Last Update: ${status.lastUpdateTime}`);
    
    console.log('\n🎉 5-Grid Display System Setup Complete!');
    console.log('\n📱 Access your displays:');
    console.log('• Display Manager GUI: http://localhost:3000/display-manager');
    console.log('• Individual Displays:');
    displays.forEach((display, index) => {
      console.log(`  ${index + 1}. ${display.name}: http://localhost:3000/display/${display.id}`);
    });
    
    console.log('\n🔧 Management:');
    console.log('• View all displays: http://localhost:3000/display-manager/gui');
    console.log('• Apply 5-grid view: http://localhost:3000/display-manager/gui/view/5-grid-view');
    
    // Keep the process running
    console.log('\n⏳ Display manager is running. Press Ctrl+C to stop.');
    
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
setup5GridDisplaysIntegrated().catch(console.error); 