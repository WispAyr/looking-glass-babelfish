const AlarmManagerConnector = require('./connectors/types/AlarmManagerConnector');

/**
 * Test script to verify Alarm Manager rules are working
 */

async function testAlarmRules() {
    console.log('🧪 Testing Alarm Manager Rules...\n');
    
    // Create Alarm Manager Connector
    const config = {
        id: 'test-alarm-manager',
        defaultChatId: 'test-chat-id',
        telegram: {
            chatId: 'test-chat-id'
        }
    };
    
    const alarmManager = new AlarmManagerConnector(config);
    
    try {
        // Load rules
        await alarmManager.loadRules();
        
        console.log(`📋 Loaded ${alarmManager.rules.length} rules`);
        
        // List all rules
        alarmManager.rules.forEach((rule, index) => {
            console.log(`${index + 1}. ${rule.name} (${rule.id})`);
            console.log(`   Event Type: ${rule.conditions.eventType}`);
            console.log(`   Source: ${rule.conditions.source}`);
            console.log(`   Enabled: ${rule.enabled}`);
            console.log('');
        });
        
        // Test smartDetectLine rule
        const smartDetectRule = alarmManager.rules.find(r => r.conditions.eventType === 'smartDetectLine');
        if (smartDetectRule) {
            console.log('✅ Found smartDetectLine rule:', smartDetectRule.name);
        } else {
            console.log('❌ smartDetectLine rule not found');
        }
        
        // Test adsb:status rule
        const adsbRule = alarmManager.rules.find(r => r.conditions.eventType === 'adsb:status');
        if (adsbRule) {
            console.log('✅ Found adsb:status rule:', adsbRule.name);
        } else {
            console.log('❌ adsb:status rule not found');
        }
        
        // Test event matching
        const testSmartDetectEvent = {
            type: 'smartDetectLine',
            source: 'unifi-protect-websocket',
            timestamp: Date.now(),
            data: {
                deviceId: 'test-camera',
                smartDetectTypes: ['vehicle']
            }
        };
        
        const matchingRules = alarmManager.findMatchingRules(testSmartDetectEvent);
        console.log(`\n🔍 Smart Detect Event Matching:`);
        console.log(`   Event Type: ${testSmartDetectEvent.type}`);
        console.log(`   Source: ${testSmartDetectEvent.source}`);
        console.log(`   Matching Rules: ${matchingRules.length}`);
        
        if (matchingRules.length > 0) {
            console.log('   ✅ Rules matched successfully!');
            matchingRules.forEach(rule => {
                console.log(`   - ${rule.name}`);
            });
        } else {
            console.log('   ❌ No rules matched');
        }
        
        // Test ADSB event matching
        const testADSBEvent = {
            type: 'adsb:status',
            source: 'adsb-main',
            timestamp: Date.now(),
            data: {
                activeFlights: 2,
                aircraftCount: 5
            }
        };
        
        const matchingADSBRules = alarmManager.findMatchingRules(testADSBEvent);
        console.log(`\n🔍 ADSB Event Matching:`);
        console.log(`   Event Type: ${testADSBEvent.type}`);
        console.log(`   Source: ${testADSBEvent.source}`);
        console.log(`   Matching Rules: ${matchingADSBRules.length}`);
        
        if (matchingADSBRules.length > 0) {
            console.log('   ✅ Rules matched successfully!');
            matchingADSBRules.forEach(rule => {
                console.log(`   - ${rule.name}`);
            });
        } else {
            console.log('   ❌ No rules matched');
        }
        
    } catch (error) {
        console.error('❌ Error testing alarm rules:', error);
    }
    
    console.log('\n🎉 Test completed!');
}

// Run the test
testAlarmRules().catch(console.error); 