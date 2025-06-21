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
  defaultMeta: { service: 'radar-routes' },
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
let radarConnector, adsbConnector, connectorRegistry, airportVectorService, airspaceService, vectorOptimizationService;

// Middleware to inject services
function injectServices(services) {
  radarConnector = services.radarConnector;
  adsbConnector = services.adsbConnector;
  connectorRegistry = services.connectorRegistry;
  airportVectorService = services.airportVectorService;
  airspaceService = services.airspaceService;
  vectorOptimizationService = services.vectorOptimizationService;
}

// Main radar interface
router.get('/', (req, res) => {
  if (!connectorRegistry) {
    return res.status(500).send('Connector Registry not initialized');
  }
  
  const radarConnector = connectorRegistry.getConnector('radar-main');
  const adsbConnector = connectorRegistry.getConnector('adsb-main');
  
  if (!radarConnector) {
    return res.status(404).send('Radar Connector not found');
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Radar Scope - Looking Glass</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #00ff00;
      overflow: hidden;
      height: 100vh;
    }
    
    .radar-container {
      position: relative;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle, #001100 0%, #000000 100%);
    }
    
    .radar-scope {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80vmin;
      height: 80vmin;
      border: 2px solid #00ff00;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0,255,0,0.1) 0%, transparent 70%);
    }
    
    .radar-sweep {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 50%;
      height: 2px;
      background: linear-gradient(90deg, #00ff00 0%, transparent 100%);
      transform-origin: left center;
      animation: sweep 4s linear infinite;
    }
    
    @keyframes sweep {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .radar-rings {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
    }
    
    .radar-ring {
      position: absolute;
      border: 1px solid rgba(0,255,0,0.3);
      border-radius: 50%;
    }
    
    .radar-ring:nth-child(1) { width: 20%; height: 20%; top: 40%; left: 40%; }
    .radar-ring:nth-child(2) { width: 40%; height: 40%; top: 30%; left: 30%; }
    .radar-ring:nth-child(3) { width: 60%; height: 60%; top: 20%; left: 20%; }
    .radar-ring:nth-child(4) { width: 80%; height: 80%; top: 10%; left: 10%; }
    
    .aircraft {
      position: absolute;
      width: 8px;
      height: 8px;
      background: #00ff00;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: all 0.5s ease;
    }
    
    .aircraft.emergency {
      background: #ff0000;
      animation: blink 1s infinite;
    }
    
    .aircraft.highlighted {
      background: #ffff00;
      box-shadow: 0 0 10px #ffff00;
    }
    
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0.3; }
    }
    
    .aircraft-trail {
      position: absolute;
      width: 2px;
      height: 2px;
      background: rgba(0,255,0,0.6);
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }
    
    .aircraft-label {
      position: absolute;
      font-size: 10px;
      color: #00ff00;
      white-space: nowrap;
      transform: translate(10px, -5px);
      text-shadow: 1px 1px 2px #000;
    }
    
    .zone {
      position: absolute;
      border: 2px solid;
      border-radius: 50%;
      opacity: 0.3;
      pointer-events: none;
    }
    
    .zone.parking { border-color: #FFD700; background: rgba(255,215,0,0.1); }
    .zone.taxiway { border-color: #FFA500; background: rgba(255,165,0,0.1); }
    .zone.runway { border-color: #FF0000; background: rgba(255,0,0,0.1); }
    .zone.approach { border-color: #00FF00; background: rgba(0,255,0,0.1); }
    .zone.departure { border-color: #0000FF; background: rgba(0,0,255,0.1); }
    .zone.emergency { border-color: #FF00FF; background: rgba(255,0,255,0.1); }
    .zone.custom { border-color: #808080; background: rgba(128,128,128,0.1); }
    
    .controls {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0,0,0,0.8);
      border: 1px solid #00ff00;
      border-radius: 8px;
      padding: 15px;
      color: #00ff00;
      font-size: 12px;
      z-index: 1000;
    }
    
    .control-group {
      margin-bottom: 10px;
    }
    
    .control-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    
    .control-group input, .control-group select {
      width: 100%;
      padding: 5px;
      background: #000;
      border: 1px solid #00ff00;
      color: #00ff00;
      border-radius: 4px;
    }
    
    .control-group input[type="checkbox"] {
      width: auto;
      margin-right: 5px;
    }
    
    .info-panel {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      border: 1px solid #00ff00;
      border-radius: 8px;
      padding: 15px;
      color: #00ff00;
      font-size: 12px;
      z-index: 1000;
      min-width: 200px;
    }
    
    .info-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    
    .info-label {
      font-weight: bold;
    }
    
    .info-value {
      color: #ffff00;
    }
    
    .zone-panel {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: rgba(0,0,0,0.8);
      border: 1px solid #00ff00;
      border-radius: 8px;
      padding: 15px;
      color: #00ff00;
      font-size: 12px;
      z-index: 1000;
      max-width: 300px;
    }
    
    .zone-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
      padding: 5px;
      border: 1px solid rgba(0,255,0,0.3);
      border-radius: 4px;
    }
    
    .zone-name {
      flex: 1;
    }
    
    .zone-status {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
    }
    
    .status-active { background: #00ff00; color: #000; }
    .status-inactive { background: #ff0000; color: #fff; }
    
    .btn {
      background: #000;
      border: 1px solid #00ff00;
      color: #00ff00;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      margin: 2px;
    }
    
    .btn:hover {
      background: #00ff00;
      color: #000;
    }
    
    .btn.danger {
      border-color: #ff0000;
      color: #ff0000;
    }
    
    .btn.danger:hover {
      background: #ff0000;
      color: #fff;
    }
    
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 2000;
    }
    
    .modal-content {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #000;
      border: 2px solid #00ff00;
      border-radius: 8px;
      padding: 20px;
      color: #00ff00;
      min-width: 400px;
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #00ff00;
    }
    
    .close {
      font-size: 20px;
      cursor: pointer;
      color: #00ff00;
    }
    
    .form-group {
      margin-bottom: 15px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    
    .form-group input, .form-group select, .form-group textarea {
      width: 100%;
      padding: 8px;
      background: #000;
      border: 1px solid #00ff00;
      color: #00ff00;
      border-radius: 4px;
    }
    
    .form-group textarea {
      height: 80px;
      resize: vertical;
    }
    
    .alert {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #000;
      border: 2px solid #ff0000;
      color: #ff0000;
      padding: 20px;
      border-radius: 8px;
      z-index: 3000;
      display: none;
    }
    
    .aircraft-sidebar {
      position: absolute;
      top: 220px;
      right: 20px;
      width: 340px;
      max-height: 60vh;
      overflow-y: auto;
      background: rgba(0,0,0,0.85);
      border: 1px solid #00ff00;
      border-radius: 8px;
      padding: 10px 10px 10px 10px;
      color: #00ff00;
      font-size: 12px;
      z-index: 1000;
    }
    .aircraft-sidebar table {
      width: 100%;
      border-collapse: collapse;
      color: #00ff00;
      font-size: 11px;
    }
    .aircraft-sidebar th, .aircraft-sidebar td {
      border: 1px solid #00ff00;
      padding: 2px 4px;
      text-align: center;
    }
    .aircraft-sidebar th {
      background: #003300;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .aircraft-sidebar tr:nth-child(even) {
      background: #001a00;
    }
    .aircraft-sidebar tr.no-pos {
      color: #888;
      background: #111;
    }
  </style>
</head>
<body>
  <div class="radar-container">
    <div class="radar-scope">
      <div class="radar-sweep"></div>
      <div class="radar-rings">
        <div class="radar-ring"></div>
        <div class="radar-ring"></div>
        <div class="radar-ring"></div>
        <div class="radar-ring"></div>
      </div>
      <div id="airport-map-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
      <div id="aircraft-container"></div>
    </div>
    
    <div class="controls">
      <h3>Radar Controls</h3>
      
      <div class="control-group">
        <label>Range (nm):</label>
        <div style="display: flex; align-items: center;">
          <input type="number" id="range-input" value="0.5" min="0.1" max="200" step="0.1" style="flex: 1;">
          <button class="btn" onclick="zoomOut()" style="margin-left: 5px;">+</button>
          <button class="btn" onclick="zoomIn()">-</button>
        </div>
      </div>
      
      <div class="control-group">
        <label>Center Latitude:</label>
        <input type="number" id="center-lat" value="55.5074" step="0.0001">
      </div>
      
      <div class="control-group">
        <label>Center Longitude:</label>
        <input type="number" id="center-lon" value="-4.5933" step="0.0001">
      </div>
      
      <div class="control-group">
        <label>Display Mode:</label>
        <select id="display-mode">
          <option value="all">All Aircraft</option>
          <option value="filtered">Filtered</option>
          <option value="emergency">Emergency Only</option>
        </select>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="show-trails" checked>
          Show Trails
        </label>
      </div>
      
      <div class="control-group">
        <label>Trail Length:</label>
        <input type="number" id="trail-length" value="10" min="1" max="50" step="1">
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="show-buildings" checked>
          Show Buildings
        </label>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="show-markings" checked>
          Show Markings
        </label>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="show-layout" checked>
          Show Layout
        </label>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="show-coastline" checked>
          Show Coastline
        </label>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="show-airspace" checked>
          Show Airspace
        </label>
      </div>
      
      <div class="control-group">
        <label>Airspace Types:</label>
        <div style="font-size: 10px; margin-top: 5px;">
          <label><input type="checkbox" id="airspace-ctr" checked> CTR</label>
          <label><input type="checkbox" id="airspace-cta" checked> CTA</label>
          <label><input type="checkbox" id="airspace-tma" checked> TMA</label>
          <label><input type="checkbox" id="airspace-atz" checked> ATZ</label>
          <label><input type="checkbox" id="airspace-fa" checked> FA</label>
          <label><input type="checkbox" id="airspace-da" checked> DA</label>
        </div>
      </div>
      
      <div class="control-group">
        <label>
          <input type="checkbox" id="optimize-airspace" checked>
          Optimize Polygons
        </label>
      </div>
      
      <button class="btn" onclick="applyRadarConfig()">Apply Config</button>
      <button class="btn" onclick="loadAirportVectors()">Load Airport</button>
      <button class="btn" onclick="loadAirspaceData()">Load Airspace</button>
    </div>
    
    <div class="info-panel">
      <h3>Radar Info</h3>
      <div class="info-item">
        <span class="info-label">Aircraft:</span>
        <span class="info-value" id="aircraft-count">0</span>
      </div>
      <div class="info-item">
        <span class="info-label">Active Flights:</span>
        <span class="info-value" id="active-flights-count">0</span>
      </div>
      <div class="info-item">
        <span class="info-label">Total Flights:</span>
        <span class="info-value" id="total-flights-count">0</span>
      </div>
      <div class="info-item">
        <span class="info-label">Airspaces:</span>
        <span class="info-value" id="airspace-count">0</span>
      </div>
      <div class="info-item">
        <span class="info-label">Zones:</span>
        <span class="info-value" id="zone-count">0</span>
      </div>
      <div class="info-item">
        <span class="info-label">Range:</span>
        <span class="info-value" id="current-range">0.5 nm</span>
      </div>
      <div class="info-item">
        <span class="info-label">Center:</span>
        <span class="info-value" id="center-coords">51.5074, -0.1278</span>
      </div>
      <div class="info-item">
        <span class="info-label">Last Update:</span>
        <span class="info-value" id="last-update">-</span>
      </div>
      <div class="info-item">
        <span class="info-label">Connection:</span>
        <span class="info-value" id="connection-status">Disconnected</span>
      </div>
    </div>
    
    <!-- Enhanced Aircraft Sidebar with Augmented Data -->
    <div class="aircraft-sidebar">
      <h3>Aircraft & Flight Data</h3>
      <div style="overflow-x:auto;">
        <table id="aircraft-table">
          <thead>
            <tr>
              <th>Callsign</th>
              <th>ICAO24</th>
              <th>Alt</th>
              <th>Speed</th>
              <th>Track</th>
              <th>Status</th>
              <th>Airspace</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      
      <!-- Flight Details Panel -->
      <div id="flight-details" style="margin-top: 10px; padding: 10px; border: 1px solid #00ff00; border-radius: 4px; display: none;">
        <h4>Flight Details</h4>
        <div id="flight-info"></div>
      </div>
    </div>
    
    <div class="zone-panel">
      <h3>Zones</h3>
      <div id="zone-list"></div>
    </div>
  </div>
  
  <!-- Add Zone Modal -->
  <div id="zone-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add Zone</h3>
        <span class="close" onclick="closeModal()">&times;</span>
      </div>
      <form id="zone-form">
        <div class="form-group">
          <label>Zone ID:</label>
          <input type="text" id="zone-id" required>
        </div>
        <div class="form-group">
          <label>Name:</label>
          <input type="text" id="zone-name" required>
        </div>
        <div class="form-group">
          <label>Type:</label>
          <select id="zone-type" required>
            <option value="parking">Parking</option>
            <option value="taxiway">Taxiway</option>
            <option value="runway">Runway</option>
            <option value="approach">Approach</option>
            <option value="departure">Departure</option>
            <option value="emergency">Emergency</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div class="form-group">
          <label>Coordinates (JSON):</label>
          <textarea id="zone-coordinates" placeholder='[{"lat": 51.5074, "lon": -0.1278}, {"lat": 51.5074, "lon": -0.1178}]' required></textarea>
        </div>
        <div class="form-group">
          <label>Color:</label>
          <input type="color" id="zone-color" value="#FF0000">
        </div>
        <div class="form-group">
          <label>Priority:</label>
          <select id="zone-priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <button type="submit" class="btn">Create Zone</button>
        <button type="button" class="btn danger" onclick="closeModal()">Cancel</button>
      </form>
    </div>
  </div>
  
  <!-- Alert Modal -->
  <div id="alert-modal" class="alert">
    <h3>Alert</h3>
    <p id="alert-message"></p>
    <button class="btn" onclick="closeAlert()">OK</button>
  </div>
  
  <script>
    let radarData = {
      aircraft: [],
      zones: [],
      config: {
        range: 0.5,
        center: { lat: 55.5074, lon: -4.5933 }
      }
    };
    let airportVectorData = null;
    let airspaceData = null;
    let airspaceEvents = [];

    // Initialize radar
    async function initRadar() {
      try {
        await loadRadarData();
        setInterval(loadRadarData, 5000); // Periodically refresh data
        renderRadar();
      } catch (error) {
        showAlert('Failed to initialize radar: ' + error.message);
      }
    }

    // Load radar data from API
    async function loadRadarData() {
      try {
        const response = await fetch('/radar/api/display');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Preserve existing config if new data doesn't have it
            const newData = result.data;
            if (!newData.config && radarData.config) {
              newData.config = radarData.config;
            }
            // Ensure config has required properties
            if (newData.config) {
              if (!newData.config.range) newData.config.range = radarData.config?.range || 0.5;
              if (!newData.config.center) newData.config.center = radarData.config?.center || { lat: 55.5074, lon: -4.5933 };
            } else {
              newData.config = {
                range: radarData.config?.range || 0.5,
                center: radarData.config?.center || { lat: 55.5074, lon: -4.5933 }
              };
            }
            radarData = newData;
            renderRadar();
            updateInfoPanel();
          } else {
            console.error('Invalid radar data response:', result);
          }
        }
      } catch (error) {
        console.error('Failed to load radar data:', error);
      }
    }

    // Render radar display
    function renderRadar() {
      renderAircraft();
      renderAirportVectors();
      renderCoastline();
      renderAirspace();
      renderAircraftSidebar();
    }

    // Render aircraft
    function renderAircraft() {
      const container = document.getElementById('aircraft-container');
      // Clear only aircraft and trails, not the entire container
      container.querySelectorAll('.aircraft, .aircraft-trail').forEach(el => el.remove());

      if (!radarData.aircraft) return;

      let positionedAircraft = 0;
      let nonPositionedAircraft = 0;

      radarData.aircraft.forEach(aircraft => {
        if (!aircraft.lat || !aircraft.lon) {
          nonPositionedAircraft++;
          return; // Skip rendering aircraft without position for now
        }

        positionedAircraft++;
        const position = latLonToRadarPosition(aircraft.lat, aircraft.lon);
        
        // Create aircraft element
        const aircraftEl = document.createElement('div');
        aircraftEl.className = 'aircraft';
        aircraftEl.style.left = position.x + '%';
        aircraftEl.style.top = position.y + '%';
        
        if (aircraft.emergency) {
          aircraftEl.classList.add('emergency');
        }
        
        // Add label
        const label = document.createElement('div');
        label.className = 'aircraft-label';
        label.textContent = aircraft.callsign || aircraft.icao24;
        aircraftEl.appendChild(label);
        
        // Add trail
        const showTrails = document.getElementById('show-trails').checked;
        if (showTrails && aircraft.trail) {
          aircraft.trail.forEach(point => {
            if(!point.lat || !point.lon) return;
            const trailPos = latLonToRadarPosition(point.lat, point.lon);
            const trailEl = document.createElement('div');
            trailEl.className = 'aircraft-trail';
            trailEl.style.left = trailPos.x + '%';
            trailEl.style.top = trailPos.y + '%';
            container.appendChild(trailEl);
          });
        }
        
        container.appendChild(aircraftEl);
      });

      // Update aircraft count to show both positioned and non-positioned
      const totalAircraft = positionedAircraft + nonPositionedAircraft;
      if (totalAircraft > 0) {
        let countText = positionedAircraft.toString();
        if (nonPositionedAircraft > 0) {
          countText += '+' + nonPositionedAircraft;
        }
        document.getElementById('aircraft-count').textContent = countText;
      }
    }
    
    // Update info panel
    function updateInfoPanel() {
      // Don't override aircraft count - it's set in renderAircraft()
      // document.getElementById('aircraft-count').textContent = radarData.aircraft ? radarData.aircraft.length : 0;
      document.getElementById('zone-count').textContent = radarData.zones ? radarData.zones.length : 0;
      
      // Add safety checks for config object
      if (radarData.config && radarData.config.range !== undefined) {
        document.getElementById('current-range').textContent = radarData.config.range + ' nm';
      } else {
        document.getElementById('current-range').textContent = '0.5 nm';
      }
      
      if (radarData.config && radarData.config.center && radarData.config.center.lat !== undefined && radarData.config.center.lon !== undefined) {
        document.getElementById('center-coords').textContent = 
          radarData.config.center.lat.toFixed(4) + ', ' + radarData.config.center.lon.toFixed(4);
      } else {
        document.getElementById('center-coords').textContent = '55.5074, -4.5933';
      }
      
      document.getElementById('last-update').textContent = 
        new Date().toLocaleTimeString();
    }
    
    // Show alert
    function showAlert(message) {
      document.getElementById('alert-message').textContent = message;
      document.getElementById('alert-modal').style.display = 'block';
    }
    
    // Close alert
    function closeAlert() {
      document.getElementById('alert-modal').style.display = 'none';
    }
    
    // Load airport vector data
    async function loadAirportVectors() {
      try {
        const response = await fetch('/radar/api/airport-vectors');
        const result = await response.json();
        
        if (result.success) {
          airportVectorData = result.data;
          renderAirportVectors();
          // showAlert('Airport vectors loaded successfully');
        } else {
          showAlert('Failed to load airport vectors: ' + result.error);
        }
      } catch (error) {
        showAlert('Failed to load airport vectors: ' + error.message);
      }
    }
    
    // Load airspace data
    async function loadAirspaceData() {
      console.log('loadAirspaceData called');
      try {
        // Add safety checks for config object
        if (!radarData.config) {
          console.log('loadAirspaceData: Radar configuration not available');
          showAlert('Failed to load airspace data: Radar configuration not available');
          return;
        }
        
        const center = radarData.config.center;
        const range = radarData.config.range;
        
        console.log('loadAirspaceData: center =', center, 'range =', range);
        
        if (!center || !range) {
          console.log('loadAirspaceData: Invalid radar configuration');
          showAlert('Failed to load airspace data: Invalid radar configuration');
          return;
        }
        
        const optimize = document.getElementById('optimize-airspace').checked;
        
        // Get selected airspace types
        const selectedTypes = [];
        if (document.getElementById('airspace-ctr').checked) selectedTypes.push('CTR');
        if (document.getElementById('airspace-cta').checked) selectedTypes.push('CTA');
        if (document.getElementById('airspace-tma').checked) selectedTypes.push('TMA');
        if (document.getElementById('airspace-atz').checked) selectedTypes.push('ATZ');
        if (document.getElementById('airspace-fa').checked) selectedTypes.push('FA');
        if (document.getElementById('airspace-da').checked) selectedTypes.push('DA');
        
        console.log('loadAirspaceData: selectedTypes =', selectedTypes);
        
        const params = new URLSearchParams({
          types: selectedTypes.join(','),
          center: JSON.stringify(center),
          range: range,
          optimize: optimize
        });
        
        console.log('loadAirspaceData: params =', params.toString());
        
        const response = await fetch('/radar/api/airspace?' + params.toString());
        const result = await response.json();
        
        console.log('loadAirspaceData: response =', result);
        
        if (result.success) {
          airspaceData = result.data;
          console.log('loadAirspaceData: airspaceData set to', airspaceData);
          renderAirspace();
          console.log('Airspace data loaded:', result.data.stats);
        } else {
          console.log('loadAirspaceData: Failed to load airspace data:', result.error);
          showAlert('Failed to load airspace data: ' + result.error);
        }
      } catch (error) {
        console.log('loadAirspaceData: Error:', error);
        showAlert('Failed to load airspace data: ' + error.message);
      }
    }
    
    // Load airspace events
    async function loadAirspaceEvents() {
      try {
        const response = await fetch('/radar/api/airspace-events?limit=20');
        const result = await response.json();
        
        if (result.success) {
          airspaceEvents = result.data;
          renderAirspaceEvents();
        }
      } catch (error) {
        console.error('Failed to load airspace events:', error);
      }
    }
    
    // Render airport vectors
    function renderAirportVectors() {
      if (!airportVectorData) return;
      
      const container = document.getElementById('airport-map-container');
      container.innerHTML = ''; // Clear previous map
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', '0 0 100 100');
      
      const createAndAppendPolygon = (coordinates, color, type) => {
        if (!coordinates || coordinates.length < 2) return;
        const points = coordinates.map(coord => {
          const pos = latLonToRadarPosition(coord.lat, coord.lon);
          return pos.x + ',' + pos.y;
        }).join(' ');
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', points);
        polygon.setAttribute('fill', color);
        polygon.setAttribute('fill-opacity', type === 'building' ? '0.3' : '0.2');
        polygon.setAttribute('stroke', color);
        polygon.setAttribute('stroke-width', '0.2');
        polygon.setAttribute('stroke-opacity', '0.8');
        svg.appendChild(polygon);
      };

      if (document.getElementById('show-buildings').checked && airportVectorData.buildings) {
        airportVectorData.buildings.forEach(building => createAndAppendPolygon(building.coordinates, '#FFD700', 'building'));
      }
      if (document.getElementById('show-markings').checked && airportVectorData.markings) {
        airportVectorData.markings.forEach(marking => createAndAppendPolygon(marking.coordinates, '#FFA500', 'marking'));
      }
      if (document.getElementById('show-layout').checked && airportVectorData.layout) {
        airportVectorData.layout.forEach(layout => createAndAppendPolygon(layout.coordinates, '#00FF00', 'layout'));
      }
      
      container.appendChild(svg);
    }
    
    // Render coastline data
    function renderCoastline() {
      if (!radarData.coastline || !radarData.coastline.enabled) return;
      
      const container = document.getElementById('airport-map-container');
      const showCoastline = document.getElementById('show-coastline').checked;
      
      if (!showCoastline) return;
      
      // Remove existing coastline elements
      container.querySelectorAll('.coastline-segment').forEach(el => el.remove());
      
      if (!radarData.coastline.segments) return;
      
      const svg = container.querySelector('svg') || createCoastlineSVG();
      
      radarData.coastline.segments.forEach(segment => {
        if (!segment.coordinates || segment.coordinates.length < 2) return;
        
        const points = segment.coordinates.map(coord => {
          const pos = latLonToRadarPosition(coord.lat, coord.lon);
          return pos.x + ',' + pos.y;
        }).join(' ');
        
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', points);
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', '#0066cc');
        polyline.setAttribute('stroke-width', '0.5');
        polyline.setAttribute('stroke-opacity', '0.8');
        polyline.classList.add('coastline-segment');
        svg.appendChild(polyline);
      });
    }
    
    // Create coastline SVG if it doesn't exist
    function createCoastlineSVG() {
      const container = document.getElementById('airport-map-container');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', '0 0 100 100');
      container.appendChild(svg);
      return svg;
    }
    
    // Convert lat/lon to radar display position
    function latLonToRadarPosition(lat, lon) {
      const centerLat = parseFloat(document.getElementById('center-lat').value);
      const centerLon = parseFloat(document.getElementById('center-lon').value);
      const range = parseFloat(document.getElementById('range-input').value);
      
      const R = 6371; // Earth's radius in km
      const toRad = (deg) => deg * (Math.PI / 180);

      const dLat = toRad(lat - centerLat);
      const dLon = toRad(lon - centerLon);
      
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(centerLat)) * Math.cos(toRad(lat)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c / 1.852; // distance in nautical miles

      const y = Math.sin(dLon) * Math.cos(toRad(lat));
      const x = Math.cos(toRad(centerLat)) * Math.sin(toRad(lat)) -
                Math.sin(toRad(centerLat)) * Math.cos(toRad(lat)) * Math.cos(dLon);
      const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      
      const radius = (distance / range) * 50;
      const angle = (bearing - 90) * (Math.PI / 180);
      
      return {
        x: 50 + radius * Math.cos(angle),
        y: 50 + radius * Math.sin(angle)
      };
    }
    
    function zoomIn() {
      const rangeInput = document.getElementById('range-input');
      let currentRange = parseFloat(rangeInput.value);
      currentRange /= 1.5;
      rangeInput.value = Math.max(0.1, currentRange).toFixed(2);
      applyRadarConfig();
    }

    function zoomOut() {
      const rangeInput = document.getElementById('range-input');
      let currentRange = parseFloat(rangeInput.value);
      currentRange *= 1.5;
      rangeInput.value = Math.min(200, currentRange).toFixed(2);
      applyRadarConfig();
    }

    // Apply radar configuration
    async function applyRadarConfig() {
      const config = {
        range: parseFloat(document.getElementById('range-input').value),
        center: {
          lat: parseFloat(document.getElementById('center-lat').value),
          lon: parseFloat(document.getElementById('center-lon').value)
        },
        displayMode: document.getElementById('display-mode').value,
        showTrails: document.getElementById('show-trails').checked,
        trailLength: parseInt(document.getElementById('trail-length').value),
        showCoastline: document.getElementById('show-coastline').checked
      };
      
      try {
        const response = await fetch('/radar/api/configure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        
        const result = await response.json();
        if (result.success) {
          radarData.config = result.data; // Update local config
          await loadRadarData();
          renderRadar();
          // showAlert('Configuration applied successfully');
        } else {
          showAlert('Failed to apply configuration: ' + result.error);
        }
      } catch (error) {
        showAlert('Failed to apply configuration: ' + error.message);
      }
    }
    
    // Render aircraft sidebar table
    function renderAircraftSidebar() {
      const tableBody = document.querySelector('#aircraft-table tbody');
      tableBody.innerHTML = '';
      if (!radarData.aircraft || radarData.aircraft.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.textContent = 'No aircraft detected';
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
      }
      radarData.aircraft.forEach(ac => {
        const row = document.createElement('tr');
        if (!ac.lat || !ac.lon) row.classList.add('no-pos');
        row.innerHTML =
          '<td>' + (ac.callsign || '') + '</td>' +
          '<td>' + (ac.icao24 || '') + '</td>' +
          '<td>' + (ac.altitude !== undefined && ac.altitude !== null ? ac.altitude : '') + '</td>' +
          '<td>' + (ac.speed !== undefined && ac.speed !== null ? ac.speed : '') + '</td>' +
          '<td>' + (ac.track !== undefined && ac.track !== null ? ac.track : '') + '</td>' +
          '<td>' + (ac.status !== undefined && ac.status !== null ? ac.status : '') + '</td>' +
          '<td>' + (ac.airspace !== undefined && ac.airspace !== null ? ac.airspace : '') + '</td>';
        tableBody.appendChild(row);
      });
    }
    
    // Render airspace data
    function renderAirspace() {
      if (!airspaceData || !airspaceData.airspaces) return;
      
      const container = document.getElementById('airport-map-container');
      
      // Remove existing airspace elements
      container.querySelectorAll('.airspace-polygon').forEach(el => el.remove());
      
      // Get or create SVG container
      let svg = container.querySelector('svg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', '0 0 100 100');
        container.appendChild(svg);
      }
      
      console.log('airspaceData.airspaces:', airspaceData.airspaces);
      
      // Render each airspace polygon
      if (airspaceData.airspaces && Array.isArray(airspaceData.airspaces)) {
        airspaceData.airspaces.forEach((airspace, index) => {
          console.log('Processing airspace ' + index + ':', airspace);
          if (!airspace.points || airspace.points.length < 3) {
            console.log('Skipping airspace ' + index + ': insufficient points');
            return;
          }
          
          const points = airspace.points.map(coord => {
            const pos = latLonToRadarPosition(coord.lat, coord.lon);
            return pos.x + ',' + pos.y;
          }).join(' ');
          
          console.log('Airspace ' + index + ' points:', points);
          
          const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          polygon.setAttribute('points', points);
          polygon.setAttribute('fill', airspace.color || '#FF0000');
          polygon.setAttribute('fill-opacity', airspace.opacity || 0.2);
          polygon.setAttribute('stroke', airspace.color || '#FF0000');
          polygon.setAttribute('stroke-width', '0.3');
          polygon.setAttribute('stroke-opacity', '0.8');
          polygon.classList.add('airspace-polygon');
          polygon.setAttribute('data-airspace-id', airspace.id);
          polygon.setAttribute('data-airspace-type', airspace.type);
          polygon.setAttribute('data-airspace-name', airspace.name);
          
          // Add hover tooltip
          polygon.addEventListener('mouseenter', (e) => {
            showAirspaceTooltip(e, airspace);
          });
          
          polygon.addEventListener('mouseleave', () => {
            hideAirspaceTooltip();
          });
          
          svg.appendChild(polygon);
          console.log('Added airspace polygon ' + index + ' to SVG');
        });
      } else {
        console.log('airspaceData.airspaces is not an array or is undefined');
      }
    }
    
    // Show airspace tooltip
    function showAirspaceTooltip(event, airspace) {
      const tooltip = document.getElementById('airspace-tooltip') || createAirspaceTooltip();
      tooltip.innerHTML =
        '<strong>' + airspace.name + '</strong><br>' +
        'Type: ' + airspace.type + '<br>' +
        'Points: ' + (airspace.optimizedPointCount || airspace.points.length);
      tooltip.style.left = event.pageX + 10 + 'px';
      tooltip.style.top = event.pageY - 10 + 'px';
      tooltip.style.display = 'block';
    }
    
    // Hide airspace tooltip
    function hideAirspaceTooltip() {
      const tooltip = document.getElementById('airspace-tooltip');
      if (tooltip) {
        tooltip.style.display = 'none';
      }
    }
    
    // Create airspace tooltip element
    function createAirspaceTooltip() {
      const tooltip = document.createElement('div');
      tooltip.id = 'airspace-tooltip';
      tooltip.style.cssText =
        'position: absolute;' +
        'background: rgba(0,0,0,0.9);' +
        'border: 1px solid #00ff00;' +
        'color: #00ff00;' +
        'padding: 8px;' +
        'border-radius: 4px;' +
        'font-size: 11px;' +
        'z-index: 10000;' +
        'display: none;' +
        'pointer-events: none;';
      document.body.appendChild(tooltip);
      return tooltip;
    }
    
    // Render airspace events
    function renderAirspaceEvents() {
      // This could be implemented to show recent airspace events
      // For now, we'll just log them
      if (airspaceEvents.length > 0) {
        console.log('Recent airspace events:', airspaceEvents);
      }
    }
    
    // Initialize on load
    window.addEventListener('load', async () => {
      await initRadar();
      await applyRadarConfig();
      await loadAirportVectors();
      await loadAirspaceData();
      await loadAirspaceEvents();
    });
  </script>
</body>
</html>`;

  res.send(html);
});

// Radar API endpoints
router.get('/api/display', async (req, res) => {
  try {
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const display = radarConnector.getRadarDisplay();
    
    // Add augmented flight data if ADSB connector is available
    if (connectorRegistry) {
      const adsbConnector = connectorRegistry.getConnector('adsb-main');
      if (adsbConnector && adsbConnector.getActiveFlights) {
        const activeFlights = adsbConnector.getActiveFlights();
        display.augmentedFlights = activeFlights;
        display.flightStats = {
          activeFlights: activeFlights.length,
          totalFlights: adsbConnector.performance?.flightStarts || 0,
          completedFlights: adsbConnector.performance?.flightEnds || 0
        };
      }
    }
    
    res.json({ success: true, data: display });
  } catch (error) {
    logger.error('Failed to get radar display', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/configure', async (req, res) => {
  try {
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const config = radarConnector.configureRadar(req.body);
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to configure radar', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/filters', async (req, res) => {
  try {
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const filters = radarConnector.setFilter(req.body);
    res.json({ success: true, data: filters });
  } catch (error) {
    logger.error('Failed to set filters', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/zones', async (req, res) => {
  try {
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const zones = radarConnector.listZones();
    res.json({ success: true, data: zones });
  } catch (error) {
    logger.error('Failed to get zones', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/zones', async (req, res) => {
  try {
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const zone = radarConnector.createZone(req.body);
    res.json({ success: true, data: zone });
  } catch (error) {
    logger.error('Failed to create zone', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/api/zones/:id', async (req, res) => {
  try {
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const zone = radarConnector.updateZone({
      id: req.params.id,
      updates: req.body
    });
    res.json({ success: true, data: zone });
  } catch (error) {
    logger.error('Failed to update zone', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/api/zones/:id', async (req, res) => {
  try {
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const result = radarConnector.deleteZone({ id: req.params.id });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to delete zone', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/export', async (req, res) => {
  try {
    if (!radarConnector) {
      return res.status(500).json({ success: false, error: 'Radar Connector not initialized' });
    }
    
    const format = req.query.format || 'json';
    const exportData = radarConnector.exportRadarData({ format });
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="radar-data.csv"');
      res.send(exportData.data);
    } else {
      res.json({ success: true, data: exportData.data });
    }
  } catch (error) {
    logger.error('Failed to export radar data', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Airport vector data endpoint
router.get('/api/airport-vectors', async (req, res) => {
  try {
    if (!airportVectorService) {
      return res.status(500).json({ success: false, error: 'Airport Vector Service not initialized' });
    }
    
    const { types, bounds, center, radius } = req.query;
    
    let vectorData;
    
    if (bounds) {
      // Get elements within specified bounds
      const boundsObj = JSON.parse(bounds);
      const typesArray = types ? types.split(',') : ['buildings', 'markings', 'layout'];
      vectorData = airportVectorService.getElementsInBounds(boundsObj, typesArray);
    } else if (center && radius) {
      // Get elements near a point
      const centerObj = JSON.parse(center);
      const radiusKm = parseFloat(radius) || 1;
      const typesArray = types ? types.split(',') : ['buildings', 'markings', 'layout'];
      vectorData = airportVectorService.getElementsNearPoint(centerObj, radiusKm, typesArray);
    } else {
      // Get all data
      vectorData = airportVectorService.getAllData();
    }
    
    res.json({ 
      success: true, 
      data: vectorData,
      stats: airportVectorService.getStats()
    });
  } catch (error) {
    logger.error('Failed to get airport vector data', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Airport bounds endpoint
router.get('/api/airport-bounds', async (req, res) => {
  try {
    if (!airportVectorService) {
      return res.status(500).json({ success: false, error: 'Airport Vector Service not initialized' });
    }
    
    const bounds = airportVectorService.getAirportBounds();
    res.json({ success: true, data: bounds });
  } catch (error) {
    logger.error('Failed to get airport bounds', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Airspace endpoint
router.get('/api/airspace', async (req, res) => {
  try {
    if (!airspaceService) {
      return res.status(500).json({ success: false, error: 'Airspace Service not initialized' });
    }
    
    // Get all airspace types and collect airspaces
    const airspaceTypes = airspaceService.getAirspaceTypes();
    const allAirspaces = [];
    
    for (const type of airspaceTypes) {
      const typeAirspaces = airspaceService.getAirspacesByType(type);
      if (typeAirspaces && typeAirspaces.length > 0) {
        allAirspaces.push(...typeAirspaces);
      }
    }
    
    const filteredAirspaces = [];
    
    // Filter out airspaces with invalid polygons
    for (const airspace of allAirspaces) {
      if (airspace.polygons && airspace.polygons.length > 0) {
        // Check if the first polygon has valid coordinates
        const firstPolygon = airspace.polygons[0];
        if (Array.isArray(firstPolygon) && firstPolygon.length > 0) {
          // Validate that all coordinates have lat and lon properties
          const validCoordinates = firstPolygon.every(coord => 
            coord && typeof coord.lat === 'number' && typeof coord.lon === 'number' &&
            !isNaN(coord.lat) && !isNaN(coord.lon)
          );
          
          if (validCoordinates) {
            filteredAirspaces.push({
              id: airspace.id,
              name: airspace.name,
              type: airspace.type,
              points: firstPolygon,
              color: airspaceService.getAirspaceColor(airspace.type),
              opacity: 0.2,
              metadata: airspace.metadata || {}
            });
          }
        }
      }
    }
    
    const stats = {
      total: filteredAirspaces.length,
      byType: {}
    };
    
    // Count by type
    for (const airspace of filteredAirspaces) {
      if (!stats.byType[airspace.type]) {
        stats.byType[airspace.type] = 0;
      }
      stats.byType[airspace.type]++;
    }
    
    res.json({ 
      success: true, 
      data: {
        airspaces: filteredAirspaces,
        stats: stats
      }
    });
  } catch (error) {
    logger.error('Failed to get airspace data', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Airspace events endpoint
router.get('/api/airspace-events', async (req, res) => {
  try {
    if (!airspaceService) {
      return res.status(500).json({ success: false, error: 'Airspace Service not initialized' });
    }
    
    const { limit, type, aircraft } = req.query;
    
    // Get recent airspace events
    const events = airspaceService.getRecentAirspaceEvents({
      limit: parseInt(limit) || 50,
      type: type || null,
      aircraft: aircraft || null
    });
    
    res.json({ 
      success: true, 
      data: events,
      count: events.length
    });
  } catch (error) {
    logger.error('Failed to get airspace events', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Airspace types endpoint
router.get('/api/airspace-types', async (req, res) => {
  try {
    if (!airspaceService) {
      return res.status(500).json({ success: false, error: 'Airspace Service not initialized' });
    }
    
    const types = airspaceService.getAirspaceTypes();
    const typeStats = {};
    
    for (const type of types) {
      const typeAirspaces = airspaceService.getAirspacesByType(type);
      typeStats[type] = {
        count: typeAirspaces ? typeAirspaces.length : 0,
        color: vectorOptimizationService ? vectorOptimizationService.getDefaultColor(type) : '#808080'
      };
    }
    
    res.json({ 
      success: true, 
      data: {
        types,
        stats: typeStats
      }
    });
  } catch (error) {
    logger.error('Failed to get airspace types', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Augmented flight data endpoint
router.get('/api/augmented-flights', async (req, res) => {
  try {
    if (!connectorRegistry) {
      return res.status(500).json({ success: false, error: 'Connector Registry not initialized' });
    }
    
    const adsbConnector = connectorRegistry.getConnector('adsb-main');
    if (!adsbConnector) {
      return res.status(500).json({ success: false, error: 'ADSB Connector not found' });
    }
    
    // Get active flights with augmented data
    const activeFlights = adsbConnector.getActiveFlights ? adsbConnector.getActiveFlights() : [];
    const augmentedFlights = [];
    
    for (const flight of activeFlights) {
      const augmentedFlight = {
        ...flight,
        // Add augmented data
        airspaceInfo: null,
        squawkInfo: null,
        aircraftInfo: null,
        flightPath: null,
        alerts: []
      };
      
      // Get airspace information if available
      if (airspaceService && flight.currentPosition) {
        const airspaces = airspaceService.getAirspacesAtPosition(
          flight.currentPosition.lat, 
          flight.currentPosition.lon, 
          flight.currentPosition.altitude
        );
        if (airspaces.length > 0) {
          augmentedFlight.airspaceInfo = airspaces.map(airspace => ({
            id: airspace.id,
            type: airspace.type,
            name: airspace.name,
            class: airspace.class,
            floor: airspace.floor,
            ceiling: airspace.ceiling
          }));
        }
      }
      
      // Get squawk code information if available
      if (adsbConnector.squawkCodeService && flight.squawk) {
        const squawkInfo = adsbConnector.squawkCodeService.getSquawkCodeInfo(flight.squawk);
        if (squawkInfo) {
          augmentedFlight.squawkInfo = squawkInfo;
        }
      }
      
      // Get aircraft information if available
      if (adsbConnector.aircraftDataService && flight.icao24) {
        const aircraftInfo = adsbConnector.aircraftDataService.getAircraftInfo(flight.icao24);
        if (aircraftInfo) {
          augmentedFlight.aircraftInfo = aircraftInfo;
        }
      }
      
      // Get flight path if available
      if (flight.flightPath && flight.flightPath.length > 0) {
        augmentedFlight.flightPath = flight.flightPath.map(point => ({
          lat: point.lat,
          lon: point.lon,
          altitude: point.altitude,
          timestamp: point.timestamp
        }));
      }
      
      // Check for alerts
      if (flight.emergency) {
        augmentedFlight.alerts.push('EMERGENCY');
      }
      
      if (flight.squawk && flight.squawk === '7500') {
        augmentedFlight.alerts.push('HIJACK');
      } else if (flight.squawk && flight.squawk === '7600') {
        augmentedFlight.alerts.push('COMM_FAILURE');
      } else if (flight.squawk && flight.squawk === '7700') {
        augmentedFlight.alerts.push('EMERGENCY');
      }
      
      augmentedFlights.push(augmentedFlight);
    }
    
    res.json({ 
      success: true, 
      data: {
        flights: augmentedFlights,
        count: augmentedFlights.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get augmented flight data', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export the router and injectServices function
module.exports = { router, injectServices }; 