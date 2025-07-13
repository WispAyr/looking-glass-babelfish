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
  defaultMeta: { service: 'gui-routes' },
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
let layoutManager, guiEditor;
let connectorRegistry = null;

// Middleware to inject services
function injectServices(services) {
  layoutManager = services.layoutManager;
  guiEditor = services.guiEditor;
  connectorRegistry = services.connectorRegistry;
}

// Layout management endpoints
router.get('/layouts', async (req, res) => {
  try {
    if (!layoutManager) {
      return res.status(500).json({ success: false, error: 'Layout Manager not initialized' });
    }
    
    const layouts = layoutManager.getAllLayouts();
    const activeLayout = layoutManager.getActiveLayout();
    
    res.json({
      success: true,
      data: {
        layouts,
        activeLayout: activeLayout ? activeLayout.id : null,
        stats: layoutManager.getLayoutStats()
      }
    });
  } catch (error) {
    logger.error('Failed to get layouts', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/layouts/:layoutId', async (req, res) => {
  try {
    if (!layoutManager) {
      return res.status(500).json({ success: false, error: 'Layout Manager not initialized' });
    }
    
    const layout = layoutManager.getLayout(req.params.layoutId);
    if (!layout) {
      return res.status(404).json({ success: false, error: 'Layout not found' });
    }
    
    res.json({ success: true, data: layout });
  } catch (error) {
    logger.error('Failed to get layout', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/layouts', async (req, res) => {
  try {
    if (!layoutManager) {
      return res.status(500).json({ success: false, error: 'Layout Manager not initialized' });
    }
    
    const layout = await layoutManager.createLayout(req.body);
    res.status(201).json({ success: true, data: layout });
  } catch (error) {
    logger.error('Failed to create layout', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/layouts/:layoutId', async (req, res) => {
  try {
    if (!layoutManager) {
      return res.status(500).json({ success: false, error: 'Layout Manager not initialized' });
    }
    
    const layout = await layoutManager.updateLayout(req.params.layoutId, req.body);
    res.json({ success: true, data: layout });
  } catch (error) {
    logger.error('Failed to update layout', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/layouts/:layoutId', async (req, res) => {
  try {
    if (!layoutManager) {
      return res.status(500).json({ success: false, error: 'Layout Manager not initialized' });
    }
    
    await layoutManager.deleteLayout(req.params.layoutId);
    res.json({ success: true, message: 'Layout deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete layout', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/layouts/:layoutId/activate', async (req, res) => {
  try {
    if (!layoutManager) {
      return res.status(500).json({ success: false, error: 'Layout Manager not initialized' });
    }
    
    const layout = await layoutManager.setActiveLayout(req.params.layoutId);
    res.json({ success: true, data: layout });
  } catch (error) {
    logger.error('Failed to activate layout', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/layouts/from-template/:templateId', async (req, res) => {
  try {
    if (!layoutManager) {
      return res.status(500).json({ success: false, error: 'Layout Manager not initialized' });
    }
    
    const layout = await layoutManager.createFromTemplate(req.params.templateId, req.body);
    res.status(201).json({ success: true, data: layout });
  } catch (error) {
    logger.error('Failed to create layout from template', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/layouts/templates', async (req, res) => {
  try {
    if (!layoutManager) {
      return res.status(500).json({ success: false, error: 'Layout Manager not initialized' });
    }
    
    const templates = layoutManager.getLayoutTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Failed to get layout templates', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// GUI Editor endpoints
router.post('/editor/start/:layoutId', async (req, res) => {
  try {
    if (!guiEditor || !layoutManager) {
      return res.status(500).json({ success: false, error: 'GUI Editor or Layout Manager not initialized' });
    }
    
    const layout = guiEditor.startEditing(req.params.layoutId, layoutManager);
    res.json({ success: true, data: layout });
  } catch (error) {
    logger.error('Failed to start editing', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/editor/stop', async (req, res) => {
  try {
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    guiEditor.stopEditing();
    res.json({ success: true, message: 'Editing stopped' });
  } catch (error) {
    logger.error('Failed to stop editing', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/editor/state', async (req, res) => {
  try {
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    const state = guiEditor.getEditorState();
    res.json({ success: true, data: state });
  } catch (error) {
    logger.error('Failed to get editor state', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/editor/components', async (req, res) => {
  try {
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    const { componentType, position } = req.body;
    const component = guiEditor.addComponent(componentType, position);
    res.json({ success: true, data: component });
  } catch (error) {
    logger.error('Failed to add component', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/editor/components/:componentId', async (req, res) => {
  try {
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    const component = guiEditor.removeComponent(req.params.componentId);
    res.json({ success: true, data: component });
  } catch (error) {
    logger.error('Failed to remove component', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/editor/components/:componentId', async (req, res) => {
  try {
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    const component = guiEditor.updateComponent(req.params.componentId, req.body);
    res.json({ success: true, data: component });
  } catch (error) {
    logger.error('Failed to update component', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/editor/components/:componentId/move', async (req, res) => {
  try {
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    const component = guiEditor.moveComponent(req.params.componentId, req.body);
    res.json({ success: true, data: component });
  } catch (error) {
    logger.error('Failed to move component', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/editor/components/:componentId/select', async (req, res) => {
  try {
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    const componentId = guiEditor.selectComponent(req.params.componentId);
    res.json({ success: true, data: { componentId } });
  } catch (error) {
    logger.error('Failed to select component', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/editor/components/library', async (req, res) => {
  try {
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    const library = guiEditor.getComponentLibrary();
    res.json({ success: true, data: library });
  } catch (error) {
    logger.error('Failed to get component library', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/editor/save', async (req, res) => {
  try {
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    const layout = await guiEditor.saveLayout();
    res.json({ success: true, data: layout });
  } catch (error) {
    logger.error('Failed to save layout', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/editor/undo', async (req, res) => {
  try {
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    const layout = guiEditor.undo();
    res.json({ success: true, data: layout });
  } catch (error) {
    logger.error('Failed to undo', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/editor/redo', async (req, res) => {
  try {
    if (!guiEditor) {
      return res.status(500).json({ success: false, error: 'GUI Editor not initialized' });
    }
    
    const layout = guiEditor.redo();
    res.json({ success: true, data: layout });
  } catch (error) {
    logger.error('Failed to redo', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Connector integration endpoints
router.get('/connectors/ui-config', async (req, res) => {
  try {
    if (!connectorRegistry) {
      return res.status(500).json({ success: false, error: 'Connector Registry not initialized' });
    }
    
    const connectors = connectorRegistry.getConnectors();
    const uiConfigs = connectors.map(connector => ({
      id: connector.id,
      name: connector.name,
      type: connector.type,
      uiConfig: connector.getGuiConfig ? connector.getGuiConfig() : null,
      capabilities: connector.getCapabilities ? connector.getCapabilities() : []
    }));
    
    res.json({ success: true, data: uiConfigs });
  } catch (error) {
    logger.error('Failed to get connector UI configs', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/connectors/:connectorId/ui-config', async (req, res) => {
  try {
    if (!connectorRegistry) {
      return res.status(500).json({ success: false, error: 'Connector Registry not initialized' });
    }
    
    const connector = connectorRegistry.getConnectorById(req.params.connectorId);
    if (!connector) {
      return res.status(404).json({ success: false, error: 'Connector not found' });
    }
    
    const uiConfig = {
      id: connector.id,
      name: connector.name,
      type: connector.type,
      uiConfig: connector.getGuiConfig ? connector.getGuiConfig() : null,
      capabilities: connector.getCapabilities ? connector.getCapabilities() : []
    };
    
    res.json({ success: true, data: uiConfig });
  } catch (error) {
    logger.error('Failed to get connector UI config', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Main web GUI index
router.get('/web', (req, res) => {
  if (!connectorRegistry) {
    return res.status(500).send('Connector Registry not initialized');
  }
  // Find all connectors with a web interface
  const connectors = connectorRegistry.getConnectors().filter(connector => {
    return (
      connector.type === 'web-gui' ||
      connector.type === 'gui-designer' ||
      connector.webInterface
    );
  });

  // Build HTML
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Web GUIs</title>
  <style>
    body { font-family: sans-serif; background: #f8f9fa; margin: 0; padding: 2em; }
    h1 { color: #333; }
    ul { list-style: none; padding: 0; }
    li { margin: 1em 0; }
    a { color: #007bff; text-decoration: none; font-size: 1.2em; }
    a:hover { text-decoration: underline; }
    .desc { color: #666; font-size: 0.95em; }
    .box { background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; padding: 1.5em; max-width: 500px; margin: 2em auto; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Available Web GUIs</h1>
    <ul>`;

  if (connectors.length === 0) {
    html += '<li>No web GUIs found.</li>';
  } else {
    connectors.forEach(connector => {
      let url = '#';
      if (connector.webInterface && connector.webInterface.route) {
        url = connector.webInterface.route;
      } else if (connector.type === 'web-gui') {
        url = '/gui/web-gui';
      } else if (connector.type === 'gui-designer') {
        url = '/gui/designer';
      }
      html += `<li><a href="${url}" target="_blank">${connector.name || connector.id}</a><div class="desc">${connector.description || connector.type}</div></li>`;
    });
  }

  html += `</ul>
  </div>
</body>
</html>`;
  res.send(html);
});

// Redirect /gui to /web for convenience
router.get('/', (req, res) => {
  res.redirect('/gui/web');
});

const path = require('path');

// ... (keep the rest of the file as is)

// Web GUI interface
router.get('/web-gui', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'web', 'index.html'));
});

router.get('/web/app.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'web', 'app.js'));
});

// GUI Designer interface
router.get('/designer', (req, res) => {
  if (!connectorRegistry) {
    return res.status(500).send('Connector Registry not initialized');
  }
  
  const guiDesignerConnector = connectorRegistry.getConnector('gui-designer');
  if (!guiDesignerConnector) {
    return res.status(404).send('GUI Designer Connector not found');
  }

  // Get layouts
  const layouts = guiDesignerConnector.listLayouts();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GUI Designer - Looking Glass</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f9fa; 
      padding: 2em; 
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 1em; }
    .layout-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
      gap: 1em; 
      margin-top: 1em; 
    }
    .layout-card { 
      background: white; 
      padding: 1.5em; 
      border-radius: 8px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
    }
    .layout-name { font-weight: bold; margin-bottom: 0.5em; }
    .layout-actions { margin-top: 1em; }
    .btn { 
      padding: 0.5em 1em; 
      border: none; 
      border-radius: 4px; 
      cursor: pointer; 
      text-decoration: none; 
      display: inline-block; 
      margin-right: 0.5em; 
    }
    .btn-primary { background: #007bff; color: white; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-secondary { background: #6c757d; color: white; }
    .empty-state { text-align: center; color: #666; padding: 2em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎨 GUI Designer</h1>
    <p>Manage custom GUI layouts and designs.</p>
    
    <div class="layout-grid">
      ${layouts.length > 0 ? layouts.map(layout => `
        <div class="layout-card">
          <div class="layout-name">${layout}</div>
          <div class="layout-actions">
            <a href="/gui/designer/edit/${layout}" class="btn btn-primary">Edit</a>
            <button onclick="deleteLayout('${layout}')" class="btn btn-danger">Delete</button>
          </div>
        </div>
      `).join('') : `
        <div class="empty-state">
          <h3>No layouts found</h3>
          <p>Create your first layout to get started.</p>
          <a href="/gui/designer/new" class="btn btn-primary">Create Layout</a>
        </div>
      `}
    </div>
  </div>
  
  <script>
    async function deleteLayout(id) {
      if (confirm('Are you sure you want to delete this layout?')) {
        try {
          const response = await fetch('/api/layouts/' + id, { method: 'DELETE' });
          if (response.ok) {
            location.reload();
          } else {
            alert('Failed to delete layout');
          }
        } catch (error) {
          alert('Error deleting layout: ' + error.message);
        }
      }
    }
  </script>
</body>
</html>`;

  res.send(html);
});

// Configuration management interface
router.get('/config', (req, res) => {
  if (!connectorRegistry) {
    return res.status(500).send('Connector Registry not initialized');
  }

  // Get current connectors
  const connectors = connectorRegistry.getConnectors();
  
  // Get available connector types
  const connectorTypes = Array.from(connectorRegistry.getTypes()).map(type => ({
    type: type.type,
    name: type.metadata.name,
    description: type.metadata.description
  }));

  // Check if this is first load (no connectors)
  const isFirstLoad = connectors.length === 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Configuration - Looking Glass</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f9fa; 
      padding: 2em; 
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 1em; }
    .tabs { 
      display: flex; 
      border-bottom: 2px solid #dee2e6; 
      margin-bottom: 2em; 
    }
    .tab { 
      padding: 1em 2em; 
      cursor: pointer; 
      border-bottom: 2px solid transparent; 
      transition: all 0.3s; 
    }
    .tab.active { 
      border-bottom-color: #007bff; 
      color: #007bff; 
      font-weight: bold; 
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .connector-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); 
      gap: 1em; 
      margin-top: 1em; 
    }
    .connector-card { 
      background: white; 
      padding: 1.5em; 
      border-radius: 8px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
      border-left: 4px solid #28a745; 
    }
    .connector-card.disconnected { border-left-color: #dc3545; }
    .connector-card.connecting { border-left-color: #ffc107; }
    .connector-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 1em; 
    }
    .connector-name { font-weight: bold; font-size: 1.1em; }
    .connector-status { 
      padding: 0.25em 0.5em; 
      border-radius: 4px; 
      font-size: 0.8em; 
      font-weight: bold; 
    }
    .status-connected { background: #d4edda; color: #155724; }
    .status-disconnected { background: #f8d7da; color: #721c24; }
    .status-connecting { background: #fff3cd; color: #856404; }
    .connector-description { color: #666; margin-bottom: 1em; }
    .connector-actions { margin-top: 1em; }
    .btn { 
      padding: 0.5em 1em; 
      border: none; 
      border-radius: 4px; 
      cursor: pointer; 
      text-decoration: none; 
      display: inline-block; 
      margin-right: 0.5em; 
      font-size: 0.9em; 
    }
    .btn-primary { background: #007bff; color: white; }
    .btn-success { background: #28a745; color: white; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-warning { background: #ffc107; color: #212529; }
    .btn-secondary { background: #6c757d; color: white; }
    .form-group { margin-bottom: 1em; }
    .form-label { display: block; margin-bottom: 0.5em; font-weight: bold; }
    .form-input { 
      width: 100%; 
      padding: 0.5em; 
      border: 1px solid #ddd; 
      border-radius: 4px; 
      font-size: 1em; 
    }
    .form-textarea { 
      width: 100%; 
      padding: 0.5em; 
      border: 1px solid #ddd; 
      border-radius: 4px; 
      font-size: 1em; 
      min-height: 100px; 
      font-family: monospace; 
    }
    .modal { 
      display: none; 
      position: fixed; 
      top: 0; 
      left: 0; 
      width: 100%; 
      height: 100%; 
      background: rgba(0,0,0,0.5); 
      z-index: 1000; 
    }
    .modal-content { 
      background: white; 
      margin: 5% auto; 
      padding: 2em; 
      border-radius: 8px; 
      max-width: 600px; 
      max-height: 80vh; 
      overflow-y: auto; 
    }
    .modal-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 1em; 
      padding-bottom: 1em; 
      border-bottom: 1px solid #eee; 
    }
    .close { 
      font-size: 1.5em; 
      cursor: pointer; 
      color: #666; 
    }
    .alert { 
      padding: 1em; 
      border-radius: 4px; 
      margin-bottom: 1em; 
    }
    .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .alert-warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
    .server-actions { 
      background: white; 
      padding: 1.5em; 
      border-radius: 8px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
      margin-top: 2em; 
    }
    .server-actions h3 { margin-bottom: 1em; }
    .action-buttons { display: flex; gap: 1em; }
    .welcome-message {
      background: #e3f2fd;
      border: 1px solid #2196f3;
      border-radius: 8px;
      padding: 1.5em;
      margin-bottom: 2em;
    }
    .quick-setup {
      background: white;
      border-radius: 8px;
      padding: 1.5em;
      margin-bottom: 2em;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .quick-setup h3 { margin-bottom: 1em; color: #333; }
    .setup-options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1em;
      margin-top: 1em;
    }
    .setup-option {
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 1em;
      cursor: pointer;
      transition: all 0.3s;
    }
    .setup-option:hover {
      border-color: #007bff;
      background: #f8f9fa;
    }
    .setup-option.selected {
      border-color: #007bff;
      background: #e3f2fd;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚙️ Configuration</h1>
    <p>Manage connectors and system configuration.</p>
    
    ${isFirstLoad ? `
    <div class="welcome-message">
      <h2>🎉 Welcome to Looking Glass!</h2>
      <p>This appears to be your first time setting up the system. Let's get you started with some common configurations.</p>
    </div>
    
    <div class="quick-setup">
      <h3>🚀 Quick Setup</h3>
      <p>Choose a preset configuration to get started quickly:</p>
      <div class="setup-options">
        <div class="setup-option" onclick="loadPreset('unifi-protect')">
          <h4>📹 UniFi Protect</h4>
          <p>Connect to UniFi Protect cameras for motion detection and recording</p>
        </div>
        <div class="setup-option" onclick="loadPreset('telegram')">
          <h4>💬 Telegram Bot</h4>
          <p>Set up notifications via Telegram bot</p>
        </div>
        <div class="setup-option" onclick="loadPreset('mqtt')">
          <h4>📡 MQTT</h4>
          <p>Connect to MQTT broker for IoT integration</p>
        </div>
        <div class="setup-option" onclick="loadPreset('adsb')">
          <h4>✈️ ADSB</h4>
          <p>Track aircraft with ADSB receiver</p>
        </div>
      </div>
    </div>
    ` : ''}
    
    <div class="tabs">
      <div class="tab active" onclick="showTab('connectors')">Connectors</div>
      <div class="tab" onclick="showTab('add')">Add Connector</div>
      <div class="tab" onclick="showTab('server')">Server</div>
    </div>
    
    <div id="connectors" class="tab-content active">
      <h2>Active Connectors</h2>
      ${connectors.length === 0 ? `
        <div class="alert alert-warning">
          <strong>No connectors configured.</strong> Add your first connector to get started!
        </div>
      ` : `
        <div class="connector-grid">
          ${connectors.map(connector => `
            <div class="connector-card ${connector.status}">
              <div class="connector-header">
                <div class="connector-name">${connector.name || connector.id}</div>
                <div class="connector-status status-${connector.status}">${connector.status}</div>
              </div>
              <div class="connector-description">${connector.description || connector.type}</div>
              <div class="connector-actions">
                <button onclick="editConnector('${connector.id}')" class="btn btn-primary">Edit</button>
                <button onclick="toggleConnector('${connector.id}')" class="btn btn-${connector.status === 'connected' ? 'danger' : 'success'}">
                  ${connector.status === 'connected' ? 'Disconnect' : 'Connect'}
                </button>
                <button onclick="deleteConnector('${connector.id}')" class="btn btn-danger">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
    
    <div id="add" class="tab-content">
      <h2>Add New Connector</h2>
      <form id="addConnectorForm">
        <div class="form-group">
          <label class="form-label">Connector Type</label>
          <select id="connectorType" class="form-input" onchange="updateConfigTemplate()">
            <option value="">Select a connector type...</option>
            ${connectorTypes.map(type => `
              <option value="${type.type}">${type.name} - ${type.description}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Connector ID</label>
          <input type="text" id="connectorId" class="form-input" placeholder="e.g., telegram-bot" required>
        </div>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" id="connectorName" class="form-input" placeholder="e.g., Telegram Bot" required>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" id="connectorDescription" class="form-input" placeholder="e.g., Telegram bot for notifications">
        </div>
        <div class="form-group">
          <label class="form-label">Configuration (JSON)</label>
          <textarea id="connectorConfig" class="form-textarea" placeholder="{}"></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Add Connector</button>
      </form>
    </div>
    
    <div id="server" class="tab-content">
      <div class="server-actions">
        <h3>Server Management</h3>
        <div class="action-buttons">
          <button onclick="saveConfiguration()" class="btn btn-success">💾 Save Configuration</button>
          <button onclick="restartServer()" class="btn btn-warning">🔄 Restart Server</button>
          <button onclick="reloadConnectors()" class="btn btn-secondary">🔄 Reload Connectors</button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Edit Connector Modal -->
  <div id="editModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Edit Connector</h3>
        <span class="close" onclick="closeModal()">&times;</span>
      </div>
      <div id="editForm"></div>
    </div>
  </div>
  
  <script>
    // Define showTab function first
    function showTab(tabName) {
      // Hide all tabs
      document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      
      // Show selected tab
      document.getElementById(tabName).classList.add('active');
      event.target.classList.add('active');
    }
    
    function updateConfigTemplate() {
      const type = document.getElementById('connectorType').value;
      const configTextarea = document.getElementById('connectorConfig');
      
      const templates = {
        'telegram': '{\n  "token": "YOUR_BOT_TOKEN_HERE"\n}',
        'mqtt': '{\n  "host": "localhost",\n  "port": 1883,\n  "username": "",\n  "password": ""\n}',
        'unifi-protect': '{\n  "host": "10.0.0.1",\n  "port": 443,\n  "apiKey": "YOUR_API_KEY",\n  "verifySSL": false\n}',
        'adsb': '{\n  "url": "http://localhost:8080/data/aircraft.json",\n  "pollInterval": 5000\n}'
      };
      
      configTextarea.value = templates[type] || '{}';
    }
    
    async function saveConfiguration() {
      try {
        const response = await fetch('/api/config/save', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
          showAlert('Configuration saved successfully!', 'success');
        } else {
          showAlert('Failed to save configuration: ' + result.error, 'error');
        }
      } catch (error) {
        showAlert('Error saving configuration: ' + error.message, 'error');
      }
    }
    
    async function restartServer() {
      if (confirm('Are you sure you want to restart the server? This will disconnect all clients.')) {
        try {
          const response = await fetch('/api/server/restart', { method: 'POST' });
          const result = await response.json();
          
          if (result.success) {
            showAlert('Server restart initiated. Please wait...', 'warning');
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          } else {
            showAlert('Failed to restart server: ' + result.error, 'error');
          }
        } catch (error) {
          showAlert('Error restarting server: ' + error.message, 'error');
        }
      }
    }
    
    async function reloadConnectors() {
      try {
        const response = await fetch('/api/connectors/reload', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
          showAlert('Connectors reloaded successfully!', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showAlert('Failed to reload connectors: ' + result.error, 'error');
        }
      } catch (error) {
        showAlert('Error reloading connectors: ' + error.message, 'error');
      }
    }
    
    async function toggleConnector(id) {
      try {
        const response = await fetch('/api/connectors/' + id + '/toggle', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showAlert('Failed to toggle connector: ' + result.error, 'error');
        }
      } catch (error) {
        showAlert('Error toggling connector: ' + error.message, 'error');
      }
    }
    
    async function deleteConnector(id) {
      if (confirm('Are you sure you want to delete this connector?')) {
        try {
          const response = await fetch('/api/connectors/' + id, { method: 'DELETE' });
          const result = await response.json();
          
          if (result.success) {
            showAlert('Connector deleted successfully!', 'success');
            setTimeout(() => window.location.reload(), 1000);
          } else {
            showAlert('Failed to delete connector: ' + result.error, 'error');
          }
        } catch (error) {
          showAlert('Error deleting connector: ' + error.message, 'error');
        }
      }
    }
    
    function editConnector(id) {
      // TODO: Implement edit modal
      alert('Edit functionality coming soon!');
    }
    
    function closeModal() {
      document.getElementById('editModal').style.display = 'none';
    }
    
    function showAlert(message, type) {
      const alert = document.createElement('div');
      alert.className = 'alert alert-' + type;
      alert.textContent = message;
      
      const container = document.querySelector('.container');
      container.insertBefore(alert, container.firstChild);
      
      setTimeout(() => alert.remove(), 5000);
    }
    
    // Handle form submission
    document.addEventListener('DOMContentLoaded', function() {
      const form = document.getElementById('addConnectorForm');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = {
            id: document.getElementById('connectorId').value,
            type: document.getElementById('connectorType').value,
            name: document.getElementById('connectorName').value,
            description: document.getElementById('connectorDescription').value,
            config: JSON.parse(document.getElementById('connectorConfig').value || '{}')
          };
          
          try {
            const response = await fetch('/api/connectors', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
              showAlert('Connector added successfully!', 'success');
              form.reset();
              document.getElementById('connectorConfig').value = '{}';
            } else {
              showAlert('Failed to add connector: ' + result.error, 'error');
            }
          } catch (error) {
            showAlert('Error adding connector: ' + error.message, 'error');
          }
        });
      }
    });
  </script>
</body>
</html>`;

  res.send(html);
});

/**
 * POST /api/config/defaults
 * Create default configuration if none exists
 */
router.post('/defaults', async (req, res) => {
  try {
    if (!connectorRegistry) {
      return res.status(500).json({
        success: false,
        error: 'Connector Registry not initialized'
      });
    }

    const connectors = connectorRegistry.getConnectors();
    
    // Only create defaults if no connectors exist
    if (connectors.length === 0) {
      const defaultConnectors = [
        {
          id: 'unifi-protect-main',
          type: 'unifi-protect',
          name: 'UniFi Protect',
          description: 'Main UniFi Protect system',
          config: {
            host: '10.0.0.1',
            port: 443,
            apiKey: 'YOUR_API_KEY_HERE',
            verifySSL: false
          }
        },
        {
          id: 'telegram-bot',
          type: 'telegram',
          name: 'Telegram Bot',
          description: 'Telegram bot for notifications',
          config: {
            token: 'YOUR_BOT_TOKEN_HERE'
          }
        }
      ];

      const results = [];
      for (const connector of defaultConnectors) {
        try {
          const result = await connectorRegistry.createConnector(connector);
          results.push({ ...connector, success: true, result });
        } catch (error) {
          results.push({ ...connector, success: false, error: error.message });
        }
      }

      res.json({
        success: true,
        message: 'Default configuration created',
        results
      });
    } else {
      res.json({
        success: true,
        message: 'Configuration already exists, no defaults needed',
        connectors: connectors.length
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/config/status
 * Get configuration status and health
 */
router.get('/status', async (req, res) => {
  try {
    if (!connectorRegistry) {
      return res.status(500).json({
        success: false,
        error: 'Connector Registry not initialized'
      });
    }

    const connectors = connectorRegistry.getConnectors();
    const isFirstLoad = connectors.length === 0;
    
    const status = {
      isFirstLoad,
      totalConnectors: connectors.length,
      connectedConnectors: connectors.filter(c => c.status === 'connected').length,
      connectorTypes: Array.from(new Set(connectors.map(c => c.type))),
      health: {
        registry: !!connectorRegistry,
        database: true, // TODO: Add database health check
        services: true  // TODO: Add service health checks
      }
    };

    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /flows
 * Visual Flow Builder Interface
 */
router.get('/flows', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Builder - Babelfish Looking Glass</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #1a1a1a;
            color: #ffffff;
            overflow: hidden;
        }

        .header {
            background: #2d2d2d;
            padding: 1rem;
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .header h1 {
            color: #00d4ff;
            font-size: 1.5rem;
        }

        .toolbar {
            display: flex;
            gap: 1rem;
        }

        .btn {
            background: #00d4ff;
            color: #000;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: background 0.2s;
        }

        .btn:hover {
            background: #00b8e6;
        }

        .btn.secondary {
            background: #444;
            color: #fff;
        }

        .btn.secondary:hover {
            background: #555;
        }

        .main-container {
            display: flex;
            height: calc(100vh - 80px);
        }

        .sidebar {
            width: 300px;
            background: #2d2d2d;
            border-right: 1px solid #444;
            display: flex;
            flex-direction: column;
        }

        .sidebar-section {
            padding: 1rem;
            border-bottom: 1px solid #444;
        }

        .sidebar-section h3 {
            color: #00d4ff;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .node-palette {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.5rem;
        }

        .node-item {
            background: #3d3d3d;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 0.75rem;
            cursor: grab;
            transition: all 0.2s;
            user-select: none;
        }

        .node-item:hover {
            background: #4d4d4d;
            border-color: #00d4ff;
        }

        .node-item.dragging {
            opacity: 0.5;
        }

        .node-item h4 {
            color: #00d4ff;
            font-size: 0.8rem;
            margin-bottom: 0.25rem;
        }

        .node-item p {
            font-size: 0.7rem;
            color: #ccc;
        }

        .flow-canvas {
            flex: 1;
            background: #1a1a1a;
            position: relative;
            overflow: auto;
        }

        .canvas-grid {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 20px 20px;
        }

        .flow-node {
            position: absolute;
            background: #3d3d3d;
            border: 2px solid #555;
            border-radius: 8px;
            padding: 1rem;
            min-width: 150px;
            cursor: move;
            user-select: none;
            transition: all 0.2s;
        }

        .flow-node:hover {
            border-color: #00d4ff;
            box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
        }

        .flow-node.selected {
            border-color: #00d4ff;
            box-shadow: 0 0 15px rgba(0, 212, 255, 0.5);
        }

        .flow-node.trigger {
            border-color: #ff6b6b;
        }

        .flow-node.action {
            border-color: #4ecdc4;
        }

        .flow-node.condition {
            border-color: #ffe66d;
        }

        .node-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }

        .node-title {
            font-weight: 600;
            font-size: 0.9rem;
            color: #fff;
        }

        .node-type {
            font-size: 0.7rem;
            color: #888;
            text-transform: uppercase;
        }

        .node-content {
            font-size: 0.8rem;
            color: #ccc;
        }

        .node-ports {
            position: absolute;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }

        .port {
            position: absolute;
            width: 12px;
            height: 12px;
            background: #555;
            border: 2px solid #333;
            border-radius: 50%;
            pointer-events: all;
            cursor: crosshair;
            transition: all 0.2s;
        }

        .port:hover {
            background: #00d4ff;
            border-color: #00d4ff;
        }

        .port.input {
            left: -6px;
            top: 50%;
            transform: translateY(-50%);
        }

        .port.output {
            right: -6px;
            top: 50%;
            transform: translateY(-50%);
        }

        .connection {
            position: absolute;
            pointer-events: none;
            z-index: 1;
        }

        .connection-line {
            stroke: #555;
            stroke-width: 2;
            fill: none;
        }

        .connection-line.active {
            stroke: #00d4ff;
            stroke-width: 3;
        }

        .properties-panel {
            width: 300px;
            background: #2d2d2d;
            border-left: 1px solid #444;
            padding: 1rem;
            overflow-y: auto;
        }

        .properties-panel h3 {
            color: #00d4ff;
            margin-bottom: 1rem;
            font-size: 1rem;
        }

        .property-group {
            margin-bottom: 1rem;
        }

        .property-group label {
            display: block;
            font-size: 0.8rem;
            color: #ccc;
            margin-bottom: 0.25rem;
        }

        .property-group input,
        .property-group select,
        .property-group textarea {
            width: 100%;
            background: #3d3d3d;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 0.5rem;
            color: #fff;
            font-size: 0.8rem;
        }

        .property-group input:focus,
        .property-group select:focus,
        .property-group textarea:focus {
            outline: none;
            border-color: #00d4ff;
        }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 1000;
        }

        .modal-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #2d2d2d;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 2rem;
            min-width: 400px;
        }

        .modal h2 {
            color: #00d4ff;
            margin-bottom: 1rem;
        }

        .modal-buttons {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
            margin-top: 1rem;
        }

        .template-list {
            max-height: 300px;
            overflow-y: auto;
        }

        .template-item {
            background: #3d3d3d;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 1rem;
            margin-bottom: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .template-item:hover {
            background: #4d4d4d;
            border-color: #00d4ff;
        }

        .template-item h4 {
            color: #00d4ff;
            margin-bottom: 0.25rem;
        }

        .template-item p {
            font-size: 0.8rem;
            color: #ccc;
        }

        .flow-list {
            max-height: 400px;
            overflow-y: auto;
        }

        .flow-item {
            background: #3d3d3d;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .flow-item:hover {
            background: #4d4d4d;
            border-color: #00d4ff;
        }

        .flow-item h4 {
            color: #00d4ff;
            margin-bottom: 0.25rem;
        }

        .flow-item p {
            font-size: 0.7rem;
            color: #ccc;
            margin-bottom: 0.5rem;
        }

        .flow-status {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }

        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #555;
        }

        .status-indicator.enabled {
            background: #4ecdc4;
        }

        .status-indicator.executing {
            background: #ffe66d;
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .zoom-controls {
            position: absolute;
            bottom: 1rem;
            right: 1rem;
            display: flex;
            gap: 0.5rem;
        }

        .zoom-btn {
            width: 40px;
            height: 40px;
            background: #3d3d3d;
            border: 1px solid #555;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
        }

        .zoom-btn:hover {
            background: #4d4d4d;
            border-color: #00d4ff;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔗 Flow Builder</h1>
        <div class="toolbar">
            <button class="btn" onclick="newFlow()">New Flow</button>
            <button class="btn" onclick="saveFlow()">Save Flow</button>
            <button class="btn" onclick="loadFlow()">Load Flow</button>
            <button class="btn secondary" onclick="showTemplates()">Templates</button>
            <button class="btn secondary" onclick="window.location.href='/'">Back to Dashboard</button>
        </div>
    </div>

    <div class="main-container">
        <div class="sidebar">
            <div class="sidebar-section">
                <h3>Node Palette</h3>
                <div class="node-palette">
                    <div class="node-item" draggable="true" data-type="trigger" data-node-type="smartDetectLoiterZone">
                        <h4>Loitering Trigger</h4>
                        <p>Detect loitering events</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="trigger" data-node-type="motion">
                        <h4>Motion Trigger</h4>
                        <p>Detect motion events</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="trigger" data-node-type="smartDetectZone">
                        <h4>Zone Trigger</h4>
                        <p>Detect zone events</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="action" data-action-type="connector_execute">
                        <h4>Get Snapshot</h4>
                        <p>Get camera snapshot</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="action" data-action-type="telegram_send">
                        <h4>Send Telegram</h4>
                        <p>Send message to Telegram</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="action" data-action-type="send_notification">
                        <h4>Send Notification</h4>
                        <p>Send system notification</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="condition">
                        <h4>Condition</h4>
                        <p>Check conditions</p>
                    </div>
                </div>
            </div>

            <div class="sidebar-section">
                <h3>Flows</h3>
                <div class="flow-list" id="flowList">
                    <!-- Flows will be loaded here -->
                </div>
            </div>
        </div>

        <div class="flow-canvas" id="flowCanvas">
            <div class="canvas-grid"></div>
            <!-- Flow nodes will be added here -->
        </div>

        <div class="properties-panel" id="propertiesPanel">
            <h3>Properties</h3>
            <div id="propertiesContent">
                <p style="color: #888; font-size: 0.8rem;">Select a node to edit its properties</p>
            </div>
        </div>
    </div>

    <div class="zoom-controls">
        <button class="zoom-btn" onclick="zoomIn()">+</button>
        <button class="zoom-btn" onclick="zoomOut()">-</button>
        <button class="zoom-btn" onclick="resetZoom()">⌂</button>
    </div>

    <!-- Templates Modal -->
    <div class="modal" id="templatesModal">
        <div class="modal-content">
            <h2>Flow Templates</h2>
            <div class="template-list" id="templateList">
                <!-- Templates will be loaded here -->
            </div>
            <div class="modal-buttons">
                <button class="btn secondary" onclick="closeModal('templatesModal')">Cancel</button>
            </div>
        </div>
    </div>

    <!-- Load Flow Modal -->
    <div class="modal" id="loadFlowModal">
        <div class="modal-content">
            <h2>Load Flow</h2>
            <div class="flow-list" id="loadFlowList">
                <!-- Flows will be loaded here -->
            </div>
            <div class="modal-buttons">
                <button class="btn secondary" onclick="closeModal('loadFlowModal')">Cancel</button>
            </div>
        </div>
    </div>

    <script>
        // Global variables
        let currentFlow = {
            id: null,
            name: 'New Flow',
            description: '',
            nodes: [],
            connections: [],
            config: {}
        };
        
        let selectedNode = null;
        let draggingNode = null;
        let connectingFrom = null;
        let zoom = 1;
        let pan = { x: 0, y: 0 };

        // Initialize the flow builder
        document.addEventListener('DOMContentLoaded', function() {
            initializeFlowBuilder();
            loadFlows();
            loadTemplates();
        });

        function initializeFlowBuilder() {
            setupDragAndDrop();
            setupCanvasEvents();
            setupNodeEvents();
        }

        function setupDragAndDrop() {
            const nodeItems = document.querySelectorAll('.node-item');
            const canvas = document.getElementById('flowCanvas');

            nodeItems.forEach(item => {
                item.addEventListener('dragstart', handleDragStart);
                item.addEventListener('dragend', handleDragEnd);
            });

            canvas.addEventListener('dragover', handleDragOver);
            canvas.addEventListener('drop', handleDrop);
        }

        function handleDragStart(e) {
            draggingNode = {
                type: e.target.dataset.type,
                nodeType: e.target.dataset.nodeType,
                actionType: e.target.dataset.actionType
            };
            e.target.classList.add('dragging');
        }

        function handleDragEnd(e) {
            e.target.classList.remove('dragging');
            draggingNode = null;
        }

        function handleDragOver(e) {
            e.preventDefault();
        }

        function handleDrop(e) {
            e.preventDefault();
            if (!draggingNode) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left - pan.x) / zoom;
            const y = (e.clientY - rect.top - pan.y) / zoom;

            createNode(draggingNode, x, y);
        }

        function createNode(nodeData, x, y) {
            const nodeId = 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            let nodeConfig = {
                id: nodeId,
                type: nodeData.type,
                name: getNodeName(nodeData),
                position: { x, y },
                config: {}
            };

            if (nodeData.type === 'trigger') {
                nodeConfig.config.eventType = nodeData.nodeType;
            } else if (nodeData.type === 'action') {
                nodeConfig.config.actionType = nodeData.actionType;
            }

            currentFlow.nodes.push(nodeConfig);
            renderNode(nodeConfig);
        }

        function getNodeName(nodeData) {
            if (nodeData.type === 'trigger') {
                switch (nodeData.nodeType) {
                    case 'smartDetectLoiterZone': return 'Loitering Trigger';
                    case 'motion': return 'Motion Trigger';
                    case 'smartDetectZone': return 'Zone Trigger';
                    default: return 'Trigger';
                }
            } else if (nodeData.type === 'action') {
                switch (nodeData.actionType) {
                    case 'connector_execute': return 'Get Snapshot';
                    case 'telegram_send': return 'Send Telegram';
                    case 'send_notification': return 'Send Notification';
                    default: return 'Action';
                }
            } else {
                return 'Condition';
            }
        }

        function renderNode(node) {
            const canvas = document.getElementById('flowCanvas');
            const nodeElement = document.createElement('div');
            nodeElement.className = \`flow-node \${node.type}\`;
            nodeElement.id = node.id;
            nodeElement.style.left = node.position.x + 'px';
            nodeElement.style.top = node.position.y + 'px';

            nodeElement.innerHTML = \`
                <div class="node-header">
                    <div class="node-title">\${node.name}</div>
                    <div class="node-type">\${node.type}</div>
                </div>
                <div class="node-content">
                    \${getNodeContent(node)}
                </div>
                <div class="node-ports">
                    <div class="port input" data-node="\${node.id}" data-port="input"></div>
                    <div class="port output" data-node="\${node.id}" data-port="output"></div>
                </div>
            \`;

            canvas.appendChild(nodeElement);
            setupNodeEvents(nodeElement);
        }

        function getNodeContent(node) {
            if (node.type === 'trigger') {
                return \`Event: \${node.config.eventType || 'Unknown'}\`;
            } else if (node.type === 'action') {
                return \`Action: \${node.config.actionType || 'Unknown'}\`;
            } else {
                return 'Condition check';
            }
        }

        function setupNodeEvents(nodeElement) {
            nodeElement.addEventListener('click', (e) => {
                e.stopPropagation();
                selectNode(nodeElement);
            });

            nodeElement.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('port')) return;
                startNodeDrag(nodeElement, e);
            });

            const ports = nodeElement.querySelectorAll('.port');
            ports.forEach(port => {
                port.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    startConnection(port);
                });
            });
        }

        function selectNode(nodeElement) {
            // Remove previous selection
            document.querySelectorAll('.flow-node').forEach(node => {
                node.classList.remove('selected');
            });

            // Select new node
            nodeElement.classList.add('selected');
            selectedNode = currentFlow.nodes.find(n => n.id === nodeElement.id);
            showNodeProperties(selectedNode);
        }

        function showNodeProperties(node) {
            const panel = document.getElementById('propertiesContent');
            
            if (!node) {
                panel.innerHTML = '<p style="color: #888; font-size: 0.8rem;">Select a node to edit its properties</p>';
                return;
            }

            let html = \`
                <div class="property-group">
                    <label>Name</label>
                    <input type="text" value="\${node.name}" onchange="updateNodeProperty('\${node.id}', 'name', this.value)">
                </div>
            \`;

            if (node.type === 'trigger') {
                html += \`
                    <div class="property-group">
                        <label>Event Type</label>
                        <select onchange="updateNodeProperty('\${node.id}', 'config.eventType', this.value)">
                            <option value="smartDetectLoiterZone" \${node.config.eventType === 'smartDetectLoiterZone' ? 'selected' : ''}>Loitering Detection</option>
                            <option value="motion" \${node.config.eventType === 'motion' ? 'selected' : ''}>Motion Detection</option>
                            <option value="smartDetectZone" \${node.config.eventType === 'smartDetectZone' ? 'selected' : ''}>Zone Detection</option>
                        </select>
                    </div>
                \`;
            } else if (node.type === 'action') {
                html += \`
                    <div class="property-group">
                        <label>Action Type</label>
                        <select onchange="updateNodeProperty('\${node.id}', 'config.actionType', this.value)">
                            <option value="connector_execute" \${node.config.actionType === 'connector_execute' ? 'selected' : ''}>Get Snapshot</option>
                            <option value="telegram_send" \${node.config.actionType === 'telegram_send' ? 'selected' : ''}>Send Telegram</option>
                            <option value="send_notification" \${node.config.actionType === 'send_notification' ? 'selected' : ''}>Send Notification</option>
                        </select>
                    </div>
                \`;
            }

            panel.innerHTML = html;
        }

        function updateNodeProperty(nodeId, property, value) {
            const node = currentFlow.nodes.find(n => n.id === nodeId);
            if (!node) return;

            if (property.includes('.')) {
                const parts = property.split('.');
                let current = node;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) current[parts[i]] = {};
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = value;
            } else {
                node[property] = value;
            }

            // Update node display
            const nodeElement = document.getElementById(nodeId);
            if (nodeElement) {
                const titleElement = nodeElement.querySelector('.node-title');
                const contentElement = nodeElement.querySelector('.node-content');
                
                if (titleElement) titleElement.textContent = node.name;
                if (contentElement) contentElement.textContent = getNodeContent(node);
            }
        }

        function startNodeDrag(nodeElement, e) {
            const startX = e.clientX - nodeElement.offsetLeft;
            const startY = e.clientY - nodeElement.offsetTop;

            function onMouseMove(e) {
                const newX = e.clientX - startX;
                const newY = e.clientY - startY;
                
                nodeElement.style.left = newX + 'px';
                nodeElement.style.top = newY + 'px';
                
                // Update node position in data
                const node = currentFlow.nodes.find(n => n.id === nodeElement.id);
                if (node) {
                    node.position = { x: newX, y: newY };
                }
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        function startConnection(port) {
            connectingFrom = port;
            port.style.background = '#00d4ff';
            port.style.borderColor = '#00d4ff';
        }

        function setupCanvasEvents() {
            const canvas = document.getElementById('flowCanvas');
            
            canvas.addEventListener('click', (e) => {
                if (e.target === canvas) {
                    selectedNode = null;
                    showNodeProperties(null);
                    document.querySelectorAll('.flow-node').forEach(node => {
                        node.classList.remove('selected');
                    });
                }
            });

            canvas.addEventListener('mousemove', (e) => {
                if (connectingFrom) {
                    // Draw connection line
                    drawConnectionLine(connectingFrom, e);
                }
            });

            canvas.addEventListener('mouseup', (e) => {
                if (connectingFrom) {
                    const targetPort = e.target.closest('.port');
                    if (targetPort && targetPort !== connectingFrom) {
                        createConnection(connectingFrom, targetPort);
                    }
                    connectingFrom.style.background = '#555';
                    connectingFrom.style.borderColor = '#333';
                    connectingFrom = null;
                    clearConnectionLine();
                }
            });
        }

        function drawConnectionLine(fromPort, e) {
            // Implementation for drawing connection line
        }

        function clearConnectionLine() {
            // Implementation for clearing connection line
        }

        function createConnection(fromPort, toPort) {
            const connection = {
                id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                from: fromPort.dataset.node,
                to: toPort.dataset.node,
                fromPort: fromPort.dataset.port,
                toPort: toPort.dataset.port,
                type: 'success'
            };

            currentFlow.connections.push(connection);
            renderConnection(connection);
        }

        function renderConnection(connection) {
            // Implementation for rendering connection line
        }

        // Flow management functions
        function newFlow() {
            currentFlow = {
                id: null,
                name: 'New Flow',
                description: '',
                nodes: [],
                connections: [],
                config: {}
            };
            
            // Clear canvas
            const canvas = document.getElementById('flowCanvas');
            canvas.innerHTML = '<div class="canvas-grid"></div>';
            
            selectedNode = null;
            showNodeProperties(null);
        }

        async function saveFlow() {
            if (!currentFlow.name) {
                alert('Please enter a flow name');
                return;
            }

            try {
                const response = await fetch('/api/flows', {
                    method: currentFlow.id ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(currentFlow)
                });

                const result = await response.json();
                
                if (result.success) {
                    currentFlow = result.data;
                    alert('Flow saved successfully!');
                    loadFlows();
                } else {
                    alert('Error saving flow: ' + result.error);
                }
            } catch (error) {
                alert('Error saving flow: ' + error.message);
            }
        }

        function loadFlow() {
            showModal('loadFlowModal');
        }

        async function loadFlowById(flowId) {
            try {
                const response = await fetch(\`/api/flows/\${flowId}\`);
                const result = await response.json();
                
                if (result.success) {
                    currentFlow = result.data;
                    
                    // Clear canvas
                    const canvas = document.getElementById('flowCanvas');
                    canvas.innerHTML = '<div class="canvas-grid"></div>';
                    
                    // Render nodes
                    currentFlow.nodes.forEach(node => renderNode(node));
                    
                    // Render connections
                    currentFlow.connections.forEach(conn => renderConnection(conn));
                    
                    closeModal('loadFlowModal');
                } else {
                    alert('Error loading flow: ' + result.error);
                }
            } catch (error) {
                alert('Error loading flow: ' + error.message);
            }
        }

        async function loadFlows() {
            try {
                const response = await fetch('/api/flows');
                const result = await response.json();
                
                if (result.success) {
                    const flowList = document.getElementById('flowList');
                    flowList.innerHTML = '';
                    
                    result.data.forEach(flow => {
                        const flowItem = document.createElement('div');
                        flowItem.className = 'flow-item';
                        flowItem.innerHTML = \`
                            <h4>\${flow.name}</h4>
                            <p>\${flow.description || 'No description'}</p>
                            <div class="flow-status">
                                <div class="status-indicator \${flow.enabled ? 'enabled' : ''}"></div>
                                <span>\${flow.enabled ? 'Enabled' : 'Disabled'}</span>
                            </div>
                        \`;
                        flowItem.onclick = () => loadFlowById(flow.id);
                        flowList.appendChild(flowItem);
                    });
                }
            } catch (error) {
                console.error('Error loading flows:', error);
            }
        }

        async function loadTemplates() {
            try {
                const response = await fetch('/api/flows/templates');
                const result = await response.json();
                
                if (result.success) {
                    const templateList = document.getElementById('templateList');
                    templateList.innerHTML = '';
                    
                    result.data.forEach(template => {
                        const templateItem = document.createElement('div');
                        templateItem.className = 'template-item';
                        templateItem.innerHTML = \`
                            <h4>\${template.name}</h4>
                            <p>\${template.description}</p>
                        \`;
                        templateItem.onclick = () => createFromTemplate(template.id);
                        templateList.appendChild(templateItem);
                    });
                }
            } catch (error) {
                console.error('Error loading templates:', error);
            }
        }

        async function createFromTemplate(templateId) {
            try {
                const response = await fetch(\`/api/flows/template/\${templateId}\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: 'Copy of ' + templateId,
                        description: 'Created from template'
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    currentFlow = result.data;
                    
                    // Clear canvas
                    const canvas = document.getElementById('flowCanvas');
                    canvas.innerHTML = '<div class="canvas-grid"></div>';
                    
                    // Render nodes
                    currentFlow.nodes.forEach(node => renderNode(node));
                    
                    // Render connections
                    currentFlow.connections.forEach(conn => renderConnection(conn));
                    
                    closeModal('templatesModal');
                    loadFlows();
                } else {
                    alert('Error creating from template: ' + result.error);
                }
            } catch (error) {
                alert('Error creating from template: ' + error.message);
            }
        }

        function showTemplates() {
            showModal('templatesModal');
        }

        function showModal(modalId) {
            document.getElementById(modalId).style.display = 'block';
        }

        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }

        // Zoom controls
        function zoomIn() {
            zoom = Math.min(zoom * 1.2, 3);
            updateZoom();
        }

        function zoomOut() {
            zoom = Math.max(zoom / 1.2, 0.1);
            updateZoom();
        }

        function resetZoom() {
            zoom = 1;
            pan = { x: 0, y: 0 };
            updateZoom();
        }

        function updateZoom() {
            const canvas = document.getElementById('flowCanvas');
            canvas.style.transform = \`scale(\${zoom}) translate(\${pan.x}px, \${pan.y}px)\`;
        }

        // Close modals when clicking outside
        window.onclick = function(event) {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
        }
    </script>
</body>
</html>
  `);
});

// Remotion Connector UI Routes
router.get('/remotion', async (req, res) => {
  try {
    if (!connectorRegistry) {
      return res.status(500).json({ success: false, error: 'Connector Registry not initialized' });
    }

    const remotionConnector = connectorRegistry.getConnectorsByType('remotion')[0];
    if (!remotionConnector) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Remotion Video Renderer</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .error { background: #e74c3c; color: white; padding: 20px; border-radius: 8px; }
            .setup { background: #3498db; color: white; padding: 20px; border-radius: 8px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎬 Remotion Video Renderer</h1>
              <p>Templated video rendering using data from other connectors</p>
            </div>
            <div class="error">
              <h2>⚠️ Remotion Connector Not Found</h2>
              <p>The Remotion connector is not currently configured or running.</p>
            </div>
            <div class="setup">
              <h3>🔧 Setup Instructions</h3>
              <p>To use the Remotion video renderer:</p>
              <ol>
                <li>Install Remotion dependencies: <code>npm install remotion @remotion/cli @remotion/renderer</code></li>
                <li>Create a Remotion connector configuration</li>
                <li>Set up video templates and compositions</li>
                <li>Configure data sources from other connectors</li>
              </ol>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    const stats = remotionConnector.getRenderStats();
    const templates = await remotionConnector.listTemplates();
    const activeRenders = Array.from(remotionConnector.activeRenders.values());

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Remotion Video Renderer</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 1400px; margin: 0 auto; }
          .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
          .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .stat-number { font-size: 2em; font-weight: bold; color: #3498db; }
          .section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
          .btn { background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
          .btn:hover { background: #2980b9; }
          .btn-danger { background: #e74c3c; }
          .btn-danger:hover { background: #c0392b; }
          .btn-success { background: #27ae60; }
          .btn-success:hover { background: #229954; }
          .render-item { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 4px; }
          .render-status { padding: 5px 10px; border-radius: 4px; color: white; font-size: 0.9em; }
          .status-queued { background: #f39c12; }
          .status-rendering { background: #3498db; }
          .status-completed { background: #27ae60; }
          .status-failed { background: #e74c3c; }
          .status-cancelled { background: #95a5a6; }
          .template-item { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 4px; }
          .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); }
          .modal-content { background: white; margin: 5% auto; padding: 20px; border-radius: 8px; width: 80%; max-width: 600px; }
          .form-group { margin-bottom: 15px; }
          .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
          .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
          .progress-bar { width: 100%; height: 20px; background: #f0f0f0; border-radius: 10px; overflow: hidden; }
          .progress-fill { height: 100%; background: #3498db; transition: width 0.3s; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 Remotion Video Renderer</h1>
            <p>Templated video rendering using data from other connectors</p>
          </div>

          <!-- Statistics -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">${stats.totalRenders}</div>
              <div>Total Renders</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${stats.successfulRenders}</div>
              <div>Successful</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${stats.failedRenders}</div>
              <div>Failed</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${stats.activeRenders}</div>
              <div>Active Renders</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${stats.templates}</div>
              <div>Templates</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${Math.round(stats.averageRenderTime / 1000)}s</div>
              <div>Avg Render Time</div>
            </div>
          </div>

          <!-- Active Renders -->
          <div class="section">
            <h2>🔄 Active Renders</h2>
            <button class="btn" onclick="refreshRenders()">Refresh</button>
            <div id="activeRenders">
              ${activeRenders.map(render => `
                <div class="render-item">
                  <h4>${render.templateId} - ${render.id}</h4>
                  <div class="render-status status-${render.status}">${render.status.toUpperCase()}</div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: ${render.progress}%"></div>
                  </div>
                  <p>Progress: ${render.progress}%</p>
                  ${render.startTime ? `<p>Started: ${new Date(render.startTime).toLocaleString()}</p>` : ''}
                  ${render.error ? `<p style="color: red;">Error: ${render.error}</p>` : ''}
                  ${render.status === 'rendering' ? `<button class="btn btn-danger" onclick="cancelRender('${render.id}')">Cancel</button>` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Templates -->
          <div class="section">
            <h2>📋 Templates</h2>
            <button class="btn" onclick="showCreateTemplate()">Create Template</button>
            <button class="btn" onclick="refreshTemplates()">Refresh</button>
            <div id="templates">
              ${templates.map(template => `
                <div class="template-item">
                  <h4>${template.name}</h4>
                  <p>${template.description || 'No description'}</p>
                  <p><strong>Component:</strong> ${template.componentName}</p>
                  <p><strong>Resolution:</strong> ${template.width}x${template.height}</p>
                  <button class="btn" onclick="showRenderVideo('${template.id}')">Render Video</button>
                  <button class="btn btn-danger" onclick="deleteTemplate('${template.id}')">Delete</button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="section">
            <h2>⚡ Quick Actions</h2>
            <button class="btn btn-success" onclick="showFlightVideo()">Create Flight Video</button>
            <button class="btn btn-success" onclick="showEventTimeline()">Create Event Timeline</button>
            <button class="btn" onclick="showCustomRender()">Custom Render</button>
          </div>
        </div>

        <!-- Create Template Modal -->
        <div id="createTemplateModal" class="modal">
          <div class="modal-content">
            <h3>Create Template</h3>
            <form id="createTemplateForm">
              <div class="form-group">
                <label>Template ID:</label>
                <input type="text" id="templateId" required>
              </div>
              <div class="form-group">
                <label>Name:</label>
                <input type="text" id="templateName" required>
              </div>
              <div class="form-group">
                <label>Description:</label>
                <textarea id="templateDescription"></textarea>
              </div>
              <div class="form-group">
                <label>Component Name:</label>
                <input type="text" id="componentName" required>
              </div>
              <div class="form-group">
                <label>Component Path:</label>
                <input type="text" id="componentPath" required>
              </div>
              <div class="form-group">
                <label>Width:</label>
                <input type="number" id="templateWidth" value="1920">
              </div>
              <div class="form-group">
                <label>Height:</label>
                <input type="number" id="templateHeight" value="1080">
              </div>
              <button type="submit" class="btn">Create Template</button>
              <button type="button" class="btn btn-danger" onclick="closeModal('createTemplateModal')">Cancel</button>
            </form>
          </div>
        </div>

        <!-- Render Video Modal -->
        <div id="renderVideoModal" class="modal">
          <div class="modal-content">
            <h3>Render Video</h3>
            <form id="renderVideoForm">
              <div class="form-group">
                <label>Template:</label>
                <select id="renderTemplateId" required></select>
              </div>
              <div class="form-group">
                <label>Duration (seconds):</label>
                <input type="number" id="renderDuration" value="10" min="1" max="3600">
              </div>
              <div class="form-group">
                <label>FPS:</label>
                <input type="number" id="renderFps" value="30" min="1" max="120">
              </div>
              <div class="form-group">
                <label>Quality:</label>
                <select id="renderQuality">
                  <option value="low">Low</option>
                  <option value="medium" selected>Medium</option>
                  <option value="high">High</option>
                  <option value="ultra">Ultra</option>
                </select>
              </div>
              <div class="form-group">
                <label>Data (JSON):</label>
                <textarea id="renderData" rows="10" placeholder='{"example": "data"}'></textarea>
              </div>
              <button type="submit" class="btn">Start Render</button>
              <button type="button" class="btn btn-danger" onclick="closeModal('renderVideoModal')">Cancel</button>
            </form>
          </div>
        </div>

        <script>
          // Template management
          function showCreateTemplate() {
            document.getElementById('createTemplateModal').style.display = 'block';
          }

          function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
          }

          document.getElementById('createTemplateForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = {
              id: document.getElementById('templateId').value,
              name: document.getElementById('templateName').value,
              description: document.getElementById('templateDescription').value,
              componentName: document.getElementById('componentName').value,
              componentPath: document.getElementById('componentPath').value,
              width: parseInt(document.getElementById('templateWidth').value),
              height: parseInt(document.getElementById('templateHeight').value)
            };

            try {
              const response = await fetch('/api/connectors/remotion/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  capabilityId: 'template-management',
                  operation: 'create',
                  parameters: formData
                })
              });

              const result = await response.json();
              if (result.success) {
                alert('Template created successfully!');
                closeModal('createTemplateModal');
                refreshTemplates();
              } else {
                alert('Error creating template: ' + result.error);
              }
            } catch (error) {
              alert('Error creating template: ' + error.message);
            }
          };

          // Video rendering
          function showRenderVideo(templateId) {
            document.getElementById('renderTemplateId').value = templateId;
            document.getElementById('renderVideoModal').style.display = 'block';
          }

          document.getElementById('renderVideoForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = {
              templateId: document.getElementById('renderTemplateId').value,
              duration: parseInt(document.getElementById('renderDuration').value),
              fps: parseInt(document.getElementById('renderFps').value),
              quality: document.getElementById('renderQuality').value,
              data: JSON.parse(document.getElementById('renderData').value || '{}')
            };

            try {
              const response = await fetch('/api/connectors/remotion/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  capabilityId: 'video-rendering',
                  operation: 'render',
                  parameters: formData
                })
              });

              const result = await response.json();
              if (result.success) {
                alert('Render started! ID: ' + result.data.renderId);
                closeModal('renderVideoModal');
                refreshRenders();
              } else {
                alert('Error starting render: ' + result.error);
              }
            } catch (error) {
              alert('Error starting render: ' + error.message);
            }
          };

          // Utility functions
          async function refreshRenders() {
            location.reload();
          }

          async function refreshTemplates() {
            location.reload();
          }

          async function cancelRender(renderId) {
            if (confirm('Are you sure you want to cancel this render?')) {
              try {
                const response = await fetch('/api/connectors/remotion/execute', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    capabilityId: 'video-rendering',
                    operation: 'cancel',
                    parameters: { renderId }
                  })
                });

                const result = await response.json();
                if (result.success) {
                  alert('Render cancelled successfully!');
                  refreshRenders();
                } else {
                  alert('Error cancelling render: ' + result.error);
                }
              } catch (error) {
                alert('Error cancelling render: ' + error.message);
              }
            }
          }

          async function deleteTemplate(templateId) {
            if (confirm('Are you sure you want to delete this template?')) {
              try {
                const response = await fetch('/api/connectors/remotion/execute', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    capabilityId: 'template-management',
                    operation: 'delete',
                    parameters: { id: templateId }
                  })
                });

                const result = await response.json();
                if (result.success) {
                  alert('Template deleted successfully!');
                  refreshTemplates();
                } else {
                  alert('Error deleting template: ' + result.error);
                }
              } catch (error) {
                alert('Error deleting template: ' + error.message);
              }
            }
          }

          function showFlightVideo() {
            alert('Flight video creation - coming soon!');
          }

          function showEventTimeline() {
            alert('Event timeline creation - coming soon!');
          }

          function showCustomRender() {
            document.getElementById('renderVideoModal').style.display = 'block';
          }

          // Close modals when clicking outside
          window.onclick = function(event) {
            if (event.target.classList.contains('modal')) {
              event.target.style.display = 'none';
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    logger.error('Failed to render Remotion UI', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  injectServices
}; 