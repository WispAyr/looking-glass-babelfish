#!/usr/bin/env node

/**
 * Test script for Overwatch Connector
 * 
 * This script tests the Overwatch connector functionality including:
 * - Connector creation and registration
 * - Flow management operations
 * - Event processing and filtering
 * - System health monitoring
 * - WebSocket connections
 */

const path = require('path');
const winston = require('winston');

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'overwatch-test' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Import required modules
const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const OverwatchConnector = require('./connectors/types/OverwatchConnector');

async function testOverwatchConnector() {
  console.log('🧪 Testing Overwatch Connector...\n');
  
  try {
    // Create connector registry
    const registry = new ConnectorRegistry(logger);
    
    // Register Overwatch connector type
    registry.registerType('overwatch', OverwatchConnector);
    console.log('✅ Registered Overwatch connector type');
    
    // Create Overwatch connector instance
    const overwatchConfig = {
      id: 'overwatch-test',
      type: 'overwatch',
      name: 'Overwatch Test Instance',
      description: 'Test instance of Overwatch connector',
      config: {
        defaultConnectors: [],
        maxEventHistory: 100,
        enableWebSockets: false,
        autoConnect: false
      },
      capabilities: {
        enabled: [
          'overwatch:flows',
          'overwatch:rules',
          'overwatch:events',
          'overwatch:connectors',
          'overwatch:system'
        ],
        disabled: []
      }
    };
    
    const overwatchConnector = await registry.createConnector(overwatchConfig);
    console.log('✅ Created Overwatch connector instance');
    
    // Test connector connection
    await overwatchConnector.connect();
    console.log('✅ Connected Overwatch connector');
    
    // Test flow operations
    console.log('\n📋 Testing Flow Operations...');
    
    const testFlow = {
      name: 'Test Flow',
      description: 'A test flow for validation',
      category: 'test',
      enabled: true,
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          name: 'Test Trigger',
          config: {
            eventType: 'test:event'
          }
        }
      ],
      connections: []
    };
    
    // Create flow
    const createdFlow = await overwatchConnector.execute('overwatch:flows', 'create', testFlow);
    console.log('✅ Created test flow:', createdFlow.id);
    
    // List flows
    const flows = await overwatchConnector.execute('overwatch:flows', 'list');
    console.log('✅ Listed flows:', flows.length, 'flows found');
    
    // Get specific flow
    const retrievedFlow = await overwatchConnector.execute('overwatch:flows', 'get', { id: createdFlow.id });
    console.log('✅ Retrieved flow:', retrievedFlow.name);
    
    // Update flow
    const updatedFlow = await overwatchConnector.execute('overwatch:flows', 'update', {
      id: createdFlow.id,
      description: 'Updated test flow description'
    });
    console.log('✅ Updated flow description');
    
    // Test event operations
    console.log('\n📊 Testing Event Operations...');
    
    // Get event stats
    const eventStats = await overwatchConnector.execute('overwatch:events', 'stats');
    console.log('✅ Retrieved event stats:', eventStats);
    
    // Get event history
    const eventHistory = await overwatchConnector.execute('overwatch:events', 'history', {
      limit: 10,
      offset: 0
    });
    console.log('✅ Retrieved event history:', eventHistory.length, 'events');
    
    // Test event filtering
    const filterResult = await overwatchConnector.execute('overwatch:events', 'filter', {
      id: 'test-filter',
      filters: {
        eventType: ['test:event'],
        priority: ['normal']
      }
    });
    console.log('✅ Applied event filter:', filterResult.filterId);
    
    // Test connector operations
    console.log('\n🔌 Testing Connector Operations...');
    
    const connectors = await overwatchConnector.execute('overwatch:connectors', 'list');
    console.log('✅ Listed connectors:', connectors.length, 'connectors');
    
    // Test system operations
    console.log('\n🏥 Testing System Operations...');
    
    const systemHealth = await overwatchConnector.execute('overwatch:system', 'health');
    console.log('✅ Retrieved system health:', systemHealth.status);
    
    const systemMetrics = await overwatchConnector.execute('overwatch:system', 'metrics');
    console.log('✅ Retrieved system metrics:', {
      eventsProcessed: systemMetrics.eventsProcessed,
      uptime: systemMetrics.uptime,
      activeConnections: systemMetrics.activeConnections
    });
    
    const systemAlerts = await overwatchConnector.execute('overwatch:system', 'alerts');
    console.log('✅ Retrieved system alerts:', systemAlerts.length, 'alerts');
    
    // Test event processing
    console.log('\n📡 Testing Event Processing...');
    
    // Simulate some events
    const testEvent1 = {
      type: 'test:event',
      priority: 'normal',
      data: { message: 'Test event 1' }
    };
    
    const testEvent2 = {
      type: 'system:status',
      priority: 'high',
      data: { status: 'healthy' }
    };
    
    // Process events
    overwatchConnector.processEvent('test-connector', testEvent1);
    overwatchConnector.processSystemEvent('system:status', testEvent2.data);
    
    console.log('✅ Processed test events');
    
    // Get updated stats
    const updatedStats = await overwatchConnector.execute('overwatch:events', 'stats');
    console.log('✅ Updated event stats:', updatedStats);
    
    // Test flow disable/enable
    console.log('\n🔄 Testing Flow Toggle...');
    
    await overwatchConnector.execute('overwatch:flows', 'disable', { id: createdFlow.id });
    console.log('✅ Disabled test flow');
    
    await overwatchConnector.execute('overwatch:flows', 'enable', { id: createdFlow.id });
    console.log('✅ Enabled test flow');
    
    // Test flow deletion
    await overwatchConnector.execute('overwatch:flows', 'delete', { id: createdFlow.id });
    console.log('✅ Deleted test flow');
    
    // Test connector disconnection
    await overwatchConnector.disconnect();
    console.log('✅ Disconnected Overwatch connector');
    
    console.log('\n🎉 All Overwatch connector tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Test WebSocket functionality
async function testWebSocketFunctionality() {
  console.log('\n🌐 Testing WebSocket Functionality...');
  
  try {
    const registry = new ConnectorRegistry(logger);
    registry.registerType('overwatch', OverwatchConnector);
    
    const overwatchConfig = {
      id: 'overwatch-ws-test',
      type: 'overwatch',
      name: 'Overwatch WebSocket Test',
      config: {
        defaultConnectors: [],
        maxEventHistory: 50,
        enableWebSockets: true
      }
    };
    
    const connector = await registry.createConnector(overwatchConfig);
    await connector.connect();
    
    // Simulate WebSocket connection
    const mockWebSocket = {
      readyState: 1, // WebSocket.OPEN
      send: (data) => {
        const message = JSON.parse(data);
        console.log('📤 WebSocket message sent:', message.type);
      },
      close: () => {
        console.log('🔌 WebSocket closed');
      }
    };
    
    connector.addWebSocketConnection(mockWebSocket);
    console.log('✅ Added WebSocket connection');
    
    // Process some events to test broadcasting
    connector.processEvent('test-connector', {
      type: 'test:websocket',
      priority: 'normal',
      data: { message: 'WebSocket test event' }
    });
    
    connector.removeWebSocketConnection(mockWebSocket);
    console.log('✅ Removed WebSocket connection');
    
    await connector.disconnect();
    console.log('✅ WebSocket test completed');
    
  } catch (error) {
    console.error('❌ WebSocket test failed:', error.message);
  }
}

// Test filter presets
async function testFilterPresets() {
  console.log('\n🔍 Testing Filter Presets...');
  
  try {
    const registry = new ConnectorRegistry(logger);
    registry.registerType('overwatch', OverwatchConnector);
    
    const connector = await registry.createConnector({
      id: 'overwatch-filter-test',
      type: 'overwatch',
      name: 'Overwatch Filter Test',
      config: {
        defaultConnectors: [],
        maxEventHistory: 50
      }
    });
    
    await connector.connect();
    
    // Test filter presets
    const presets = Array.from(connector.filterPresets.entries());
    console.log('✅ Filter presets loaded:', presets.length, 'presets');
    
    presets.forEach(([id, preset]) => {
      console.log(`  - ${id}: ${preset.name} - ${preset.description}`);
    });
    
    // Test event filtering
    const testEvent = {
      id: 'test-event',
      source: 'adsb',
      timestamp: new Date().toISOString(),
      type: 'aircraft:detected',
      priority: 'normal',
      data: { aircraft: 'TEST123' }
    };
    
    // Test aircraft filter
    const aircraftFilter = connector.filterPresets.get('aircraft');
    const matchesAircraft = connector.matchesFilter(testEvent, aircraftFilter.filters);
    console.log('✅ Aircraft filter test:', matchesAircraft ? 'PASS' : 'FAIL');
    
    // Test security filter
    const securityFilter = connector.filterPresets.get('security');
    const matchesSecurity = connector.matchesFilter(testEvent, securityFilter.filters);
    console.log('✅ Security filter test:', matchesSecurity ? 'FAIL' : 'PASS');
    
    await connector.disconnect();
    console.log('✅ Filter preset test completed');
    
  } catch (error) {
    console.error('❌ Filter preset test failed:', error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Overwatch Connector Tests\n');
  
  await testOverwatchConnector();
  await testWebSocketFunctionality();
  await testFilterPresets();
  
  console.log('\n✨ All Overwatch connector tests completed successfully!');
  process.exit(0);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testOverwatchConnector,
  testWebSocketFunctionality,
  testFilterPresets
}; 