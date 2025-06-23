const DisplayManagerConnector = require('./connectors/types/DisplayManagerConnector');

/**
 * Simple Test Display Manager Connector
 * 
 * Demonstrates the functionality of the Display Manager connector for
 * managing multiple displays in a command center environment.
 */
async function testDisplayManager() {
  console.log('=== Display Manager Connector Test ===\n');

  // Create display manager connector
  const displayManager = new DisplayManagerConnector({
    id: 'display-manager-main',
    name: 'Main Display Manager',
    description: 'Primary display manager for command center',
    config: {
      displayConfig: {
        port: 3002,
        host: 'localhost',
        baseUrl: 'http://localhost:3002'
      },
      zoneConfig: {
        zones: ['main', 'secondary', 'emergency', 'noc', 'command']
      },
      alarmIntegration: {
        enabled: true,
        alarmManagerId: 'alarm-manager'
      }
    },
    logger: console
  });

  try {
    // Connect to the service
    console.log('1. Connecting to Display Manager...');
    await displayManager.connect();
    console.log('✓ Connected successfully\n');

    // Create displays
    console.log('2. Creating displays...');
    const displays = [
      { displayId: 'screen-1', name: 'Main Screen 1', zone: 'main' },
      { displayId: 'screen-2', name: 'Main Screen 2', zone: 'main' },
      { displayId: 'screen-3', name: 'Secondary Screen', zone: 'secondary' },
      { displayId: 'screen-4', name: 'Emergency Screen', zone: 'emergency' },
      { displayId: 'screen-5', name: 'NOC Screen 1', zone: 'noc' },
      { displayId: 'screen-6', name: 'Command Screen', zone: 'command' }
    ];

    for (const display of displays) {
      await displayManager.execute('display:management', 'create', display);
      console.log(`✓ Created display: ${display.displayId}`);
    }
    console.log('');

    // Create custom templates (skip if they already exist)
    console.log('3. Creating custom templates...');
    const templates = [
      {
        templateId: 'custom-dashboard',
        name: 'Custom Dashboard Template',
        content: {
          type: 'dashboard',
          layout: 'grid',
          components: [
            { id: 'map', type: 'map', position: { x: 0, y: 0, width: 6, height: 4 } },
            { id: 'radar', type: 'radar', position: { x: 6, y: 0, width: 6, height: 4 } },
            { id: 'alarms', type: 'alarms', position: { x: 0, y: 4, width: 4, height: 2 } },
            { id: 'status', type: 'status', position: { x: 4, y: 4, width: 4, height: 2 } },
            { id: 'weather', type: 'weather', position: { x: 8, y: 4, width: 4, height: 2 } }
          ]
        },
        type: 'dashboard'
      },
      {
        templateId: 'custom-emergency',
        name: 'Custom Emergency Template',
        content: {
          type: 'emergency',
          layout: 'fullscreen',
          components: [
            { id: 'alert', type: 'alert', position: { x: 0, y: 0, width: 12, height: 2 } },
            { id: 'map', type: 'map', position: { x: 0, y: 2, width: 8, height: 4 } },
            { id: 'details', type: 'details', position: { x: 8, y: 2, width: 4, height: 4 } }
          ]
        },
        type: 'emergency'
      }
    ];

    for (const template of templates) {
      try {
        await displayManager.execute('display:templates', 'create', template);
        console.log(`✓ Created template: ${template.templateId}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`- Template ${template.templateId} already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
    console.log('');

    // Apply templates to displays
    console.log('4. Applying templates to displays...');
    await displayManager.execute('display:templates', 'apply', {
      templateId: 'dashboard', // Use default template
      displayIds: ['screen-1', 'screen-2']
    });
    console.log('✓ Applied dashboard template to main screens');

    await displayManager.execute('display:templates', 'apply', {
      templateId: 'emergency', // Use default template
      displayIds: ['screen-4']
    });
    console.log('✓ Applied emergency template to emergency screen');
    console.log('');

    // Activate displays
    console.log('5. Activating displays...');
    for (const display of displays) {
      await displayManager.execute('display:management', 'activate', {
        displayId: display.displayId
      });
      console.log(`✓ Activated display: ${display.displayId}`);
    }
    console.log('');

    // Test alarm trigger
    console.log('6. Testing alarm integration...');
    await displayManager.execute('display:alarms', 'trigger', {
      alarmId: 'test-alarm-001',
      priority: 'high',
      displays: ['screen-4'],
      message: 'Test emergency alarm - Aircraft emergency squawk detected'
    });
    console.log('✓ Triggered test alarm on emergency screen');
    console.log('');

    // Test privacy mode
    console.log('7. Testing privacy mode...');
    await displayManager.execute('display:privacy', 'enable', {
      displays: ['screen-1', 'screen-2'],
      duration: 5000 // 5 seconds
    });
    console.log('✓ Enabled privacy mode on main screens (5 seconds)');
    console.log('');

    // Get status
    console.log('8. Display Manager Status:');
    const status = displayManager.getStatus();
    console.log(JSON.stringify(status, null, 2));
    console.log('');

    console.log('=== Test Completed Successfully ===');
    console.log('\nDisplay Manager is now running on:');
    console.log(`- WebSocket Server: ws://localhost:${displayManager.displayConfig.port}`);
    console.log(`- Base URL: ${displayManager.displayConfig.baseUrl}`);
    console.log('\nIndividual display URLs:');
    
    for (const display of displays) {
      const displayInfo = displayManager.displays.get(display.displayId);
      if (displayInfo) {
        console.log(`- ${display.displayId}: ${displayInfo.url}`);
      }
    }

    console.log('\nTo test the displays:');
    console.log('1. Open each display URL in a separate browser window');
    console.log('2. Each display will connect via WebSocket for real-time updates');
    console.log('3. Use the Display Manager API to control content and layouts');
    console.log('4. Test alarm integration and privacy modes');
    console.log('\nAvailable templates:');
    for (const [templateId, template] of displayManager.templates) {
      console.log(`- ${templateId}: ${template.name}`);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Keep the connection alive for testing
    console.log('\nDisplay Manager will remain running for testing...');
    console.log('Press Ctrl+C to stop');
  }
}

// Run the test
testDisplayManager().catch(console.error); 