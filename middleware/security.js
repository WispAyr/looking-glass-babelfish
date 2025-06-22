const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const winston = require('winston');

/**
 * Security Middleware
 * 
 * Provides rate limiting, request validation, and security measures
 * to protect the API from abuse and attacks.
 */
class SecurityMiddleware {
  constructor(config = {}) {
    this.config = {
      rateLimit: {
        windowMs: config.rateLimit?.windowMs || 15 * 60 * 1000, // 15 minutes
        max: config.rateLimit?.max || 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
        ...config.rateLimit
      },
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
  }

  /**
   * Get rate limiter middleware
   */
  getRateLimiter() {
    return rateLimit(this.config.rateLimit);
  }

  /**
   * Get lenient rate limiter for map endpoints
   */
  getMapRateLimiter() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 300, // limit each IP to 300 requests per minute for map data
      message: 'Too many map requests, please slow down.',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true, // Don't count successful requests
      skipFailedRequests: false
    });
  }

  /**
   * Get strict rate limiter for sensitive endpoints
   */
  getStrictRateLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // limit each IP to 10 requests per windowMs
      message: 'Too many requests to sensitive endpoint, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    });
  }

  /**
   * Get helmet configuration
   */
  getHelmetConfig() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "https:", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'", "https:", "data:", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com", "https://unpkg.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    });
  }

  /**
   * Request validation middleware
   */
  validateRequest(schema) {
    return (req, res, next) => {
      try {
        if (schema.body) {
          const { error } = schema.body.validate(req.body);
          if (error) {
            return res.status(400).json({
              error: 'Validation error',
              details: error.details.map(d => d.message)
            });
          }
        }

        if (schema.query) {
          const { error } = schema.query.validate(req.query);
          if (error) {
            return res.status(400).json({
              error: 'Query validation error',
              details: error.details.map(d => d.message)
            });
          }
        }

        if (schema.params) {
          const { error } = schema.params.validate(req.params);
          if (error) {
            return res.status(400).json({
              error: 'Parameter validation error',
              details: error.details.map(d => d.message)
            });
          }
        }

        next();
      } catch (error) {
        this.logger.error('Request validation error:', error);
        res.status(500).json({ error: 'Internal validation error' });
      }
    };
  }

  /**
   * API key validation middleware
   */
  validateApiKey(apiKeys = []) {
    return (req, res, next) => {
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      if (apiKeys.length > 0 && !apiKeys.includes(apiKey)) {
        this.logger.warn('Invalid API key attempt', { 
          ip: req.ip, 
          userAgent: req.get('User-Agent') 
        });
        return res.status(403).json({ error: 'Invalid API key' });
      }

      next();
    };
  }

  /**
   * Request logging middleware
   */
  requestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        };

        if (res.statusCode >= 400) {
          this.logger.warn('Request completed with error', logData);
        } else {
          this.logger.debug('Request completed', logData);
        }
      });

      next();
    };
  }

  /**
   * Error handling middleware
   */
  errorHandler() {
    return (err, req, res, next) => {
      this.logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
      });

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(err.status || 500).json({
        error: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack })
      });
    };
  }

  /**
   * CORS configuration
   */
  getCorsConfig() {
    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
        
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          this.logger.warn('CORS blocked origin', { origin });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    };
  }
}

module.exports = SecurityMiddleware; 