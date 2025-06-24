# Flow System - Temporarily Disabled

## Status
The Flow System has been temporarily disabled to reduce complexity and confusion with the Alarm Center system.

## Why Disabled?
- **Overlap**: Both Flow System and Alarm Center could handle the same use cases
- **Complexity**: Flows added unnecessary complexity for current needs
- **Active Usage**: Rules are actively used, flows were barely used
- **Maintenance**: Two systems doing similar things created maintenance burden
- **Simplicity**: Rules are simpler and more straightforward

## Current Recommendation
Use the **Alarm Center** (`/alarms`) for all automation needs. It provides:
- Simple rule-based automation
- Notification management
- Event processing
- Escalation
- Command processing

## Re-enabling Flows
If you need complex automation that rules can't handle:

1. **Uncomment in server.js:**
   ```javascript
   // const FlowOrchestrator = require('./services/flowOrchestrator');
   // const FlowBuilder = require('./services/flowBuilder');
   ```

2. **Uncomment variable declarations:**
   ```javascript
   // let flowOrchestrator;
   // let flowBuilder;
   ```

3. **Uncomment initialization:**
   ```javascript
   // flowOrchestrator = new FlowOrchestrator(config.flows || {}, logger);
   // flowBuilder = new FlowBuilder({...});
   ```

4. **Uncomment routes:**
   ```javascript
   // app.use('/api/flows', require('./routes/flows'));
   // app.use('/flows', require('./routes/flows-gui'));
   ```

5. **Restore flow files:**
   ```bash
   mv config/flows/backup/* config/flows/
   ```

## Backup Files
- `backup/loitering-telegram-flow.json` - Example flow for loitering detection

## Documentation
See `docs/flow-system.md` for complete flow system documentation. 