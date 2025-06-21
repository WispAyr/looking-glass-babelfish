const CoastlineVectorService = require('./services/coastlineVectorService');

async function testCoastlineVectorService() {
  console.log('Testing Coastline Vector Service...\n');
  
  try {
    // Initialize the service
    const coastlineVectorService = new CoastlineVectorService({
      dataPath: './aviationdata',
      enabled: true,
      autoLoad: true
    });
    
    // Set up event listeners
    coastlineVectorService.on('data:loaded', (stats) => {
      console.log('✅ Coastline data loaded successfully:', stats);
    });
    
    coastlineVectorService.on('error', (error) => {
      console.error('❌ Coastline service error:', error);
    });
    
    // Wait a moment for data to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test getting all data
    console.log('\n📊 Getting all coastline data...');
    const allData = coastlineVectorService.getAllData();
    console.log(`Total segments: ${allData.segments.length}`);
    console.log(`Total points: ${allData.stats.totalPoints}`);
    console.log(`Bounds:`, allData.bounds);
    
    // Test getting segments in bounds
    console.log('\n🗺️ Testing bounds filtering...');
    const testBounds = {
      minLat: 50.0,
      maxLat: 60.0,
      minLon: -10.0,
      maxLon: 5.0
    };
    const segmentsInBounds = coastlineVectorService.getSegmentsInBounds(testBounds);
    console.log(`Segments in test bounds: ${segmentsInBounds.length}`);
    
    // Test getting segments near a point
    console.log('\n📍 Testing proximity search...');
    const centerPoint = { lat: 55.0, lon: -2.0 }; // UK center
    const nearbySegments = coastlineVectorService.getSegmentsNearPoint(centerPoint, 50);
    console.log(`Segments within 50km of center: ${nearbySegments.length}`);
    
    // Test getting stats
    console.log('\n📈 Getting service statistics...');
    const stats = coastlineVectorService.getStats();
    console.log('Service stats:', stats);
    
    // Test a few sample segments
    if (allData.segments.length > 0) {
      console.log('\n🔍 Sample segment data:');
      const sampleSegment = allData.segments[0];
      console.log(`Segment ID: ${sampleSegment.id}`);
      console.log(`Coordinates: ${sampleSegment.coordinates.length} points`);
      console.log(`Bounds:`, sampleSegment.bounds);
      console.log(`First coordinate:`, sampleSegment.coordinates[0]);
      console.log(`Last coordinate:`, sampleSegment.coordinates[sampleSegment.coordinates.length - 1]);
    }
    
    console.log('\n✅ Coastline Vector Service test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCoastlineVectorService(); 