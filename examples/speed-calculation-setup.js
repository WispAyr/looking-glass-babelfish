const SpeedCalculationConnector = require('../connectors/types/SpeedCalculationConnector');
const MapConnector = require('../connectors/types/MapConnector');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

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
 * Speed Calculation System Setup Example
 * 
 * Demonstrates setting up a complete speed calculation system with:
 * - Two UniFi cameras with ANPR detection
 * - Map connector for spatial configuration
 * - Speed calculation connector for logic processing
 * - Real-time speed monitoring and alerting
 */
async function setupSpeedCalculationSystem() {
  console.log('🚗 Setting up Speed Calculation System...\n');

  // Create speed calculation connector
  const speedConnector = new SpeedCalculationConnector({
    id: 'speed-calculation-main',
    name: 'Speed Calculation System',
    description: 'ANPR-based speed calculation between detection points',
    logger: logger,
    speedService: {
      minTimeBetweenDetections: 1000, // 1 second
      maxTimeBetweenDetections: 300000, // 5 minutes
      minSpeedThreshold: 5, // 5 km/h
      maxSpeedThreshold: 200, // 200 km/h
      confidenceThreshold: 0.8,
      retentionHours: 24
    }
  });

  // Create map connector for spatial configuration
  const mapConnector = new MapConnector({
    id: 'map-speed-system',
    name: 'Speed System Map',
    description: 'Spatial configuration for speed calculation system',
    logger: logger
  });

  // Connect both connectors
  await speedConnector.connect();
  await mapConnector.connect();

  console.log('✅ Connectors connected\n');

  // Step 1: Register detection points (camera locations)
  console.log('📹 Registering detection points...');
  
  // Camera 1 - Entry point
  const detectionPoint1 = await speedConnector.execute('detection:points', 'register', {
    cameraId: 'camera-001',
    name: 'Entry Camera',
    position: { lat: 51.5074, lon: -0.1278 }, // London coordinates (example)
    direction: 'northbound',
    speedLimit: 30, // 30 km/h speed limit
    metadata: {
      location: 'Main entrance',
      cameraModel: 'G4 Pro',
      anprEnabled: true
    }
  });
  console.log(`✅ Registered detection point: ${detectionPoint1.name}`);

  // Camera 2 - Exit point (500m north)
  const detectionPoint2 = await speedConnector.execute('detection:points', 'register', {
    cameraId: 'camera-002',
    name: 'Exit Camera',
    position: { lat: 51.5120, lon: -0.1278 }, // 500m north
    direction: 'northbound',
    speedLimit: 30, // 30 km/h speed limit
    metadata: {
      location: 'Main exit',
      cameraModel: 'G4 Pro',
      anprEnabled: true
    }
  });
  console.log(`✅ Registered detection point: ${detectionPoint2.name}`);

  // Step 2: Create spatial elements on map
  console.log('\n🗺️ Creating spatial elements on map...');
  
  // Create camera elements on map
  const camera1Element = await mapConnector.execute('spatial:config', 'create', {
    elementType: 'camera',
    position: { x: 100, y: 200, z: 0 },
    properties: {
      name: 'Entry Camera',
      cameraId: 'camera-001',
      type: 'anpr',
      speedLimit: 30,
      direction: 'northbound'
    }
  });

  const camera2Element = await mapConnector.execute('spatial:config', 'create', {
    elementType: 'camera',
    position: { x: 100, y: 700, z: 0 }, // 500 units north
    properties: {
      name: 'Exit Camera',
      cameraId: 'camera-002',
      type: 'anpr',
      speedLimit: 30,
      direction: 'northbound'
    }
  });

  // Create detection line between cameras
  const detectionLine = await mapConnector.execute('spatial:config', 'create', {
    elementType: 'line',
    position: { x: 100, y: 450, z: 0 }, // Midpoint
    properties: {
      name: 'Speed Detection Line',
      type: 'speed-trap',
      camera1: 'camera-001',
      camera2: 'camera-002',
      distance: 0.5, // 500m in km
      speedLimit: 30
    }
  });

  console.log('✅ Created spatial elements on map');

  // Step 3: Link map elements to detection points
  console.log('\n🔗 Linking map elements to detection points...');
  
  await mapConnector.execute('integration:connector', 'register', {
    connectorId: 'speed-calculation-main',
    context: {
      detectionPoints: [
        {
          id: 'camera-001',
          mapElementId: camera1Element.id,
          position: { lat: 51.5074, lon: -0.1278 }
        },
        {
          id: 'camera-002',
          mapElementId: camera2Element.id,
          position: { lat: 51.5120, lon: -0.1278 }
        }
      ],
      detectionLine: {
        id: 'speed-trap-001',
        mapElementId: detectionLine.id,
        camera1: 'camera-001',
        camera2: 'camera-002'
      }
    },
    capabilities: ['speed:calculation', 'detection:points', 'integration:unifi']
  });

  console.log('✅ Linked map elements to detection points');

  // Step 4: Set up event listeners for real-time monitoring
  console.log('\n📡 Setting up event listeners...');
  
  speedConnector.on('speed:calculated', (speedData) => {
    console.log(`🚗 Speed calculated: ${speedData.plateNumber} - ${speedData.speedKmh.toFixed(2)} km/h`);
    console.log(`   From: ${speedData.detection1.cameraId} to ${speedData.detection2.cameraId}`);
    console.log(`   Distance: ${speedData.distance.toFixed(3)} km, Time: ${(speedData.timeDiff / 1000).toFixed(1)}s`);
  });

  speedConnector.on('speed:alert', (alertData) => {
    console.log(`⚠️ SPEED ALERT: ${alertData.plateNumber} exceeded limit by ${alertData.excess.toFixed(2)} km/h`);
    console.log(`   Speed: ${alertData.speedKmh.toFixed(2)} km/h, Limit: ${alertData.speedLimit} km/h`);
  });

  console.log('✅ Event listeners configured');

  // Step 5: Simulate ANPR detections
  console.log('\n🎯 Simulating ANPR detections...');
  
  // Vehicle 1 - Normal speed
  console.log('\n📸 Simulating Vehicle 1 (Normal Speed)...');
  
  // Detection at camera 1
  await speedConnector.execute('speed:calculation', 'process', {
    cameraId: 'camera-001',
    plateNumber: 'ABC123',
    timestamp: new Date().toISOString(),
    confidence: 0.95,
    data: { vehicleType: 'car', color: 'blue' }
  });

  // Detection at camera 2 (30 seconds later - normal speed)
  setTimeout(async () => {
    await speedConnector.execute('speed:calculation', 'process', {
      cameraId: 'camera-002',
      plateNumber: 'ABC123',
      timestamp: new Date().toISOString(),
      confidence: 0.93,
      data: { vehicleType: 'car', color: 'blue' }
    });
  }, 30000);

  // Vehicle 2 - Speeding
  console.log('\n📸 Simulating Vehicle 2 (Speeding)...');
  
  setTimeout(async () => {
    // Detection at camera 1
    await speedConnector.execute('speed:calculation', 'process', {
      cameraId: 'camera-001',
      plateNumber: 'XYZ789',
      timestamp: new Date().toISOString(),
      confidence: 0.91,
      data: { vehicleType: 'car', color: 'red' }
    });

    // Detection at camera 2 (10 seconds later - speeding)
    setTimeout(async () => {
      await speedConnector.execute('speed:calculation', 'process', {
        cameraId: 'camera-002',
        plateNumber: 'XYZ789',
        timestamp: new Date().toISOString(),
        confidence: 0.89,
        data: { vehicleType: 'car', color: 'red' }
      });
    }, 10000);
  }, 60000);

  // Step 6: Display system status
  console.log('\n📊 System Status:');
  console.log('================');
  
  const speedStats = speedConnector.getStats();
  console.log(`Speed Calculations: ${speedStats.speedCalculation.totalCalculations}`);
  console.log(`Detection Points: ${speedStats.speedCalculation.detectionPoints}`);
  console.log(`Active Tracking: ${speedStats.speedCalculation.activeTracking}`);
  console.log(`Speed Alerts: ${speedStats.speedCalculation.totalAlerts}`);

  const mapStats = mapConnector.getStats();
  console.log(`Map Elements: ${mapStats.spatial.totalElements}`);
  console.log(`Connector Contexts: ${mapStats.spatial.totalContexts}`);

  // Step 7: API endpoints available
  console.log('\n🌐 Available API Endpoints:');
  console.log('==========================');
  console.log('GET  /api/speed/stats                    - Get speed calculation statistics');
  console.log('GET  /api/speed/calculations             - Get speed calculations');
  console.log('GET  /api/speed/alerts                   - Get speed alerts');
  console.log('GET  /api/speed/tracking/:plateNumber    - Get tracking data for plate');
  console.log('GET  /api/speed/detection-points         - List detection points');
  console.log('POST /api/speed/detection-points         - Register detection point');
  console.log('PUT  /api/speed/detection-points/:id     - Update detection point');
  console.log('DELETE /api/speed/detection-points/:id   - Remove detection point');
  console.log('POST /api/speed/connect-unifi            - Connect to UniFi Protect');
  console.log('POST /api/speed/process-anpr             - Process ANPR event manually');
  console.log('GET  /api/speed/realtime                 - Real-time speed data (SSE)');

  // Step 8: Web GUI integration
  console.log('\n🖥️ Web GUI Integration:');
  console.log('======================');
  console.log('Speed calculations and alerts will be displayed in the web GUI');
  console.log('Map will show camera locations and detection lines');
  console.log('Real-time updates via WebSocket connections');
  console.log('Speed alerts will trigger notifications');

  // Step 9: Database storage
  console.log('\n💾 Database Storage:');
  console.log('===================');
  console.log('Speed calculations stored in speed_calculations table');
  console.log('Detection points stored in detection_points table');
  console.log('Speed alerts stored in speed_alerts table');
  console.log('Plate tracking data stored in plate_tracking table');
  console.log('Spatial elements stored in spatial_elements table');

  // Step 10: Integration with existing system
  console.log('\n🔌 System Integration:');
  console.log('=====================');
  console.log('✅ Speed Calculation Connector - Logic layer');
  console.log('✅ Map Connector - Spatial configuration');
  console.log('✅ UniFi Protect Connector - Camera events');
  console.log('✅ Analytics Engine - Enhanced analytics');
  console.log('✅ Event Bus - Real-time event processing');
  console.log('✅ Web GUI Connector - User interface');
  console.log('✅ Database Service - Persistent storage');

  console.log('\n🎉 Speed Calculation System Setup Complete!');
  console.log('\nThe system is now ready to:');
  console.log('• Calculate vehicle speeds between detection points');
  console.log('• Generate speed alerts for violations');
  console.log('• Display real-time data in the web GUI');
  console.log('• Store historical data for analysis');
  console.log('• Integrate with existing UniFi Protect cameras');

  return {
    speedConnector,
    mapConnector,
    detectionPoint1,
    detectionPoint2,
    camera1Element,
    camera2Element,
    detectionLine
  };
}

/**
 * Test the speed calculation system
 */
async function testSpeedCalculation() {
  console.log('\n🧪 Testing Speed Calculation System...\n');

  const { speedConnector } = await setupSpeedCalculationSystem();

  // Wait for simulations to complete
  console.log('\n⏳ Waiting for speed calculations to complete...');
  
  setTimeout(async () => {
    console.log('\n📊 Final Results:');
    console.log('================');
    
    const stats = speedConnector.getStats();
    console.log(`Total Calculations: ${stats.speedCalculation.totalCalculations}`);
    console.log(`Total Alerts: ${stats.speedCalculation.totalAlerts}`);
    console.log(`Average Speed: ${stats.speedCalculation.averageSpeed.toFixed(2)} km/h`);
    
    const calculations = speedConnector.getSpeedCalculations();
    console.log('\nSpeed Calculations:');
    calculations.forEach((calc, index) => {
      console.log(`${index + 1}. ${calc.plateNumber}: ${calc.speedKmh.toFixed(2)} km/h`);
      console.log(`   From ${calc.detection1.cameraId} to ${calc.detection2.cameraId}`);
      console.log(`   Distance: ${calc.distance.toFixed(3)} km, Time: ${(calc.timeDiff / 1000).toFixed(1)}s`);
    });
    
    const alerts = speedConnector.getSpeedAlerts();
    if (alerts.length > 0) {
      console.log('\nSpeed Alerts:');
      alerts.forEach((alert, index) => {
        console.log(`${index + 1}. ${alert.plateNumber}: ${alert.speedKmh.toFixed(2)} km/h (Limit: ${alert.speedLimit} km/h)`);
        console.log(`   Excess: ${alert.excess.toFixed(2)} km/h`);
      });
    }
    
    console.log('\n✅ Speed calculation test completed!');
  }, 120000); // Wait 2 minutes for all simulations
}

// Run the setup if this file is executed directly
if (require.main === module) {
  testSpeedCalculation().catch(console.error);
}

module.exports = {
  setupSpeedCalculationSystem,
  testSpeedCalculation
};

/**
 * Speed Calculation Setup Example
 * 
 * This example demonstrates how to set up speed calculation using line crossing events
 * from UniFi Protect cameras with two line crossing detection points.
 */

// Simulate the speed calculation connector
class SpeedCalculationSetup {
  constructor() {
    this.detectionPoints = new Map();
    this.lineCrossingConfigs = new Map();
  }

  /**
   * Register detection points for speed calculation
   */
  async registerDetectionPoints() {
    console.log('🚗 Setting up speed calculation detection points...\n');

    // Register first camera as entry detection point
    const entryPoint = await this.registerDetectionPoint('camera-001', {
      name: 'Entry Camera',
      position: { lat: 51.5074, lon: -0.1278 },
      direction: 'northbound',
      speedLimit: 30,
      type: 'lineCrossing',
      metadata: {
        location: 'Main entrance',
        cameraModel: 'G4 Pro',
        lineCrossingEnabled: true,
        lineId: 'entry-line-1'
      }
    });

    // Register second camera as exit detection point
    const exitPoint = await this.registerDetectionPoint('camera-002', {
      name: 'Exit Camera',
      position: { lat: 51.5120, lon: -0.1278 },
      direction: 'northbound',
      speedLimit: 30,
      type: 'lineCrossing',
      metadata: {
        location: 'Main exit',
        cameraModel: 'G4 Pro',
        lineCrossingEnabled: true,
        lineId: 'exit-line-1'
      }
    });

    console.log('✅ Detection points registered successfully\n');
    return { entryPoint, exitPoint };
  }

  /**
   * Configure line crossing for speed detection
   */
  async configureLineCrossing() {
    console.log('📏 Configuring line crossing for speed detection...\n');

    // Configure entry line crossing
    const entryLineConfig = {
      cameraId: 'camera-001',
      lineId: 'entry-line-1',
      name: 'Entry Speed Detection Line',
      position: { x: 100, y: 200, z: 0 },
      direction: 'northbound',
      objectTypes: ['vehicle', 'person'],
      speedLimit: 30,
      alertThreshold: 35, // Alert if speed > 35 km/h
      metadata: {
        description: 'Entry line for speed detection',
        distanceToNext: 0.5, // km to next detection point
        expectedTravelTime: 60 // seconds at speed limit
      }
    };

    // Configure exit line crossing
    const exitLineConfig = {
      cameraId: 'camera-002',
      lineId: 'exit-line-1',
      name: 'Exit Speed Detection Line',
      position: { x: 100, y: 450, z: 0 },
      direction: 'northbound',
      objectTypes: ['vehicle', 'person'],
      speedLimit: 30,
      alertThreshold: 35,
      metadata: {
        description: 'Exit line for speed detection',
        distanceFromPrevious: 0.5, // km from previous detection point
        expectedTravelTime: 60
      }
    };

    this.lineCrossingConfigs.set('entry-line-1', entryLineConfig);
    this.lineCrossingConfigs.set('exit-line-1', exitLineConfig);

    console.log('✅ Line crossing configuration completed\n');
    return { entryLineConfig, exitLineConfig };
  }

  /**
   * Set up speed calculation rules
   */
  async setupSpeedCalculationRules() {
    console.log('⚡ Setting up speed calculation rules...\n');

    const rules = [
      {
        id: 'speed-calculation-rule-1',
        name: 'Vehicle Speed Calculation',
        description: 'Calculate vehicle speed between entry and exit cameras',
        conditions: {
          eventType: 'lineCrossing',
          objectType: 'vehicle',
          cameras: ['camera-001', 'camera-002'],
          timeWindow: 300000 // 5 minutes
        },
        actions: [
          {
            type: 'calculateSpeed',
            parameters: {
              minTimeBetweenDetections: 1000, // 1 second
              maxTimeBetweenDetections: 300000, // 5 minutes
              minSpeedThreshold: 5, // 5 km/h
              maxSpeedThreshold: 200 // 200 km/h
            }
          },
          {
            type: 'generateAlert',
            parameters: {
              threshold: 35, // Alert if speed > 35 km/h
              alertType: 'speedViolation'
            }
          }
        ]
      },
      {
        id: 'speed-calculation-rule-2',
        name: 'Person Speed Calculation',
        description: 'Calculate person speed between entry and exit cameras',
        conditions: {
          eventType: 'lineCrossing',
          objectType: 'person',
          cameras: ['camera-001', 'camera-002'],
          timeWindow: 600000 // 10 minutes
        },
        actions: [
          {
            type: 'calculateSpeed',
            parameters: {
              minTimeBetweenDetections: 5000, // 5 seconds
              maxTimeBetweenDetections: 600000, // 10 minutes
              minSpeedThreshold: 1, // 1 km/h
              maxSpeedThreshold: 50 // 50 km/h
            }
          },
          {
            type: 'generateAlert',
            parameters: {
              threshold: 20, // Alert if speed > 20 km/h (running)
              alertType: 'personSpeedViolation'
            }
          }
        ]
      }
    ];

    console.log('✅ Speed calculation rules configured\n');
    return rules;
  }

  /**
   * Simulate line crossing events
   */
  async simulateLineCrossingEvents() {
    console.log('🎭 Simulating line crossing events...\n');

    const events = [
      // Vehicle crossing entry line
      {
        type: 'smartDetectLine',
        cameraId: 'camera-001',
        trackingId: 'vehicle-001',
        objectType: 'vehicle',
        timestamp: new Date().toISOString(),
        data: {
          lineId: 'entry-line-1',
          crossingDirection: 'in',
          confidence: 0.95,
          boundingBox: { x: 100, y: 200, width: 80, height: 40 }
        }
      },
      // Vehicle crossing exit line (2 minutes later)
      {
        type: 'smartDetectLine',
        cameraId: 'camera-002',
        trackingId: 'vehicle-001',
        objectType: 'vehicle',
        timestamp: new Date(Date.now() + 120000).toISOString(), // 2 minutes later
        data: {
          lineId: 'exit-line-1',
          crossingDirection: 'out',
          confidence: 0.92,
          boundingBox: { x: 100, y: 450, width: 80, height: 40 }
        }
      },
      // Person crossing entry line
      {
        type: 'smartDetectLine',
        cameraId: 'camera-001',
        trackingId: 'person-001',
        objectType: 'person',
        timestamp: new Date().toISOString(),
        data: {
          lineId: 'entry-line-1',
          crossingDirection: 'in',
          confidence: 0.88,
          boundingBox: { x: 120, y: 200, width: 30, height: 60 }
        }
      },
      // Person crossing exit line (3 minutes later)
      {
        type: 'smartDetectLine',
        cameraId: 'camera-002',
        trackingId: 'person-001',
        objectType: 'person',
        timestamp: new Date(Date.now() + 180000).toISOString(), // 3 minutes later
        data: {
          lineId: 'exit-line-1',
          crossingDirection: 'out',
          confidence: 0.85,
          boundingBox: { x: 120, y: 450, width: 30, height: 60 }
        }
      }
    ];

    console.log('✅ Line crossing events simulated\n');
    return events;
  }

  /**
   * Register a detection point
   */
  async registerDetectionPoint(cameraId, config) {
    const detectionPoint = {
      id: cameraId,
      name: config.name,
      position: config.position,
      type: config.type,
      direction: config.direction,
      speedLimit: config.speedLimit,
      active: config.active !== false,
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        ...config.metadata
      }
    };

    this.detectionPoints.set(cameraId, detectionPoint);
    console.log(`📹 Registered detection point: ${config.name} (${cameraId})`);
    console.log(`   Position: ${JSON.stringify(config.position)}`);
    console.log(`   Type: ${config.type}`);
    console.log(`   Speed Limit: ${config.speedLimit} km/h\n`);
    
    return detectionPoint;
  }

  /**
   * Run the complete setup
   */
  async run() {
    console.log('🚀 Speed Calculation Setup Example');
    console.log('===================================\n');

    try {
      // Step 1: Register detection points
      const { entryPoint, exitPoint } = await this.registerDetectionPoints();

      // Step 2: Configure line crossing
      const { entryLineConfig, exitLineConfig } = await this.configureLineCrossing();

      // Step 3: Set up speed calculation rules
      const rules = await this.setupSpeedCalculationRules();

      // Step 4: Simulate events
      const events = await this.simulateLineCrossingEvents();

      console.log('🎯 Setup Summary:');
      console.log('================');
      console.log(`📹 Detection Points: ${this.detectionPoints.size}`);
      console.log(`📏 Line Crossings: ${this.lineCrossingConfigs.size}`);
      console.log(`⚡ Rules: ${rules.length}`);
      console.log(`🎭 Simulated Events: ${events.length}\n`);

      console.log('📋 Configuration Details:');
      console.log('========================');
      
      console.log('\nEntry Detection Point:');
      console.log(`  Camera: ${entryPoint.name} (${entryPoint.id})`);
      console.log(`  Line: ${entryLineConfig.name}`);
      console.log(`  Position: ${JSON.stringify(entryPoint.position)}`);
      console.log(`  Speed Limit: ${entryPoint.speedLimit} km/h`);

      console.log('\nExit Detection Point:');
      console.log(`  Camera: ${exitPoint.name} (${exitPoint.id})`);
      console.log(`  Line: ${exitLineConfig.name}`);
      console.log(`  Position: ${JSON.stringify(exitPoint.position)}`);
      console.log(`  Speed Limit: ${exitPoint.speedLimit} km/h`);

      console.log('\n📊 Expected Results:');
      console.log('===================');
      console.log('• Vehicle crossing both lines in 2 minutes: ~15 km/h');
      console.log('• Person crossing both lines in 3 minutes: ~10 km/h');
      console.log('• Speed alerts generated for violations > 35 km/h (vehicles)');
      console.log('• Speed alerts generated for violations > 20 km/h (persons)');

      console.log('\n✅ Speed calculation setup completed successfully!');
      console.log('\n💡 Next Steps:');
      console.log('1. Configure UniFi Protect cameras with line crossing detection');
      console.log('2. Set up the speed calculation connector in your system');
      console.log('3. Connect to UniFi Protect and subscribe to smartDetectLine events');
      console.log('4. Monitor speed calculations and alerts via the API');

    } catch (error) {
      console.error('❌ Setup failed:', error);
    }
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  const setup = new SpeedCalculationSetup();
  setup.run();
}

module.exports = SpeedCalculationSetup; 