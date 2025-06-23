const express = require('express');
const router = express.Router();
const path = require('path');

/**
 * GET /unifi
 * Serve the UniFi Protect camera management interface
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/unifi.html'));
});

/**
 * GET /unifi/api/cameras
 * Get all cameras from all UniFi Protect connectors
 */
router.get('/api/cameras', async (req, res) => {
  try {
    const connectorRegistry = req.app.locals.connectorRegistry;
    
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    // Get logger from app locals
    const logger = req.app.locals.logger || console;
    
    logger.info('Connector registry found, searching for UniFi Protect connectors...');
    logger.info('Available connectors:', Array.from(connectorRegistry.connectors.keys()));

    const allCameras = [];
    const connectorResults = [];

    // Get cameras from all UniFi Protect connectors
    for (const [connectorId, connector] of connectorRegistry.connectors.entries()) {
      logger.info(`Checking connector ${connectorId}, type: ${connector.type}`);
      
      if (connector.type === 'unifi-protect') {
        logger.info(`Found UniFi Protect connector: ${connectorId}`);
        
        try {
          logger.info(`Executing camera:management capability on connector ${connectorId}...`);
          const result = await connector.executeCapability('camera:management', 'list', {});
          logger.info(`Result from connector ${connectorId}:`, JSON.stringify(result, null, 2));
          logger.info(`Result success: ${result.success}, has cameras: ${!!result.cameras}, has data: ${!!result.data}`);
          logger.info(`Result keys: ${Object.keys(result || {}).join(', ')}`);
          if (result && result.cameras) {
            logger.info(`First camera keys: ${Object.keys(result.cameras[0] || {}).join(', ')}`);
          }
          
          if (result.success && result.cameras) {
            // Add connector information to each camera
            const camerasWithConnector = result.cameras.map(camera => ({
              ...camera,
              connectorId,
              connectorName: connector.name || connectorId
            }));
            
            logger.info(`Cameras from ${connectorId}:`, JSON.stringify(camerasWithConnector[0], null, 2));
            
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
              connectorName: connector.name || connectorId
            }));
            
            allCameras.push(...camerasWithConnector);
            
            connectorResults.push({
              connectorId,
              connectorName: connector.name || connectorId,
              cameraCount: result.data.cameras.length,
              status: 'success'
            });
          } else {
            connectorResults.push({
              connectorId,
              connectorName: connector.name || connectorId,
              cameraCount: 0,
              status: 'error',
              error: result.error || 'Failed to get cameras'
            });
          }
        } catch (error) {
          logger.error(`Error getting cameras from connector ${connectorId}:`, error);
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

    logger.info(`Total cameras found: ${allCameras.length}`);
    logger.info('First camera structure:', JSON.stringify(allCameras[0], null, 2));

    res.json({
      success: true,
      data: allCameras,
      count: allCameras.length,
      connectors: connectorResults,
      totalConnectors: connectorResults.length
    });
  } catch (error) {
    const logger = req.app.locals.logger || console;
    logger.error('Error getting cameras:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /unifi/api/cameras/:id
 * Get a specific camera
 */
router.get('/api/cameras/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connectorRegistry = req.app.locals.connectorRegistry;
    
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    // Search for camera across all UniFi Protect connectors
    for (const [connectorId, connector] of connectorRegistry.connectors.entries()) {
      if (connector.type === 'unifi-protect') {
        try {
          const result = await connector.executeCapability('camera:management', 'get', { cameraId: id });
          
          if (result.success && result.camera) {
            // Add connector information to camera
            const cameraWithConnector = {
              ...result.camera,
              connectorId,
              connectorName: connector.name || connectorId
            };
            
            return res.json({
              success: true,
              data: cameraWithConnector
            });
          }
        } catch (error) {
          // Continue to next connector
          console.debug(`Camera ${id} not found in connector ${connectorId}:`, error.message);
        }
      }
    }

    // Camera not found in any connector
    return res.status(404).json({
      success: false,
      error: 'Camera not found in any UniFi Protect connector'
    });
  } catch (error) {
    console.error('Error getting camera:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /unifi/api/cameras/:id/stream
 * Get camera stream URL
 */
router.get('/api/cameras/:id/stream', async (req, res) => {
  try {
    const { id } = req.params;
    const { quality = '1080p' } = req.query;
    
    // Map quality parameters to UniFi Protect format
    const qualityMap = {
      '1080p': 'high',
      '720p': 'medium',
      '480p': 'low',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };
    
    const mappedQuality = qualityMap[quality] || 'high';
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    const unifiConnector = connectorRegistry?.getConnector('unifi-protect-main');
    
    if (!unifiConnector) {
      return res.status(404).json({
        success: false,
        error: 'UniFi Protect connector not found'
      });
    }

    const streamUrl = await unifiConnector.executeCapability('camera:video:stream', 'read', { 
      cameraId: id, 
      quality: mappedQuality 
    });
    
    res.json({
      success: true,
      data: {
        streamUrl,
        cameraId: id,
        quality: mappedQuality
      }
    });
  } catch (error) {
    console.error('Error getting stream URL:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /unifi/api/cameras/:id/snapshot
 * Get camera snapshot
 */
router.get('/api/cameras/:id/snapshot', async (req, res) => {
  try {
    const { id } = req.params;
    const { timestamp } = req.query;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    const unifiConnector = connectorRegistry?.getConnector('unifi-protect-main');
    
    if (!unifiConnector) {
      return res.status(404).json({
        success: false,
        error: 'UniFi Protect connector not found'
      });
    }

    const snapshot = await unifiConnector.executeCapability('camera:snapshot', 'get', { 
      cameraId: id, 
      timestamp: timestamp 
    });
    
    res.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    console.error('Error getting snapshot:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /unifi/api/cameras/:id/location
 * Update camera location
 */
router.post('/api/cameras/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng, locationName, locationDescription, locationAddress } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    
    if (!connectorRegistry) {
      return res.status(503).json({
        success: false,
        error: 'Connector registry not available'
      });
    }

    // Find the connector that has this camera
    let targetConnector = null;
    let cameraFound = false;
    
    for (const [connectorId, connector] of connectorRegistry.connectors.entries()) {
      if (connector.type === 'unifi-protect') {
        try {
          const result = await connector.executeCapability('camera:management', 'get', { cameraId: id });
          if (result.success && result.camera) {
            targetConnector = connector;
            cameraFound = true;
            break;
          }
        } catch (error) {
          // Continue to next connector
        }
      }
    }

    if (!targetConnector || !cameraFound) {
      return res.status(404).json({
        success: false,
        error: 'Camera not found in any UniFi Protect connector'
      });
    }

    // Update camera location using the capability system
    const updateResult = await targetConnector.executeCapability('camera:management', 'updateLocation', {
      cameraId: id,
      location: {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        locationName: locationName || 'Updated Location',
        locationDescription: locationDescription || 'Camera location updated',
        locationAddress: locationAddress || 'Unknown Address'
      }
    });

    if (updateResult.success) {
      res.json({
        success: true,
        data: {
          cameraId: id,
          connectorId: targetConnector.id,
          connectorName: targetConnector.name || targetConnector.id,
          location: {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            locationName,
            locationDescription,
            locationAddress
          },
          message: 'Camera location updated successfully'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: updateResult.error || 'Failed to update camera location'
      });
    }
  } catch (error) {
    console.error('Error updating camera location:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /unifi/api/events
 * Get recent events from cameras
 */
router.get('/api/events', async (req, res) => {
  try {
    const { limit = 50, cameraId, eventType } = req.query;
    
    const connectorRegistry = req.app.locals.connectorRegistry;
    const unifiConnector = connectorRegistry?.getConnector('unifi-protect-main');
    
    if (!unifiConnector) {
      return res.status(404).json({
        success: false,
        error: 'UniFi Protect connector not found'
      });
    }

    const events = await unifiConnector.executeCapability('camera:event:motion', 'list', {
      limit: parseInt(limit),
      cameraId,
      eventType
    });
    
    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 