const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const TelegramConnector = require('./connectors/types/TelegramConnector');

// Simple logger for testing
const logger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
  debug: (msg, meta) => console.log(`[DEBUG] ${msg}`, meta || ''),
  warn: (msg, meta) => console.log(`[WARN] ${msg}`, meta || ''),
  error: (msg, meta) => console.log(`[ERROR] ${msg}`, meta || '')
};

async function testTelegramConnector() {
  console.log('Testing Telegram Connector...\n');
  
  // Create connector registry
  const registry = new ConnectorRegistry(logger);
  
  // Register Telegram connector type
  registry.registerType('telegram', TelegramConnector);
  
  // Test configuration (replace with your bot token)
  const config = {
    id: 'test-telegram',
    type: 'telegram',
    name: 'Test Telegram Bot',
    description: 'Test bot for development',
    config: {
      token: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',
      mode: 'polling',
      pollingInterval: 1000,
      pollingTimeout: 10
    },
    capabilities: {
      enabled: ['telegram:send', 'telegram:receive', 'telegram:keyboard'],
      disabled: ['telegram:webhook']
    }
  };
  
  try {
    // Create connector
    console.log('Creating Telegram connector...');
    const connector = await registry.createConnector(config);
    
    // Set up event listeners
    connector.on('connected', (data) => {
      console.log('✅ Telegram bot connected successfully');
    });
    
    connector.on('disconnected', (data) => {
      console.log('❌ Telegram bot disconnected');
    });
    
    connector.on('error', (error) => {
      console.error('❌ Telegram error:', error);
    });
    
    connector.on('message', (data) => {
      console.log('📨 Received message:', data.message.text);
      console.log('   From chat:', data.message.chat.id);
      console.log('   From user:', data.message.from.username);
    });
    
    connector.on('callback-query', (data) => {
      console.log('🔘 Callback query:', data.query.data);
    });
    
    // Connect to Telegram
    console.log('Connecting to Telegram...');
    await connector.connect();
    
    // Wait a moment for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test bot info
    console.log('\n📋 Getting bot information...');
    try {
      const botInfo = await connector.getBotInfo();
      console.log('✅ Bot info:', {
        id: botInfo.id,
        username: botInfo.username,
        firstName: botInfo.first_name,
        canJoinGroups: botInfo.can_join_groups,
        canReadAllGroupMessages: botInfo.can_read_all_group_messages
      });
    } catch (error) {
      console.log('❌ Could not get bot info:', error.message);
    }
    
    // Test sending message (replace with actual chat ID)
    const testChatId = process.env.TELEGRAM_TEST_CHAT_ID;
    if (testChatId) {
      console.log('\n📤 Testing message sending...');
      try {
        const result = await connector.execute('telegram:send', 'text', {
          chatId: testChatId,
          text: '🤖 Hello from Babelfish Telegram Connector!',
          parseMode: 'Markdown'
        });
        console.log('✅ Message sent successfully:', result.message_id);
      } catch (error) {
        console.log('❌ Could not send message:', error.message);
      }
      
      // Test inline keyboard
      console.log('\n⌨️ Testing inline keyboard...');
      try {
        const keyboardResult = await connector.execute('telegram:keyboard', 'inline', {
          chatId: testChatId,
          text: 'Choose an action:',
          keyboard: [
            [
              { text: '📷 Take Snapshot', callback_data: 'snapshot' },
              { text: '📊 Get Status', callback_data: 'status' }
            ],
            [
              { text: '🔔 Enable Alerts', callback_data: 'alerts_on' },
              { text: '🔕 Disable Alerts', callback_data: 'alerts_off' }
            ]
          ]
        });
        console.log('✅ Inline keyboard sent:', keyboardResult.message_id);
      } catch (error) {
        console.log('❌ Could not send keyboard:', error.message);
      }
    } else {
      console.log('\n⚠️ No test chat ID provided. Set TELEGRAM_TEST_CHAT_ID environment variable to test messaging.');
    }
    
    // Test message handlers
    console.log('\n🎯 Setting up message handlers...');
    
    // Add command handler
    connector.addCommandHandler('help', (msg) => {
      console.log('📝 Help command received from:', msg.from.username);
      connector.execute('telegram:send', 'text', {
        chatId: msg.chat.id,
        text: `🤖 *Babelfish Bot Help*

Available commands:
• /help - Show this help message
• /status - Get system status
• /snapshot - Take camera snapshot
• /alerts - Toggle alerts

For more information, visit the documentation.`,
        parseMode: 'Markdown'
      });
    });
    
    connector.addCommandHandler('status', (msg) => {
      console.log('📊 Status command received');
      connector.execute('telegram:send', 'text', {
        chatId: msg.chat.id,
        text: `📊 *System Status*

🟢 Babelfish Server: Online
🟢 MQTT Broker: Connected
🟢 UniFi Protect: Connected
📡 Active Connectors: ${registry.getConnectors().length}
⏰ Uptime: ${Math.floor(process.uptime())}s`,
        parseMode: 'Markdown'
      });
    });
    
    // Add message handler
    const messageHandlerId = connector.addMessageHandler((msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        console.log('💬 Echo message received:', msg.text);
        connector.execute('telegram:send', 'text', {
          chatId: msg.chat.id,
          text: `Echo: ${msg.text}`
        });
      }
    });
    
    console.log('✅ Message handlers configured');
    
    // Test getting active chats
    console.log('\n👥 Getting active chats...');
    const activeChats = connector.getActiveChats();
    console.log('✅ Active chats:', activeChats.length);
    
    // Test getting message history
    console.log('\n📚 Getting message history...');
    const messageHistory = connector.getMessageHistory();
    console.log('✅ Message history entries:', messageHistory.length);
    
    // Keep the bot running for testing
    console.log('\n🤖 Bot is running. Send messages to test functionality.');
    console.log('Press Ctrl+C to stop the bot.\n');
    
    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      
      // Remove message handler
      connector.removeMessageHandler(messageHandlerId);
      
      // Disconnect
      await connector.disconnect();
      
      console.log('✅ Shutdown complete');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testTelegramConnector().catch(console.error);
}

module.exports = { testTelegramConnector }; 