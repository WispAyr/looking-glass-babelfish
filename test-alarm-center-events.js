const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const EventBus = require('./services/eventBus');

async function testAlarmCenterEvents() {
  console.log('🔍 Testing Alarm Center Event Processing');
  
  try {
    // Initialize event bus
    const eventBus = new EventBus({});
    
    // Initialize connector registry
    const connectorRegistry = new ConnectorRegistry();
    
    // Load configuration
    const config = require('./config/connectors.json');
    
    // Initialize connectors
    await connectorRegistry.initialize();
    
    // Set eventBus on all connectors that support it
    for (const connector of connectorRegistry.connectors.values()) {
      if (typeof connector.setEventBus === 'function') {
        connector.setEventBus(eventBus);
      }
    }
    
    // Connect all connectors
    console.log('⏳ Connecting connectors...');
    for (const [id, connector] of connectorRegistry.connectors.entries()) {
      try {
        if (connector.status === 'disconnected') {
          console.log(`  Connecting ${id}...`);
          await connector.connect();
        }
      } catch (error) {
        console.warn(`  Failed to connect ${id}: ${error.message}`);
      }
    }
    
    // Wait for connectors to fully connect
    console.log('⏳ Waiting for connectors to fully connect...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get Alarm Manager connector
    const alarmManagerConnector = connectorRegistry.getConnector('alarm-manager-main');
    
    if (!alarmManagerConnector) {
      console.error('❌ Alarm Manager Connector not found');
      return;
    }
    
    console.log('✅ Alarm Manager Connector found');
    
    // Test 1: Emit a test alarm:notification event
    console.log('\n🧪 Test 1: Emitting test alarm:notification event...');
    
    const testEvent = {
      type: 'alarm:notification',
      source: 'prestwick-airport',
      priority: 'medium',
      message: '🧪 Test notification from Prestwick Airport Connector',
      data: {
        eventType: 'approach',
        aircraft: {
          icao24: 'TEST123',
          callsign: 'TEST01',
          registration: 'G-TEST'
        },
        airport: {
          code: 'EGPK',
          name: 'Glasgow Prestwick Airport'
        }
      },
      timestamp: new Date().toISOString()
    };
    
    // Emit the event
    eventBus.emit('alarm:notification', testEvent);
    
    console.log('✅ Test event emitted');
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 2: Check if any rules were processed
    console.log('\n🧪 Test 2: Checking alarm statistics...');
    
    try {
      const stats = await alarmManagerConnector.getStats();
      console.log('📊 Alarm Manager Stats:', {
        totalAlarms: stats.totalAlarms,
        totalRules: stats.totalRules,
        enabledRules: stats.enabledRules,
        channels: stats.channels
      });
    } catch (error) {
      console.error('❌ Failed to get alarm stats:', error.message);
    }
    
    console.log('\n✅ Alarm center event test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    process.exit(0);
  }
}

testAlarmCenterEvents(); 