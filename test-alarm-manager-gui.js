const AlarmManagerService = require('./services/alarmManagerService');

async function testAlarmManager() {
  console.log('🧪 Testing Alarm Manager Service...');
  
  try {
    // Initialize service
    const alarmService = new AlarmManagerService();
    await alarmService.initialize();
    
    console.log('✅ Alarm service initialized');
    
    // Create a test rule
    const testRule = {
      id: 'test-rule-1',
      name: 'Test Motion Detection',
      description: 'Test rule for motion detection events',
      priority: 'medium',
      category: 'security',
      enabled: true,
      conditions: [
        {
          type: 'eventType',
          value: 'motion',
          operator: 'equals'
        }
      ],
      actions: [
        {
          type: 'notification',
          config: {
            channels: ['telegram'],
            message: '🚨 Motion detected: {{event.type}} from {{event.source}}',
            priority: 'medium'
          }
        }
      ]
    };
    
    console.log('📝 Creating test rule...');
    const createdRule = await alarmService.createRule(testRule);
    console.log('✅ Test rule created:', createdRule.id);
    
    // Get all rules
    console.log('📋 Getting all rules...');
    const allRules = await alarmService.getAllRules();
    console.log(`✅ Found ${allRules.length} rules`);
    
    // Get stats
    console.log('📊 Getting statistics...');
    const stats = await alarmService.getStats();
    console.log('✅ Stats:', stats);
    
    // Record a test alarm
    console.log('🚨 Recording test alarm...');
    const alarmId = await alarmService.recordAlarmTrigger(
      'test-rule-1',
      'motion',
      'test-camera',
      { device: 'test-camera', confidence: 0.95 }
    );
    console.log('✅ Test alarm recorded with ID:', alarmId);
    
    // Get alarm history
    console.log('📜 Getting alarm history...');
    const history = await alarmService.getAlarmHistory(10);
    console.log(`✅ Found ${history.length} alarms in history`);
    
    // Clean up
    console.log('🧹 Cleaning up...');
    await alarmService.deleteRule('test-rule-1');
    console.log('✅ Test rule deleted');
    
    await alarmService.close();
    console.log('✅ Alarm service closed');
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAlarmManager(); 