#!/usr/bin/env node

/**
 * Test Different Authentication Methods for UDM Pro
 */

const https = require('https');

const config = {
  host: '10.0.0.1',
  port: 443,
  apiKey: 'nD6J3rQIOv2liStUy-zUGfnpZrXuLgYw'
};

function makeRequest(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': config.apiKey,
        ...headers
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`\n📡 ${path}`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers:`, res.headers);
        console.log(`Response:`, data.substring(0, 200) + '...');
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testAuthMethods() {
  console.log('🔐 Testing Different Authentication Methods for UDM Pro\n');

  const tests = [
    {
      name: 'Protect Bootstrap with API Key',
      path: '/proxy/protect/api/bootstrap',
      headers: {}
    },
    {
      name: 'Protect Bootstrap with Bearer Token (placeholder)',
      path: '/proxy/protect/api/bootstrap',
      headers: { 'Authorization': 'Bearer YOUR_TOKEN_HERE' }
    },
    {
      name: 'Protect Bootstrap with Cookie (placeholder)',
      path: '/proxy/protect/api/bootstrap',
      headers: { 'Cookie': 'TOKEN=YOUR_TOKEN_HERE' }
    },
    {
      name: 'Network API with API Key',
      path: '/proxy/network/integration/v1/sites',
      headers: {}
    },
    {
      name: 'Direct Protect Endpoint',
      path: '/protect/api/bootstrap',
      headers: {}
    }
  ];

  for (const test of tests) {
    console.log(`\n🧪 ${test.name}`);
    try {
      await makeRequest(test.path, test.headers);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n💡 Instructions:');
  console.log('1. Look for successful responses (200 status)');
  console.log('2. Check for any authentication headers in responses');
  console.log('3. Replace YOUR_TOKEN_HERE with actual tokens from browser');
}

testAuthMethods().catch(console.error); 