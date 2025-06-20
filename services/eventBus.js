const EventEmitter = require('events');
const winston = require('winston');

/**
 * Central Event Bus
 * 
 * Handles event routing, normalization, and broadcasting across the system.
 * Provides a unified interface for event processing and rule engine integration.
 */
class EventBus extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || winston.createLogger();
    
    // Event storage
    this.events = [];
    this.maxEvents = config.maxEvents || 1000;
    
    // Event counters
    this.stats = {
      totalEvents: 0,
      eventsByType: new Map(),
      eventsBySource: new Map(),
      lastEventTime: null
    };
    
    // Event subscribers
    this.subscribers = new Map();
    
    // Event processing queue
    this.processingQueue = [];
    this.isProcessing = false;
    
    this.logger.info('Event Bus initialized');
  }
  
  /**
   * Publish an event to the bus
   */
  async publishEvent(event) {
    try {
      // Normalize event
      const normalizedEvent = this.normalizeEvent(event);
      
      // Add to storage
      this.storeEvent(normalizedEvent);
      
      // Update stats
      this.updateStats(normalizedEvent);
      
      // Add to processing queue
      this.processingQueue.push(normalizedEvent);
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
      
      this.logger.debug(`Event published: ${normalizedEvent.type} from ${normalizedEvent.source}`);
      
      return normalizedEvent;
    } catch (error) {
      this.logger.error('Error publishing event:', error);
      throw error;
    }
  }
  
  /**
   * Normalize event format
   */
  normalizeEvent(event) {
    const normalized = {
      id: event.id || this.generateEventId(),
      type: event.type || 'unknown',
      source: event.source || 'unknown',
      timestamp: event.timestamp || new Date().toISOString(),
      data: event.data || {},
      metadata: {
        ...event.metadata,
        normalized: true,
        processed: false
      }
    };
    
    return normalized;
  }
  
  /**
   * Store event in memory
   */
  storeEvent(event) {
    this.events.push(event);
    
    // Maintain max events limit
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }
  
  /**
   * Update event statistics
   */
  updateStats(event) {
    this.stats.totalEvents++;
    this.stats.lastEventTime = event.timestamp;
    
    // Count by type
    const typeCount = this.stats.eventsByType.get(event.type) || 0;
    this.stats.eventsByType.set(event.type, typeCount + 1);
    
    // Count by source
    const sourceCount = this.stats.eventsBySource.get(event.source) || 0;
    this.stats.eventsBySource.set(event.source, sourceCount + 1);
  }
  
  /**
   * Process event queue
   */
  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      while (this.processingQueue.length > 0) {
        const event = this.processingQueue.shift();
        
        // Emit event for rule engine
        this.emit('event', event);
        
        // Emit specific event type
        this.emit(`event:${event.type}`, event);
        
        // Emit source-specific event
        this.emit(`event:${event.source}:${event.type}`, event);
        
        // Broadcast to subscribers
        await this.broadcastToSubscribers(event);
        
        // Mark as processed
        event.metadata.processed = true;
      }
    } catch (error) {
      this.logger.error('Error processing event queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Subscribe to events
   */
  subscribe(pattern, callback) {
    const subscriberId = this.generateSubscriberId();
    
    this.subscribers.set(subscriberId, {
      pattern,
      callback,
      timestamp: new Date().toISOString()
    });
    
    this.logger.debug(`Event subscriber registered: ${subscriberId} for pattern: ${pattern}`);
    
    return subscriberId;
  }
  
  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriberId) {
    if (this.subscribers.has(subscriberId)) {
      this.subscribers.delete(subscriberId);
      this.logger.debug(`Event subscriber unregistered: ${subscriberId}`);
      return true;
    }
    return false;
  }
  
  /**
   * Broadcast event to subscribers
   */
  async broadcastToSubscribers(event) {
    const promises = [];
    
    for (const [subscriberId, subscriber] of this.subscribers) {
      if (this.matchesPattern(event, subscriber.pattern)) {
        try {
          const promise = subscriber.callback(event);
          promises.push(promise);
        } catch (error) {
          this.logger.error(`Error in subscriber ${subscriberId}:`, error);
        }
      }
    }
    
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }
  
  /**
   * Check if event matches pattern
   */
  matchesPattern(event, pattern) {
    if (typeof pattern === 'string') {
      return event.type === pattern || event.source === pattern;
    }
    
    if (pattern instanceof RegExp) {
      return pattern.test(event.type) || pattern.test(event.source);
    }
    
    if (typeof pattern === 'function') {
      return pattern(event);
    }
    
    return false;
  }
  
  /**
   * Get events by filter
   */
  getEvents(filter = {}) {
    let filtered = [...this.events];
    
    if (filter.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }
    
    if (filter.source) {
      filtered = filtered.filter(e => e.source === filter.source);
    }
    
    if (filter.since) {
      filtered = filtered.filter(e => new Date(e.timestamp) >= new Date(filter.since));
    }
    
    if (filter.until) {
      filtered = filtered.filter(e => new Date(e.timestamp) <= new Date(filter.until));
    }
    
    if (filter.limit) {
      filtered = filtered.slice(-filter.limit);
    }
    
    return filtered;
  }
  
  /**
   * Get event statistics
   */
  getStats() {
    return {
      ...this.stats,
      eventsByType: Object.fromEntries(this.stats.eventsByType),
      eventsBySource: Object.fromEntries(this.stats.eventsBySource),
      queueLength: this.processingQueue.length,
      subscriberCount: this.subscribers.size
    };
  }
  
  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate unique subscriber ID
   */
  generateSubscriberId() {
    return `subscriber-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Clear old events
   */
  clearOldEvents(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const cutoff = new Date(Date.now() - maxAge);
    const originalLength = this.events.length;
    
    this.events = this.events.filter(event => 
      new Date(event.timestamp) > cutoff
    );
    
    const removed = originalLength - this.events.length;
    if (removed > 0) {
      this.logger.info(`Cleared ${removed} old events`);
    }
  }
}

module.exports = EventBus; 