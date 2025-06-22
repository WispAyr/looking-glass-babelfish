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

// Test aircraft data
const testAircraft = {
  icao24: '407181',
  callsign: 'EXS5JM',
  lat: 55.5074,
  lon: -4.5933,
  altitude: 50,
  speed: 120,
  heading: 120,
  vertical_rate: -500,
  squawk: '1234'
};

console.log('=== ADSB Landing Detection Test ===\n');

// Test 1: Airport determination
console.log('1. Testing airport determination...');
const airport = connector.determineAirport(testAircraft);
console.log('   Airport:', airport ? airport.name : 'None');
console.log('   ICAO:', airport ? airport.icao : 'None');

// Test 2: Runway determination
console.log('\n2. Testing runway determination...');
const runway = connector.determineRunway(testAircraft, airport);
console.log('   Runway:', runway ? runway.id : 'None');
console.log('   Heading:', runway ? runway.heading : 'None');

// Test 3: Landing detection
console.log('\n3. Testing landing detection...');
const isLanding = connector.isAircraftLikelyLanding(testAircraft);
console.log('   Is likely landing:', isLanding);

// Test 4: Runway usage tracking
console.log('\n4. Testing runway usage tracking...');
const runwayUsage = connector.trackRunwayUsage(testAircraft, airport);
console.log('   Runway usage:', runwayUsage);

// Test 5: Enhanced aircraft data
console.log('\n5. Testing enhanced aircraft data...');
const enhancedData = connector.getEnhancedAircraftData('407181');
console.log('   Enhanced data available:', enhancedData ? 'Yes' : 'No');

// Test 6: Event emission (simulate landing)
console.log('\n6. Testing event emission...');
connector.on('landing:detected', (event) => {
  console.log('   Landing event emitted:', event.type);
  console.log('   Aircraft:', event.aircraft.icao24);
  console.log('   Airport:', event.metadata.airport.icao);
  console.log('   Runway:', event.metadata.runway.id);
});

// Simulate a landing event
const mockAirspace = { name: 'EGPK_FINAL_APPROACH', type: 'Final_Approach' };
connector.generateLandingEvent(testAircraft, mockAirspace);

console.log('\n=== Test Complete ==='); 