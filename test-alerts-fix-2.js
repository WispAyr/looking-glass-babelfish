const WebSocket = require('ws');

console.log('🧪 Testing Alerts System Fix - Part 2');
console.log('=====================================');

// Test WebSocket connection
const ws = new WebSocket('ws://127.0.0.1:3000/alarms/ws/alerts');

let messageCount = 0;
const receivedMessages = new Set();
const messageTimestamps = [];

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully');
  
  // Send multiple test alerts to test rate limiting
  setTimeout(() => {
    console.log('📤 Sending rapid test alerts to test rate limiting...');
    
    // Send 10 test alerts rapidly
    for (let i = 1; i <= 10; i++) {
      setTimeout(() => {
        fetch('http://127.0.0.1:3000/alarms/api/test-alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'info',
            title: `Test Alert ${i}`,
            message: `Testing rate limiting - alert ${i}`,
            priority: 'medium'
          })
        }).then(response => response.json())
        .then(data => {
          console.log(`📨 Alert ${i} sent:`, data.success ? '✅' : '❌');
        })
        .catch(error => {
          console.log(`📨 Alert ${i} failed:`, error.message);
        });
      }, i * 100); // Send every 100ms
    }
    
    // Wait and then send a different type of alert
    setTimeout(() => {
      console.log('📤 Sending different event type to test rate limiting...');
      fetch('http://127.0.0.1:3000/alarms/api/test-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'warning',
          title: 'Different Event Type',
          message: 'This should not be rate limited',
          priority: 'high'
        })
      }).then(response => response.json())
      .then(data => {
        console.log('📨 Different event type sent:', data.success ? '✅' : '❌');
      })
      .catch(error => {
        console.log('📨 Different event type failed:', error.message);
      });
    }, 2000);
    
    // End test after 5 seconds
    setTimeout(() => {
      console.log('\n📊 Test Results:');
      console.log('================');
      console.log(`Total messages received: ${messageCount}`);
      console.log(`Unique messages: ${receivedMessages.size}`);
      console.log(`Duplicate messages: ${messageCount - receivedMessages.size}`);
      
      if (messageCount === receivedMessages.size) {
        console.log('✅ SUCCESS: No duplicate messages detected!');
      } else {
        console.log('❌ FAILURE: Duplicate messages detected!');
      }
      
      if (messageCount > 0) {
        console.log('✅ SUCCESS: Messages are being received!');
      } else {
        console.log('❌ FAILURE: No messages received!');
      }
      
      console.log('\n📈 Message timing analysis:');
      messageTimestamps.forEach((timestamp, index) => {
        if (index > 0) {
          const timeDiff = timestamp - messageTimestamps[index - 1];
          console.log(`  Message ${index + 1}: +${timeDiff}ms`);
        }
      });
      
      ws.close();
      process.exit(0);
    }, 5000);
    
  }, 1000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    messageCount++;
    const messageKey = `${message.type}-${message.title}-${message.message}`;
    receivedMessages.add(messageKey);
    messageTimestamps.push(Date.now());
    
    console.log(`📥 Received message ${messageCount}: ${message.type} - ${message.title}`);
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
}); 