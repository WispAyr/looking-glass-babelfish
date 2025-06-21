const express = require('express');
const router = express.Router();

/**
 * Map API Routes
 * 
 * Provides RESTful API endpoints for map management, spatial configuration,
 * and real-time data access.
 */

// Get all spatial elements
router.get('/elements', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const mapConnectors = mapIntegrationService.mapConnectors;
    const allElements = [];

    for (const mapConnector of mapConnectors.values()) {
      const elements = mapConnector.getCachedSpatialElements(req.query);
      allElements.push(...elements.map(element => ({
        ...element,
        mapId: mapConnector.id
      })));
    }

    res.json({
      elements: allElements,
      count: allElements.length,
      maps: Array.from(mapConnectors.keys())
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get spatial elements for specific map
router.get('/maps/:mapId/elements', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const mapConnector = mapIntegrationService.mapConnectors.get(req.params.mapId);
    if (!mapConnector) {
      return res.status(404).json({ error: 'Map not found' });
    }

    const elements = mapConnector.getCachedSpatialElements(req.query);
    res.json({
      elements,
      count: elements.length,
      mapId: req.params.mapId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create spatial element
router.post('/elements', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const { mapId, elementType, position, properties } = req.body;

    if (!mapId || !elementType) {
      return res.status(400).json({ error: 'mapId and elementType are required' });
    }

    const mapConnector = mapIntegrationService.mapConnectors.get(mapId);
    if (!mapConnector) {
      return res.status(404).json({ error: 'Map not found' });
    }

    const element = await mapConnector.execute('spatial:config', 'create', {
      elementType,
      position,
      properties
    });

    res.status(201).json({
      element,
      mapId,
      message: 'Spatial element created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update spatial element
router.put('/elements/:elementId', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const { elementId } = req.params;
    const { mapId, updates } = req.body;

    if (!mapId) {
      return res.status(400).json({ error: 'mapId is required' });
    }

    const mapConnector = mapIntegrationService.mapConnectors.get(mapId);
    if (!mapConnector) {
      return res.status(404).json({ error: 'Map not found' });
    }

    const element = await mapConnector.execute('spatial:config', 'update', {
      elementId,
      updates
    });

    res.json({
      element,
      mapId,
      message: 'Spatial element updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete spatial element
router.delete('/elements/:elementId', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const { elementId } = req.params;
    const { mapId } = req.query;

    if (!mapId) {
      return res.status(400).json({ error: 'mapId is required' });
    }

    const mapConnector = mapIntegrationService.mapConnectors.get(mapId);
    if (!mapConnector) {
      return res.status(404).json({ error: 'Map not found' });
    }

    await mapConnector.execute('spatial:config', 'delete', {
      elementId
    });

    res.json({
      message: 'Spatial element deleted successfully',
      elementId,
      mapId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get connector contexts
router.get('/contexts', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const contexts = [];
    for (const mapConnector of mapIntegrationService.mapConnectors.values()) {
      const mapContexts = mapConnector.getConnectorContexts();
      contexts.push(...mapContexts.map(context => ({
        ...context,
        mapId: mapConnector.id
      })));
    }

    res.json({
      contexts,
      count: contexts.length,
      maps: Array.from(mapIntegrationService.mapConnectors.keys())
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get connector contexts for specific map
router.get('/maps/:mapId/contexts', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const mapConnector = mapIntegrationService.mapConnectors.get(req.params.mapId);
    if (!mapConnector) {
      return res.status(404).json({ error: 'Map not found' });
    }

    const contexts = mapConnector.getConnectorContexts();
    res.json({
      contexts,
      count: contexts.length,
      mapId: req.params.mapId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register connector with map
router.post('/maps/:mapId/connectors', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const { mapId } = req.params;
    const { connectorId, context, capabilities } = req.body;

    if (!connectorId) {
      return res.status(400).json({ error: 'connectorId is required' });
    }

    const mapConnector = mapIntegrationService.mapConnectors.get(mapId);
    if (!mapConnector) {
      return res.status(404).json({ error: 'Map not found' });
    }

    const connector = mapIntegrationService.connectorRegistry.getConnector(connectorId);
    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    await mapIntegrationService.registerConnectorWithMap(connector, mapConnector);

    res.status(201).json({
      message: 'Connector registered with map successfully',
      connectorId,
      mapId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unregister connector from map
router.delete('/maps/:mapId/connectors/:connectorId', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const { mapId, connectorId } = req.params;

    const mapConnector = mapIntegrationService.mapConnectors.get(mapId);
    if (!mapConnector) {
      return res.status(404).json({ error: 'Map not found' });
    }

    await mapConnector.execute('integration:connector', 'unregister', {
      connectorId
    });

    res.json({
      message: 'Connector unregistered from map successfully',
      connectorId,
      mapId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export map configuration
router.post('/export', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const { mapId } = req.body;

    if (mapId) {
      // Export specific map
      const mapConnector = mapIntegrationService.mapConnectors.get(mapId);
      if (!mapConnector) {
        return res.status(404).json({ error: 'Map not found' });
      }

      const config = mapConnector.exportConfiguration();
      res.json(config);
    } else {
      // Export all maps
      const configs = {};
      for (const [id, mapConnector] of mapIntegrationService.mapConnectors.entries()) {
        configs[id] = mapConnector.exportConfiguration();
      }

      res.json({
        version: '1.0.0',
        exported: new Date().toISOString(),
        maps: configs,
        integrationService: mapIntegrationService.getStatus()
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import map configuration
router.post('/import', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const { mapId, config } = req.body;

    if (!mapId || !config) {
      return res.status(400).json({ error: 'mapId and config are required' });
    }

    const mapConnector = mapIntegrationService.mapConnectors.get(mapId);
    if (!mapConnector) {
      return res.status(404).json({ error: 'Map not found' });
    }

    await mapConnector.importConfiguration(config);

    res.json({
      message: 'Map configuration imported successfully',
      mapId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get real-time analytics
router.get('/analytics/realtime', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const analytics = {};
    for (const [id, mapConnector] of mapIntegrationService.mapConnectors.entries()) {
      analytics[id] = {
        performance: mapConnector.getPerformanceMetrics(),
        health: mapConnector.getHealthStatus(),
        dataStreams: mapConnector.getDataStreams()
      };
    }

    res.json({
      analytics,
      integrationService: mapIntegrationService.getMetrics(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get spatial analytics
router.get('/analytics/spatial', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const { mapId } = req.query;
    const spatialAnalytics = {};

    if (mapId) {
      // Get analytics for specific map
      const mapConnector = mapIntegrationService.mapConnectors.get(mapId);
      if (!mapConnector) {
        return res.status(404).json({ error: 'Map not found' });
      }

      spatialAnalytics[mapId] = {
        elements: mapConnector.getSpatialElements(),
        elementsByType: mapConnector.getElementsByType(),
        contexts: mapConnector.getConnectorContexts(),
        streams: mapConnector.getDataStreams()
      };
    } else {
      // Get analytics for all maps
      for (const [id, mapConnector] of mapIntegrationService.mapConnectors.entries()) {
        spatialAnalytics[id] = {
          elements: mapConnector.getSpatialElements(),
          elementsByType: mapConnector.getElementsByType(),
          contexts: mapConnector.getConnectorContexts(),
          streams: mapConnector.getDataStreams()
        };
      }
    }

    res.json({
      spatialAnalytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get map health status
router.get('/health', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const health = {
      status: 'healthy',
      integrationService: mapIntegrationService.getStatus(),
      maps: {}
    };

    for (const [id, mapConnector] of mapIntegrationService.mapConnectors.entries()) {
      health.maps[id] = mapConnector.getHealthStatus();
    }

    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get map web interface configuration
router.get('/web-interface', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const webInterfaces = {};
    for (const [id, mapConnector] of mapIntegrationService.mapConnectors.entries()) {
      webInterfaces[id] = mapConnector.getWebInterfaceConfig();
    }

    res.json({
      webInterfaces,
      count: Object.keys(webInterfaces).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear map cache
router.post('/cache/clear', async (req, res) => {
  try {
    const mapIntegrationService = req.app.locals.mapIntegrationService;
    if (!mapIntegrationService) {
      return res.status(503).json({ error: 'Map integration service not available' });
    }

    const { mapId } = req.query;

    if (mapId) {
      // Clear cache for specific map
      const mapConnector = mapIntegrationService.mapConnectors.get(mapId);
      if (!mapConnector) {
        return res.status(404).json({ error: 'Map not found' });
      }

      mapConnector.clearSpatialCache();
    } else {
      // Clear cache for all maps
      for (const mapConnector of mapIntegrationService.mapConnectors.values()) {
        mapConnector.clearSpatialCache();
      }
    }

    res.json({
      message: 'Map cache cleared successfully',
      mapId: mapId || 'all'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 