UNIFI PROTECTAPI

API KEY 6pXhUX2-hnWonI8abmazH4kGRdVLp4r8

running on 10.0.0.1 in the communications van



Example
curl -k -X GET 'https://10.0.0.1/proxy/network/integration/v1/sites' \
 -H 'X-API-KEY: YOUR_API_KEY' \
 -H 'Accept: application/json'


const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { serverConfig } = require('./config');
const { testConnection, getTables, getTableStructure, executeQuery } = require('./database');

const execAsync = promisify(exec);
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Log management
const logs = [];
const MAX_LOGS = 1000;

function addLog(level, message, data = null) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        data
    };
    
    logs.push(logEntry);
    
    // Keep only the last MAX_LOGS entries
    if (logs.length > MAX_LOGS) {
        logs.shift();
    }
    
    // Broadcast to all connected WebSocket clients
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(logEntry));
        }
    });
    
    // Also log to console
    console.log(`[${level.toUpperCase()}] ${message}`, data || '');
}

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');
    
    // Send existing logs to new client
    ws.send(JSON.stringify({ type: 'init', logs }));
    
    ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
    });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Aggressive port clearing function
async function clearPort(port) {
    try {
        addLog('info', `Clearing port ${port}...`);
        
        // Find processes using the port
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        
        if (stdout.trim()) {
            const pids = stdout.trim().split('\n');
            addLog('info', `Found ${pids.length} process(es) using port ${port}: ${pids.join(', ')}`);
            
            // Kill all processes using the port
            for (const pid of pids) {
                try {
                    await execAsync(`kill -9 ${pid}`);
                    addLog('info', `Killed process ${pid}`);
                } catch (err) {
                    addLog('warn', `Failed to kill process ${pid}: ${err.message}`);
                }
            }
            
            // Wait a moment for processes to fully terminate
            await new Promise(resolve => setTimeout(resolve, 1000));
            addLog('info', `Port ${port} cleared successfully`);
        } else {
            addLog('info', `Port ${port} is already free`);
        }
    } catch (error) {
        // If lsof fails, it usually means no processes are using the port
        addLog('info', `Port ${port} appears to be free (no processes found)`);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'ParkWise Automations Server',
    port: serverConfig.port
  });
});

// Get logs endpoint
app.get('/api/logs', (req, res) => {
    res.json({
        success: true,
        logs: logs
    });
});

// Clear logs endpoint
app.post('/api/logs/clear', (req, res) => {
    logs.length = 0;
    addLog('info', 'Logs cleared');
    res.json({
        success: true,
        message: 'Logs cleared'
    });
});

// Test database connection
app.get('/api/db/test', async (req, res) => {
  try {
    const isConnected = await testConnection();
    addLog('info', `Database connection test: ${isConnected ? 'SUCCESS' : 'FAILED'}`);
    res.json({
      success: isConnected,
      message: isConnected ? 'Database connection successful' : 'Database connection failed'
    });
  } catch (error) {
    addLog('error', 'Database connection test failed', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all tables
app.get('/api/db/tables', async (req, res) => {
  try {
    const result = await getTables();
    if (result.success) {
      addLog('info', `Retrieved ${result.data.length} tables from database`);
      res.json({
        success: true,
        tables: result.data
      });
    } else {
      addLog('error', 'Failed to get tables', result.error);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    addLog('error', 'Error getting tables', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get table structure
app.get('/api/db/tables/:tableName/structure', async (req, res) => {
  try {
    const { tableName } = req.params;
    const result = await getTableStructure(tableName);
    if (result.success) {
      addLog('info', `Retrieved structure for table: ${tableName}`);
      res.json({
        success: true,
        tableName,
        structure: result.data
      });
    } else {
      addLog('error', `Failed to get structure for table ${tableName}`, result.error);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    addLog('error', `Error getting table structure for ${req.params.tableName}`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute custom query (for development/testing)
app.post('/api/db/query', async (req, res) => {
  try {
    const { sql, params = [] } = req.body;
    
    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required'
      });
    }
    
    addLog('info', 'Executing custom query', { sql: sql.substring(0, 100) + '...' });
    const result = await executeQuery(sql, params);
    res.json(result);
  } catch (error) {
    addLog('error', 'Error executing custom query', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Event generation endpoints
app.post('/api/events/generate', async (req, res) => {
  try {
    const { startDate, endDate, clearFlaggedEvents = false } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    addLog('info', 'Starting event generation', { startDate, endDate, clearFlaggedEvents });
    
    // Import the event generation module
    const { generateParkingEvents } = require('./eventGeneration');
    
    const events = await generateParkingEvents(startDate, endDate, clearFlaggedEvents, (progress) => {
      addLog('info', `Event generation progress: ${progress}%`);
    });
    
    addLog('info', 'Event generation completed', { eventsGenerated: events ? events.length : 0 });
    
    res.json({
      success: true,
      eventsGenerated: events ? events.length : 0,
      events: events
    });
  } catch (error) {
    addLog('error', 'Event generation failed', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Smart event generation endpoint
app.post('/api/events/generate-smart', async (req, res) => {
  try {
    const { startDate, endDate, dryRun = true } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    addLog('info', 'Starting smart event generation', { startDate, endDate, dryRun });
    
    // Import the smart event generation module
    const { generateParkingEventsSmart } = require('./eventGeneration');
    
    const summary = await generateParkingEventsSmart(startDate, endDate, dryRun, (progress, message) => {
      addLog('info', message || `Smart event generation progress: ${progress}%`);
    });
    
    addLog('info', 'Smart event generation completed', summary);
    
    res.json({
      success: true,
      summary: summary
    });
  } catch (error) {
    addLog('error', 'Smart event generation failed', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
async function startServer() {
  try {
    // Aggressively clear port 4000 before starting
    await clearPort(serverConfig.port);
    
    // Test database connection on startup
    addLog('info', 'Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      addLog('error', 'Failed to connect to database. Server will start but database features may not work.');
    }
    
    server.listen(serverConfig.port, () => {
      addLog('info', `ParkWise Automations Server running on port ${serverConfig.port}`);
      addLog('info', `Environment: ${serverConfig.nodeEnv}`);
      addLog('info', `Health check: http://localhost:${serverConfig.port}/health`);
      addLog('info', `Database test: http://localhost:${serverConfig.port}/api/db/test`);
      addLog('info', `Event generation: http://localhost:${serverConfig.port}/api/events/generate`);
      addLog('info', `Web UI: http://localhost:${serverConfig.port}`);
    });
  } catch (error) {
    addLog('error', 'Failed to start server', error.message);
    process.exit(1);
  }
}

startServer(); 