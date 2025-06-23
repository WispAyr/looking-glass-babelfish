const TelegramConnector = require('./connectors/types/TelegramConnector');
const EventBus = require('./services/eventBus');

async function testTelegramDefaultChat() {
  console.log('🔍 Testing Telegram Default Chat Configuration');
  console.log('=' .repeat(50));

  // Initialize event bus
  const eventBus = new EventBus({ maxEvents: 1000 });
  
  // Load configuration
  const config = require('./config/connectors.json');
  const telegramConfig = config.connectors.find(c => c.type === 'telegram');
  
  if (!telegramConfig) {
    console.log('❌ No Telegram connector found in config');
    return;
  }

  console.log('📋 Telegram Configuration:');
  console.log(`   Bot Token: ${telegramConfig.config.token ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Default Chat ID: ${telegramConfig.config.defaultChatId || '❌ Missing'}`);
  console.log(`   Chat Title: ${telegramConfig.config.chatInfo?.title || '❌ Missing'}`);
  console.log(`   Chat Username: ${telegramConfig.config.chatInfo?.username || '❌ Missing'}`);
  console.log(`   Parse Mode: ${telegramConfig.config.messageSettings?.parseMode || 'HTML'}`);

  // Create Telegram connector
  const telegramConnector = new TelegramConnector(telegramConfig);
  telegramConnector.setEventBus(eventBus);
  
  // Subscribe to telegram message sent events
  eventBus.subscribe('telegram:message:sent', (event) => {
    console.log('📨 Message sent event received:');
    console.log('  Chat ID:', event.data.chatId);
    console.log('  Message ID:', event.data.messageId);
    console.log('  Text:', event.data.text);
    console.log('  Timestamp:', new Date(event.data.timestamp).toISOString());
  });

  try {
    console.log('\n🔌 Connecting to Telegram...');
    await telegramConnector.connect();
    console.log('✅ Connected to Telegram');
    
    // Test default chat info
    console.log('\n📋 Testing Default Chat Info:');
    const chatInfo = telegramConnector.getDefaultChatInfo();
    console.log('  Chat Info:', chatInfo);
    
    const defaultChatId = telegramConnector.getDefaultChatId();
    console.log('  Default Chat ID:', defaultChatId);
    
    // Test sending message to default chat
    console.log('\n📤 Testing Default Chat Send:');
    const testMessage = `🔍 Test message to default chat - ${new Date().toISOString()}`;
    
    const result = await telegramConnector.execute('telegram:default', 'send', {
      text: testMessage
    });
    
    console.log('✅ Message sent successfully');
    console.log('📋 Message result:', {
      messageId: result.message_id,
      chat: result.chat.title,
      date: new Date(result.date * 1000).toISOString()
    });
    
    // Test capability-based send
    console.log('\n📤 Testing Capability-based Send:');
    const capabilityResult = await telegramConnector.execute('telegram:send', 'text', {
      text: `🔧 Capability test message - ${new Date().toISOString()}`
    });
    
    console.log('✅ Capability message sent successfully');
    console.log('📋 Capability result:', {
      messageId: capabilityResult.message_id,
      chat: capabilityResult.chat.title
    });
    
    // Wait a moment for events to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    console.log('\n🔌 Disconnecting...');
    await telegramConnector.disconnect();
    console.log('✅ Test completed');
  }
}

// Run the test
testTelegramDefaultChat().catch(console.error); 