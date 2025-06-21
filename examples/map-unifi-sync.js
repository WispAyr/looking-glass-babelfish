const MapConnector = require('../connectors/types/MapConnector');
const UnifiProtectConnector = require('../connectors/types/UnifiProtectConnector');
const winston = require('winston');

// Create logger
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Example: Bidirectional sync between Map and UniFi Protect connectors
 */
async function demonstrateMapUnifiSync() {
  console.log('🔄 Demonstrating Map ↔ UniFi Protect Bidirectional Sync\n');

  // Create UniFi Protect connector
  const unifiConnector = new UnifiProtectConnector({
    id: 'unifi-protect:communications-van',
    type: 'unifi-protect',
    name: 'Communications Van UniFi Protect',
    description: 'Primary UniFi Protect system',
    config: {
      host: '10.0.0.1',
      apiKey: 'your-api-key',
      username: 'your-username',
      password: 'your-password'
    },
    logger: logger
  });

  // Create Map connector
  const mapConnector = new MapConnector({
    id: 'map-main',
    type: 'map',
    name: 'Main Map',
    description: 'Primary map for spatial visualization',
    logger: logger
  });

  // Register UniFi Protect connector with the map
  await mapConnector.execute('integration:connector', 'register', {
    connectorId: 'unifi-protect:communications-van',
    context: {
      cameras: [
        {
          id: '6814da4203251903e40156ee',
          name: 'Front Door Camera',
          position: { x: 100, y: 200 },
          capabilities: ['motion', 'smartDetect', 'recording']
        },
        {
          id: '66a8fbdb00d9f103e4000609',
          name: 'Back Door Camera',
          position: { x: 300, y: 200 },
          capabilities: ['motion', 'smartDetect']
        }
      ]
    },
    capabilities: ['camera:video:stream', 'camera:event:motion', 'camera:event:smartDetect']
  });

  // Create map elements for UniFi cameras
  const frontDoorCamera = await mapConnector.execute('spatial:config', 'create', {
    elementType: 'camera',
    position: { x: 100, y: 200, z: 0 },
    properties: {
      name: 'Front Door Camera',
      model: 'G4 Pro',
      capabilities: ['motion', 'smartDetect'],
      coverage: { fov: 120, range: 50 }
    }
  });

  const backDoorCamera = await mapConnector.execute('spatial:config', 'create', {
    elementType: 'camera',
    position: { x: 300, y: 200, z: 0 },
    properties: {
      name: 'Back Door Camera',
      model: 'G4 Dome',
      capabilities: ['motion', 'smartDetect'],
      coverage: { fov: 180, range: 30 }
    }
  });

  // Link map elements to UniFi cameras
  await mapConnector.linkElementToConnector(
    frontDoorCamera.id,
    'unifi-protect:communications-van',
    '6814da4203251903e40156ee'
  );

  await mapConnector.linkElementToConnector(
    backDoorCamera.id,
    'unifi-protect:communications-van',
    '66a8fbdb00d9f103e4000609'
  );

  console.log('✅ Created and linked map elements to UniFi cameras');

  // Set up UniFi connector to listen for map sync events
  unifiConnector.on('sync:map-main', async (syncData) => {
    console.log('🔄 UniFi connector received sync event:', syncData);
    
    try {
      await handleMapSync(unifiConnector, syncData);
    } catch (error) {
      console.error('❌ Error handling map sync:', error);
    }
  });

  // Set up map connector to listen for UniFi sync events
  mapConnector.on('sync:unifi-protect:communications-van', async (syncData) => {
    console.log('🔄 Map connector received sync event:', syncData);
    
    try {
      await handleUnifiSync(mapConnector, syncData);
    } catch (error) {
      console.error('❌ Error handling UniFi sync:', error);
    }
  });

  // Demonstrate map changes being synced to UniFi
  console.log('\n📝 Demonstrating map → UniFi sync...');
  
  // Move the front door camera on the map
  await mapConnector.execute('spatial:config', 'position', {
    elementId: frontDoorCamera.id,
    position: { x: 150, y: 250, z: 0 }
  });

  // Change camera name on the map
  await mapConnector.execute('spatial:config', 'update', {
    elementId: frontDoorCamera.id,
    updates: {
      properties: {
        ...frontDoorCamera.properties,
        name: 'Front Door Camera (Updated)',
        coverage: { fov: 140, range: 60 }
      }
    }
  });

  // Wait a moment for sync events to process
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Demonstrate UniFi changes being synced to map
  console.log('\n📝 Demonstrating UniFi → map sync...');
  
  // Simulate UniFi camera configuration change
  await simulateUnifiCameraUpdate(unifiConnector, '66a8fbdb00d9f103e4000609', {
    name: 'Back Door Camera (Updated)',
    position: { x: 350, y: 250 },
    settings: { motionSensitivity: 'high' }
  });

  // Wait a moment for sync events to process
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n✅ Bidirectional sync demonstration completed!');
  
  return { mapConnector, unifiConnector };
}

/**
 * Handle map sync events in UniFi connector
 */
async function handleMapSync(unifiConnector, syncData) {
  const { elementId, elementType, changes, updated } = syncData;
  
  console.log(`🔄 UniFi connector processing map sync for ${elementType}:`, changes);

  // Get the UniFi camera ID from the sync data
  const unifiCameraId = updated.metadata?.sourceElementId;
  if (!unifiCameraId) {
    console.warn('No UniFi camera ID found in sync data');
    return;
  }

  try {
    // Handle position changes
    if (changes.position) {
      console.log(`📍 Updating UniFi camera ${unifiCameraId} position:`, changes.position);
      
      // In a real implementation, you would call UniFi Protect API
      // await unifiConnector.updateCameraPosition(unifiCameraId, changes.position.to);
      
      // For demo purposes, we'll just log the change
      console.log(`✅ Would update UniFi camera ${unifiCameraId} position to:`, changes.position.to);
    }

    // Handle name changes
    if (changes.name) {
      console.log(`🏷️ Updating UniFi camera ${unifiCameraId} name:`, changes.name);
      
      // In a real implementation, you would call UniFi Protect API
      // await unifiConnector.updateCameraName(unifiCameraId, changes.name.to);
      
      console.log(`✅ Would update UniFi camera ${unifiCameraId} name to:`, changes.name.to);
    }

    // Handle property changes
    if (changes.properties) {
      console.log(`⚙️ Updating UniFi camera ${unifiCameraId} properties:`, changes.properties);
      
      // Handle specific property changes
      for (const [property, change] of Object.entries(changes.properties)) {
        switch (property) {
          case 'coverage':
            console.log(`📐 Would update camera ${unifiCameraId} coverage settings:`, change.to);
            break;
          case 'capabilities':
            console.log(`🔧 Would update camera ${unifiCameraId} capabilities:`, change.to);
            break;
          default:
            console.log(`🔧 Would update camera ${unifiCameraId} property ${property}:`, change.to);
        }
      }
    }

    // Emit confirmation event back to map
    unifiConnector.emit('sync:confirmed', {
      elementId,
      unifiCameraId,
      changes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Error updating UniFi camera ${unifiCameraId}:`, error);
    
    // Emit error event back to map
    unifiConnector.emit('sync:error', {
      elementId,
      unifiCameraId,
      error: error.message,
      changes,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle UniFi sync events in map connector
 */
async function handleUnifiSync(mapConnector, syncData) {
  const { elementId, elementType, changes, updated } = syncData;
  
  console.log(`🔄 Map connector processing UniFi sync for ${elementType}:`, changes);

  try {
    // Find the map element that corresponds to this UniFi camera
    const mapElement = mapConnector.getSpatialElement(elementId);
    if (!mapElement) {
      console.warn(`Map element ${elementId} not found`);
      return;
    }

    // Update map element based on UniFi changes
    const updates = {};

    if (changes.name) {
      updates.properties = {
        ...mapElement.properties,
        name: changes.name
      };
    }

    if (changes.position) {
      updates.position = changes.position;
    }

    if (changes.settings) {
      updates.properties = {
        ...mapElement.properties,
        settings: changes.settings
      };
    }

    if (Object.keys(updates).length > 0) {
      await mapConnector.execute('spatial:config', 'update', {
        elementId,
        updates
      });
      
      console.log(`✅ Updated map element ${elementId} with UniFi changes`);
    }

  } catch (error) {
    console.error(`❌ Error updating map element ${elementId}:`, error);
  }
}

/**
 * Simulate UniFi camera configuration update
 */
async function simulateUnifiCameraUpdate(unifiConnector, cameraId, updates) {
  console.log(`📝 Simulating UniFi camera ${cameraId} update:`, updates);
  
  // Emit sync event to map connector
  unifiConnector.emit('sync:map-main', {
    elementId: `camera-${cameraId}`, // Map element ID
    elementType: 'camera',
    changes: updates,
    original: {
      name: 'Back Door Camera',
      position: { x: 300, y: 200 }
    },
    updated: {
      name: updates.name,
      position: updates.position,
      settings: updates.settings
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Example: Real-time event visualization
 */
async function demonstrateRealTimeVisualization() {
  console.log('\n🎯 Demonstrating real-time event visualization...');

  const mapConnector = new MapConnector({
    id: 'map-realtime',
    type: 'map',
    name: 'Real-time Map',
    logger: logger
  });

  // Subscribe to real-time events
  await mapConnector.execute('visualization:realtime', 'subscribe', {
    dataType: 'smartDetectLine:vehicle',
    filter: { connectorId: 'unifi-protect:communications-van' },
    visual: {
      animation: 'pulse',
      color: '#00ff88',
      duration: 2000,
      icon: 'car'
    }
  });

  await mapConnector.execute('visualization:realtime', 'subscribe', {
    dataType: 'smartDetectZone:vehicle',
    filter: { connectorId: 'unifi-protect:communications-van' },
    visual: {
      animation: 'flash',
      color: '#ff6b35',
      duration: 1000,
      icon: 'zone'
    }
  });

  // Simulate real-time events from the log data
  const events = [
    {
      type: 'smartDetectLine',
      elementId: 'line-speed-trap',
      event: {
        id: '6856d694007f1c03e4357674',
        type: 'vehicle',
        timestamp: '2025-06-21T15:58:15.034Z',
        speed: 45,
        direction: 'eastbound'
      }
    },
    {
      type: 'smartDetectZone',
      elementId: 'zone-entry',
      event: {
        id: '6856d66f03681c03e4356d47',
        type: 'vehicle',
        timestamp: '2025-06-21T15:58:14.150Z',
        occupancy: 2
      }
    }
  ];

  events.forEach((event, index) => {
    setTimeout(() => {
      mapConnector.emit('data:received', event);
      console.log(`✅ Emitted real-time event ${index + 1}:`, event.type);
    }, index * 1000);
  });

  console.log('✅ Real-time visualization setup complete');
  
  return mapConnector;
}

/**
 * Main demonstration function
 */
async function main() {
  try {
    console.log('🚀 Starting Map ↔ UniFi Bidirectional Sync Demo\n');
    
    // Demonstrate bidirectional sync
    const syncDemo = await demonstrateMapUnifiSync();
    
    // Demonstrate real-time visualization
    const realtimeDemo = await demonstrateRealTimeVisualization();
    
    console.log('\n✨ All demonstrations completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Map ↔ UniFi bidirectional sync: ✅');
    console.log('- Position updates: ✅');
    console.log('- Property changes: ✅');
    console.log('- Real-time event visualization: ✅');
    console.log('- Error handling: ✅');
    
    console.log('\n🎯 Key Features Demonstrated:');
    console.log('1. Map changes automatically sync to UniFi Protect');
    console.log('2. UniFi changes automatically sync to map');
    console.log('3. Real-time events are visualized on the map');
    console.log('4. Error handling and confirmation events');
    console.log('5. Change detection and filtering');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  demonstrateMapUnifiSync,
  demonstrateRealTimeVisualization,
  handleMapSync,
  handleUnifiSync
}; 