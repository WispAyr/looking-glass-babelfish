const WebSocket = require('ws');

console.log('🧪 Simple WebSocket Test');
console.log('========================');

// Test basic WebSocket connection
const ws = new WebSocket('ws://127.0.0.1:3000/alarms/ws/alerts', {
  // Disable compression
  perMessageDeflate: false,
  // Use basic protocol
  protocol: 'ws'
});

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
  console.log('📥 Received:', data.toString());
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Closed: ${code} - ${reason}`);
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

// Timeout
setTimeout(() => {
  console.log('⏰ Timeout');
  process.exit(1);
}, 5000); 