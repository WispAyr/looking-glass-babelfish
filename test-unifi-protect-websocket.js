#!/usr/bin/env node

/**
 * Test script for UniFi Protect WebSocket connection
 * Tests the updated WebSocket implementation with correct endpoint and protocol
 */

const WebSocket = require('ws');
const { URL } = require('url');

// Configuration - update these values for your setup
const config = {
  host: '10.0.0.1',
  port: 80,
  apiKey: 'wye3aapIuxAz2omKg4WFdCSncRBfSzPx',
  verifySSL: false
};

// Test endpoints based on community findings
const testEndpoints = [
  '/proxy/protect/integration/v1/subscribe/events',  // Primary endpoint (correct path)
  '/proxy/protect/integration/v1/subscribe/devices', // Alternative endpoint
  '/proxy/protect/v1/subscribe/events',             // Fallback (old path)
  '/proxy/protect/v1/subscribe/devices',            // Fallback (old path)
];

async function testWebSocketEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = `ws://${config.host}:${config.port}${endpoint}`;
    console.log(`\n🔍 Testing WebSocket endpoint: ${url}`);
    
    // Set up headers with API key authentication and WebSocket handshake
    const headers = {
      'X-API-KEY': config.apiKey,
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
      'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': Buffer.from(Math.random().toString()).toString('base64')
    };
    
    console.log('📋 Using headers:', JSON.stringify(headers, null, 2));
    
    const ws = new WebSocket(url, {
      headers,
      rejectUnauthorized: false,
      followRedirects: true,
      handshakeTimeout: 10000
    });

    const timeout = setTimeout(() => {
      console.log('⏰ Timeout - closing connection');
      ws.close();
      resolve({ endpoint, success: false, reason: 'timeout' });
    }, 10000);

    ws.on('open', () => {
      clearTimeout(timeout);
      console.log('✅ WebSocket connected successfully!');
      console.log('🔄 Protocol switching completed');
      
      // Send a test subscription message
      const testMessage = {
        action: 'subscribe',
        newUpdateId: 'motion'
      };
      
      console.log('📤 Sending test subscription:', JSON.stringify(testMessage));
      ws.send(JSON.stringify(testMessage));
      
      // Wait a moment then close
      setTimeout(() => {
        ws.close();
        resolve({ endpoint, success: true, reason: 'connected' });
      }, 2000);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 Received message:', JSON.stringify(message, null, 2));
      } catch (error) {
        console.log('📥 Received binary/non-JSON message:', data.toString());
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log('❌ WebSocket error:', error.message);
      if (error.code) console.log('   Error code:', error.code);
      if (error.errno) console.log('   Error number:', error.errno);
      resolve({ endpoint, success: false, reason: 'error', error: error.message });
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
      
      // Handle specific codes
      if (code === 101) {
        console.log('ℹ️  HTTP 101 Switching Protocols - expected during handshake');
        resolve({ endpoint, success: true, reason: 'protocol_switch' });
      } else if (code === 302) {
        console.log('ℹ️  HTTP 302 Redirect - expected for WebSocket endpoints');
        resolve({ endpoint, success: false, reason: 'redirect' });
      } else if (code === 1000) {
        console.log('ℹ️  Normal closure');
        resolve({ endpoint, success: true, reason: 'normal_close' });
      } else {
        resolve({ endpoint, success: false, reason: 'unexpected_close', code, reason });
      }
    });

    ws.on('upgrade', (response) => {
      console.log('🔄 Upgrade response received');
      console.log(`   Status: ${response.statusCode} ${response.statusMessage}`);
    });
  });
}

async function runTests() {
  console.log('🚀 Starting UniFi Protect WebSocket connection tests');
  console.log('📍 Target host:', config.host);
  console.log('🔑 Using API key:', config.apiKey.substring(0, 8) + '...');
  
  const results = [];
  
  for (const endpoint of testEndpoints) {
    const result = await testWebSocketEndpoint(endpoint);
    results.push(result);
    
    if (result.success) {
      console.log(`\n🎉 SUCCESS: ${endpoint} is working!`);
      break; // Found a working endpoint, no need to test others
    } else {
      console.log(`\n❌ FAILED: ${endpoint} - ${result.reason}`);
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  const workingEndpoints = results.filter(r => r.success);
  const failedEndpoints = results.filter(r => !r.success);
  
  if (workingEndpoints.length > 0) {
    console.log('✅ Working endpoints:');
    workingEndpoints.forEach(r => {
      console.log(`   - ${r.endpoint} (${r.reason})`);
    });
  }
  
  if (failedEndpoints.length > 0) {
    console.log('❌ Failed endpoints:');
    failedEndpoints.forEach(r => {
      console.log(`   - ${r.endpoint} (${r.reason})`);
    });
  }
  
  console.log(`\n🎯 Overall: ${workingEndpoints.length}/${results.length} endpoints working`);
  
  if (workingEndpoints.length === 0) {
    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Verify the API key is correct and not expired');
    console.log('   2. Check if UniFi Protect is installed and running');
    console.log('   3. Ensure port 80 is accessible');
    console.log('   4. Try accessing the endpoint via HTTP first');
    console.log('   5. Check firewall settings');
  }
}

// Run the tests
runTests().catch(console.error); 