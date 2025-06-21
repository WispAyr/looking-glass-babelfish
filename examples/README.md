# Examples

This directory contains example implementations and demonstrations of the Looking Glass platform features.

## Available Examples

### LLM Autonomous System
**File**: `llm-autonomous-system.js`

Demonstrates how to create an autonomous system using the LLM connector that can:
- Monitor security cameras and respond to threats
- Control smart home devices
- Perform system health checks
- Run interactive commands

**Features:**
- Function calling for autonomous operations
- Capability discovery and exposure
- Conversation management
- Interactive command processing

**Usage:**
```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Run the example
node examples/llm-autonomous-system.js
```

**Example Scenarios:**
1. **Security Monitoring**: Monitor cameras and send alerts
2. **Smart Home Automation**: Adjust environment based on conditions
3. **System Maintenance**: Perform health checks and maintenance

## Running Examples

### Prerequisites
- Node.js installed
- Required API keys set as environment variables
- Dependencies installed (`npm install`)

### Environment Variables
```bash
# OpenAI API Key (required for LLM examples)
export OPENAI_API_KEY="your-openai-api-key"

# UniFi Protect credentials (for security examples)
export UNIFI_USERNAME="your-username"
export UNIFI_PASSWORD="your-password"
export UNIFI_API_KEY="your-api-key"
```

### Common Commands
```bash
# Run LLM autonomous system example
node examples/llm-autonomous-system.js

# Run with debug logging
DEBUG=* node examples/llm-autonomous-system.js

# Run specific scenario
node -e "
const { AutonomousSystem } = require('./examples/llm-autonomous-system');
// Your code here
"
```

## Example Output

### Autonomous System Example
```
🤖 Initializing Autonomous System...
📡 Connecting to LLM provider...
✅ Connected successfully

🔧 Registering system functions...
✅ System functions registered

🚀 Running autonomous scenario: security-monitoring
📝 Description: Monitor security cameras and respond to threats

🤖 Processing command: "You are a security monitoring system..."
🔍 Analyzing camera front-door for 30 seconds...
🌤️  Checking weather for London...
💡 porch lights: on
🤖 Response: I've completed the security monitoring task...
✅ Scenario completed successfully
```

## Customizing Examples

### Adding New Functions
```javascript
await autonomousSystem.registerFunction('custom_function', {
  description: 'Description of what the function does',
  parameters: {
    param1: { type: 'string', required: true },
    param2: { type: 'number', required: false }
  },
  handler: async (args) => {
    // Implementation
    return { result: 'success' };
  }
});
```

### Creating New Scenarios
```javascript
const newScenario = {
  name: 'custom-scenario',
  description: 'Description of the scenario',
  command: "Your command for the autonomous system"
};

await autonomousSystem.runAutonomousScenario(newScenario);
```

## Troubleshooting

### Common Issues

1. **API Key Not Set**
   ```
   ⚠️  OPENAI_API_KEY environment variable not set
   ```
   Solution: Set the required environment variable

2. **Connection Failed**
   ```
   ❌ Failed to connect to LLM provider
   ```
   Solution: Check API key validity and network connection

3. **Function Registration Failed**
   ```
   ❌ Function registration failed
   ```
   Solution: Check function definition format and parameters

### Debug Mode
Enable debug logging to troubleshoot issues:
```bash
DEBUG=* node examples/llm-autonomous-system.js
```

## Contributing

When adding new examples:

1. Follow the existing code structure
2. Include comprehensive documentation
3. Add error handling and validation
4. Include example output
5. Update this README

## Related Documentation

- [LLM Connector Documentation](../docs/connectors/llm.md)
- [Connector Architecture](../docs/connector-architecture.md)
- [Flow System Documentation](../docs/flow-system.md) 