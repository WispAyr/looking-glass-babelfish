const TelegramConnector = require('./connectors/types/TelegramConnector');

async function testTelegramSimple() {
  console.log('🧪 Testing Telegram Connector (Simple)...\n');
  
  try {
    // Create Telegram connector directly
    const telegramConfig = {
      id: 'test-telegram',
      type: 'telegram',
      name: 'Test Telegram Bot',
      description: 'Test bot for sending messages',
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
    
    const connector = new TelegramConnector(telegramConfig);
    
    console.log('✅ Telegram connector created');
    
    // Connect to Telegram
    await connector.connect();
    console.log('✅ Connected to Telegram Bot API');
    
    // Send test message
    console.log('📤 Sending test message...');
    
    const testMessage = await connector.execute('telegram:send', 'text', {
      chatId: '-1001242323336',
      text: '🤖 *Babelfish Looking Glass Test* 🤖\n\n✅ Telegram integration is working!\n\n🕐 Test time: ' + new Date().toLocaleString(),
      parseMode: 'Markdown'
    });
    
    console.log('✅ Test message sent successfully!');
    console.log('📨 Message ID:', testMessage.message_id);
    
    // Get bot info
    const botInfo = await connector.getBotInfo();
    console.log('\n🤖 Bot Information:');
    console.log('   Name:', botInfo.first_name);
    console.log('   Username:', botInfo.username);
    console.log('   ID:', botInfo.id);
    
    // Disconnect
    await connector.disconnect();
    console.log('\n✅ Disconnected from Telegram');
    
    console.log('\n🎉 Telegram test completed successfully!');
    
  } catch (error) {
    console.error('❌ Telegram test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testTelegramSimple(); 