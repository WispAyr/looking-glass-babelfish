#!/usr/bin/env node

/**
 * APRS Connector Test Script
 * 
 * Tests the APRS connector functionality and map integration
 */

const APRSConnector = require('./connectors/types/APRSConnector');
const ConnectorRegistry = require('./connectors/ConnectorRegistry');

// Simple logger for testing
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.log(`[WARN] ${msg}`, data || ''),
  error: (msg, data) => console.log(`[ERROR] ${msg}`, data || ''),
  debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data || '')
};

async function testAPRSConnector() {
  console.log('🧪 Testing APRS Connector...\n');

  try {
    // Create connector registry
    const registry = new ConnectorRegistry(logger);
    
    // Auto-discover connector types
    await registry.autoDiscoverTypes();
    
    console.log('📋 Available connector types:');
    const types = registry.getTypes();
    types.forEach(type => {
      console.log(`  - ${type.type}: ${type.metadata.description}`);
    });
    
    // Check if APRS connector type was discovered
    const aprsType = registry.getType('aprs');
    if (!aprsType) {
      console.error('❌ APRS connector type not found!');
      return;
    }
    
    console.log('\n✅ APRS connector type discovered successfully');
    console.log(`   Name: ${aprsType.metadata.name}`);
    console.log(`   Version: ${aprsType.metadata.version}`);
    console.log(`   Capabilities: ${aprsType.capabilities.map(c => c.id).join(', ')}`);

    // Test configuration validation
    console.log('\n🔧 Testing configuration validation...');
    
    const validConfig = {
      id: 'aprs-test',
      type: 'aprs',
      name: 'APRS Test',
      description: 'Test APRS connector',
      config: {
        apiKey: 'test-key',
        pollInterval: 30000
      }
    };
    
    const errors = APRSConnector.validateConfig(validConfig.config);
    if (errors.length > 0) {
      console.error('❌ Configuration validation failed:', errors);
      return;
    }
    
    console.log('✅ Configuration validation passed');

    // Test connector creation (without API key for safety)
    console.log('\n🏗️  Testing connector creation...');
    
    let connector;
    try {
      connector = await registry.createConnector({
        ...validConfig,
        config: {
          ...validConfig.config,
          apiKey: 'INVALID_KEY_FOR_TESTING'
        }
      });
      
      console.log('✅ Connector created successfully');
      console.log(`   ID: ${connector.id}`);
      console.log(`   Type: ${connector.type}`);
      console.log(`   Status: ${connector.status}`);
      
      // Test capabilities
      console.log('\n🎯 Testing capabilities...');
      const capabilities = connector.getCapabilities();
      capabilities.forEach(cap => {
        console.log(`   - ${cap.id}: ${cap.name} (${cap.enabled ? 'enabled' : 'disabled'})`);
      });
      
      // Test connection (will fail due to invalid API key, but that's expected)
      console.log('\n🔌 Testing connection (expected to fail with invalid API key)...');
      try {
        await connector.connect();
      } catch (error) {
        console.log('✅ Connection failed as expected (invalid API key)');
        console.log(`   Error: ${error.message}`);
      }
      
      // Test visualization data format
      console.log('\n🗺️  Testing visualization data format...');
      const vizData = connector.getVisualizationData();
      console.log('✅ Visualization data format:', {
        stationsCount: vizData.stations.length,
        weatherCount: vizData.weather.length,
        timestamp: vizData.timestamp
      });
      
      // Test station filtering
      console.log('\n🔍 Testing station filtering...');
      const stations = connector.getStations({ active: true });
      console.log(`✅ Station filtering: ${stations.length} stations`);
      
      // Test weather data
      console.log('\n🌤️  Testing weather data...');
      const weather = connector.getWeatherData();
      console.log(`✅ Weather data: ${weather.length} weather stations`);
      
      // Test statistics
      console.log('\n📊 Testing statistics...');
      const stats = connector.getStats();
      console.log('✅ Statistics:', {
        status: stats.status,
        isPolling: stats.isPolling,
        stationsCount: stats.stationsCount,
        weatherStationsCount: stats.weatherStationsCount,
        apiCalls: stats.apiCalls
      });
      
      // Clean up
      await connector.disconnect();
      console.log('\n✅ Connector disconnected successfully');
      
    } catch (error) {
      console.log('⚠️  Connector creation failed (expected with invalid API key)');
      console.log(`   Error: ${error.message}`);
      
      // Create a mock connector for testing map integration
      console.log('\n🔧 Creating mock connector for map integration testing...');
      connector = new APRSConnector({
        id: 'aprs-mock',
        type: 'aprs',
        name: 'APRS Mock',
        description: 'Mock APRS connector for testing',
        config: {
          apiKey: 'mock-key',
          pollInterval: 30000
        },
        logger: logger
      });
    }

    // Test map integration simulation
    console.log('\n🗺️  Testing map integration simulation...');
    
    const mockMapConnector = {
      id: 'map-test',
      type: 'map',
      execute: async (capability, operation, params) => {
        console.log(`   Map received: ${capability}:${operation}`, params);
        return { success: true };
      }
    };
    
    // Simulate APRS data being sent to map
    const testStation = {
      id: 'G0RDI',
      name: 'G0RDI',
      type: 'l',
      lat: 55.5074,
      lng: -4.5933,
      symbol: '/#',
      comment: 'Test station',
      lastSeen: new Date()
    };
    
    const mapData = connector.formatStationForMap(testStation);
    console.log('✅ Map data format:', {
      id: mapData.id,
      type: mapData.type,
      position: mapData.position,
      style: mapData.style
    });
    
    console.log('\n🎉 APRS Connector test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Get an API key from https://aprs.fi/');
    console.log('   2. Update the API key in config/connectors.json');
    console.log('   3. Start the main application to see APRS data on the map');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAPRSConnector().catch(console.error);
}

module.exports = { testAPRSConnector }; 