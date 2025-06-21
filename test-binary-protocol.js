#!/usr/bin/env node

/**
 * Test binary protocol decoder for UniFi Protect
 * Based on https://github.com/hjdhjd/unifi-protect
 */

const UnifiProtectConnector = require('./connectors/types/UnifiProtectConnector');

// Create a mock connector instance for testing
const mockConfig = {
  id: 'test-unifi-protect',
  type: 'unifi-protect',
  host: '10.0.0.1',
  port: 443,
  protocol: 'https',
  apiKey: 'test-key',
  username: 'test@example.com',
  password: 'test-password',
  verifySSL: false
};

const connector = new UnifiProtectConnector(mockConfig);

// Test binary message structure based on the repository
function createTestBinaryMessage() {
  // Create a simple test message structure
  const actionFrame = JSON.stringify({
    action: 'update',
    id: 'test-camera-id',
    modelKey: 'camera',
    newUpdateId: 'test-update-id'
  });
  
  const dataFrame = JSON.stringify({
    id: 'test-camera-id',
    name: 'Test Camera',
    lastMotion: new Date().toISOString()
  });
  
  // Convert to buffers
  const actionBuffer = Buffer.from(actionFrame, 'utf8');
  const dataBuffer = Buffer.from(dataFrame, 'utf8');
  
  // Create header frames (8 bytes each)
  const header1 = Buffer.alloc(8);
  header1[0] = 1; // Packet type: action frame
  header1[1] = 1; // Payload format: JSON
  header1[2] = 0; // Not deflated
  header1[3] = 0; // Unknown
  header1.writeUInt32BE(actionBuffer.length, 4); // Payload size
  
  const header2 = Buffer.alloc(8);
  header2[0] = 2; // Packet type: payload frame
  header2[1] = 1; // Payload format: JSON
  header2[2] = 0; // Not deflated
  header2[3] = 0; // Unknown
  header2.writeUInt32BE(dataBuffer.length, 4); // Payload size
  
  // Combine all frames
  return Buffer.concat([header1, actionBuffer, header2, dataBuffer]);
}

console.log('🧪 Testing UniFi Protect Binary Protocol Decoder');
console.log('Based on https://github.com/hjdhjd/unifi-protect\n');

// Test 1: Create and decode a test message
console.log('📦 Test 1: Create and decode test message');
const testMessage = createTestBinaryMessage();
console.log('Test message size:', testMessage.length, 'bytes');

const decodedMessage = connector.decodeBinaryMessage(testMessage);
if (decodedMessage) {
  console.log('✅ Successfully decoded message:');
  console.log('  Action:', decodedMessage.action);
  console.log('  ID:', decodedMessage.id);
  console.log('  Model Key:', decodedMessage.modelKey);
  console.log('  Data:', JSON.stringify(decodedMessage.data, null, 2));
} else {
  console.log('❌ Failed to decode message');
}

console.log('\n🔍 Test 2: Test header frame parsing');
const header = connector.parseHeaderFrame(testMessage, 0);
if (header) {
  console.log('✅ Header frame parsed:');
  console.log('  Packet Type:', header.packetType);
  console.log('  Payload Format:', header.payloadFormat);
  console.log('  Deflated:', header.deflated);
  console.log('  Payload Size:', header.payloadSize);
} else {
  console.log('❌ Failed to parse header frame');
}

console.log('\n🎯 Test 3: Test action frame parsing');
const actionFrame = connector.parseActionFrame(testMessage, 8, header.payloadSize);
if (actionFrame) {
  console.log('✅ Action frame parsed:');
  console.log('  Action:', actionFrame.action);
  console.log('  ID:', actionFrame.id);
  console.log('  Model Key:', actionFrame.modelKey);
} else {
  console.log('❌ Failed to parse action frame');
}

console.log('\n✨ Binary protocol decoder test completed'); 