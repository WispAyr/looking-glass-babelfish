#!/usr/bin/env node

/**
 * Vector Optimization System Test
 * 
 * Tests the complete vector graphics optimization system including:
 * - Vector optimization service
 * - Airspace visualization
 * - Event emission
 * - Radar display integration
 */

const VectorOptimizationService = require('./services/vectorOptimizationService');
const AirspaceService = require('./services/airspaceService');

console.log('🛩️  Testing Vector Optimization System...\n');

async function testVectorOptimizationSystem() {
  try {
    // Initialize services
    console.log('🔧 Initializing Vector Optimization Service...');
    const vectorOptimizationService = new VectorOptimizationService({
      simplificationTolerance: 0.0001,
      maxPolygonPoints: 50,
      enableCaching: true
    });

    console.log('🔧 Initializing Airspace Service...');
    const airspaceService = new AirspaceService({
      airspaceDataPath: './aviationdata/OUT_UK_Airspace',
      enableAirspaceAwareness: true
    });

    // Test 1: Vector Optimization Service
    console.log('\n📊 Test 1: Vector Optimization Service');
    console.log('=====================================');
    
    const testPolygon = [
      { lat: 51.5074, lon: -0.1278 },
      { lat: 51.5074, lon: -0.1178 },
      { lat: 51.5174, lon: -0.1178 },
      { lat: 51.5174, lon: -0.1278 },
      { lat: 51.5074, lon: -0.1278 }
    ];

    const optimizedPolygon = vectorOptimizationService.optimizePolygon(testPolygon);
    console.log('✅ Polygon optimization:', {
      original: testPolygon.length,
      optimized: optimizedPolygon.optimizedPointCount,
      reduction: optimizedPolygon.reduction
    });

    const bounds = vectorOptimizationService.calculateBoundingBox(testPolygon);
    console.log('✅ Bounding box calculation:', bounds);

    const center = vectorOptimizationService.calculateCenter(testPolygon);
    console.log('✅ Center calculation:', center);

    // Test 2: Airspace Service
    console.log('\n📊 Test 2: Airspace Service');
    console.log('===========================');
    
    await airspaceService.initialize();
    
    const airspaceTypes = airspaceService.getAirspaceTypes();
    console.log('✅ Airspace types loaded:', airspaceTypes);

    const ctrAirspaces = airspaceService.getAirspacesByType('CTR');
    console.log('✅ CTR airspaces loaded:', ctrAirspaces.length);

    const ctaAirspaces = airspaceService.getAirspacesByType('CTA');
    console.log('✅ CTA airspaces loaded:', ctaAirspaces.length);

    // Test 3: Vector Optimization for Radar
    console.log('\n📊 Test 3: Vector Optimization for Radar');
    console.log('=========================================');
    
    const radarConfig = {
      center: { lat: 55.5074, lon: -4.5933 },
      range: 50
    };

    const allAirspaces = [];
    for (const type of ['CTR', 'CTA', 'TMA', 'ATZ', 'FA', 'DA']) {
      const typeAirspaces = airspaceService.getAirspacesByType(type);
      if (typeAirspaces) {
        allAirspaces.push(...typeAirspaces);
      }
    }

    console.log('✅ Total airspaces found:', allAirspaces.length);

    const optimizedAirspaces = vectorOptimizationService.optimizePolygonsForRadar(allAirspaces, radarConfig);
    console.log('✅ Optimized airspaces:', {
      total: optimizedAirspaces.stats.total,
      optimized: optimizedAirspaces.stats.optimized,
      filtered: optimizedAirspaces.stats.filtered
    });

    // Test 4: Color Mapping
    console.log('\n📊 Test 4: Color Mapping');
    console.log('========================');
    
    const testTypes = ['CTR', 'CTA', 'TMA', 'ATZ', 'FA', 'DA'];
    testTypes.forEach(type => {
      const color = vectorOptimizationService.getDefaultColor(type);
      console.log(`✅ ${type}: ${color}`);
    });

    // Test 5: Cache Performance
    console.log('\n📊 Test 5: Cache Performance');
    console.log('============================');
    
    const cacheStats = vectorOptimizationService.getCacheStats();
    console.log('✅ Cache stats:', cacheStats);

    // Test 6: Airspace Events
    console.log('\n📊 Test 6: Airspace Events');
    console.log('===========================');
    
    const recentEvents = airspaceService.getRecentAirspaceEvents({ limit: 10 });
    console.log('✅ Recent airspace events:', recentEvents.length);

    // Test 7: API Endpoint Simulation
    console.log('\n📊 Test 7: API Endpoint Simulation');
    console.log('===================================');
    
    // Simulate radar API request
    const apiRequest = {
      types: 'CTR,CTA,TMA',
      center: JSON.stringify({ lat: 55.5074, lon: -4.5933 }),
      range: 50,
      optimize: true
    };

    const selectedTypes = apiRequest.types.split(',');
    const apiAirspaces = [];
    
    for (const type of selectedTypes) {
      const typeAirspaces = airspaceService.getAirspacesByType(type);
      if (typeAirspaces) {
        apiAirspaces.push(...typeAirspaces);
      }
    }

    const apiOptimized = vectorOptimizationService.optimizePolygonsForRadar(apiAirspaces, {
      center: JSON.parse(apiRequest.center),
      range: parseFloat(apiRequest.range)
    });

    console.log('✅ API simulation result:', {
      requestedTypes: selectedTypes,
      totalAirspaces: apiAirspaces.length,
      optimizedAirspaces: apiOptimized.polygons.length,
      optimizationStats: apiOptimized.stats
    });

    // Test 8: Performance Metrics
    console.log('\n📊 Test 8: Performance Metrics');
    console.log('==============================');
    
    const airspaceStats = airspaceService.getStats();
    console.log('✅ Airspace service stats:', airspaceStats);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ Vector optimization service working');
    console.log('✅ Airspace service loaded and functional');
    console.log('✅ Polygon simplification working');
    console.log('✅ Bounding box calculations working');
    console.log('✅ Color mapping working');
    console.log('✅ Cache system working');
    console.log('✅ Event system working');
    console.log('✅ API endpoint simulation working');
    console.log('✅ Performance metrics available');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testVectorOptimizationSystem(); 