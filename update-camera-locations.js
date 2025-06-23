#!/usr/bin/env node

/**
 * Update Camera Locations to Prestwick Airport
 * 
 * This script updates all UniFi Protect cameras to have locations
 * around Prestwick Airport in Ayrshire, Scotland.
 */

const axios = require('axios');

// Prestwick Airport coordinates (55.5094° N, 4.5867° W)
const PRESTWICK_AIRPORT = {
  lat: 55.5094,
  lng: -4.5867
};

// Camera locations around Prestwick Airport
const CAMERA_LOCATIONS = [
  // Main terminal area
  { lat: 55.5094, lng: -4.5867, name: "Main Terminal" },
  { lat: 55.5098, lng: -4.5872, name: "Terminal North" },
  { lat: 55.5090, lng: -4.5862, name: "Terminal South" },
  
  // Runway area
  { lat: 55.5110, lng: -4.5850, name: "Runway 13" },
  { lat: 55.5078, lng: -4.5884, name: "Runway 31" },
  
  // Apron and parking
  { lat: 55.5102, lng: -4.5878, name: "Apron East" },
  { lat: 55.5086, lng: -4.5856, name: "Apron West" },
  
  // Security and access
  { lat: 55.5096, lng: -4.5848, name: "Main Gate" },
  { lat: 55.5088, lng: -4.5890, name: "Security Checkpoint" },
  
  // Tower and control
  { lat: 55.5108, lng: -4.5864, name: "Control Tower" },
  { lat: 55.5082, lng: -4.5870, name: "Ground Control" },
  
  // Maintenance and support
  { lat: 55.5112, lng: -4.5880, name: "Maintenance Hangar" },
  { lat: 55.5074, lng: -4.5852, name: "Fuel Farm" },
  
  // Additional cameras
  { lat: 55.5092, lng: -4.5844, name: "Cargo Area" },
  { lat: 55.5106, lng: -4.5892, name: "Staff Parking" },
  { lat: 55.5080, lng: -4.5838, name: "Public Parking" },
  { lat: 55.5114, lng: -4.5874, name: "Emergency Services" },
  { lat: 55.5072, lng: -4.5868, name: "Air Traffic Control" }
];

async function updateCameraLocations() {
  try {
    console.log('🛩️  Updating camera locations to Prestwick Airport...\n');
    
    // Get all cameras from both connectors
    const camerasResponse = await axios.get('http://127.0.0.1:3000/unifi/api/cameras');
    
    if (!camerasResponse.data.success) {
      throw new Error('Failed to get cameras');
    }
    
    const cameras = camerasResponse.data.data;
    console.log(`📹 Found ${cameras.length} cameras to update\n`);
    
    // Update each camera with a location
    for (let i = 0; i < cameras.length; i++) {
      const camera = cameras[i];
      const locationIndex = i % CAMERA_LOCATIONS.length;
      const location = CAMERA_LOCATIONS[locationIndex];
      
      console.log(`📍 Updating ${camera.name} (${camera.id})`);
      console.log(`   Connector: ${camera.connectorName}`);
      console.log(`   Location: ${location.lat}, ${location.lng} (${location.name})`);
      
      try {
        // Update camera location using the capability system
        const updateResponse = await axios.post(`http://127.0.0.1:3000/unifi/api/cameras/${camera.id}/location`, {
          lat: location.lat,
          lng: location.lng,
          locationName: location.name,
          locationDescription: `Camera at ${location.name} - Prestwick Airport`,
          locationAddress: `Prestwick Airport, Ayrshire, Scotland`
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (updateResponse.data.success) {
          console.log(`   ✅ Updated successfully\n`);
        } else {
          console.log(`   ❌ Failed: ${updateResponse.data.error}\n`);
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }
    
    console.log('🎉 Camera location update completed!');
    console.log('\n📋 Summary:');
    console.log(`   • Total cameras: ${cameras.length}`);
    console.log(`   • Location: Prestwick Airport, Ayrshire, Scotland`);
    console.log(`   • Coordinates: ${PRESTWICK_AIRPORT.lat}°N, ${PRESTWICK_AIRPORT.lng}°W`);
    console.log('\n🗺️  Check the map at http://localhost:3000/map.html to see the cameras!');
    
  } catch (error) {
    console.error('❌ Error updating camera locations:', error.message);
    process.exit(1);
  }
}

// Run the update
updateCameraLocations(); 