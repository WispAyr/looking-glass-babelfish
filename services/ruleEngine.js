const EventEmitter = require('events');
const winston = require('winston');

/**
 * Rule Engine
 * 
 * Processes events and executes actions based on configurable rules.
 * Supports complex conditions, rule chaining, and action orchestration.
 */
class RuleEngine extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || winston.createLogger();
    
    // Rule storage
    this.rules = new Map();
    this.ruleTemplates = new Map();
    
    // Rule execution stats
    this.stats = {
      totalRules: 0,
      rulesExecuted: 0,
      actionsExecuted: 0,
      errors: 0,
      lastExecution: null
    };
    
    // Action registry
    this.actionRegistry = new Map();
    
    // Rule execution queue
    this.executionQueue = [];
    this.isExecuting = false;
    
    this.logger.info('Rule Engine initialized');
  }
  
  /**
   * Register a rule
   */
  registerRule(rule) {
    try {
      // Validate rule
      this.validateRule(rule);
      
      // Generate rule ID if not provided
      if (!rule.id) {
        rule.id = this.generateRuleId();
      }
      
      // Add metadata
      rule.metadata = {
        ...rule.metadata,
        created: rule.metadata?.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        enabled: rule.metadata?.enabled !== false
      };
      
      this.rules.set(rule.id, rule);
      this.stats.totalRules = this.rules.size;
      
      this.logger.info(`Rule registered: ${rule.id} - ${rule.name}`);
      this.emit('rule:registered', rule);
      
      return rule.id;
    } catch (error) {
      this.logger.error('Error registering rule:', error);
      throw error;
    }
  }
  
  /**
   * Update a rule
   */
  updateRule(ruleId, updates) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
    
    const updatedRule = {
      ...rule,
      ...updates,
      metadata: {
        ...rule.metadata,
        ...updates.metadata,
        updated: new Date().toISOString()
      }
    };
    
    this.validateRule(updatedRule);
    this.rules.set(ruleId, updatedRule);
    
    this.logger.info(`Rule updated: ${ruleId}`);
    this.emit('rule:updated', updatedRule);
    
    return updatedRule;
  }
  
  /**
   * Remove a rule
   */
  removeRule(ruleId) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
    
    this.rules.delete(ruleId);
    this.stats.totalRules = this.rules.size;
    
    this.logger.info(`Rule removed: ${ruleId}`);
    this.emit('rule:removed', rule);
    
    return true;
  }
  
  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId, enabled) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
    
    rule.metadata.enabled = enabled;
    rule.metadata.updated = new Date().toISOString();
    
    this.logger.info(`Rule ${enabled ? 'enabled' : 'disabled'}: ${ruleId}`);
    this.emit('rule:enabled', { ruleId, enabled });
    
    return rule;
  }
  
  /**
   * Process an event through rules
   */
  async processEvent(event) {
    try {
      // Find matching rules
      const matchingRules = this.findMatchingRules(event);
      
      if (matchingRules.length === 0) {
        return { processed: false, rulesMatched: 0 };
      }
      
      // Add to execution queue
      this.executionQueue.push({
        event,
        rules: matchingRules,
        timestamp: new Date().toISOString()
      });
      
      // Execute queue if not already executing
      if (!this.isExecuting) {
        this.executeQueue();
      }
      
      return { processed: true, rulesMatched: matchingRules.length };
    } catch (error) {
      this.logger.error('Error processing event:', error);
      this.stats.errors++;
      throw error;
    }
  }
  
  /**
   * Find rules that match an event
   */
  findMatchingRules(event) {
    const matchingRules = [];
    
    for (const [ruleId, rule] of this.rules) {
      if (!rule.metadata.enabled) {
        continue;
      }
      
      if (this.evaluateConditions(event, rule.conditions)) {
        matchingRules.push(rule);
      }
    }
    
    return matchingRules;
  }
  
  /**
   * Evaluate rule conditions
   */
  evaluateConditions(event, conditions) {
    if (!conditions) {
      return true;
    }
    
    // Simple condition evaluation
    if (conditions.eventType && event.type !== conditions.eventType) {
      return false;
    }
    
    if (conditions.source && event.source !== conditions.source) {
      return false;
    }
    
    // Time-based conditions
    if (conditions.timeRange) {
      const eventTime = new Date(event.timestamp);
      const currentTime = eventTime.getHours() * 60 + eventTime.getMinutes();
      
      if (conditions.timeRange.start) {
        const startTime = this.parseTime(conditions.timeRange.start);
        if (currentTime < startTime) {
          return false;
        }
      }
      
      if (conditions.timeRange.end) {
        const endTime = this.parseTime(conditions.timeRange.end);
        if (currentTime > endTime) {
          return false;
        }
      }
    }
    
    // Data-based conditions
    if (conditions.data) {
      for (const [key, value] of Object.entries(conditions.data)) {
        if (event.data[key] !== value) {
          return false;
        }
      }
    }
    
    // Custom condition function
    if (conditions.custom && typeof conditions.custom === 'function') {
      return conditions.custom(event);
    }
    
    return true;
  }
  
  /**
   * Execute rule queue
   */
  async executeQueue() {
    if (this.isExecuting || this.executionQueue.length === 0) {
      return;
    }
    
    this.isExecuting = true;
    
    try {
      while (this.executionQueue.length > 0) {
        const execution = this.executionQueue.shift();
        
        for (const rule of execution.rules) {
          try {
            await this.executeRule(rule, execution.event);
            this.stats.rulesExecuted++;
          } catch (error) {
            this.logger.error(`Error executing rule ${rule.id}:`, error);
            this.stats.errors++;
          }
        }
        
        this.stats.lastExecution = execution.timestamp;
      }
    } catch (error) {
      this.logger.error('Error executing rule queue:', error);
    } finally {
      this.isExecuting = false;
    }
  }
  
  /**
   * Execute a single rule
   */
  async executeRule(rule, event) {
    this.logger.debug(`Executing rule: ${rule.id} for event: ${event.type}`);
    
    // Execute actions
    const results = [];
    for (const action of rule.actions) {
      try {
        const result = await this.executeAction(action, event, rule);
        results.push(result);
        this.stats.actionsExecuted++;
      } catch (error) {
        this.logger.error(`Error executing action in rule ${rule.id}:`, error);
        results.push({ error: error.message });
      }
    }
    
    // Emit rule execution event
    this.emit('rule:executed', {
      ruleId: rule.id,
      event,
      results,
      timestamp: new Date().toISOString()
    });
    
    return results;
  }
  
  /**
   * Execute an action
   */
  async executeAction(action, event, rule) {
    const actionHandler = this.actionRegistry.get(action.type);
    if (!actionHandler) {
      throw new Error(`Unknown action type: ${action.type}`);
    }
    
    const context = {
      event,
      rule,
      action,
      timestamp: new Date().toISOString(),
      // Add connectors and other services to context
      connectors: this.connectors,
      eventBus: this.eventBus,
      cache: this.cache
    };
    
    return await actionHandler(action, context);
  }
  
  /**
   * Register an action handler
   */
  registerAction(type, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Action handler must be a function');
    }
    
    this.actionRegistry.set(type, handler);
    this.logger.info(`Action registered: ${type}`);
    
    return true;
  }
  
  /**
   * Get all rules
   */
  getRules() {
    return Array.from(this.rules.values());
  }
  
  /**
   * Get rule by ID
   */
  getRule(ruleId) {
    return this.rules.get(ruleId);
  }
  
  /**
   * Get rule statistics
   */
  getStats() {
    return {
      ...this.stats,
      rules: this.rules.size,
      actions: this.actionRegistry.size,
      queueLength: this.executionQueue.length
    };
  }
  
  /**
   * Validate rule structure
   */
  validateRule(rule) {
    if (!rule.name) {
      throw new Error('Rule must have a name');
    }
    
    if (!rule.actions || !Array.isArray(rule.actions) || rule.actions.length === 0) {
      throw new Error('Rule must have at least one action');
    }
    
    // Validate actions
    for (const action of rule.actions) {
      if (!action.type) {
        throw new Error('Action must have a type');
      }
    }
  }
  
  /**
   * Parse time string (HH:MM format)
   */
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  /**
   * Generate unique rule ID
   */
  generateRuleId() {
    return `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Load rules from configuration
   */
  loadRules(rules) {
    for (const rule of rules) {
      this.registerRule(rule);
    }
  }
  
  /**
   * Export rules to configuration
   */
  exportRules() {
    return Array.from(this.rules.values()).map(rule => ({
      ...rule,
      metadata: {
        ...rule.metadata,
        exported: new Date().toISOString()
      }
    }));
  }
  
  /**
   * Set connectors reference
   */
  setConnectors(connectors) {
    this.connectors = connectors;
  }
  
  /**
   * Set event bus reference
   */
  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }
  
  /**
   * Set cache reference
   */
  setCache(cache) {
    this.cache = cache;
  }
}

module.exports = RuleEngine; 