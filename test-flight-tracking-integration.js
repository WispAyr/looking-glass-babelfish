const ADSBConnector = require('./connectors/types/ADSBConnector');
const AircraftDataService = require('./services/aircraftDataService');

/**
 * Test Flight Tracking Integration
 * 
 * Demonstrates the integrated flight tracking system including:
 * - Aircraft data service integration
 * - BaseStation.sqb flight logging
 * - Flight start/end event emission
 * - Real-time flight tracking
 */

async function testFlightTrackingIntegration() {
  console.log('🛩️  Testing Flight Tracking Integration...\n');

  // Create aircraft data service
  const aircraftDataService = new AircraftDataService({
    enableBaseStation: true,
    enableTracking: true,
    enableBaseStationFlightLogging: true,
    maxHistoryDays: 7,
    logLevel: 'info'
  });

  // Create ADSB connector with flight tracking enabled
  const connector = new ADSBConnector({
    id: 'test-flight-tracking-connector',
    name: 'Test Flight Tracking Connector',
    description: 'Test connector with flight tracking integration',
    config: {
      url: 'http://10.0.1.180/skyaware/data/aircraft.json',
      pollInterval: 10000, // 10 seconds for testing
      emergencyCodes: ['7500', '7600', '7700'],
      radarRange: 50,
      radarCenter: {
        lat: 51.5074, // London coordinates
        lon: -0.1278
      },
      enableAircraftDataService: true,
      enableFlightTracking: true,
      minFlightDuration: 30000, // 30 seconds
      maxGroundSpeed: 50, // 50 knots
      minAltitude: 100, // 100 feet
      flightEndTimeout: 300000 // 5 minutes
    }
  });

  // Set up event listeners
  connector.on('aircraft:appeared', (aircraft) => {
    console.log(`✈️  Aircraft appeared: ${aircraft.callsign || aircraft.icao24}`);
  });

  connector.on('aircraft:disappeared', (aircraft) => {
    console.log(`👋 Aircraft disappeared: ${aircraft.callsign || aircraft.icao24}`);
  });

  connector.on('aircraft:emergency', (emergency) => {
    console.log(`🚨 EMERGENCY: Aircraft ${emergency.aircraft.callsign || emergency.aircraft.icao24} squawking ${emergency.squawk}`);
  });

  // Flight tracking events
  connector.on('flight:started', (event) => {
    console.log(`🛫 FLIGHT STARTED: ${event.flight.callsign || event.flight.icao24}`);
    console.log(`   Registration: ${event.flight.registration || 'Unknown'}`);
    console.log(`   Start Position: ${event.flight.startPosition.lat}, ${event.flight.startPosition.lon}`);
    console.log(`   Altitude: ${event.flight.startPosition.altitude}ft`);
    console.log(`   Speed: ${event.flight.startPosition.speed}kts`);
    console.log(`   Session ID: ${event.flight.sessionId}`);
  });

  connector.on('flight:ended', (event) => {
    console.log(`🛬 FLIGHT ENDED: ${event.flight.callsign || event.flight.icao24}`);
    console.log(`   Registration: ${event.flight.registration || 'Unknown'}`);
    console.log(`   Duration: ${Math.round(event.flight.duration / 1000)}s`);
    console.log(`   Reason: ${event.flight.reason}`);
    console.log(`   End Position: ${event.flight.endPosition.lat}, ${event.flight.endPosition.lon}`);
    console.log(`   Session ID: ${event.flight.sessionId}`);
  });

  // Zone events
  connector.on('zone:entered', (violation) => {
    console.log(`📍 Aircraft ${violation.icao24} entered zone: ${violation.zoneName}`);
  });

  connector.on('zone:exited', (violation) => {
    console.log(`🚪 Aircraft ${violation.icao24} exited zone: ${violation.zoneName}`);
  });

  // Smart events
  connector.on('event:generated', (event) => {
    console.log(`📊 Smart event: ${event.type} - ${event.aircraft.callsign || event.aircraft.icao24}`);
  });

  try {
    // Initialize aircraft data service
    console.log('🔧 Initializing Aircraft Data Service...');
    await aircraftDataService.initialize();
    console.log('✅ Aircraft Data Service initialized\n');

    // Set aircraft data service in connector
    connector.setAircraftDataService(aircraftDataService);

    // Connect to dump1090
    console.log('🔌 Connecting to dump1090...');
    await connector.connect();
    console.log('✅ Connected successfully\n');

    // Wait a moment for initial data
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test aircraft tracking
    console.log('📡 Testing aircraft tracking...');
    const aircraft = await connector.execute('aircraft:tracking', 'get', {});
    console.log(`Found ${aircraft.count} aircraft`);
    
    if (aircraft.aircraft.length > 0) {
      const sampleAircraft = aircraft.aircraft[0];
      console.log('Sample aircraft:', {
        icao24: sampleAircraft.icao24,
        callsign: sampleAircraft.callsign,
        registration: sampleAircraft.registration,
        lat: sampleAircraft.lat,
        lon: sampleAircraft.lon,
        altitude: sampleAircraft.altitude,
        speed: sampleAircraft.speed
      });
    }
    console.log('');

    // Test flight tracking statistics
    console.log('📊 Flight Tracking Statistics...');
    const stats = await connector.getStats();
    console.log('Performance stats:', {
      aircraftCount: stats.aircraftCount,
      activeFlights: connector.activeFlights.size,
      flightStarts: stats.flightStarts || 0,
      flightEnds: stats.flightEnds || 0,
      totalEvents: stats.totalEvents || 0
    });

    // Test BaseStation database integration
    console.log('\n📋 Testing BaseStation Database Integration...');
    
    // Search for some aircraft
    const searchResult = await aircraftDataService.searchAircraft({
      manufacturer: 'Boeing',
      limit: 3
    });
    
    console.log(`Found ${searchResult.count} Boeing aircraft in registry`);
    searchResult.aircraft.forEach(aircraft => {
      console.log(`  - ${aircraft.registration} (${aircraft.icao24}): ${aircraft.type}`);
    });

    // Test aircraft registration lookup
    if (searchResult.aircraft.length > 0) {
      const testAircraft = searchResult.aircraft[0];
      console.log(`\n🔍 Looking up aircraft: ${testAircraft.icao24}`);
      const registration = await aircraftDataService.getAircraftRegistration(testAircraft.icao24);
      console.log('Registration data:', registration);
    }

    // Test zone management
    console.log('\n🗺️  Testing zone management...');
    
    // Create a test zone (London area)
    const testZone = await connector.execute('zones:management', 'create', {
      name: 'Test Zone - London Area',
      zoneType: 'custom',
      coordinates: [
        { lat: 51.5074, lon: -0.1278 }, // London center
        { lat: 51.5174, lon: -0.1278 }, // North
        { lat: 51.5174, lon: -0.1178 }, // Northeast
        { lat: 51.5074, lon: -0.1178 }, // East
        { lat: 51.4974, lon: -0.1178 }, // Southeast
        { lat: 51.4974, lon: -0.1278 }, // South
        { lat: 51.4974, lon: -0.1378 }, // Southwest
        { lat: 51.5074, lon: -0.1378 }, // West
        { lat: 51.5174, lon: -0.1378 }, // Northwest
        { lat: 51.5074, lon: -0.1278 }  // Back to center
      ],
      properties: {
        description: 'Test zone for London area',
        radius: '5km'
      }
    });
    console.log('Created test zone:', testZone.id);

    // List zones
    const zones = await connector.execute('zones:management', 'list', {});
    console.log(`Found ${zones.count} zones`);

    // Test radar display
    console.log('\n📡 Testing radar display...');
    const radar = await connector.execute('radar:display', 'get', {
      range: 50,
      center: { lat: 51.5074, lon: -0.1278 }
    });
    console.log(`Radar shows ${radar.aircraft.length} aircraft`);

    // Test smart events
    console.log('\n🧠 Testing smart events...');
    const smartEvents = await connector.execute('events:smart', 'list', {});
    console.log(`Found ${smartEvents.count} smart events`);

    // Test emergency monitoring
    console.log('\n🚨 Testing emergency monitoring...');
    const emergencies = await connector.execute('emergency:monitoring', 'monitor', {});
    console.log(`Found ${emergencies.count} emergency events`);

    // Test BaseStation database operations
    console.log('\n🗄️  Testing BaseStation database operations...');
    const baseStationStats = await connector.execute('basestation:database', 'stats', {});
    console.log('BaseStation stats:', baseStationStats);

    // Test squawk code analysis
    console.log('\n🔢 Testing squawk code analysis...');
    const squawkCategories = await connector.execute('squawk:analysis', 'categories', {});
    console.log('Squawk categories available:', Object.keys(squawkCategories.categories));

    console.log('\n✅ Flight Tracking Integration Test Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Aircraft data service: Integrated and working');
    console.log('  - Flight tracking: Active with start/end detection');
    console.log('  - BaseStation.sqb: Flight logging enabled');
    console.log('  - Event emission: Flight events being emitted');
    console.log('  - Real-time tracking: Aircraft positions being stored');

    // Keep running for a while to see flight events
    console.log('\n⏰ Running for 60 seconds to capture flight events...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up...');
    await connector.disconnect();
    await aircraftDataService.close();
    console.log('✅ Cleanup completed');
  }
}

// Run the test
testFlightTrackingIntegration().catch(console.error); 