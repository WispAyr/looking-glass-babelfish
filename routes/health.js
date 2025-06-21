const express = require('express');
const router = express.Router();

/**
 * Health Check Routes
 * 
 * Provides system health status, performance metrics, and monitoring endpoints
 */
class HealthRoutes {
  constructor(services) {
    this.healthMonitor = services.healthMonitor;
    this.databaseService = services.databaseService;
    this.connectorRegistry = services.connectorRegistry;
    
    this.setupRoutes();
  }

  setupRoutes() {
    // Basic health check
    router.get('/', async (req, res) => {
      try {
        const healthStatus = this.healthMonitor.getHealthStatus();
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: healthStatus.uptime,
          version: healthStatus.version
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error.message
        });
      }
    });

    // Detailed health status
    router.get('/detailed', async (req, res) => {
      try {
        const healthStatus = this.healthMonitor.getHealthStatus();
        const metrics = this.healthMonitor.getMetrics();
        
        res.json({
          status: healthStatus.status,
          timestamp: new Date().toISOString(),
          checks: healthStatus.checks,
          alerts: healthStatus.alerts,
          metrics: metrics,
          uptime: healthStatus.uptime,
          version: healthStatus.version,
          platform: healthStatus.platform
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error.message
        });
      }
    });

    // Database health
    router.get('/database', async (req, res) => {
      try {
        const dbStats = await this.databaseService.getDatabaseStats();
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          stats: dbStats
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error.message
        });
      }
    });

    // Connector health
    router.get('/connectors', async (req, res) => {
      try {
        const connectors = this.connectorRegistry.getConnectors();
        const connectorHealth = connectors.map(connector => ({
          id: connector.id,
          type: connector.type,
          name: connector.name,
          status: connector.status,
          lastActivity: connector.stats?.lastActivity,
          errors: connector.stats?.errors || 0,
          messagesSent: connector.stats?.messagesSent || 0,
          messagesReceived: connector.stats?.messagesReceived || 0
        }));

        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          connectors: connectorHealth,
          total: connectorHealth.length,
          connected: connectorHealth.filter(c => c.status === 'connected').length,
          disconnected: connectorHealth.filter(c => c.status === 'disconnected').length
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error.message
        });
      }
    });

    // Performance metrics
    router.get('/metrics', async (req, res) => {
      try {
        const metrics = this.healthMonitor.getMetrics();
        const dbStats = await this.databaseService.getDatabaseStats();
        
        res.json({
          timestamp: new Date().toISOString(),
          system: metrics,
          database: dbStats,
          connectors: {
            total: this.connectorRegistry.getConnectors().length,
            connected: this.connectorRegistry.getConnectors().filter(c => c.status === 'connected').length
          }
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error.message
        });
      }
    });

    // System information
    router.get('/system', async (req, res) => {
      try {
        const os = require('os');
        
        res.json({
          timestamp: new Date().toISOString(),
          system: {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            uptime: process.uptime(),
            memory: {
              total: os.totalmem(),
              free: os.freemem(),
              used: os.totalmem() - os.freemem()
            },
            cpu: {
              cores: os.cpus().length,
              loadAverage: os.loadavg()
            },
            network: Object.keys(os.networkInterfaces())
          },
          process: {
            pid: process.pid,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
          }
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error.message
        });
      }
    });

    // Readiness check (for Kubernetes)
    router.get('/ready', async (req, res) => {
      try {
        const healthStatus = this.healthMonitor.getHealthStatus();
        const dbStats = await this.databaseService.getDatabaseStats();
        
        // Check if system is ready
        const isReady = healthStatus.status !== 'critical' && 
                       dbStats.activeConnections > 0;
        
        if (isReady) {
          res.json({
            status: 'ready',
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(503).json({
            status: 'not ready',
            timestamp: new Date().toISOString(),
            health: healthStatus.status,
            database: dbStats.activeConnections > 0 ? 'connected' : 'disconnected'
          });
        }
      } catch (error) {
        res.status(503).json({
          status: 'not ready',
          error: error.message
        });
      }
    });

    // Liveness check (for Kubernetes)
    router.get('/live', async (req, res) => {
      try {
        const healthStatus = this.healthMonitor.getHealthStatus();
        
        if (healthStatus.status === 'critical') {
          res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString()
          });
        } else {
          res.json({
            status: 'healthy',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });
  }
}

module.exports = { router, HealthRoutes }; 