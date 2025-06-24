const TelegramConnector = require('./connectors/types/TelegramConnector');

async function testTelegramConflict() {
  console.log('🧪 Testing Telegram Connector Conflict Handling...\n');

  // Create Telegram connector with auto mode
  const telegramConfig = {
    id: 'test-telegram-conflict',
    type: 'telegram',
    name: 'Test Telegram Bot (Conflict Test)',
    config: {
      token: '6730537017:AAGnK4toKXph8kodfSE80msciRdUPqgVIvw',
      mode: 'auto', // This should handle conflicts automatically
      pollingInterval: 1000,
      pollingTimeout: 10,
      enabled: true,
      defaultChatId: '-1001242323336',
      messageSettings: {
        parseMode: 'HTML',
        disableWebPagePreview: true,
        disableNotification: false
      }
    },
    capabilities: {
      enabled: ['telegram:send', 'telegram:receive'],
      disabled: []
    }
  };

  const connector = new TelegramConnector(telegramConfig);
  console.log('✅ Telegram connector created with auto mode');

  try {
    // Try to connect (this should trigger conflict handling)
    console.log('🔌 Attempting to connect (should handle conflicts automatically)...');
    await connector.connect();
    console.log('✅ Connected successfully!');

    // Test sending a message
    console.log('📤 Sending test message...');
    const testMessage = await connector.execute('telegram:send', 'text', {
      chatId: '-1001242323336',
      text: '🤖 *Conflict Test* 🤖\n\n✅ Auto mode handled conflicts successfully!\n\n🕐 Test time: ' + new Date().toLocaleString(),
      parseMode: 'HTML'
    });
    console.log('✅ Test message sent successfully!');
    console.log('📨 Message ID:', testMessage.message_id);

    // Get bot info
    console.log('\n🤖 Bot Information:');
    const botInfo = await connector.getBotInfo();
    console.log(`   Name: ${botInfo.first_name}`);
    console.log(`   Username: ${botInfo.username}`);
    console.log(`   ID: ${botInfo.id}`);

    // Disconnect
    await connector.disconnect();
    console.log('\n✅ Disconnected from Telegram');

    console.log('\n🎉 Telegram conflict handling test completed successfully!');
    console.log('✅ Auto mode worked correctly - it handled the conflict and connected successfully!');

  } catch (error) {
    console.error('\n❌ Telegram conflict test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    if (error.message.includes('409 Conflict')) {
      console.log('\n💡 This means the conflict handling didn\'t work as expected.');
      console.log('   The main server might not be using the Telegram connector yet.');
    }
  }
}

// Run the test
testTelegramConflict().catch(console.error); 