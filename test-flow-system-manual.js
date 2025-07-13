const FlowBuilder = require('./services/flowBuilder');
const ActionFramework = require('./services/actionFramework');
const EventBus = require('./services/eventBus');

const logger = {
    info: console.log,
    warn: console.log,
    error: console.log,
    debug: console.log,
}

console.log('--- Manual Flow System Test ---');

const eventBus = new EventBus({}, logger);
const actionFramework = new ActionFramework({}, logger);
const flowBuilder = new FlowBuilder({ autoSave: false }, logger);

let actionExecuted = false;
actionFramework.registerAction('test_action', (action, context) => {
    console.log('Test action executed!', action.parameters);
    actionExecuted = true;
    return { success: true, result: 'Action completed' };
});

const flowData = {
    id: 'test-flow',
    name: 'Test Flow',
    nodes: [
        { id: 'trigger-1', type: 'trigger', name: 'Test Trigger', position: { x: 100, y: 100 }, config: { eventType: 'test_event' } },
        { id: 'action-1', type: 'action', name: 'Test Action', position: { x: 300, y: 100 }, config: { actionType: 'test_action', parameters: { message: 'Hello from the flow!' } } }
    ],
    connections: [{ from: 'trigger-1', to: 'action-1', type: 'success' }]
};

flowBuilder.createFlow(flowData);
console.log('Flow created.');

console.log('Executing flow...');
flowBuilder.executeFlow('test-flow', {
    eventData: {
        type: 'test_event',
        someData: 'This is a test'
    }
});

if (actionExecuted) {
    console.log('✅ Flow executed successfully!');
} else {
    console.error('❌ Flow execution failed!');
}
