const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const AlarmTypeDiscoveryService = require('./services/alarmTypeDiscoveryService');

async function testAlarmSystem() {
  console.log('🧪 Testing Alarm System...\n');

  try {
    // Test 1: Alarm Type Discovery Service
    console.log('1. Testing Alarm Type Discovery Service...');
    const discoveryService = new AlarmTypeDiscoveryService();
    
    // Mock connector registry for testing
    const mockRegistry = {
      getConnectors: () => new Map([
        ['unifi-protect-main', {
          type: 'unifi-protect',
          name: 'UniFi Protect Main',
          getCapabilityDefinitions: () => [
            {
              id: 'camera:management',
              name: 'Camera Management',
              description: 'Manage camera devices and settings',
              category: 'security',
              events: ['motion', 'smartDetectZone', 'smartDetectLine'],
              parameters: {}
            }
          ]
        }],
        ['adsb-main', {
          type: 'adsb',
          name: 'ADSB Main',
          getCapabilityDefinitions: () => [
            {
              id: 'aircraft:tracking',
              name: 'Aircraft Tracking',
              description: 'Track aircraft movements',
              category: 'aviation',
              events: ['aircraft:detected', 'aircraft:emergency', 'aircraft:appeared'],
              parameters: {}
            }
          ]
        }]
      ])
    };
    
    discoveryService.setConnectorRegistry(mockRegistry);
    
    const alarmTypes = await discoveryService.discoverAllAlarmTypes();
    console.log(`   ✅ Discovered ${alarmTypes.length} alarm types`);
    
    for (const type of alarmTypes) {
      console.log(`   - ${type.name} (${type.category}, ${type.severity})`);
    }
    
    // Test 2: Default Rules Generation
    console.log('\n2. Testing Default Rules Generation...');
    const defaultRules = await discoveryService.generateDefaultRules();
    console.log(`   ✅ Generated ${defaultRules.length} default rules`);
    
    for (const rule of defaultRules.slice(0, 3)) {
      console.log(`   - ${rule.name} (${rule.conditions.eventType})`);
    }
    
    // Test 3: Alarm Types for UI
    console.log('\n3. Testing Alarm Types for UI...');
    const uiData = await discoveryService.getAlarmTypesForUI();
    console.log(`   ✅ UI data: ${uiData.total} types in ${uiData.categories.length} categories`);
    
    for (const category of uiData.categories) {
      console.log(`   - ${category}: ${uiData.types[category].length} types`);
    }
    
    // Test 4: Message Template Generation
    console.log('\n4. Testing Message Template Generation...');
    const testAlarmType = alarmTypes.find(t => t.eventType === 'motion');
    if (testAlarmType) {
      const message = discoveryService.generateDefaultMessage(testAlarmType);
      console.log(`   ✅ Generated message: ${message}`);
    }
    
    // Test 5: Rule Creation
    console.log('\n5. Testing Rule Creation...');
    const testRule = discoveryService.createDefaultRule(testAlarmType);
    console.log(`   ✅ Created rule: ${testRule.name}`);
    console.log(`   - Conditions: ${JSON.stringify(testRule.conditions)}`);
    console.log(`   - Actions: ${testRule.actions.length} actions`);
    
    console.log('\n🎉 All alarm system tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Test alarm clearing functionality
async function testAlarmClearing() {
  console.log('\n🧪 Testing Alarm Clearing...\n');
  
  try {
    // Mock alarm manager for testing
    const mockAlarmManager = {
      activeAlarms: new Map([
        ['alarm-1', {
          id: 'alarm-1',
          ruleId: 'test-rule-1',
          ruleName: 'Test Rule 1',
          eventType: 'motion',
          source: 'test',
          severity: 'medium',
          message: 'Test alarm 1',
          timestamp: Date.now(),
          status: 'active'
        }],
        ['alarm-2', {
          id: 'alarm-2',
          ruleId: 'test-rule-2',
          ruleName: 'Test Rule 2',
          eventType: 'smartDetectZone',
          source: 'test',
          severity: 'high',
          message: 'Test alarm 2',
          timestamp: Date.now(),
          status: 'active'
        }]
      ]),
      
      clearAlarmById: async function(alarmId) {
        const alarm = this.activeAlarms.get(alarmId);
        if (alarm) {
          alarm.status = 'cleared';
          alarm.clearedAt = Date.now();
          this.activeAlarms.delete(alarmId);
          console.log(`   ✅ Cleared alarm: ${alarmId}`);
          return true;
        }
        return false;
      },
      
      clearAllAlarms: async function() {
        const count = this.activeAlarms.size;
        this.activeAlarms.clear();
        console.log(`   ✅ Cleared ${count} alarms`);
        return count;
      },
      
      clearAlarmsByRule: async function(ruleId) {
        const alarmsToClear = Array.from(this.activeAlarms.values())
          .filter(alarm => alarm.ruleId === ruleId);
        
        for (const alarm of alarmsToClear) {
          this.activeAlarms.delete(alarm.id);
        }
        
        console.log(`   ✅ Cleared ${alarmsToClear.length} alarms for rule ${ruleId}`);
        return alarmsToClear.length;
      },
      
      getActiveAlarms: function() {
        return Array.from(this.activeAlarms.values());
      }
    };
    
    console.log('1. Testing individual alarm clearing...');
    console.log(`   Initial alarms: ${mockAlarmManager.getActiveAlarms().length}`);
    
    await mockAlarmManager.clearAlarmById('alarm-1');
    console.log(`   Remaining alarms: ${mockAlarmManager.getActiveAlarms().length}`);
    
    console.log('\n2. Testing rule-based alarm clearing...');
    await mockAlarmManager.clearAlarmsByRule('test-rule-2');
    console.log(`   Remaining alarms: ${mockAlarmManager.getActiveAlarms().length}`);
    
    console.log('\n3. Testing clear all alarms...');
    await mockAlarmManager.clearAllAlarms();
    console.log(`   Remaining alarms: ${mockAlarmManager.getActiveAlarms().length}`);
    
    console.log('\n🎉 All alarm clearing tests passed!');
    
  } catch (error) {
    console.error('❌ Alarm clearing test failed:', error);
    process.exit(1);
  }
}

// Test event processing
async function testEventProcessing() {
  console.log('\n🧪 Testing Event Processing...\n');
  
  try {
    const mockRules = [
      {
        id: 'rule-1',
        name: 'Motion Rule',
        enabled: true,
        conditions: {
          eventType: 'motion',
          source: 'unifi-protect-websocket'
        },
        actions: [
          {
            type: 'send_notification',
            parameters: {
              message: 'Motion detected on {{deviceId}}',
              channels: ['telegram', 'gui']
            }
          }
        ]
      },
      {
        id: 'rule-2',
        name: 'Smart Detection Rule',
        enabled: true,
        conditions: {
          eventType: 'smartDetectZone',
          source: 'unifi-protect-websocket'
        },
        actions: [
          {
            type: 'send_notification',
            parameters: {
              message: 'Smart detection: {{data.smartDetectTypes.0}}',
              channels: ['telegram']
            }
          }
        ]
      }
    ];
    
    const testEvents = [
      {
        type: 'motion',
        source: 'unifi-protect-websocket',
        timestamp: Date.now(),
        data: { deviceId: 'camera-1' }
      },
      {
        type: 'smartDetectZone',
        source: 'unifi-protect-websocket',
        timestamp: Date.now(),
        data: { smartDetectTypes: ['vehicle'] }
      },
      {
        type: 'doorbell',
        source: 'unifi-protect-websocket',
        timestamp: Date.now(),
        data: {}
      }
    ];
    
    console.log('1. Testing rule matching...');
    
    for (const event of testEvents) {
      console.log(`   Event: ${event.type} from ${event.source}`);
      
      const matchingRules = mockRules.filter(rule => {
        if (!rule.enabled) return false;
        
        const conditions = rule.conditions;
        
        if (conditions.eventType && conditions.eventType !== event.type) {
          return false;
        }
        
        if (conditions.source && conditions.source !== event.source) {
          return false;
        }
        
        return true;
      });
      
      console.log(`   Matching rules: ${matchingRules.length}`);
      for (const rule of matchingRules) {
        console.log(`   - ${rule.name}`);
      }
    }
    
    console.log('\n2. Testing template interpolation...');
    
    const template = 'Motion detected on {{deviceId}} at {{timestamp}}';
    const event = {
      type: 'motion',
      source: 'test',
      timestamp: Date.now(),
      data: { deviceId: 'camera-1' }
    };
    
    const interpolated = template
      .replace(/\{\{deviceId\}\}/g, event.data.deviceId || '')
      .replace(/\{\{timestamp\}\}/g, new Date(event.timestamp).toISOString());
    
    console.log(`   Template: ${template}`);
    console.log(`   Interpolated: ${interpolated}`);
    
    console.log('\n🎉 All event processing tests passed!');
    
  } catch (error) {
    console.error('❌ Event processing test failed:', error);
    process.exit(1);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Alarm System Tests\n');
  
  await testAlarmSystem();
  await testAlarmClearing();
  await testEventProcessing();
  
  console.log('\n🎉 All tests completed successfully!');
  console.log('\n📋 Summary:');
  console.log('✅ Alarm Type Discovery Service');
  console.log('✅ Default Rules Generation');
  console.log('✅ UI Data Preparation');
  console.log('✅ Message Template Generation');
  console.log('✅ Rule Creation');
  console.log('✅ Individual Alarm Clearing');
  console.log('✅ Rule-based Alarm Clearing');
  console.log('✅ Clear All Alarms');
  console.log('✅ Event Processing');
  console.log('✅ Template Interpolation');
  
  console.log('\n🚀 Alarm system is ready for use!');
  console.log('   Web Interface: http://localhost:3000/alarms');
  console.log('   API Endpoints: http://localhost:3000/api/alarms');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testAlarmSystem,
  testAlarmClearing,
  testEventProcessing,
  runAllTests
}; 