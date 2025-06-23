#!/usr/bin/env node

/**
 * Test script for Alarm Manager Connector
 * Tests the alarm management system with event processing and notifications
 */

const AlarmManagerConnector = require('./connectors/types/AlarmManagerConnector');
const TelegramConnector = require('./connectors/types/TelegramConnector');
const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const EventEmitter = require('events');

async function testAlarmManager() {
  console.log('🚨 Testing Alarm Manager Connector\n');

  try {
    // Create connector registry
    console.log('📋 Creating connector registry...');
    const connectorRegistry = new ConnectorRegistry();

    // Create event bus
    console.log('📡 Creating event bus...');
    const eventBus = new EventEmitter();

    // Create Telegram connector
    console.log('📱 Creating Telegram connector...');
    const telegramConnector = new TelegramConnector({
      id: 'telegram-bot-main',
      type: 'telegram',
      config: {
        token: '6730537017:AAGnK4toKXph8kodfSE80ms',
        chatId: '@fhNYM0MnPJQ2NjE8',
        enabled: true,
        mode: 'polling',
        pollingInterval: 1000,
        pollingTimeout: 10
      }
    });

    // Register Telegram connector
    connectorRegistry.registerConnector(telegramConnector);

    // Create Alarm Manager connector
    console.log('🚨 Creating Alarm Manager connector...');
    const alarmManagerConnector = new AlarmManagerConnector({
      id: 'alarm-manager-main',
      type: 'alarm-manager',
      enabled: true,
      defaultPriority: 'medium',
      escalationTimeout: 300000, // 5 minutes
      autoEscalation: true,
      telegramChatId: '@fhNYM0MnPJQ2NjE8'
    });

    // Register Alarm Manager connector
    connectorRegistry.registerConnector(alarmManagerConnector);

    // Set up connections
    alarmManagerConnector.setConnectorRegistry(connectorRegistry);
    alarmManagerConnector.setEventBus(eventBus);

    // Connect connectors (skip Telegram for now)
    console.log('🔗 Connecting Alarm Manager connector...');
    await alarmManagerConnector.performConnect();
    console.log('✅ Alarm Manager connector connected\n');

    // Test 1: Get status
    console.log('📊 Test 1: Getting Alarm Manager status...');
    const status = alarmManagerConnector.getStatus();
    console.log('📈 Status:', JSON.stringify(status, null, 2));
    console.log('');

    // Test 2: Create a test alarm
    console.log('🧪 Test 2: Creating a test alarm...');
    const testAlarm = await alarmManagerConnector.executeCapability('alarm:management', 'create_alarm', {
      event: {
        type: 'test',
        source: 'test-script',
        data: { test: true }
      },
      rule: {
        id: 'test-rule',
        priority: 'medium'
      },
      message: '🧪 Test alarm from Alarm Manager test script',
      priority: 'medium'
    });
    console.log('✅ Test alarm created:', testAlarm.id);
    console.log('');

    // Test 3: Get all alarms
    console.log('📋 Test 3: Getting all alarms...');
    const alarms = alarmManagerConnector.executeCapability('alarm:management', 'get_alarms', {});
    console.log(`📊 Found ${alarms.length} active alarms`);
    alarms.forEach(alarm => {
      console.log(`  - ${alarm.id}: ${alarm.type} (${alarm.priority})`);
    });
    console.log('');

    // Test 4: Emit test events
    console.log('📡 Test 4: Emitting test events...');
    
    // Test motion event
    eventBus.emit('motion', {
      type: 'motion',
      source: 'test-camera',
      data: {
        cameraId: 'test-cam-1',
        entityId: 'test-location',
        confidence: 0.85
      },
      timestamp: new Date().toISOString()
    });
    console.log('✅ Motion event emitted');

    // Test aircraft approach event
    eventBus.emit('prestwick:approach', {
      type: 'prestwick:approach',
      source: 'prestwick-airport',
      data: {
        icao24: 'TEST123',
        callsign: 'TESTFLIGHT',
        registration: 'G-TEST',
        altitude: 3000,
        speed: 150,
        heading: 120,
        runway: '12'
      },
      timestamp: new Date().toISOString()
    });
    console.log('✅ Aircraft approach event emitted');

    // Test NOTAM alert event
    eventBus.emit('prestwick:notam:alert', {
      type: 'prestwick:notam:alert',
      source: 'prestwick-airport',
      data: {
        notamAlert: {
          notamNumber: 'TEST001',
          title: 'Test NOTAM Alert',
          description: 'This is a test NOTAM alert for the alarm manager',
          priority: 'high',
          category: 'test',
          distance: 25,
          operationType: 'approach'
        }
      },
      timestamp: new Date().toISOString()
    });
    console.log('✅ NOTAM alert event emitted');
    console.log('');

    // Wait a moment for event processing
    console.log('⏳ Waiting for event processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 5: Check alarms after events
    console.log('📋 Test 5: Checking alarms after events...');
    const updatedAlarms = alarmManagerConnector.executeCapability('alarm:management', 'get_alarms', {});
    console.log(`📊 Found ${updatedAlarms.length} active alarms after events`);
    updatedAlarms.forEach(alarm => {
      console.log(`  - ${alarm.id}: ${alarm.type} (${alarm.priority}) - ${alarm.message.substring(0, 50)}...`);
    });
    console.log('');

    // Test 6: Test notification capabilities
    console.log('📱 Test 6: Testing notification capabilities...');
    const notificationResult = await alarmManagerConnector.executeCapability('alarm:notifications', 'send_notification', {
      message: '🧪 Test notification from Alarm Manager',
      channels: ['telegram'],
      priority: 'medium'
    });
    console.log('✅ Notification sent:', notificationResult);
    console.log('');

    // Test 7: Test rule management
    console.log('📋 Test 7: Testing rule management...');
    const rules = alarmManagerConnector.executeCapability('alarm:rules', 'get_rules', {});
    console.log(`📊 Found ${rules.length} rules in system`);
    rules.slice(0, 3).forEach(rule => {
      console.log(`  - ${rule.id}: ${rule.name} (${rule.category})`);
    });
    console.log('');

    // Test 8: Test escalation management
    console.log('⏰ Test 8: Testing escalation management...');
    const escalationStatus = alarmManagerConnector.executeCapability('alarm:escalation', 'get_escalation_status', {});
    console.log('📊 Escalation status:', escalationStatus);
    console.log('');

    // Disconnect connectors
    console.log('🔌 Disconnecting connectors...');
    await alarmManagerConnector.performDisconnect();
    console.log('✅ Test completed successfully!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testAlarmManager().catch(console.error); 