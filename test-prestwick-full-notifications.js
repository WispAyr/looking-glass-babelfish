const PrestwickAirportConnector = require('./connectors/types/PrestwickAirportConnector');
const TelegramConnector = require('./connectors/types/TelegramConnector');
const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const EventBus = require('./services/eventBus');

async function testPrestwickFullNotifications() {
  console.log('🔍 Testing Prestwick Airport Full Notifications');
  console.log('=' .repeat(50));

  // Initialize event bus
  const eventBus = new EventBus({ maxEvents: 1000 });
  
  // Initialize connector registry
  const connectorRegistry = new ConnectorRegistry();
  await connectorRegistry.initialize();
  await connectorRegistry.autoDiscoverTypes();
  
  // Load configuration
  const config = require('./config/connectors.json');
  const prestwickConfig = config.connectors.find(c => c.type === 'prestwick-airport');
  const telegramConfig = config.connectors.find(c => c.type === 'telegram');
  
  if (!prestwickConfig || !telegramConfig) {
    console.log('❌ Missing required connectors in config');
    return;
  }

  console.log('📋 Configuration:');
  console.log(`   Prestwick Airport: ${prestwickConfig.config.prestwick?.airportName}`);
  console.log(`   Telegram Chat ID: ${telegramConfig.config.defaultChatId}`);
  console.log(`   Telegram Enabled: ${prestwickConfig.config.telegram?.enabled ? '✅ Yes' : '❌ No'}`);

  try {
    // Create and connect Telegram connector first
    console.log('\n🔌 Connecting Telegram Connector...');
    const telegramConnector = new TelegramConnector(telegramConfig);
    telegramConnector.setEventBus(eventBus);
    await telegramConnector.connect();
    console.log('✅ Telegram Connector connected');
    
    // Add Telegram connector to registry
    connectorRegistry.addConnector(telegramConnector);
    
    // Create Prestwick connector
    console.log('\n🔌 Connecting Prestwick Airport Connector...');
    const prestwickConnector = new PrestwickAirportConnector(prestwickConfig);
    prestwickConnector.setEventBus(eventBus);
    prestwickConnector.setConnectorRegistry(connectorRegistry);
    
    // Connect Prestwick connector
    await prestwickConnector.connect();
    console.log('✅ Prestwick Airport Connector connected');
    
    // Wait for startup notification
    console.log('\n⏳ Waiting for startup notification...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Simulate first ADSB data
    console.log('\n📡 Simulating first ADSB data...');
    const mockADSBData = {
      icao24: '400123',
      callsign: 'BA1234',
      registration: 'G-ABCD',
      latitude: 55.5074,
      longitude: -4.5933,
      altitude: 3000,
      speed: 150,
      heading: 120,
      squawk: '1234',
      timestamp: Date.now()
    };
    
    // Trigger first data notification
    prestwickConnector.handleADSBEvent({
      data: mockADSBData,
      timestamp: Date.now()
    });
    
    // Wait for first data notification
    console.log('\n⏳ Waiting for first data notification...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test sending a regular notification
    console.log('\n📤 Testing regular notification...');
    await prestwickConnector.sendTelegramNotification('approach', {
      icao24: '400456',
      callsign: 'EZY789',
      registration: 'G-WXYZ',
      altitude: 2500,
      speed: 140,
      heading: 300,
      runway: '12'
    });
    
    // Wait for notification
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n✅ All notifications sent! Check your Telegram group.');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    console.log('\n🔌 Disconnecting...');
    // Disconnect connectors
    const connectors = connectorRegistry.getConnectors();
    for (const connector of connectors) {
      if (connector.disconnect) {
        await connector.disconnect();
      }
    }
    console.log('✅ Test completed');
  }
}

// Run the test
testPrestwickFullNotifications().catch(console.error); 