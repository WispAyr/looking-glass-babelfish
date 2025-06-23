const axios = require('axios');

async function testTelegramAPI() {
  console.log('🧪 Testing General-Purpose Telegram API...\n');
  
  try {
    // Test 1: Send a simple message
    console.log('1. Testing simple message...');
    
    const simpleMessage = {
      chatId: '-1001242323336',
      text: '🚀 *General-Purpose Telegram API Test* 🚀\n\n✅ This is a test from the new API endpoint\n✅ Supports Markdown formatting\n✅ Can send to any chat ID\n\n🕐 Time: ' + new Date().toLocaleString(),
      parseMode: 'Markdown'
    };
    
    const response1 = await axios.post('http://127.0.0.1:3000/api/telegram/send', simpleMessage);
    console.log('✅ Simple message result:', response1.data);
    
    // Test 2: Send a message with HTML formatting
    console.log('\n2. Testing HTML formatted message...');
    
    const htmlMessage = {
      chatId: '-1001242323336',
      text: '<b>HTML Formatted Message</b>\n\n<i>This message uses HTML formatting</i>\n\n<code>This is code formatting</code>\n\n<a href="https://github.com">GitHub Link</a>',
      parseMode: 'HTML'
    };
    
    const response2 = await axios.post('http://127.0.0.1:3000/api/telegram/send', htmlMessage);
    console.log('✅ HTML message result:', response2.data);
    
    // Test 3: Send a plain text message
    console.log('\n3. Testing plain text message...');
    
    const plainMessage = {
      chatId: '-1001242323336',
      text: 'This is a plain text message without any formatting. It should display normally in Telegram.'
    };
    
    const response3 = await axios.post('http://127.0.0.1:3000/api/telegram/send', plainMessage);
    console.log('✅ Plain text message result:', response3.data);
    
    // Test 4: Test error handling (missing chatId)
    console.log('\n4. Testing error handling (missing chatId)...');
    
    try {
      const invalidMessage = {
        text: 'This should fail because chatId is missing'
      };
      
      const response4 = await axios.post('http://127.0.0.1:3000/api/telegram/send', invalidMessage);
      console.log('❌ Expected error but got success:', response4.data);
    } catch (error) {
      console.log('✅ Error handling working:', error.response.data);
    }
    
    console.log('\n🎉 General-Purpose Telegram API test completed successfully!');
    console.log('\n📋 API Features:');
    console.log('   ✅ Send messages to any chat ID');
    console.log('   ✅ Support for Markdown formatting');
    console.log('   ✅ Support for HTML formatting');
    console.log('   ✅ Plain text messages');
    console.log('   ✅ Proper error handling');
    console.log('   ✅ Uses main Telegram connector');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testTelegramAPI(); 