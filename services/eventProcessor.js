const EventEmitter = require('events');
const moment = require('moment');

class EventProcessor extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.isRunning = false;
    this.processingInterval = null;
    this.events = [];
    this.lastProcessedTime = null;
    this.filters = new Map();
  }

  async initialize() {
    this.logger.info('Initializing Event Processor...');
    this.lastProcessedTime = moment().subtract(1, 'hour').toISOString();
  }

  start() {
    if (this.isRunning) {
      this.logger.warn('Event processor is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting event processor...');

    // Start processing interval
    this.processingInterval = setInterval(() => {
      this.processEvents();
    }, this.config.processingInterval);

    // Process events immediately
    this.processEvents();
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.logger.info('Stopping event processor...');

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  async processEvents() {
    if (!this.isRunning) {
      return;
    }

    try {
      // This would typically fetch new events from the Unifi Protect API
      // For now, we'll simulate event processing
      const newEvents = await this.fetchNewEvents();
      
      if (newEvents.length > 0) {
        this.logger.info(`Processing ${newEvents.length} new events`);
        
        for (const event of newEvents) {
          await this.processEvent(event);
        }
      }
    } catch (error) {
      this.logger.error('Error processing events:', error);
    }
  }

  async fetchNewEvents() {
    // In a real implementation, this would fetch events from the Unifi Protect API
    // since the last processed time. For now, return empty array to disable test events.
    return [];
  }

  async processEvent(event) {
    try {
      // Apply filters
      if (!this.shouldProcessEvent(event)) {
        return;
      }

      // Enrich event data
      const enrichedEvent = await this.enrichEvent(event);

      // Store event
      this.events.push(enrichedEvent);

      // Limit stored events
      if (this.events.length > this.config.batchSize * 10) {
        this.events = this.events.slice(-this.config.batchSize * 5);
      }

      // Emit new event
      this.emit('newEvent', enrichedEvent);

      // Update last processed time
      this.lastProcessedTime = moment().toISOString();

      this.logger.debug(`Processed event: ${enrichedEvent.id} (${enrichedEvent.type})`);
    } catch (error) {
      this.logger.error(`Error processing event ${event.id}:`, error);
    }
  }

  shouldProcessEvent(event) {
    // Check if any filters are active
    if (this.filters.size === 0) {
      return true;
    }

    for (const [filterId, filter] of this.filters) {
      if (filter.enabled && !this.matchesFilter(event, filter)) {
        return false;
      }
    }

    return true;
  }

  matchesFilter(event, filter) {
    // Type filter
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(event.type)) {
        return false;
      }
    }

    // Camera filter
    if (filter.cameras && filter.cameras.length > 0) {
      if (!filter.cameras.includes(event.cameraId)) {
        return false;
      }
    }

    // Score filter
    if (filter.minScore && event.score < filter.minScore) {
      return false;
    }

    if (filter.maxScore && event.score > filter.maxScore) {
      return false;
    }

    // Time filter
    if (filter.startTime && moment(event.start).isBefore(filter.startTime)) {
      return false;
    }

    if (filter.endTime && moment(event.end).isAfter(filter.endTime)) {
      return false;
    }

    // Object type filter
    if (filter.objectTypes && filter.objectTypes.length > 0) {
      const eventObjectType = event.metadata?.objectType;
      if (!eventObjectType || !filter.objectTypes.includes(eventObjectType)) {
        return false;
      }
    }

    return true;
  }

  async enrichEvent(event) {
    // Add additional metadata and processing
    const enriched = {
      ...event,
      processedAt: new Date().toISOString(),
      duration: moment(event.end).diff(moment(event.start), 'seconds'),
      severity: this.calculateSeverity(event),
      tags: this.generateTags(event)
    };

    return enriched;
  }

  calculateSeverity(event) {
    let severity = 'low';
    
    if (event.score > 80) {
      severity = 'high';
    } else if (event.score > 50) {
      severity = 'medium';
    }

    // Adjust based on object type
    if (event.metadata?.objectType === 'person') {
      severity = 'high';
    }

    return severity;
  }

  generateTags(event) {
    const tags = [event.type];
    
    if (event.metadata?.objectType) {
      tags.push(event.metadata.objectType);
    }
    
    if (event.score > 80) {
      tags.push('high-confidence');
    }
    
    return tags;
  }

  addFilter(filterId, filter) {
    this.filters.set(filterId, {
      ...filter,
      enabled: true,
      createdAt: new Date().toISOString()
    });
    
    this.logger.info(`Added filter: ${filterId}`);
  }

  removeFilter(filterId) {
    const removed = this.filters.delete(filterId);
    if (removed) {
      this.logger.info(`Removed filter: ${filterId}`);
    }
    return removed;
  }

  updateFilter(filterId, updates) {
    const filter = this.filters.get(filterId);
    if (filter) {
      this.filters.set(filterId, {
        ...filter,
        ...updates,
        updatedAt: new Date().toISOString()
      });
      this.logger.info(`Updated filter: ${filterId}`);
      return true;
    }
    return false;
  }

  getFilters() {
    return Array.from(this.filters.entries()).map(([id, filter]) => ({
      id,
      ...filter
    }));
  }

  getEvents(options = {}) {
    let events = [...this.events];

    // Apply filters
    if (options.filters) {
      events = events.filter(event => {
        for (const filter of options.filters) {
          if (!this.matchesFilter(event, filter)) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply sorting
    if (options.sortBy) {
      events.sort((a, b) => {
        const aValue = a[options.sortBy];
        const bValue = b[options.sortBy];
        
        if (options.sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
      });
    }

    // Apply pagination
    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  getEventStats() {
    const stats = {
      total: this.events.length,
      byType: {},
      bySeverity: {},
      byCamera: {},
      recent: 0
    };

    const oneHourAgo = moment().subtract(1, 'hour');

    for (const event of this.events) {
      // Count by type
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
      
      // Count by camera
      stats.byCamera[event.cameraId] = (stats.byCamera[event.cameraId] || 0) + 1;
      
      // Count recent events
      if (moment(event.start).isAfter(oneHourAgo)) {
        stats.recent++;
      }
    }

    return stats;
  }

  clearEvents() {
    const count = this.events.length;
    this.events = [];
    this.logger.info(`Cleared ${count} events`);
    return count;
  }
}

module.exports = EventProcessor;