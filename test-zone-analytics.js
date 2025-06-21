#!/usr/bin/env node

/**
 * Test script for Zone Management and Analytics
 * 
 * Demonstrates the new context-aware monitoring system with zones,
 * camera assignments, and derived analytics like speed calculations.
 */

const ZoneManager = require('./services/zoneManager');
const AnalyticsEngine = require('./services/analyticsEngine');
const DashboardService = require('./services/dashboardService');

async function testZoneAnalytics() {
  console.log('🚀 Testing Zone Management and Analytics System\n');

  // Initialize services
  const config = {
    analytics: {
      enabled: true,
      zoneManager: { enabled: true },
      analyticsEngine: { enabled: true }
    },
    dashboard: {
      enabled: true,
      refreshInterval: 5000
    }
  };

  const logger = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    debug: (msg) => console.log(`🔍 ${msg}`),
    warn: (msg) => console.log(`⚠️  ${msg}`),
    error: (msg) => console.log(`❌ ${msg}`)
  };

  const zoneManager = new ZoneManager(config, logger);
  const analyticsEngine = new AnalyticsEngine(config, logger);
  const dashboardService = new DashboardService(config, logger);

  // Set up analytics engine with zone manager
  analyticsEngine.setZoneManager(zoneManager);

  // Initialize dashboard service
  await dashboardService.initialize({
    zoneManager,
    analyticsEngine,
    entityManager: null,
    eventProcessor: null
  });

  console.log('✅ Services initialized\n');

  // Create zones
  console.log('📍 Creating zones...');
  
  const zone1 = await zoneManager.createZone({
    name: 'Entry Zone',
    type: 'entry',
    description: 'Main entry point to the facility',
    location: { x: 0, y: 0 },
    active: true
  });

  const zone2 = await zoneManager.createZone({
    name: 'Parking Zone',
    type: 'parking',
    description: 'Main parking area',
    location: { x: 100, y: 0 },
    active: true
  });

  const zone3 = await zoneManager.createZone({
    name: 'Exit Zone',
    type: 'exit',
    description: 'Main exit point from the facility',
    location: { x: 200, y: 0 },
    active: true
  });

  console.log(`✅ Created zones: ${zone1.name}, ${zone2.name}, ${zone3.name}\n`);

  // Assign cameras to zones
  console.log('📹 Assigning cameras to zones...');
  
  await zoneManager.assignCameraToZone('camera-001', zone1.id, { coverage: 0.8 });
  await zoneManager.assignCameraToZone('camera-002', zone1.id, { coverage: 0.6 });
  await zoneManager.assignCameraToZone('camera-003', zone2.id, { coverage: 0.9 });
  await zoneManager.assignCameraToZone('camera-004', zone3.id, { coverage: 0.7 });

  console.log('✅ Cameras assigned to zones\n');

  // Simulate camera events
  console.log('📡 Simulating camera events...');

  // Person enters entry zone
  await analyticsEngine.processEvent({
    cameraId: 'camera-001',
    eventType: 'personDetected',
    data: {
      zone: zone1.id,
      direction: 'entered',
      confidence: 0.95
    },
    timestamp: new Date().toISOString()
  });

  // Vehicle detected with plate
  await analyticsEngine.processEvent({
    cameraId: 'camera-001',
    eventType: 'plateDetected',
    data: {
      plateNumber: 'ABC123',
      zone: zone1.id,
      confidence: 0.92
    },
    timestamp: new Date().toISOString()
  });

  // Same vehicle detected in parking zone (speed calculation)
  setTimeout(async () => {
    await analyticsEngine.processEvent({
      cameraId: 'camera-003',
      eventType: 'plateDetected',
      data: {
        plateNumber: 'ABC123',
        zone: zone2.id,
        confidence: 0.94
      },
      timestamp: new Date().toISOString()
    });

    console.log('✅ Speed calculation triggered\n');
  }, 2000);

  // Person enters parking zone
  setTimeout(async () => {
    await analyticsEngine.processEvent({
      cameraId: 'camera-003',
      eventType: 'personDetected',
      data: {
        zone: zone2.id,
        direction: 'entered',
        confidence: 0.88
      },
      timestamp: new Date().toISOString()
    });

    console.log('✅ Person count updated\n');
  }, 3000);

  // Vehicle exits
  setTimeout(async () => {
    await analyticsEngine.processEvent({
      cameraId: 'camera-004',
      eventType: 'plateDetected',
      data: {
        plateNumber: 'ABC123',
        zone: zone3.id,
        confidence: 0.91
      },
      timestamp: new Date().toISOString()
    });

    console.log('✅ Vehicle exit detected\n');
  }, 5000);

  // Display results after a delay
  setTimeout(async () => {
    console.log('\n📊 Analytics Results:');
    console.log('====================');

    // Zone analytics
    console.log('\n📍 Zone Analytics:');
    const zones = zoneManager.exportZones();
    zones.forEach(zone => {
      const analytics = zoneManager.getZoneAnalytics(zone.id);
      console.log(`  ${zone.name}:`);
      console.log(`    People: ${analytics.currentCount}`);
      console.log(`    Total Events: ${analytics.totalEvents}`);
      console.log(`    Last Event: ${analytics.lastEvent ? new Date(analytics.lastEvent).toLocaleTimeString() : 'None'}`);
    });

    // Speed calculations
    console.log('\n🚗 Speed Calculations:');
    const speedCalculations = analyticsEngine.getSpeedCalculations();
    speedCalculations.forEach(calc => {
      console.log(`  ${calc.plateNumber}: ${calc.speedKmh.toFixed(2)} km/h`);
      console.log(`    From: ${calc.zone1Id} to ${calc.zone2Id}`);
      console.log(`    Time: ${new Date(calc.timestamp1).toLocaleTimeString()} - ${new Date(calc.timestamp2).toLocaleTimeString()}`);
    });

    // People counts
    console.log('\n👥 People Counts:');
    zones.forEach(zone => {
      const count = analyticsEngine.getPeopleCount(zone.id);
      console.log(`  ${zone.name}: ${count} people`);
    });

    // Dashboard data
    console.log('\n📈 Dashboard Overview:');
    const overview = dashboardService.getOverview();
    console.log(`  Total Zones: ${overview.totalZones}`);
    console.log(`  Total Cameras: ${overview.totalCameras}`);
    console.log(`  People Count: ${overview.peopleCount}`);
    console.log(`  Speed Violations: ${overview.speedViolations}`);

    console.log('\n✅ Test completed successfully!');
    console.log('\n🌐 Access the dashboard at: http://localhost:3000/dashboard.html');
    console.log('📊 API endpoints available at: http://localhost:3000/api/analytics/');

    process.exit(0);
  }, 7000);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

// Run the test
testZoneAnalytics().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 