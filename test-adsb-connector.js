const ADSBConnector = require('./connectors/types/ADSBConnector');
const path = require('path');

/**
 * Test script for ADSB Connector
 * 
 * This script demonstrates the basic functionality of the ADSB connector
 * including aircraft tracking, zone management, and radar display.
 */

async function testADSBConnector() {
  console.log('🚁 Testing ADSB Connector...\n');

  // Create connector instance
  const connector = new ADSBConnector({
    id: 'test-adsb-connector',
    type: 'adsb',
    name: 'Test ADSB Connector',
    description: 'Test connector for ADS-B data',
    config: {
      url: 'http://localhost:8080/skyaware/data/aircraft.json',
      pollInterval: 10000,
      emergencyCodes: ['7500', '7600', '7700'],
      maxAircraftAge: 300000,
      radarRange: 50,
      radarCenter: { lat: 55.5074, lon: -4.5933 },
      enableSquawkCodeAnalysis: true,
      enableBaseStationIntegration: true,
      enableAirspaceAwareness: true,
      enableFlightTracking: true,
      enableAircraftDataService: true,
      baseStationDbPath: path.join(__dirname, 'aviationdata', 'BaseStation.sqb')
    },
    capabilities: {
      enabled: ['aircraft:tracking', 'zones:management', 'radar:display'],
      disabled: []
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

  connector.on('zone:entered', (violation) => {
    console.log(`📍 Aircraft ${violation.icao24} entered zone: ${violation.zoneName}`);
  });

  connector.on('zone:exited', (violation) => {
    console.log(`🚪 Aircraft ${violation.icao24} exited zone: ${violation.zoneName}`);
  });

  connector.on('event:generated', (event) => {
    console.log(`📊 Smart event: ${event.type} - ${event.aircraft.callsign || event.aircraft.icao24}`);
  });

  try {
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
        lat: sampleAircraft.lat,
        lon: sampleAircraft.lon,
        altitude: sampleAircraft.altitude,
        speed: sampleAircraft.speed
      });
    }
    console.log('');

    // Test zone management
    console.log('🗺️  Testing zone management...');
    
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
    console.log(`Total zones: ${zones.count}`);
    console.log('');

    // Test radar display
    console.log('📡 Testing radar display...');
    const radar = await connector.execute('radar:display', 'get', {
      range: 100,
      center: { lat: 51.5074, lon: -0.1278 },
      filter: {
        emergency: false,
        min_altitude: 0
      }
    });
    console.log(`Radar shows ${radar.count} aircraft within ${radar.range}nm`);
    console.log('');

    // Test smart events
    console.log('🧠 Testing smart events...');
    const events = await connector.execute('events:smart', 'generate', {});
    console.log(`Generated ${events.length} smart events`);
    
    if (events.length > 0) {
      console.log('Recent events:');
      events.slice(0, 3).forEach(event => {
        console.log(`  - ${event.type}: ${event.aircraft.callsign || event.aircraft.icao24} (${event.priority})`);
      });
    }
    console.log('');

    // Test emergency monitoring
    console.log('🚨 Testing emergency monitoring...');
    const emergencies = await connector.execute('emergency:monitoring', 'monitor', {});
    console.log(`Emergency events: ${emergencies.count} total, ${emergencies.active} active`);
    console.log('');

    // Get connector statistics
    console.log('📊 Connector statistics:');
    const stats = connector.getStats();
    console.log(`  Aircraft: ${stats.aircraft.current} current, ${stats.aircraft.appearances} appearances, ${stats.aircraft.disappearances} disappearances`);
    console.log(`  Zones: ${stats.zones.total} total, ${stats.zones.active} active, ${stats.zones.violations} violations`);
    console.log(`  Events: ${stats.events.total} total, ${stats.events.emergency} emergency`);
    console.log(`  Performance: ${stats.performance.pollCount} polls, ${stats.performance.errorCount} errors`);
    console.log('');

    // Test filtering
    console.log('🔍 Testing aircraft filtering...');
    const filteredAircraft = await connector.execute('aircraft:tracking', 'get', {
      filter: {
        min_altitude: 1000,
        within_range: {
          center: { lat: 51.5074, lon: -0.1278 },
          range: 25
        }
      }
    });
    console.log(`Found ${filteredAircraft.count} aircraft above 1000ft within 25nm of London`);
    console.log('');

    // Wait for more data and events
    console.log('⏳ Waiting for more data and events...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Get updated statistics
    console.log('📊 Updated statistics:');
    const updatedStats = connector.getStats();
    console.log(`  Aircraft: ${updatedStats.aircraft.current} current`);
    console.log(`  Recent changes: ${updatedStats.aircraft.changes}`);
    console.log(`  Zone violations: ${updatedStats.zones.violations}`);
    console.log('');

    // Test zone updates
    console.log('🔄 Testing zone updates...');
    const updatedZone = await connector.execute('zones:management', 'update', {
      zoneId: testZone.id,
      name: 'Updated Test Zone - London Area',
      properties: {
        description: 'Updated test zone for London area',
        radius: '10km',
        updated: new Date().toISOString()
      }
    });
    console.log('Zone updated:', updatedZone.name);
    console.log('');

    // Test radar configuration
    console.log('⚙️  Testing radar configuration...');
    const radarConfig = await connector.execute('radar:display', 'configure', {
      range: 75,
      displayMode: 'filtered',
      showTrails: true,
      trailLength: 15
    });
    console.log('Radar configured:', {
      range: radarConfig.range,
      displayMode: radarConfig.displayMode,
      showTrails: radarConfig.showTrails
    });
    console.log('');

    // Clean up - delete test zone
    console.log('🧹 Cleaning up...');
    await connector.execute('zones:management', 'delete', {
      zoneId: testZone.id
    });
    console.log('Test zone deleted');

    // Disconnect
    console.log('🔌 Disconnecting...');
    await connector.disconnect();
    console.log('✅ Disconnected successfully');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Try to disconnect if connected
    try {
      if (connector.status === 'connected') {
        await connector.disconnect();
      }
    } catch (disconnectError) {
      console.error('Failed to disconnect:', disconnectError.message);
    }
  }
}

// Run the test
if (require.main === module) {
  testADSBConnector().catch(console.error);
}

module.exports = { testADSBConnector }; 