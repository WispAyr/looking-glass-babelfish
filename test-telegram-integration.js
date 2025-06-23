const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const config = require('./config/config');

/**
 * Test Telegram Integration
 * 
 * This script tests the Telegram connector and sends a test message
 * to verify the integration is working properly.
 */

async function testTelegramIntegration() {
  console.log('🧪 Testing Telegram Integration...\n');
  
  try {
    // Initialize connector registry
    const registry = new ConnectorRegistry(config);
    
    // Auto-discover connector types first
    await registry.autoDiscoverTypes();
    
    // Then initialize (loads configuration)
    await registry.initialize();
    
    console.log('✅ Connector registry initialized');
    
    // Get Telegram connector
    const telegramConnector = registry.getConnector('telegram-bot-main');
    if (!telegramConnector) {
      throw new Error('Telegram connector not found');
    }
    
    console.log('✅ Telegram connector found');
    
    // Connect to Telegram
    await telegramConnector.connect();
    console.log('✅ Connected to Telegram Bot API');
    
    // Send test message
    console.log('📤 Sending test message to Telegram channel...');
    
    const testMessage = await telegramConnector.execute('telegram:send', 'text', {
      chatId: '-1001242323336',
      text: '🤖 *Babelfish Looking Glass Test* 🤖\n\n✅ Telegram integration is working!\n\n📹 UniFi Protect events will now be sent to this channel.\n\n🕐 Test time: ' + new Date().toLocaleString(),
      parseMode: 'Markdown'
    });
    
    console.log('✅ Test message sent successfully!');
    console.log('📨 Message ID:', testMessage.message_id);
    
    // Test different message types
    console.log('\n📤 Testing different message types...');
    
    // Test with emojis and formatting
    await telegramConnector.execute('telegram:send', 'text', {
      chatId: '-1001242323336',
      text: '🚨 *Motion Detection Test* 🚨\n\n📹 Camera: Test Camera\n📍 Location: Front Door\n⏰ Time: ' + new Date().toLocaleString() + '\n\nThis is how motion alerts will appear.',
      parseMode: 'Markdown'
    });
    
    console.log('✅ Formatted test message sent');
    
    // Test smart detection message
    await telegramConnector.execute('telegram:send', 'text', {
      chatId: '-1001242323336',
      text: '🤖 *Smart Detection Test* 🤖\n\n📹 Camera: Test Camera\n📍 Location: Backyard\n🔍 Detection: Person\n⏰ Time: ' + new Date().toLocaleString() + '\n\nThis is how smart detection alerts will appear.',
      parseMode: 'Markdown'
    });
    
    console.log('✅ Smart detection test message sent');
    
    // Get bot info
    const botInfo = await telegramConnector.getBotInfo();
    console.log('\n🤖 Bot Information:');
    console.log('   Name:', botInfo.first_name);
    console.log('   Username:', botInfo.username);
    console.log('   ID:', botInfo.id);
    
    // Disconnect
    await telegramConnector.disconnect();
    console.log('\n✅ Disconnected from Telegram');
    
    console.log('\n🎉 Telegram integration test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart the Babelfish server to load the new rules');
    console.log('   2. UniFi Protect events will automatically be sent to this channel');
    console.log('   3. Check the logs for any errors or issues');
    
  } catch (error) {
    console.error('❌ Telegram integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testTelegramIntegration(); 