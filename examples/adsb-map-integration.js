const ADSBConnector = require('../connectors/types/ADSBConnector');
const MapConnector = require('../connectors/types/MapConnector');

/**
 * ADSB Map Integration Example
 * 
 * This example demonstrates how to integrate the ADSB connector with the map
 * connector to provide real-time aircraft visualization and zone monitoring.
 */

async function adsbMapIntegration() {
  console.log('🚁 ADSB Map Integration Example\n');

  // Create ADSB connector
  const adsbConnector = new ADSBConnector({
    id: 'adsb-example',
    name: 'ADSB Example',
    description: 'Example ADSB connector for map integration',
    config: {
      url: 'http://10.0.1.180/skyaware/data/aircraft.json',
      pollInterval: 10000, // 10 seconds for demo
      emergencyCodes: ['7500', '7600', '7700'],
      radarRange: 100,
      radarCenter: {
        lat: 51.5074, // London
        lon: -0.1278
      }
    }
  });

  // Create Map connector
  const mapConnector = new MapConnector({
    id: 'map-example',
    name: 'Map Example',
    description: 'Example map connector for ADSB integration',
    config: {
      autoRegisterConnectors: true,
      enableWebSockets: true,
      editMode: true,
      viewMode: 'realtime'
    }
  });

  try {
    // Connect both connectors
    console.log('🔌 Connecting connectors...');
    await adsbConnector.connect();
    await mapConnector.connect();
    console.log('✅ Connected successfully\n');

    // Register ADSB connector with map
    console.log('🗺️  Registering ADSB with map...');
    await mapConnector.execute('integration:connector', 'register', {
      connectorId: 'adsb-example',
      context: {
        type: 'aircraft',
        capabilities: ['aircraft:tracking', 'zones:management'],
        spatialContext: {
          center: { lat: 51.5074, lon: -0.1278 },
          range: 100,
          units: 'nautical_miles'
        }
      }
    });
    console.log('✅ Registered successfully\n');

    // Create some example zones
    console.log('📍 Creating example zones...');
    
    // Heathrow Airport area
    const heathrowZone = await adsbConnector.execute('zones:management', 'create', {
      name: 'Heathrow Airport',
      zoneType: 'runway',
      coordinates: [
        { lat: 51.4700, lon: -0.4543 },
        { lat: 51.4800, lon: -0.4543 },
        { lat: 51.4800, lon: -0.4443 },
        { lat: 51.4700, lon: -0.4443 }
      ],
      properties: {
        airport: 'LHR',
        runways: ['09L/27R', '09R/27L'],
        elevation: 83
      }
    });

    // London City Airport
    const cityZone = await adsbConnector.execute('zones:management', 'create', {
      name: 'London City Airport',
      zoneType: 'runway',
      coordinates: [
        { lat: 51.5033, lon: 0.0496 },
        { lat: 51.5133, lon: 0.0496 },
        { lat: 51.5133, lon: 0.0596 },
        { lat: 51.5033, lon: 0.0596 }
      ],
      properties: {
        airport: 'LCY',
        runways: ['09/27'],
        elevation: 19
      }
    });

    // Approach path for Heathrow
    const approachZone = await adsbConnector.execute('zones:management', 'create', {
      name: 'Heathrow Approach Path',
      zoneType: 'approach',
      coordinates: [
        { lat: 51.4700, lon: -0.4543 }, // Airport
        { lat: 51.5200, lon: -0.4543 }, // 5nm out
        { lat: 51.5200, lon: -0.4443 },
        { lat: 51.4700, lon: -0.4443 }
      ],
      properties: {
        runway: '27L',
        glideSlope: 3.0,
        threshold: 83
      }
    });

    console.log(`✅ Created ${3} zones\n`);

    // Create map elements for zones
    console.log('🗺️  Creating map elements...');
    
    const zones = await adsbConnector.execute('zones:management', 'list', {});
    
    for (const zone of zones.zones) {
      await mapConnector.execute('spatial:config', 'create', {
        elementType: 'zone',
        position: { lat: 51.5074, lon: -0.1278 },
        properties: {
          zoneId: zone.id,
          name: zone.name,
          type: zone.type,
          coordinates: zone.coordinates,
          color: getZoneColor(zone.type),
          priority: getZonePriority(zone.type)
        }
      });
    }
    console.log('✅ Map elements created\n');

    // Set up event listeners
    console.log('👂 Setting up event listeners...');
    
    // Aircraft events
    adsbConnector.on('aircraft:appeared', async (aircraft) => {
      console.log(`✈️  Aircraft appeared: ${aircraft.callsign || aircraft.icao24}`);
      
      // Create aircraft element on map
      if (aircraft.lat && aircraft.lon) {
        await mapConnector.execute('spatial:config', 'create', {
          elementType: 'aircraft',
          position: { lat: aircraft.lat, lon: aircraft.lon },
          properties: {
            icao24: aircraft.icao24,
            callsign: aircraft.callsign,
            altitude: aircraft.altitude,
            speed: aircraft.speed,
            track: aircraft.track,
            emergency: aircraft.emergency,
            timestamp: aircraft.timestamp
          }
        });
      }
    });

    adsbConnector.on('aircraft:disappeared', async (aircraft) => {
      console.log(`👋 Aircraft disappeared: ${aircraft.callsign || aircraft.icao24}`);
      
      // Remove aircraft element from map
      await mapConnector.execute('spatial:config', 'delete', {
        elementId: `aircraft_${aircraft.icao24}`
      });
    });

    adsbConnector.on('aircraft:moved', async (data) => {
      const { aircraft, changes } = data;
      
      if (changes.position && aircraft.lat && aircraft.lon) {
        // Update aircraft position on map
        await mapConnector.execute('spatial:config', 'update', {
          elementId: `aircraft_${aircraft.icao24}`,
          position: { lat: aircraft.lat, lon: aircraft.lon },
          properties: {
            altitude: aircraft.altitude,
            speed: aircraft.speed,
            track: aircraft.track,
            timestamp: aircraft.timestamp
          }
        });
      }
    });

    // Zone events
    adsbConnector.on('zone:entered', async (violation) => {
      console.log(`📍 Aircraft ${violation.icao24} entered ${violation.zoneName}`);
      
      // Highlight zone on map
      await mapConnector.execute('visualization:realtime', 'highlight', {
        elementId: `zone_${violation.zoneId}`,
        visual: {
          color: '#FF0000',
          opacity: 0.8,
          animation: 'pulse'
        }
      });
    });

    adsbConnector.on('zone:exited', async (violation) => {
      console.log(`🚪 Aircraft ${violation.icao24} exited ${violation.zoneName}`);
      
      // Remove highlight from zone
      await mapConnector.execute('visualization:realtime', 'highlight', {
        elementId: `zone_${violation.zoneId}`,
        visual: {
          color: getZoneColor(violation.zoneType),
          opacity: 0.5,
          animation: 'none'
        }
      });
    });

    // Emergency events
    adsbConnector.on('aircraft:emergency', async (emergency) => {
      console.log(`🚨 EMERGENCY: Aircraft ${emergency.aircraft.callsign || emergency.aircraft.icao24} squawking ${emergency.squawk}`);
      
      // Highlight emergency aircraft on map
      await mapConnector.execute('visualization:realtime', 'highlight', {
        elementId: `aircraft_${emergency.aircraft.icao24}`,
        visual: {
          color: '#FF0000',
          size: 'large',
          animation: 'blink',
          priority: 'critical'
        }
      });
    });

    console.log('✅ Event listeners set up\n');

    // Start monitoring
    console.log('📡 Starting monitoring...');
    console.log('Press Ctrl+C to stop\n');

    // Monitor for 60 seconds
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Get final statistics
    console.log('\n📊 Final Statistics:');
    const stats = adsbConnector.getStats();
    console.log(`  Aircraft: ${stats.aircraft.current} current`);
    console.log(`  Appearances: ${stats.aircraft.appearances}`);
    console.log(`  Disappearances: ${stats.aircraft.disappearances}`);
    console.log(`  Zone violations: ${stats.zones.violations}`);
    console.log(`  Emergency events: ${stats.events.emergency}`);

    // Clean up
    console.log('\n🧹 Cleaning up...');
    
    // Delete zones
    for (const zone of zones.zones) {
      await adsbConnector.execute('zones:management', 'delete', {
        zoneId: zone.id
      });
    }
    
    // Disconnect
    await adsbConnector.disconnect();
    await mapConnector.disconnect();
    
    console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('❌ Integration failed:', error.message);
    
    // Try to disconnect
    try {
      if (adsbConnector.status === 'connected') {
        await adsbConnector.disconnect();
      }
      if (mapConnector.status === 'connected') {
        await mapConnector.disconnect();
      }
    } catch (disconnectError) {
      console.error('Failed to disconnect:', disconnectError.message);
    }
  }
}

/**
 * Get color for zone type
 */
function getZoneColor(zoneType) {
  const colors = {
    'parking': '#FFD700',
    'taxiway': '#FFA500',
    'runway': '#FF0000',
    'approach': '#00FF00',
    'departure': '#0000FF',
    'emergency': '#FF00FF',
    'custom': '#808080'
  };
  return colors[zoneType] || '#808080';
}

/**
 * Get priority for zone type
 */
function getZonePriority(zoneType) {
  const priorities = {
    'parking': 'low',
    'taxiway': 'medium',
    'runway': 'high',
    'approach': 'high',
    'departure': 'high',
    'emergency': 'critical',
    'custom': 'medium'
  };
  return priorities[zoneType] || 'medium';
}

// Run the example
if (require.main === module) {
  adsbMapIntegration().catch(console.error);
}

module.exports = { adsbMapIntegration }; 