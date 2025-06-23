const TelegramConnector = require('./connectors/types/TelegramConnector');
const EventBus = require('./services/eventBus');

async function testTelegramChatId() {
  console.log('🔍 Testing Telegram Chat ID Capture...');
  
  // Initialize event bus with config
  const eventBus = new EventBus({ maxEvents: 1000 });
  
  // Create Telegram connector
  const telegramConfig = {
    id: 'telegram-test',
    type: 'telegram',
    name: 'Telegram Test',
    config: {
      token: '6730537017:AAGnK4toKXph8kodfSE80msciRdUPqgVIvw',
      mode: 'polling',
      pollingInterval: 1000,
      pollingTimeout: 10
    }
  };
  
  const telegramConnector = new TelegramConnector(telegramConfig);
  
  // Set up event bus for the connector
  telegramConnector.setEventBus(eventBus);
  
  // Subscribe to telegram message sent events
  eventBus.subscribe('telegram:message:sent', (event) => {
    console.log('📨 Message sent event received:');
    console.log('  Chat ID:', event.data.chatId);
    console.log('  Chat Type:', event.data.chatType);
    console.log('  Chat Title:', event.data.chatTitle);
    console.log('  Message ID:', event.data.messageId);
    console.log('  Message Type:', event.data.messageType);
    console.log('  Timestamp:', new Date(event.data.timestamp).toISOString());
  });
  
  try {
    console.log('🔌 Connecting to Telegram...');
    await telegramConnector.performConnect();
    console.log('✅ Connected to Telegram');
    
    console.log('📤 Sending test message...');
    const result = await telegramConnector.execute('telegram:send', 'text', {
      chatId: '-1001242323336',
      text: '🔍 Test message to capture chat ID - ' + new Date().toISOString(),
      parseMode: 'HTML'
    });
    
    console.log('✅ Message sent successfully');
    console.log('📋 Message result:', result);
    
    // Wait a moment for the event to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    console.log('🔌 Disconnecting...');
    await telegramConnector.performDisconnect();
    console.log('✅ Test completed');
  }
}

testTelegramChatId().catch(console.error); 