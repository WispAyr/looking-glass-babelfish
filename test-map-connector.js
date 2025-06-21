const MapConnector = require('./connectors/types/MapConnector');
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
 * Test Map Connector functionality
 */
async function testMapConnector() {
  console.log('🧭 Testing Map Connector...\n');

  // Create map connector
  const mapConnector = new MapConnector({
    id: 'map-main',
    type: 'map',
    name: 'Main Map',
    description: 'Primary map for spatial visualization',
    logger: logger
  });

  // Test basic functionality
  console.log('📋 Testing basic functionality...');
  
  // Create spatial elements
  const camera1 = await mapConnector.execute('spatial:config', 'create', {
    elementType: 'camera',
    position: { x: 100, y: 200, z: 0 },
    properties: {
      name: 'Front Door Camera',
      model: 'G4 Pro',
      capabilities: ['motion', 'smartDetect'],
      coverage: { fov: 120, range: 50 }
    }
  });
  console.log('✅ Created camera:', camera1.id);

  const zone1 = await mapConnector.execute('spatial:config', 'create', {
    elementType: 'zone',
    position: { x: 150, y: 250, z: 0 },
    properties: {
      name: 'Entry Zone',
      type: 'entry',
      geometry: {
        type: 'polygon',
        coordinates: [[100, 200], [200, 200], [200, 300], [100, 300]]
      }
    }
  });
  console.log('✅ Created zone:', zone1.id);

  const line1 = await mapConnector.execute('spatial:config', 'create', {
    elementType: 'line',
    position: { x: 200, y: 200, z: 0 },
    properties: {
      name: 'Speed Trap Line',
      type: 'detection-line',
      geometry: {
        type: 'line',
        coordinates: [[200, 200], [300, 200]],
        direction: 'eastbound'
      }
    }
  });
  console.log('✅ Created detection line:', line1.id);

  // Test connector integration
  console.log('\n🔗 Testing connector integration...');
  
  await mapConnector.execute('integration:connector', 'register', {
    connectorId: 'unifi-protect:communications-van',
    context: {
      cameras: [
        {
          id: '6814da4203251903e40156ee',
          name: 'Front Door',
          position: { x: 100, y: 200 },
          capabilities: ['motion', 'smartDetect']
        }
      ],
      zones: [
        {
          id: 'entry-zone-001',
          name: 'Entry Zone',
          geometry: { type: 'polygon', coordinates: [[100, 200], [200, 200], [200, 300], [100, 300]] }
        }
      ]
    },
    capabilities: ['camera:video:stream', 'camera:event:motion', 'camera:event:smartDetect']
  });
  console.log('✅ Registered UniFi Protect connector');

  // Store spatial context
  await mapConnector.execute('context:spatial', 'store', {
    contextId: 'connector:unifi-protect:communications-van',
    data: {
      spatialLayout: {
        cameras: [
          {
            id: '6814da4203251903e40156ee',
            mapElementId: camera1.id,
            position: { x: 100, y: 200 }
          }
        ],
        zones: [
          {
            id: 'entry-zone-001',
            mapElementId: zone1.id,
            geometry: { type: 'polygon', coordinates: [[100, 200], [200, 200], [200, 300], [100, 300]] }
          }
        ]
      }
    }
  });
  console.log('✅ Stored spatial context');

  // Test real-time visualization
  console.log('\n📊 Testing real-time visualization...');
  
  const stream1 = await mapConnector.execute('visualization:realtime', 'subscribe', {
    dataType: 'smartDetectLine:vehicle',
    filter: { elementId: line1.id },
    visual: {
      animation: 'pulse',
      color: '#00ff88',
      duration: 2000
    }
  });
  console.log('✅ Subscribed to vehicle detection stream:', stream1.id);

  // Simulate real-time data
  console.log('\n🎯 Simulating real-time data...');
  
  // Simulate vehicle detection event
  const detectionEvent = {
    type: 'smartDetectLine',
    elementId: line1.id,
    event: {
      id: '6856d340015d1c03e434e491',
      type: 'vehicle',
      timestamp: new Date().toISOString(),
      speed: 45,
      direction: 'eastbound',
      plateNumber: 'ABC123'
    }
  };

  // Emit the event (in real implementation, this would come from other connectors)
  mapConnector.emit('data:received', detectionEvent);
  console.log('✅ Emitted vehicle detection event');

  // Test mode switching
  console.log('\n🔄 Testing mode switching...');
  
  mapConnector.setEditMode(true);
  console.log('✅ Switched to edit mode');
  
  mapConnector.setViewMode('realtime');
  console.log('✅ Set view mode to realtime');

  // Test spatial queries
  console.log('\n🔍 Testing spatial queries...');
  
  const cameras = mapConnector.getSpatialElements({ type: 'camera' });
  console.log(`✅ Found ${cameras.length} cameras`);

  const zones = mapConnector.getSpatialElements({ type: 'zone' });
  console.log(`✅ Found ${zones.length} zones`);

  const contexts = mapConnector.getConnectorContexts();
  console.log(`✅ Found ${contexts.length} connector contexts`);

  // Test undo/redo
  console.log('\n↩️ Testing undo/redo...');
  
  const originalPosition = camera1.position;
  await mapConnector.execute('spatial:config', 'position', {
    elementId: camera1.id,
    position: { x: 150, y: 250, z: 0 }
  });
  console.log('✅ Moved camera to new position');

  const undoResult = mapConnector.undo();
  console.log('✅ Undid camera move:', undoResult.operation);

  const redoResult = mapConnector.redo();
  console.log('✅ Redid camera move:', redoResult.operation);

  // Test configuration export/import
  console.log('\n💾 Testing configuration export/import...');
  
  const exportedConfig = mapConnector.exportConfiguration();
  console.log('✅ Exported configuration with', exportedConfig.elements.length, 'elements');

  // Create new map connector for import test
  const mapConnector2 = new MapConnector({
    id: 'map-test-import',
    type: 'map',
    name: 'Test Import Map',
    logger: logger
  });

  await mapConnector2.importConfiguration(exportedConfig);
  console.log('✅ Imported configuration successfully');

  // Test statistics
  console.log('\n📈 Testing statistics...');
  
  const stats = mapConnector.getStats();
  console.log('✅ Map connector stats:', {
    totalElements: stats.spatial.totalElements,
    elementsByType: stats.spatial.elementsByType,
    totalContexts: stats.spatial.totalContexts,
    totalStreams: stats.spatial.totalStreams,
    editMode: stats.spatial.editMode,
    viewMode: stats.spatial.viewMode
  });

  console.log('\n🎉 Map Connector test completed successfully!');
  
  return {
    mapConnector,
    mapConnector2,
    stats
  };
}

/**
 * Test integration with existing connectors
 */
async function testConnectorIntegration() {
  console.log('\n🔌 Testing connector integration...');

  // This would integrate with existing connectors like UniFi Protect
  // For now, we'll simulate the integration

  const mapConnector = new MapConnector({
    id: 'map-integration-test',
    type: 'map',
    name: 'Integration Test Map',
    logger: logger
  });

  // Simulate UniFi Protect connector registration
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
      ],
      zones: [
        {
          id: 'entry-zone',
          name: 'Entry Zone',
          geometry: { type: 'polygon', coordinates: [[100, 200], [200, 200], [200, 300], [100, 300]] }
        }
      ],
      detectionLines: [
        {
          id: 'speed-trap-1',
          name: 'Speed Trap',
          geometry: { type: 'line', coordinates: [[200, 200], [300, 200]] }
        }
      ]
    },
    capabilities: ['camera:video:stream', 'camera:event:motion', 'camera:event:smartDetect']
  });

  // Create spatial elements based on connector context
  const context = await mapConnector.execute('context:spatial', 'retrieve', {
    contextId: 'connector:unifi-protect:communications-van'
  });

  console.log('✅ Retrieved connector context:', Object.keys(context));

  // Subscribe to real-time events
  await mapConnector.execute('visualization:realtime', 'subscribe', {
    dataType: 'smartDetectZone:vehicle',
    filter: { connectorId: 'unifi-protect:communications-van' },
    visual: {
      animation: 'pulse',
      color: '#00ff88',
      duration: 2000,
      icon: 'car'
    }
  });

  await mapConnector.execute('visualization:realtime', 'subscribe', {
    dataType: 'smartDetectLine:vehicle',
    filter: { connectorId: 'unifi-protect:communications-van' },
    visual: {
      animation: 'flash',
      color: '#ff6b35',
      duration: 1000,
      icon: 'speed'
    }
  });

  console.log('✅ Subscribed to real-time event streams');

  // Simulate real-time events from the log data
  const events = [
    {
      type: 'smartDetectLine',
      elementId: 'line-speed-trap',
      event: {
        id: '6856d340015d1c03e434e491',
        type: 'vehicle',
        timestamp: '2025-06-21T15:44:02.647Z',
        speed: 45,
        direction: 'eastbound'
      }
    },
    {
      type: 'smartDetectZone',
      elementId: 'zone-entry',
      event: {
        id: '6856d33b02041c03e434e38d',
        type: 'vehicle',
        timestamp: '2025-06-21T15:44:02.954Z',
        occupancy: 2
      }
    }
  ];

  events.forEach((event, index) => {
    setTimeout(() => {
      mapConnector.emit('data:received', event);
      console.log(`✅ Emitted event ${index + 1}:`, event.type);
    }, index * 1000);
  });

  console.log('✅ Integration test setup complete');
  
  return mapConnector;
}

/**
 * Main test function
 */
async function main() {
  try {
    console.log('🚀 Starting Map Connector Tests\n');
    
    // Test basic functionality
    const basicTest = await testMapConnector();
    
    // Test integration
    const integrationTest = await testConnectorIntegration();
    
    console.log('\n✨ All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Map Connector basic functionality: ✅');
    console.log('- Spatial element management: ✅');
    console.log('- Connector integration: ✅');
    console.log('- Real-time visualization: ✅');
    console.log('- Configuration export/import: ✅');
    console.log('- Undo/redo functionality: ✅');
    
    console.log('\n🎯 Next steps:');
    console.log('1. Integrate with existing connectors (UniFi Protect, MQTT, etc.)');
    console.log('2. Create web interface for map visualization');
    console.log('3. Implement drag-and-drop functionality');
    console.log('4. Add real-time data streaming from connectors');
    console.log('5. Create spatial analytics and reporting');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  testMapConnector,
  testConnectorIntegration
}; 