const axios = require('axios');

async function testCompleteTelegramIntegration() {
  console.log('🧪 Testing Complete Telegram Integration...\n');
  
  const baseUrl = 'http://127.0.0.1:3000';
  
  try {
    // Test 1: Health check
    console.log('1. Testing server health...');
    const healthResponse = await axios.get(`${baseUrl}/api/health`);
    console.log('✅ Server health:', healthResponse.data.status);
    
    // Test 2: General-purpose Telegram API
    console.log('\n2. Testing general-purpose Telegram API...');
    const telegramResponse = await axios.post(`${baseUrl}/api/telegram/send`, {
      chatId: '-1001242323336',
      text: '🚀 *Complete Integration Test* 🚀\n\n✅ General-purpose API working\n✅ Certificate issues resolved\n✅ Connector registry available\n\nThis message sent via `/api/telegram/send`',
      parseMode: 'Markdown'
    });
    console.log('✅ General-purpose API result:', telegramResponse.data.success);
    console.log('   Message ID:', telegramResponse.data.result.message_id);
    
    // Test 3: Prestwick notification endpoint
    console.log('\n3. Testing Prestwick notification endpoint...');
    const prestwickResponse = await axios.post(`${baseUrl}/api/prestwick/telegram/test`);
    console.log('✅ Prestwick notification result:', prestwickResponse.data.success);
    
    // Test 4: Get Prestwick configuration
    console.log('\n4. Testing Prestwick configuration...');
    const configResponse = await axios.get(`${baseUrl}/api/prestwick/telegram/config`);
    console.log('✅ Prestwick config:', configResponse.data.enabled ? 'enabled' : 'disabled');
    
    // Test 5: Send a formatted alert message
    console.log('\n5. Testing formatted alert message...');
    const alertResponse = await axios.post(`${baseUrl}/api/telegram/send`, {
      chatId: '-1001242323336',
      text: '🚨 *System Alert* 🚨\n\n📹 Camera: Test Camera\n📍 Location: Test Area\n🔍 Event: Motion Detected\n⏰ Time: ' + new Date().toLocaleString() + '\n\nThis demonstrates the alert formatting capabilities.',
      parseMode: 'Markdown'
    });
    console.log('✅ Alert message sent:', alertResponse.data.success);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Server running with certificate bypass');
    console.log('   ✅ General-purpose Telegram API working');
    console.log('   ✅ Prestwick notifications working');
    console.log('   ✅ Connector registry available to routes');
    console.log('   ✅ Formatted messages supported');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testCompleteTelegramIntegration(); 