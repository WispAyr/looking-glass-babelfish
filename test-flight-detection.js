const ADSBConnector = require('./connectors/types/ADSBConnector');

// Test flight detection logic
function testFlightDetection() {
  console.log('🧪 Testing flight detection logic...\n');

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

  // Test aircraft data that should be detected as in flight
  const testAircraft = {
    icao24: '4CAE9F',
    altitude: 125,
    speed: 121.6,
    vertical_rate: -64
  };

  console.log('Test aircraft data:');
  console.log(`  ICAO24: ${testAircraft.icao24}`);
  console.log(`  Altitude: ${testAircraft.altitude} feet`);
  console.log(`  Speed: ${testAircraft.speed} knots`);
  console.log(`  Vertical rate: ${testAircraft.vertical_rate} feet/minute`);
  console.log('');

  // Test flight detection
  const isInFlight = connector.isAircraftInFlight(testAircraft);
  console.log(`Flight detection result: ${isInFlight ? '✅ IN FLIGHT' : '❌ NOT IN FLIGHT'}`);
  console.log('');

  // Show flight detection configuration
  console.log('Flight detection configuration:');
  console.log(`  maxGroundSpeed: ${connector.flightDetectionConfig.maxGroundSpeed} knots`);
  console.log(`  minAltitude: ${connector.flightDetectionConfig.minAltitude} feet`);
  console.log(`  minFlightDuration: ${connector.flightDetectionConfig.minFlightDuration} ms`);
  console.log('');

  // Test each condition
  console.log('Testing individual conditions:');
  const speedCondition = testAircraft.speed && testAircraft.speed > connector.flightDetectionConfig.maxGroundSpeed;
  const altitudeCondition = testAircraft.altitude && testAircraft.altitude > connector.flightDetectionConfig.minAltitude;
  const verticalRateCondition = testAircraft.vertical_rate && Math.abs(testAircraft.vertical_rate) > 100;

  console.log(`  Speed > ${connector.flightDetectionConfig.maxGroundSpeed} knots: ${testAircraft.speed} > ${connector.flightDetectionConfig.maxGroundSpeed} = ${speedCondition ? '✅' : '❌'}`);
  console.log(`  Altitude > ${connector.flightDetectionConfig.minAltitude} feet: ${testAircraft.altitude} > ${connector.flightDetectionConfig.minAltitude} = ${altitudeCondition ? '✅' : '❌'}`);
  console.log(`  |Vertical rate| > 100 feet/minute: |${testAircraft.vertical_rate}| > 100 = ${verticalRateCondition ? '✅' : '❌'}`);
  console.log('');

  console.log('Expected result: Aircraft should be detected as in flight because speed and altitude conditions are met.');
}

testFlightDetection(); 