const TelegramConnector = require('./connectors/types/TelegramConnector');
const EventBus = require('./services/eventBus');

async function testTelegramStatus() {
  console.log('=== Telegram Connector Status Test ===\n');

  try {
    // Create event bus
    const eventBus = new EventBus({ maxEvents: 1000 });
    
    // Create Telegram connector
    const telegramConfig = {
      id: 'telegram-bot-main',
      type: 'telegram',
      name: 'Telegram Bot',
      config: {
        token: '6730537017:AAGnK4toKXph8kodfSE80msciRdUPqgVIvw',
        mode: 'auto',
        pollingInterval: 1000,
        pollingTimeout: 10,
        enabled: true,
        defaultChatId: '-1001242323336',
        chatInfo: {
          id: '-1001242323336',
          title: 'EGPK Movement',
          username: 'egpkmovements',
          type: 'supergroup'
        },
        messageSettings: {
          parseMode: 'HTML',
          disableWebPagePreview: true,
          disableNotification: false
        },
        maxReconnectAttempts: 5,
        enableMessageHistory: true,
        maxHistorySize: 1000
      }
    };
    
    const telegramConnector = new TelegramConnector(telegramConfig);
    telegramConnector.setEventBus(eventBus);
    
    console.log('🔌 Connecting Telegram Connector...');
    await telegramConnector.connect();
    console.log('✅ Telegram Connector connected');
    
    // Test sending a message
    console.log('\n📤 Testing message sending...');
    const result = await telegramConnector.execute('telegram:send', 'text', {
      chatId: '-1001242323336',
      text: '🧪 Test message from Telegram Connector',
      parseMode: 'HTML'
    });
    
    console.log('📤 Message send result:', result);
    
    // Get connector status
    const status = telegramConnector.getStatus();
    console.log('\n📊 Telegram Connector Status:', status);
    
    // Get capabilities
    const capabilities = TelegramConnector.getCapabilityDefinitions();
    console.log('\n🔧 Available Capabilities:');
    capabilities.forEach(cap => {
      console.log(`  - ${cap.id}: ${cap.name}`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n✅ Test completed');
  }
}

// Run the test
testTelegramStatus().catch(console.error); 