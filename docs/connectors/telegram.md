# Telegram Connector

The Telegram Connector provides integration with the Telegram Bot API, enabling the Babelfish system to send and receive messages through Telegram bots.

## ✅ **Recent Integration Fix**

### Issue Resolution
The Telegram connector was recently fixed to resolve a **409 Conflict error** that prevented proper integration with the main system.

**Problem**: The Telegram connector was not properly registered in the main server, causing:
- 409 Conflict errors when multiple instances tried to connect
- Telegram notifications not working with other connectors
- Integration failures with Prestwick Airport and other notification-dependent features

**Solution**: Added proper import and registration in `server.js`:
```javascript
// Added missing import
const TelegramConnector = require('./connectors/types/TelegramConnector');

// Added connector registration
connectorRegistry.registerType('telegram', TelegramConnector);
```

**Result**: 
- ✅ Telegram notifications now work correctly with all connectors
- ✅ Prestwick Airport NOTAM alerts function properly
- ✅ Alarm Manager notifications work as expected
- ✅ All Telegram-dependent features are operational

**Testing**: Verified with `node test-telegram-simple.js` - all tests pass successfully.

---

## Overview


@TACAMOBOT
You can use this token to access HTTP API:
6730537017:AAGnK4toKXph8kodfSE80ms

The Telegram Connector supports:
- Text messaging
- Media sharing (photos, documents)
- Location sharing
- Inline keyboards and reply keyboards
- Webhook and polling modes
- Message history and chat tracking
- Command handling

## Configuration

### Basic Configuration

```json
{
  "id": "telegram-bot",
  "type": "telegram",
  "name": "Telegram Bot",
  "description": "Telegram bot for notifications",
  "config": {
    "token": "YOUR_BOT_TOKEN_HERE",
    "mode": "polling"
  }
}
```

### Advanced Configuration

```json
{
  "id": "telegram-webhook",
  "type": "telegram",
  "name": "Telegram Webhook Bot",
  "description": "Telegram bot using webhook mode",
  "config": {
    "token": "YOUR_BOT_TOKEN_HERE",
    "mode": "webhook",
    "webhookUrl": "https://your-domain.com/webhook",
    "webhookPort": 8443,
    "pollingInterval": 1000,
    "pollingTimeout": 10,
    "maxReconnectAttempts": 5
  },
  "capabilities": {
    "enabled": ["telegram:send", "telegram:receive", "telegram:keyboard"],
    "disabled": ["telegram:webhook"]
  }
}
```

### Configuration Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `token` | string | Yes | - | Telegram Bot API token |
| `mode` | string | No | `polling` | Connection mode: `polling` or `webhook` |
| `webhookUrl` | string | No | - | Webhook URL (required for webhook mode) |
| `webhookPort` | number | No | `8443` | Webhook port |
| `pollingInterval` | number | No | `1000` | Polling interval in milliseconds |
| `pollingTimeout` | number | No | `10` | Polling timeout in seconds |
| `maxReconnectAttempts` | number | No | `5` | Maximum reconnection attempts |

## Capabilities

### telegram:send

Send various types of messages to Telegram chats.

#### Operations

- **text**: Send text messages
- **photo**: Send photos
- **document**: Send documents
- **location**: Send location data

#### Example Usage

```javascript
// Send text message
await connector.execute('telegram:send', 'text', {
  chatId: '123456789',
  text: 'Hello from Babelfish!',
  parseMode: 'Markdown'
});

// Send photo
await connector.execute('telegram:send', 'photo', {
  chatId: '123456789',
  photo: 'https://example.com/image.jpg',
  caption: 'Camera snapshot'
});

// Send location
await connector.execute('telegram:send', 'location', {
  chatId: '123456789',
  latitude: 37.7749,
  longitude: -122.4194
});
```

### telegram:receive

Receive and retrieve messages from Telegram.

#### Operations

- **messages**: Get messages from history
- **updates**: Get updates from Telegram API

#### Example Usage

```javascript
// Get recent messages
const messages = await connector.execute('telegram:receive', 'messages', {
  chatId: '123456789',
  limit: 10
});

// Get updates
const updates = await connector.execute('telegram:receive', 'updates', {
  limit: 100
});
```

### telegram:chat

Manage chat information and members.

#### Operations

- **info**: Get chat information
- **members**: Get chat administrators
- **leave**: Leave a chat

#### Example Usage

```javascript
// Get chat info
const chatInfo = await connector.execute('telegram:chat', 'info', {
  chatId: '123456789'
});

// Get chat members
const members = await connector.execute('telegram:chat', 'members', {
  chatId: '123456789'
});
```

### telegram:media

Handle media file operations.

#### Operations

- **download**: Download files from Telegram
- **upload**: Upload files to Telegram

#### Example Usage

```javascript
// Download file
await connector.execute('telegram:media', 'download', {
  fileId: 'file_id_here',
  destination: './downloads/file.jpg'
});
```

### telegram:keyboard

Send interactive keyboards to users.

#### Operations

- **inline**: Send inline keyboard
- **reply**: Send reply keyboard
- **remove**: Remove keyboard

#### Example Usage

```javascript
// Send inline keyboard
await connector.execute('telegram:keyboard', 'inline', {
  chatId: '123456789',
  text: 'Choose an option:',
  keyboard: [
    [
      { text: 'Option 1', callback_data: 'option1' },
      { text: 'Option 2', callback_data: 'option2' }
    ]
  ]
});

// Send reply keyboard
await connector.execute('telegram:keyboard', 'reply', {
  chatId: '123456789',
  text: 'Select a camera:',
  keyboard: [
    ['Camera 1', 'Camera 2'],
    ['Camera 3', 'Camera 4']
  ],
  resizeKeyboard: true
});
```

### telegram:webhook

Manage webhook configuration.

#### Operations

- **set**: Set webhook URL
- **delete**: Delete webhook
- **info**: Get webhook information

#### Example Usage

```javascript
// Set webhook
await connector.execute('telegram:webhook', 'set', {
  url: 'https://your-domain.com/webhook'
});

// Get webhook info
const webhookInfo = await connector.execute('telegram:webhook', 'info');
```

## Event Handling

The Telegram Connector emits various events that can be listened to:

### Message Events

```javascript
connector.on('message', (data) => {
  console.log('Received message:', data.message);
  console.log('From chat:', data.message.chat.id);
  console.log('Text:', data.message.text);
});

connector.on('edited-message', (data) => {
  console.log('Message edited:', data.message);
});

connector.on('callback-query', (data) => {
  console.log('Button pressed:', data.query.data);
});
```

### Connection Events

```javascript
connector.on('connected', (data) => {
  console.log('Telegram bot connected');
});

connector.on('disconnected', (data) => {
  console.log('Telegram bot disconnected');
});

connector.on('error', (error) => {
  console.error('Telegram error:', error);
});
```

## Message Handlers

You can add custom message and command handlers:

```javascript
// Add message handler
const handlerId = connector.addMessageHandler((msg) => {
  console.log('Custom handler received:', msg.text);
});

// Add command handler
connector.addCommandHandler('start', (msg) => {
  connector.execute('telegram:send', 'text', {
    chatId: msg.chat.id,
    text: 'Welcome to Babelfish!'
  });
});

// Remove handlers
connector.removeMessageHandler(handlerId);
connector.removeCommandHandler('start');
```

## Integration Examples

### UniFi Protect Integration

```javascript
// Send camera snapshot to Telegram
const unifiConnector = registry.getConnector('unifi-protect');
const telegramConnector = registry.getConnector('telegram-bot');

// Listen for motion events
unifiConnector.on('motion-detected', async (data) => {
  const snapshot = await unifiConnector.execute('unifi:snapshot', 'capture', {
    cameraId: data.cameraId
  });
  
  await telegramConnector.execute('telegram:send', 'photo', {
    chatId: 'ADMIN_CHAT_ID',
    photo: snapshot.url,
    caption: `Motion detected on camera ${data.cameraId}`
  });
});
```

### MQTT Integration

```javascript
// Send MQTT messages to Telegram
const mqttConnector = registry.getConnector('mqtt-broker');
const telegramConnector = registry.getConnector('telegram-bot');

mqttConnector.on('message', async (data) => {
  if (data.topic === 'sensors/temperature') {
    await telegramConnector.execute('telegram:send', 'text', {
      chatId: 'ALERTS_CHAT_ID',
      text: `Temperature alert: ${data.message}°C`
    });
  }
});
```

### Prestwick Airport Integration
```javascript
// Send NOTAM alerts via Telegram
await telegramConnector.execute('telegram:send', 'text', {
  chatId: prestwickConfig.telegramChatId,
  text: `🚨 NOTAM Alert: ${notam.description}`,
  parseMode: 'HTML'
});
```

### Alarm Manager Integration
```javascript
// Send alarm notifications
await telegramConnector.execute('telegram:send', 'text', {
  chatId: alarmConfig.defaultChatId,
  text: `🚨 ${alarm.severity.toUpperCase()} ALARM: ${alarm.description}`,
  parseMode: 'HTML'
});
```

### ADSB Emergency Squawk Integration
```javascript
// Send emergency squawk alerts
await telegramConnector.execute('telegram:send', 'text', {
  chatId: adsbConfig.telegramChatId,
  text: `🚨 EMERGENCY SQUAWK: ${aircraft.callsign} (${squawk})`,
  parseMode: 'HTML'
});
```

## Testing

### Quick Test
```bash
# Test Telegram connector functionality
node test-telegram-simple.js
```

### Integration Test
```bash
# Test Telegram with other connectors
node test-prestwick-telegram.js
node test-prestwick-full-notifications.js
```

## Troubleshooting

### Common Issues

#### 409 Conflict Error
**Problem**: `TelegramError: ETELEGRAM: 409 Conflict: terminated by other getUpdates request`

**Solution**: 
1. Ensure only one instance of the Telegram bot is running
2. Verify the connector is properly registered in `server.js`
3. Check that no other processes are using the same bot token

#### Connection Issues
**Problem**: Bot fails to connect or authenticate

**Solution**:
1. Verify the bot token is correct
2. Check network connectivity to Telegram API
3. Ensure the bot hasn't been blocked or deleted

#### Message Not Sending
**Problem**: Messages are not being delivered

**Solution**:
1. Verify the chat ID is correct
2. Check that the bot has permission to send messages
3. Ensure the user has started a conversation with the bot

### Debug Commands
```javascript
// Test bot connection
await telegramConnector.execute('telegram:chat', 'info', {
  chatId: 'test'
});

// Get bot information
const botInfo = await telegramConnector.getBotInfo();

// Check connection status
const status = await telegramConnector.getConnectionStatus();
```

## Best Practices

### Security
- **Token Protection**: Never expose bot tokens in code or logs
- **Chat ID Validation**: Validate chat IDs before sending messages
- **Rate Limiting**: Respect Telegram's rate limits
- **Error Handling**: Implement proper error handling for failed messages

### Performance
- **Connection Pooling**: Reuse connections when possible
- **Message Batching**: Batch multiple messages when appropriate
- **Polling Optimization**: Use appropriate polling intervals
- **Webhook Mode**: Use webhook mode for production deployments

### Integration
- **Capability Discovery**: Use `getCapabilityDefinitions()` to discover available operations
- **Error Recovery**: Implement retry logic for failed operations
- **Status Monitoring**: Monitor connector health and connection status
- **Logging**: Log all message activities for audit purposes

## Future Enhancements

### Planned Features
1. **Message Templates**: Predefined message templates for common notifications
2. **Rich Media Support**: Enhanced media sharing capabilities
3. **Bot Commands**: Interactive bot command handling
4. **Channel Management**: Multi-channel message broadcasting
5. **Message Scheduling**: Scheduled message delivery

### Scalability Improvements
1. **Multi-Bot Support**: Support for multiple bot instances
2. **Load Balancing**: Distribute messages across multiple bots
3. **Message Queuing**: Asynchronous message processing
4. **High Availability**: Redundant bot configurations

---

The Telegram Connector provides reliable messaging capabilities for the Babelfish Looking Glass platform, enabling real-time notifications and communication with users through the popular Telegram messaging platform. 