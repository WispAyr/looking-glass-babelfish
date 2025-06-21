const SpeedCalculationConnector = require('./connectors/types/SpeedCalculationConnector');
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
 * ANPRTEST Camera Speed Calculation Test
 * 
 * Tests the speed calculation system with the real ANPRTEST camera
 * that has bidirectional crossing zones and emits crossing events.
 */
async function testANPRTESTCamera() {
  console.log('🚗 Testing ANPRTEST Camera Speed Calculation System...\n');

  // Step 1: Create speed calculation connector
  console.log('🔧 Step 1: Creating speed calculation connector...');
  
  const speedConnector = new SpeedCalculationConnector({
    id: 'speed-calculation-anprtest',
    name: 'ANPRTEST Speed Calculation System',
    description: 'Speed calculation for ANPRTEST camera with bidirectional zones',
    logger: logger,
    speedService: {
      minTimeBetweenDetections: 1000, // 1 second
      maxTimeBetweenDetections: 300000, // 5 minutes
      minSpeedThreshold: 5, // 5 km/h
      maxSpeedThreshold: 200, // 200 km/h
      confidenceThreshold: 0.7, // Lower threshold for testing
      retentionHours: 24
    }
  });

  // Step 2: Create map connector for spatial configuration
  console.log('🗺️ Step 2: Creating map connector...');
  
  const mapConnector = new MapConnector({
    id: 'map-anprtest',
    name: 'ANPRTEST Map',
    description: 'Spatial configuration for ANPRTEST camera',
    logger: logger
  });

  // Connect connectors
  await speedConnector.connect();
  await mapConnector.connect();

  console.log('✅ Connectors connected\n');

  // Step 3: Register ANPRTEST camera as detection points
  console.log('📹 Step 3: Registering ANPRTEST camera detection points...');
  
  // Register the camera for both directions (since it's bidirectional)
  const detectionPoint1 = await speedConnector.execute('detection:points', 'register', {
    cameraId: 'ANPRTEST',
    name: 'ANPRTEST Camera - Zone 1',
    position: { lat: 51.5074, lon: -0.1278 }, // Example coordinates
    direction: 'northbound',
    speedLimit: 30,
    metadata: {
      location: 'ANPRTEST Camera',
      cameraModel: 'ANPRTEST',
      anprEnabled: true,
      bidirectional: true,
      zone1: 'zone-1',
      zone2: 'zone-2'
    }
  });
  console.log(`✅ Registered detection point: ${detectionPoint1.name}`);

  // Register a second detection point for the other zone
  const detectionPoint2 = await speedConnector.execute('detection:points', 'register', {
    cameraId: 'ANPRTEST-ZONE2',
    name: 'ANPRTEST Camera - Zone 2',
    position: { lat: 51.5074, lon: -0.1278 }, // Same position, different zone
    direction: 'southbound',
    speedLimit: 30,
    metadata: {
      location: 'ANPRTEST Camera',
      cameraModel: 'ANPRTEST',
      anprEnabled: true,
      bidirectional: true,
      zone1: 'zone-1',
      zone2: 'zone-2'
    }
  });
  console.log(`✅ Registered detection point: ${detectionPoint2.name}`);

  // Step 4: Create spatial elements on map
  console.log('\n🗺️ Step 4: Creating spatial elements on map...');
  
  // Create camera element
  const cameraElement = await mapConnector.execute('spatial:config', 'create', {
    elementType: 'camera',
    position: { x: 100, y: 200, z: 0 },
    properties: {
      name: 'ANPRTEST Camera',
      cameraId: 'ANPRTEST',
      type: 'anpr',
      speedLimit: 30,
      bidirectional: true,
      zones: ['zone-1', 'zone-2']
    }
  });

  // Create detection line for bidirectional traffic
  const detectionLine = await mapConnector.execute('spatial:config', 'create', {
    elementType: 'line',
    position: { x: 100, y: 200, z: 0 },
    properties: {
      name: 'ANPRTEST Detection Line',
      type: 'bidirectional-speed-trap',
      camera: 'ANPRTEST',
      zones: ['zone-1', 'zone-2'],
      distance: 0.1, // 100m between zones
      speedLimit: 30
    }
  });

  console.log('✅ Created spatial elements on map');

  // Step 5: Set up event listeners for real-time monitoring
  console.log('\n📡 Step 5: Setting up event listeners...');
  
  speedConnector.on('speed:calculated', (speedData) => {
    console.log(`🚗 Speed calculated: ${speedData.plateNumber} - ${speedData.speedKmh.toFixed(2)} km/h`);
    console.log(`   From: ${speedData.detection1.cameraId} to ${speedData.detection2.cameraId}`);
    console.log(`   Distance: ${speedData.distance.toFixed(3)} km, Time: ${(speedData.timeDiff / 1000).toFixed(1)}s`);
    console.log(`   Direction: ${speedData.detection1.direction} -> ${speedData.detection2.direction}`);
  });

  speedConnector.on('speed:alert', (alertData) => {
    console.log(`⚠️ SPEED ALERT: ${alertData.plateNumber} exceeded limit by ${alertData.excess.toFixed(2)} km/h`);
    console.log(`   Speed: ${alertData.speedKmh.toFixed(2)} km/h, Limit: ${alertData.speedLimit} km/h`);
    console.log(`   Direction: ${alertData.detection1.direction} -> ${alertData.detection2.direction}`);
  });

  speedConnector.on('detectionPoint:registered', (pointData) => {
    console.log(`📍 Detection point registered: ${pointData.name} (${pointData.id})`);
  });

  console.log('✅ Event listeners configured');

  // Step 6: Monitor for real ANPRTEST events
  console.log('\n🎯 Step 6: Monitoring for real ANPRTEST events...');
  console.log('Waiting for crossing events from ANPRTEST camera...');
  console.log('Make sure your ANPRTEST camera is connected and vehicles are crossing the zones.\n');

  // Step 7: Set up periodic status checks
  const statusInterval = setInterval(async () => {
    const stats = speedConnector.getStats();
    const calculations = speedConnector.getSpeedCalculations();
    const alerts = speedConnector.getSpeedAlerts();
    
    console.log(`\n📊 Status Update:`);
    console.log(`   Total Detections: ${stats.speedCalculation.totalDetections}`);
    console.log(`   Total Calculations: ${stats.speedCalculation.totalCalculations}`);
    console.log(`   Total Alerts: ${stats.speedCalculation.totalAlerts}`);
    console.log(`   Active Tracking: ${stats.speedCalculation.activeTracking}`);
    
    if (calculations.length > 0) {
      console.log(`\n🚗 Recent Speed Calculations:`);
      calculations.slice(-3).forEach((calc, index) => {
        console.log(`   ${index + 1}. ${calc.plateNumber}: ${calc.speedKmh.toFixed(2)} km/h`);
        console.log(`      From ${calc.detection1.cameraId} to ${calc.detection2.cameraId}`);
        console.log(`      Time: ${new Date(calc.calculatedAt).toLocaleTimeString()}`);
      });
    }
    
    if (alerts.length > 0) {
      console.log(`\n⚠️ Recent Speed Alerts:`);
      alerts.slice(-3).forEach((alert, index) => {
        console.log(`   ${index + 1}. ${alert.plateNumber}: ${alert.speedKmh.toFixed(2)} km/h (Limit: ${alert.speedLimit} km/h)`);
        console.log(`      Excess: ${alert.excess.toFixed(2)} km/h`);
        console.log(`      Time: ${new Date(alert.timestamp).toLocaleTimeString()}`);
      });
    }
    
    console.log('\n' + '='.repeat(50));
  }, 10000); // Check every 10 seconds

  // Step 8: API endpoint testing
  console.log('\n🌐 Step 8: Testing API endpoints...');
  
  // Test detection points endpoint
  const detectionPoints = await speedConnector.execute('detection:points', 'list');
  console.log(`✅ Detection points: ${detectionPoints.length}`);
  detectionPoints.forEach(point => {
    console.log(`   - ${point.name} (${point.id})`);
  });

  // Test speed calculations endpoint
  const calculations = speedConnector.getSpeedCalculations();
  console.log(`✅ Speed calculations: ${calculations.length}`);

  // Test speed alerts endpoint
  const alerts = speedConnector.getSpeedAlerts();
  console.log(`✅ Speed alerts: ${alerts.length}`);

  // Step 9: Manual event processing test
  console.log('\n🧪 Step 9: Testing manual event processing...');
  
  // Simulate a crossing event from ANPRTEST camera
  console.log('Simulating ANPRTEST crossing event...');
  
  const testEvent = {
    cameraId: 'ANPRTEST',
    plateNumber: 'TEST123',
    timestamp: new Date().toISOString(),
    confidence: 0.95,
    data: {
      zone: 'zone-1',
      direction: 'northbound',
      vehicleType: 'car',
      color: 'blue'
    }
  };

  await speedConnector.execute('speed:calculation', 'process', testEvent);
  console.log('✅ Test event processed');

  // Step 10: Instructions for real testing
  console.log('\n📋 Step 10: Real Testing Instructions');
  console.log('=====================================');
  console.log('To test with real ANPRTEST camera events:');
  console.log('');
  console.log('1. Ensure your ANPRTEST camera is connected to the system');
  console.log('2. Verify the camera is emitting crossing events');
  console.log('3. Have vehicles cross the bidirectional zones');
  console.log('4. Monitor the console for speed calculations and alerts');
  console.log('');
  console.log('API Endpoints for monitoring:');
  console.log('  GET /api/speed/stats                    - System statistics');
  console.log('  GET /api/speed/calculations             - Speed calculations');
  console.log('  GET /api/speed/alerts                   - Speed alerts');
  console.log('  GET /api/speed/tracking/:plateNumber    - Plate tracking');
  console.log('  GET /api/speed/realtime                 - Real-time updates');
  console.log('');
  console.log('Manual event processing:');
  console.log('  POST /api/speed/process-anpr            - Process ANPR event');
  console.log('');

  // Step 11: Keep the test running
  console.log('🔄 Test is running... Press Ctrl+C to stop');
  console.log('The system will continue monitoring for real ANPRTEST events');
  console.log('Status updates will be displayed every 10 seconds\n');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down test...');
    clearInterval(statusInterval);
    
    // Display final results
    const finalStats = speedConnector.getStats();
    const finalCalculations = speedConnector.getSpeedCalculations();
    const finalAlerts = speedConnector.getSpeedAlerts();
    
    console.log('\n📊 Final Results:');
    console.log('================');
    console.log(`Total Detections: ${finalStats.speedCalculation.totalDetections}`);
    console.log(`Total Calculations: ${finalStats.speedCalculation.totalCalculations}`);
    console.log(`Total Alerts: ${finalStats.speedCalculation.totalAlerts}`);
    console.log(`Average Speed: ${finalStats.speedCalculation.averageSpeed.toFixed(2)} km/h`);
    
    if (finalCalculations.length > 0) {
      console.log('\nSpeed Calculations:');
      finalCalculations.forEach((calc, index) => {
        console.log(`${index + 1}. ${calc.plateNumber}: ${calc.speedKmh.toFixed(2)} km/h`);
        console.log(`   From ${calc.detection1.cameraId} to ${calc.detection2.cameraId}`);
        console.log(`   Distance: ${calc.distance.toFixed(3)} km, Time: ${(calc.timeDiff / 1000).toFixed(1)}s`);
      });
    }
    
    if (finalAlerts.length > 0) {
      console.log('\nSpeed Alerts:');
      finalAlerts.forEach((alert, index) => {
        console.log(`${index + 1}. ${alert.plateNumber}: ${alert.speedKmh.toFixed(2)} km/h (Limit: ${alert.speedLimit} km/h)`);
        console.log(`   Excess: ${alert.excess.toFixed(2)} km/h`);
      });
    }
    
    console.log('\n✅ ANPRTEST camera test completed!');
    process.exit(0);
  });

  return {
    speedConnector,
    mapConnector,
    detectionPoint1,
    detectionPoint2,
    cameraElement,
    detectionLine
  };
}

// Run the test if this file is executed directly
if (require.main === module) {
  testANPRTESTCamera().catch(console.error);
}

module.exports = {
  testANPRTESTCamera
}; 