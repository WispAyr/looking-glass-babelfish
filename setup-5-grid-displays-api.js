#!/usr/bin/env node

const { spawn } = require('child_process');
const fetch = require('node-fetch');

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

// API helper functions
async function apiCall(endpoint, options = {}) {
  const url = `http://localhost:3000/display${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

async function setup5GridDisplaysAPI() {
  console.log('🚀 Setting up 5-Grid Display System via API...');
  
  // Free port first
  await freePort(3000);
  
  // Wait a moment for the server to start
  console.log('⏳ Waiting for server to be ready...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Check if display manager is available
    console.log('🔍 Checking display manager status...');
    const status = await apiCall('/api/status');
    console.log('✅ Display Manager is available');
    
    // Create 5 displays in a grid layout
    const displays = [
      {
        displayId: 'display-1',
        name: 'ADSB Radar',
        description: 'Primary ADSB radar display',
        zone: 'main',
        template: 'radar',
        url: '/radar',
        refreshInterval: 5000,
        layout: {
          grid: { row: 0, col: 0, width: 1, height: 1 }
        }
      },
      {
        displayId: 'display-2', 
        name: 'Camera Grid',
        description: 'UniFi Protect camera grid',
        zone: 'secondary',
        template: 'camera-grid',
        url: '/unifi',
        refreshInterval: 2000,
        layout: {
          grid: { row: 0, col: 1, width: 1, height: 1 }
        }
      },
      {
        displayId: 'display-3',
        name: 'System Status',
        description: 'System health and connector status',
        zone: 'noc',
        template: 'system-status',
        url: '/system',
        refreshInterval: 10000,
        layout: {
          grid: { row: 0, col: 2, width: 1, height: 1 }
        }
      },
      {
        displayId: 'display-4',
        name: 'Map View',
        description: 'Interactive map with aircraft and APRS',
        zone: 'operations',
        template: 'map',
        url: '/map.html',
        refreshInterval: 3000,
        layout: {
          grid: { row: 1, col: 0, width: 1, height: 1 }
        }
      },
      {
        displayId: 'display-5',
        name: 'Alarm Dashboard',
        description: 'Alarm manager and notification center',
        zone: 'emergency',
        template: 'alarm-dashboard',
        url: '/alarms',
        refreshInterval: 1000,
        layout: {
          grid: { row: 1, col: 1, width: 1, height: 1 }
        }
      }
    ];
    
    console.log('📺 Creating 5 grid displays...');
    
    // Create each display
    for (const display of displays) {
      console.log(`Creating ${display.name}...`);
      
      const result = await apiCall('/api/displays', {
        method: 'POST',
        body: JSON.stringify(display)
      });
      
      console.log(`✅ ${display.name} created`);
      
      // Activate the display
      await apiCall(`/api/displays/${display.displayId}/activate`, {
        method: 'POST'
      });
      
      console.log(`✅ ${display.name} activated`);
    }
    
    // Create a 5-grid view
    console.log('🎯 Creating 5-grid view...');
    
    const viewData = {
      viewId: '5-grid-view',
      name: '5-Grid Command Center',
      description: 'Complete 5-display grid layout for command center operations',
      layout: {
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
    };
    
    // Note: We'll need to add a view creation endpoint to the display routes
    console.log('⚠️  View creation endpoint not yet implemented - displays created individually');
    
    // Get final status
    const finalStatus = await apiCall('/api/status');
    console.log('\n📊 Final Display Manager Status:');
    console.log(`Active Displays: ${finalStatus.data.activeDisplays}`);
    console.log(`Total Views: ${finalStatus.data.totalViews}`);
    console.log(`WebSocket Connections: ${finalStatus.data.websocketConnections}`);
    
    console.log('\n🎉 5-Grid Display System Setup Complete!');
    console.log('\n📱 Access your displays:');
    console.log('• Display Manager GUI: http://localhost:3000/display/manager');
    console.log('• Individual Displays:');
    displays.forEach((display, index) => {
      console.log(`  ${index + 1}. ${display.name}: http://localhost:3000/display/${display.displayId}`);
    });
    
    console.log('\n🔧 Management:');
    console.log('• View all displays: http://localhost:3000/display/manager');
    console.log('• API Status: http://localhost:3000/display/api/status');
    console.log('• API Displays: http://localhost:3000/display/api/displays');
    
    console.log('\n✨ All 5 displays are now active and ready!');
    
  } catch (error) {
    console.error('❌ Error setting up displays:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the main server is running on port 3000:');
      console.log('   node server.js');
    }
    
    process.exit(1);
  }
}

// Run the setup
setup5GridDisplaysAPI().catch(console.error); 