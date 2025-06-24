const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const EventBus = require('./services/eventBus');

async function testPrestwickNotificationsFixed() {
  console.log('🔍 Testing Prestwick Airport Notifications (Fixed)');
  
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
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check connector status
    console.log('\n📊 Connector Status:');
    for (const [id, connector] of connectorRegistry.connectors.entries()) {
      console.log(`  ${id}: ${connector.status} (${connector.type})`);
    }
    
    // Get Prestwick and Alarm Manager connectors
    const prestwickConnector = connectorRegistry.getConnector('prestwick-airport-main');
    const alarmManagerConnector = connectorRegistry.getConnector('alarm-manager-main');
    
    if (!prestwickConnector) {
      console.error('❌ Prestwick Airport Connector not found');
      return;
    }
    
    if (!alarmManagerConnector) {
      console.error('❌ Alarm Manager Connector not found');
      return;
    }
    
    console.log(`\n✅ Prestwick Connector: ${prestwickConnector.status}`);
    console.log(`✅ Alarm Manager Connector: ${alarmManagerConnector.status}`);
    
    // Test 1: Check if Alarm Manager is properly initialized
    console.log('\n🧪 Test 1: Checking Alarm Manager initialization...');
    
    if (!alarmManagerConnector.alarmService) {
      console.log('⏳ Alarm Manager service not initialized, waiting...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    if (alarmManagerConnector.alarmService) {
      console.log('✅ Alarm Manager service initialized');
    } else {
      console.log('❌ Alarm Manager service not initialized');
    }
    
    // Test 2: Check notification channels
    console.log('\n🧪 Test 2: Checking notification channels...');
    
    if (alarmManagerConnector.channels.telegram) {
      console.log('✅ Telegram channel configured');
    } else {
      console.log('❌ Telegram channel not configured');
      
      // Try to set up notification channels manually
      console.log('🔄 Attempting to set up notification channels...');
      await alarmManagerConnector.setupNotificationChannels();
      
      if (alarmManagerConnector.channels.telegram) {
        console.log('✅ Telegram channel configured (retry)');
      } else {
        console.log('❌ Telegram channel still not configured');
      }
    }
    
    // Test 3: Send a direct test notification
    console.log('\n🧪 Test 3: Sending direct test notification...');
    
    try {
      await alarmManagerConnector.sendNotification('telegram', '🧪 Direct test notification from Alarm Manager', { priority: 'low' });
      console.log('✅ Direct test notification sent successfully');
    } catch (error) {
      console.error('❌ Direct test notification failed:', error.message);
    }
    
    // Test 4: Emit a test alarm:notification event
    console.log('\n🧪 Test 4: Emitting test alarm:notification event...');
    
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
    
    console.log('\n✅ Prestwick notification test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    process.exit(0);
  }
}

// Run the test
testPrestwickNotificationsFixed(); 