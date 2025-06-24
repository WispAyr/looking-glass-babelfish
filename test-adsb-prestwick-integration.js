const ADSBConnector = require('./connectors/types/ADSBConnector');
const PrestwickAirportConnector = require('./connectors/types/PrestwickAirportConnector');
const AlarmManagerConnector = require('./connectors/types/AlarmManagerConnector');
const EventBus = require('./services/eventBus');
const ConnectorRegistry = require('./connectors/ConnectorRegistry');

async function testADSBPrestwickIntegration() {
  console.log('=== ADSB to Prestwick Integration Test ===\n');

  // Create event bus
  const eventBus = new EventBus({ maxEvents: 1000 });
  
  // Create connector registry
  const connectorRegistry = new ConnectorRegistry();
  
  // Create ADSB connector
  const adsbConfig = {
    id: 'adsb-main',
    type: 'adsb',
    url: 'http://10.0.1.180/skyaware/data/aircraft.json',
    pollInterval: 5000,
    enableGroundEventDetection: true,
    airport: {
      icao: 'EGPK',
      name: 'Glasgow Prestwick Airport',
      lat: 55.5074,
      lon: -4.5933
    }
  };
  
  const adsbConnector = new ADSBConnector(adsbConfig);
  adsbConnector.setEventBus(eventBus);
  
  // Create Prestwick connector
  const prestwickConfig = {
    id: 'prestwick-airport-main',
    type: 'prestwick-airport',
    prestwick: {
      airportCode: 'EGPK',
      airportName: 'Glasgow Prestwick Airport',
      latitude: 55.5074,
      longitude: -4.5933,
      approachRadius: 50000,
      runwayThreshold: 5000
    },
    telegram: {
      enabled: false // Disable for testing
    }
  };
  
  const prestwickConnector = new PrestwickAirportConnector(prestwickConfig);
  prestwickConnector.setEventBus(eventBus);
  prestwickConnector.setConnectorRegistry(connectorRegistry);
  
  // Create Alarm Manager connector
  const alarmConfig = {
    id: 'alarm-manager-main',
    type: 'alarm-manager',
    rateLimitEnabled: false, // Disable rate limiting for testing
    telegram: {
      enabled: false // Disable for testing
    }
  };
  
  const alarmManager = new AlarmManagerConnector(alarmConfig);
  alarmManager.setEventBus(eventBus);
  alarmManager.setConnectorRegistry(connectorRegistry);
  
  // Add connectors to registry
  connectorRegistry.registerConnector(adsbConnector);
  connectorRegistry.registerConnector(prestwickConnector);
  connectorRegistry.registerConnector(alarmManager);
  
  try {
    // Connect all connectors
    console.log('🔌 Connecting connectors...');
    await adsbConnector.connect();
    await prestwickConnector.connect();
    await alarmManager.connect();
    console.log('✅ All connectors connected\n');
    
    // Set up event listeners for testing
    let adsbEventsReceived = 0;
    let prestwickEventsReceived = 0;
    let alarmEventsReceived = 0;
    
    // Listen for ADSB events
    eventBus.subscribe('aircraft:appeared', (event) => {
      adsbEventsReceived++;
      console.log(`📡 ADSB Event ${adsbEventsReceived}: Aircraft appeared`, {
        icao24: event.data?.aircraft?.icao24,
        callsign: event.data?.aircraft?.callsign,
        source: event.source
      });
    });
    
    eventBus.subscribe('aircraft:updated', (event) => {
      adsbEventsReceived++;
      console.log(`📡 ADSB Event ${adsbEventsReceived}: Aircraft updated`, {
        icao24: event.data?.aircraft?.icao24,
        callsign: event.data?.aircraft?.callsign,
        source: event.source
      });
    });
    
    // Listen for Prestwick events
    eventBus.subscribe('prestwick:approach', (event) => {
      prestwickEventsReceived++;
      console.log(`🏢 Prestwick Event ${prestwickEventsReceived}: Aircraft approach`, {
        icao24: event.data?.icao24,
        callsign: event.data?.callsign
      });
    });
    
    eventBus.subscribe('prestwick:landing', (event) => {
      prestwickEventsReceived++;
      console.log(`🏢 Prestwick Event ${prestwickEventsReceived}: Aircraft landing`, {
        icao24: event.data?.icao24,
        callsign: event.data?.callsign
      });
    });
    
    // Listen for alarm events
    eventBus.subscribe('alarm:triggered', (event) => {
      alarmEventsReceived++;
      console.log(`🚨 Alarm Event ${alarmEventsReceived}:`, {
        ruleId: event.data?.ruleId,
        eventType: event.data?.eventType,
        source: event.data?.source
      });
    });
    
    // Test with mock aircraft data
    console.log('📡 Testing with mock aircraft data...\n');
    
    const mockAircraft = {
      icao24: '400123',
      callsign: 'BA1234',
      registration: 'G-ABCD',
      lat: 55.5074,
      lon: -4.5933,
      altitude: 3000,
      speed: 150,
      heading: 120,
      squawk: '1234',
      timestamp: Date.now()
    };
    
    // Simulate aircraft appearance
    console.log('1. Simulating aircraft appearance...');
    adsbConnector.handleAircraftAppearance(mockAircraft);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate aircraft update
    console.log('\n2. Simulating aircraft update...');
    const updatedAircraft = { ...mockAircraft, altitude: 2500, speed: 140 };
    adsbConnector.handleAircraftUpdate(mockAircraft, updatedAircraft);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate aircraft approach (low altitude)
    console.log('\n3. Simulating aircraft approach...');
    const approachAircraft = { ...mockAircraft, altitude: 1000, speed: 120 };
    adsbConnector.handleAircraftUpdate(updatedAircraft, approachAircraft);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate aircraft landing (very low altitude)
    console.log('\n4. Simulating aircraft landing...');
    const landingAircraft = { ...mockAircraft, altitude: 100, speed: 80 };
    adsbConnector.handleAircraftUpdate(approachAircraft, landingAircraft);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check statistics
    console.log('\n=== Test Results ===');
    console.log(`ADSB Events Received: ${adsbEventsReceived}`);
    console.log(`Prestwick Events Received: ${prestwickEventsReceived}`);
    console.log(`Alarm Events Received: ${alarmEventsReceived}`);
    
    // Check connector stats
    const adsbStats = adsbConnector.getStats();
    const prestwickStats = prestwickConnector.getStats();
    const alarmStats = alarmManager.getStats();
    
    console.log('\n=== Connector Statistics ===');
    console.log('ADSB Connector:');
    console.log(`  Total aircraft: ${adsbStats.totalAircraft}`);
    console.log(`  Events generated: ${adsbStats.eventsGenerated}`);
    
    console.log('\nPrestwick Connector:');
    console.log(`  Total aircraft processed: ${prestwickStats.totalAircraftProcessed}`);
    console.log(`  Total approaches: ${prestwickStats.totalApproaches}`);
    console.log(`  Total landings: ${prestwickStats.totalLandings}`);
    
    console.log('\nAlarm Manager:');
    console.log(`  Active alarms: ${alarmStats.activeAlarms}`);
    console.log(`  Total rules: ${alarmStats.totalRules}`);
    
    // Check event bus stats
    const eventBusStats = eventBus.getStats();
    console.log('\nEvent Bus:');
    console.log(`  Total events: ${eventBusStats.totalEvents}`);
    console.log(`  Subscribers: ${eventBusStats.subscriberCount}`);
    console.log(`  Queue length: ${eventBusStats.queueLength}`);
    
    if (adsbEventsReceived > 0 && prestwickEventsReceived > 0) {
      console.log('\n✅ Integration test PASSED - Events are flowing properly!');
    } else {
      console.log('\n❌ Integration test FAILED - Events are not flowing properly');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('\n🔌 Disconnecting connectors...');
    await adsbConnector.disconnect();
    await prestwickConnector.disconnect();
    await alarmManager.disconnect();
    console.log('✅ Test completed');
  }
}

// Run the test
testADSBPrestwickIntegration().catch(console.error); 