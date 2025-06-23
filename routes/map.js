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

// Get APRS stations for map
router.get('/aprs/stations', async (req, res) => {
    try {
        // Get APRS connector data
        const aprsConnector = req.app.locals.connectorRegistry?.getConnector('aprs-main');
        
        if (!aprsConnector || !aprsConnector.isConnected) {
            return res.json({
                success: true,
                stations: []
            });
        }

        const stations = Array.from(aprsConnector.stations.values()).map(station => ({
            id: station.id,
            name: station.name,
            type: 'aprs-station',
            position: {
                lat: station.lat,
                lng: station.lng
            },
            properties: {
                callsign: station.name,
                lastSeen: station.lastSeen,
                comment: station.comment,
                symbol: station.symbol,
                course: station.course,
                speed: station.speed,
                altitude: station.altitude
            }
        }));

        res.json({
            success: true,
            stations: stations
        });
    } catch (error) {
        console.error('Error fetching APRS stations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch APRS stations'
        });
    }
});

// Get ADSB aircraft for map
router.get('/adsb/aircraft', async (req, res) => {
    try {
        // Get ADSB connector data
        const adsbConnector = req.app.locals.connectorRegistry?.getConnector('adsb-main');
        
        if (!adsbConnector || adsbConnector.status !== 'connected') {
            return res.json({
                success: true,
                aircraft: []
            });
        }

        const aircraft = Array.from(adsbConnector.aircraft.values()).map(plane => ({
            id: plane.icao24,
            name: plane.callsign || plane.icao24,
            type: 'adsb-aircraft',
            position: {
                lat: plane.lat,
                lng: plane.lon
            },
            properties: {
                icao: plane.icao24,
                callsign: plane.callsign,
                altitude: plane.altitude,
                speed: plane.velocity,
                heading: plane.track,
                squawk: plane.squawk,
                lastSeen: plane.lastSeen
            }
        }));

        res.json({
            success: true,
            aircraft: aircraft
        });
    } catch (error) {
        console.error('Error fetching ADSB aircraft:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch ADSB aircraft'
        });
    }
});

// Get cameras for map using connector capabilities
router.get('/cameras', async (req, res) => {
    try {
        console.log('Map cameras endpoint called');
        const connectorRegistry = req.app.locals.connectorRegistry;
        
        if (!connectorRegistry) {
            console.log('No connector registry available');
            return res.status(503).json({
                success: false,
                error: 'Connector registry not available'
            });
        }

        console.log('Connector registry found, checking for UniFi connectors...');
        const allCameras = [];
        const connectorResults = [];

        // Find all connectors with camera:management capability
        for (const [connectorId, connector] of connectorRegistry.connectors.entries()) {
            console.log(`Checking connector: ${connectorId}, type: ${connector.type}, connected: ${connector.isConnected}`);
            if (connector.type === 'unifi-protect' && connector.isConnected) {
                console.log(`Found connected UniFi connector: ${connectorId}`);
                try {
                    // Use the capability system to get cameras
                    console.log(`Executing camera:management capability on ${connectorId}`);
                    const result = await connector.executeCapability('camera:management', 'list', {});
                    console.log(`Result from ${connectorId}:`, result.success, result.cameras ? result.cameras.length : 'no cameras');
                    
                    if (result.success && result.cameras) {
                        // Add connector information to each camera
                        const camerasWithConnector = result.cameras.map(camera => ({
                            ...camera,
                            connectorId,
                            connectorName: connector.name || connectorId,
                            // Add capability information for frontend
                            capabilities: {
                                hasStream: true,
                                hasSnapshot: true,
                                hasLocation: camera.hasLocation || false
                            }
                        }));
                        
                        allCameras.push(...camerasWithConnector);
                        
                        connectorResults.push({
                            connectorId,
                            connectorName: connector.name || connectorId,
                            cameraCount: result.cameras.length,
                            status: 'success'
                        });
                    } else if (result.data && result.data.cameras) {
                        // Handle nested response structure
                        const camerasWithConnector = result.data.cameras.map(camera => ({
                            ...camera,
                            connectorId,
                            connectorName: connector.name || connectorId,
                            capabilities: {
                                hasStream: true,
                                hasSnapshot: true,
                                hasLocation: camera.hasLocation || false
                            }
                        }));
                        
                        allCameras.push(...camerasWithConnector);
                        
                        connectorResults.push({
                            connectorId,
                            connectorName: connector.name || connectorId,
                            cameraCount: result.data.cameras.length,
                            status: 'success'
                        });
                    } else {
                        console.log(`No cameras found in ${connectorId}:`, result);
                        connectorResults.push({
                            connectorId,
                            connectorName: connector.name || connectorId,
                            cameraCount: 0,
                            status: 'error',
                            error: result.error || 'Failed to get cameras'
                        });
                    }
                } catch (error) {
                    console.error(`Error getting cameras from connector ${connectorId}:`, error);
                    connectorResults.push({
                        connectorId,
                        connectorName: connector.name || connectorId,
                        cameraCount: 0,
                        status: 'error',
                        error: error.message
                    });
                }
            }
        }

        console.log(`Total cameras found: ${allCameras.length}`);
        console.log(`Connector results:`, connectorResults);

        // Filter cameras that have location data for map display
        const camerasWithLocation = allCameras.filter(camera => camera.hasLocation).map(camera => ({
            id: camera.id,
            name: camera.name || camera.locationName || `Camera ${camera.id}`,
            type: 'camera',
            position: {
                lat: camera.lat,
                lng: camera.lng
            },
            properties: {
                status: camera.state || 'unknown',
                type: camera.type || 'unknown',
                model: camera.model || 'unknown',
                locationName: camera.locationName,
                locationDescription: camera.locationDescription,
                locationAddress: camera.locationAddress,
                lastSeen: camera.lastSeen,
                connectorId: camera.connectorId,
                connectorName: camera.connectorName,
                capabilities: camera.capabilities
            }
        }));

        console.log(`Cameras with location: ${camerasWithLocation.length}`);

        res.json({
            success: true,
            cameras: camerasWithLocation,
            totalCameras: allCameras.length,
            camerasWithLocation: camerasWithLocation.length,
            connectors: connectorResults,
            totalConnectors: connectorResults.length
        });
    } catch (error) {
        console.error('Error fetching cameras:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch cameras'
        });
    }
});

// Get all spatial data
router.get('/spatial', async (req, res) => {
    try {
        const connectorRegistry = req.app.locals.connectorRegistry;
        
        if (!connectorRegistry) {
            return res.json({
                success: true,
                spatialData: {
                    aprs: [],
                    adsb: [],
                    cameras: []
                }
            });
        }

        // Get APRS data
        const aprsConnector = connectorRegistry.getConnector('aprs-main');
        const aprsStations = aprsConnector && aprsConnector.isConnected ? 
            Array.from(aprsConnector.stations.values()).map(station => ({
                id: station.id,
                name: station.name,
                type: 'aprs-station',
                position: { lat: station.lat, lng: station.lng },
                properties: {
                    callsign: station.name,
                    lastSeen: station.lastSeen,
                    comment: station.comment
                }
            })) : [];

        // Get ADSB data
        const adsbConnector = connectorRegistry.getConnector('adsb-main');
        const adsbAircraft = adsbConnector && adsbConnector.status === 'connected' ?
            Array.from(adsbConnector.aircraft.values()).map(plane => ({
                id: plane.icao24,
                name: plane.callsign || plane.icao24,
                type: 'adsb-aircraft',
                position: { lat: plane.lat, lng: plane.lon },
                properties: {
                    icao: plane.icao24,
                    altitude: plane.altitude,
                    speed: plane.velocity,
                    heading: plane.track
                }
            })) : [];

        // Get camera data
        const protectConnector = connectorRegistry.getConnector('unifi-protect-main');
        const cameras = protectConnector && protectConnector.isConnected ?
            Array.from(protectConnector.cameras.values()).map(camera => ({
                id: camera.id,
                name: camera.name,
                type: 'camera',
                position: { lat: camera.lat || 0, lng: camera.lng || 0 },
                properties: {
                    status: camera.state,
                    type: camera.type
                }
            })) : [];

        res.json({
            success: true,
            spatialData: {
                aprs: aprsStations,
                adsb: adsbAircraft,
                cameras: cameras
            }
        });
    } catch (error) {
        console.error('Error fetching spatial data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch spatial data'
        });
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
                    const result = await connector.execute('camera:management', 'list');
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
                    const result = await connector.execute('camera:management', 'get', { cameraId });
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
                    const result = await connector.execute('camera:management', 'getLines', { cameraId });
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
                    const result = await connector.execute('camera:management', 'updateLocation', {
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

// Map GUI route
router.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Map Interface - Looking Glass</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #ffffff;
      overflow: hidden;
      height: 100vh;
    }
    
    .map-container {
      position: relative;
      width: 100vw;
      height: 100vh;
      background: #2a2a2a;
    }
    
    .map-canvas {
      width: 100%;
      height: 100%;
      background: #1a1a1a;
    }
    
    .controls {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0,0,0,0.8);
      border: 1px solid #00ff00;
      border-radius: 8px;
      padding: 15px;
      color: #00ff00;
      font-size: 12px;
      z-index: 1000;
    }
    
    .control-group {
      margin-bottom: 10px;
    }
    
    .control-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    
    .control-group input, .control-group select {
      width: 100%;
      padding: 5px;
      background: #333;
      border: 1px solid #00ff00;
      color: #00ff00;
      border-radius: 4px;
    }
    
    .status {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      border: 1px solid #00ff00;
      border-radius: 8px;
      padding: 15px;
      color: #00ff00;
      font-size: 12px;
      z-index: 1000;
    }
    
    .aircraft {
      position: absolute;
      width: 8px;
      height: 8px;
      background: #00ff00;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: all 0.5s ease;
    }
    
    .aircraft.emergency {
      background: #ff0000;
      animation: blink 1s infinite;
    }
    
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0.3; }
    }
    
    .aircraft-label {
      position: absolute;
      font-size: 10px;
      color: #00ff00;
      white-space: nowrap;
      transform: translate(10px, -5px);
      text-shadow: 1px 1px 2px #000;
    }
  </style>
</head>
<body>
  <div class="map-container">
    <canvas id="mapCanvas" class="map-canvas"></canvas>
    
    <div class="controls">
      <h3>Map Controls</h3>
      <div class="control-group">
        <label>Center Latitude:</label>
        <input type="number" id="centerLat" value="55.5074" step="0.0001">
      </div>
      <div class="control-group">
        <label>Center Longitude:</label>
        <input type="number" id="centerLon" value="-4.5933" step="0.0001">
      </div>
      <div class="control-group">
        <label>Zoom Level:</label>
        <input type="range" id="zoomLevel" min="1" max="20" value="10">
      </div>
      <div class="control-group">
        <label>Show Aircraft:</label>
        <input type="checkbox" id="showAircraft" checked>
      </div>
      <div class="control-group">
        <label>Show APRS:</label>
        <input type="checkbox" id="showAPRS" checked>
      </div>
      <div class="control-group">
        <label>Show Cameras:</label>
        <input type="checkbox" id="showCameras" checked>
      </div>
      <button onclick="loadMapData()">Refresh Data</button>
    </div>
    
    <div class="status">
      <h3>Status</h3>
      <div>Aircraft: <span id="aircraft-count">0</span></div>
      <div>APRS Stations: <span id="aprs-count">0</span></div>
      <div>Cameras: <span id="camera-count">0</span></div>
      <div>Last Update: <span id="last-update">Never</span></div>
    </div>
  </div>

  <script>
    let mapData = {
      aircraft: [],
      aprs: [],
      cameras: []
    };
    
    const canvas = document.getElementById('mapCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Load map data
    async function loadMapData() {
      try {
        const response = await fetch('/api/map/spatial');
        const result = await response.json();
        
        if (result.success) {
          mapData = result.spatialData;
          updateStatus();
          renderMap();
        }
      } catch (error) {
        console.error('Failed to load map data:', error);
      }
    }
    
    // Update status panel
    function updateStatus() {
      document.getElementById('aircraft-count').textContent = mapData.adsb ? mapData.adsb.length : 0;
      document.getElementById('aprs-count').textContent = mapData.aprs ? mapData.aprs.length : 0;
      document.getElementById('camera-count').textContent = mapData.cameras ? mapData.cameras.length : 0;
      document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
    }
    
    // Render map
    function renderMap() {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Get center and zoom
      const centerLat = parseFloat(document.getElementById('centerLat').value);
      const centerLon = parseFloat(document.getElementById('centerLon').value);
      const zoom = parseInt(document.getElementById('zoomLevel').value);
      
      // Draw aircraft
      if (document.getElementById('showAircraft').checked && mapData.adsb) {
        mapData.adsb.forEach(aircraft => {
          if (aircraft.position && aircraft.position.lat && aircraft.position.lng) {
            const x = (aircraft.position.lng - centerLon) * zoom * 1000 + canvas.width / 2;
            const y = (centerLat - aircraft.position.lat) * zoom * 1000 + canvas.height / 2;
            
            if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
              ctx.fillStyle = aircraft.properties?.emergency ? '#ff0000' : '#00ff00';
              ctx.beginPath();
              ctx.arc(x, y, 4, 0, 2 * Math.PI);
              ctx.fill();
              
              // Draw label
              ctx.fillStyle = '#00ff00';
              ctx.font = '10px Arial';
              ctx.fillText(aircraft.name || aircraft.id, x + 8, y - 4);
            }
          }
        });
      }
      
      // Draw APRS stations
      if (document.getElementById('showAPRS').checked && mapData.aprs) {
        mapData.aprs.forEach(station => {
          if (station.position && station.position.lat && station.position.lng) {
            const x = (station.position.lng - centerLon) * zoom * 1000 + canvas.width / 2;
            const y = (centerLat - station.position.lat) * zoom * 1000 + canvas.height / 2;
            
            if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
              ctx.fillStyle = '#0000ff';
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, 2 * Math.PI);
              ctx.fill();
              
              // Draw label
              ctx.fillStyle = '#0000ff';
              ctx.font = '10px Arial';
              ctx.fillText(station.name || station.id, x + 8, y - 4);
            }
          }
        });
      }
      
      // Draw cameras
      if (document.getElementById('showCameras').checked && mapData.cameras) {
        mapData.cameras.forEach(camera => {
          if (camera.position && camera.position.lat && camera.position.lng) {
            const x = (camera.position.lng - centerLon) * zoom * 1000 + canvas.width / 2;
            const y = (centerLat - camera.position.lat) * zoom * 1000 + canvas.height / 2;
            
            if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
              ctx.fillStyle = '#ffff00';
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, 2 * Math.PI);
              ctx.fill();
              
              // Draw label
              ctx.fillStyle = '#ffff00';
              ctx.font = '10px Arial';
              ctx.fillText(camera.name || camera.id, x + 8, y - 4);
            }
          }
        });
      }
    }
    
    // Event listeners
    document.getElementById('centerLat').addEventListener('change', renderMap);
    document.getElementById('centerLon').addEventListener('change', renderMap);
    document.getElementById('zoomLevel').addEventListener('input', renderMap);
    document.getElementById('showAircraft').addEventListener('change', renderMap);
    document.getElementById('showAPRS').addEventListener('change', renderMap);
    document.getElementById('showCameras').addEventListener('change', renderMap);
    
    // Initial load
    loadMapData();
    setInterval(loadMapData, 5000); // Refresh every 5 seconds
  </script>
</body>
</html>`;
  
  res.send(html);
});

// Get camera stream URL using connector capabilities
router.get('/cameras/:cameraId/stream', async (req, res) => {
    try {
        const { cameraId } = req.params;
        const { connectorId, quality = 'high' } = req.query;
        
        const connectorRegistry = req.app.locals.connectorRegistry;
        
        if (!connectorRegistry) {
            return res.status(503).json({
                success: false,
                error: 'Connector registry not available'
            });
        }

        let targetConnector = null;

        if (connectorId) {
            // Use specific connector if provided
            targetConnector = connectorRegistry.getConnector(connectorId);
            if (!targetConnector || targetConnector.type !== 'unifi-protect') {
                return res.status(404).json({
                    success: false,
                    error: `Connector ${connectorId} not found or not a UniFi Protect connector`
                });
            }
        } else {
            // Find the connector that has this camera
            for (const [id, connector] of connectorRegistry.connectors.entries()) {
                if (connector.type === 'unifi-protect' && connector.isConnected) {
                    try {
                        const result = await connector.executeCapability('camera:management', 'get', { cameraId });
                        if (result.success && result.camera) {
                            targetConnector = connector;
                            break;
                        }
                    } catch (error) {
                        // Continue to next connector
                    }
                }
            }
        }

        if (!targetConnector) {
            return res.status(404).json({
                success: false,
                error: 'Camera not found in any UniFi Protect connector'
            });
        }

        // Get stream URL using capability system
        const streamResult = await targetConnector.executeCapability('camera:video:stream', 'read', {
            cameraId,
            quality
        });

        if (!streamResult.success) {
            return res.status(500).json({
                success: false,
                error: streamResult.error || 'Failed to get stream URL'
            });
        }

        res.json({
            success: true,
            data: {
                streamUrl: streamResult.streamUrl,
                cameraId,
                connectorId: targetConnector.id,
                connectorName: targetConnector.name,
                quality,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error getting camera stream:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get camera snapshot using connector capabilities
router.get('/cameras/:cameraId/snapshot', async (req, res) => {
    try {
        const { cameraId } = req.params;
        const { connectorId } = req.query;
        
        const connectorRegistry = req.app.locals.connectorRegistry;
        
        if (!connectorRegistry) {
            return res.status(503).json({
                success: false,
                error: 'Connector registry not available'
            });
        }

        let targetConnector = null;

        if (connectorId) {
            targetConnector = connectorRegistry.getConnector(connectorId);
            if (!targetConnector || targetConnector.type !== 'unifi-protect') {
                return res.status(404).json({
                    success: false,
                    error: 'Connector not found or not a UniFi Protect connector'
                });
            }
        } else {
            // Find first available UniFi Protect connector
            for (const [id, connector] of connectorRegistry.connectors.entries()) {
                if (connector.type === 'unifi-protect' && connector.isConnected) {
                    targetConnector = connector;
                    break;
                }
            }
        }

        if (!targetConnector) {
            return res.status(404).json({
                success: false,
                error: 'No UniFi Protect connector available'
            });
        }

        // Use the capability system to get snapshot
        const result = await targetConnector.executeCapability('camera:snapshot', 'get', {
            cameraId,
            quality: 'high'
        });

        if (result.success) {
            res.json({
                success: true,
                data: {
                    snapshotUrl: result.snapshotUrl,
                    connectorId: targetConnector.id,
                    connectorName: targetConnector.name || targetConnector.id,
                    timestamp: result.timestamp || Date.now(),
                    cameraId
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to get snapshot'
            });
        }
    } catch (error) {
        console.error('Error getting camera snapshot:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router; 