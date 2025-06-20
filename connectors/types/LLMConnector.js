const BaseConnector = require('../BaseConnector');
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * LLM Connector
 * 
 * Provides integration with various LLM providers (OpenAI, Grok, local models)
 * and exposes application capabilities for autonomous system interaction.
 * Supports function calling, capability discovery, and two-way communication.
 */
class LLMConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // LLM provider configuration
    this.provider = config.provider || 'openai';
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4';
    this.baseUrl = config.baseUrl;
    this.maxTokens = config.maxTokens || 4000;
    this.temperature = config.temperature || 0.7;
    
    // Local model configuration
    this.localModel = {
      enabled: config.localModel?.enabled || false,
      path: config.localModel?.path,
      command: config.localModel?.command,
      args: config.localModel?.args || [],
      port: config.localModel?.port || 8000
    };
    
    // Application capability exposure
    this.capabilityExposure = {
      enabled: config.capabilityExposure?.enabled || true,
      autoDiscover: config.capabilityExposure?.autoDiscover || true,
      includeExamples: config.capabilityExposure?.includeExamples || true,
      maxCapabilities: config.capabilityExposure?.maxCapabilities || 50
    };
    
    // Function calling configuration
    this.functionCalling = {
      enabled: config.functionCalling?.enabled || true,
      autoRegister: config.functionCalling?.autoRegister || true,
      validation: config.functionCalling?.validation || true
    };
    
    // Conversation management
    this.conversations = new Map();
    this.conversationHistory = new Map();
    this.maxHistoryLength = config.maxHistoryLength || 100;
    
    // Capability registry
    this.registeredCapabilities = new Map();
    this.functionDefinitions = new Map();
    
    // Local model process
    this.localModelProcess = null;
    
    // Rate limiting
    this.rateLimiter = {
      requests: 0,
      windowStart: Date.now(),
      maxRequests: config.rateLimit?.requests || 100,
      windowMs: config.rateLimit?.window || 60000
    };
  }
  
  /**
   * Perform connection
   */
  async performConnect() {
    try {
      this.logger.info(`Connecting to LLM provider: ${this.provider}`);
      
      if (this.localModel.enabled) {
        await this.startLocalModel();
      }
      
      // Test connection
      await this.testConnection();
      
      // Discover and register application capabilities
      if (this.capabilityExposure.autoDiscover) {
        await this.discoverCapabilities();
      }
      
      // Register function definitions
      if (this.functionCalling.autoRegister) {
        await this.registerFunctionDefinitions();
      }
      
      this.logger.info('LLM connector connected successfully');
      
    } catch (error) {
      this.logger.error('Failed to connect to LLM:', error);
      throw error;
    }
  }
  
  /**
   * Perform disconnection
   */
  async performDisconnect() {
    // Stop local model if running
    if (this.localModelProcess) {
      this.localModelProcess.kill();
      this.localModelProcess = null;
    }
    
    // Clear conversations
    this.conversations.clear();
    this.conversationHistory.clear();
    
    this.logger.info('LLM connector disconnected');
  }
  
  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'llm:chat':
        return this.executeChat(operation, parameters);
      
      case 'llm:function_call':
        return this.executeFunctionCall(operation, parameters);
      
      case 'llm:capability_discovery':
        return this.executeCapabilityDiscovery(operation, parameters);
      
      case 'llm:conversation_management':
        return this.executeConversationManagement(operation, parameters);
      
      case 'llm:model_management':
        return this.executeModelManagement(operation, parameters);
      
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }
  
  /**
   * Execute chat operations
   */
  async executeChat(operation, parameters) {
    switch (operation) {
      case 'send':
        return this.sendMessage(parameters);
      
      case 'stream':
        return this.streamMessage(parameters);
      
      case 'conversation':
        return this.getConversation(parameters);
      
      case 'clear':
        return this.clearConversation(parameters);
      
      default:
        throw new Error(`Unknown chat operation: ${operation}`);
    }
  }
  
  /**
   * Send a message to the LLM
   */
  async sendMessage(parameters) {
    const { message, conversationId, systemPrompt, functions, temperature } = parameters;
    
    if (!message) {
      throw new Error('Message is required');
    }
    
    const conversationId_ = conversationId || 'default';
    
    // Get or create conversation
    let conversation = this.conversations.get(conversationId_);
    if (!conversation) {
      conversation = {
        id: conversationId_,
        messages: [],
        created: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };
      this.conversations.set(conversationId_, conversation);
    }
    
    // Add user message
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Prepare request payload
    const payload = {
      model: this.model,
      messages: this.formatMessages(conversation.messages, systemPrompt),
      max_tokens: this.maxTokens,
      temperature: temperature || this.temperature
    };
    
    // Add function definitions if provided
    if (functions && functions.length > 0) {
      payload.functions = functions;
      payload.function_call = 'auto';
    }
    
    // Make request to LLM
    const response = await this.makeLLMRequest(payload);
    
    // Add assistant response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: response.content,
      function_call: response.function_call,
      timestamp: new Date().toISOString()
    });
    
    conversation.lastActivity = new Date().toISOString();
    
    // Handle function calls if present
    if (response.function_call) {
      const functionResult = await this.executeFunctionCall('call', {
        function_call: response.function_call,
        conversationId: conversationId_
      });
      
      // Add function result to conversation
      conversation.messages.push({
        role: 'function',
        name: response.function_call.name,
        content: JSON.stringify(functionResult),
        timestamp: new Date().toISOString()
      });
      
      // Get final response from LLM
      const finalResponse = await this.sendMessage({
        message: `Function ${response.function_call.name} executed successfully. Result: ${JSON.stringify(functionResult)}`,
        conversationId: conversationId_,
        systemPrompt
      });
      
      return finalResponse;
    }
    
    // Emit chat event
    this.emit('chat:message', {
      conversationId: conversationId_,
      message: response.content,
      function_call: response.function_call,
      timestamp: new Date().toISOString()
    });
    
    return {
      conversationId: conversationId_,
      message: response.content,
      function_call: response.function_call,
      usage: response.usage,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Stream a message to the LLM
   */
  async streamMessage(parameters) {
    const { message, conversationId, systemPrompt, onChunk } = parameters;
    
    if (!message || !onChunk) {
      throw new Error('Message and onChunk callback are required');
    }
    
    const conversationId_ = conversationId || 'default';
    
    // Get conversation
    let conversation = this.conversations.get(conversationId_);
    if (!conversation) {
      conversation = {
        id: conversationId_,
        messages: [],
        created: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };
      this.conversations.set(conversationId_, conversation);
    }
    
    // Add user message
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Prepare streaming request
    const payload = {
      model: this.model,
      messages: this.formatMessages(conversation.messages, systemPrompt),
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      stream: true
    };
    
    // Make streaming request
    const stream = await this.makeLLMStreamRequest(payload);
    
    let fullContent = '';
    
    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
        const content = chunk.choices[0].delta.content;
        if (content) {
          fullContent += content;
          onChunk(content, chunk);
        }
      }
    }
    
    // Add assistant response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: fullContent,
      timestamp: new Date().toISOString()
    });
    
    conversation.lastActivity = new Date().toISOString();
    
    return {
      conversationId: conversationId_,
      message: fullContent,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Execute function call operations
   */
  async executeFunctionCall(operation, parameters) {
    switch (operation) {
      case 'call':
        return this.callFunction(parameters);
      
      case 'register':
        return this.registerFunction(parameters);
      
      case 'list':
        return this.listFunctions(parameters);
      
      case 'describe':
        return this.describeFunction(parameters);
      
      default:
        throw new Error(`Unknown function call operation: ${operation}`);
    }
  }
  
  /**
   * Call a registered function
   */
  async callFunction(parameters) {
    const { function_call, conversationId } = parameters;
    
    if (!function_call || !function_call.name) {
      throw new Error('Function call with name is required');
    }
    
    const functionName = function_call.name;
    const functionArgs = function_call.arguments ? JSON.parse(function_call.arguments) : {};
    
    // Get registered function
    const registeredFunction = this.registeredCapabilities.get(functionName);
    if (!registeredFunction) {
      throw new Error(`Function ${functionName} not registered`);
    }
    
    // Validate arguments
    if (this.functionCalling.validation) {
      this.validateFunctionArguments(registeredFunction, functionArgs);
    }
    
    // Execute function
    try {
      const result = await registeredFunction.handler(functionArgs, {
        conversationId,
        connector: this
      });
      
      this.logger.info(`Function ${functionName} executed successfully`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Function ${functionName} execution failed:`, error);
      throw error;
    }
  }
  
  /**
   * Register a function capability
   */
  async registerFunction(parameters) {
    const { name, description, parameters: functionParams, handler, examples } = parameters;
    
    if (!name || !description || !handler) {
      throw new Error('Function name, description, and handler are required');
    }
    
    const functionDefinition = {
      name,
      description,
      parameters: functionParams || {},
      handler,
      examples: examples || [],
      registered: new Date().toISOString()
    };
    
    this.registeredCapabilities.set(name, functionDefinition);
    
    // Create OpenAI function definition
    const openAIDefinition = {
      name,
      description,
      parameters: {
        type: 'object',
        properties: functionParams,
        required: Object.keys(functionParams).filter(key => functionParams[key].required)
      }
    };
    
    this.functionDefinitions.set(name, openAIDefinition);
    
    this.logger.info(`Function ${name} registered successfully`);
    
    return {
      name,
      registered: true,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Execute capability discovery operations
   */
  async executeCapabilityDiscovery(operation, parameters) {
    switch (operation) {
      case 'discover':
        return this.discoverCapabilities(parameters);
      
      case 'list':
        return this.listCapabilities(parameters);
      
      case 'describe':
        return this.describeCapability(parameters);
      
      case 'generate_prompt':
        return this.generateCapabilityPrompt(parameters);
      
      default:
        throw new Error(`Unknown capability discovery operation: ${operation}`);
    }
  }
  
  /**
   * Discover application capabilities
   */
  async discoverCapabilities(parameters = {}) {
    const { includeConnectors = true, includeEntities = true, includeRules = true } = parameters;
    
    const capabilities = [];
    
    // Discover connector capabilities
    if (includeConnectors && this.connectors) {
      for (const [connectorId, connector] of this.connectors) {
        const connectorCapabilities = connector.getCapabilities();
        capabilities.push({
          type: 'connector',
          id: connectorId,
          name: connector.name,
          capabilities: connectorCapabilities
        });
      }
    }
    
    // Discover entity capabilities
    if (includeEntities && this.entityManager) {
      const entities = this.entityManager.getEntities();
      capabilities.push({
        type: 'entities',
        count: entities.length,
        types: [...new Set(entities.map(e => e.type))]
      });
    }
    
    // Discover rule capabilities
    if (includeRules && this.ruleEngine) {
      const rules = this.ruleEngine.getRules();
      capabilities.push({
        type: 'rules',
        count: rules.length,
        categories: [...new Set(rules.map(r => r.metadata?.category).filter(Boolean))]
      });
    }
    
    this.logger.info(`Discovered ${capabilities.length} capability categories`);
    
    return capabilities;
  }
  
  /**
   * Generate capability prompt for LLM
   */
  async generateCapabilityPrompt(parameters = {}) {
    const capabilities = await this.discoverCapabilities(parameters);
    
    let prompt = `You are an AI assistant with access to the following system capabilities:\n\n`;
    
    for (const capability of capabilities) {
      if (capability.type === 'connector') {
        prompt += `## Connector: ${capability.name} (${capability.id})\n`;
        for (const cap of capability.capabilities) {
          prompt += `- ${cap.name}: ${cap.description}\n`;
          if (cap.operations) {
            prompt += `  Operations: ${cap.operations.join(', ')}\n`;
          }
        }
        prompt += '\n';
      }
    }
    
    // Add registered functions
    if (this.registeredCapabilities.size > 0) {
      prompt += `## Available Functions\n`;
      for (const [name, func] of this.registeredCapabilities) {
        prompt += `- ${name}: ${func.description}\n`;
        if (func.examples.length > 0) {
          prompt += `  Example: ${func.examples[0]}\n`;
        }
      }
      prompt += '\n';
    }
    
    prompt += `You can use these capabilities to help users. When a user asks you to perform an action, you can call the appropriate function or suggest the right capability to use.\n\n`;
    
    return prompt;
  }
  
  /**
   * Execute conversation management operations
   */
  async executeConversationManagement(operation, parameters) {
    switch (operation) {
      case 'list':
        return this.listConversations(parameters);
      
      case 'get':
        return this.getConversation(parameters);
      
      case 'clear':
        return this.clearConversation(parameters);
      
      case 'delete':
        return this.deleteConversation(parameters);
      
      default:
        throw new Error(`Unknown conversation management operation: ${operation}`);
    }
  }
  
  /**
   * Get conversation by ID
   */
  async getConversation(parameters) {
    const { conversationId = 'default' } = parameters;
    
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    return conversation;
  }
  
  /**
   * Clear conversation history
   */
  async clearConversation(parameters) {
    const { conversationId = 'default' } = parameters;
    
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.messages = [];
      conversation.lastActivity = new Date().toISOString();
    }
    
    return {
      conversationId,
      cleared: true,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Execute model management operations
   */
  async executeModelManagement(operation, parameters) {
    switch (operation) {
      case 'list':
        return this.listModels(parameters);
      
      case 'switch':
        return this.switchModel(parameters);
      
      case 'info':
        return this.getModelInfo(parameters);
      
      default:
        throw new Error(`Unknown model management operation: ${operation}`);
    }
  }
  
  /**
   * List available models
   */
  async listModels(parameters = {}) {
    const models = [];
    
    // Add current model
    models.push({
      id: this.model,
      provider: this.provider,
      current: true
    });
    
    // Add common models based on provider
    if (this.provider === 'openai') {
      models.push(
        { id: 'gpt-4', provider: 'openai' },
        { id: 'gpt-3.5-turbo', provider: 'openai' },
        { id: 'gpt-4-turbo', provider: 'openai' }
      );
    } else if (this.provider === 'anthropic') {
      models.push(
        { id: 'claude-3-opus', provider: 'anthropic' },
        { id: 'claude-3-sonnet', provider: 'anthropic' },
        { id: 'claude-3-haiku', provider: 'anthropic' }
      );
    }
    
    return models;
  }
  
  /**
   * Switch to a different model
   */
  async switchModel(parameters) {
    const { model } = parameters;
    
    if (!model) {
      throw new Error('Model ID is required');
    }
    
    const previousModel = this.model;
    this.model = model;
    
    this.logger.info(`Switched model from ${previousModel} to ${model}`);
    
    return {
      previousModel,
      currentModel: model,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Start local model process
   */
  async startLocalModel() {
    if (!this.localModel.path && !this.localModel.command) {
      throw new Error('Local model path or command is required');
    }
    
    this.logger.info('Starting local model...');
    
    const command = this.localModel.command || 'python';
    const args = this.localModel.args || [];
    
    if (this.localModel.path) {
      args.unshift(this.localModel.path);
    }
    
    this.localModelProcess = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });
    
    this.localModelProcess.stdout.on('data', (data) => {
      this.logger.debug('Local model stdout:', data.toString());
    });
    
    this.localModelProcess.stderr.on('data', (data) => {
      this.logger.debug('Local model stderr:', data.toString());
    });
    
    this.localModelProcess.on('close', (code) => {
      this.logger.info(`Local model process exited with code ${code}`);
    });
    
    // Wait for model to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  /**
   * Test connection to LLM provider
   */
  async testConnection() {
    try {
      const testMessage = 'Hello, this is a connection test. Please respond with "Connection successful."';
      
      const response = await this.sendMessage({
        message: testMessage,
        conversationId: 'test'
      });
      
      this.logger.info('LLM connection test successful');
      return true;
      
    } catch (error) {
      this.logger.error('LLM connection test failed:', error);
      throw error;
    }
  }
  
  /**
   * Make request to LLM provider
   */
  async makeLLMRequest(payload) {
    await this.checkRateLimit();
    
    let url;
    let headers;
    
    if (this.provider === 'openai') {
      url = `${this.baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
      headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };
    } else if (this.provider === 'anthropic') {
      url = `${this.baseUrl || 'https://api.anthropic.com'}/v1/messages`;
      headers = {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      };
      
      // Transform payload for Anthropic format
      payload = {
        model: this.model,
        max_tokens: this.maxTokens,
        messages: payload.messages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }))
      };
    } else if (this.localModel.enabled) {
      url = `http://localhost:${this.localModel.port}/v1/chat/completions`;
      headers = {
        'Content-Type': 'application/json'
      };
    } else {
      throw new Error(`Unsupported provider: ${this.provider}`);
    }
    
    const response = await axios.post(url, payload, { headers });
    
    if (this.provider === 'anthropic') {
      return {
        content: response.data.content[0].text,
        usage: response.data.usage
      };
    } else {
      return {
        content: response.data.choices[0].message.content,
        function_call: response.data.choices[0].message.function_call,
        usage: response.data.usage
      };
    }
  }
  
  /**
   * Make streaming request to LLM provider
   */
  async makeLLMStreamRequest(payload) {
    // Implementation for streaming requests
    // This would return an async iterator for streaming responses
    throw new Error('Streaming not implemented yet');
  }
  
  /**
   * Format messages for LLM
   */
  formatMessages(messages, systemPrompt) {
    const formatted = [];
    
    if (systemPrompt) {
      formatted.push({
        role: 'system',
        content: systemPrompt
      });
    }
    
    // Add conversation messages
    for (const message of messages) {
      formatted.push({
        role: message.role,
        content: message.content,
        ...(message.function_call && { function_call: message.function_call }),
        ...(message.name && { name: message.name })
      });
    }
    
    return formatted;
  }
  
  /**
   * Validate function arguments
   */
  validateFunctionArguments(functionDef, args) {
    const { parameters } = functionDef;
    
    for (const [paramName, paramDef] of Object.entries(parameters)) {
      if (paramDef.required && !(paramName in args)) {
        throw new Error(`Required parameter ${paramName} is missing`);
      }
      
      if (paramName in args) {
        const value = args[paramName];
        const expectedType = paramDef.type;
        
        if (expectedType === 'string' && typeof value !== 'string') {
          throw new Error(`Parameter ${paramName} must be a string`);
        } else if (expectedType === 'number' && typeof value !== 'number') {
          throw new Error(`Parameter ${paramName} must be a number`);
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          throw new Error(`Parameter ${paramName} must be a boolean`);
        } else if (expectedType === 'object' && typeof value !== 'object') {
          throw new Error(`Parameter ${paramName} must be an object`);
        }
      }
    }
  }
  
  /**
   * Check rate limiting
   */
  async checkRateLimit() {
    const now = Date.now();
    
    if (now - this.rateLimiter.windowStart > this.rateLimiter.windowMs) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.windowStart = now;
    }
    
    if (this.rateLimiter.requests >= this.rateLimiter.maxRequests) {
      const waitTime = this.rateLimiter.windowMs - (now - this.rateLimiter.windowStart);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      this.rateLimiter.requests = 0;
      this.rateLimiter.windowStart = Date.now();
    }
    
    this.rateLimiter.requests++;
  }
  
  /**
   * Get capability definitions
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'llm:chat',
        name: 'LLM Chat',
        description: 'Send messages to LLM and receive responses',
        category: 'llm',
        operations: ['send', 'stream', 'conversation', 'clear'],
        dataTypes: ['application/json'],
        events: ['chat:message', 'chat:function_call'],
        parameters: {
          message: { type: 'string', required: true },
          conversationId: { type: 'string', required: false },
          systemPrompt: { type: 'string', required: false },
          functions: { type: 'array', required: false },
          temperature: { type: 'number', required: false }
        },
        requiresConnection: true
      },
      {
        id: 'llm:function_call',
        name: 'Function Calling',
        description: 'Register and call functions with LLM',
        category: 'llm',
        operations: ['call', 'register', 'list', 'describe'],
        dataTypes: ['application/json'],
        events: ['function:registered', 'function:called'],
        parameters: {
          function_call: { type: 'object', required: false },
          name: { type: 'string', required: false },
          description: { type: 'string', required: false },
          parameters: { type: 'object', required: false },
          handler: { type: 'function', required: false }
        },
        requiresConnection: true
      },
      {
        id: 'llm:capability_discovery',
        name: 'Capability Discovery',
        description: 'Discover and describe application capabilities',
        category: 'llm',
        operations: ['discover', 'list', 'describe', 'generate_prompt'],
        dataTypes: ['application/json'],
        events: ['capability:discovered'],
        parameters: {
          includeConnectors: { type: 'boolean', required: false },
          includeEntities: { type: 'boolean', required: false },
          includeRules: { type: 'boolean', required: false }
        },
        requiresConnection: false
      },
      {
        id: 'llm:conversation_management',
        name: 'Conversation Management',
        description: 'Manage conversation history and sessions',
        category: 'llm',
        operations: ['list', 'get', 'clear', 'delete'],
        dataTypes: ['application/json'],
        events: ['conversation:created', 'conversation:cleared'],
        parameters: {
          conversationId: { type: 'string', required: false }
        },
        requiresConnection: false
      },
      {
        id: 'llm:model_management',
        name: 'Model Management',
        description: 'Manage LLM models and configurations',
        category: 'llm',
        operations: ['list', 'switch', 'info'],
        dataTypes: ['application/json'],
        events: ['model:switched'],
        parameters: {
          model: { type: 'string', required: false }
        },
        requiresConnection: false
      }
    ];
  }
  
  /**
   * Validate configuration
   */
  static validateConfig(config) {
    if (!config.provider) {
      throw new Error('LLM provider is required');
    }
    
    if (!config.apiKey && !config.localModel?.enabled) {
      throw new Error('API key is required for cloud providers');
    }
    
    if (config.localModel?.enabled && !config.localModel?.path && !config.localModel?.command) {
      throw new Error('Local model path or command is required when local model is enabled');
    }
    
    return true;
  }
  
  /**
   * Get metadata
   */
  static getMetadata() {
    return {
      name: 'LLM Connector',
      version: '1.0.0',
      description: 'Connector for LLM providers with capability exposure',
      author: 'Looking Glass Platform',
      capabilities: [
        'llm:chat',
        'llm:function_call',
        'llm:capability_discovery',
        'llm:conversation_management',
        'llm:model_management'
      ]
    };
  }
}

module.exports = LLMConnector; 