const LLMConnector = require('./connectors/types/LLMConnector');

/**
 * Test LLM Connector functionality
 * Demonstrates autonomous system integration with capability exposure
 */

async function testLLMConnector() {
  console.log('🤖 Testing LLM Connector...\n');

  // Configuration for testing
  const config = {
    id: 'llm-test',
    name: 'LLM Test Connector',
    provider: 'openai', // or 'anthropic', 'local'
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.7,
    
    // Enable capability exposure
    capabilityExposure: {
      enabled: true,
      autoDiscover: true,
      includeExamples: true
    },
    
    // Enable function calling
    functionCalling: {
      enabled: true,
      autoRegister: true,
      validation: true
    },
    
    // Rate limiting
    rateLimit: {
      requests: 10,
      window: 60000
    }
  };

  let llmConnector;

  try {
    // Create and connect LLM connector
    console.log('📡 Connecting to LLM provider...');
    llmConnector = new LLMConnector(config);
    await llmConnector.connect();
    console.log('✅ Connected successfully\n');

    // Test 1: Basic chat functionality
    console.log('💬 Test 1: Basic Chat');
    const chatResponse = await llmConnector.executeCapability('llm:chat', 'send', {
      message: "Hello! I'm testing the LLM connector. Can you tell me what you can do?",
      conversationId: 'test-1'
    });
    console.log('Response:', chatResponse.message);
    console.log('');

    // Test 2: Register application functions
    console.log('🔧 Test 2: Function Registration');
    
    // Register a weather function
    await llmConnector.executeCapability('llm:function_call', 'register', {
      name: 'get_weather',
      description: 'Get current weather information for a location',
      parameters: {
        location: {
          type: 'string',
          description: 'City name or coordinates',
          required: true
        },
        unit: {
          type: 'string',
          description: 'Temperature unit (celsius/fahrenheit)',
          required: false,
          enum: ['celsius', 'fahrenheit']
        }
      },
      handler: async (args, context) => {
        console.log(`🌤️  Weather function called for: ${args.location}`);
        // Simulate weather API call
        return {
          location: args.location,
          temperature: Math.floor(Math.random() * 30) + 10,
          unit: args.unit || 'celsius',
          condition: ['sunny', 'cloudy', 'rainy', 'snowy'][Math.floor(Math.random() * 4)],
          humidity: Math.floor(Math.random() * 100),
          timestamp: new Date().toISOString()
        };
      },
      examples: [
        "get_weather(location: 'London', unit: 'celsius')",
        "get_weather(location: 'New York')"
      ]
    });

    // Register a smart home function
    await llmConnector.executeCapability('llm:function_call', 'register', {
      name: 'control_device',
      description: 'Control smart home devices',
      parameters: {
        device: {
          type: 'string',
          description: 'Device name or ID',
          required: true
        },
        action: {
          type: 'string',
          description: 'Action to perform',
          required: true,
          enum: ['turn_on', 'turn_off', 'dim', 'brighten']
        },
        value: {
          type: 'number',
          description: 'Value for dimming/brightening (0-100)',
          required: false
        }
      },
      handler: async (args, context) => {
        console.log(`🏠 Device control: ${args.device} -> ${args.action}`);
        // Simulate device control
        return {
          device: args.device,
          action: args.action,
          value: args.value,
          status: 'success',
          timestamp: new Date().toISOString()
        };
      },
      examples: [
        "control_device(device: 'living_room_lights', action: 'turn_on')",
        "control_device(device: 'bedroom_lights', action: 'dim', value: 50)"
      ]
    });

    // Register a system status function
    await llmConnector.executeCapability('llm:function_call', 'register', {
      name: 'get_system_status',
      description: 'Get current system status and health',
      parameters: {
        components: {
          type: 'array',
          description: 'Specific components to check',
          required: false,
          items: {
            type: 'string',
            enum: ['connectors', 'entities', 'rules', 'flows']
          }
        }
      },
      handler: async (args, context) => {
        console.log('📊 System status requested');
        // Simulate system status check
        return {
          status: 'healthy',
          uptime: Math.floor(Math.random() * 86400),
          activeConnectors: Math.floor(Math.random() * 10) + 5,
          activeEntities: Math.floor(Math.random() * 100) + 50,
          activeRules: Math.floor(Math.random() * 20) + 10,
          timestamp: new Date().toISOString()
        };
      },
      examples: [
        "get_system_status()",
        "get_system_status(components: ['connectors', 'entities'])"
      ]
    });

    console.log('✅ Functions registered successfully\n');

    // Test 3: Capability discovery
    console.log('🔍 Test 3: Capability Discovery');
    const capabilities = await llmConnector.executeCapability('llm:capability_discovery', 'discover', {
      includeConnectors: true,
      includeEntities: true,
      includeRules: true
    });
    console.log('Discovered capabilities:', JSON.stringify(capabilities, null, 2));
    console.log('');

    // Test 4: Generate capability prompt
    console.log('📝 Test 4: Generate Capability Prompt');
    const prompt = await llmConnector.executeCapability('llm:capability_discovery', 'generate_prompt');
    console.log('Generated prompt length:', prompt.length, 'characters');
    console.log('Prompt preview:', prompt.substring(0, 200) + '...');
    console.log('');

    // Test 5: Autonomous system interaction
    console.log('🤖 Test 5: Autonomous System Interaction');
    const autonomousResponse = await llmConnector.executeCapability('llm:chat', 'send', {
      message: "Check the weather in London and if it's raining, turn on the living room lights. Also give me a system status report.",
      conversationId: 'autonomous-test',
      systemPrompt: prompt,
      functions: Array.from(llmConnector.functionDefinitions.values())
    });
    console.log('Autonomous response:', autonomousResponse.message);
    console.log('');

    // Test 6: Conversation management
    console.log('💬 Test 6: Conversation Management');
    
    // Get conversation
    const conversation = await llmConnector.executeCapability('llm:conversation_management', 'get', {
      conversationId: 'autonomous-test'
    });
    console.log('Conversation message count:', conversation.messages.length);
    
    // List conversations
    const conversations = await llmConnector.executeCapability('llm:conversation_management', 'list');
    console.log('Active conversations:', conversations.length);
    console.log('');

    // Test 7: Model management
    console.log('🔧 Test 7: Model Management');
    const models = await llmConnector.executeCapability('llm:model_management', 'list');
    console.log('Available models:', models.map(m => `${m.id} (${m.provider})`));
    console.log('');

    // Test 8: Function listing
    console.log('📋 Test 8: Function Listing');
    const functions = await llmConnector.executeCapability('llm:function_call', 'list');
    console.log('Registered functions:', functions.map(f => f.name));
    console.log('');

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    if (llmConnector) {
      console.log('\n🧹 Cleaning up...');
      await llmConnector.disconnect();
      console.log('✅ Disconnected');
    }
  }
}

// Example of autonomous system integration
async function demonstrateAutonomousSystem() {
  console.log('\n🚀 Demonstrating Autonomous System Integration...\n');

  const config = {
    id: 'llm-autonomous',
    name: 'Autonomous LLM System',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    capabilityExposure: { enabled: true, autoDiscover: true },
    functionCalling: { enabled: true, autoRegister: true }
  };

  const llm = new LLMConnector(config);
  
  try {
    await llm.connect();

    // Register autonomous functions
    await llm.executeCapability('llm:function_call', 'register', {
      name: 'analyze_security_camera',
      description: 'Analyze security camera feed for suspicious activity',
      parameters: {
        camera_id: { type: 'string', required: true },
        duration: { type: 'number', required: false }
      },
      handler: async (args) => {
        console.log(`🔍 Analyzing camera ${args.camera_id}...`);
        return { suspicious_activity: false, confidence: 0.95 };
      }
    });

    await llm.executeCapability('llm:function_call', 'register', {
      name: 'send_alert',
      description: 'Send alert to security personnel',
      parameters: {
        level: { type: 'string', required: true, enum: ['low', 'medium', 'high', 'critical'] },
        message: { type: 'string', required: true },
        recipients: { type: 'array', required: false }
      },
      handler: async (args) => {
        console.log(`🚨 Alert sent: ${args.level} - ${args.message}`);
        return { sent: true, timestamp: new Date().toISOString() };
      }
    });

    // Generate system prompt
    const systemPrompt = await llm.executeCapability('llm:capability_discovery', 'generate_prompt');

    // Autonomous security monitoring scenario
    const response = await llm.executeCapability('llm:chat', 'send', {
      message: "You are a security monitoring system. Monitor camera 1 for 30 seconds and if you detect any suspicious activity, send a high priority alert to the security team.",
      conversationId: 'security-monitoring',
      systemPrompt: systemPrompt + "\n\nYou are an autonomous security monitoring system. You can analyze camera feeds and send alerts when needed.",
      functions: Array.from(llm.functionDefinitions.values())
    });

    console.log('🤖 Autonomous Security Response:', response.message);

  } catch (error) {
    console.error('❌ Autonomous system test failed:', error.message);
  } finally {
    await llm.disconnect();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  OPENAI_API_KEY environment variable not set');
    console.log('Please set your OpenAI API key to run the tests:');
    console.log('export OPENAI_API_KEY="your-api-key-here"');
    process.exit(1);
  }

  testLLMConnector()
    .then(() => demonstrateAutonomousSystem())
    .then(() => {
      console.log('\n✨ All demonstrations completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testLLMConnector,
  demonstrateAutonomousSystem
}; 