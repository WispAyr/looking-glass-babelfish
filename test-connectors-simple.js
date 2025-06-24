const ConnectorRegistry = require('./connectors/ConnectorRegistry');

async function testConnectorsSimple() {
  console.log('🔍 Testing connector creation and connection...');
  
  try {
    // Create connector registry
    const connectorRegistry = new ConnectorRegistry();
    
    // Initialize (this should now auto-discover types and load config)
    await connectorRegistry.initialize();
    
    console.log(`\n📋 Found ${connectorRegistry.getConnectors().length} connectors:`);
    connectorRegistry.getConnectors().forEach(connector => {
      console.log(`  - ${connector.id} (${connector.type}) - Status: ${connector.status}`);
    });
    
    if (connectorRegistry.getConnectors().length === 0) {
      console.log('\n❌ No connectors were created. This indicates a configuration loading issue.');
      return;
    }
    
    // Try to connect just the Telegram connector to test
    const telegramConnector = connectorRegistry.getConnector('telegram-bot-main');
    if (telegramConnector) {
      console.log('\n🔌 Testing Telegram connector connection...');
      try {
        await telegramConnector.connect();
        console.log('✅ Telegram connector connected successfully');
      } catch (error) {
        console.log(`❌ Telegram connector failed to connect: ${error.message}`);
      }
    } else {
      console.log('\n❌ Telegram connector not found');
    }
    
    // Try to connect the MQTT connector
    const mqttConnector = connectorRegistry.getConnector('mqtt-broker-main');
    if (mqttConnector) {
      console.log('\n🔌 Testing MQTT connector connection...');
      try {
        await mqttConnector.connect();
        console.log('✅ MQTT connector connected successfully');
      } catch (error) {
        console.log(`❌ MQTT connector failed to connect: ${error.message}`);
      }
    } else {
      console.log('\n❌ MQTT connector not found');
    }
    
    // Try to connect the Alarm Manager connector
    const alarmConnector = connectorRegistry.getConnector('alarm-manager-main');
    if (alarmConnector) {
      console.log('\n🔌 Testing Alarm Manager connector connection...');
      try {
        await alarmConnector.connect();
        console.log('✅ Alarm Manager connector connected successfully');
      } catch (error) {
        console.log(`❌ Alarm Manager connector failed to connect: ${error.message}`);
      }
    } else {
      console.log('\n❌ Alarm Manager connector not found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testConnectorsSimple(); 