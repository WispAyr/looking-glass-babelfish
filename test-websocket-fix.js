const WebSocket = require('ws');

console.log('🧪 Testing WebSocket Fix');
console.log('========================');

// Test WebSocket connection
const ws = new WebSocket('ws://127.0.0.1:3000/alarms/ws/alerts');

let connectionAttempts = 0;
const maxAttempts = 3;

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully');
  
  // Send a test alert after connection
  setTimeout(() => {
    console.log('📤 Sending test alert...');
    fetch('http://127.0.0.1:3000/alarms/api/test-alert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'info',
        title: 'WebSocket Test',
        message: 'Testing WebSocket connection fix'
      })
    }).then(response => response.json())
    .then(data => {
      console.log('📨 Alert sent:', data.success ? '✅' : '❌');
    })
    .catch(error => {
      console.log('📨 Alert failed:', error.message);
    });
  }, 1000);
  
  // Close connection after 3 seconds
  setTimeout(() => {
    console.log('🔌 Closing WebSocket connection...');
    ws.close(1000, 'Test completed');
  }, 3000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`📥 Received message: ${message.type} - ${message.message}`);
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

ws.on('close', (code, reason) => {
  console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
  process.exit(0);
});

ws.on('error', (error) => {
  connectionAttempts++;
  console.error(`❌ WebSocket error (attempt ${connectionAttempts}/${maxAttempts}):`, error.message);
  
  if (connectionAttempts >= maxAttempts) {
    console.log('❌ Max connection attempts reached, test failed');
    process.exit(1);
  }
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout reached');
  process.exit(1);
}, 10000); 