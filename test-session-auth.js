#!/usr/bin/env node

const https = require('https');
const axios = require('axios');

async function testSessionAuth() {
  const config = {
    host: '10.0.0.1',
    port: 443,
    protocol: 'https',
    username: 'ewanrichardson@icloud.com',
    password: 'RBTeeyKM142!',
    verifySSL: false
  };
  
  const baseUrl = `${config.protocol}://${config.host}:${config.port}`;
  
  try {
    console.log('🔐 Testing session-based authentication...');
    
    // Try different approaches to get CSRF token
    console.log('Step 1: Trying different CSRF token approaches...');
    
    // Approach 1: Try the main page to get CSRF token
    console.log('Approach 1: Getting CSRF from main page...');
    try {
      const mainPageResponse = await axios.get(`${baseUrl}/`, {
        httpsAgent: new https.Agent({ rejectUnauthorized: config.verifySSL }),
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      console.log('Main page status:', mainPageResponse.status);
      console.log('Main page cookies:', mainPageResponse.headers['set-cookie']);
      
      // Look for CSRF token in HTML content
      const htmlContent = mainPageResponse.data;
      const csrfMatch = htmlContent.match(/csrfToken['"]?\s*:\s*['"]([^'"]+)['"]/);
      if (csrfMatch) {
        console.log('✅ Found CSRF token in main page:', csrfMatch[1].substring(0, 8) + '...');
        const csrfToken = csrfMatch[1];
        
        // Try login with this CSRF token
        console.log('Step 2: Logging in with credentials...');
        const loginResponse = await axios.post(`${baseUrl}/api/auth/login`, {
          username: config.username,
          password: config.password,
          remember: true
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: config.verifySSL }),
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        
        console.log('Login response status:', loginResponse.status);
        console.log('Login response data:', loginResponse.data);
        
        if (loginResponse.data && loginResponse.data.token) {
          const sessionToken = loginResponse.data.token;
          console.log('✅ Login successful, session token obtained');
          
          // Extract cookies from response
          const cookies = loginResponse.headers['set-cookie'] || [];
          const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
          console.log('✅ Cookies extracted:', cookieHeader ? 'Present' : 'None');
          
          // Test Protect API access
          console.log('Step 3: Testing Protect API access...');
          const protectTest = await axios.get(`${baseUrl}/proxy/protect/api/bootstrap`, {
            headers: {
              'Authorization': `Bearer ${sessionToken}`,
              'X-CSRF-Token': csrfToken,
              'Cookie': cookieHeader,
              'Accept': 'application/json'
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: config.verifySSL }),
            timeout: 10000,
            validateStatus: (status) => status < 500
          });
          
          if (protectTest.data && protectTest.data.accessKey) {
            console.log('✅ Session-based authentication successful for Protect API');
            console.log('✅ Bootstrap data contains:', {
              accessKey: protectTest.data.accessKey ? 'Present' : 'Missing',
              lastUpdateId: protectTest.data.lastUpdateId || 'None',
              cameras: protectTest.data.cameras?.length || 0,
              nvr: protectTest.data.nvr ? 'Present' : 'Missing'
            });
            
            // Test camera snapshot endpoint
            console.log('Step 4: Testing camera snapshot endpoint...');
            const snapshotTest = await axios.get(`${baseUrl}/proxy/protect/api/cameras/6821d75103e1f803e4001048/snapshot`, {
              headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'X-CSRF-Token': csrfToken,
                'Cookie': cookieHeader,
                'Accept': 'application/json'
              },
              httpsAgent: new https.Agent({ rejectUnauthorized: config.verifySSL }),
              timeout: 10000,
              validateStatus: (status) => status < 500
            });
            
            console.log('✅ Camera snapshot endpoint accessible');
            console.log('✅ Session authentication is working correctly!');
            return;
          }
        }
      } else {
        console.log('❌ No CSRF token found in main page');
      }
    } catch (error) {
      console.log('❌ Main page approach failed:', error.message);
    }
    
    // Approach 2: Try direct login without CSRF token first
    console.log('Approach 2: Trying direct login...');
    try {
      const loginResponse = await axios.post(`${baseUrl}/api/auth/login`, {
        username: config.username,
        password: config.password,
        remember: true
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: config.verifySSL }),
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      console.log('Direct login status:', loginResponse.status);
      console.log('Direct login data:', loginResponse.data);
      
      if (loginResponse.data && loginResponse.data.token) {
        const sessionToken = loginResponse.data.token;
        console.log('✅ Direct login successful');
        
        // Extract cookies from response
        const cookies = loginResponse.headers['set-cookie'] || [];
        const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
        console.log('✅ Cookies extracted:', cookieHeader ? 'Present' : 'None');
        
        // Now try to get CSRF token with session
        console.log('Step 3: Getting CSRF token with session...');
        const csrfResponse = await axios.get(`${baseUrl}/api/auth/csrf`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Cookie': cookieHeader
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: config.verifySSL }),
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        
        console.log('CSRF with session status:', csrfResponse.status);
        console.log('CSRF with session data:', csrfResponse.data);
        
        if (csrfResponse.data && csrfResponse.data.csrfToken) {
          const csrfToken = csrfResponse.data.csrfToken;
          console.log('✅ CSRF token obtained with session');
          
          // Test Protect API access
          console.log('Step 4: Testing Protect API access...');
          const protectTest = await axios.get(`${baseUrl}/proxy/protect/api/bootstrap`, {
            headers: {
              'Authorization': `Bearer ${sessionToken}`,
              'X-CSRF-Token': csrfToken,
              'Cookie': cookieHeader,
              'Accept': 'application/json'
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: config.verifySSL }),
            timeout: 10000,
            validateStatus: (status) => status < 500
          });
          
          if (protectTest.data && protectTest.data.accessKey) {
            console.log('✅ Session-based authentication successful for Protect API');
            console.log('✅ Bootstrap data contains:', {
              accessKey: protectTest.data.accessKey ? 'Present' : 'Missing',
              lastUpdateId: protectTest.data.lastUpdateId || 'None',
              cameras: protectTest.data.cameras?.length || 0,
              nvr: protectTest.data.nvr ? 'Present' : 'Missing'
            });
            
            console.log('✅ Session authentication is working correctly!');
            return;
          }
        }
      }
    } catch (error) {
      console.log('❌ Direct login approach failed:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    throw new Error('All authentication approaches failed');
    
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testSessionAuth(); 