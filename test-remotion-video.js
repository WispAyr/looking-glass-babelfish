const RemotionConnector = require('./connectors/types/RemotionConnector');
const path = require('path');
const fs = require('fs');

async function testRealVideoRendering() {
  console.log('🎬 Testing Real Remotion Video Rendering...\n');

  try {
    // Create Remotion Connector
    const remotion = new RemotionConnector({
      id: 'remotion-video-test',
      type: 'remotion',
      name: 'Real Video Test',
      description: 'Test real video rendering with Remotion',
      config: {
        outputDir: './renders',
        templatesDir: './templates',
        remotionProjectDir: './remotion-project',
        defaultFps: 30,
        defaultDuration: 10,
        quality: 'medium'
      }
    });

    console.log('✅ Remotion connector created');

    // Set up mock connector registry for testing
    const mockConnectorRegistry = {
      getConnectorsByType: (type) => {
        if (type === 'adsb') {
          return [{
            execute: async (capability, operation, params) => {
              // Return mock flight data
              return [
                { lat: 55.5074, lon: -4.5933, timestamp: new Date(Date.now() - 3600000).toISOString() },
                { lat: 55.5075, lon: -4.5934, timestamp: new Date(Date.now() - 1800000).toISOString() },
                { lat: 55.5076, lon: -4.5935, timestamp: new Date().toISOString() }
              ];
            }
          }];
        }
        return [];
      },
      getConnectors: () => []
    };
    
    remotion.setConnectorRegistry(mockConnectorRegistry);
    console.log('✅ Mock connector registry set up');

    // Create templates first
    console.log('\n📝 Creating templates...');
    
    // Create flight path template
    const flightTemplate = await remotion.execute('template-management', 'create', {
      id: 'flight-path',
      name: 'Flight Path Template',
      description: 'Flight path visualization template',
      componentName: 'FlightPathComponent',
      componentPath: 'FlightPathComponent.jsx',
      width: 1920,
      height: 1080
    });
    console.log('✅ Flight path template created:', flightTemplate.id);

    // Create event timeline template
    const timelineTemplate = await remotion.execute('template-management', 'create', {
      id: 'event-timeline',
      name: 'Event Timeline Template',
      description: 'Event timeline visualization template',
      componentName: 'EventTimelineComponent',
      componentPath: 'EventTimelineComponent.jsx',
      width: 1920,
      height: 1080
    });
    console.log('✅ Event timeline template created:', timelineTemplate.id);

    // Test flight path video rendering
    console.log('\n🚀 Rendering Flight Path Video...');
    const flightResult = await remotion.execute('flight-visualization', 'create-flight-video', {
      callsign: 'TEST123',
      registration: 'G-TEST',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      outputPath: './renders/flight-path-test.mp4'
    });

    console.log('✅ Flight video render job created:', flightResult.renderId);

    // Wait a bit for the render to process
    console.log('⏳ Waiting for render to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check render status
    const flightStatus = await remotion.getRenderStatus(flightResult.renderId);
    console.log('📊 Flight render status:', flightStatus.status);

    // Test event timeline video rendering
    console.log('\n📊 Rendering Event Timeline Video...');
    const timelineResult = await remotion.execute('event-timeline', 'create-event-timeline', {
      eventTypes: ['motion', 'smartDetectZone'],
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      outputPath: './renders/event-timeline-test.mp4'
    });

    console.log('✅ Event timeline render job created:', timelineResult.renderId);

    // Wait a bit for the render to process
    console.log('⏳ Waiting for render to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check render status
    const timelineStatus = await remotion.getRenderStatus(timelineResult.renderId);
    console.log('📊 Timeline render status:', timelineStatus.status);

    // Check if video files were created
    console.log('\n📁 Checking for rendered video files...');
    const rendersDir = './renders';
    if (fs.existsSync(rendersDir)) {
      const files = fs.readdirSync(rendersDir);
      const videoFiles = files.filter(file => file.endsWith('.mp4'));
      console.log('✅ Video files found:', videoFiles);
      
      for (const videoFile of videoFiles) {
        const filePath = path.join(rendersDir, videoFile);
        const stats = fs.statSync(filePath);
        console.log(`📹 ${videoFile}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      }
    } else {
      console.log('❌ Renders directory not found');
    }

    // Get final render stats
    const stats = remotion.getRenderStats();
    console.log('\n📈 Final Render Statistics:');
    console.log(`- Total renders: ${stats.totalRenders}`);
    console.log(`- Successful: ${stats.successfulRenders}`);
    console.log(`- Failed: ${stats.failedRenders}`);
    console.log(`- Average render time: ${stats.averageRenderTime ? (stats.averageRenderTime / 1000).toFixed(2) + 's' : 'N/A'}`);

    console.log('\n🎉 Real video rendering test completed!');
    console.log('\n📋 Summary:');
    console.log('- Flight path video: ' + (flightStatus.status === 'completed' ? '✅ Success' : '❌ ' + flightStatus.status));
    console.log('- Event timeline video: ' + (timelineStatus.status === 'completed' ? '✅ Success' : '❌ ' + timelineStatus.status));
    console.log('- Check the ./renders directory for video files');

  } catch (error) {
    console.error('❌ Real video rendering test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testRealVideoRendering(); 