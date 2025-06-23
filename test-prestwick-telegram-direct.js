const PrestwickAirportConnector = require('./connectors/types/PrestwickAirportConnector');
const TelegramConnector = require('./connectors/types/TelegramConnector');

async function testPrestwickTelegramDirect() {
  console.log('🧪 Testing Prestwick Airport Telegram Integration (Direct)...\n');
  
  try {
    // Create Telegram connector
    const telegramConfig = {
      id: 'telegram-bot-main',
      type: 'telegram',
      name: 'Telegram Bot',
      description: 'Telegram bot for notifications',
      config: {
        token: '6730537017:AAGnK4toKXph8kodfSE80msciRdUPqgVIvw',
        mode: 'polling',
        pollingInterval: 1000,
        pollingTimeout: 10
      },
      capabilities: {
        enabled: ['telegram:send', 'telegram:receive'],
        disabled: []
      }
    };
    
    const telegramConnector = new TelegramConnector(telegramConfig);
    await telegramConnector.connect();
    console.log('✅ Telegram connector connected');
    
    // Create Prestwick connector
    const prestwickConfig = {
      id: 'prestwick-main',
      type: 'prestwick-airport',
      name: 'Prestwick Airport',
      description: 'Prestwick Airport tracking',
      config: {
        telegram: {
          chatId: '-1001242323336'
        }
      },
      capabilities: {
        enabled: ['aircraft:tracking', 'telegram:notifications'],
        disabled: []
      }
    };
    
    const prestwickConnector = new PrestwickAirportConnector(prestwickConfig);
    
    // Mock connector registry
    const mockRegistry = {
      getConnector: (id) => {
        if (id === 'telegram-bot-main') {
          return telegramConnector;
        }
        return null;
      }
    };
    
    prestwickConnector.setConnectorRegistry(mockRegistry);
    
    // Connect Prestwick connector
    await prestwickConnector.performConnect();
    console.log('✅ Prestwick connector connected');
    
    // Test sending a notification
    console.log('📤 Testing Prestwick Telegram notification...');
    
    const testAircraftData = {
      icao24: 'TEST123',
      callsign: 'TESTFLIGHT',
      registration: 'G-TEST',
      altitude: 3000,
      speed: 150,
      heading: 120,
      runway: '12'
    };
    
    await prestwickConnector.sendTelegramNotification('approach', testAircraftData);
    console.log('✅ Prestwick Telegram notification sent successfully!');
    
    // Test the capability operation
    console.log('\n📋 Testing Telegram notifications capability...');
    const config = await prestwickConnector.executeCapability('telegram:notifications', 'get_notification_config');
    console.log('✅ Current config:', config);
    
    const testResult = await prestwickConnector.executeCapability('telegram:notifications', 'test_notification');
    console.log('✅ Test notification result:', testResult);
    
    // Disconnect
    await prestwickConnector.performDisconnect();
    await telegramConnector.disconnect();
    
    console.log('\n🎉 Prestwick Telegram integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testPrestwickTelegramDirect(); 