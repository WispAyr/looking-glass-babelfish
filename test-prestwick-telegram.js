#!/usr/bin/env node

/**
 * Test Prestwick Airport Telegram Integration
 * 
 * This script tests the Telegram notification system for Prestwick Airport events.
 * It requires a valid Telegram bot token and chat ID to be configured.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/prestwick';

async function testTelegramIntegration() {
  console.log('🧪 Testing Prestwick Airport Telegram Integration\n');

  try {
    // Test 1: Get current Telegram configuration
    console.log('1. Getting current Telegram configuration...');
    const configResponse = await axios.get(`${BASE_URL}/telegram/config`);
    console.log('✅ Current config:', JSON.stringify(configResponse.data.data, null, 2));

    // Test 2: Configure Telegram notifications
    console.log('\n2. Configuring Telegram notifications...');
    const configureResponse = await axios.post(`${BASE_URL}/telegram/config`, {
      enabled: true,
      chatId: '@fhNYM0MnPJQ2NjE8', // Use the chat ID from config
      eventTypes: ['approach', 'landing', 'takeoff', 'departure']
    });
    console.log('✅ Configuration result:', JSON.stringify(configureResponse.data.data, null, 2));

    // Test 3: Send test notification
    console.log('\n3. Sending test notification...');
    const testResponse = await axios.post(`${BASE_URL}/telegram/test`);
    console.log('✅ Test result:', JSON.stringify(testResponse.data.data, null, 2));

    // Test 4: Get updated configuration
    console.log('\n4. Getting updated configuration...');
    const updatedConfigResponse = await axios.get(`${BASE_URL}/telegram/config`);
    console.log('✅ Updated config:', JSON.stringify(updatedConfigResponse.data.data, null, 2));

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Set up your Telegram bot token in config/connectors.json');
    console.log('2. Configure the chat ID where you want to receive notifications');
    console.log('3. The system will automatically send notifications when aircraft events occur');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 503) {
      console.log('\n💡 Make sure the Prestwick Airport connector is running');
    }
    
    if (error.response?.status === 500) {
      console.log('\n💡 Check that the Telegram connector is properly configured');
    }
  }
}

// Run the test
testTelegramIntegration(); 