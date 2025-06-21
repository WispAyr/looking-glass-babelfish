const EventEmitter = require('events');
const winston = require('winston');
const os = require('os');

/**
 * Health Monitor Service
 * 
 * Monitors system health, performance metrics, and resource usage.
 * Provides early warning of potential issues and performance degradation.
 */
class HealthMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      checkInterval: config.checkInterval || 30000, // 30 seconds
      memoryThreshold: config.memoryThreshold || 0.8, // 80%
      cpuThreshold: config.cpuThreshold || 0.7, // 70%
      diskThreshold: config.diskThreshold || 0.9, // 90%
      ...config
    };

    this.logger = winston.createLogger({
      level: config.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    // Health state
    this.healthState = {
      status: 'healthy',
      lastCheck: null,
      checks: {
        memory: { status: 'healthy', value: 0, threshold: this.config.memoryThreshold },
        cpu: { status: 'healthy', value: 0, threshold: this.config.cpuThreshold },
        disk: { status: 'healthy', value: 0, threshold: this.config.diskThreshold },
        connections: { status: 'healthy', value: 0, threshold: 1000 },
        errors: { status: 'healthy', value: 0, threshold: 100 }
      },
      alerts: []
    };

    // Performance metrics
    this.metrics = {
      uptime: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      activeConnections: 0
    };

    this.checkTimer = null;
    this.logger.info('Health Monitor initialized');
  }

  /**
   * Start health monitoring
   */
  start() {
    this.logger.info('Starting health monitoring');
    this.checkTimer = setInterval(() => this.performHealthCheck(), this.config.checkInterval);
    this.performHealthCheck(); // Initial check
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.logger.info('Health monitoring stopped');
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    const startTime = Date.now();
    
    try {
      // Check system resources
      await this.checkMemoryUsage();
      await this.checkCpuUsage();
      await this.checkDiskUsage();
      
      // Update overall status
      this.updateOverallStatus();
      
      // Emit health update
      this.emit('health:update', this.healthState);
      
      this.healthState.lastCheck = new Date().toISOString();
      
    } catch (error) {
      this.logger.error('Health check failed:', error);
      this.healthState.status = 'error';
    }
  }

  /**
   * Check memory usage
   */
  async checkMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = usedMem / totalMem;
    
    this.healthState.checks.memory.value = usagePercent;
    this.healthState.checks.memory.status = 
      usagePercent > this.config.memoryThreshold ? 'warning' : 'healthy';
    
    if (usagePercent > this.config.memoryThreshold) {
      this.addAlert('memory', `High memory usage: ${(usagePercent * 100).toFixed(1)}%`);
    }
  }

  /**
   * Check CPU usage
   */
  async checkCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usagePercent = 1 - (idle / total);
    
    this.healthState.checks.cpu.value = usagePercent;
    this.healthState.checks.cpu.status = 
      usagePercent > this.config.cpuThreshold ? 'warning' : 'healthy';
    
    if (usagePercent > this.config.cpuThreshold) {
      this.addAlert('cpu', `High CPU usage: ${(usagePercent * 100).toFixed(1)}%`);
    }
  }

  /**
   * Check disk usage
   */
  async checkDiskUsage() {
    // This is a simplified check - in production you'd want to check specific directories
    const usagePercent = 0.5; // Placeholder - implement actual disk check
    
    this.healthState.checks.disk.value = usagePercent;
    this.healthState.checks.disk.status = 
      usagePercent > this.config.diskThreshold ? 'warning' : 'healthy';
  }

  /**
   * Update overall health status
   */
  updateOverallStatus() {
    const checks = Object.values(this.healthState.checks);
    const hasWarning = checks.some(check => check.status === 'warning');
    const hasError = checks.some(check => check.status === 'error');
    
    if (hasError) {
      this.healthState.status = 'critical';
    } else if (hasWarning) {
      this.healthState.status = 'warning';
    } else {
      this.healthState.status = 'healthy';
    }
  }

  /**
   * Add health alert
   */
  addAlert(type, message) {
    const alert = {
      type,
      message,
      timestamp: new Date().toISOString(),
      severity: 'warning'
    };
    
    this.healthState.alerts.push(alert);
    
    // Keep only recent alerts
    if (this.healthState.alerts.length > 10) {
      this.healthState.alerts = this.healthState.alerts.slice(-10);
    }
    
    this.emit('health:alert', alert);
  }

  /**
   * Update connection metrics
   */
  updateConnectionMetrics(activeConnections) {
    this.healthState.checks.connections.value = activeConnections;
    this.healthState.checks.connections.status = 
      activeConnections > this.healthState.checks.connections.threshold ? 'warning' : 'healthy';
  }

  /**
   * Update error metrics
   */
  updateErrorMetrics(errorCount) {
    this.healthState.checks.errors.value = errorCount;
    this.healthState.checks.errors.status = 
      errorCount > this.healthState.checks.errors.threshold ? 'warning' : 'healthy';
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      ...this.healthState,
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      cpu: os.cpus().length,
      loadAverage: os.loadavg()
    };
  }
}

module.exports = HealthMonitor; 