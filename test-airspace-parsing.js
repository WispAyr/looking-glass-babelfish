const fs = require('fs').promises;
const path = require('path');

// Copy the parsing logic from AirspaceService
function determineAirspaceType(filename) {
  if (filename.startsWith('UK_FA')) return 'Final_Approach';
  if (filename.startsWith('UK_FA20')) return 'Final_Approach_20nm';
  if (filename.startsWith('UK_AWY_L')) return 'Airway_Lower';
  if (filename.startsWith('UK_AWY_U')) return 'Airway_Upper';
  if (filename.startsWith('UK_ATZ')) return 'ATZ';
  if (filename.startsWith('UK_CTA')) return 'CTA';
  if (filename.startsWith('UK_TMA')) return 'TMA';
  if (filename.startsWith('UK_CTR')) return 'CTR';
  if (filename.startsWith('UK_DA')) return 'Danger_Area';
  if (filename.startsWith('UK_FIR')) return 'FIR';
  if (filename.startsWith('UK_LARS')) return 'LARS';
  if (filename.startsWith('UK_MIL')) return 'Military';
  if (filename.startsWith('UK_VOR')) return 'VOR';
  if (filename.startsWith('UK_HOLD')) return 'Holding_Pattern';
  
  return 'Unknown';
}

function parseBaseStationFormat(content, filename) {
  const airspaces = [];
  const lines = content.split('\n');
  
  let currentAirspace = null;
  let currentPolygon = [];
  let type = 5; // Default type
  
  console.log(`Parsing file: ${filename}`);
  console.log(`Total lines: ${lines.length}`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith(';') || trimmedLine === '') {
      continue; // Comment or empty line
    }
    
    if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
      // New airspace definition
      if (currentAirspace && currentPolygon.length > 0) {
        currentAirspace.polygons.push(currentPolygon);
        airspaces.push(currentAirspace);
        console.log(`Added airspace: ${currentAirspace.name} with ${currentPolygon.length} points`);
      }
      
      const name = trimmedLine.slice(1, -1);
      currentAirspace = {
        id: `${filename}_${name}`,
        name: name,
        type: determineAirspaceType(filename),
        filename: filename,
        polygons: [],
        metadata: {}
      };
      currentPolygon = [];
      type = 5; // Reset type
      console.log(`New airspace: ${name}`);
    }
    else if (trimmedLine.startsWith('$TYPE=')) {
      type = parseInt(trimmedLine.substring(6));
      if (currentAirspace) {
        currentAirspace.metadata.type = type;
      }
      console.log(`Type: ${type}`);
    }
    else if (trimmedLine === '-1') {
      // End of polygon
      if (currentPolygon.length > 0) {
        if (currentAirspace) {
          currentAirspace.polygons.push(currentPolygon);
          console.log(`End of polygon with ${currentPolygon.length} points`);
        }
        currentPolygon = [];
      }
    }
    else if (trimmedLine.includes('+-')) {
      // Coordinate pair
      const parts = trimmedLine.split('+-');
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lon = -parseFloat(parts[1]); // Convert to negative longitude
        
        if (!isNaN(lat) && !isNaN(lon)) {
          currentPolygon.push({ lat, lon });
        } else {
          console.log(`Invalid coordinates: ${trimmedLine}`);
        }
      } else {
        console.log(`Invalid coordinate format: ${trimmedLine}`);
      }
    } else {
      console.log(`Unrecognized line: ${trimmedLine}`);
    }
  }
  
  // Add final airspace
  if (currentAirspace && currentPolygon.length > 0) {
    currentAirspace.polygons.push(currentPolygon);
    airspaces.push(currentAirspace);
    console.log(`Final airspace: ${currentAirspace.name} with ${currentPolygon.length} points`);
  }
  
  console.log(`Total airspaces parsed: ${airspaces.length}`);
  return airspaces;
}

async function testAirspaceParsing() {
  try {
    const airspaceDataPath = './aviationdata/OUT_UK_Airspace';
    const files = await fs.readdir(airspaceDataPath);
    const outFiles = files.filter(file => file.endsWith('.out'));
    
    console.log(`Found ${outFiles.length} airspace files`);
    
    // Test with first few files
    for (let i = 0; i < Math.min(3, outFiles.length); i++) {
      const file = outFiles[i];
      console.log(`\n=== Testing file: ${file} ===`);
      
      const filePath = path.join(airspaceDataPath, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      const airspaceType = determineAirspaceType(file);
      const airspaceData = parseBaseStationFormat(content, file);
      
      console.log(`File: ${file}`);
      console.log(`Type: ${airspaceType}`);
      console.log(`Airspaces found: ${airspaceData.length}`);
      
      if (airspaceData.length > 0) {
        console.log('Sample airspace:');
        console.log(JSON.stringify(airspaceData[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAirspaceParsing(); 