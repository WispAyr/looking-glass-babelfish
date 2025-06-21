const CoastlineVectorService = require('./services/coastlineVectorService');
const RadarConnector = require('./connectors/types/RadarConnector');

async function testCoastlineIntegration() {
  console.log('Testing Coastline Integration with Radar System...\n');
  
  try {
    // Initialize coastline service
    const coastlineService = new CoastlineVectorService({
      dataPath: './aviationdata',
      enabled: true,
      autoLoad: true
    });
    
    // Wait for data to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test coastline service directly
    console.log('📊 Coastline Service Test:');
    const coastlineData = coastlineService.getAllData();
    console.log(`✅ Loaded ${coastlineData.segments?.length || 0} segments with ${coastlineData.segments?.reduce((sum, seg) => sum + (seg.points?.length || 0), 0) || 0} points`);
    
    // Test radar connector with coastline service
    console.log('\n🎯 Radar Connector Integration Test:');
    const radarConfig = {
      id: 'test-radar',
      type: 'radar',
      config: {
        range: 50,
        center: { lat: 55.5074, lon: -4.5933 },
        showCoastline: true,
        coastlineColor: '#0066cc',
        coastlineWidth: 2,
        coastlineOpacity: 0.8
      }
    };
    
    const radarConnector = new RadarConnector(radarConfig);
    
    // Initialize radar with coastline service
    radarConnector.initialize({
      coastlineVectorService: coastlineService
    });
    
    console.log('✅ Radar connector initialized with coastline service');
    
    // Test coastline capability
    console.log('\n🔍 Testing Coastline Capabilities:');
    const capabilities = RadarConnector.getCapabilityDefinitions();
    const coastlineCapability = capabilities.find(cap => cap.id === 'coastline:management');
    
    if (coastlineCapability) {
      console.log('✅ Coastline management capability found');
      console.log(`   - Operations: ${coastlineCapability.operations.join(', ')}`);
      console.log(`   - Data types: ${coastlineCapability.dataTypes.join(', ')}`);
    } else {
      console.log('❌ Coastline management capability not found');
    }
    
    // Test getting coastline data through radar connector
    console.log('\n🗺️ Testing Coastline Data Retrieval:');
    try {
      const radarCoastlineData = radarConnector.getCoastlineData({
        bounds: {
          minLat: 50,
          maxLat: 60,
          minLon: -10,
          maxLon: 5
        }
      });
      
      console.log(`✅ Retrieved ${radarCoastlineData.segments.length} coastline segments from radar connector`);
      console.log(`   - Bounds: ${radarCoastlineData.bounds.minLat}°N to ${radarCoastlineData.bounds.maxLat}°N, ${radarCoastlineData.bounds.minLon}°E to ${radarCoastlineData.bounds.maxLon}°E`);
    } catch (error) {
      console.log(`❌ Error getting coastline data: ${error.message}`);
    }
    
    // Test radar display with coastline
    console.log('\n📡 Testing Radar Display with Coastline:');
    try {
      const radarDisplay = radarConnector.getRadarDisplay();
      console.log('✅ Radar display generated successfully');
      console.log(`   - Aircraft count: ${radarDisplay.aircraft?.length || 0}`);
      console.log(`   - Zones count: ${radarDisplay.zones?.length || 0}`);
      console.log(`   - Coastline enabled: ${radarDisplay.coastline?.enabled || false}`);
    } catch (error) {
      console.log(`❌ Error getting radar display: ${error.message}`);
    }
    
    console.log('\n✅ Coastline Integration Test Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Coastline Integration Test Failed:', error);
  }
}

testCoastlineIntegration(); 