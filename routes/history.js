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
let adsbConnector, connectorRegistry, aircraftDataService, airspaceService, squawkCodeService;

// Middleware to inject services
function injectServices(services) {
  adsbConnector = services.adsbConnector;
  connectorRegistry = services.connectorRegistry;
  aircraftDataService = services.aircraftDataService;
  airspaceService = services.airspaceService;
  squawkCodeService = services.squawkCodeService;
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
      height: 200px;
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(0,255,0,0.3);
      border-radius: 6px;
      position: relative;
      overflow: hidden;
    }
    
    .flight-path canvas {
      width: 100%;
      height: 100%;
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
  
  <script>
    let currentFlights = [];
    
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
      
      // Initialize flight path canvases
      flights.forEach(flight => {
        if (flight.flightPath && flight.flightPath.length > 0) {
          renderFlightPath(flight.icao24, flight.flightPath);
        }
      });
    }
    
    function createFlightCard(flight) {
      const startTime = new Date(flight.startTime).toLocaleString();
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
              <div class="flight-registration">\${flight.registration || flight.icao24}</div>
            </div>
            <div class="flight-status \${statusClass}">\${flight.status.toUpperCase()}</div>
          </div>
          
          <div class="flight-details">
            <div class="detail-section">
              <h3>Flight Information</h3>
              <div class="detail-row">
                <span class="detail-label">ICAO24:</span>
                <span class="detail-value">\${flight.icao24}</span>
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
              \${flight.airspaceInfo && flight.airspaceInfo.length > 0 ? 
                flight.airspaceInfo.map(airspace => \`
                  <div class="detail-row">
                    <span class="detail-label">\${airspace.type}:</span>
                    <span class="detail-value">\${airspace.name}</span>
                  </div>
                \`).join('') : 
                '<div class="detail-row"><span class="detail-label">No airspace data</span></div>'
              }
            </div>
            
            <div class="detail-section">
              <h3>Flight Path</h3>
              <div class="flight-path">
                <canvas id="path-\${flight.icao24}" width="400" height="200"></canvas>
              </div>
            </div>
          </div>
          
          \${alerts.length > 0 ? \`
            <div style="padding: 0 20px 20px;">
              <div class="alerts">\${alerts.join('')}</div>
            </div>
          \` : ''}
        </div>
      \`;
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
      if (!pos || !pos.lat || !pos.lon) return 'N/A';
      return \`\${pos.lat.toFixed(4)}, \${pos.lon.toFixed(4)}\`;
    }
    
    function renderFlightPath(icao24, flightPath) {
      const canvas = document.getElementById(\`path-\${icao24}\`);
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      if (flightPath.length < 2) return;
      
      // Find bounds
      let minLat = Math.min(...flightPath.map(p => p.lat));
      let maxLat = Math.max(...flightPath.map(p => p.lat));
      let minLon = Math.min(...flightPath.map(p => p.lon));
      let maxLon = Math.max(...flightPath.map(p => p.lon));
      
      // Add padding
      const latPadding = (maxLat - minLat) * 0.1;
      const lonPadding = (maxLon - minLon) * 0.1;
      minLat -= latPadding;
      maxLat += latPadding;
      minLon -= lonPadding;
      maxLon += lonPadding;
      
      // Draw flight path
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      flightPath.forEach((point, index) => {
        const x = ((point.lon - minLon) / (maxLon - minLon)) * width;
        const y = height - ((point.lat - minLat) / (maxLat - minLat)) * height;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Draw start and end points
      if (flightPath.length > 0) {
        const start = flightPath[0];
        const end = flightPath[flightPath.length - 1];
        
        const startX = ((start.lon - minLon) / (maxLon - minLon)) * width;
        const startY = height - ((start.lat - minLat) / (maxLat - minLat)) * height;
        const endX = ((end.lon - minLon) / (maxLon - minLon)) * width;
        const endY = height - ((end.lat - minLat) / (maxLat - minLat)) * height;
        
        // Start point (green)
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(startX, startY, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // End point (red)
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(endX, endY, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
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
    
    // Get historical flights from aircraft data service
    let historicalFlights = [];
    if (aircraftDataService) {
      try {
        const history = await aircraftDataService.getAircraftHistory(null, hours);
        historicalFlights = history.map(flight => ({
          icao24: flight.icao24,
          callsign: flight.callsign,
          registration: flight.registration,
          startTime: flight.start_time,
          endTime: flight.end_time,
          duration: flight.end_time ? new Date(flight.end_time) - new Date(flight.start_time) : null,
          status: flight.status,
          startPosition: {
            lat: flight.start_lat,
            lon: flight.start_lon
          },
          endPosition: {
            lat: flight.end_lat,
            lon: flight.end_lon
          },
          maxAltitude: flight.max_altitude,
          maxSpeed: flight.max_speed,
          totalDistance: flight.total_distance,
          emergency: false,
          squawk: null
        }));
      } catch (error) {
        logger.warn('Failed to get historical flights from aircraft data service', { error: error.message });
      }
    }
    
    // Combine and filter flights
    let allFlights = [...activeFlights, ...historicalFlights];
    
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
    
    let historicalFlights = [];
    if (aircraftDataService) {
      try {
        const history = await aircraftDataService.getAircraftHistory(null, hours);
        historicalFlights = history.map(flight => ({
          icao24: flight.icao24,
          callsign: flight.callsign,
          registration: flight.registration,
          startTime: flight.start_time,
          endTime: flight.end_time,
          duration: flight.end_time ? new Date(flight.end_time) - new Date(flight.start_time) : null,
          status: flight.status,
          startPosition: {
            lat: flight.start_lat,
            lon: flight.start_lon
          },
          endPosition: {
            lat: flight.end_lat,
            lon: flight.end_lon
          },
          maxAltitude: flight.max_altitude,
          maxSpeed: flight.max_speed,
          totalDistance: flight.total_distance,
          emergency: false,
          squawk: null
        }));
      } catch (error) {
        logger.warn('Failed to get historical flights for export', { error: error.message });
      }
    }
    
    let allFlights = [...activeFlights, ...historicalFlights];
    
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
    
    // Generate CSV
    const csvHeaders = [
      'ICAO24', 'Callsign', 'Registration', 'Start Time', 'End Time', 'Duration (ms)',
      'Status', 'Start Lat', 'Start Lon', 'End Lat', 'End Lon',
      'Max Altitude', 'Max Speed', 'Total Distance', 'Emergency', 'Squawk'
    ];
    
    const csvRows = allFlights.map(flight => [
      flight.icao24,
      flight.callsign || '',
      flight.registration || '',
      flight.startTime,
      flight.endTime || '',
      flight.duration || '',
      flight.status,
      flight.startPosition?.lat || '',
      flight.startPosition?.lon || '',
      flight.endPosition?.lat || '',
      flight.endPosition?.lon || '',
      flight.maxAltitude || '',
      flight.maxSpeed || '',
      flight.totalDistance || '',
      flight.emergency ? 'true' : 'false',
      flight.squawk || ''
    ]);
    
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="flight_history_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
    
  } catch (error) {
    logger.error('Error exporting flight data', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to export flight data' });
  }
});

module.exports = { router, injectServices }; 