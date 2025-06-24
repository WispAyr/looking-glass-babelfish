const https = require('https');
const http = require('http');

async function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        client.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (error) {
                    reject(new Error(`Failed to parse JSON: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

async function testCameraDiscovery() {
    console.log('🔍 Testing camera discovery...');
    
    try {
        // Test the transcoding cameras endpoint
        const response = await makeRequest('http://localhost:3000/api/transcoding/cameras');
        
        console.log('📊 Response status:', response.status);
        console.log('📊 Response success:', response.data.success);
        console.log('📊 Camera count:', response.data.count);
        
        if (response.data.success && response.data.data) {
            console.log('📷 Cameras discovered:');
            response.data.data.forEach((camera, index) => {
                console.log(`  ${index + 1}. ${camera.name} (${camera.id})`);
                console.log(`     Type: ${camera.connectorType}`);
                console.log(`     Enabled: ${camera.enabled}`);
                console.log(`     hlsPath: ${camera.hlsPath} (${typeof camera.hlsPath})`);
                console.log(`     Has hlsPath: ${!!camera.hlsPath}`);
                console.log(`     hlsPath is string: ${typeof camera.hlsPath === 'string'}`);
                console.log('');
            });
        } else {
            console.error('❌ Failed to get cameras:', response.data.error);
        }
        
        // Test the transcoding status endpoint
        console.log('\n🔍 Testing transcoding status...');
        const statusResponse = await makeRequest('http://localhost:3000/api/transcoding/status');
        
        console.log('📊 Status response:', statusResponse.data);
        
    } catch (error) {
        console.error('❌ Error testing camera discovery:', error.message);
    }
}

// Run the test
testCameraDiscovery(); 