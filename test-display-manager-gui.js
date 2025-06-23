const WebSocket = require('ws');
const http = require('http');

async function testDisplayManagerGUI() {
  console.log('🧪 Testing Display Manager GUI...');

  // Test WebSocket connection
  const ws = new WebSocket('ws://localhost:3000/display/manager');

  ws.on('open', () => {
    console.log('✅ WebSocket connected to Display Manager GUI');
    
    // Request displays list
    ws.send(JSON.stringify({
      type: 'displays:get'
    }));
    
    // Request templates list
    ws.send(JSON.stringify({
      type: 'templates:get'
    }));
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('📨 Received message:', message.type);
      
      switch (message.type) {
        case 'displays:list':
          console.log(`📺 Found ${message.data.length} displays`);
          message.data.forEach(display => {
            console.log(`  - ${display.name} (${display.id})`);
          });
          break;
          
        case 'templates:list':
          console.log(`📋 Found ${message.data.length} templates`);
          message.data.forEach(template => {
            console.log(`  - ${template.name} (${template.id})`);
          });
          break;
          
        case 'view:saved':
          console.log('💾 View saved:', message.data);
          break;
          
        case 'view:applied':
          console.log('✅ View applied:', message.data);
          break;
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket closed');
  });

  // Test HTTP endpoints
  const testEndpoints = [
    '/display/manager',
    '/display/api/status',
    '/display/api/displays',
    '/display/api/views',
    '/display/api/templates'
  ];

  for (const endpoint of testEndpoints) {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: 3000,
          path: endpoint,
          method: 'GET'
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('Timeout')));
        req.end();
      });

      if (response.status === 200) {
        console.log(`✅ ${endpoint} - OK`);
      } else {
        console.log(`⚠️  ${endpoint} - Status ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
    }
  }

  // Keep connection open for a bit to receive messages
  setTimeout(() => {
    ws.close();
    console.log('🏁 Test completed');
  }, 3000);
}

// Run the test
testDisplayManagerGUI().catch(console.error); 