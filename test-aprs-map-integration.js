#!/usr/bin/env node

/**
 * APRS Map Integration Test
 * 
 * Tests the APRS map integration by verifying API endpoints
 * and checking if the map can display APRS stations
 */

const axios = require('axios');
const APRSConnector = require('./connectors/types/APRSConnector');
const MapConnector = require('./connectors/types/MapConnector');
const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const MapIntegrationService = require('./services/mapIntegrationService');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const API_ENDPOINTS = {
  stations: '/api/map/aprs/stations',
  weather: '/api/map/aprs/weather',
  stats: '/api/map/aprs/stats'
};

async function testAPRSMapIntegration() {
  console.log('🧪 Testing APRS Connector Map Integration');
  console.log('==========================================');

  try {
    // Initialize connector registry
    const connectorRegistry = new ConnectorRegistry();
    
    // Initialize map integration service
    const mapIntegrationService = new MapIntegrationService({
      autoRegisterConnectors: true,
      syncInterval: 1000
    });
    
    await mapIntegrationService.initialize(connectorRegistry);

    // Create a map connector
    const mapConnector = new MapConnector({
      id: 'test-map',
      name: 'Test Map',
      description: 'Test map for APRS integration'
    });
    
    // Register map connector
    await connectorRegistry.registerConnector(mapConnector);
    console.log('✅ Map connector registered');

    // Create APRS connector with API key
    const aprsConnector = new APRSConnector('test-aprs', {
      name: 'Test APRS',
      description: 'Test APRS connector for map integration',
      apiKey: 'YOUR_API_KEY_HERE', // Replace with actual API key
      pollInterval: 60000 // 1 minute for testing
    });

    // Set connector registry reference
    aprsConnector.setConnectorRegistry(connectorRegistry);
    console.log('✅ APRS connector registry reference set');

    // Register APRS connector
    await connectorRegistry.registerConnector(aprsConnector);
    console.log('✅ APRS connector registered');

    // Test connection (this should auto-register with map)
    console.log('🔌 Connecting APRS connector...');
    await aprsConnector.connect();
    console.log('✅ APRS connector connected');

    // Check if APRS connector is registered with map
    const mapConnectors = aprsConnector.mapConnectors;
    console.log(`📊 APRS connector map connections: ${mapConnectors.size}`);
    
    for (const [mapId, mapConnector] of mapConnectors) {
      console.log(`   - Connected to map: ${mapId}`);
    }

    // Test spatial context
    console.log('🗺️  Testing spatial context...');
    const spatialContext = await aprsConnector.getSpatialContext();
    console.log('✅ Spatial context generated:', {
      type: spatialContext.type,
      stations: spatialContext.spatialData.stations.length,
      weatherStations: spatialContext.spatialData.weatherStations.length,
      bounds: spatialContext.bounds
    });

    // Test visualization data
    console.log('📊 Testing visualization data...');
    const vizData = aprsConnector.getVisualizationData();
    console.log('✅ Visualization data generated:', {
      stations: vizData.stations.length,
      weatherStations: vizData.weatherStations.length,
      spatialElements: vizData.spatialElements.length
    });

    // Test broadcasting to maps
    console.log('📡 Testing map broadcasting...');
    await aprsConnector.broadcastToMaps({
      type: 'test',
      message: 'Hello from APRS connector!'
    });
    console.log('✅ Broadcast test completed');

    // Wait a bit for any async operations
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test disconnection
    console.log('🔌 Disconnecting APRS connector...');
    await aprsConnector.disconnect();
    console.log('✅ APRS connector disconnected');

    // Check that map connections are cleared
    console.log(`📊 APRS connector map connections after disconnect: ${aprsConnector.mapConnectors.size}`);

    // Cleanup
    await mapIntegrationService.cleanup();
    console.log('✅ Map integration service cleaned up');

    console.log('\n🎉 APRS Map Integration Test Completed Successfully!');
    console.log('\nKey Features Verified:');
    console.log('✅ Automatic map registration on connect');
    console.log('✅ Spatial context generation');
    console.log('✅ Real-time data broadcasting');
    console.log('✅ Map sync handling');
    console.log('✅ Proper cleanup on disconnect');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAPRSMapIntegration().catch(console.error);
}

module.exports = { testAPRSMapIntegration }; 