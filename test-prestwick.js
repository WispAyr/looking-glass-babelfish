const PrestwickAirportService = require('./services/prestwickAirportService');

// Test the Prestwick Airport service
async function testPrestwickService() {
  console.log('🧪 Testing Prestwick Airport Service...\n');

  // Create service instance
  const prestwickService = new PrestwickAirportService({
    approachRadius: 50000,
    runwayThreshold: 5000
  });

  console.log('✅ Service created successfully');

  // Test runway determination
  console.log('\n🛫 Testing runway determination...');
  
  // Test aircraft approaching from the west (should use runway 12)
  const aircraftWest = {
    icao24: 'test123',
    callsign: 'TEST01',
    latitude: 55.5094,
    longitude: -4.7000, // West of airport
    altitude: 2000,
    speed: 150,
    heading: 120, // Heading towards runway 12
    timestamp: new Date().toISOString()
  };

  const runwayWest = prestwickService.determineRunway(
    aircraftWest.latitude,
    aircraftWest.longitude,
    aircraftWest.heading
  );

  console.log(`Aircraft from west (heading 120°): ${runwayWest ? `Runway ${runwayWest.id}` : 'No runway detected'}`);

  // Test aircraft approaching from the east (should use runway 30)
  const aircraftEast = {
    icao24: 'test456',
    callsign: 'TEST02',
    latitude: 55.5094,
    longitude: -4.4700, // East of airport
    altitude: 2000,
    speed: 150,
    heading: 300, // Heading towards runway 30
    timestamp: new Date().toISOString()
  };

  const runwayEast = prestwickService.determineRunway(
    aircraftEast.latitude,
    aircraftEast.longitude,
    aircraftEast.heading
  );

  console.log(`Aircraft from east (heading 300°): ${runwayEast ? `Runway ${runwayEast.id}` : 'No runway detected'}`);

  // Test aircraft state determination
  console.log('\n🛬 Testing aircraft state determination...');

  // Test approach state
  const approachAircraft = {
    ...aircraftWest,
    altitude: 1500,
    speed: 120
  };

  const approachState = prestwickService.determineAircraftState(
    approachAircraft,
    15000, // 15km from airport
    runwayWest
  );

  console.log(`Aircraft at 1500ft, 15km away: ${approachState}`);

  // Test landing state
  const landingAircraft = {
    ...aircraftWest,
    altitude: 200,
    speed: 80
  };

  const landingState = prestwickService.determineAircraftState(
    landingAircraft,
    2000, // 2km from airport
    runwayWest
  );

  console.log(`Aircraft at 200ft, 2km away: ${landingState}`);

  // Test takeoff state
  const takeoffAircraft = {
    ...aircraftWest,
    altitude: 500,
    speed: 120
  };

  const takeoffState = prestwickService.determineAircraftState(
    takeoffAircraft,
    1000, // 1km from airport
    runwayWest
  );

  console.log(`Aircraft at 500ft, 1km away: ${takeoffState}`);

  // Test event callbacks
  console.log('\n📡 Testing event callbacks...');

  let eventReceived = false;
  prestwickService.on('approach', (event) => {
    console.log('✅ Approach event received:', {
      icao24: event.data.icao24,
      callsign: event.data.callsign,
      runway: event.data.runway,
      altitude: event.data.altitude
    });
    eventReceived = true;
  });

  // Process an aircraft update that should trigger an approach event
  const result = prestwickService.processAircraftUpdate(approachAircraft);
  
  if (result) {
    console.log('✅ Aircraft processed successfully');
    console.log(`   State: ${result.state}`);
    console.log(`   Runway: ${result.runwayInfo ? result.runwayInfo.id : 'Unknown'}`);
    console.log(`   Distance: ${Math.round(result.distance)}m`);
  }

  // Test statistics
  console.log('\n📊 Testing statistics...');
  const stats = prestwickService.getStats();
  console.log('Statistics:', stats);

  // Test configuration
  console.log('\n⚙️ Testing configuration...');
  const config = prestwickService.getConfig();
  console.log('Configuration:', {
    airportCode: config.airportCode,
    airportName: config.airportName,
    approachRadius: config.approachRadius,
    runwayThreshold: config.runwayThreshold
  });

  // Test runways
  console.log('\n🛣️ Testing runways...');
  const runways = prestwickService.getRunways();
  console.log('Runways:', Object.keys(runways).map(id => `${id}: ${runways[id].name}`));

  console.log('\n✅ All tests completed successfully!');
}

// Run the test
testPrestwickService().catch(console.error); 