# Telegram Connector

The Telegram Connector provides integration with the Telegram Bot API, enabling the Babelfish system to send and receive messages through Telegram bots.

## Overview

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

## Setup Instructions

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Save the bot token

### 2. Configure the Connector

Add the connector configuration to your `config/connectors.json`:

```json
{
  "connectors": [
    {
      "id": "telegram-bot",
      "type": "telegram",
      "name": "Babelfish Bot",
      "description": "Telegram bot for system notifications",
      "config": {
        "token": "YOUR_BOT_TOKEN_HERE",
        "mode": "polling"
      }
    }
  ]
}
```

### 3. Test the Bot

1. Start your bot with `/start` in Telegram
2. Send a message to test connectivity
3. Check the logs for connection status

### 4. Webhook Setup (Optional)

For webhook mode, you'll need:

1. A publicly accessible HTTPS URL
2. SSL certificate
3. Configure the webhook URL in your connector

```json
{
  "config": {
    "token": "YOUR_BOT_TOKEN_HERE",
    "mode": "webhook",
    "webhookUrl": "https://your-domain.com/webhook"
  }
}
```

## Troubleshooting

### Common Issues

1. **Invalid token**: Ensure your bot token is correct
2. **Webhook errors**: Check SSL certificate and URL accessibility
3. **Polling timeouts**: Adjust `pollingTimeout` parameter
4. **Message delivery failures**: Check chat permissions and bot status

### Debug Mode

Enable debug mode for detailed logging:

```javascript
connector.setDebugMode(true);
```

### Connection Status

Check connector status:

```javascript
const status = connector.getStatus();
console.log('Status:', status);
```

## Security Considerations

1. **Token Security**: Never expose your bot token in client-side code
2. **Chat Access**: Only add the bot to trusted chats
3. **Message Validation**: Validate incoming messages before processing
4. **Rate Limiting**: Respect Telegram's rate limits

## API Reference

For detailed API information, see the [Telegram Bot API documentation](https://core.telegram.org/bots/api). 