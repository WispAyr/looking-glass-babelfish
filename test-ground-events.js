const ADSBConnector = require('./connectors/types/ADSBConnector');
const PrestwickAirportConnector = require('./connectors/types/PrestwickAirportConnector');

// Create a test ADSB connector with ground event detection enabled
const adsbConnector = new ADSBConnector({
  id: 'test-adsb',
  type: 'adsb',
  url: 'http://localhost:8080/data/aircraft.json',
  enableGroundEventDetection: true,
  airport: {
    icao: 'EGPK',
    name: 'Glasgow Prestwick Airport',
    lat: 55.5074,
    lon: -4.5933,
    runways: [
      { id: '12/30', heading: 120, length: 2987, active: true },
      { id: '03/21', heading: 30, length: 2987, active: false }
    ]
  }
});

// Create a test Prestwick connector
const prestwickConnector = new PrestwickAirportConnector({
  id: 'test-prestwick',
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
    enabled: false // Disable Telegram for testing
  }
});

// Test aircraft data
const testAircraft = {
  // Aircraft on ground (taxiing)
  taxiing: {
    icao24: 'ABCD12',
    callsign: 'TEST123',
    lat: 55.5074,
    lon: -4.5933,
    altitude: 15,
    speed: 25,
    track: 120,
    vertical_rate: 0,
    squawk: '1234',
    timestamp: Date.now()
  },
  
  // Aircraft parked
  parked: {
    icao24: 'EFGH34',
    callsign: 'PARK456',
    lat: 55.5074,
    lon: -4.5933,
    altitude: 5,
    speed: 2,
    track: 0,
    vertical_rate: 0,
    squawk: '5678',
    timestamp: Date.now()
  },
  
  // Helicopter hovering
  helicopter: {
    icao24: 'IJKL56',
    callsign: 'HELI789',
    lat: 55.5074,
    lon: -4.5933,
    altitude: 30,
    speed: 15,
    track: 90,
    vertical_rate: 100,
    squawk: '9012',
    timestamp: Date.now()
  },
  
  // Aircraft in flight (should not trigger ground events)
  flying: {
    icao24: 'MNOP78',
    callsign: 'FLY901',
    lat: 55.5074,
    lon: -4.5933,
    altitude: 5000,
    speed: 250,
    track: 180,
    vertical_rate: 500,
    squawk: '3456',
    timestamp: Date.now()
  }
};

async function testGroundEvents() {
  console.log('=== ADSB Ground Events & Prestwick Integration Test ===\n');

  // Set up event listeners for ground events
  adsbConnector.on('ground:movement', (event) => {
    console.log('🚗 Ground Movement Event:', {
      icao24: event.aircraft.icao24,
      callsign: event.aircraft.callsign,
      movementType: event.metadata.movementType,
      confidence: event.metadata.confidence
    });
  });

  adsbConnector.on('taxi:movement', (event) => {
    console.log('🛫 Taxi Movement Event:', {
      icao24: event.aircraft.icao24,
      callsign: event.aircraft.callsign,
      taxiPhase: event.metadata.taxiPhase,
      confidence: event.metadata.confidence
    });
  });

  adsbConnector.on('parking:status', (event) => {
    console.log('🅿️ Parking Status Event:', {
      icao24: event.aircraft.icao24,
      callsign: event.aircraft.callsign,
      parkingArea: event.metadata.parkingArea,
      confidence: event.metadata.confidence
    });
  });

  adsbConnector.on('helicopter:action', (event) => {
    console.log('🚁 Helicopter Action Event:', {
      icao24: event.aircraft.icao24,
      callsign: event.aircraft.callsign,
      action: event.metadata.action,
      confidence: event.metadata.confidence
    });
  });

  // Set up Prestwick connector event listeners
  prestwickConnector.on('prestwick:ground:movement', (event) => {
    console.log('🏢 Prestwick Ground Movement:', {
      icao24: event.data.icao24,
      callsign: event.data.callsign,
      movementType: event.data.movementType
    });
  });

  prestwickConnector.on('prestwick:taxi:movement', (event) => {
    console.log('🏢 Prestwick Taxi Movement:', {
      icao24: event.data.icao24,
      callsign: event.data.callsign,
      taxiPhase: event.data.taxiPhase
    });
  });

  prestwickConnector.on('prestwick:parking:status', (event) => {
    console.log('🏢 Prestwick Parking Status:', {
      icao24: event.data.icao24,
      callsign: event.data.callsign,
      parkingArea: event.data.parkingArea
    });
  });

  prestwickConnector.on('prestwick:helicopter:action', (event) => {
    console.log('🏢 Prestwick Helicopter Action:', {
      icao24: event.data.icao24,
      callsign: event.data.callsign,
      action: event.data.action
    });
  });

  // Connect the connectors
  await adsbConnector.connect();
  await prestwickConnector.connect();

  // Set up the connection between ADSB and Prestwick
  prestwickConnector.setConnectorRegistry({
    getConnector: (id) => {
      if (id === 'adsb-main') return adsbConnector;
      return null;
    }
  });

  console.log('Testing ground event detection...\n');

  // Test each aircraft type
  console.log('1. Testing taxiing aircraft...');
  adsbConnector.processAircraftData({
    aircraft: [testAircraft.taxiing]
  });

  console.log('\n2. Testing parked aircraft...');
  adsbConnector.processAircraftData({
    aircraft: [testAircraft.parked]
  });

  console.log('\n3. Testing helicopter...');
  adsbConnector.processAircraftData({
    aircraft: [testAircraft.helicopter]
  });

  console.log('\n4. Testing flying aircraft (should not trigger ground events)...');
  adsbConnector.processAircraftData({
    aircraft: [testAircraft.flying]
  });

  // Test ground detection methods
  console.log('\n=== Ground Detection Method Tests ===');
  console.log('   Taxiing aircraft on ground:', adsbConnector.isAircraftOnGround(testAircraft.taxiing));
  console.log('   Taxiing aircraft taxiing:', adsbConnector.isAircraftTaxiing(testAircraft.taxiing));
  console.log('   Parked aircraft on ground:', adsbConnector.isAircraftOnGround(testAircraft.parked));
  console.log('   Parked aircraft parked:', adsbConnector.isAircraftParked(testAircraft.parked));
  console.log('   Helicopter on ground:', adsbConnector.isAircraftOnGround(testAircraft.helicopter));
  console.log('   Flying aircraft on ground:', adsbConnector.isAircraftOnGround(testAircraft.flying));

  // Test Prestwick connector methods
  console.log('\n=== Prestwick Integration Tests ===');
  console.log('   Taxiing aircraft at Prestwick:', prestwickConnector.isAircraftAtPrestwick(testAircraft.taxiing));
  console.log('   Parked aircraft at Prestwick:', prestwickConnector.isAircraftAtPrestwick(testAircraft.parked));
  console.log('   Helicopter at Prestwick:', prestwickConnector.isAircraftAtPrestwick(testAircraft.helicopter));

  // Get stats
  console.log('\n=== ADSB Connector Stats ===');
  const adsbStats = adsbConnector.getStats();
  console.log('   Total aircraft processed:', adsbStats.totalAircraft);
  console.log('   Events generated:', adsbConnector.events.length);

  console.log('\n=== Prestwick Connector Stats ===');
  const prestwickStats = prestwickConnector.getStats();
  console.log('   Total aircraft processed:', prestwickStats.totalAircraftProcessed);
  console.log('   Total approaches:', prestwickStats.totalApproaches);
  console.log('   Total landings:', prestwickStats.totalLandings);
  console.log('   Total takeoffs:', prestwickStats.totalTakeoffs);
  console.log('   Total departures:', prestwickStats.totalDepartures);

  console.log('\n✅ Ground events test completed!');
  
  // Cleanup
  await adsbConnector.disconnect();
  await prestwickConnector.disconnect();
}

// Run the test
testGroundEvents().catch(console.error); 