const AircraftDataService = require('./services/aircraftDataService');

/**
 * Test Aircraft Data Storage
 * 
 * Demonstrates the aircraft data storage capabilities including:
 * - BaseStation.sqb integration for aircraft registration data
 * - babelfish.db storage for real-time tracking data
 * - Aircraft position history and events
 */

async function testAircraftDataStorage() {
  console.log('🛩️  Testing Aircraft Data Storage...\n');

  // Create aircraft data service
  const aircraftService = new AircraftDataService({
    enableBaseStation: true,
    enableTracking: true,
    maxHistoryDays: 7,
    logLevel: 'info'
  });

  try {
    // Initialize the service
    console.log('🔧 Initializing Aircraft Data Service...');
    await aircraftService.initialize();
    console.log('✅ Service initialized successfully\n');

    // Test BaseStation database integration
    console.log('📋 Testing BaseStation Database Integration...');
    
    // Get statistics
    const stats = await aircraftService.getStats();
    console.log('📊 Aircraft Registry Statistics:', {
      totalAircraft: stats.totalAircraft,
      trackedAircraft: stats.trackedAircraft,
      totalEvents: stats.totalEvents
    });

    // Search for some aircraft
    console.log('\n🔍 Searching for Boeing aircraft...');
    const boeingSearch = await aircraftService.searchAircraft({
      manufacturer: 'Boeing',
      limit: 5
    });
    
    console.log(`Found ${boeingSearch.count} Boeing aircraft:`);
    boeingSearch.aircraft.forEach(aircraft => {
      console.log(`  - ${aircraft.registration} (${aircraft.icao24}): ${aircraft.type}`);
    });

    // Search for Airbus aircraft
    console.log('\n🔍 Searching for Airbus aircraft...');
    const airbusSearch = await aircraftService.searchAircraft({
      manufacturer: 'Airbus',
      limit: 5
    });
    
    console.log(`Found ${airbusSearch.count} Airbus aircraft:`);
    airbusSearch.aircraft.forEach(aircraft => {
      console.log(`  - ${aircraft.registration} (${aircraft.icao24}): ${aircraft.type}`);
    });

    // Test aircraft registration lookup
    if (boeingSearch.aircraft.length > 0) {
      const testAircraft = boeingSearch.aircraft[0];
      console.log(`\n🔍 Looking up aircraft: ${testAircraft.icao24}`);
      const registration = await aircraftService.getAircraftRegistration(testAircraft.icao24);
      console.log('Registration data:', registration);
    }

    // Test real-time tracking data storage
    console.log('\n📡 Testing Real-time Tracking Data Storage...');
    
    // Simulate some aircraft positions
    const testAircraft = [
      {
        icao24: '400591',
        callsign: 'BAW123',
        lat: 51.5074,
        lon: -0.1278,
        altitude: 35000,
        speed: 450,
        track: 90,
        vertical_rate: 0,
        squawk: '1234'
      },
      {
        icao24: '400511',
        callsign: 'EZY456',
        lat: 51.5174,
        lon: -0.1178,
        altitude: 28000,
        speed: 380,
        track: 180,
        vertical_rate: -500,
        squawk: '5678'
      },
      {
        icao24: '4B8475',
        callsign: 'THY789',
        lat: 51.4974,
        lon: -0.1378,
        altitude: 42000,
        speed: 520,
        track: 270,
        vertical_rate: 200,
        squawk: '9999'
      }
    ];

    // Store aircraft positions
    for (const aircraft of testAircraft) {
      await aircraftService.storeAircraftPosition(aircraft);
      console.log(`✅ Stored position for ${aircraft.callsign} (${aircraft.icao24})`);
    }

    // Store some events
    console.log('\n📝 Storing Aircraft Events...');
    
    await aircraftService.storeAircraftEvent('400591', 'emergency', {
      squawk: '7500',
      description: 'Hijacking alert',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Stored emergency event for BAW123');

    await aircraftService.storeAircraftEvent('400511', 'zone_entered', {
      zoneName: 'London CTR',
      zoneType: 'controlled',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Stored zone event for EZY456');

    await aircraftService.storeAircraftEvent('4B8475', 'squawk_change', {
      oldSquawk: '1234',
      newSquawk: '9999',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Stored squawk change event for THY789');

    // Test retrieving data
    console.log('\n📊 Testing Data Retrieval...');
    
    // Get aircraft history
    const history = await aircraftService.getAircraftHistory('400591', 1);
    console.log(`📈 Aircraft 400591 has ${history.length} position records in the last hour`);

    // Get recent events
    const events = await aircraftService.getRecentEvents(1);
    console.log(`📋 Found ${events.length} events in the last hour:`);
    events.forEach(event => {
      console.log(`  - ${event.event_type}: ${event.icao24} at ${event.timestamp}`);
    });

    // Get emergency events
    const emergencyEvents = await aircraftService.getRecentEvents(1, 'emergency');
    console.log(`🚨 Found ${emergencyEvents.length} emergency events in the last hour`);

    // Get updated statistics
    const updatedStats = await aircraftService.getStats();
    console.log('\n📊 Updated Statistics:', {
      totalAircraft: updatedStats.totalAircraft,
      trackedAircraft: updatedStats.trackedAircraft,
      positionsLastHour: updatedStats.positionsLastHour,
      eventsLastHour: updatedStats.eventsLastHour,
      activeFlights: updatedStats.activeFlights
    });

    console.log('\n✅ Aircraft Data Storage Test Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('  - BaseStation.sqb: Aircraft registration data (read-only)');
    console.log('  - babelfish.db: Real-time tracking and events (read/write)');
    console.log('  - Memory cache: Performance optimization');
    console.log('  - Automatic cleanup: Data retention management');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up
    await aircraftService.close();
    console.log('\n🔒 Service closed');
  }
}

// Run the test
testAircraftDataStorage().catch(console.error); 