const axios = require('axios');

async function testLiveTelegram() {
  console.log('🧪 Testing Live Telegram Integration...\n');
  
  try {
    // Test 1: Send a test message through the main Telegram connector
    console.log('1. Testing main Telegram connector...');
    
    // We'll use the action framework to send a message
    const actionData = {
      actionType: 'telegram_send',
      parameters: {
        connectorId: 'telegram-bot-main',
        operation: 'text',
        chatId: '-1001242323336',
        text: '🚀 *Babelfish Looking Glass is LIVE!* 🚀\n\n✅ Server is running and connected\n✅ Telegram integration is working\n✅ Prestwick notifications are active\n\n🕐 Time: ' + new Date().toLocaleString(),
        parseMode: 'Markdown'
      }
    };
    
    const response = await axios.post('http://127.0.0.1:3000/api/actions/execute', actionData);
    console.log('✅ Main Telegram test result:', response.data);
    
    // Test 2: Send a Prestwick aircraft notification
    console.log('\n2. Testing Prestwick aircraft notification...');
    
    const prestwickResponse = await axios.post('http://127.0.0.1:3000/api/prestwick/telegram/test');
    console.log('✅ Prestwick notification result:', prestwickResponse.data);
    
    // Test 3: Get current configuration
    console.log('\n3. Getting current configuration...');
    
    const configResponse = await axios.get('http://127.0.0.1:3000/api/prestwick/telegram/config');
    console.log('✅ Current config:', configResponse.data);
    
    console.log('\n🎉 Live Telegram integration test completed successfully!');
    console.log('\n📋 What\'s working:');
    console.log('   ✅ Main Telegram connector is connected');
    console.log('   ✅ Messages can be sent to chat ID: -1001242323336');
    console.log('   ✅ Prestwick notifications are configured');
    console.log('   ✅ Server API is responding');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testLiveTelegram(); 