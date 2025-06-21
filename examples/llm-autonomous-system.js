/**
 * Autonomous System Example
 * 
 * Demonstrates how the LLM connector can be used to create
 * autonomous systems that can understand and interact with
 * the Looking Glass platform.
 */

const LLMConnector = require('../connectors/types/LLMConnector');

class AutonomousSystem {
  constructor(config) {
    this.llm = new LLMConnector(config);
    this.registeredFunctions = new Map();
  }

  async initialize() {
    console.log('🤖 Initializing Autonomous System...');
    
    // Connect to LLM
    await this.llm.connect();
    
    // Register system functions
    await this.registerSystemFunctions();
    
    // Generate system capability prompt
    this.systemPrompt = await this.llm.executeCapability('llm:capability_discovery', 'generate_prompt');
    
    console.log('✅ Autonomous System initialized');
  }

  async registerSystemFunctions() {
    console.log('🔧 Registering system functions...');

    // Security monitoring functions
    await this.registerFunction('analyze_camera_feed', {
      description: 'Analyze security camera feed for suspicious activity',
      parameters: {
        camera_id: { type: 'string', required: true },
        duration: { type: 'number', required: false, default: 30 }
      },
      handler: async (args) => {
        console.log(`🔍 Analyzing camera ${args.camera_id} for ${args.duration || 30} seconds...`);
        // Simulate analysis
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          camera_id: args.camera_id,
          suspicious_activity: Math.random() > 0.8,
          confidence: 0.85 + Math.random() * 0.1,
          timestamp: new Date().toISOString()
        };
      }
    });

    await this.registerFunction('send_security_alert', {
      description: 'Send security alert to appropriate personnel',
      parameters: {
        level: { type: 'string', required: true, enum: ['low', 'medium', 'high', 'critical'] },
        message: { type: 'string', required: true },
        location: { type: 'string', required: false }
      },
      handler: async (args) => {
        console.log(`🚨 SECURITY ALERT [${args.level.toUpperCase()}]: ${args.message}`);
        if (args.location) {
          console.log(`📍 Location: ${args.location}`);
        }
        return {
          alert_sent: true,
          level: args.level,
          timestamp: new Date().toISOString()
        };
      }
    });

    // Smart home functions
    await this.registerFunction('control_lighting', {
      description: 'Control smart lighting system',
      parameters: {
        room: { type: 'string', required: true },
        action: { type: 'string', required: true, enum: ['on', 'off', 'dim', 'brighten'] },
        brightness: { type: 'number', required: false, minimum: 0, maximum: 100 }
      },
      handler: async (args) => {
        console.log(`💡 ${args.room} lights: ${args.action}${args.brightness ? ` (${args.brightness}%)` : ''}`);
        return {
          room: args.room,
          action: args.action,
          brightness: args.brightness,
          status: 'success',
          timestamp: new Date().toISOString()
        };
      }
    });

    await this.registerFunction('adjust_thermostat', {
      description: 'Adjust smart thermostat',
      parameters: {
        temperature: { type: 'number', required: true, minimum: 10, maximum: 35 },
        mode: { type: 'string', required: false, enum: ['heat', 'cool', 'auto'] }
      },
      handler: async (args) => {
        console.log(`🌡️  Thermostat: ${args.temperature}°C${args.mode ? ` (${args.mode} mode)` : ''}`);
        return {
          temperature: args.temperature,
          mode: args.mode || 'auto',
          status: 'success',
          timestamp: new Date().toISOString()
        };
      }
    });

    // System monitoring functions
    await this.registerFunction('get_system_health', {
      description: 'Get overall system health and status',
      parameters: {
        components: { type: 'array', required: false, items: { type: 'string' } }
      },
      handler: async (args) => {
        console.log('📊 Checking system health...');
        return {
          status: 'healthy',
          uptime: Math.floor(Math.random() * 86400),
          active_connectors: Math.floor(Math.random() * 10) + 5,
          active_entities: Math.floor(Math.random() * 100) + 50,
          timestamp: new Date().toISOString()
        };
      }
    });

    await this.registerFunction('check_weather', {
      description: 'Get current weather information',
      parameters: {
        location: { type: 'string', required: true },
        unit: { type: 'string', required: false, enum: ['celsius', 'fahrenheit'] }
      },
      handler: async (args) => {
        console.log(`🌤️  Checking weather for ${args.location}...`);
        return {
          location: args.location,
          temperature: Math.floor(Math.random() * 30) + 10,
          unit: args.unit || 'celsius',
          condition: ['sunny', 'cloudy', 'rainy', 'snowy'][Math.floor(Math.random() * 4)],
          humidity: Math.floor(Math.random() * 100),
          timestamp: new Date().toISOString()
        };
      }
    });

    console.log('✅ System functions registered');
  }

  async registerFunction(name, definition) {
    await this.llm.executeCapability('llm:function_call', 'register', {
      name,
      description: definition.description,
      parameters: definition.parameters,
      handler: definition.handler,
      examples: definition.examples || []
    });
    
    this.registeredFunctions.set(name, definition);
  }

  async processCommand(command, context = {}) {
    console.log(`\n🤖 Processing command: "${command}"`);
    
    try {
      const response = await this.llm.executeCapability('llm:chat', 'send', {
        message: command,
        conversationId: context.conversationId || 'autonomous-system',
        systemPrompt: this.systemPrompt + "\n\nYou are an autonomous system that can control and monitor various aspects of the smart home and security system. You can analyze camera feeds, control devices, send alerts, and monitor system health. Always be proactive and take appropriate actions based on the situation.",
        functions: Array.from(this.llm.functionDefinitions.values())
      });

      console.log(`🤖 Response: ${response.message}`);
      return response;

    } catch (error) {
      console.error('❌ Error processing command:', error.message);
      throw error;
    }
  }

  async runAutonomousScenario(scenario) {
    console.log(`\n🚀 Running autonomous scenario: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);
    
    try {
      const response = await this.processCommand(scenario.command, {
        conversationId: scenario.name
      });
      
      console.log(`✅ Scenario completed successfully`);
      return response;
      
    } catch (error) {
      console.error(`❌ Scenario failed:`, error.message);
      throw error;
    }
  }

  async shutdown() {
    console.log('\n🛑 Shutting down autonomous system...');
    await this.llm.disconnect();
    console.log('✅ Autonomous system shutdown complete');
  }
}

// Example scenarios
const scenarios = [
  {
    name: 'security-monitoring',
    description: 'Monitor security cameras and respond to threats',
    command: "You are a security monitoring system. Monitor camera 'front-door' for 30 seconds. If you detect any suspicious activity, immediately send a high priority alert to the security team. Also check the weather - if it's raining, turn on the porch lights."
  },
  {
    name: 'smart-home-automation',
    description: 'Automate home environment based on conditions',
    command: "It's getting late (8 PM). Check the weather and adjust the home environment accordingly. If it's cold, turn up the heat. If it's dark, turn on appropriate lights. Make sure the system is running smoothly."
  },
  {
    name: 'system-maintenance',
    description: 'Perform system health checks and maintenance',
    command: "Perform a comprehensive system health check. Monitor all active connectors and entities. If any issues are detected, send appropriate alerts. Also check if any maintenance tasks need to be performed."
  }
];

// Main execution
async function main() {
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  OPENAI_API_KEY environment variable not set');
    console.log('Please set your OpenAI API key to run the example:');
    console.log('export OPENAI_API_KEY="your-api-key-here"');
    process.exit(1);
  }

  const config = {
    id: 'autonomous-system',
    name: 'Autonomous System',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.7,
    capabilityExposure: { enabled: true, autoDiscover: true },
    functionCalling: { enabled: true, autoRegister: true }
  };

  const autonomousSystem = new AutonomousSystem(config);

  try {
    // Initialize the system
    await autonomousSystem.initialize();

    // Run example scenarios
    for (const scenario of scenarios) {
      await autonomousSystem.runAutonomousScenario(scenario);
      console.log('\n' + '='.repeat(60) + '\n');
      
      // Wait between scenarios
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Interactive mode
    console.log('🎮 Entering interactive mode. Type commands or "exit" to quit.');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.on('line', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        await autonomousSystem.shutdown();
        process.exit(0);
      }

      try {
        await autonomousSystem.processCommand(input, {
          conversationId: 'interactive'
        });
      } catch (error) {
        console.error('❌ Command failed:', error.message);
      }
    });

  } catch (error) {
    console.error('💥 Autonomous system failed:', error);
    await autonomousSystem.shutdown();
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Main execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  AutonomousSystem,
  scenarios
}; 