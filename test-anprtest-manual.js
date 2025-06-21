const SpeedCalculationConnector = require('./connectors/types/SpeedCalculationConnector');
const readline = require('readline');
const winston = require('winston');

// Create logger
const logger = winston.createLogger({
  level: 'info',
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
 * Manual ANPRTEST Event Testing
 * 
 * Allows manual input of ANPRTEST camera events to test the speed calculation system.
 * Useful for testing with real crossing events from your ANPRTEST camera.
 */
async function testANPRTESTManual() {
  console.log('🚗 Manual ANPRTEST Event Testing...\n');

  // Create speed calculation connector
  const speedConnector = new SpeedCalculationConnector({
    id: 'speed-calculation-manual',
    name: 'Manual ANPRTEST Testing',
    description: 'Manual testing for ANPRTEST camera events',
    logger: logger,
    speedService: {
      minTimeBetweenDetections: 1000, // 1 second
      maxTimeBetweenDetections: 300000, // 5 minutes
      minSpeedThreshold: 5, // 5 km/h
      maxSpeedThreshold: 200, // 200 km/h
      confidenceThreshold: 0.7,
      retentionHours: 24
    }
  });

  await speedConnector.connect();
  console.log('✅ Speed calculation connector connected\n');

  // Register ANPRTEST camera detection points
  console.log('📹 Registering ANPRTEST camera detection points...');
  
  await speedConnector.execute('detection:points', 'register', {
    cameraId: 'ANPRTEST',
    name: 'ANPRTEST Camera - Zone 1',
    position: { lat: 51.5074, lon: -0.1278 },
    direction: 'northbound',
    speedLimit: 30,
    metadata: {
      location: 'ANPRTEST Camera',
      bidirectional: true,
      zone1: 'zone-1',
      zone2: 'zone-2'
    }
  });

  await speedConnector.execute('detection:points', 'register', {
    cameraId: 'ANPRTEST-ZONE2',
    name: 'ANPRTEST Camera - Zone 2',
    position: { lat: 51.5074, lon: -0.1278 },
    direction: 'southbound',
    speedLimit: 30,
    metadata: {
      location: 'ANPRTEST Camera',
      bidirectional: true,
      zone1: 'zone-1',
      zone2: 'zone-2'
    }
  });

  console.log('✅ Detection points registered\n');

  // Set up event listeners
  speedConnector.on('speed:calculated', (speedData) => {
    console.log(`\n🚗 SPEED CALCULATED: ${speedData.plateNumber} - ${speedData.speedKmh.toFixed(2)} km/h`);
    console.log(`   From: ${speedData.detection1.cameraId} to ${speedData.detection2.cameraId}`);
    console.log(`   Distance: ${speedData.distance.toFixed(3)} km, Time: ${(speedData.timeDiff / 1000).toFixed(1)}s`);
    console.log(`   Direction: ${speedData.detection1.direction} -> ${speedData.detection2.direction}`);
  });

  speedConnector.on('speed:alert', (alertData) => {
    console.log(`\n⚠️ SPEED ALERT: ${alertData.plateNumber} exceeded limit by ${alertData.excess.toFixed(2)} km/h`);
    console.log(`   Speed: ${alertData.speedKmh.toFixed(2)} km/h, Limit: ${alertData.speedLimit} km/h`);
  });

  console.log('✅ Event listeners configured\n');

  // Create readline interface for manual input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('📋 Manual Event Input Instructions:');
  console.log('===================================');
  console.log('Enter ANPRTEST events in the following format:');
  console.log('  plateNumber,cameraId,zone,direction,confidence');
  console.log('');
  console.log('Examples:');
  console.log('  ABC123,ANPRTEST,zone-1,northbound,0.95');
  console.log('  ABC123,ANPRTEST-ZONE2,zone-2,southbound,0.92');
  console.log('');
  console.log('Commands:');
  console.log('  stats    - Show current statistics');
  console.log('  list     - List all speed calculations');
  console.log('  alerts   - List all speed alerts');
  console.log('  tracking <plate> - Show tracking data for plate');
  console.log('  quit     - Exit the test');
  console.log('');

  // Function to process manual input
  const processInput = async (input) => {
    const trimmed = input.trim();
    
    if (trimmed === 'quit' || trimmed === 'exit') {
      console.log('\n🛑 Exiting manual test...');
      rl.close();
      return;
    }
    
    if (trimmed === 'stats') {
      const stats = speedConnector.getStats();
      console.log('\n📊 Current Statistics:');
      console.log(`   Total Detections: ${stats.speedCalculation.totalDetections}`);
      console.log(`   Total Calculations: ${stats.speedCalculation.totalCalculations}`);
      console.log(`   Total Alerts: ${stats.speedCalculation.totalAlerts}`);
      console.log(`   Active Tracking: ${stats.speedCalculation.activeTracking}`);
      console.log(`   Average Speed: ${stats.speedCalculation.averageSpeed.toFixed(2)} km/h`);
      return;
    }
    
    if (trimmed === 'list') {
      const calculations = speedConnector.getSpeedCalculations();
      console.log('\n🚗 Speed Calculations:');
      if (calculations.length === 0) {
        console.log('   No speed calculations yet.');
      } else {
        calculations.forEach((calc, index) => {
          console.log(`   ${index + 1}. ${calc.plateNumber}: ${calc.speedKmh.toFixed(2)} km/h`);
          console.log(`      From ${calc.detection1.cameraId} to ${calc.detection2.cameraId}`);
          console.log(`      Time: ${new Date(calc.calculatedAt).toLocaleTimeString()}`);
        });
      }
      return;
    }
    
    if (trimmed === 'alerts') {
      const alerts = speedConnector.getSpeedAlerts();
      console.log('\n⚠️ Speed Alerts:');
      if (alerts.length === 0) {
        console.log('   No speed alerts yet.');
      } else {
        alerts.forEach((alert, index) => {
          console.log(`   ${index + 1}. ${alert.plateNumber}: ${alert.speedKmh.toFixed(2)} km/h (Limit: ${alert.speedLimit} km/h)`);
          console.log(`      Excess: ${alert.excess.toFixed(2)} km/h`);
          console.log(`      Time: ${new Date(alert.timestamp).toLocaleTimeString()}`);
        });
      }
      return;
    }
    
    if (trimmed.startsWith('tracking ')) {
      const plateNumber = trimmed.substring(9);
      const trackingData = speedConnector.getTrackingData(plateNumber);
      console.log(`\n📋 Tracking Data for ${plateNumber}:`);
      if (!trackingData) {
        console.log('   No tracking data found for this plate.');
      } else {
        console.log(`   First Seen: ${trackingData.firstSeen.toLocaleString()}`);
        console.log(`   Last Seen: ${trackingData.lastSeen.toLocaleString()}`);
        console.log(`   Detections: ${trackingData.detections.length}`);
        console.log(`   Speed Calculations: ${trackingData.speedCalculations.length}`);
        console.log(`   Alerts: ${trackingData.alerts.length}`);
        
        if (trackingData.detections.length > 0) {
          console.log('\n   Recent Detections:');
          trackingData.detections.slice(-5).forEach((det, index) => {
            console.log(`     ${index + 1}. ${det.cameraId} - ${det.timestamp.toLocaleTimeString()}`);
          });
        }
      }
      return;
    }
    
    // Process ANPR event
    const parts = trimmed.split(',');
    if (parts.length < 5) {
      console.log('❌ Invalid format. Use: plateNumber,cameraId,zone,direction,confidence');
      return;
    }
    
    const [plateNumber, cameraId, zone, direction, confidence] = parts;
    
    try {
      const event = {
        cameraId: cameraId.trim(),
        plateNumber: plateNumber.trim(),
        timestamp: new Date().toISOString(),
        confidence: parseFloat(confidence.trim()),
        data: {
          zone: zone.trim(),
          direction: direction.trim(),
          vehicleType: 'car',
          color: 'unknown'
        }
      };
      
      console.log(`\n📸 Processing event: ${plateNumber} at ${cameraId} (${zone}, ${direction})`);
      
      await speedConnector.execute('speed:calculation', 'process', event);
      
      console.log('✅ Event processed successfully');
      
    } catch (error) {
      console.log(`❌ Error processing event: ${error.message}`);
    }
  };

  // Start input loop
  rl.on('line', processInput);
  
  // Handle graceful shutdown
  rl.on('close', () => {
    console.log('\n📊 Final Statistics:');
    const finalStats = speedConnector.getStats();
    console.log(`   Total Detections: ${finalStats.speedCalculation.totalDetections}`);
    console.log(`   Total Calculations: ${finalStats.speedCalculation.totalCalculations}`);
    console.log(`   Total Alerts: ${finalStats.speedCalculation.totalAlerts}`);
    
    console.log('\n✅ Manual testing completed!');
    process.exit(0);
  });

  // Show initial prompt
  console.log('Enter ANPRTEST event or command:');
  rl.prompt();
}

// Run the test if this file is executed directly
if (require.main === module) {
  testANPRTESTManual().catch(console.error);
}

module.exports = {
  testANPRTESTManual
}; 