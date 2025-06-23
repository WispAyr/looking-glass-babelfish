const PrestwickAirportConnector = require('./connectors/types/PrestwickAirportConnector');
const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const EventBus = require('./services/eventBus');

async function testPrestwickNotifications() {
  console.log('🔍 Testing Prestwick Airport Notifications');
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
  
  if (!prestwickConfig) {
    console.log('❌ No Prestwick Airport connector found in config');
    return;
  }

  console.log('📋 Prestwick Configuration:');
  console.log(`   Airport: ${prestwickConfig.config.prestwick?.airportName || 'Unknown'}`);
  console.log(`   Code: ${prestwickConfig.config.prestwick?.airportCode || 'Unknown'}`);
  console.log(`   Telegram Enabled: ${prestwickConfig.config.telegram?.enabled ? '✅ Yes' : '❌ No'}`);
  console.log(`   Chat ID: ${prestwickConfig.config.telegram?.chatId || '❌ Missing'}`);

  // Create Prestwick connector
  const prestwickConnector = new PrestwickAirportConnector(prestwickConfig);
  
  // Set up event bus and registry
  prestwickConnector.setEventBus(eventBus);
  prestwickConnector.setConnectorRegistry(connectorRegistry);
  
  // Subscribe to notification events
  eventBus.subscribe('alarm:notification', (event) => {
    console.log('📨 Notification event received:');
    console.log('  Type:', event.type);
    console.log('  Source:', event.source);
    console.log('  Message:', event.message);
    console.log('  Timestamp:', event.timestamp);
  });

  try {
    console.log('\n🔌 Connecting Prestwick Airport Connector...');
    await prestwickConnector.connect();
    console.log('✅ Prestwick Airport Connector connected');
    
    // Wait a moment for startup notification
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    console.log('\n🔌 Disconnecting...');
    await prestwickConnector.disconnect();
    console.log('✅ Test completed');
  }
}

// Run the test
testPrestwickNotifications().catch(console.error); 