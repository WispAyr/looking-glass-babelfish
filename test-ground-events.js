const ADSBConnector = require('./connectors/types/ADSBConnector');

// Create a test ADSB connector
const connector = new ADSBConnector('test-adsb', {
  url: 'http://localhost:8080/data/aircraft.json',
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

// Initialize the connector
connector.initialize();

// Test aircraft data for different scenarios
const testAircraft = {
  // Commercial aircraft landing
  commercial: {
    icao24: '407181',
    callsign: 'EXS5JM',
    lat: 55.5074,
    lon: -4.5933,
    altitude: 50,
    speed: 120,
    heading: 120,
    vertical_rate: -500,
    squawk: '1234'
  },
  
  // Helicopter hovering
  helicopter: {
    icao24: '400123',
    callsign: 'G-ABCD',
    lat: 55.5074,
    lon: -4.5933,
    altitude: 30,
    speed: 15,
    heading: 90,
    vertical_rate: 0,
    squawk: '5678'
  },
  
  // Aircraft taxiing
  taxiing: {
    icao24: '407182',
    callsign: 'BA123',
    lat: 55.5074,
    lon: -4.5933,
    altitude: 15,
    speed: 25,
    heading: 120,
    vertical_rate: 0,
    squawk: '2345'
  },
  
  // Aircraft parked
  parked: {
    icao24: '407183',
    callsign: 'FR456',
    lat: 55.5074,
    lon: -4.5933,
    altitude: 5,
    speed: 0,
    heading: 120,
    vertical_rate: 0,
    squawk: '3456'
  }
};

console.log('=== ADSB Ground Events & Helicopter Detection Test ===\n');

// Test 1: Ground movement detection
console.log('1. Testing ground movement detection:');
console.log('   Commercial aircraft on ground:', connector.isAircraftOnGround(testAircraft.commercial));
console.log('   Helicopter on ground:', connector.isAircraftOnGround(testAircraft.helicopter));
console.log('   Taxiing aircraft on ground:', connector.isAircraftOnGround(testAircraft.taxiing));
console.log('   Parked aircraft on ground:', connector.isAircraftOnGround(testAircraft.parked));
console.log('');

// Test 2: Helicopter detection
console.log('2. Testing helicopter detection:');
console.log('   Commercial aircraft is helicopter:', connector.isHelicopter(testAircraft.commercial));
console.log('   Helicopter is helicopter:', connector.isHelicopter(testAircraft.helicopter));
console.log('   Taxiing aircraft is helicopter:', connector.isHelicopter(testAircraft.taxiing));
console.log('');

// Test 3: Taxi detection
console.log('3. Testing taxi detection:');
console.log('   Commercial aircraft is taxiing:', connector.isAircraftTaxiing(testAircraft.commercial));
console.log('   Helicopter is taxiing:', connector.isAircraftTaxiing(testAircraft.helicopter));
console.log('   Taxiing aircraft is taxiing:', connector.isAircraftTaxiing(testAircraft.taxiing));
console.log('   Parked aircraft is taxiing:', connector.isAircraftTaxiing(testAircraft.parked));
console.log('');

// Test 4: Parking detection
console.log('4. Testing parking detection:');
console.log('   Commercial aircraft is parked:', connector.isAircraftParked(testAircraft.commercial));
console.log('   Helicopter is parked:', connector.isAircraftParked(testAircraft.helicopter));
console.log('   Taxiing aircraft is parked:', connector.isAircraftParked(testAircraft.taxiing));
console.log('   Parked aircraft is parked:', connector.isAircraftParked(testAircraft.parked));
console.log('');

// Test 5: Ground movement type determination
console.log('5. Testing ground movement type determination:');
console.log('   Commercial aircraft movement type:', connector.determineGroundMovementType(testAircraft.commercial));
console.log('   Helicopter movement type:', connector.determineGroundMovementType(testAircraft.helicopter));
console.log('   Taxiing aircraft movement type:', connector.determineGroundMovementType(testAircraft.taxiing));
console.log('   Parked aircraft movement type:', connector.determineGroundMovementType(testAircraft.parked));
console.log('');

// Test 6: Helicopter action determination
console.log('6. Testing helicopter action determination:');
console.log('   Helicopter action:', connector.determineHelicopterAction(testAircraft.helicopter));
console.log('');

// Test 7: Taxi phase determination
console.log('7. Testing taxi phase determination:');
console.log('   Taxiing aircraft phase:', connector.determineTaxiPhase(testAircraft.taxiing));
console.log('');

// Test 8: Parking area determination
console.log('8. Testing parking area determination:');
console.log('   Parked aircraft area:', connector.determineParkingArea(testAircraft.parked, connector.airport));
console.log('');

// Test 9: Confidence calculations
console.log('9. Testing confidence calculations:');
console.log('   Ground movement confidence:', connector.calculateGroundMovementConfidence(testAircraft.taxiing));
console.log('   Helicopter confidence:', connector.calculateHelicopterConfidence(testAircraft.helicopter));
console.log('   Taxi confidence:', connector.calculateTaxiConfidence(testAircraft.taxiing));
console.log('   Parking confidence:', connector.calculateParkingConfidence(testAircraft.parked));
console.log('');

// Test 10: Airport determination
console.log('10. Testing airport determination:');
const airport = connector.determineAirport(testAircraft.commercial);
console.log('   Determined airport:', airport ? airport.icao : 'Unknown');
console.log('');

console.log('=== Test Complete ===');
console.log('');
console.log('Event Types Available:');
console.log('  - landing:detected');
console.log('  - ground:movement');
console.log('  - helicopter:action');
console.log('  - taxi:movement');
console.log('  - parking:status');
console.log('');
console.log('The ADSB connector will emit these events when aircraft are detected in the corresponding states.'); 