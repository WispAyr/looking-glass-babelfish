const TelegramConnector = require('./connectors/types/TelegramConnector');

async function testConflictSimulation() {
  console.log('🧪 Testing Telegram Connector Conflict Simulation...\n');

  const config = {
    id: 'test-telegram-1',
    type: 'telegram',
    name: 'Test Telegram Bot 1',
    config: {
      token: '6730537017:AAGnK4toKXph8kodfSE80msciRdUPqgVIvw',
      mode: 'auto',
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

  const config2 = {
    ...config,
    id: 'test-telegram-2',
    name: 'Test Telegram Bot 2'
  };

  console.log('🔌 Creating first connector...');
  const connector1 = new TelegramConnector(config);
  
  console.log('🔌 Creating second connector...');
  const connector2 = new TelegramConnector(config2);

  try {
    // Connect first connector
    console.log('📡 Connecting first connector...');
    await connector1.connect();
    console.log('✅ First connector connected successfully!');

    // Try to connect second connector (should trigger conflict handling)
    console.log('📡 Attempting to connect second connector (should trigger conflict handling)...');
    await connector2.connect();
    console.log('✅ Second connector connected successfully!');

    // Test sending messages from both
    console.log('📤 Sending message from first connector...');
    const msg1 = await connector1.execute('telegram:send', 'text', {
      chatId: '-1001242323336',
      text: '🤖 *First Connector* 🤖\n\n✅ This is from the first connector!\n\n🕐 Time: ' + new Date().toLocaleString(),
      parseMode: 'HTML'
    });
    console.log('✅ First message sent! ID:', msg1.message_id);

    console.log('📤 Sending message from second connector...');
    const msg2 = await connector2.execute('telegram:send', 'text', {
      chatId: '-1001242323336',
      text: '🤖 *Second Connector* 🤖\n\n✅ This is from the second connector!\n\n🕐 Time: ' + new Date().toLocaleString(),
      parseMode: 'HTML'
    });
    console.log('✅ Second message sent! ID:', msg2.message_id);

    // Disconnect both
    console.log('🔌 Disconnecting connectors...');
    await connector1.disconnect();
    await connector2.disconnect();
    console.log('✅ Both connectors disconnected');

    console.log('\n🎉 Conflict simulation test completed successfully!');
    console.log('✅ Auto mode handled the conflict correctly!');

  } catch (error) {
    console.error('\n❌ Conflict simulation test failed:', error.message);
    
    // Clean up
    try {
      if (connector1.connected) await connector1.disconnect();
      if (connector2.connected) await connector2.disconnect();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
  }
}

// Run the test
testConflictSimulation().catch(console.error); 