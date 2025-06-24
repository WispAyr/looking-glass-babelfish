const { exec } = require('child_process');

console.log('🔧 Starting server with port cleanup...');

// Function to free a port
function freePort(port) {
  return new Promise((resolve) => {
    exec(`lsof -ti:${port} | xargs kill -9`, (error, stdout, stderr) => {
      if (error) {
        console.log(`No process found on port ${port} or already free`);
      } else {
        console.log(`✅ Freed port ${port}`);
      }
      resolve();
    });
  });
}

// Free both ports and start server
async function startServer() {
  try {
    // Free port 3000
    await freePort(3000);
    
    // Free port 3001
    await freePort(3001);
    
    // Wait a moment for ports to be fully released
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🚀 Starting main server...');
    console.log('📊 System Visualizer will be started automatically by the main server');
    
    // Start the main server
    const { spawn } = require('child_process');
    const server = spawn('node', ['server.js'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' }
    });
    
    server.on('error', (error) => {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    });
    
    server.on('exit', (code) => {
      console.log(`Server exited with code ${code}`);
      process.exit(code);
    });
    
  } catch (error) {
    console.error('❌ Error during startup:', error);
    process.exit(1);
  }
}

startServer(); 