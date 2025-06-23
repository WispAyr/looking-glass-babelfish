const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const config = require('./config/config');

async function debugTelegramConnector() {
  console.log('🔍 Debugging Telegram Connector...\n');
  
  try {
    // Initialize connector registry
    const registry = new ConnectorRegistry(config);
    
    // Auto-discover connector types first
    await registry.autoDiscoverTypes();
    
    // Then initialize (loads configuration)
    await registry.initialize();
    
    console.log('✅ Connector registry initialized');
    
    // List all connectors
    const connectors = registry.getConnectors();
    console.log('\n📋 Available connectors:');
    connectors.forEach(connector => {
      console.log(`   - ${connector.id} (${connector.type})`);
    });
    
    // Try to find Telegram connector
    const telegramConnector = registry.getConnector('telegram-bot-main');
    if (telegramConnector) {
      console.log('\n✅ Found Telegram connector:', telegramConnector.id);
      console.log('   Config:', JSON.stringify(telegramConnector.config, null, 2));
    } else {
      console.log('\n❌ Telegram connector not found');
    }
    
    // Try alternative ID
    const telegramConnectorAlt = registry.getConnector('telegram-bot');
    if (telegramConnectorAlt) {
      console.log('\n✅ Found Telegram connector with alt ID:', telegramConnectorAlt.id);
    } else {
      console.log('\n❌ Telegram connector not found with alt ID either');
    }
    
    // Debug: Show the full connector config from the JSON file
    const connectorsConfig = require('./config/connectors.json');
    const telegramConfig = connectorsConfig.connectors.find(c => c.id === 'telegram-bot-main');
    if (telegramConfig) {
      console.log('\n🔧 Full Telegram config from JSON:');
      console.log(JSON.stringify(telegramConfig, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug
debugTelegramConnector(); 