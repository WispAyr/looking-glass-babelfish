const WebSocket = require('ws');

console.log('🧪 Testing Simple WebSocket Connection');
console.log('=====================================');

// Test basic WebSocket connection
const ws = new WebSocket('ws://127.0.0.1:3000/alarms/ws/alerts');

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully');
  
  // Send a simple message
  ws.send(JSON.stringify({
    type: 'ping',
    message: 'Hello server'
  }));
  
  // Close after 2 seconds
  setTimeout(() => {
    ws.close(1000, 'Test completed');
  }, 2000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    console.log('📨 Received message:', message);
  } catch (error) {
    console.log('📨 Received raw message:', data.toString());
  }
});

ws.on('close', (code, reason) => {
  console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
}); 