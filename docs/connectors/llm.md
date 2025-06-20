# LLM Connector

The LLM Connector provides integration with various Large Language Model providers and enables autonomous system interaction by exposing application capabilities to LLMs.

## Overview

The LLM Connector is a powerful component that:

- **Multi-Provider Support**: Works with OpenAI, Anthropic Claude, local models, and other LLM providers
- **Function Calling**: Enables LLMs to call application functions autonomously
- **Capability Discovery**: Automatically discovers and exposes system capabilities to LLMs
- **Conversation Management**: Maintains conversation history and context
- **Local Model Support**: Runs local models like Ollama, llama.cpp, or custom models

## Key Features

### 🤖 Autonomous System Integration
- Exposes application capabilities to LLMs
- Enables function calling for autonomous operations
- Provides context-aware system descriptions

### 🔄 Multi-Provider Support
- **OpenAI**: GPT-4, GPT-3.5-turbo, GPT-4-turbo
- **Anthropic**: Claude-3 Opus, Sonnet, Haiku
- **Local Models**: Ollama, llama.cpp, custom models
- **Extensible**: Easy to add new providers

### 🛠️ Function Calling
- Register application functions with LLMs
- Automatic parameter validation
- Function result handling and conversation continuation

### 📊 Capability Discovery
- Auto-discovers connectors, entities, and rules
- Generates capability descriptions for LLMs
- Provides examples and usage patterns

## Configuration

### Basic Configuration

```javascript
{
  "id": "llm",
  "type": "LLMConnector",
  "config": {
    "provider": "openai",
    "apiKey": "your-openai-api-key",
    "model": "gpt-4",
    "maxTokens": 4000,
    "temperature": 0.7
  }
}
```

### Advanced Configuration

```javascript
{
  "id": "llm",
  "type": "LLMConnector",
  "config": {
    "provider": "openai",
    "apiKey": "your-openai-api-key",
    "model": "gpt-4",
    "baseUrl": "https://api.openai.com",
    "maxTokens": 4000,
    "temperature": 0.7,
    
    // Local model configuration
    "localModel": {
      "enabled": false,
      "path": "/path/to/model",
      "command": "python",
      "args": ["-m", "llama_cpp.server"],
      "port": 8000
    },
    
    // Capability exposure
    "capabilityExposure": {
      "enabled": true,
      "autoDiscover": true,
      "includeExamples": true,
      "maxCapabilities": 50
    },
    
    // Function calling
    "functionCalling": {
      "enabled": true,
      "autoRegister": true,
      "validation": true
    },
    
    // Rate limiting
    "rateLimit": {
      "requests": 100,
      "window": 60000
    },
    
    "maxHistoryLength": 100
  }
}
```

### Local Model Configuration

#### Ollama
```javascript
{
  "localModel": {
    "enabled": true,
    "command": "ollama",
    "args": ["serve"],
    "port": 11434
  }
}
```

#### llama.cpp
```javascript
{
  "localModel": {
    "enabled": true,
    "command": "python",
    "args": ["-m", "llama_cpp.server", "--model", "/path/to/model.gguf"],
    "port": 8000
  }
}
```

## Capabilities

### llm:chat
Send messages to LLM and receive responses.

**Operations:**
- `send`: Send a message and get response
- `stream`: Stream response chunks
- `conversation`: Get conversation history
- `clear`: Clear conversation history

**Parameters:**
- `message` (string, required): Message to send
- `conversationId` (string, optional): Conversation ID
- `systemPrompt` (string, optional): System prompt
- `functions` (array, optional): Function definitions
- `temperature` (number, optional): Response temperature

### llm:function_call
Register and call functions with LLM.

**Operations:**
- `call`: Execute a function call
- `register`: Register a new function
- `list`: List registered functions
- `describe`: Get function description

### llm:capability_discovery
Discover and describe application capabilities.

**Operations:**
- `discover`: Discover system capabilities
- `list`: List discovered capabilities
- `describe`: Describe specific capability
- `generate_prompt`: Generate capability prompt for LLM

### llm:conversation_management
Manage conversation history and sessions.

**Operations:**
- `list`: List conversations
- `get`: Get conversation by ID
- `clear`: Clear conversation
- `delete`: Delete conversation

### llm:model_management
Manage LLM models and configurations.

**Operations:**
- `list`: List available models
- `switch`: Switch to different model
- `info`: Get model information

## Usage Examples

### Basic Chat

```javascript
// Send a message
const response = await llmConnector.executeCapability('llm:chat', 'send', {
  message: "What can you help me with?",
  conversationId: "user-123"
});

console.log(response.message);
```

### Function Registration

```javascript
// Register a function
await llmConnector.executeCapability('llm:function_call', 'register', {
  name: "get_weather",
  description: "Get current weather for a location",
  parameters: {
    location: {
      type: "string",
      description: "City name",
      required: true
    },
    unit: {
      type: "string",
      description: "Temperature unit (celsius/fahrenheit)",
      required: false
    }
  },
  handler: async (args, context) => {
    // Implementation
    return { temperature: 22, condition: "sunny" };
  },
  examples: [
    "get_weather(location: 'London')"
  ]
});
```

### Capability Discovery

```javascript
// Discover system capabilities
const capabilities = await llmConnector.executeCapability('llm:capability_discovery', 'discover', {
  includeConnectors: true,
  includeEntities: true,
  includeRules: true
});

// Generate capability prompt
const prompt = await llmConnector.executeCapability('llm:capability_discovery', 'generate_prompt');
```

### Autonomous System Interaction

```javascript
// Send message with function calling enabled
const response = await llmConnector.executeCapability('llm:chat', 'send', {
  message: "Check the weather in London and turn on the lights if it's raining",
  conversationId: "autonomous-1",
  systemPrompt: await llmConnector.executeCapability('llm:capability_discovery', 'generate_prompt'),
  functions: Array.from(llmConnector.functionDefinitions.values())
});
```

## Events

The LLM Connector emits the following events:

- `chat:message`: New message received
- `chat:function_call`: Function call detected
- `function:registered`: Function registered
- `function:called`: Function executed
- `capability:discovered`: New capability discovered
- `conversation:created`: New conversation created
- `conversation:cleared`: Conversation cleared
- `model:switched`: Model switched

## Integration with Autonomous Systems

### 1. Capability Exposure
The connector automatically discovers and exposes:
- **Connectors**: Available system connectors and their operations
- **Entities**: System entities and their properties
- **Rules**: Business rules and their triggers
- **Functions**: Registered application functions

### 2. Function Calling
LLMs can autonomously:
- Call application functions
- Validate parameters
- Handle function results
- Continue conversations with results

### 3. Context Awareness
- Maintains conversation history
- Provides system context
- Enables multi-turn interactions

## Best Practices

### 1. Security
- Use environment variables for API keys
- Validate function parameters
- Implement rate limiting
- Monitor function calls

### 2. Performance
- Use appropriate model sizes
- Implement caching for repeated calls
- Monitor token usage
- Use streaming for long responses

### 3. Function Design
- Provide clear descriptions
- Include examples
- Validate parameters
- Handle errors gracefully

### 4. Conversation Management
- Use meaningful conversation IDs
- Clear old conversations
- Monitor conversation length
- Implement context windows

## Troubleshooting

### Common Issues

1. **API Key Issues**
   - Verify API key is correct
   - Check provider configuration
   - Ensure sufficient credits

2. **Local Model Issues**
   - Verify model path/command
   - Check port availability
   - Monitor model process

3. **Function Calling Issues**
   - Validate function definitions
   - Check parameter types
   - Monitor function execution

4. **Rate Limiting**
   - Adjust rate limit settings
   - Implement exponential backoff
   - Monitor request frequency

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
{
  "config": {
    "debug": true,
    "logLevel": "debug"
  }
}
```

## API Reference

### Constructor
```javascript
new LLMConnector(config)
```

### Methods
- `connect()`: Connect to LLM provider
- `disconnect()`: Disconnect from provider
- `executeCapability(capabilityId, operation, parameters)`: Execute capability
- `registerFunction(definition)`: Register function
- `discoverCapabilities()`: Discover system capabilities

### Static Methods
- `getCapabilityDefinitions()`: Get capability definitions
- `validateConfig(config)`: Validate configuration
- `getMetadata()`: Get connector metadata 