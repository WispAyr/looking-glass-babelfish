const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

/**
 * Camera Location Management Routes
 * 
 * Provides API endpoints for managing camera GPS coordinates and location data.
 * Integrates with UniFi Protect connector to update camera settings.
 */

// Camera locations storage file
const CAMERA_LOCATIONS_FILE = path.join(__dirname, '../data/camera-locations.json');

/**
 * Load camera locations from storage
 */
async function loadCameraLocations() {
  try {
    const data = await fs.readFile(CAMERA_LOCATIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid, return empty object
    return {};
  }
}

/**
 * Save camera locations to storage
 */
async function saveCameraLocations(locations) {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(CAMERA_LOCATIONS_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(CAMERA_LOCATIONS_FILE, JSON.stringify(locations, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save camera locations:', error);
    return false;
  }
}

/**
 * Get all camera locations
 */
router.get('/locations', async (req, res) => {
  try {
    const locations = await loadCameraLocations();
    res.json({
      success: true,
      data: locations,
      count: Object.keys(locations).length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get cameras with location data for map display
 */
router.get('/map', async (req, res) => {
  try {
    // Get cameras from UniFi Protect
    const connectorRegistry = req.app.get('connectorRegistry');
    let cameras = [];
    
    if (connectorRegistry) {
      const unifiConnector = connectorRegistry.getConnector('unifi-protect-main');
      if (unifiConnector && unifiConnector.connected) {
        try {
          const cameraResponse = await unifiConnector.listCameras();
          cameras = cameraResponse.data || [];
        } catch (error) {
          console.warn('Failed to get cameras from UniFi Protect:', error.message);
        }
      }
    }
    
    // Load location data
    const locations = await loadCameraLocations();
    
    // Merge camera data with location data
    const camerasWithLocation = cameras.map(camera => {
      const location = locations[camera.id];
      return {
        ...camera,
        lat: location?.lat || null,
        lng: location?.lng || null,
        locationName: location?.name || null,
        locationDescription: location?.description || null,
        locationAddress: location?.address || null,
        hasLocation: !!location
      };
    });
    
    res.json({
      success: true,
      data: camerasWithLocation,
      count: camerasWithLocation.length,
      withLocation: camerasWithLocation.filter(c => c.hasLocation).length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get location for specific camera
 */
router.get('/locations/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const locations = await loadCameraLocations();
    
    if (!locations[cameraId]) {
      return res.status(404).json({
        success: false,
        error: 'Camera location not found'
      });
    }
    
    res.json({
      success: true,
      data: locations[cameraId]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Set camera location
 */
router.post('/locations/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const { lat, lng, name, description, address } = req.body;
    
    // Validate required fields
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }
    
    // Validate coordinates
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180'
      });
    }
    
    // Load existing locations
    const locations = await loadCameraLocations();
    
    // Update location data
    locations[cameraId] = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      name: name || '',
      description: description || '',
      address: address || '',
      updatedAt: new Date().toISOString()
    };
    
    // Save to storage
    const saved = await saveCameraLocations(locations);
    if (!saved) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save camera location'
      });
    }
    
    // Try to update camera in UniFi Protect if connector is available
    try {
      const connectorRegistry = req.app.get('connectorRegistry');
      if (connectorRegistry) {
        const unifiConnector = connectorRegistry.getConnector('unifi-protect-main');
        if (unifiConnector && unifiConnector.connected) {
          // Note: UniFi Protect API doesn't directly support GPS coordinates
          // We'll store them locally and use them for map display
          console.log(`Camera location updated for ${cameraId}: ${lat}, ${lng}`);
        }
      }
    } catch (connectorError) {
      console.warn('Failed to update camera in UniFi Protect:', connectorError.message);
    }
    
    res.json({
      success: true,
      data: locations[cameraId],
      message: 'Camera location updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete camera location
 */
router.delete('/locations/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const locations = await loadCameraLocations();
    
    if (!locations[cameraId]) {
      return res.status(404).json({
        success: false,
        error: 'Camera location not found'
      });
    }
    
    delete locations[cameraId];
    
    const saved = await saveCameraLocations(locations);
    if (!saved) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save camera locations'
      });
    }
    
    res.json({
      success: true,
      message: 'Camera location deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 