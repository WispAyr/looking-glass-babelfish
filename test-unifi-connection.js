/**
 * UniFi Protect Connection Test
 * 
 * Tests connection to UniFi Protect system and helps diagnose authentication issues
 */

const axios = require('axios');
const https = require('https');

class UniFiConnectionTester {
  constructor(config) {
    this.config = config;
    this.baseUrl = `${config.protocol}://${config.host}:${config.port}`;
  }

  async testBasicConnectivity() {
    console.log('🔍 Testing basic connectivity...');
    
    try {
      const response = await axios.get(this.baseUrl, {
        httpsAgent: new https.Agent({
          rejectUnauthorized: this.config.verifySSL
        }),
        timeout: 10000
      });
      
      console.log('✅ Basic connectivity: SUCCESS');
      console.log(`   Status: ${response.status}`);
      console.log(`   Content-Type: ${response.headers['content-type']}`);
      
      return true;
    } catch (error) {
      console.log('❌ Basic connectivity: FAILED');
      console.log(`   Error: ${error.message}`);
      return false;
    }
  }

  async testAuthentication() {
    console.log('\n🔐 Testing authentication...');
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
        username: this.config.username,
        password: this.config.password
      }, {
        httpsAgent: new https.Agent({
          rejectUnauthorized: this.config.verifySSL
        }),
        timeout: 10000
      });
      
      console.log('✅ Authentication request: SUCCESS');
      console.log(`   Status: ${response.status}`);
      
      if (response.data?.data?.required === '2fa') {
        console.log('⚠️  2FA authentication required');
        console.log('   Available authenticators:');
        response.data.data.authenticators.forEach(auth => {
          console.log(`     - ${auth.type}: ${auth.name || auth.email || auth.id}`);
        });
        return { requires2FA: true, data: response.data };
      }
      
      return { requires2FA: false, data: response.data };
    } catch (error) {
      console.log('❌ Authentication: FAILED');
      console.log(`   Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      return { requires2FA: false, error: error.message };
    }
  }

  async testAPIKey() {
    console.log('\n🔑 Testing API key...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/proxy/network/integration/v1/sites`, {
        headers: {
          'X-API-KEY': this.config.apiKey
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: this.config.verifySSL
        }),
        timeout: 10000
      });
      
      console.log('✅ API key: VALID');
      console.log(`   Status: ${response.status}`);
      console.log(`   Sites found: ${response.data?.data?.length || 0}`);
      
      return true;
    } catch (error) {
      console.log('❌ API key: INVALID');
      console.log(`   Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      return false;
    }
  }

  async testProtectAPI() {
    console.log('\n📹 Testing UniFi Protect API...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/proxy/protect/api/bootstrap`, {
        headers: {
          'X-API-KEY': this.config.apiKey
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: this.config.verifySSL
        }),
        timeout: 10000
      });
      
      console.log('✅ UniFi Protect API: SUCCESS');
      console.log(`   Status: ${response.status}`);
      
      if (response.data?.cameras) {
        console.log(`   Cameras found: ${response.data.cameras.length}`);
        response.data.cameras.forEach(camera => {
          console.log(`     - ${camera.name} (${camera.id}) - ${camera.state}`);
        });
      }
      
      return true;
    } catch (error) {
      console.log('❌ UniFi Protect API: FAILED');
      console.log(`   Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 UniFi Protect Connection Test\n');
    console.log(`Target: ${this.baseUrl}`);
    console.log(`Username: ${this.config.username}`);
    console.log(`API Key: ${this.config.apiKey.substring(0, 8)}...`);
    console.log('');

    const results = {
      connectivity: await this.testBasicConnectivity(),
      auth: await this.testAuthentication(),
      apiKey: await this.testAPIKey(),
      protectAPI: await this.testProtectAPI()
    };

    console.log('\n📊 Test Summary:');
    console.log(`   Basic Connectivity: ${results.connectivity ? '✅' : '❌'}`);
    console.log(`   Authentication: ${results.auth.requires2FA ? '⚠️ 2FA Required' : results.auth.error ? '❌' : '✅'}`);
    console.log(`   API Key: ${results.apiKey ? '✅' : '❌'}`);
    console.log(`   Protect API: ${results.protectAPI ? '✅' : '❌'}`);

    if (!results.apiKey) {
      console.log('\n🔧 To fix API key issues:');
      console.log('1. Log into UniFi Protect web interface');
      console.log('2. Go to Settings > Users');
      console.log('3. Generate a new API key');
      console.log('4. Update the connector configuration');
      console.log('5. Restart the application');
    }

    if (results.auth.requires2FA) {
      console.log('\n🔧 To handle 2FA:');
      console.log('1. Use a backup code or authenticator app');
      console.log('2. Complete 2FA authentication');
      console.log('3. Generate API key after successful login');
    }

    return results;
  }
}

// Test configuration
const testConfig = {
  host: '10.0.0.1',
  port: 443,
  protocol: 'https',
  username: 'ewanrichardson@icloud.com',
  password: 'RBTeeyKM142!',
  apiKey: 'nD6J3rQIOv2liStUy-zUGfnpZrXuLgYw',
  verifySSL: false
};

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new UniFiConnectionTester(testConfig);
  tester.runAllTests()
    .then(results => {
      console.log('\n✨ Test completed');
      process.exit(results.apiKey && results.protectAPI ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = UniFiConnectionTester; 