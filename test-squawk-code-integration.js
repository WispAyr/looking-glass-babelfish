const SquawkCodeService = require('./services/squawkCodeService');
const ADSBConnector = require('./connectors/types/ADSBConnector');

/**
 * Test script for Squawk Code Service Integration
 * 
 * This script demonstrates the integration of the UK squawk code service
 * with the ADSB connector for enhanced aircraft monitoring and analysis.
 */

async function testSquawkCodeIntegration() {
  console.log('🚁 Testing Squawk Code Service Integration...\n');

  // Create squawk code service
  console.log('📋 Initializing Squawk Code Service...');
  const squawkCodeService = new SquawkCodeService({
    enableCaching: true,
    enableNotifications: true
  });

  try {
    await squawkCodeService.initialize();
    console.log('✅ Squawk Code Service initialized successfully\n');
  } catch (error) {
    console.error('❌ Failed to initialize Squawk Code Service:', error.message);
    return;
  }

  // Create ADSB connector with squawk code integration
  console.log('📡 Creating ADSB Connector with Squawk Code Integration...');
  const adsbConnector = new ADSBConnector({
    id: 'test-adsb-squawk',
    name: 'Test ADSB with Squawk Analysis',
    description: 'Test connector with squawk code analysis',
    config: {
      url: 'http://10.0.1.180/skyaware/data/aircraft.json',
      pollInterval: 15000, // 15 seconds for testing
      emergencyCodes: ['7500', '7600', '7700'],
      enableSquawkCodeAnalysis: true,
      radarRange: 50,
      radarCenter: {
        lat: 51.5074, // London coordinates
        lon: -0.1278
      }
    }
  });

  // Set squawk code service
  adsbConnector.setSquawkCodeService(squawkCodeService);

  // Set up event listeners for squawk code events
  console.log('🎧 Setting up event listeners...\n');

  adsbConnector.on('squawk:analyzed', (event) => {
    console.log(`🔍 Squawk Analysis: ${event.aircraft.icao24} (${event.squawk}) - ${event.squawkInfo.description}`);
    console.log(`   Category: ${event.category}, Priority: ${event.priority}`);
  });

  adsbConnector.on('emergency:squawk', (event) => {
    console.log(`🚨 EMERGENCY SQUAWK: ${event.aircraft.icao24} (${event.squawk})`);
    console.log(`   Type: ${event.squawkInfo.description}`);
    console.log(`   Requires Action: ${event.requiresAction}`);
  });

  adsbConnector.on('military:squawk', (event) => {
    console.log(`⚔️  MILITARY SQUAWK: ${event.aircraft.icao24} (${event.squawk})`);
    console.log(`   Description: ${event.squawkInfo.description}`);
  });

  adsbConnector.on('nato:squawk', (event) => {
    console.log(`🛡️  NATO SQUAWK: ${event.aircraft.icao24} (${event.squawk})`);
    console.log(`   Description: ${event.squawkInfo.description}`);
  });

  // Test squawk code service directly
  console.log('🧪 Testing Squawk Code Service Directly...\n');

  // Test emergency codes
  console.log('🚨 Testing Emergency Codes:');
  const emergencyCodes = ['7500', '7600', '7700'];
  for (const code of emergencyCodes) {
    const result = squawkCodeService.lookupSquawkCode(code);
    console.log(`   ${code}: ${result.description} (${result.category}, ${result.priority})`);
  }
  console.log('');

  // Test military codes
  console.log('⚔️  Testing Military Codes:');
  const militaryCodes = ['7001', '7002', '7003'];
  for (const code of militaryCodes) {
    const result = squawkCodeService.lookupSquawkCode(code);
    console.log(`   ${code}: ${result.description} (${result.category}, ${result.priority})`);
  }
  console.log('');

  // Test NATO codes
  console.log('🛡️  Testing NATO Codes:');
  const natoCodes = ['0100', '0200', '0300'];
  for (const code of natoCodes) {
    const result = squawkCodeService.lookupSquawkCode(code);
    console.log(`   ${code}: ${result.description} (${result.category}, ${result.priority})`);
  }
  console.log('');

  // Test conspicuity codes
  console.log('👁️  Testing Conspicuity Codes:');
  const conspicuityCodes = ['7000', '2000', '7004'];
  for (const code of conspicuityCodes) {
    const result = squawkCodeService.lookupSquawkCode(code);
    console.log(`   ${code}: ${result.description} (${result.category}, ${result.priority})`);
  }
  console.log('');

  // Test search functionality
  console.log('🔍 Testing Search Functionality:');
  const searchResults = squawkCodeService.searchSquawkCodes({
    category: 'emergency_services',
    limit: 5
  });
  console.log(`   Found ${searchResults.length} emergency service codes:`);
  searchResults.slice(0, 3).forEach(result => {
    console.log(`     ${result.code}: ${result.description}`);
  });
  console.log('');

  // Test categories
  console.log('📊 Testing Categories:');
  const categories = squawkCodeService.getCategories();
  console.log(`   Available categories: ${categories.join(', ')}`);
  console.log('');

  // Test statistics
  console.log('📈 Testing Statistics:');
  const stats = squawkCodeService.getStats();
  console.log(`   Total codes: ${stats.totalCodes}`);
  console.log(`   Categories: ${JSON.stringify(stats.categories)}`);
  console.log(`   Lookups: ${stats.lookups}`);
  console.log(`   Cache hit rate: ${(stats.cache.hitRate * 100).toFixed(1)}%`);
  console.log('');

  // Test ADSB connector squawk analysis capability
  console.log('🔧 Testing ADSB Connector Squawk Analysis Capability...\n');

  // Test lookup capability
  try {
    const lookupResult = await adsbConnector.execute('squawk:analysis', 'lookup', { code: '7500' });
    console.log('✅ Squawk lookup capability working:', lookupResult.description);
  } catch (error) {
    console.error('❌ Squawk lookup capability failed:', error.message);
  }

  // Test search capability
  try {
    const searchResult = await adsbConnector.execute('squawk:analysis', 'search', { 
      category: 'military',
      limit: 3
    });
    console.log(`✅ Squawk search capability working: Found ${searchResult.length} military codes`);
  } catch (error) {
    console.error('❌ Squawk search capability failed:', error.message);
  }

  // Test categories capability
  try {
    const categoriesResult = await adsbConnector.execute('squawk:analysis', 'categories', {});
    console.log('✅ Squawk categories capability working:', categoriesResult.categories.length, 'categories');
  } catch (error) {
    console.error('❌ Squawk categories capability failed:', error.message);
  }

  // Test stats capability
  try {
    const statsResult = await adsbConnector.execute('squawk:analysis', 'stats', {});
    console.log('✅ Squawk stats capability working:', statsResult.totalCodes, 'total codes');
  } catch (error) {
    console.error('❌ Squawk stats capability failed:', error.message);
  }

  console.log('\n🎯 Testing Aircraft Squawk Analysis...\n');

  // Test with mock aircraft data
  const mockAircraft = [
    {
      icao24: 'ABCD1234567890',
      callsign: 'TEST001',
      squawk: '7500',
      lat: 51.5074,
      lon: -0.1278,
      altitude: 30000
    },
    {
      icao24: 'EFGH9876543210',
      callsign: 'MIL001',
      squawk: '7001',
      lat: 51.5074,
      lon: -0.1278,
      altitude: 25000
    },
    {
      icao24: 'IJKL5556667777',
      callsign: 'NATO001',
      squawk: '0100',
      lat: 51.5074,
      lon: -0.1278,
      altitude: 35000
    }
  ];

  for (const aircraft of mockAircraft) {
    console.log(`✈️  Analyzing aircraft ${aircraft.callsign} (${aircraft.squawk}):`);
    const analysis = squawkCodeService.analyzeAircraftSquawk(aircraft);
    if (analysis) {
      console.log(`   Category: ${analysis.category}`);
      console.log(`   Priority: ${analysis.priority}`);
      console.log(`   Description: ${analysis.squawkInfo.description}`);
      console.log(`   Enhanced: ${JSON.stringify(analysis.enhanced)}`);
    } else {
      console.log('   No analysis available');
    }
    console.log('');
  }

  // Test capability definitions
  console.log('📋 Testing Capability Definitions...\n');
  const capabilities = ADSBConnector.getCapabilityDefinitions();
  const squawkCapability = capabilities.find(cap => cap.id === 'squawk:analysis');
  
  if (squawkCapability) {
    console.log('✅ Squawk analysis capability defined:');
    console.log(`   Name: ${squawkCapability.name}`);
    console.log(`   Description: ${squawkCapability.description}`);
    console.log(`   Category: ${squawkCapability.category}`);
    console.log(`   Operations: ${squawkCapability.operations.join(', ')}`);
    console.log(`   Events: ${squawkCapability.events.join(', ')}`);
  } else {
    console.log('❌ Squawk analysis capability not found');
  }

  console.log('\n🎉 Squawk Code Integration Test Complete!\n');
  console.log('📊 Summary:');
  console.log(`   - Squawk codes loaded: ${stats.totalCodes}`);
  console.log(`   - Categories available: ${categories.length}`);
  console.log(`   - Emergency codes: ${stats.categories.emergency}`);
  console.log(`   - Military codes: ${stats.categories.military}`);
  console.log(`   - NATO codes: ${stats.categories.nato}`);
  console.log(`   - Cache performance: ${(stats.cache.hitRate * 100).toFixed(1)}% hit rate`);
  console.log('');
  console.log('🚀 The squawk code service is now fully integrated with the ADSB connector!');
  console.log('   Enhanced monitoring capabilities include:');
  console.log('   - Real-time squawk code analysis');
  console.log('   - Emergency situation detection');
  console.log('   - Military activity monitoring');
  console.log('   - NATO operation tracking');
  console.log('   - Intelligent event generation');
  console.log('   - Enhanced aircraft context');
}

// Run the test
if (require.main === module) {
  testSquawkCodeIntegration().catch(console.error);
}

module.exports = { testSquawkCodeIntegration }; 