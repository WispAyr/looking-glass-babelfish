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

// Get all cameras with their locations and status
router.get('/cameras', async (req, res) => {
    try {
        const { connectorRegistry } = req.app.locals;
        
        if (!connectorRegistry) {
            return res.status(503).json({ error: 'Connector registry not available' });
        }

        const cameras = [];
        
        // Get cameras from all connectors
        for (const [connectorId, connector] of connectorRegistry.connectors.entries()) {
            if (connector.type === 'unifi-protect' || connector.type === 'hikvision' || connector.type === 'ankke-dvr') {
                try {
                    const result = await connector.execute('cameras', 'list');
                    if (result.success && result.cameras) {
                        cameras.push(...result.cameras.map(camera => ({
                            ...camera,
                            connectorId,
                            connectorType: connector.type
                        })));
                    }
                } catch (error) {
                    console.warn(`Failed to get cameras from connector ${connectorId}:`, error);
                }
            }
        }

        res.json({
            success: true,
            cameras,
            total: cameras.length
        });
    } catch (error) {
        console.error('Error getting cameras:', error);
        res.status(500).json({ error: 'Failed to get cameras' });
    }
});

// Get camera details including line crossing configuration
router.get('/cameras/:cameraId', async (req, res) => {
    try {
        const { cameraId } = req.params;
        const { connectorRegistry } = req.app.locals;
        
        if (!connectorRegistry) {
            return res.status(503).json({ error: 'Connector registry not available' });
        }

        // Find camera across all connectors
        for (const [connectorId, connector] of connectorRegistry.connectors.entries()) {
            if (connector.type === 'unifi-protect' || connector.type === 'hikvision' || connector.type === 'ankke-dvr') {
                try {
                    const result = await connector.execute('camera', 'get', { cameraId });
                    if (result.success && result.camera) {
                        return res.json({
                            success: true,
                            camera: {
                                ...result.camera,
                                connectorId,
                                connectorType: connector.type
                            }
                        });
                    }
                } catch (error) {
                    // Continue to next connector
                }
            }
        }

        res.status(404).json({ error: 'Camera not found' });
    } catch (error) {
        console.error('Error getting camera details:', error);
        res.status(500).json({ error: 'Failed to get camera details' });
    }
});

// Get line crossing configurations for a camera
router.get('/cameras/:cameraId/lines', async (req, res) => {
    try {
        const { cameraId } = req.params;
        const { connectorRegistry } = req.app.locals;
        
        if (!connectorRegistry) {
            return res.status(503).json({ error: 'Connector registry not available' });
        }

        const lines = [];
        
        // Get lines from all connectors
        for (const [connectorId, connector] of connectorRegistry.connectors.entries()) {
            if (connector.type === 'unifi-protect') {
                try {
                    const result = await connector.execute('camera', 'getLines', { cameraId });
                    if (result.success && result.lines) {
                        lines.push(...result.lines.map(line => ({
                            ...line,
                            connectorId,
                            cameraId
                        })));
                    }
                } catch (error) {
                    // Continue to next connector
                }
            }
        }

        res.json({
            success: true,
            lines,
            total: lines.length
        });
    } catch (error) {
        console.error('Error getting camera lines:', error);
        res.status(500).json({ error: 'Failed to get camera lines' });
    }
});

// Update camera location on map
router.put('/cameras/:cameraId/location', async (req, res) => {
    try {
        const { cameraId } = req.params;
        const { lat, lon, x, y } = req.body;
        const { connectorRegistry } = req.app.locals;
        
        if (!connectorRegistry) {
            return res.status(503).json({ error: 'Connector registry not available' });
        }

        // Find camera and update location
        for (const [connectorId, connector] of connectorRegistry.connectors.entries()) {
            if (connector.type === 'unifi-protect' || connector.type === 'hikvision' || connector.type === 'ankke-dvr') {
                try {
                    const result = await connector.execute('camera', 'updateLocation', {
                        cameraId,
                        location: { lat, lon, x, y }
                    });
                    if (result.success) {
                        return res.json({
                            success: true,
                            message: 'Camera location updated',
                            camera: result.camera
                        });
                    }
                } catch (error) {
                    // Continue to next connector
                }
            }
        }

        res.status(404).json({ error: 'Camera not found' });
    } catch (error) {
        console.error('Error updating camera location:', error);
        res.status(500).json({ error: 'Failed to update camera location' });
    }
});

// Get map configuration
router.get('/config', async (req, res) => {
    try {
        const { mapIntegrationService } = req.app.locals;
        
        if (!mapIntegrationService) {
            return res.status(503).json({ error: 'Map integration service not available' });
        }

        const config = await mapIntegrationService.getMapConfig();
        
        res.json({
            success: true,
            config
        });
    } catch (error) {
        console.error('Error getting map config:', error);
        res.status(500).json({ error: 'Failed to get map configuration' });
    }
});

// Update map configuration
router.put('/config', async (req, res) => {
    try {
        const { mapIntegrationService } = req.app.locals;
        const config = req.body;
        
        if (!mapIntegrationService) {
            return res.status(503).json({ error: 'Map integration service not available' });
        }

        const result = await mapIntegrationService.updateMapConfig(config);
        
        res.json({
            success: true,
            message: 'Map configuration updated',
            config: result
        });
    } catch (error) {
        console.error('Error updating map config:', error);
        res.status(500).json({ error: 'Failed to update map configuration' });
    }
});

// Get spatial elements (cameras, zones, lines)
router.get('/elements', async (req, res) => {
    try {
        const { mapIntegrationService } = req.app.locals;
        
        if (!mapIntegrationService) {
            return res.status(503).json({ error: 'Map integration service not available' });
        }

        const elements = await mapIntegrationService.getSpatialElements();
        
        res.json({
            success: true,
            elements,
            total: elements.length
        });
    } catch (error) {
        console.error('Error getting spatial elements:', error);
        res.status(500).json({ error: 'Failed to get spatial elements' });
    }
});

// Create or update spatial element
router.post('/elements', async (req, res) => {
    try {
        const { mapIntegrationService } = req.app.locals;
        const elementData = req.body;
        
        if (!mapIntegrationService) {
            return res.status(503).json({ error: 'Map integration service not available' });
        }

        const element = await mapIntegrationService.createOrUpdateElement(elementData);
        
        res.json({
            success: true,
            message: 'Spatial element created/updated',
            element
        });
    } catch (error) {
        console.error('Error creating spatial element:', error);
        res.status(500).json({ error: 'Failed to create spatial element' });
    }
});

// Delete spatial element
router.delete('/elements/:elementId', async (req, res) => {
    try {
        const { elementId } = req.params;
        const { mapIntegrationService } = req.app.locals;
        
        if (!mapIntegrationService) {
            return res.status(503).json({ error: 'Map integration service not available' });
        }

        await mapIntegrationService.deleteElement(elementId);
        
        res.json({
            success: true,
            message: 'Spatial element deleted'
        });
    } catch (error) {
        console.error('Error deleting spatial element:', error);
        res.status(500).json({ error: 'Failed to delete spatial element' });
    }
});

// Get real-time events for map
router.get('/events', async (req, res) => {
    try {
        const { eventBus } = req.app.locals;
        
        if (!eventBus) {
            return res.status(503).json({ error: 'Event bus not available' });
        }

        // Get recent events for each type
        const eventTypes = ['motion', 'smartDetectLine', 'smartDetectZone', 'smartDetectLoiterZone'];
        let allEvents = [];
        
        for (const eventType of eventTypes) {
            const events = eventBus.getEvents({
                type: eventType,
                limit: 20
            });
            allEvents = allEvents.concat(events);
        }
        
        // Sort by timestamp and limit total
        allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        allEvents = allEvents.slice(0, 50);
        
        res.json({
            success: true,
            events: allEvents,
            total: allEvents.length
        });
    } catch (error) {
        console.error('Error getting map events:', error);
        res.status(500).json({ error: 'Failed to get map events' });
    }
});

// Get connector status for map
router.get('/connectors', async (req, res) => {
    try {
        const { connectorRegistry } = req.app.locals;
        
        if (!connectorRegistry) {
            return res.status(503).json({ error: 'Connector registry not available' });
        }

        const connectors = [];
        
        for (const [connectorId, connector] of connectorRegistry.connectors.entries()) {
            if (connector.type === 'unifi-protect' || connector.type === 'hikvision' || connector.type === 'ankke-dvr') {
                connectors.push({
                    id: connectorId,
                    type: connector.type,
                    name: connector.name,
                    status: connector.getStatus(),
                    capabilities: connector.getCapabilities()
                });
            }
        }

        res.json({
            success: true,
            connectors,
            total: connectors.length
        });
    } catch (error) {
        console.error('Error getting connectors:', error);
        res.status(500).json({ error: 'Failed to get connectors' });
    }
});

module.exports = router; 