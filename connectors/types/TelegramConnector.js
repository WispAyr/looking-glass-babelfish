const BaseConnector = require('../BaseConnector');
const TelegramBot = require('node-telegram-bot-api');

/**
 * Telegram Connector
 * 
 * Provides integration with Telegram Bot API for sending and receiving messages.
 * Supports text messages, media, inline keyboards, and webhook/polling modes.
 */
class TelegramConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // Telegram bot instance
    this.bot = null;
    
    // Connection mode (polling or webhook)
    this.mode = this.config.mode || 'polling';
    
    // Default chat ID and chat info
    this.defaultChatId = this.config.defaultChatId;
    this.chatInfo = this.config.chatInfo || {};
    
    // Message settings
    this.messageSettings = {
      parseMode: 'HTML',
      disableWebPagePreview: true,
      disableNotification: false,
      ...this.config.messageSettings
    };
    
    // Message history
    this.messageHistory = new Map();
    this.maxHistorySize = this.config.maxHistorySize || 1000;
    this.enableMessageHistory = this.config.enableMessageHistory !== false;
    
    // Chat tracking
    this.activeChats = new Map();
    
    // Message queue for offline sending
    this.messageQueue = [];
    this.maxQueueSize = 100;
    
    // Webhook settings
    this.webhookUrl = this.config.webhookUrl;
    this.webhookPort = this.config.webhookPort || 8443;
    
    // Polling settings
    this.pollingInterval = this.config.pollingInterval || 1000;
    this.pollingTimeout = this.config.pollingTimeout || 10;
    
    // Message handlers
    this.messageHandlers = new Map();
    this.commandHandlers = new Map();
    
    // Reconnection settings
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = this.config.maxReconnectAttempts || 5;
  }
  
  /**
   * Check if bot is already running
   */
  async checkBotStatus() {
    try {
      // For now, just assume the bot is available
      // The actual connection will be tested during connect
      return { 
        running: true, 
        bot: { 
          id: 'bot',
          username: 'babelfish_bot',
          first_name: 'Babelfish'
        } 
      };
    } catch (error) {
      return { 
        running: false, 
        error: error.message || 'Unknown error checking bot status' 
      };
    }
  }
  
  /**
   * Perform connection to Telegram Bot API
   */
  async performConnect() {
    const { token } = this.config;
    
    if (!token) {
      throw new Error('Bot token is required for Telegram connection');
    }
    
    try {
      // Check if bot is available
      const status = await this.checkBotStatus();
      if (!status.running) {
        throw new Error(`Bot is not available: ${status.error}`);
      }
      
      // Try polling mode first
      if (this.mode === 'polling' || this.mode === 'auto') {
        try {
          await this.connectPolling();
          this.reconnectAttempts = 0;
          console.log(`Connected to Telegram Bot API (polling mode)`);
          
          // Process queued messages
          await this.processQueuedMessages();
          return;
        } catch (error) {
          // Check if it's a 409 conflict (another bot instance running)
          if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 409) {
            console.log('Telegram bot conflict detected - falling back to send-only mode');
            await this.connectSendOnlyMode();
            return;
          }
          
          // For other errors, try webhook mode
          console.log(`Polling failed: ${error.message}, trying webhook mode`);
          try {
            await this.connectWebhook();
            this.reconnectAttempts = 0;
            console.log(`Connected to Telegram Bot API (webhook mode)`);
            
            // Process queued messages
            await this.processQueuedMessages();
            return;
          } catch (webhookError) {
            // If webhook also fails, fall back to send-only mode
            console.log(`Webhook failed: ${webhookError.message}, using send-only mode`);
            await this.connectSendOnlyMode();
            return;
          }
        }
      }
      
      // For webhook mode
      if (this.mode === 'webhook') {
        await this.connectWebhook();
        this.reconnectAttempts = 0;
        console.log(`Connected to Telegram Bot API (webhook mode)`);
        
        // Process queued messages
        await this.processQueuedMessages();
        return;
      }
      
      // Default to send-only mode
      await this.connectSendOnlyMode();
      
    } catch (error) {
      this.logger.error(`Failed to connect to Telegram: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Connect using webhook mode
   */
  async connectWebhook() {
    const options = {
      webHook: {
        port: this.webhookPort
      },
      // Add SSL configuration to handle self-signed certificates
      request: {
        // Disable SSL certificate verification to handle self-signed certificates
        rejectUnauthorized: false,
        // Alternative approach - ignore SSL errors
        strictSSL: false
      }
    };
    
    if (this.webhookUrl) {
      options.webHook.url = this.webhookUrl;
    }
    
    this.bot = new TelegramBot(this.config.token, options);
    
    // Set up webhook with better error handling
    try {
      if (this.webhookUrl) {
        await this.bot.setWebHook(this.webhookUrl);
      }
    } catch (error) {
      if (error.response && error.response.body && error.response.body.error_code === 409) {
        throw new Error(`ETELEGRAM: 409 Conflict: Another instance of this Telegram bot is already running. Please stop other instances or use a different bot token. Original error: ${error.response.body.description}`);
      }
      throw error;
    }
    
    this.setupEventHandlers();
  }
  
  /**
   * Connect using polling mode
   */
  async connectPolling() {
    const options = {
      polling: {
        interval: this.pollingInterval,
        timeout: this.pollingTimeout,
        autoStart: false
      },
      // Add SSL configuration to handle self-signed certificates
      request: {
        // Disable SSL certificate verification to handle self-signed certificates
        rejectUnauthorized: false,
        // Alternative approach - ignore SSL errors
        strictSSL: false
      }
    };
    
    this.bot = new TelegramBot(this.config.token, options);
    
    this.setupEventHandlers();
    
    // Start polling with better error handling
    try {
      await this.bot.startPolling();
    } catch (error) {
      if (error.response && error.response.body && error.response.body.error_code === 409) {
        throw new Error(`ETELEGRAM: 409 Conflict: Another instance of this Telegram bot is already running. Please stop other instances or use a different bot token. Original error: ${error.response.body.description}`);
      }
      throw error;
    }
  }
  
  /**
   * Connect using polling with retry logic (simple wrapper)
   */
  async connectPollingWithRetry() {
    // For now, just call the normal polling connect
    await this.connectPolling();
  }
  
  /**
   * Set up bot event handlers
   */
  setupEventHandlers() {
    // Message handler
    this.bot.on('message', (msg) => {
      this.handleMessage(msg);
    });
    
    // Edited message handler
    this.bot.on('edited_message', (msg) => {
      this.handleEditedMessage(msg);
    });
    
    // Callback query handler
    this.bot.on('callback_query', (query) => {
      this.handleCallbackQuery(query);
    });
    
    // Error handler
    this.bot.on('error', (error) => {
      console.error('Telegram bot error:', error);
      this.emit('error', error);
    });
    
    // Polling error handler
    this.bot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error);
      this.emit('error', error);
    });
  }
  
  /**
   * Perform disconnection from Telegram Bot API
   */
  async performDisconnect() {
    if (this.bot) {
      if (this.mode === 'polling') {
        await this.bot.stopPolling();
      } else if (this.mode === 'webhook') {
        await this.bot.deleteWebHook();
      }
      
      this.bot = null;
    }
  }
  
  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'telegram:send':
        return this.executeSend(operation, parameters);
      
      case 'telegram:receive':
        return this.executeReceive(operation, parameters);
      
      case 'telegram:chat':
        return this.executeChatManagement(operation, parameters);
      
      case 'telegram:media':
        return this.executeMediaOperations(operation, parameters);
      
      case 'telegram:keyboard':
        return this.executeKeyboardOperations(operation, parameters);
      
      case 'telegram:webhook':
        return this.executeWebhookOperations(operation, parameters);
      
      case 'telegram:default':
        return this.executeDefaultChatOperations(operation, parameters);
      
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }
  
  /**
   * Execute send operations
   */
  async executeSend(operation, parameters) {
    switch (operation) {
      case 'text':
        return this.sendTextMessage(parameters);
      
      case 'photo':
        return this.sendPhoto(parameters);
      
      case 'document':
        return this.sendDocument(parameters);
      
      case 'location':
        return this.sendLocation(parameters);
      
      default:
        throw new Error(`Unknown send operation: ${operation}`);
    }
  }
  
  /**
   * Execute receive operations
   */
  async executeReceive(operation, parameters) {
    switch (operation) {
      case 'messages':
        return this.getMessages(parameters);
      
      case 'updates':
        return this.getUpdates(parameters);
      
      default:
        throw new Error(`Unknown receive operation: ${operation}`);
    }
  }
  
  /**
   * Execute chat management operations
   */
  async executeChatManagement(operation, parameters) {
    switch (operation) {
      case 'info':
        return this.getChatInfo(parameters);
      
      case 'members':
        return this.getChatMembers(parameters);
      
      case 'leave':
        return this.leaveChat(parameters);
      
      default:
        throw new Error(`Unknown chat operation: ${operation}`);
    }
  }
  
  /**
   * Execute media operations
   */
  async executeMediaOperations(operation, parameters) {
    switch (operation) {
      case 'download':
        return this.downloadFile(parameters);
      
      case 'upload':
        return this.uploadFile(parameters);
      
      default:
        throw new Error(`Unknown media operation: ${operation}`);
    }
  }
  
  /**
   * Execute keyboard operations
   */
  async executeKeyboardOperations(operation, parameters) {
    switch (operation) {
      case 'inline':
        return this.sendInlineKeyboard(parameters);
      
      case 'reply':
        return this.sendReplyKeyboard(parameters);
      
      case 'remove':
        return this.removeKeyboard(parameters);
      
      default:
        throw new Error(`Unknown keyboard operation: ${operation}`);
    }
  }
  
  /**
   * Execute webhook operations
   */
  async executeWebhookOperations(operation, parameters) {
    switch (operation) {
      case 'set':
        return this.setWebhook(parameters);
      
      case 'delete':
        return this.deleteWebhook(parameters);
      
      case 'info':
        return this.getWebhookInfo(parameters);
      
      default:
        throw new Error(`Unknown webhook operation: ${operation}`);
    }
  }
  
  /**
   * Execute default chat operations
   */
  async executeDefaultChatOperations(operation, parameters) {
    switch (operation) {
      case 'info':
        return this.getDefaultChatInfo();
      
      case 'send':
        return this.sendToDefaultChat(parameters.text, parameters);
      
      case 'receive':
        return this.getMessageHistory(this.defaultChatId);
      
      default:
        throw new Error(`Unknown default chat operation: ${operation}`);
    }
  }
  
  /**
   * Send text message
   */
  async sendTextMessage(parameters) {
    const { chatId, text, parseMode, disableWebPagePreview, disableNotification, replyToMessageId } = parameters;
    
    // Use default chat ID if not provided
    const targetChatId = chatId || this.defaultChatId;
    
    if (!targetChatId || !text) {
      throw new Error('chatId (or defaultChatId) and text are required');
    }
    
    const options = {
      parse_mode: parseMode || this.messageSettings.parseMode,
      disable_web_page_preview: disableWebPagePreview !== undefined ? disableWebPagePreview : this.messageSettings.disableWebPagePreview,
      disable_notification: disableNotification !== undefined ? disableNotification : this.messageSettings.disableNotification,
      reply_to_message_id: replyToMessageId
    };
    
    try {
      const result = await this.bot.sendMessage(targetChatId, text, options);
      
      // Store message in history if enabled
      if (this.enableMessageHistory) {
        this.storeMessageInHistory(result);
      }
      
      // Emit event when message is sent successfully
      if (this.eventBus) {
        this.eventBus.publishEvent('telegram:message:sent', {
          source: this.id,
          data: {
            chatId: targetChatId,
            messageId: result.message_id,
            text: text,
            chat: result.chat,
            date: result.date,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error sending text message:', error);
      throw error;
    }
  }
  
  /**
   * Send photo
   */
  async sendPhoto(parameters) {
    const { chatId, photo, caption, parseMode, disableNotification, replyToMessageId } = parameters;
    
    if (!chatId || !photo) {
      throw new Error('chatId and photo are required');
    }
    
    const options = {
      caption,
      parse_mode: parseMode,
      disable_notification: disableNotification,
      reply_to_message_id: replyToMessageId
    };
    
    try {
      const result = await this.bot.sendPhoto(chatId, photo, options);
      this.storeMessageInHistory(result);
      
      // Emit event when photo is sent successfully
      if (this.eventBus) {
        this.eventBus.publishEvent('telegram:message:sent', {
          source: this.id,
          data: {
            chatId: chatId,
            messageId: result.message_id,
            type: 'photo',
            caption: caption,
            chat: result.chat,
            date: result.date,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error sending photo:', error);
      throw error;
    }
  }
  
  /**
   * Send document
   */
  async sendDocument(parameters) {
    const { chatId, document, caption, parseMode, disableNotification, replyToMessageId } = parameters;
    
    if (!chatId || !document) {
      throw new Error('chatId and document are required');
    }
    
    const options = {
      caption,
      parse_mode: parseMode,
      disable_notification: disableNotification,
      reply_to_message_id: replyToMessageId
    };
    
    try {
      const result = await this.bot.sendDocument(chatId, document, options);
      this.storeMessageInHistory(result);
      return result;
    } catch (error) {
      console.error('Error sending document:', error);
      throw error;
    }
  }
  
  /**
   * Send location
   */
  async sendLocation(parameters) {
    const { chatId, latitude, longitude, disableNotification, replyToMessageId } = parameters;
    
    if (!chatId || !latitude || !longitude) {
      throw new Error('chatId, latitude, and longitude are required');
    }
    
    const options = {
      disable_notification: disableNotification,
      reply_to_message_id: replyToMessageId
    };
    
    try {
      const result = await this.bot.sendLocation(chatId, latitude, longitude, options);
      this.storeMessageInHistory(result);
      return result;
    } catch (error) {
      console.error('Error sending location:', error);
      throw error;
    }
  }
  
  /**
   * Get messages from history
   */
  async getMessages(parameters) {
    const { chatId, limit = 50, offset = 0 } = parameters;
    
    if (chatId) {
      return Array.from(this.messageHistory.values())
        .filter(msg => msg.chat.id === chatId)
        .slice(offset, offset + limit);
    }
    
    return Array.from(this.messageHistory.values())
      .slice(offset, offset + limit);
  }
  
  /**
   * Get updates from Telegram
   */
  async getUpdates(parameters) {
    const { offset, limit, timeout } = parameters;
    
    try {
      return await this.bot.getUpdates({ offset, limit, timeout });
    } catch (error) {
      console.error('Error getting updates:', error);
      throw error;
    }
  }
  
  /**
   * Get chat information
   */
  async getChatInfo(parameters) {
    const { chatId } = parameters;
    
    if (!chatId) {
      throw new Error('chatId is required');
    }
    
    try {
      return await this.bot.getChat(chatId);
    } catch (error) {
      console.error('Error getting chat info:', error);
      throw error;
    }
  }
  
  /**
   * Get chat members
   */
  async getChatMembers(parameters) {
    const { chatId } = parameters;
    
    if (!chatId) {
      throw new Error('chatId is required');
    }
    
    try {
      return await this.bot.getChatAdministrators(chatId);
    } catch (error) {
      console.error('Error getting chat members:', error);
      throw error;
    }
  }
  
  /**
   * Leave chat
   */
  async leaveChat(parameters) {
    const { chatId } = parameters;
    
    if (!chatId) {
      throw new Error('chatId is required');
    }
    
    try {
      return await this.bot.leaveChat(chatId);
    } catch (error) {
      console.error('Error leaving chat:', error);
      throw error;
    }
  }
  
  /**
   * Download file
   */
  async downloadFile(parameters) {
    const { fileId, destination } = parameters;
    
    if (!fileId) {
      throw new Error('fileId is required');
    }
    
    try {
      return await this.bot.downloadFile(fileId, destination);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }
  
  /**
   * Send inline keyboard
   */
  async sendInlineKeyboard(parameters) {
    const { chatId, text, keyboard, parseMode, disableWebPagePreview, disableNotification, replyToMessageId } = parameters;
    
    if (!chatId || !text || !keyboard) {
      throw new Error('chatId, text, and keyboard are required');
    }
    
    const options = {
      reply_markup: {
        inline_keyboard: keyboard
      },
      parse_mode: parseMode,
      disable_web_page_preview: disableWebPagePreview,
      disable_notification: disableNotification,
      reply_to_message_id: replyToMessageId
    };
    
    try {
      const result = await this.bot.sendMessage(chatId, text, options);
      this.storeMessageInHistory(result);
      return result;
    } catch (error) {
      console.error('Error sending inline keyboard:', error);
      throw error;
    }
  }
  
  /**
   * Send reply keyboard
   */
  async sendReplyKeyboard(parameters) {
    const { chatId, text, keyboard, resizeKeyboard, oneTimeKeyboard, selective, parseMode, disableWebPagePreview, disableNotification, replyToMessageId } = parameters;
    
    if (!chatId || !text || !keyboard) {
      throw new Error('chatId, text, and keyboard are required');
    }
    
    const options = {
      reply_markup: {
        keyboard,
        resize_keyboard: resizeKeyboard,
        one_time_keyboard: oneTimeKeyboard,
        selective
      },
      parse_mode: parseMode,
      disable_web_page_preview: disableWebPagePreview,
      disable_notification: disableNotification,
      reply_to_message_id: replyToMessageId
    };
    
    try {
      const result = await this.bot.sendMessage(chatId, text, options);
      this.storeMessageInHistory(result);
      return result;
    } catch (error) {
      console.error('Error sending reply keyboard:', error);
      throw error;
    }
  }
  
  /**
   * Remove keyboard
   */
  async removeKeyboard(parameters) {
    const { chatId, text, selective, parseMode, disableWebPagePreview, disableNotification, replyToMessageId } = parameters;
    
    if (!chatId || !text) {
      throw new Error('chatId and text are required');
    }
    
    const options = {
      reply_markup: {
        remove_keyboard: true,
        selective
      },
      parse_mode: parseMode,
      disable_web_page_preview: disableWebPagePreview,
      disable_notification: disableNotification,
      reply_to_message_id: replyToMessageId
    };
    
    try {
      const result = await this.bot.sendMessage(chatId, text, options);
      this.storeMessageInHistory(result);
      return result;
    } catch (error) {
      console.error('Error removing keyboard:', error);
      throw error;
    }
  }
  
  /**
   * Set webhook
   */
  async setWebhook(parameters) {
    const { url, certificate, maxConnections, allowedUpdates } = parameters;
    
    if (!url) {
      throw new Error('url is required');
    }
    
    try {
      return await this.bot.setWebHook(url, {
        certificate,
        max_connections: maxConnections,
        allowed_updates: allowedUpdates
      });
    } catch (error) {
      console.error('Error setting webhook:', error);
      throw error;
    }
  }
  
  /**
   * Delete webhook
   */
  async deleteWebhook(parameters) {
    try {
      return await this.bot.deleteWebHook();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      throw error;
    }
  }
  
  /**
   * Get webhook info
   */
  async getWebhookInfo(parameters) {
    try {
      return await this.bot.getWebhookInfo();
    } catch (error) {
      console.error('Error getting webhook info:', error);
      throw error;
    }
  }
  
  /**
   * Handle incoming message
   */
  handleMessage(msg) {
    console.log('Received message:', msg);
    
    // Store message in history
    this.storeMessageInHistory(msg);
    
    // Track active chat
    this.activeChats.set(msg.chat.id, {
      chatId: msg.chat.id,
      chatType: msg.chat.type,
      title: msg.chat.title,
      username: msg.chat.username,
      lastActivity: new Date().toISOString()
    });
    
    // Emit message event
    this.emit('message', {
      connectorId: this.id,
      message: msg,
      timestamp: new Date().toISOString()
    });
    
    // Handle commands
    if (msg.text && msg.text.startsWith('/')) {
      this.handleCommand(msg);
    }
    
    // Call message handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(msg);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }
  
  /**
   * Handle edited message
   */
  handleEditedMessage(msg) {
    console.log('Received edited message:', msg);
    
    this.emit('edited-message', {
      connectorId: this.id,
      message: msg,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Handle callback query
   */
  handleCallbackQuery(query) {
    console.log('Received callback query:', query);
    
    this.emit('callback-query', {
      connectorId: this.id,
      query,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Handle command
   */
  handleCommand(msg) {
    const command = msg.text.split(' ')[0].substring(1);
    const handler = this.commandHandlers.get(command);
    
    if (handler) {
      try {
        handler(msg);
      } catch (error) {
        console.error(`Error in command handler for /${command}:`, error);
      }
    }
  }
  
  /**
   * Add message handler
   */
  addMessageHandler(handler) {
    const id = Date.now().toString();
    this.messageHandlers.set(id, handler);
    return id;
  }
  
  /**
   * Remove message handler
   */
  removeMessageHandler(handlerId) {
    this.messageHandlers.delete(handlerId);
  }
  
  /**
   * Add command handler
   */
  addCommandHandler(command, handler) {
    this.commandHandlers.set(command, handler);
  }
  
  /**
   * Remove command handler
   */
  removeCommandHandler(command) {
    this.commandHandlers.delete(command);
  }
  
  /**
   * Store message in history
   */
  storeMessageInHistory(message) {
    const messageId = message.message_id || message.chat.id + '_' + Date.now();
    
    this.messageHistory.set(messageId, {
      ...message,
      timestamp: new Date().toISOString()
    });
    
    // Limit history size
    if (this.messageHistory.size > this.maxHistorySize) {
      const firstKey = this.messageHistory.keys().next().value;
      this.messageHistory.delete(firstKey);
    }
  }
  
  /**
   * Queue message for later sending
   */
  queueMessage(chatId, message, options = {}) {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift(); // Remove oldest message
    }
    
    this.messageQueue.push({
      chatId,
      message,
      options,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Process queued messages
   */
  async processQueuedMessages() {
    if (!this.bot || this.messageQueue.length === 0) {
      return;
    }
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const queuedMessage of messages) {
      try {
        await this.bot.sendMessage(
          queuedMessage.chatId,
          queuedMessage.message,
          queuedMessage.options
        );
      } catch (error) {
        console.error('Error processing queued message:', error);
        // Re-queue failed messages
        this.queueMessage(
          queuedMessage.chatId,
          queuedMessage.message,
          queuedMessage.options
        );
      }
    }
  }
  
  /**
   * Get bot information
   */
  async getBotInfo() {
    try {
      return await this.bot.getMe();
    } catch (error) {
      console.error('Error getting bot info:', error);
      throw error;
    }
  }
  
  /**
   * Get active chats
   */
  getActiveChats() {
    return Array.from(this.activeChats.values());
  }
  
  /**
   * Get message history
   */
  getMessageHistory(chatId = null) {
    if (chatId) {
      return Array.from(this.messageHistory.values())
        .filter(msg => msg.chat.id === chatId);
    }
    return Array.from(this.messageHistory.values());
  }
  
  /**
   * Clear message history
   */
  clearMessageHistory(chatId = null) {
    if (chatId) {
      for (const [key, message] of this.messageHistory.entries()) {
        if (message.chat.id === chatId) {
          this.messageHistory.delete(key);
        }
      }
    } else {
      this.messageHistory.clear();
    }
  }
  
  /**
   * Get capability definitions
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'telegram:send',
        name: 'Send Messages',
        description: 'Send text messages, photos, documents, and locations',
        operations: ['text', 'photo', 'document', 'location'],
        requiresConnection: true
      },
      {
        id: 'telegram:receive',
        name: 'Receive Messages',
        description: 'Receive and process incoming messages and updates',
        operations: ['messages', 'updates'],
        requiresConnection: true
      },
      {
        id: 'telegram:chat',
        name: 'Chat Management',
        description: 'Manage chat information and members',
        operations: ['info', 'members', 'leave'],
        requiresConnection: true
      },
      {
        id: 'telegram:media',
        name: 'Media Operations',
        description: 'Download and upload files',
        operations: ['download', 'upload'],
        requiresConnection: true
      },
      {
        id: 'telegram:keyboard',
        name: 'Keyboard Operations',
        description: 'Send inline and reply keyboards',
        operations: ['inline', 'reply', 'remove'],
        requiresConnection: true
      },
      {
        id: 'telegram:webhook',
        name: 'Webhook Management',
        description: 'Manage webhook configuration',
        operations: ['set', 'delete', 'info'],
        requiresConnection: true
      },
      {
        id: 'telegram:default',
        name: 'Default Chat Operations',
        description: 'Perform operations on the default chat',
        operations: ['info', 'send', 'receive'],
        requiresConnection: true
      }
    ];
  }
  
  /**
   * Validate configuration
   */
  static validateConfig(config) {
    // The config parameter is the full connector config, so we need to access config.config.token
    const connectorConfig = config.config || config;
    
    if (!connectorConfig.token) {
      throw new Error('Bot token is required');
    }
    
    if (connectorConfig.mode && !['polling', 'webhook', 'auto'].includes(connectorConfig.mode)) {
      throw new Error('Mode must be either "polling", "webhook", or "auto"');
    }
    
    if (connectorConfig.mode === 'webhook' && !connectorConfig.webhookUrl) {
      throw new Error('Webhook URL is required for webhook mode');
    }
  }
  
  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      name: 'Telegram Connector',
      version: '1.0.0',
      description: 'Telegram Bot API integration for sending and receiving messages',
      author: 'Looking Glass Team',
      capabilities: [
        'text messaging',
        'media sharing',
        'inline keyboards',
        'webhook support',
        'polling support'
      ],
      configSchema: {
        token: { type: 'string', required: true, description: 'Telegram Bot API token' },
        mode: { type: 'string', enum: ['polling', 'webhook', 'auto'], default: 'polling', description: 'Connection mode' },
        webhookUrl: { type: 'string', description: 'Webhook URL (required for webhook mode)' },
        webhookPort: { type: 'number', default: 8443, description: 'Webhook port' },
        pollingInterval: { type: 'number', default: 1000, description: 'Polling interval in ms' },
        pollingTimeout: { type: 'number', default: 10, description: 'Polling timeout in seconds' },
        maxReconnectAttempts: { type: 'number', default: 5, description: 'Maximum reconnection attempts' }
      }
    };
  }
  
  /**
   * Send message to default chat
   */
  async sendToDefaultChat(text, options = {}) {
    return this.sendTextMessage({
      text,
      ...options
    });
  }

  /**
   * Get default chat information
   */
  getDefaultChatInfo() {
    return this.chatInfo;
  }

  /**
   * Get default chat ID
   */
  getDefaultChatId() {
    return this.defaultChatId;
  }

  /**
   * Connect using send-only mode (no polling, just send messages)
   */
  async connectSendOnlyMode() {
    const options = {
      polling: false, // Disable polling
      // Add SSL configuration to handle self-signed certificates
      request: {
        // Disable SSL certificate verification to handle self-signed certificates
        rejectUnauthorized: false,
        // Alternative approach - ignore SSL errors
        strictSSL: false
      }
    };
    
    this.bot = new TelegramBot(this.config.token, options);
    
    // Don't set up event handlers since we're not receiving messages
    console.log('Telegram bot initialized in send-only mode');
    
    // Process queued messages
    await this.processQueuedMessages();
  }
}

module.exports = TelegramConnector; 