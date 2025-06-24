const WebSocket = require('ws');

console.log('🧪 Testing Alerts System Fix');
console.log('============================');

// Test WebSocket connection - use IPv4 explicitly
const ws = new WebSocket('ws://127.0.0.1:3000/alarms/ws/alerts');

let messageCount = 0;
const receivedMessages = new Set();

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully');
  
  // Send multiple test alerts
  setTimeout(() => {
    console.log('📤 Sending test alerts...');
    
    // Send 5 test alerts
    for (let i = 1; i <= 5; i++) {
      setTimeout(() => {
        fetch('http://127.0.0.1:3000/alarms/api/test-alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'info',
            title: `Test Alert ${i}`,
            message: `This is test alert number ${i}`,
            priority: 'medium'
          })
        }).then(response => response.json())
        .then(data => {
          console.log(`✅ Alert ${i} sent:`, data.success ? 'SUCCESS' : 'FAILED');
        })
        .catch(error => {
          console.error(`❌ Alert ${i} failed:`, error.message);
        });
      }, i * 1000); // Send each alert 1 second apart
    }
  }, 1000);
});

ws.on('message', (data) => {
  messageCount++;
  const message = data.toString();
  
  // Check for duplicates
  if (receivedMessages.has(message)) {
    console.log('🚨 DUPLICATE MESSAGE DETECTED!');
    console.log('Message:', message);
  } else {
    receivedMessages.add(message);
    console.log(`📨 Received message ${messageCount}:`, JSON.parse(message).type || 'unknown');
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket closed');
  console.log(`📊 Summary: Received ${messageCount} messages, ${receivedMessages.size} unique`);
  
  if (messageCount === receivedMessages.size) {
    console.log('✅ No duplicate messages detected - fix successful!');
  } else {
    console.log('❌ Duplicate messages detected - issue persists');
  }
  
  process.exit(0);
});

// Auto-close after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout reached');
  ws.close();
}, 10000); 