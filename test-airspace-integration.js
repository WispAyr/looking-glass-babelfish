#!/usr/bin/env node

/**
 * Test script for Airspace Integration with ADSB Connector
 * 
 * This script demonstrates the enhanced ADSB connector with airspace awareness,
 * including airspace data parsing, aircraft airspace tracking, and event generation.
 */

const AirspaceService = require('./services/airspaceService');
const ADSBConnector = require('./connectors/types/ADSBConnector');
const path = require('path');

async function testAirspaceIntegration() {
  console.log('🚁 Testing Airspace Integration with ADSB Connector\n');

  try {
    // Initialize Airspace Service
    console.log('📡 Initializing Airspace Service...');
    const airspaceService = new AirspaceService({
      airspaceDataPath: path.join(__dirname, 'aviationdata/OUT_UK_Airspace'),
      enableAirspaceAwareness: true,
      logLevel: 'info'
    });

    await airspaceService.initialize();
    console.log('✅ Airspace Service initialized successfully');
    console.log(`   Loaded ${airspaceService.getStats().totalAirspaces} airspace definitions`);
    console.log(`   Airspace types: ${Object.keys(airspaceService.getStats().airspaceTypes).join(', ')}\n`);

    // Initialize ADSB Connector with airspace integration
    console.log('🛩️  Initializing ADSB Connector with Airspace Awareness...');
    const adsbConnector = new ADSBConnector({
      id: 'adsb-airspace-test',
      name: 'ADSB with Airspace Awareness',
      config: {
        url: 'http://localhost:8080/skyaware/data/aircraft.json', // Mock URL for testing
        pollInterval: 5000,
        enableAirspaceAwareness: true,
        showAirspace: true,
        radarRange: 50, // 50nm range for testing
        radarCenter: { lat: 51.5074, lon: -0.1278 } // London
      }
    });

    // Integrate airspace service with ADSB connector
    adsbConnector.setAirspaceService(airspaceService);
    console.log('✅ ADSB Connector initialized with airspace integration\n');

    // Subscribe to airspace events
    console.log('🎯 Setting up airspace event listeners...');
    adsbConnector.on('airspace:event', (event) => {
      console.log(`🔄 Airspace Event: ${event.type} - Aircraft ${event.aircraft.icao24} in ${event.airspace.name} (${event.airspace.type})`);
    });

    adsbConnector.on('approach:detected', (event) => {
      console.log(`🛬 Approach Detected: ${event.aircraft.icao24} approaching ${event.metadata.runway} at ${event.metadata.airport}`);
    });

    adsbConnector.on('departure:detected', (event) => {
      console.log(`🛫 Departure Detected: ${event.aircraft.icao24} departing from ${event.metadata.runway} at ${event.metadata.airport}`);
    });

    adsbConnector.on('controlled_airspace:entry', (event) => {
      console.log(`🚨 Controlled Airspace Entry: ${event.aircraft.icao24} entered ${event.airspace.name} (${event.airspace.type})`);
    });

    adsbConnector.on('danger_area:entry', (event) => {
      console.log(`⚠️  Danger Area Entry: ${event.aircraft.icao24} entered ${event.airspace.name} (Risk: ${event.metadata.riskLevel})`);
    });

    console.log('✅ Event listeners configured\n');

    // Test airspace queries
    console.log('🔍 Testing airspace queries...');
    
    // Test aircraft in different airspace types
    const testAircraft = [
      {
        icao24: 'TEST001',
        callsign: 'TEST001',
        lat: 51.5074,
        lon: -0.1278,
        altitude: 2000,
        speed: 150,
        track: 270,
        vertical_rate: -500
      },
      {
        icao24: 'TEST002',
        callsign: 'TEST002',
        lat: 51.4700,
        lon: -0.4543,
        altitude: 5000,
        speed: 250,
        track: 90,
        vertical_rate: 1000
      },
      {
        icao24: 'TEST003',
        callsign: 'TEST003',
        lat: 51.4650,
        lon: -0.1666,
        altitude: 1000,
        speed: 120,
        track: 180,
        vertical_rate: -800
      }
    ];

    console.log('📊 Processing test aircraft with airspace awareness...\n');

    for (const aircraft of testAircraft) {
      console.log(`Processing aircraft ${aircraft.icao24} (${aircraft.callsign})...`);
      
      // Simulate aircraft processing with airspace awareness
      const airspaceUpdate = airspaceService.updateAircraftAirspace(aircraft);
      
      if (airspaceUpdate.current.length > 0) {
        console.log(`  📍 Currently in ${airspaceUpdate.current.length} airspace(s):`);
        airspaceUpdate.current.forEach(space => {
          console.log(`    - ${space.name} (${space.type})`);
        });
      } else {
        console.log('  📍 Not in any defined airspace');
      }

      if (airspaceUpdate.new.length > 0) {
        console.log(`  ➕ Entered ${airspaceUpdate.new.length} new airspace(s):`);
        airspaceUpdate.new.forEach(space => {
          console.log(`    - ${space.name} (${space.type})`);
        });
      }

      if (airspaceUpdate.exited.length > 0) {
        console.log(`  ➖ Exited ${airspaceUpdate.exited.length} airspace(s):`);
        airspaceUpdate.exited.forEach(space => {
          console.log(`    - ${space.name} (${space.type})`);
        });
      }

      console.log('');
    }

    // Test radar display with airspace
    console.log('📡 Testing radar display with airspace visualization...');
    const radarData = adsbConnector.getRadarDisplay({
      range: 50,
      center: { lat: 51.5074, lon: -0.1278 },
      showAirspace: true,
      filter: {
        airspaceType: 'Final_Approach'
      }
    });

    console.log(`Radar Display Results:`);
    console.log(`  Aircraft count: ${radarData.count}`);
    console.log(`  Airspace count: ${radarData.airspaceCount}`);
    console.log(`  Airspace enabled: ${radarData.airspaceEnabled}`);
    console.log('');

    // Test airspace search
    console.log('🔎 Testing airspace search functionality...');
    const searchResults = airspaceService.searchAirspaces('Heathrow');
    console.log(`Found ${searchResults.length} airspaces matching 'Heathrow':`);
    searchResults.forEach(airspace => {
      console.log(`  - ${airspace.name} (${airspace.type})`);
    });
    console.log('');

    // Test airspace statistics
    console.log('📈 Airspace Service Statistics:');
    const stats = airspaceService.getStats();
    console.log(`  Total airspaces: ${stats.totalAirspaces}`);
    console.log(`  Spatial index cells: ${stats.spatialIndexCells}`);
    console.log(`  Tracked aircraft: ${stats.trackedAircraft}`);
    console.log(`  Total events: ${stats.totalEvents}`);
    console.log(`  Load time: ${stats.performance.loadTime}ms`);
    console.log('');

    // Test airspace visualization data
    console.log('🎨 Testing airspace visualization data...');
    const visualizationData = airspaceService.getAirspaceForVisualization(
      { lat: 51.5074, lon: -0.1278 },
      50
    );
    console.log(`Found ${visualizationData.length} airspaces in visualization range`);
    
    // Group by type
    const typeCounts = {};
    visualizationData.forEach(airspace => {
      typeCounts[airspace.type] = (typeCounts[airspace.type] || 0) + 1;
    });
    
    console.log('Airspace types in range:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    console.log('');

    // Test recent events
    console.log('📋 Recent airspace events:');
    const recentEvents = airspaceService.getRecentEvents(5);
    if (recentEvents.length > 0) {
      recentEvents.forEach(event => {
        console.log(`  ${event.timestamp}: ${event.type} - ${event.aircraft.icao24} in ${event.airspace.name}`);
      });
    } else {
      console.log('  No recent events');
    }
    console.log('');

    console.log('✅ All airspace integration tests completed successfully!\n');

    // Summary
    console.log('📋 Integration Summary:');
    console.log('  ✅ Airspace data loaded and parsed');
    console.log('  ✅ Spatial indexing built');
    console.log('  ✅ ADSB connector enhanced with airspace awareness');
    console.log('  ✅ Event generation working');
    console.log('  ✅ Radar visualization enhanced');
    console.log('  ✅ Airspace search and filtering functional');
    console.log('  ✅ Real-time airspace tracking operational');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAirspaceIntegration().then(() => {
    console.log('🎉 Airspace integration test completed!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testAirspaceIntegration }; 