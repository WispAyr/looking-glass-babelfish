#!/usr/bin/env node

/**
 * Test Radar System
 * 
 * Tests the radar connector and its integration with ADSB data
 */

const RadarConnector = require('./connectors/types/RadarConnector');
const ADSBConnector = require('./connectors/types/ADSBConnector');

async function testRadarSystem() {
  console.log('🛩️ Testing Radar System...\n');
  
  try {
    // Initialize radar connector
    console.log('1. Initializing Radar Connector...');
    const radarConnector = new RadarConnector({
      id: 'test-radar',
      name: 'Test Radar',
      description: 'Test radar system',
      config: {
        range: 50,
        center: { lat: 51.5074, lon: -0.1278 },
        showTrails: true,
        showLabels: true,
        showZones: true
      }
    });
    
    await radarConnector.connect();
    console.log('✅ Radar Connector initialized and connected\n');
    
    // Initialize ADSB connector
    console.log('2. Initializing ADSB Connector...');
    const adsbConnector = new ADSBConnector({
      id: 'test-adsb',
      name: 'Test ADSB',
      description: 'Test ADSB system',
      config: {
        url: 'http://localhost:8080/data/aircraft.json',
        pollInterval: 5000
      }
    });
    
    await adsbConnector.connect();
    console.log('✅ ADSB Connector initialized and connected\n');
    
    // Test radar display
    console.log('3. Testing Radar Display...');
    const display = radarConnector.getRadarDisplay();
    console.log('✅ Radar display data:', {
      aircraftCount: display.aircraft.length,
      zonesCount: display.zones.length,
      config: display.config
    });
    
    // Test zone creation
    console.log('\n4. Testing Zone Creation...');
    const testZone = radarConnector.createZone({
      id: 'test-zone-1',
      name: 'Test Zone',
      type: 'custom',
      coordinates: [
        { lat: 51.5074, lon: -0.1278 },
        { lat: 51.5074, lon: -0.1178 },
        { lat: 51.5174, lon: -0.1178 },
        { lat: 51.5174, lon: -0.1278 }
      ],
      color: '#FF0000',
      priority: 'medium'
    });
    console.log('✅ Zone created:', testZone.id);
    
    // Test aircraft data update
    console.log('\n5. Testing Aircraft Data Update...');
    const testAircraft = [
      {
        icao24: 'abc123',
        callsign: 'TEST01',
        lat: 51.5074,
        lon: -0.1278,
        altitude: 10000,
        speed: 250,
        heading: 90,
        squawk: '1234'
      },
      {
        icao24: 'def456',
        callsign: 'TEST02',
        lat: 51.5174,
        lon: -0.1178,
        altitude: 15000,
        speed: 300,
        heading: 180,
        squawk: '5678'
      }
    ];
    
    radarConnector.updateAircraftData(testAircraft);
    console.log('✅ Aircraft data updated');
    
    // Test filters
    console.log('\n6. Testing Filters...');
    const filteredAircraft = radarConnector.applyAircraftFilter(testAircraft, {
      altitude: { min: 5000, max: 20000 },
      speed: { min: 200, max: 400 }
    });
    console.log('✅ Filtered aircraft:', filteredAircraft.length);
    
    // Test radar configuration
    console.log('\n7. Testing Radar Configuration...');
    const newConfig = radarConnector.configureRadar({
      range: 100,
      showTrails: false,
      colorBy: 'altitude'
    });
    console.log('✅ Radar configured:', newConfig.range, 'nm range');
    
    // Test export
    console.log('\n8. Testing Data Export...');
    const exportData = radarConnector.exportRadarData({ format: 'json' });
    console.log('✅ Data exported:', exportData.format);
    
    // Test status
    console.log('\n9. Testing Status...');
    const status = radarConnector.getStatus();
    console.log('✅ Radar status:', status.status);
    
    // Cleanup
    console.log('\n10. Cleaning up...');
    await radarConnector.disconnect();
    await adsbConnector.disconnect();
    console.log('✅ Connectors disconnected');
    
    console.log('\n🎉 All radar system tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testRadarSystem();
}

module.exports = { testRadarSystem }; 