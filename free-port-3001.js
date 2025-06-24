const { exec } = require('child_process');

// Ports to free
const ports = [3001, 8443, 8444];

console.log('🔧 Freeing ports for clean start...');

let freedCount = 0;
const totalPorts = ports.length;

ports.forEach(port => {
  exec(`lsof -ti:${port} | xargs kill -9`, (error, stdout, stderr) => {
    if (error) {
      console.log(`ℹ️  Port ${port} already free`);
    } else {
      console.log(`✅ Freed port ${port}`);
    }
    
    freedCount++;
    
    // When all ports are processed, log completion
    if (freedCount === totalPorts) {
      console.log('🎉 All ports freed successfully!');
    }
  });
}); 