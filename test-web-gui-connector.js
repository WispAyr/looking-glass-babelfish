const WebGuiConnector = require('./connectors/types/WebGuiConnector');
const MapConnector = require('./connectors/types/MapConnector');
const winston = require('winston');

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function testWebGuiConnector() {
  console.log('🧪 Testing WebGuiConnector...\n');

  try {
    // Create Web GUI Connector
    const webGui = new WebGuiConnector({
      id: 'test-web-gui',
      name: 'Test Web GUI',
      description: 'Test web interface connector',
      logger: logger,
      config: {
        webInterface: {
          enabled: true,
          port: 3000,
          host: 'localhost'
        },
        autoRegisterWithMaps: true,
        autoDiscoverConnectors: true,
        theme: 'dark',
        layout: 'default'
      }
    });

    // Create Map Connector
    const map = new MapConnector({
      id: 'test-map',
      name: 'Test Map',
      description: 'Test map connector',
      logger: logger,
      config: {
        autoRegisterConnectors: true,
        enableWebSockets: true,
        editMode: false,
        viewMode: 'realtime'
      }
    });

    console.log('✅ Connectors created successfully');

    // Test Web GUI capabilities
    console.log('\n📋 Testing Web GUI capabilities...');

    // Create a page
    const page = await webGui.executeCapability('gui:pages', 'create', {
      pageId: 'dashboard',
      template: 'default',
      data: { title: 'Main Dashboard' },
      route: '/dashboard'
    });
    console.log('✅ Created page:', page.id);

    // Create a component
    const component = await webGui.executeCapability('gui:components', 'create', {
      componentId: 'camera-grid',
      type: 'grid',
      data: { cameras: [] },
      config: { columns: 3 }
    });
    console.log('✅ Created component:', component.id);

    // Test navigation
    const navigatedPage = await webGui.executeCapability('gui:pages', 'navigate', {
      pageId: 'dashboard',
      data: { user: 'test' }
    });
    console.log('✅ Navigated to page:', navigatedPage.id);

    // Test real-time updates
    const update = await webGui.executeCapability('gui:realtime', 'broadcast', {
      target: 'dashboard',
      data: { message: 'Test update' },
      priority: 'normal'
    });
    console.log('✅ Broadcasted update:', update.target);

    // Test integration
    const integration = await webGui.executeCapability('gui:integration', 'register', {
      connectorId: 'test-map',
      uiConfig: { position: 'sidebar' }
    });
    console.log('✅ Registered with connector:', integration.connectorId);

    // Test auto-registration with map
    console.log('\n🗺️ Testing auto-registration with map...');
    console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(webGui)));
    console.log('autoRegisterWithMaps method:', typeof webGui.autoRegisterWithMaps);
    await webGui.autoRegisterWithMaps(map);
    console.log('✅ Auto-registered with map');

    // Test spatial context
    const spatialContext = await webGui.getSpatialContext();
    console.log('✅ Spatial context:', {
      type: spatialContext.type,
      pages: spatialContext.ui.pages.length,
      components: spatialContext.ui.components.length
    });

    // Test web interface configuration
    const webConfig = webGui.getWebInterfaceConfig();
    console.log('✅ Web interface config:', {
      url: webConfig.url,
      pages: webConfig.pages.length,
      theme: webConfig.theme
    });

    // Test GUI status
    const guiStatus = webGui.getGuiStatus();
    console.log('✅ GUI status:', {
      status: guiStatus.status,
      pages: guiStatus.pages,
      components: guiStatus.components,
      metrics: guiStatus.metrics
    });

    // Test connector status
    const status = webGui.getStatus();
    console.log('✅ Connector status:', {
      id: status.id,
      type: status.type,
      status: status.status,
      capabilities: status.capabilities.length
    });

    console.log('\n🎉 All WebGuiConnector tests passed!');
    console.log('\n📊 Test Summary:');
    console.log(`- Pages created: ${webGui.pages.size}`);
    console.log(`- Components created: ${webGui.components.size}`);
    console.log(`- Navigation routes: ${webGui.navigation.size}`);
    console.log(`- UI updates: ${webGui.uiMetrics.realTimeUpdates}`);
    console.log(`- Page views: ${webGui.uiMetrics.pageViews}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testWebGuiConnector(); 