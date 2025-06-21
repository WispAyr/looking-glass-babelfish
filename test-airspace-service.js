const AirspaceService = require('./services/airspaceService');
const path = require('path');

async function testAirspaceService() {
  console.log('🧪 Testing Airspace Service...\n');

  try {
    // Create airspace service with default config
    const airspaceService = new AirspaceService({
      airspaceDataPath: path.join(__dirname, 'aviationdata/OUT_UK_Airspace'),
      enableAirspaceAwareness: true
    });

    console.log('Initializing airspace service...');
    await airspaceService.initialize();

    console.log('\n✅ Airspace service initialized successfully!');
    console.log(`📊 Total airspaces: ${airspaceService.airspaces.size}`);
    console.log(`📁 Airspace types: ${Array.from(airspaceService.airspaceTypeCollections.keys()).join(', ')}`);

    // Test getting airspace types
    const types = airspaceService.getAirspaceTypes();
    console.log(`\n🔍 Available types: ${types.join(', ')}`);

    // Test getting airspaces by type
    for (const type of types.slice(0, 3)) { // Test first 3 types
      const typeAirspaces = airspaceService.getAirspacesByType(type);
      console.log(`📋 ${type}: ${typeAirspaces ? typeAirspaces.length : 0} airspaces`);
      
      if (typeAirspaces && typeAirspaces.length > 0) {
        console.log(`   Sample: ${typeAirspaces[0].name} (${typeAirspaces[0].polygons.length} polygons)`);
      }
    }

    // Test getting stats
    const stats = airspaceService.getStats();
    console.log('\n📈 Stats:', stats);

  } catch (error) {
    console.error('❌ Error testing airspace service:', error.message);
    console.error(error.stack);
  }
}

testAirspaceService(); 