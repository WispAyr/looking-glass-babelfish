const express = require('express');
const router = express.Router();

/**
 * Analytics and Zone Management API Routes
 * 
 * Provides REST endpoints for zone management, analytics, and dashboard data.
 */

// Zone Management Routes
router.get('/zones', async (req, res) => {
  try {
    const zoneManager = req.app.locals.zoneManager;
    if (!zoneManager) {
      return res.status(503).json({ error: 'Zone manager not available' });
    }
    
    const filter = {
      type: req.query.type,
      cameraId: req.query.cameraId,
      active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    
    const zones = zoneManager.getZones(filter);
    res.json({ zones, count: zones.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/zones', async (req, res) => {
  try {
    const zoneManager = req.app.locals.zoneManager;
    if (!zoneManager) {
      return res.status(503).json({ error: 'Zone manager not available' });
    }
    
    const zoneData = req.body;
    const zone = await zoneManager.createZone(zoneData);
    res.status(201).json(zone);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/zones/:zoneId', async (req, res) => {
  try {
    const zoneManager = req.app.locals.zoneManager;
    if (!zoneManager) {
      return res.status(503).json({ error: 'Zone manager not available' });
    }
    
    const zone = zoneManager.getZone(req.params.zoneId);
    if (!zone) {
      return res.status(404).json({ error: 'Zone not found' });
    }
    
    const analytics = zoneManager.getZoneAnalytics(req.params.zoneId);
    const cameras = zoneManager.getCamerasForZone(req.params.zoneId);
    
    res.json({
      ...zone,
      analytics,
      cameras
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/zones/:zoneId', async (req, res) => {
  try {
    const zoneManager = req.app.locals.zoneManager;
    if (!zoneManager) {
      return res.status(503).json({ error: 'Zone manager not available' });
    }
    
    const zoneData = { ...req.body, id: req.params.zoneId };
    const zone = await zoneManager.createZone(zoneData);
    res.json(zone);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/zones/:zoneId/cameras/:cameraId', async (req, res) => {
  try {
    const zoneManager = req.app.locals.zoneManager;
    if (!zoneManager) {
      return res.status(503).json({ error: 'Zone manager not available' });
    }
    
    const { zoneId, cameraId } = req.params;
    const coverage = req.body.coverage || {};
    
    const zone = await zoneManager.assignCameraToZone(cameraId, zoneId, coverage);
    res.json(zone);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/zones/:zoneId/cameras/:cameraId', async (req, res) => {
  try {
    const zoneManager = req.app.locals.zoneManager;
    if (!zoneManager) {
      return res.status(503).json({ error: 'Zone manager not available' });
    }
    
    const { zoneId, cameraId } = req.params;
    const zone = await zoneManager.removeCameraFromZone(cameraId, zoneId);
    res.json(zone);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Analytics Routes
router.get('/analytics', async (req, res) => {
  try {
    const analyticsEngine = req.app.locals.analyticsEngine;
    if (!analyticsEngine) {
      return res.status(503).json({ error: 'Analytics engine not available' });
    }
    
    const filter = {
      plateNumber: req.query.plateNumber,
      minSpeed: req.query.minSpeed ? parseFloat(req.query.minSpeed) : undefined,
      maxSpeed: req.query.maxSpeed ? parseFloat(req.query.maxSpeed) : undefined
    };
    
    const analytics = analyticsEngine.exportAnalytics(filter);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/cameras/:cameraId', async (req, res) => {
  try {
    const analyticsEngine = req.app.locals.analyticsEngine;
    if (!analyticsEngine) {
      return res.status(503).json({ error: 'Analytics engine not available' });
    }
    
    const analytics = analyticsEngine.getCameraAnalytics(req.params.cameraId);
    const history = analyticsEngine.getEventHistory(req.params.cameraId, 100);
    
    res.json({
      analytics,
      history,
      cameraId: req.params.cameraId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/zones/:zoneId', async (req, res) => {
  try {
    const analyticsEngine = req.app.locals.analyticsEngine;
    const zoneManager = req.app.locals.zoneManager;
    
    if (!analyticsEngine || !zoneManager) {
      return res.status(503).json({ error: 'Analytics engine or zone manager not available' });
    }
    
    const peopleCount = analyticsEngine.getPeopleCount(req.params.zoneId);
    const vehicleCount = analyticsEngine.getVehicleCount(req.params.zoneId);
    const occupancyHistory = analyticsEngine.getOccupancyHistory(req.params.zoneId, 100);
    const zoneAnalytics = zoneManager.getZoneAnalytics(req.params.zoneId);
    
    res.json({
      zoneId: req.params.zoneId,
      peopleCount,
      vehicleCount,
      occupancyHistory,
      analytics: zoneAnalytics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/speed', async (req, res) => {
  try {
    const analyticsEngine = req.app.locals.analyticsEngine;
    if (!analyticsEngine) {
      return res.status(503).json({ error: 'Analytics engine not available' });
    }
    
    const filter = {
      plateNumber: req.query.plateNumber,
      minSpeed: req.query.minSpeed ? parseFloat(req.query.minSpeed) : undefined,
      maxSpeed: req.query.maxSpeed ? parseFloat(req.query.maxSpeed) : undefined
    };
    
    const speedCalculations = analyticsEngine.getSpeedCalculations(filter);
    res.json({ speedCalculations, count: speedCalculations.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/plates/:plateNumber', async (req, res) => {
  try {
    const analyticsEngine = req.app.locals.analyticsEngine;
    if (!analyticsEngine) {
      return res.status(503).json({ error: 'Analytics engine not available' });
    }
    
    const tracking = analyticsEngine.getPlateTracking(req.params.plateNumber);
    if (!tracking) {
      return res.status(404).json({ error: 'Plate not found' });
    }
    
    res.json({
      plateNumber: req.params.plateNumber,
      tracking
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Smart Detection Analytics Routes
router.get('/analytics/smart-detections', async (req, res) => {
  try {
    const analyticsEngine = req.app.locals.analyticsEngine;
    if (!analyticsEngine) {
      return res.status(503).json({ error: 'Analytics engine not available' });
    }
    
    const { cameraId, objectType, limit = 50, timeRange } = req.query;
    
    if (cameraId) {
      // Get smart detection analytics for specific camera
      const smartAnalytics = analyticsEngine.getSmartDetectionAnalytics(cameraId);
      
      // Filter by object type if specified
      if (objectType && smartAnalytics.recentDetections) {
        smartAnalytics.recentDetections = smartAnalytics.recentDetections.filter(
          detection => detection.objectType === objectType
        );
      }
      
      // Apply time range filter if specified
      if (timeRange && smartAnalytics.recentDetections) {
        const cutoffTime = new Date(Date.now() - parseInt(timeRange) * 60000); // minutes to ms
        smartAnalytics.recentDetections = smartAnalytics.recentDetections.filter(
          detection => new Date(detection.timestamp) > cutoffTime
        );
      }
      
      // Limit results
      if (smartAnalytics.recentDetections) {
        smartAnalytics.recentDetections = smartAnalytics.recentDetections.slice(0, parseInt(limit));
      }
      
      res.json({
        success: true,
        data: smartAnalytics,
        cameraId,
        filters: { objectType, timeRange, limit }
      });
    } else {
      // Get aggregated smart detection analytics for all cameras
      const entityManager = req.app.locals.entityManager;
      if (!entityManager) {
        return res.status(503).json({ error: 'Entity manager not available' });
      }
      
      const cameras = entityManager.getEntities({ type: 'camera' });
      const aggregatedAnalytics = {
        summary: {
          totalDetections: 0,
          personDetections: 0,
          vehicleDetections: 0,
          animalDetections: 0,
          packageDetections: 0,
          faceDetections: 0,
          genericDetections: 0
        },
        confidenceStats: {
          average: 0,
          min: 1,
          max: 0
        },
        cameras: {},
        recentDetections: [],
        patterns: {
          highFrequency: 0,
          lowConfidence: 0,
          crossZone: 0
        }
      };
      
      let totalConfidence = 0;
      let confidenceCount = 0;
      
      for (const camera of cameras) {
        const cameraAnalytics = analyticsEngine.getSmartDetectionAnalytics(camera.id);
        aggregatedAnalytics.cameras[camera.id] = {
          ...cameraAnalytics,
          cameraName: camera.name,
          status: camera.status
        };
        
        // Aggregate summary
        if (cameraAnalytics.detectionTypes) {
          aggregatedAnalytics.summary.totalDetections += cameraAnalytics.totalDetections;
          aggregatedAnalytics.summary.personDetections += cameraAnalytics.detectionTypes.person || 0;
          aggregatedAnalytics.summary.vehicleDetections += cameraAnalytics.detectionTypes.vehicle || 0;
          aggregatedAnalytics.summary.animalDetections += cameraAnalytics.detectionTypes.animal || 0;
          aggregatedAnalytics.summary.packageDetections += cameraAnalytics.detectionTypes.package || 0;
          aggregatedAnalytics.summary.faceDetections += cameraAnalytics.detectionTypes.face || 0;
          aggregatedAnalytics.summary.genericDetections += cameraAnalytics.detectionTypes.generic || 0;
        }
        
        // Aggregate confidence stats
        if (cameraAnalytics.confidenceStats && cameraAnalytics.confidenceStats.average > 0) {
          totalConfidence += cameraAnalytics.confidenceStats.average;
          confidenceCount++;
          aggregatedAnalytics.confidenceStats.min = Math.min(
            aggregatedAnalytics.confidenceStats.min, 
            cameraAnalytics.confidenceStats.min
          );
          aggregatedAnalytics.confidenceStats.max = Math.max(
            aggregatedAnalytics.confidenceStats.max, 
            cameraAnalytics.confidenceStats.max
          );
        }
        
        // Add recent detections
        if (cameraAnalytics.recentDetections) {
          aggregatedAnalytics.recentDetections.push(...cameraAnalytics.recentDetections);
        }
      }
      
      // Calculate average confidence
      if (confidenceCount > 0) {
        aggregatedAnalytics.confidenceStats.average = totalConfidence / confidenceCount;
      }
      
      // Filter by object type if specified
      if (objectType && aggregatedAnalytics.recentDetections) {
        aggregatedAnalytics.recentDetections = aggregatedAnalytics.recentDetections.filter(
          detection => detection.objectType === objectType
        );
      }
      
      // Apply time range filter if specified
      if (timeRange && aggregatedAnalytics.recentDetections) {
        const cutoffTime = new Date(Date.now() - parseInt(timeRange) * 60000); // minutes to ms
        aggregatedAnalytics.recentDetections = aggregatedAnalytics.recentDetections.filter(
          detection => new Date(detection.timestamp) > cutoffTime
        );
      }
      
      // Sort and limit recent detections
      aggregatedAnalytics.recentDetections.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      aggregatedAnalytics.recentDetections = aggregatedAnalytics.recentDetections.slice(0, parseInt(limit));
      
      res.json({
        success: true,
        data: aggregatedAnalytics,
        count: cameras.length,
        filters: { objectType, timeRange, limit }
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/smart-detections/:cameraId', async (req, res) => {
  try {
    const analyticsEngine = req.app.locals.analyticsEngine;
    if (!analyticsEngine) {
      return res.status(503).json({ error: 'Analytics engine not available' });
    }
    
    const { cameraId } = req.params;
    const { objectType, limit = 50, timeRange } = req.query;
    
    const smartAnalytics = analyticsEngine.getSmartDetectionAnalytics(cameraId);
    
    // Get entity manager for camera details
    const entityManager = req.app.locals.entityManager;
    if (entityManager) {
      const camera = entityManager.getEntity(`camera-${cameraId}`);
      if (camera) {
        smartAnalytics.cameraName = camera.name;
        smartAnalytics.cameraStatus = camera.status;
      }
    }
    
    // Filter by object type if specified
    if (objectType && smartAnalytics.recentDetections) {
      smartAnalytics.recentDetections = smartAnalytics.recentDetections.filter(
        detection => detection.objectType === objectType
      );
    }
    
    // Apply time range filter if specified
    if (timeRange && smartAnalytics.recentDetections) {
      const cutoffTime = new Date(Date.now() - parseInt(timeRange) * 60000); // minutes to ms
      smartAnalytics.recentDetections = smartAnalytics.recentDetections.filter(
        detection => new Date(detection.timestamp) > cutoffTime
      );
    }
    
    // Limit recent detections
    if (smartAnalytics.recentDetections) {
      smartAnalytics.recentDetections = smartAnalytics.recentDetections.slice(0, parseInt(limit));
    }
    
    res.json({
      success: true,
      data: smartAnalytics,
      cameraId,
      filters: { objectType, timeRange, limit }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/smart-patterns', async (req, res) => {
  try {
    const analyticsEngine = req.app.locals.analyticsEngine;
    if (!analyticsEngine) {
      return res.status(503).json({ error: 'Analytics engine not available' });
    }
    
    const { cameraId, objectType, timeRange = 60 } = req.query; // Default 60 minutes
    
    // This would typically analyze patterns from stored analytics data
    // For now, return a placeholder structure with basic pattern analysis
    const patterns = {
      highFrequency: [],
      lowConfidence: [],
      crossZone: [],
      unusualActivity: [],
      timeBased: {
        hourly: {},
        daily: {},
        weekly: {}
      }
    };
    
    // If cameraId is specified, analyze patterns for that camera
    if (cameraId) {
      const smartAnalytics = analyticsEngine.getSmartDetectionAnalytics(cameraId);
      
      if (smartAnalytics.recentDetections) {
        const cutoffTime = new Date(Date.now() - parseInt(timeRange) * 60000);
        const recentDetections = smartAnalytics.recentDetections.filter(
          detection => new Date(detection.timestamp) > cutoffTime
        );
        
        // Analyze detection frequency
        const detectionCounts = {};
        recentDetections.forEach(detection => {
          detectionCounts[detection.objectType] = (detectionCounts[detection.objectType] || 0) + 1;
        });
        
        // Find high frequency patterns
        Object.entries(detectionCounts).forEach(([type, count]) => {
          const detectionsPerMinute = count / (parseInt(timeRange));
          if (detectionsPerMinute > 0.1) { // More than 1 detection per 10 minutes
            patterns.highFrequency.push({
              objectType: type,
              frequency: detectionsPerMinute,
              count,
              cameraId
            });
          }
        });
        
        // Find low confidence patterns
        const lowConfidenceDetections = recentDetections.filter(
          detection => detection.confidence < 0.5
        );
        
        if (lowConfidenceDetections.length > 0) {
          patterns.lowConfidence.push({
            cameraId,
            count: lowConfidenceDetections.length,
            averageConfidence: lowConfidenceDetections.reduce((sum, d) => sum + d.confidence, 0) / lowConfidenceDetections.length,
            detections: lowConfidenceDetections.slice(0, 10) // Limit to 10 examples
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: patterns,
      filters: { cameraId, objectType, timeRange }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Routes
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardService = req.app.locals.dashboardService;
    if (!dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }
    
    const filter = {
      zones: req.query.zones ? req.query.zones.split(',') : undefined,
      cameras: req.query.cameras ? req.query.cameras.split(',') : undefined,
      includeRealTime: req.query.realTime === 'true'
    };
    
    const data = dashboardService.getDashboardData(filter);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard/overview', async (req, res) => {
  try {
    const dashboardService = req.app.locals.dashboardService;
    if (!dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }
    
    const overview = dashboardService.getOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard/zones', async (req, res) => {
  try {
    const dashboardService = req.app.locals.dashboardService;
    if (!dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }
    
    const filter = {
      type: req.query.type,
      active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined
    };
    
    const zones = dashboardService.getZones(filter);
    res.json({ zones, count: Object.keys(zones).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard/cameras', async (req, res) => {
  try {
    const dashboardService = req.app.locals.dashboardService;
    if (!dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }
    
    const filter = {
      status: req.query.status,
      zone: req.query.zone
    };
    
    const cameras = dashboardService.getCameras(filter);
    res.json({ cameras, count: Object.keys(cameras).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard/events', async (req, res) => {
  try {
    const dashboardService = req.app.locals.dashboardService;
    if (!dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const events = dashboardService.getEvents(limit);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard/alerts', async (req, res) => {
  try {
    const dashboardService = req.app.locals.dashboardService;
    if (!dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const alerts = dashboardService.getAlerts(limit);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Real-time WebSocket endpoint
router.get('/dashboard/realtime', async (req, res) => {
  try {
    const dashboardService = req.app.locals.dashboardService;
    if (!dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    // Subscribe to real-time updates
    const unsubscribe = dashboardService.subscribe((data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
    
    // Send initial data
    const initialData = dashboardService.getDashboardData({ includeRealTime: true });
    res.write(`data: ${JSON.stringify(initialData)}\n\n`);
    
    // Handle client disconnect
    req.on('close', () => {
      unsubscribe();
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Statistics Routes
router.get('/stats', async (req, res) => {
  try {
    const stats = {};
    
    // Zone manager stats
    const zoneManager = req.app.locals.zoneManager;
    if (zoneManager) {
      stats.zones = zoneManager.getStats();
    }
    
    // Analytics engine stats
    const analyticsEngine = req.app.locals.analyticsEngine;
    if (analyticsEngine) {
      stats.analytics = analyticsEngine.getStats();
    }
    
    // Dashboard service stats
    const dashboardService = req.app.locals.dashboardService;
    if (dashboardService) {
      stats.dashboard = {
        realTimeUpdates: dashboardService.getRealTimeUpdates(),
        subscribers: dashboardService.updateSubscribers.size
      };
    }
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 