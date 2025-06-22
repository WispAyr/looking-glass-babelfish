const express = require('express');
const router = express.Router();
const winston = require('winston');

// Create logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'history-routes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Import services (these will be injected from the main server)
let adsbConnector, connectorRegistry, aircraftDataService, airspaceService, squawkCodeService, remotionConnector;

// Middleware to inject services
function injectServices(services) {
  adsbConnector = services.adsbConnector;
  connectorRegistry = services.connectorRegistry;
  aircraftDataService = services.aircraftDataService;
  airspaceService = services.airspaceService;
  squawkCodeService = services.squawkCodeService;
  remotionConnector = services.remotionConnector;
}

// Main historical flight interface
router.get('/', (req, res) => {
  if (!connectorRegistry) {
    return res.status(500).send('Connector Registry not initialized');
  }
  
  const adsbConnector = connectorRegistry.getConnector('adsb-main');
  
  if (!adsbConnector) {
    return res.status(404).send('ADSB Connector not found');
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flight History - Looking Glass</title>
  
  <!-- Leaflet CSS for maps -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #00ff00;
      overflow-x: hidden;
      min-height: 100vh;
    }
    
    .header {
      background: rgba(0,0,0,0.9);
      border-bottom: 2px solid #00ff00;
      padding: 20px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      text-shadow: 0 0 10px #00ff00;
    }
    
    .header .subtitle {
      font-size: 1.2em;
      opacity: 0.8;
    }
    
    .controls {
      background: rgba(0,0,0,0.8);
      border: 1px solid #00ff00;
      border-radius: 8px;
      padding: 20px;
      margin: 20px;
      display: flex;
      gap: 20px;
      align-items: center;
      flex-wrap: wrap;
    }
    
    .control-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .control-group label {
      font-weight: bold;
      font-size: 14px;
    }
    
    .control-group input, .control-group select {
      background: #000;
      border: 1px solid #00ff00;
      color: #00ff00;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .control-group input:focus, .control-group select:focus {
      outline: none;
      border-color: #ffff00;
      box-shadow: 0 0 5px #ffff00;
    }
    
    .btn {
      background: #00ff00;
      color: #000;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s ease;
    }
    
    .btn:hover {
      background: #ffff00;
      transform: translateY(-2px);
    }
    
    .btn:active {
      transform: translateY(0);
    }
    
    .btn.render-video {
      background: #ff6600;
      color: #fff;
    }
    
    .btn.render-video:hover {
      background: #ff8800;
    }
    
    .btn.render-video:disabled {
      background: #666;
      cursor: not-allowed;
      transform: none;
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px;
    }
    
    .stat-card {
      background: rgba(0,0,0,0.8);
      border: 1px solid #00ff00;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    
    .stat-value {
      font-size: 2em;
      font-weight: bold;
      color: #ffff00;
    }
    
    .stat-label {
      font-size: 0.9em;
      opacity: 0.8;
      margin-top: 5px;
    }
    
    .flights-container {
      margin: 20px;
    }
    
    .flight-card {
      background: rgba(0,0,0,0.8);
      border: 1px solid #00ff00;
      border-radius: 8px;
      margin-bottom: 20px;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    
    .flight-card:hover {
      border-color: #ffff00;
      box-shadow: 0 0 20px rgba(255,255,0,0.3);
    }
    
    .flight-header {
      background: rgba(0,255,0,0.1);
      padding: 15px 20px;
      border-bottom: 1px solid #00ff00;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .flight-callsign {
      font-size: 1.5em;
      font-weight: bold;
      color: #ffff00;
    }
    
    .flight-registration {
      font-size: 1.2em;
      color: #00ffff;
    }
    
    .flight-status {
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 0.9em;
      font-weight: bold;
    }
    
    .flight-status.active {
      background: #00ff00;
      color: #000;
    }
    
    .flight-status.completed {
      background: #ff8800;
      color: #000;
    }
    
    .flight-status.emergency {
      background: #ff0000;
      color: #fff;
      animation: blink 1s infinite;
    }
    
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0.5; }
    }
    
    .flight-details {
      padding: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
    }
    
    .detail-section {
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(0,255,0,0.3);
      border-radius: 6px;
      padding: 15px;
    }
    
    .detail-section h3 {
      color: #ffff00;
      margin-bottom: 10px;
      font-size: 1.1em;
      border-bottom: 1px solid rgba(0,255,0,0.3);
      padding-bottom: 5px;
    }
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.9em;
    }
    
    .detail-label {
      color: #888;
    }
    
    .detail-value {
      color: #00ff00;
      font-weight: bold;
    }
    
    .detail-value.emergency {
      color: #ff0000;
    }
    
    .detail-value.warning {
      color: #ff8800;
    }
    
    .flight-path {
      height: 300px;
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(0,255,0,0.3);
      border-radius: 6px;
      position: relative;
      overflow: hidden;
    }
    
    .flight-path-map {
      width: 100%;
      height: 100%;
      border-radius: 6px;
    }
    
    .flight-path canvas {
      width: 100%;
      height: 100%;
    }
    
    .render-controls {
      display: flex;
      gap: 10px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    
    .render-status {
      margin-top: 10px;
      padding: 10px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    
    .render-status.rendering {
      background: rgba(255, 102, 0, 0.2);
      border: 1px solid #ff6600;
      color: #ff6600;
    }
    
    .render-status.completed {
      background: rgba(0, 255, 0, 0.2);
      border: 1px solid #00ff00;
      color: #00ff00;
    }
    
    .render-status.error {
      background: rgba(255, 0, 0, 0.2);
      border: 1px solid #ff0000;
      color: #ff0000;
    }
    
    .alerts {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    
    .alert {
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: bold;
    }
    
    .alert.emergency {
      background: #ff0000;
      color: #fff;
    }
    
    .alert.warning {
      background: #ff8800;
      color: #000;
    }
    
    .alert.info {
      background: #0088ff;
      color: #fff;
    }
    
    .loading {
      text-align: center;
      padding: 50px;
      font-size: 1.2em;
      color: #888;
    }
    
    .error {
      text-align: center;
      padding: 50px;
      font-size: 1.2em;
      color: #ff0000;
    }
    
    .no-flights {
      text-align: center;
      padding: 50px;
      font-size: 1.2em;
      color: #888;
    }
    
    .refresh-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #00ff00;
      color: #000;
      border: none;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 24px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
    }
    
    .refresh-btn:hover {
      background: #ffff00;
      transform: scale(1.1);
    }
    
    @media (max-width: 768px) {
      .controls {
        flex-direction: column;
        align-items: stretch;
      }
      
      .flight-header {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .flight-details {
        grid-template-columns: 1fr;
      }
      
      .render-controls {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Flight History</h1>
    <div class="subtitle">Last 24 Hours of Aircraft Activity</div>
  </div>
  
  <div class="controls">
    <div class="control-group">
      <label for="timeRange">Time Range</label>
      <select id="timeRange">
        <option value="1">Last Hour</option>
        <option value="6">Last 6 Hours</option>
        <option value="12">Last 12 Hours</option>
        <option value="24" selected>Last 24 Hours</option>
        <option value="48">Last 48 Hours</option>
      </select>
    </div>
    
    <div class="control-group">
      <label for="statusFilter">Status</label>
      <select id="statusFilter">
        <option value="all">All Flights</option>
        <option value="active">Active Only</option>
        <option value="completed">Completed Only</option>
        <option value="emergency">Emergency Only</option>
      </select>
    </div>
    
    <div class="control-group">
      <label for="callsignFilter">Callsign</label>
      <input type="text" id="callsignFilter" placeholder="Filter by callsign...">
    </div>
    
    <div class="control-group">
      <label for="registrationFilter">Registration</label>
      <input type="text" id="registrationFilter" placeholder="Filter by registration...">
    </div>
    
    <button class="btn" onclick="loadFlightHistory()">Load History</button>
    <button class="btn" onclick="exportData()">Export CSV</button>
  </div>
  
  <div class="stats" id="stats">
    <div class="stat-card">
      <div class="stat-value" id="totalFlights">-</div>
      <div class="stat-label">Total Flights</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="activeFlights">-</div>
      <div class="stat-label">Active Flights</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="emergencyFlights">-</div>
      <div class="stat-label">Emergency Flights</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="totalAircraft">-</div>
      <div class="stat-label">Unique Aircraft</div>
    </div>
  </div>
  
  <div class="flights-container" id="flightsContainer">
    <div class="loading">Loading flight history...</div>
  </div>
  
  <button class="refresh-btn" onclick="loadFlightHistory()" title="Refresh">↻</button>
  
  <!-- Leaflet JavaScript for maps -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  
  <script>
    let currentFlights = [];
    let flightMaps = new Map();
    
    // Load flight history on page load
    document.addEventListener('DOMContentLoaded', function() {
      loadFlightHistory();
      
      // Auto-refresh every 30 seconds
      setInterval(loadFlightHistory, 30000);
    });
    
    async function loadFlightHistory() {
      const timeRange = document.getElementById('timeRange').value;
      const statusFilter = document.getElementById('statusFilter').value;
      const callsignFilter = document.getElementById('callsignFilter').value;
      const registrationFilter = document.getElementById('registrationFilter').value;
      
      const container = document.getElementById('flightsContainer');
      container.innerHTML = '<div class="loading">Loading flight history...</div>';
      
      try {
        const response = await fetch('/history/api/flights?' + new URLSearchParams({
          hours: timeRange,
          status: statusFilter,
          callsign: callsignFilter,
          registration: registrationFilter
        }));
        
        if (!response.ok) {
          throw new Error('Failed to load flight history');
        }
        
        const data = await response.json();
        currentFlights = data.flights || [];
        
        updateStats(data.stats);
        renderFlights(currentFlights);
        
      } catch (error) {
        console.error('Error loading flight history:', error);
        container.innerHTML = '<div class="error">Failed to load flight history: ' + error.message + '</div>';
      }
    }
    
    function updateStats(stats) {
      document.getElementById('totalFlights').textContent = stats.totalFlights || 0;
      document.getElementById('activeFlights').textContent = stats.activeFlights || 0;
      document.getElementById('emergencyFlights').textContent = stats.emergencyFlights || 0;
      document.getElementById('totalAircraft').textContent = stats.uniqueAircraft || 0;
    }
    
    function renderFlights(flights) {
      const container = document.getElementById('flightsContainer');
      
      if (flights.length === 0) {
        container.innerHTML = '<div class="no-flights">No flights found for the selected criteria</div>';
        return;
      }
      
      container.innerHTML = flights.map(flight => createFlightCard(flight)).join('');
      
      // Initialize flight path maps
      flights.forEach(flight => {
        try {
          if (flight.flightPath && Array.isArray(flight.flightPath) && flight.flightPath.length > 0) {
            renderFlightPathMap(flight.icao24, flight.flightPath);
          } else if (flight.startPosition && flight.currentPosition) {
            // Create a simple path from start to current position
            const simplePath = [
              { lat: flight.startPosition.lat, lon: flight.startPosition.lon },
              { lat: flight.currentPosition.lat, lon: flight.currentPosition.lon }
            ];
            renderFlightPathMap(flight.icao24, simplePath);
          } else if (flight.startPosition && flight.endPosition) {
            // Create a simple path from start to end position
            const simplePath = [
              { lat: flight.startPosition.lat, lon: flight.startPosition.lon },
              { lat: flight.endPosition.lat, lon: flight.endPosition.lon }
            ];
            renderFlightPathMap(flight.icao24, simplePath);
          } else {
            // No position data available, render empty map
            renderFlightPathMap(flight.icao24, []);
          }
        } catch (error) {
          console.error('Error initializing flight path map for', flight.icao24, ':', error);
          // Render empty map as fallback
          renderFlightPathMap(flight.icao24, []);
        }
      });
    }
    
    function createFlightCard(flight) {
      try {
        // Validate flight object
        if (!flight || typeof flight !== 'object') {
          console.error('Invalid flight data:', flight);
          return '<div class="flight-card"><div class="error">Invalid flight data</div></div>';
        }
        
        const startTime = flight.startTime ? new Date(flight.startTime).toLocaleString() : 'Unknown';
        const endTime = flight.endTime ? new Date(flight.endTime).toLocaleString() : 'Active';
        const duration = flight.duration ? formatDuration(flight.duration) : 'Active';
        
        const alerts = [];
        if (flight.emergency) alerts.push('<span class="alert emergency">EMERGENCY</span>');
        if (flight.squawk === '7500') alerts.push('<span class="alert emergency">HIJACK</span>');
        if (flight.squawk === '7600') alerts.push('<span class="alert warning">COMM FAILURE</span>');
        if (flight.squawk === '7700') alerts.push('<span class="alert emergency">EMERGENCY</span>');
        
        const statusClass = flight.status === 'active' ? 'active' : 
                           flight.emergency ? 'emergency' : 'completed';
        
        return \`
          <div class="flight-card">
            <div class="flight-header">
              <div>
                <div class="flight-callsign">\${flight.callsign || 'Unknown'}</div>
                <div class="flight-registration">\${flight.registration || flight.icao24 || 'N/A'}</div>
              </div>
              <div class="flight-status \${statusClass}">\${(flight.status || 'unknown').toUpperCase()}</div>
            </div>
            
            <div class="flight-details">
              <div class="detail-section">
                <h3>Flight Information</h3>
                <div class="detail-row">
                  <span class="detail-label">ICAO24:</span>
                  <span class="detail-value">\${flight.icao24 || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Start Time:</span>
                  <span class="detail-value">\${startTime}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">End Time:</span>
                  <span class="detail-value">\${endTime}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Duration:</span>
                  <span class="detail-value">\${duration}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Squawk:</span>
                  <span class="detail-value \${flight.squawk === '7500' || flight.squawk === '7700' ? 'emergency' : ''}">\${flight.squawk || 'N/A'}</span>
                </div>
              </div>
              
              <div class="detail-section">
                <h3>Position Data</h3>
                <div class="detail-row">
                  <span class="detail-label">Start Position:</span>
                  <span class="detail-value">\${formatPosition(flight.startPosition)}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Current/End Position:</span>
                  <span class="detail-value">\${formatPosition(flight.currentPosition || flight.endPosition)}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Max Altitude:</span>
                  <span class="detail-value">\${flight.maxAltitude ? flight.maxAltitude + ' ft' : 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Max Speed:</span>
                  <span class="detail-value">\${flight.maxSpeed ? flight.maxSpeed + ' kts' : 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Distance:</span>
                  <span class="detail-value">\${flight.totalDistance ? flight.totalDistance.toFixed(1) + ' nm' : 'N/A'}</span>
                </div>
              </div>
              
              <div class="detail-section">
                <h3>Aircraft Information</h3>
                <div class="detail-row">
                  <span class="detail-label">Type:</span>
                  <span class="detail-value">\${flight.aircraftInfo?.type || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Operator:</span>
                  <span class="detail-value">\${flight.aircraftInfo?.operator || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Manufacturer:</span>
                  <span class="detail-value">\${flight.aircraftInfo?.manufacturer || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Model:</span>
                  <span class="detail-value">\${flight.aircraftInfo?.model || 'N/A'}</span>
                </div>
              </div>
              
              <div class="detail-section">
                <h3>Airspace Information</h3>
                \${flight.airspaceInfo && Array.isArray(flight.airspaceInfo) && flight.airspaceInfo.length > 0 ? 
                  flight.airspaceInfo.map(airspace => \`
                    <div class="detail-row">
                      <span class="detail-label">\${airspace.type || 'Unknown'}:</span>
                      <span class="detail-value">\${airspace.name || 'N/A'}</span>
                    </div>
                  \`).join('') : 
                  '<div class="detail-row"><span class="detail-label">No airspace data</span></div>'
                }
              </div>
              
              <div class="detail-section">
                <h3>Flight Path</h3>
                <div class="flight-path">
                  <div id="map-\${flight.icao24 || 'unknown'}" class="flight-path-map"></div>
                </div>
                <div class="render-controls">
                  <button class="btn render-video" onclick="renderFlightVideo('\${flight.icao24 || ''}', '\${flight.callsign || flight.icao24 || 'Unknown'}')">
                    🎬 Render Flight Video
                  </button>
                  <button class="btn render-video" onclick="renderFlightTimeline('\${flight.icao24 || ''}', '\${flight.callsign || flight.icao24 || 'Unknown'}')">
                    📊 Render Timeline
                  </button>
                </div>
                <div id="render-status-\${flight.icao24 || 'unknown'}" class="render-status" style="display: none;"></div>
              </div>
            </div>
            
            \${alerts.length > 0 ? \`
              <div style="padding: 0 20px 20px;">
                <div class="alerts">\${alerts.join('')}</div>
              </div>
            \` : ''}
          </div>
        \`;
      } catch (error) {
        console.error('Error creating flight card:', error, flight);
        return \`
          <div class="flight-card">
            <div class="error" style="padding: 20px; color: #ff0000; text-align: center;">
              Error displaying flight data for \${flight?.icao24 || 'Unknown'}
            </div>
          </div>
        \`;
      }
    }
    
    function renderFlightPathMap(icao24, flightPath) {
      const mapContainer = document.getElementById(\`map-\${icao24}\`);
      if (!mapContainer) return;
      
      // Destroy existing map if it exists
      if (flightMaps.has(icao24)) {
        flightMaps.get(icao24).remove();
      }
      
      // Validate flight path data
      if (!flightPath || !Array.isArray(flightPath) || flightPath.length === 0) {
        // Create a simple placeholder map if no flight path data
        const map = L.map(\`map-\${icao24}\`).setView([55.5, -4.5], 8);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Add a message overlay
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = \`
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.8);
          color: #00ff00;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          z-index: 1000;
          font-family: monospace;
        \`;
        messageDiv.innerHTML = 'No flight path data available';
        mapContainer.appendChild(messageDiv);
        
        flightMaps.set(icao24, map);
        return;
      }
      
      // Create new map
      const map = L.map(\`map-\${icao24}\`).setView([55.5, -4.5], 8);
      
      // Add tile layer (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      
      try {
        // Create flight path coordinates with validation
        const pathCoords = flightPath
          .filter(point => point && typeof point.lat === 'number' && typeof point.lon === 'number')
          .map(point => [point.lat, point.lon]);
        
        // Draw flight path if we have valid coordinates
        if (pathCoords.length > 1) {
          const pathLine = L.polyline(pathCoords, {
            color: '#00ff00',
            weight: 3,
            opacity: 0.8
          }).addTo(map);
          
          // Fit map to path bounds
          map.fitBounds(pathLine.getBounds(), { padding: [20, 20] });
        }
        
        // Add start and end markers if we have valid coordinates
        if (pathCoords.length > 0) {
          const startMarker = L.marker(pathCoords[0], {
            icon: L.divIcon({
              className: 'start-marker',
              html: '🟢',
              iconSize: [20, 20]
            })
          }).addTo(map);
          
          if (pathCoords.length > 1) {
            const endMarker = L.marker(pathCoords[pathCoords.length - 1], {
              icon: L.divIcon({
                className: 'end-marker',
                html: '🔴',
                iconSize: [20, 20]
              })
            }).addTo(map);
          }
        }
      } catch (error) {
        console.error('Error rendering flight path map:', error);
        // Add error message to map
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = \`
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 0, 0, 0.8);
          color: #fff;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          z-index: 1000;
          font-family: monospace;
        \`;
        errorDiv.innerHTML = 'Error rendering flight path';
        mapContainer.appendChild(errorDiv);
      }
      
      // Store map reference
      flightMaps.set(icao24, map);
    }
    
    async function renderFlightVideo(icao24, callsign) {
      const statusElement = document.getElementById(\`render-status-\${icao24}\`);
      const button = event.target;
      
      try {
        button.disabled = true;
        button.textContent = '🎬 Rendering...';
        statusElement.className = 'render-status rendering';
        statusElement.textContent = 'Rendering flight video...';
        statusElement.style.display = 'block';
        
        const response = await fetch('/history/api/render-flight-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            icao24: icao24,
            callsign: callsign,
            template: 'flight-path-enhanced'
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to start video render');
        }
        
        const result = await response.json();
        
        // Poll for render status
        pollRenderStatus(result.renderId, icao24);
        
      } catch (error) {
        console.error('Error rendering flight video:', error);
        statusElement.className = 'render-status error';
        statusElement.textContent = 'Error: ' + error.message;
        button.disabled = false;
        button.textContent = '🎬 Render Flight Video';
      }
    }
    
    async function renderFlightTimeline(icao24, callsign) {
      const statusElement = document.getElementById(\`render-status-\${icao24}\`);
      const button = event.target;
      
      try {
        button.disabled = true;
        button.textContent = '📊 Rendering...';
        statusElement.className = 'render-status rendering';
        statusElement.textContent = 'Rendering flight timeline...';
        statusElement.style.display = 'block';
        
        const response = await fetch('/history/api/render-flight-timeline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            icao24: icao24,
            callsign: callsign,
            template: 'event-timeline'
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to start timeline render');
        }
        
        const result = await response.json();
        
        // Poll for render status
        pollRenderStatus(result.renderId, icao24);
        
      } catch (error) {
        console.error('Error rendering flight timeline:', error);
        statusElement.className = 'render-status error';
        statusElement.textContent = 'Error: ' + error.message;
        button.disabled = false;
        button.textContent = '📊 Render Timeline';
      }
    }
    
    async function pollRenderStatus(renderId, icao24) {
      const statusElement = document.getElementById(\`render-status-\${icao24}\`);
      const button = event.target;
      
      try {
        const response = await fetch(\`/history/api/render-status/\${renderId}\`);
        const status = await response.json();
        
        if (status.status === 'completed') {
          statusElement.className = 'render-status completed';
          statusElement.textContent = \`Video completed! \${status.outputPath ? '<a href="' + status.outputPath + '" target="_blank">Download</a>' : ''}\`;
          button.disabled = false;
          button.textContent = button.textContent.includes('Flight Video') ? '🎬 Render Flight Video' : '📊 Render Timeline';
        } else if (status.status === 'failed') {
          statusElement.className = 'render-status error';
          statusElement.textContent = 'Render failed: ' + (status.error || 'Unknown error');
          button.disabled = false;
          button.textContent = button.textContent.includes('Flight Video') ? '🎬 Render Flight Video' : '📊 Render Timeline';
        } else {
          // Still rendering, poll again in 2 seconds
          setTimeout(() => pollRenderStatus(renderId, icao24), 2000);
        }
      } catch (error) {
        console.error('Error polling render status:', error);
        statusElement.className = 'render-status error';
        statusElement.textContent = 'Error checking render status: ' + error.message;
        button.disabled = false;
        button.textContent = button.textContent.includes('Flight Video') ? '🎬 Render Flight Video' : '📊 Render Timeline';
      }
    }
    
    function formatDuration(ms) {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((ms % (1000 * 60)) / 1000);
      
      if (hours > 0) {
        return \`\${hours}h \${minutes}m \${seconds}s\`;
      } else if (minutes > 0) {
        return \`\${minutes}m \${seconds}s\`;
      } else {
        return \`\${seconds}s\`;
      }
    }
    
    function formatPosition(pos) {
      if (!pos || typeof pos !== 'object' || pos.lat === null || pos.lat === undefined || pos.lon === null || pos.lon === undefined) {
        return 'N/A';
      }
      
      // Validate that lat and lon are numbers
      if (typeof pos.lat !== 'number' || typeof pos.lon !== 'number') {
        return 'N/A';
      }
      
      // Check for valid coordinate ranges
      if (pos.lat < -90 || pos.lat > 90 || pos.lon < -180 || pos.lon > 180) {
        return 'Invalid';
      }
      
      return \`\${pos.lat.toFixed(4)}, \${pos.lon.toFixed(4)}\`;
    }
    
    async function exportData() {
      if (currentFlights.length === 0) {
        alert('No flights to export');
        return;
      }
      
      try {
        const response = await fetch('/history/api/export?' + new URLSearchParams({
          hours: document.getElementById('timeRange').value,
          status: document.getElementById('statusFilter').value,
          callsign: document.getElementById('callsignFilter').value,
          registration: document.getElementById('registrationFilter').value
        }));
        
        if (!response.ok) {
          throw new Error('Failed to export data');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`flight_history_\${new Date().toISOString().split('T')[0]}.csv\`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
      } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data: ' + error.message);
      }
    }
  </script>
</body>
</html>`;

  res.send(html);
});

// API endpoint to get flight history
router.get('/api/flights', async (req, res) => {
  try {
    if (!connectorRegistry) {
      return res.status(500).json({ error: 'Connector Registry not initialized' });
    }
    
    const adsbConnector = connectorRegistry.getConnector('adsb-main');
    if (!adsbConnector) {
      return res.status(404).json({ error: 'ADSB Connector not found' });
    }
    
    const hours = parseInt(req.query.hours) || 24;
    const status = req.query.status || 'all';
    const callsign = req.query.callsign || '';
    const registration = req.query.registration || '';
    
    // Get active flights
    const activeFlights = adsbConnector.getActiveFlights();
    
    // Transform active flights to match expected structure
    const transformedActiveFlights = activeFlights.map(flight => ({
      icao24: flight.icao24,
      callsign: flight.callsign,
      registration: flight.registration,
      startTime: flight.startTime,
      endTime: flight.lastUpdate, // Use lastUpdate as endTime for active flights
      duration: flight.duration,
      status: 'active',
      startPosition: flight.startPosition ? {
        lat: flight.startPosition.lat,
        lon: flight.startPosition.lon
      } : null,
      endPosition: flight.currentPosition ? {
        lat: flight.currentPosition.lat,
        lon: flight.currentPosition.lon
      } : null,
      currentPosition: flight.currentPosition ? {
        lat: flight.currentPosition.lat,
        lon: flight.currentPosition.lon
      } : null,
      maxAltitude: flight.currentPosition?.altitude || null,
      maxSpeed: flight.currentPosition?.speed || null,
      totalDistance: null, // Will be calculated if needed
      emergency: flight.emergency || false,
      squawk: flight.squawk,
      airspaceInfo: flight.airspaceInfo || [],
      squawkInfo: flight.squawkInfo || null,
      aircraftInfo: flight.aircraftInfo || null,
      flightPath: flight.flightPath || null,
      alerts: flight.alerts || []
    }));
    
    // Get historical flights from aircraft data service
    let historicalFlights = [];
    if (aircraftDataService) {
      try {
        // Get all aircraft history for the specified hours
        const history = await aircraftDataService.getRecentEvents(hours, 'flight_started');
        historicalFlights = history.map(event => {
          try {
            const eventData = JSON.parse(event.event_data);
            return {
              icao24: event.icao24,
              callsign: eventData.callsign || null,
              registration: null, // Will be looked up from BaseStation if needed
              startTime: event.timestamp,
              endTime: eventData.endTime || null,
              duration: eventData.duration || null,
              status: eventData.endTime ? 'completed' : 'active', // Always set status
              startPosition: eventData.startPosition ? {
                lat: eventData.startPosition.lat,
                lon: eventData.startPosition.lon
              } : null,
              endPosition: eventData.endPosition ? {
                lat: eventData.endPosition.lat,
                lon: eventData.endPosition.lon
              } : null,
              currentPosition: eventData.endPosition ? {
                lat: eventData.endPosition.lat,
                lon: eventData.endPosition.lon
              } : null,
              maxAltitude: eventData.maxAltitude || null,
              maxSpeed: eventData.maxSpeed || null,
              totalDistance: eventData.totalDistance || null,
              emergency: eventData.emergency || false,
              squawk: eventData.startPosition?.squawk || null,
              airspaceInfo: [],
              squawkInfo: null,
              aircraftInfo: null,
              flightPath: null,
              alerts: []
            };
          } catch (parseError) {
            logger.warn('Failed to parse flight event data', { 
              icao24: event.icao24, 
              error: parseError.message 
            });
            return null;
          }
        }).filter(flight => flight !== null);
      } catch (error) {
        logger.warn('Failed to get historical flights from aircraft data service', { error: error.message });
      }
    }
    
    // Combine and filter flights
    let allFlights = [...transformedActiveFlights, ...historicalFlights];
    
    // Deduplicate flights by ICAO24, keeping the most recent one
    const flightMap = new Map();
    allFlights.forEach(flight => {
      const existing = flightMap.get(flight.icao24);
      if (!existing || new Date(flight.startTime) > new Date(existing.startTime)) {
        flightMap.set(flight.icao24, flight);
      }
    });
    allFlights = Array.from(flightMap.values());
    
    // Apply filters
    if (status !== 'all') {
      allFlights = allFlights.filter(flight => flight.status === status);
    }
    
    if (callsign) {
      allFlights = allFlights.filter(flight => 
        flight.callsign && flight.callsign.toLowerCase().includes(callsign.toLowerCase())
      );
    }
    
    if (registration) {
      allFlights = allFlights.filter(flight => 
        flight.registration && flight.registration.toLowerCase().includes(registration.toLowerCase())
      );
    }
    
    // Sort by start time (newest first)
    allFlights.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    
    // Calculate statistics
    const stats = {
      totalFlights: allFlights.length,
      activeFlights: allFlights.filter(f => f.status === 'active').length,
      emergencyFlights: allFlights.filter(f => f.emergency).length,
      uniqueAircraft: new Set(allFlights.map(f => f.icao24)).size
    };
    
    res.json({
      flights: allFlights,
      stats: stats
    });
    
  } catch (error) {
    logger.error('Error getting flight history', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get flight history' });
  }
});

// API endpoint to export flight data as CSV
router.get('/api/export', async (req, res) => {
  try {
    if (!connectorRegistry) {
      return res.status(500).json({ error: 'Connector Registry not initialized' });
    }
    
    const adsbConnector = connectorRegistry.getConnector('adsb-main');
    if (!adsbConnector) {
      return res.status(404).json({ error: 'ADSB Connector not found' });
    }
    
    const hours = parseInt(req.query.hours) || 24;
    const status = req.query.status || 'all';
    const callsign = req.query.callsign || '';
    const registration = req.query.registration || '';
    
    // Get flights (same logic as above)
    const activeFlights = adsbConnector.getActiveFlights();
    
    // Transform active flights to match expected structure
    const transformedActiveFlights = activeFlights.map(flight => ({
      icao24: flight.icao24,
      callsign: flight.callsign,
      registration: flight.registration,
      startTime: flight.startTime,
      endTime: flight.lastUpdate,
      duration: flight.duration,
      status: 'active',
      startPosition: flight.startPosition,
      endPosition: flight.currentPosition,
      currentPosition: flight.currentPosition,
      maxAltitude: flight.maxAltitude,
      maxSpeed: flight.maxSpeed,
      totalDistance: flight.totalDistance,
      squawk: flight.squawk,
      emergency: flight.emergency,
      airspaceInfo: flight.airspaceInfo || [],
      squawkInfo: flight.squawkInfo || null,
      aircraftInfo: flight.aircraftInfo || null,
      flightPath: flight.flightPath || null,
      alerts: flight.alerts || []
    }));
    
    // Get historical flights from aircraft data service
    let historicalFlights = [];
    if (aircraftDataService) {
      try {
        // Get all aircraft history for the specified hours
        const history = await aircraftDataService.getRecentEvents(hours, 'flight_started');
        historicalFlights = history.map(event => {
          try {
            const eventData = JSON.parse(event.event_data);
            return {
              icao24: event.icao24,
              callsign: eventData.callsign || null,
              registration: null, // Will be looked up from BaseStation if needed
              startTime: event.timestamp,
              endTime: eventData.endTime || null,
              duration: eventData.duration || null,
              status: eventData.endTime ? 'completed' : 'active',
              startPosition: eventData.startPosition || null,
              endPosition: eventData.endPosition || null,
              currentPosition: eventData.currentPosition || null,
              maxAltitude: eventData.maxAltitude || null,
              maxSpeed: eventData.maxSpeed || null,
              totalDistance: eventData.totalDistance || null,
              squawk: eventData.squawk || null,
              emergency: eventData.emergency || false,
              airspaceInfo: eventData.airspaceInfo || [],
              squawkInfo: eventData.squawkInfo || null,
              aircraftInfo: eventData.aircraftInfo || null,
              flightPath: eventData.flightPath || null,
              alerts: eventData.alerts || []
            };
          } catch (error) {
            logger.error('Error parsing historical flight data:', error);
            return null;
          }
        }).filter(Boolean);
      } catch (error) {
        logger.error('Error getting historical flights:', error);
      }
    }
    
    // Combine and deduplicate flights
    const allFlights = [...transformedActiveFlights, ...historicalFlights];
    const flightMap = new Map();
    
    allFlights.forEach(flight => {
      const key = flight.icao24;
      if (!flightMap.has(key) || flight.status === 'active') {
        flightMap.set(key, flight);
      }
    });
    
    const flights = Array.from(flightMap.values());
    
    // Filter flights based on criteria
    let filteredFlights = flights;
    
    if (status !== 'all') {
      filteredFlights = filteredFlights.filter(flight => flight.status === status);
    }
    
    if (callsign) {
      filteredFlights = filteredFlights.filter(flight => 
        flight.callsign && flight.callsign.toLowerCase().includes(callsign.toLowerCase())
      );
    }
    
    if (registration) {
      filteredFlights = filteredFlights.filter(flight => 
        flight.registration && flight.registration.toLowerCase().includes(registration.toLowerCase())
      );
    }
    
    // Generate CSV
    const csvHeaders = [
      'ICAO24', 'Callsign', 'Registration', 'Start Time', 'End Time', 'Duration (ms)',
      'Status', 'Start Lat', 'Start Lon', 'End Lat', 'End Lon', 'Max Altitude (ft)',
      'Max Speed (kts)', 'Total Distance (nm)', 'Squawk', 'Emergency'
    ];
    
    const csvRows = filteredFlights.map(flight => [
      flight.icao24,
      flight.callsign || '',
      flight.registration || '',
      flight.startTime,
      flight.endTime || '',
      flight.duration || '',
      flight.status || '',
      flight.startPosition?.lat || '',
      flight.startPosition?.lon || '',
      (flight.currentPosition || flight.endPosition)?.lat || '',
      (flight.currentPosition || flight.endPosition)?.lon || '',
      flight.maxAltitude || '',
      flight.maxSpeed || '',
      flight.totalDistance || '',
      flight.squawk || '',
      flight.emergency ? 'true' : 'false'
    ]);
    
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="flight_history_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
    
  } catch (error) {
    logger.error('Error exporting flight data:', error);
    res.status(500).json({ error: 'Failed to export flight data' });
  }
});

// API endpoint to render flight video using Remotion
router.post('/api/render-flight-video', async (req, res) => {
  try {
    if (!remotionConnector) {
      return res.status(500).json({ error: 'Remotion Connector not initialized' });
    }
    
    const { icao24, callsign, template = 'flight-path-enhanced' } = req.body;
    
    if (!icao24) {
      return res.status(400).json({ error: 'ICAO24 is required' });
    }
    
    // Get flight data
    let flightData = null;
    
    // Try to get from active flights first
    if (connectorRegistry) {
      const adsbConnector = connectorRegistry.getConnector('adsb-main');
      if (adsbConnector) {
        const activeFlights = adsbConnector.getActiveFlights();
        flightData = activeFlights.find(f => f.icao24 === icao24);
      }
    }
    
    // If not found in active flights, try historical data
    if (!flightData && aircraftDataService) {
      try {
        const history = await aircraftDataService.getRecentEvents(24, 'flight_started');
        const historicalFlight = history.find(event => event.icao24 === icao24);
        if (historicalFlight) {
          const eventData = JSON.parse(historicalFlight.event_data);
          flightData = {
            icao24: historicalFlight.icao24,
            callsign: eventData.callsign,
            startTime: historicalFlight.timestamp,
            endTime: eventData.endTime,
            flightPath: eventData.flightPath,
            startPosition: eventData.startPosition,
            endPosition: eventData.endPosition,
            ...eventData
          };
        }
      } catch (error) {
        logger.error('Error getting historical flight data:', error);
      }
    }
    
    if (!flightData) {
      return res.status(404).json({ error: 'Flight not found' });
    }
    
    // Create video render job
    const renderId = await remotionConnector.createFlightVideo({
      callsign: callsign || flightData.callsign || icao24,
      registration: flightData.registration,
      startTime: flightData.startTime,
      endTime: flightData.endTime,
      flightPath: flightData.flightPath,
      startPosition: flightData.startPosition,
      endPosition: flightData.endPosition,
      template: template,
      outputPath: `./renders/flight-${icao24}-${Date.now()}.mp4`,
      quality: 'high',
      fps: 30,
      duration: 15
    });
    
    res.json({ 
      renderId: renderId.renderId,
      message: 'Flight video render started',
      flightData: {
        icao24,
        callsign: flightData.callsign,
        startTime: flightData.startTime,
        endTime: flightData.endTime
      }
    });
    
  } catch (error) {
    logger.error('Error starting flight video render:', error);
    res.status(500).json({ error: 'Failed to start video render: ' + error.message });
  }
});

// API endpoint to render flight timeline using Remotion
router.post('/api/render-flight-timeline', async (req, res) => {
  try {
    if (!remotionConnector) {
      return res.status(500).json({ error: 'Remotion Connector not initialized' });
    }
    
    const { icao24, callsign, template = 'event-timeline' } = req.body;
    
    if (!icao24) {
      return res.status(400).json({ error: 'ICAO24 is required' });
    }
    
    // Get flight data and related events
    let flightData = null;
    let relatedEvents = [];
    
    // Try to get from active flights first
    if (connectorRegistry) {
      const adsbConnector = connectorRegistry.getConnector('adsb-main');
      if (adsbConnector) {
        const activeFlights = adsbConnector.getActiveFlights();
        flightData = activeFlights.find(f => f.icao24 === icao24);
      }
    }
    
    // If not found in active flights, try historical data
    if (!flightData && aircraftDataService) {
      try {
        const history = await aircraftDataService.getRecentEvents(24, 'flight_started');
        const historicalFlight = history.find(event => event.icao24 === icao24);
        if (historicalFlight) {
          const eventData = JSON.parse(historicalFlight.event_data);
          flightData = {
            icao24: historicalFlight.icao24,
            callsign: eventData.callsign,
            startTime: historicalFlight.timestamp,
            endTime: eventData.endTime,
            ...eventData
          };
        }
      } catch (error) {
        logger.error('Error getting historical flight data:', error);
      }
    }
    
    if (!flightData) {
      return res.status(404).json({ error: 'Flight not found' });
    }
    
    // Get related events for this aircraft
    if (aircraftDataService) {
      try {
        const events = await aircraftDataService.getRecentEvents(24);
        relatedEvents = events.filter(event => event.icao24 === icao24);
      } catch (error) {
        logger.error('Error getting related events:', error);
      }
    }
    
    // Create timeline render job
    const renderId = await remotionConnector.createEventTimeline({
      eventTypes: ['flight_started', 'airspace:entry', 'airspace:exit', 'speed:alert'],
      startTime: flightData.startTime,
      endTime: flightData.endTime || new Date().toISOString(),
      aircraftFilter: icao24,
      template: template,
      outputPath: `./renders/timeline-${icao24}-${Date.now()}.mp4`,
      quality: 'high',
      fps: 30,
      duration: 20
    });
    
    res.json({ 
      renderId: renderId.renderId,
      message: 'Flight timeline render started',
      flightData: {
        icao24,
        callsign: flightData.callsign,
        startTime: flightData.startTime,
        endTime: flightData.endTime,
        eventCount: relatedEvents.length
      }
    });
    
  } catch (error) {
    logger.error('Error starting flight timeline render:', error);
    res.status(500).json({ error: 'Failed to start timeline render: ' + error.message });
  }
});

// API endpoint to check render status
router.get('/api/render-status/:renderId', async (req, res) => {
  try {
    if (!remotionConnector) {
      return res.status(500).json({ error: 'Remotion Connector not initialized' });
    }
    
    const { renderId } = req.params;
    
    const status = await remotionConnector.getRenderStatus(renderId);
    
    res.json(status);
    
  } catch (error) {
    logger.error('Error checking render status:', error);
    res.status(500).json({ error: 'Failed to check render status: ' + error.message });
  }
});

// API endpoint to cancel render
router.post('/api/cancel-render/:renderId', async (req, res) => {
  try {
    if (!remotionConnector) {
      return res.status(500).json({ error: 'Remotion Connector not initialized' });
    }
    
    const { renderId } = req.params;
    
    await remotionConnector.cancelRender({ renderId });
    
    res.json({ message: 'Render cancelled successfully' });
    
  } catch (error) {
    logger.error('Error cancelling render:', error);
    res.status(500).json({ error: 'Failed to cancel render: ' + error.message });
  }
});

// API endpoint to list active renders
router.get('/api/active-renders', async (req, res) => {
  try {
    if (!remotionConnector) {
      return res.status(500).json({ error: 'Remotion Connector not initialized' });
    }
    
    const activeRenders = remotionConnector.listActiveRenders();
    
    res.json({ activeRenders });
    
  } catch (error) {
    logger.error('Error listing active renders:', error);
    res.status(500).json({ error: 'Failed to list active renders: ' + error.message });
  }
});

module.exports = { router, injectServices }; 