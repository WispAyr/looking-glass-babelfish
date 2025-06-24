const RadarConnector = require('./connectors/types/RadarConnector');

async function testRadarNotamIntegration() {
  console.log('🛩️ Testing Radar-NOTAM Integration...\n');
  
  try {
    // Create radar connector
    const radarConfig = {
      id: 'radar-test',
      name: 'Test Radar',
      config: {
        range: 100,
        center: { lat: 55.8642, lon: -4.2518 }, // Glasgow area
        showNotams: true,
        notamOpacity: 0.8,
        notamColors: {
          active: '#ff4444',
          warning: '#ffaa00',
          info: '#4444ff',
          expired: '#888888'
        }
      }
    };
    
    const radar = new RadarConnector(radarConfig);
    console.log('✅ Radar connector created');
    
    // Add sample NOTAM data
    const sampleNotams = [
      {
        id: 'NOTAM001',
        type: 'AERODROME',
        status: 'active',
        priority: 'high',
        title: 'Runway 05/23 Closed',
        description: 'Runway 05/23 closed for maintenance',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-4.2518, 55.8642],
            [-4.2418, 55.8642],
            [-4.2418, 55.8542],
            [-4.2518, 55.8542],
            [-4.2518, 55.8642]
          ]],
          bounds: {
            north: 55.8642,
            south: 55.8542,
            east: -4.2418,
            west: -4.2518
          }
        },
        validFrom: '2025-06-23T00:00:00Z',
        validTo: '2025-06-30T23:59:59Z',
        active: true,
        expired: false
      },
      {
        id: 'NOTAM002',
        type: 'NAVIGATION',
        status: 'warning',
        priority: 'medium',
        title: 'VOR Out of Service',
        description: 'Glasgow VOR temporarily out of service',
        geometry: {
          type: 'Point',
          coordinates: [-4.2518, 55.8642],
          bounds: {
            north: 55.8642,
            south: 55.8642,
            east: -4.2518,
            west: -4.2518
          }
        },
        validFrom: '2025-06-23T00:00:00Z',
        validTo: '2025-06-25T23:59:59Z',
        active: true,
        expired: false
      }
    ];
    
    // Update radar with NOTAM data
    radar.updateNotamData(sampleNotams);
    console.log(`✅ Added ${sampleNotams.length} sample NOTAMs`);
    
    // Test NOTAM capabilities
    console.log('\n📋 Testing NOTAM Capabilities:');
    
    // Get NOTAM data
    const notamData = radar.getNotamData();
    console.log(`  - Total NOTAMs: ${notamData.count}`);
    
    // Filter NOTAMs
    const activeNotams = radar.filterNotams({
      filter: { active: true }
    });
    console.log(`  - Active NOTAMs: ${activeNotams.notams.length}`);
    
    // Test capability execution
    const capabilityResult = await radar.executeCapability('notam:display', 'get', {});
    console.log(`  - Capability execution: ${capabilityResult.count} NOTAMs returned`);
    
    // Configure NOTAM display
    const configResult = radar.configureNotamDisplay({
      opacity: 0.9,
      colors: { active: '#ff0000' }
    });
    console.log(`  - NOTAM display configured: ${configResult.success ? 'Yes' : 'No'}`);
    
    // Get NOTAM display config
    const displayConfig = radar.getNotamDisplayConfig();
    console.log(`  - NOTAM display config:`, {
      showNotams: displayConfig.showNotams,
      opacity: displayConfig.opacity,
      colors: displayConfig.colors
    });
    
    // Test highlighting a specific NOTAM
    const highlightResult = radar.highlightNotam({ notamId: 'NOTAM001' });
    console.log(`  - NOTAM highlighted: ${highlightResult.highlighted ? 'Yes' : 'No'}`);
    
    // Get status (should include NOTAM count)
    const status = radar.getStatus();
    console.log(`  - NOTAM count in status: ${status.notamCount}`);
    
    console.log('\n✅ Radar-NOTAM integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testRadarNotamIntegration(); 