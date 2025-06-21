const ADSBConnector = require('./connectors/types/ADSBConnector');

// Simulate the exact scenario happening in the ADSB connector
async function testFlightTrackingSimulation() {
  console.log('🧪 Testing flight tracking simulation...\n');

  // Create a minimal ADSB connector instance for testing
  const connector = new ADSBConnector({
    id: 'test-adsb',
    type: 'adsb',
    name: 'Test ADSB',
    config: {
      enableFlightTracking: true,
      enableAircraftDataService: true
    }
  });

  // Simulate aircraft data that matches what we're seeing
  const aircraftData = {
    icao24: '4CAE9F',
    altitude: 125,
    speed: 121.6,
    vertical_rate: -64,
    lat: 55.443008,
    lon: -4.402933,
    callsign: null,
    timestamp: Date.now()
  };

  console.log('Simulating aircraft data processing...');
  console.log(`Aircraft: ${aircraftData.icao24}`);
  console.log(`Altitude: ${aircraftData.altitude} feet`);
  console.log(`Speed: ${aircraftData.speed} knots`);
  console.log(`Vertical rate: ${aircraftData.vertical_rate} feet/minute`);
  console.log('');

  // Simulate the first appearance (new aircraft)
  console.log('1. First appearance (new aircraft):');
  const isInFlightFirst = connector.isAircraftInFlight(aircraftData);
  console.log(`   isAircraftInFlight: ${isInFlightFirst}`);
  
  if (isInFlightFirst) {
    console.log('   ✅ Aircraft is in flight on first appearance');
    console.log('   This should trigger startFlightTracking()');
  } else {
    console.log('   ❌ Aircraft is NOT in flight on first appearance');
  }
  console.log('');

  // Add aircraft to the connector's aircraft map
  connector.aircraft.set(aircraftData.icao24, aircraftData);
  console.log(`   Aircraft added to connector.aircraft map (size: ${connector.aircraft.size})`);
  console.log('');

  // Simulate subsequent update (existing aircraft)
  console.log('2. Subsequent update (existing aircraft):');
  const oldAircraft = connector.aircraft.get(aircraftData.icao24);
  const wasInFlight = connector.isAircraftInFlight(oldAircraft);
  const isInFlight = connector.isAircraftInFlight(aircraftData);
  
  console.log(`   wasInFlight: ${wasInFlight}`);
  console.log(`   isInFlight: ${isInFlight}`);
  
  if (!wasInFlight && isInFlight) {
    console.log('   ✅ Transition: not in flight -> in flight');
    console.log('   This should trigger startFlightTracking()');
  } else if (wasInFlight && isInFlight) {
    console.log('   ✅ Aircraft continues flying');
    console.log('   This should trigger updateFlightTracking()');
  } else if (wasInFlight && !isInFlight) {
    console.log('   ✅ Transition: in flight -> not in flight');
    console.log('   This should trigger endFlightTracking()');
  } else {
    console.log('   ❌ No transition detected');
  }
  console.log('');

  // Check current state
  console.log('3. Current state:');
  console.log(`   activeFlights count: ${connector.activeFlights.size}`);
  console.log(`   flightStarts: ${connector.performance.flightStarts}`);
  console.log(`   flightEnds: ${connector.performance.flightEnds}`);
  console.log('');

  // Simulate the handleAircraftUpdate call
  console.log('4. Simulating handleAircraftUpdate call:');
  await connector.handleAircraftUpdate(oldAircraft, aircraftData);
  console.log(`   After update - activeFlights count: ${connector.activeFlights.size}`);
  console.log(`   After update - flightStarts: ${connector.performance.flightStarts}`);
  console.log('');

  console.log('Expected result: Aircraft should be tracked as an active flight.');
}

testFlightTrackingSimulation().catch(console.error); 