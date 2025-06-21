#!/usr/bin/env node

/**
 * Test Session-Based Authentication for Protect
 */

const https = require('https');

const config = {
  host: '10.0.0.1',
  port: 443,
  username: 'ewanrichardson@icloud.com',
  password: 'RBTeeyKM142!',
  apiKey: 'nD6J3rQIOv2liStUy-zUGfnpZrXuLgYw'
};

function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: path,
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-API-KEY': config.apiKey,
        ...headers
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        resolve({ 
          status: res.statusCode, 
          data: responseData, 
          headers: res.headers,
          location: res.headers.location
        });
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testProtectSession() {
  console.log('🔐 Testing Session-Based Authentication for Protect\n');

  try {
    // Step 1: Try to get a session token
    console.log('Step 1: Attempting login to get session token...');
    const loginResponse = await makeRequest('/api/auth/login', 'POST', {
      username: config.username,
      password: config.password,
      remember: true
    });

    console.log(`Login Status: ${loginResponse.status}`);
    console.log(`Response: ${loginResponse.data.substring(0, 200)}...`);

    if (loginResponse.status === 499) {
      console.log('✅ Login initiated, 2FA required');
      
      // Try to parse the response to get authenticators
      try {
        const loginData = JSON.parse(loginResponse.data);
        if (loginData.data && loginData.data.authenticators) {
          console.log('\n📱 Available 2FA methods:');
          loginData.data.authenticators.forEach(auth => {
            console.log(`   - ${auth.type}: ${auth.name || auth.email || auth.id}`);
          });
        }
      } catch (e) {
        console.log('Could not parse login response');
      }
    }

    // Step 2: Try Protect endpoints with different auth methods
    console.log('\nStep 2: Testing Protect endpoints...');
    
    const protectEndpoints = [
      '/proxy/protect/integrations/v1/cameras',
      '/proxy/protect/integrations/v1/events',
      '/proxy/protect/integrations/v1/bootstrap'
    ];

    for (const endpoint of protectEndpoints) {
      console.log(`\nTesting: ${endpoint}`);
      
      // Try with API key
      const apiKeyResponse = await makeRequest(endpoint);
      console.log(`   API Key: ${apiKeyResponse.status} ${apiKeyResponse.location ? `(redirect: ${apiKeyResponse.location})` : ''}`);
      
      // Try with different headers
      const altResponse = await makeRequest(endpoint, 'GET', null, {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://10.0.0.1/'
      });
      console.log(`   With User-Agent: ${altResponse.status} ${altResponse.location ? `(redirect: ${altResponse.location})` : ''}`);
    }

    console.log('\n💡 Analysis:');
    console.log('   - Network API works with API key');
    console.log('   - Protect API requires different authentication');
    console.log('   - 2FA authentication may be required');
    console.log('\n🔧 Next Steps:');
    console.log('   1. Complete 2FA authentication in browser');
    console.log('   2. Extract session token from browser');
    console.log('   3. Use session token for Protect API calls');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testProtectSession().catch(console.error); 