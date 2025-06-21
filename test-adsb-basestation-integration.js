const ADSBConnector = require('./connectors/types/ADSBConnector');

/**
 * Test script for ADSB Connector with BaseStation.sqb integration
 * 
 * This script demonstrates the enhanced functionality of the ADSB connector
 * including BaseStation database integration for aircraft registration data.
 */

async function testBaseStationIntegration() {
  console.log('🚁 Testing ADSB Connector with BaseStation Integration...\n');

  // Create connector instance with BaseStation integration
  const connector = new ADSBConnector({
    id: 'test-adsb-basestation-connector',
    name: 'Test ADSB Connector with BaseStation',
    description: 'Test connector with BaseStation.sqb integration',
    config: {
      url: 'http://10.0.1.180/skyaware/data/aircraft.json',
      pollInterval: 15000, // 15 seconds for testing
      emergencyCodes: ['7500', '7600', '7700'],
      radarRange: 50,
      radarCenter: {
        lat: 55.5074, // Glasgow coordinates
        lon: -4.5933
      },
      // BaseStation integration settings
      enableBaseStationIntegration: true,
      baseStationDbPath: './aviationdata/BaseStation.sqb'
    }
  });

  // Set up event listeners
  connector.on('aircraft:appeared', (aircraft) => {
    console.log(`✈️  Aircraft appeared: ${aircraft.displayName || aircraft.callsign || aircraft.icao24}`);
    if (aircraft.registration) {
      console.log(`   📋 Registration: ${aircraft.registration}`);
    }
    if (aircraft.manufacturer && aircraft.type) {
      console.log(`   🏭 Aircraft: ${aircraft.manufacturer} ${aircraft.type}`);
    }
  });

  connector.on('aircraft:disappeared', (aircraft) => {
    console.log(`👋 Aircraft disappeared: ${aircraft.displayName || aircraft.callsign || aircraft.icao24}`);
  });

  connector.on('aircraft:emergency', (emergency) => {
    console.log(`🚨 EMERGENCY: Aircraft ${emergency.aircraft.displayName || emergency.aircraft.callsign || emergency.aircraft.icao24} squawking ${emergency.squawk}`);
  });

  try {
    // Connect to dump1090 and BaseStation database
    console.log('🔌 Connecting to dump1090 and BaseStation database...');
    await connector.connect();
    console.log('✅ Connected successfully\n');

    // Wait a moment for initial data
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test BaseStation database capabilities
    console.log('📊 Testing BaseStation database capabilities...\n');

    // Test aircraft search
    console.log('🔍 Testing aircraft search...');
    const searchResults = await connector.execute('basestation:database', 'search', {
      manufacturer: 'Boeing',
      limit: 5
    });
    console.log(`Found ${searchResults.count} Boeing aircraft in database`);
    if (searchResults.aircraft.length > 0) {
      console.log('Sample aircraft:', {
        icao24: searchResults.aircraft[0].icao24,
        registration: searchResults.aircraft[0].registration,
        type: searchResults.aircraft[0].type,
        manufacturer: searchResults.aircraft[0].manufacturer
      });
    }
    console.log('');

    // Test aircraft lookup
    if (searchResults.aircraft.length > 0) {
      console.log('🔎 Testing aircraft lookup...');
      const lookupResult = await connector.execute('basestation:database', 'lookup', {
        icao24: searchResults.aircraft[0].icao24
      });
      console.log('Lookup result:', lookupResult);
      console.log('');
    }

    // Test database statistics
    console.log('📈 Testing database statistics...');
    const stats = await connector.execute('basestation:database', 'stats', {});
    console.log('BaseStation database stats:', stats.baseStation);
    console.log('');

    // Test aircraft export
    console.log('📤 Testing aircraft export...');
    const exportResult = await connector.execute('basestation:database', 'export', {
      manufacturer: 'Airbus',
      limit: 3,
      format: 'json'
    });
    console.log(`Exported ${exportResult.count} Airbus aircraft`);
    console.log('');

    // Test aircraft tracking with enhanced data
    console.log('📡 Testing aircraft tracking with BaseStation data...');
    const aircraft = await connector.execute('aircraft:tracking', 'get', {});
    console.log(`Found ${aircraft.count} aircraft in real-time`);
    
    if (aircraft.aircraft.length > 0) {
      const sampleAircraft = aircraft.aircraft[0];
      console.log('Sample aircraft with registration data:', {
        icao24: sampleAircraft.icao24,
        displayName: sampleAircraft.displayName,
        callsign: sampleAircraft.callsign,
        registration: sampleAircraft.registration,
        type: sampleAircraft.type,
        manufacturer: sampleAircraft.manufacturer,
        lat: sampleAircraft.lat,
        lon: sampleAircraft.lon,
        altitude: sampleAircraft.altitude,
        speed: sampleAircraft.speed
      });
    }
    console.log('');

    // Test radar display with enhanced data
    console.log('🛰️  Testing radar display with registration data...');
    const radarData = await connector.execute('radar:display', 'get', {
      range: 100,
      filter: {
        min_altitude: 0
      }
    });
    console.log(`Radar shows ${radarData.count} aircraft`);
    
    if (radarData.aircraft.length > 0) {
      const radarAircraft = radarData.aircraft[0];
      console.log('Sample radar aircraft:', {
        displayName: radarAircraft.displayName,
        registration: radarAircraft.registration,
        distance: radarAircraft.distance,
        bearing: radarAircraft.bearing,
        altitude: radarAircraft.altitude
      });
    }
    console.log('');

    // Test zone management
    console.log('🗺️  Testing zone management...');
    
    // Create a test zone
    const testZone = await connector.execute('zones:management', 'create', {
      name: 'Test Zone - Glasgow Area',
      zoneType: 'custom',
      coordinates: [
        { lat: 55.5074, lon: -4.5933 }, // Glasgow center
        { lat: 55.5174, lon: -4.5933 }, // North
        { lat: 55.5174, lon: -4.5833 }, // Northeast
        { lat: 55.5074, lon: -4.5833 }, // East
        { lat: 55.4974, lon: -4.5833 }, // Southeast
        { lat: 55.4974, lon: -4.5933 }, // South
        { lat: 55.4974, lon: -4.6033 }, // Southwest
        { lat: 55.5074, lon: -4.6033 }, // West
        { lat: 55.5174, lon: -4.6033 }, // Northwest
        { lat: 55.5074, lon: -4.5933 }  // Back to center
      ],
      properties: {
        description: 'Test zone for Glasgow area with BaseStation integration',
        radius: '5km'
      }
    });
    console.log('Created test zone:', testZone.id);

    // List zones
    const zones = await connector.execute('zones:management', 'list', {});
    console.log(`Total zones: ${zones.count}`);
    console.log('');

    // Monitor for a while
    console.log('⏱️  Monitoring for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Get final statistics
    console.log('📊 Final statistics:');
    const finalStats = await connector.execute('basestation:database', 'stats', {});
    console.log('Performance:', finalStats.performance);
    console.log('BaseStation:', finalStats.baseStation);

    console.log('\n✅ BaseStation integration test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Disconnect
    await connector.disconnect();
    console.log('🔌 Disconnected');
  }
}

// Run the test
if (require.main === module) {
  testBaseStationIntegration().catch(console.error);
}

module.exports = { testBaseStationIntegration }; 