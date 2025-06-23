#!/usr/bin/env node

/**
 * Test script for Prestwick Airport NOTAM integration
 * Demonstrates how the Prestwick connector can query NOTAMs related to Prestwick Airport
 */

const PrestwickAirportConnector = require('./connectors/types/PrestwickAirportConnector');
const NOTAMConnector = require('./connectors/types/NOTAMConnector');
const TelegramConnector = require('./connectors/types/TelegramConnector');
const AlarmManagerConnector = require('./connectors/types/AlarmManagerConnector');
const ConnectorRegistry = require('./connectors/ConnectorRegistry');
const EventEmitter = require('events');

async function testPrestwickNotamIntegration() {
  console.log('🚁 Testing Prestwick Airport NOTAM Integration\n');

  try {
    // Create connector registry
    console.log('📋 Creating connector registry...');
    const connectorRegistry = new ConnectorRegistry();

    // Create event bus
    console.log('📡 Creating event bus...');
    const eventBus = new EventEmitter();

    // Create NOTAM connector
    console.log('📋 Creating NOTAM connector...');
    const notamConnector = new NOTAMConnector({
      id: 'notam-main',
      type: 'notam',
      notamUrl: 'https://raw.githubusercontent.com/Jonty/uk-notam-archive/main/data/PIB.xml',
      pollInterval: 300000, // 5 minutes for testing
      logLevel: 'debug' // Enable debug logging
    });

    // Register NOTAM connector
    connectorRegistry.registerConnector(notamConnector);

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

    // Create Prestwick connector
    console.log('✈️ Creating Prestwick Airport connector...');
    const prestwickConnector = new PrestwickAirportConnector({
      id: 'prestwick-test',
      type: 'prestwick-airport',
      prestwick: {
        airportCode: 'EGPK',
        airportName: 'Prestwick Airport',
        latitude: 55.5094,
        longitude: -4.5867,
        approachRadius: 50000,
        runwayThreshold: 5000
      },
      telegram: {
        enabled: true, // Enable notifications (now via Alarm Manager)
        chatId: '@fhNYM0MnPJQ2NjE8',
        notifyApproaches: true,
        notifyLandings: true,
        notifyTakeoffs: true,
        notifyDepartures: true,
        notifyNotams: true
      }
    });

    // Set connector registry and event bus for Prestwick connector
    prestwickConnector.setConnectorRegistry(connectorRegistry);
    prestwickConnector.setEventBus(eventBus);

    // Set connector registry and event bus for Alarm Manager connector
    alarmManagerConnector.setConnectorRegistry(connectorRegistry);
    alarmManagerConnector.setEventBus(eventBus);

    // Connect NOTAM connector
    console.log('🔗 Connecting NOTAM connector...');
    await notamConnector.performConnect();
    console.log('✅ NOTAM connector connected\n');

    // Connect Telegram connector
    console.log('🔗 Connecting Telegram connector...');
    await telegramConnector.performConnect();
    console.log('✅ Telegram connector connected\n');

    // Connect Alarm Manager connector
    console.log('🔗 Connecting Alarm Manager connector...');
    await alarmManagerConnector.performConnect();
    console.log('✅ Alarm Manager connector connected\n');

    // Connect Prestwick connector
    console.log('🔗 Connecting Prestwick connector...');
    await prestwickConnector.performConnect();
    console.log('✅ Prestwick connector connected\n');

    // Test 1: Query NOTAMs around Prestwick
    console.log('🔍 Test 1: Querying NOTAMs around Prestwick Airport...');
    const notams = await prestwickConnector.executeCapability('notam:integration', 'query_notams', {
      radius: 50,
      category: 'all',
      priority: 'all',
      aircraftPosition: { lat: 55.5094, lon: -4.5867 }
    });
    
    console.log(`📊 Found ${notams.length} NOTAMs within 50km of Prestwick`);
    if (notams.length > 0) {
      console.log('📋 Sample NOTAMs:');
      notams.slice(0, 3).forEach((notam, index) => {
        console.log(`  ${index + 1}. ${notam.notamNumber || 'Unknown'} - ${notam.title || 'No title'}`);
        console.log(`     Category: ${notam.category || 'Unknown'}, Priority: ${notam.priority || 'Unknown'}`);
        console.log(`     Distance: ${Math.round(notam.distance)}km`);
      });
    }
    console.log('');

    // Test 2: Check NOTAMs for aircraft approach
    console.log('🛬 Test 2: Checking NOTAMs for aircraft approach...');
    const approachPosition = { lat: 55.5094, lon: -4.5867 };
    const approachAlerts = await prestwickConnector.prestwickService.getNotamAlerts(approachPosition, 'approach');
    
    console.log(`⚠️ Found ${approachAlerts.length} NOTAM alerts for approach operation`);
    if (approachAlerts.length > 0) {
      console.log('🚨 Approach NOTAM Alerts:');
      approachAlerts.forEach((alert, index) => {
        console.log(`  ${index + 1}. ${alert.notamNumber} - ${alert.title}`);
        console.log(`     Priority: ${alert.priority}, Category: ${alert.category}`);
        console.log(`     Distance: ${Math.round(alert.distance)}km`);
      });
    }
    console.log('');

    // Test 3: Configure NOTAM monitoring
    console.log('⚙️ Test 3: Configuring NOTAM monitoring...');
    const configResult = await prestwickConnector.executeCapability('notam:integration', 'configure_notam_monitoring', {
      enabled: true,
      searchRadius: 30,
      checkOnApproach: true,
      checkOnLanding: true,
      checkOnTakeoff: true,
      priorityThreshold: 'medium'
    });
    
    console.log('✅ NOTAM monitoring configured:', configResult.config);
    console.log('');

    // Test 4: Get connector status
    console.log('📊 Test 4: Getting connector status...');
    const status = prestwickConnector.getStatus();
    console.log('📈 Connector Status:');
    console.log(`  Connected: ${status.connected}`);
    console.log(`  ADSB Connected: ${status.adsbConnected}`);
    console.log(`  NOTAM Connected: ${status.notamConnected}`);
    console.log(`  NOTAM Queries: ${status.stats.notamQueries}`);
    console.log(`  NOTAM Alerts: ${status.stats.notamAlerts}`);
    console.log('');

    // Test 5: Simulate aircraft event with NOTAM checking
    console.log('✈️ Test 5: Simulating aircraft approach with NOTAM checking...');
    const aircraftData = {
      icao24: 'TEST123',
      callsign: 'TESTFLIGHT',
      registration: 'G-TEST',
      latitude: 55.5094,
      longitude: -4.5867,
      altitude: 3000,
      speed: 150,
      heading: 120,
      timestamp: new Date().toISOString()
    };

    // Process aircraft update
    const result = prestwickConnector.prestwickService.processAircraftUpdate(aircraftData);
    console.log(`🛩️ Aircraft processed: ${result ? 'Yes' : 'No'}`);
    console.log('');

    // Test 6: Simulate aircraft approach near a NOTAM location
    console.log('🛬 Test 6: Simulating aircraft approach near NOTAM location...');
    const notamAircraftData = {
      icao24: 'NOTAM123',
      callsign: 'NOTAMTEST',
      registration: 'G-NOTAM',
      latitude: 54.13, // Near the NOTAM location we saw (54.13°N)
      longitude: -3.27, // Near the NOTAM location we saw (3.27°W)
      altitude: 2000,
      speed: 120,
      heading: 90,
      timestamp: new Date().toISOString()
    };

    // Process aircraft update near NOTAM
    const notamResult = prestwickConnector.prestwickService.processAircraftUpdate(notamAircraftData);
    console.log(`🛩️ NOTAM aircraft processed: ${notamResult ? 'Yes' : 'No'}`);
    console.log('');

    // Test 7: Manually trigger NOTAM check and Telegram notification
    console.log('📱 Test 7: Manually triggering NOTAM check and Telegram notification...');
    try {
      const notamAlerts = await prestwickConnector.prestwickService.getNotamAlerts(
        { lat: 54.13, lon: -3.27 },
        'approach'
      );
      
      console.log(`⚠️ Found ${notamAlerts.length} NOTAM alerts for manual test`);
      
      if (notamAlerts.length > 0) {
        console.log('📱 Sending Telegram notification for NOTAM alert...');
        await prestwickConnector.sendNotamTelegramNotification(notamAlerts[0]);
        console.log('✅ Telegram notification sent!');
      } else {
        console.log('ℹ️ No NOTAM alerts found for manual test');
      }
    } catch (error) {
      console.log('❌ Error in manual NOTAM test:', error.message);
    }
    console.log('');

    // Test 8: Show all available NOTAMs and test with active ones
    console.log('📋 Test 8: Checking all available NOTAMs...');
    try {
      const allNotams = await prestwickConnector.notamConnector.getNotams();
      console.log(`📊 Total NOTAMs available: ${allNotams.length}`);
      
      if (allNotams.length > 0) {
        // Show first few NOTAMs
        console.log('📋 Sample NOTAMs:');
        allNotams.slice(0, 3).forEach((notam, index) => {
          console.log(`  ${index + 1}. ${notam.notamId} - ${notam.location} - ${notam.message.substring(0, 100)}...`);
        });
        
        // Test with the first NOTAM's location
        const firstNotam = allNotams[0];
        if (firstNotam.coordinates) {
          console.log(`📍 Testing with NOTAM location: ${firstNotam.coordinates}`);
          const testAlerts = await prestwickConnector.prestwickService.getNotamAlerts(
            firstNotam.coordinates,
            'approach'
          );
          console.log(`⚠️ Found ${testAlerts.length} NOTAM alerts at this location`);
          
          if (testAlerts.length > 0) {
            console.log('📱 Sending Telegram notification for active NOTAM...');
            await prestwickConnector.sendNotamTelegramNotification(testAlerts[0]);
            console.log('✅ Telegram notification sent for active NOTAM!');
          }
        }
      }
    } catch (error) {
      console.log('❌ Error checking all NOTAMs:', error.message);
    }
    console.log('');

    // Disconnect connectors
    console.log('🔌 Disconnecting connectors...');
    await prestwickConnector.performDisconnect();
    await notamConnector.performDisconnect();
    await telegramConnector.performDisconnect();
    await alarmManagerConnector.performDisconnect();
    console.log('✅ Test completed successfully!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testPrestwickNotamIntegration();
}

module.exports = { testPrestwickNotamIntegration }; 