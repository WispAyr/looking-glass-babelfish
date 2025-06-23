const { exec } = require('child_process');

// Kill any process using port 3001
exec('lsof -ti:3001 | xargs kill -9', (error, stdout, stderr) => {
  if (error) {
    console.log('No process found on port 3001 or already free');
  } else {
    console.log('✅ Freed port 3001');
  }
  
  // Run the visualizer test
  setTimeout(() => {
    console.log('🚀 Starting System Visualizer test...');
    require('./test-system-visualizer.js');
  }, 1000);
}); 