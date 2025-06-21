const AirportVectorService = require('./services/airportVectorService');

/**
 * Test Airport Vector Service
 * 
 * This script tests the airport vector service functionality
 * by loading the vector data files and performing various operations.
 */

async function testAirportVectorService() {
  console.log('🧪 Testing Airport Vector Service\n');

  try {
    // Initialize the service
    const airportVectorService = new AirportVectorService({
      dataPath: './config',
      enabled: true,
      autoLoad: true
    });

    // Wait for data to load
    await new Promise(resolve => {
      airportVectorService.on('data:loaded', (stats) => {
        console.log('✅ Airport vector data loaded successfully');
        console.log('📊 Statistics:', stats);
        resolve();
      });

      airportVectorService.on('error', (error) => {
        console.error('❌ Error loading airport vector data:', error);
        resolve();
      });
    });

    // Test getting all data
    console.log('\n📋 Testing getAllData()...');
    const allData = airportVectorService.getAllData();
    console.log('Buildings:', allData.buildings.length);
    console.log('Markings:', allData.markings.length);
    console.log('Layout:', allData.layout.length);

    // Test getting airport bounds
    console.log('\n🗺️ Testing getAirportBounds()...');
    const bounds = airportVectorService.getAirportBounds();
    console.log('Airport bounds:', bounds);

    // Test getting elements near a point (Prestwick airport center)
    console.log('\n📍 Testing getElementsNearPoint()...');
    const centerPoint = { lat: 55.5074, lon: -4.5933 };
    const nearbyElements = airportVectorService.getElementsNearPoint(centerPoint, 2);
    console.log('Elements near center:', nearbyElements.length);

    // Test getting elements in bounds
    console.log('\n🔲 Testing getElementsInBounds()...');
    const testBounds = {
      min: { lat: 55.50, lon: -4.60 },
      max: { lat: 55.52, lon: -4.58 }
    };
    const elementsInBounds = airportVectorService.getElementsInBounds(testBounds);
    console.log('Elements in bounds:', elementsInBounds.length);

    // Test getting service statistics
    console.log('\n📈 Testing getStats()...');
    const stats = airportVectorService.getStats();
    console.log('Service statistics:', stats);

    // Test specific element types
    console.log('\n🏢 Testing building elements...');
    if (allData.buildings.length > 0) {
      const firstBuilding = allData.buildings[0];
      console.log('First building:', {
        id: firstBuilding.id,
        coordinates: firstBuilding.coordinates.length,
        bounds: firstBuilding.bounds
      });
    }

    console.log('\n🎨 Testing marking elements...');
    if (allData.markings.length > 0) {
      const firstMarking = allData.markings[0];
      console.log('First marking:', {
        id: firstMarking.id,
        coordinates: firstMarking.coordinates.length,
        bounds: firstMarking.bounds
      });
    }

    console.log('\n🛣️ Testing layout elements...');
    if (allData.layout.length > 0) {
      const firstLayout = allData.layout[0];
      console.log('First layout:', {
        id: firstLayout.id,
        coordinates: firstLayout.coordinates.length,
        bounds: firstLayout.bounds
      });
    }

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAirportVectorService(); 