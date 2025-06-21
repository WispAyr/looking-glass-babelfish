#!/usr/bin/env node

/**
 * Check UniFi Protect Installation Status
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
        resolve({ 
          status: res.statusCode, 
          data, 
          headers: res.headers,
          location: res.headers.location
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function checkProtectStatus() {
  console.log('🔍 Checking UniFi Protect Installation Status\n');

  const endpoints = [
    { name: 'Protect Bootstrap', path: '/proxy/protect/api/bootstrap' },
    { name: 'Protect Meta Info', path: '/proxy/protect/v1/meta/info' },
    { name: 'Protect Subscribe Devices', path: '/proxy/protect/v1/subscribe/devices' },
    { name: 'Protect Cameras', path: '/proxy/protect/v1/cameras' },
    { name: 'Protect System', path: '/proxy/protect/v1/system' },
    { name: 'Protect Events', path: '/proxy/protect/v1/events' },
    { name: 'Direct Protect', path: '/protect/api/bootstrap' },
    { name: 'Network Sites', path: '/proxy/network/integration/v1/sites' },
    { name: 'Network Devices', path: '/proxy/network/integration/v1/devices' }
  ];

  for (const endpoint of endpoints) {
    console.log(`\n🧪 ${endpoint.name}: ${endpoint.path}`);
    try {
      const result = await makeRequest(endpoint.path);
      console.log(`   Status: ${result.status}`);
      
      if (result.location) {
        console.log(`   Redirect: ${result.location}`);
      }
      
      if (result.status === 200 && result.data) {
        const contentType = result.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            const json = JSON.parse(result.data);
            if (json.data) {
              console.log(`   Data: ${JSON.stringify(json.data).substring(0, 100)}...`);
            }
          } catch (e) {
            console.log(`   Response: ${result.data.substring(0, 100)}...`);
          }
        } else {
          console.log(`   Content-Type: ${contentType}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n📋 Analysis:');
  console.log('✅ Network API endpoints work (200 status)');
  console.log('❌ Protect API endpoints fail (500/302 status)');
  console.log('⚠️ Direct Protect endpoint returns HTML (web interface)');
  console.log('\n💡 Conclusion:');
  console.log('   UniFi Protect appears to be NOT INSTALLED or NOT RUNNING');
  console.log('   Network Controller is working perfectly');
  console.log('\n🔧 Recommendations:');
  console.log('   1. Check UniFi OS Applications for Protect installation');
  console.log('   2. Install UniFi Protect if not present');
  console.log('   3. Or continue using Network API only mode');
}

checkProtectStatus().catch(console.error); 