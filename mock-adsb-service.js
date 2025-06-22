const express = require('express');
const app = express();
const port = 8080;

// Mock aircraft data
const mockAircraftData = {
  now: Date.now() / 1000,
  messages: 1234,
  aircraft: [
    {
      hex: "4008F5",
      flight: "BAW123",
      lat: 55.5074,
      lon: -4.5933,
      altitude: 35000,
      track: 45,
      speed: 450,
      squawk: "1234",
      seen: 10,
      messages: 15,
      seen_pos: 5
    },
    {
      hex: "4008F6",
      flight: "EZY456",
      lat: 55.6074,
      lon: -4.4933,
      altitude: 28000,
      track: 90,
      speed: 380,
      squawk: "5678",
      seen: 8,
      messages: 12,
      seen_pos: 3
    },
    {
      hex: "4008F7",
      flight: "FR789",
      lat: 55.4074,
      lon: -4.6933,
      altitude: 42000,
      track: 180,
      speed: 520,
      squawk: "7500", // Emergency code
      seen: 12,
      messages: 18,
      seen_pos: 7
    }
  ]
};

app.get('/skyaware/data/aircraft.json', (req, res) => {
  // Update timestamps
  mockAircraftData.now = Date.now() / 1000;
  mockAircraftData.messages += Math.floor(Math.random() * 10);
  
  // Add some movement to aircraft
  mockAircraftData.aircraft.forEach(aircraft => {
    aircraft.lat += (Math.random() - 0.5) * 0.01;
    aircraft.lon += (Math.random() - 0.5) * 0.01;
    aircraft.seen = Math.floor(Math.random() * 20) + 1;
  });
  
  res.json(mockAircraftData);
});

app.get('/', (req, res) => {
  res.send('Mock ADS-B Service Running - Use /skyaware/data/aircraft.json for aircraft data');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Mock ADS-B service running at http://localhost:${port}`);
  console.log(`Aircraft data available at http://localhost:${port}/skyaware/data/aircraft.json`);
}); 