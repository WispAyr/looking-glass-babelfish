const EventEmitter = require('events');
const winston = require('winston');

/**
 * Flow Orchestrator
 * 
 * Coordinates the event bus, rule engine, and action framework.
 * Provides a unified interface for managing event flows and rule execution.
 */
class FlowOrchestrator extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || winston.createLogger();
    
    // Core services
    this.eventBus = null;
    this.ruleEngine = null;
    this.actionFramework = null;
    
    // Service references
    this.connectors = new Map();
    this.cache = null;
    this.mqttBroker = null;
    
    // Flow statistics
    this.stats = {
      totalFlows: 0,
      activeFlows: 0,
      completedFlows: 0,
      failedFlows: 0,
      lastFlow: null
    };
    
    // Flow definitions
    this.flows = new Map();
    
    this.logger.info('Flow Orchestrator initialized');
  }
  
  /**
   * Initialize the orchestrator with services
   */
  async initialize(services) {
    try {
      this.logger.info('Initializing Flow Orchestrator...');
      
      // Store service references
      this.eventBus = services.eventBus;
      this.ruleEngine = services.ruleEngine;
      this.actionFramework = services.actionFramework;
      this.connectors = services.connectors || new Map();
      this.cache = services.cache;
      this.mqttBroker = services.mqttBroker;
      
      // Set up event bus integration
      this.setupEventBusIntegration();
      
      // Set up rule engine integration
      this.setupRuleEngineIntegration();
      
      // Load default flows
      await this.loadDefaultFlows();
      
      this.logger.info('Flow Orchestrator initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Flow Orchestrator:', error);
      throw error;
    }
  }
  
  /**
   * Set up event bus integration
   */
  setupEventBusIntegration() {
    if (!this.eventBus) {
      throw new Error('Event Bus not available');
    }
    
    // Listen for events and process through rule engine
    this.eventBus.on('event', async (event) => {
      try {
        await this.processEvent(event);
      } catch (error) {
        this.logger.error('Error processing event in orchestrator:', error);
      }
    });
    
    // Listen for specific event types
    this.eventBus.on('event:motion', (event) => {
      this.logger.debug(`Motion event received: ${event.id}`);
    });
    
    this.eventBus.on('event:smartDetectZone', (event) => {
      this.logger.debug(`Smart detect event received: ${event.id}`);
    });
    
    this.eventBus.on('event:ring', (event) => {
      this.logger.debug(`Ring event received: ${event.id}`);
    });
    
    this.logger.info('Event Bus integration configured');
  }
  
  /**
   * Set up rule engine integration
   */
  setupRuleEngineIntegration() {
    if (!this.ruleEngine) {
      throw new Error('Rule Engine not available');
    }
    
    // Register action handlers with rule engine
    this.registerActionHandlers();
    
    // Listen for rule execution events
    this.ruleEngine.on('rule:executed', (data) => {
      this.logger.info(`Rule executed: ${data.ruleId}`);
      this.stats.lastFlow = data.timestamp;
    });
    
    this.ruleEngine.on('rule:registered', (rule) => {
      this.logger.info(`Rule registered: ${rule.id} - ${rule.name}`);
    });
    
    this.logger.info('Rule Engine integration configured');
  }
  
  /**
   * Register action handlers with rule engine
   */
  registerActionHandlers() {
    // Register all action framework actions with rule engine
    const actionTypes = this.actionFramework.getAvailableActions();
    
    for (const actionType of actionTypes) {
      this.ruleEngine.registerAction(actionType, async (context) => {
        return await this.actionFramework.executeAction(context.action, {
          ...context,
          connectors: this.connectors,
          cache: this.cache,
          eventBus: this.eventBus,
          mqttBroker: this.mqttBroker
        });
      });
    }
    
    this.logger.info(`Registered ${actionTypes.length} action handlers`);
  }
  
  /**
   * Process an event through the flow system
   */
  async processEvent(event) {
    try {
      this.stats.totalFlows++;
      this.stats.activeFlows++;
      
      // Process through rule engine
      const result = await this.ruleEngine.processEvent(event);
      
      if (result.processed) {
        this.stats.completedFlows++;
        this.logger.debug(`Event processed by ${result.rulesMatched} rules: ${event.type}`);
      } else {
        this.logger.debug(`No rules matched for event: ${event.type}`);
      }
      
      this.stats.activeFlows--;
      
      return result;
    } catch (error) {
      this.stats.failedFlows++;
      this.stats.activeFlows--;
      this.logger.error('Error processing event flow:', error);
      throw error;
    }
  }
  
  /**
   * Create a flow definition
   */
  createFlow(flowDefinition) {
    try {
      // Validate flow definition
      this.validateFlowDefinition(flowDefinition);
      
      // Generate flow ID if not provided
      if (!flowDefinition.id) {
        flowDefinition.id = this.generateFlowId();
      }
      
      // Add metadata
      flowDefinition.metadata = {
        ...flowDefinition.metadata,
        created: flowDefinition.metadata?.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        enabled: flowDefinition.metadata?.enabled !== false
      };
      
      this.flows.set(flowDefinition.id, flowDefinition);
      this.stats.totalFlows = this.flows.size;
      
      this.logger.info(`Flow created: ${flowDefinition.id} - ${flowDefinition.name}`);
      this.emit('flow:created', flowDefinition);
      
      return flowDefinition.id;
    } catch (error) {
      this.logger.error('Error creating flow:', error);
      throw error;
    }
  }
  
  /**
   * Execute a flow
   */
  async executeFlow(flowId, input = {}) {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    
    if (!flow.metadata.enabled) {
      throw new Error(`Flow is disabled: ${flowId}`);
    }
    
    try {
      this.logger.info(`Executing flow: ${flowId}`);
      
      const context = {
        flow,
        input,
        timestamp: new Date().toISOString()
      };
      
      // Execute flow steps
      const results = [];
      for (const step of flow.steps) {
        try {
          const result = await this.executeFlowStep(step, context);
          results.push(result);
        } catch (error) {
          this.logger.error(`Error executing flow step: ${step.id}`, error);
          results.push({ error: error.message });
        }
      }
      
      this.emit('flow:executed', {
        flowId,
        input,
        results,
        timestamp: new Date().toISOString()
      });
      
      return results;
    } catch (error) {
      this.logger.error(`Error executing flow: ${flowId}`, error);
      throw error;
    }
  }
  
  /**
   * Execute a flow step
   */
  async executeFlowStep(step, context) {
    switch (step.type) {
      case 'rule':
        return await this.executeRuleStep(step, context);
      case 'action':
        return await this.executeActionStep(step, context);
      case 'condition':
        return await this.executeConditionStep(step, context);
      case 'transform':
        return await this.executeTransformStep(step, context);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }
  
  /**
   * Execute a rule step
   */
  async executeRuleStep(step, context) {
    const rule = this.ruleEngine.getRule(step.ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${step.ruleId}`);
    }
    
    // Create synthetic event for rule execution
    const event = {
      id: `flow-event-${Date.now()}`,
      type: 'flow_execution',
      source: 'flow_orchestrator',
      timestamp: new Date().toISOString(),
      data: context.input
    };
    
    return await this.ruleEngine.processEvent(event);
  }
  
  /**
   * Execute an action step
   */
  async executeActionStep(step, context) {
    return await this.actionFramework.executeAction(step.action, {
      ...context,
      connectors: this.connectors,
      cache: this.cache,
      eventBus: this.eventBus,
      mqttBroker: this.mqttBroker
    });
  }
  
  /**
   * Execute a condition step
   */
  async executeConditionStep(step, context) {
    const condition = step.condition;
    const result = this.evaluateCondition(condition, context);
    
    return {
      condition: condition,
      result: result,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Execute a transform step
   */
  async executeTransformStep(step, context) {
    const { input, transform } = step;
    
    let result = input || context.input;
    
    if (transform.type === 'template') {
      result = this.applyTemplate(result, transform.template);
    } else if (transform.type === 'function' && typeof transform.function === 'function') {
      result = transform.function(result, context);
    }
    
    return {
      transformed: true,
      input: input || context.input,
      output: result,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Load default flows
   */
  async loadDefaultFlows() {
    const defaultFlows = [
      {
        id: 'motion-notification',
        name: 'Motion Notification Flow',
        description: 'Send notification when motion is detected',
        steps: [
          {
            id: 'motion-rule',
            type: 'rule',
            ruleId: 'motion-notification-rule'
          }
        ],
        metadata: {
          enabled: true,
          category: 'notification'
        }
      },
      {
        id: 'smart-detect-alert',
        name: 'Smart Detect Alert Flow',
        description: 'Handle smart detect events with alerts',
        steps: [
          {
            id: 'smart-detect-rule',
            type: 'rule',
            ruleId: 'smart-detect-alert-rule'
          }
        ],
        metadata: {
          enabled: true,
          category: 'alert'
        }
      }
    ];
    
    for (const flow of defaultFlows) {
      this.createFlow(flow);
    }
    
    this.logger.info(`Loaded ${defaultFlows.length} default flows`);
  }
  
  /**
   * Get all flows
   */
  getFlows() {
    return Array.from(this.flows.values());
  }
  
  /**
   * Get flow by ID
   */
  getFlow(flowId) {
    return this.flows.get(flowId);
  }
  
  /**
   * Update a flow
   */
  updateFlow(flowId, updates) {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    
    const updatedFlow = {
      ...flow,
      ...updates,
      metadata: {
        ...flow.metadata,
        ...updates.metadata,
        updated: new Date().toISOString()
      }
    };
    
    this.validateFlowDefinition(updatedFlow);
    this.flows.set(flowId, updatedFlow);
    
    this.logger.info(`Flow updated: ${flowId}`);
    this.emit('flow:updated', updatedFlow);
    
    return updatedFlow;
  }
  
  /**
   * Delete a flow
   */
  deleteFlow(flowId) {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    
    this.flows.delete(flowId);
    this.stats.totalFlows = this.flows.size;
    
    this.logger.info(`Flow deleted: ${flowId}`);
    this.emit('flow:deleted', flow);
    
    return true;
  }
  
  /**
   * Validate flow definition
   */
  validateFlowDefinition(flow) {
    if (!flow.name) {
      throw new Error('Flow must have a name');
    }
    
    if (!flow.steps || !Array.isArray(flow.steps) || flow.steps.length === 0) {
      throw new Error('Flow must have at least one step');
    }
    
    // Validate steps
    for (const step of flow.steps) {
      if (!step.id || !step.type) {
        throw new Error('Flow step must have id and type');
      }
    }
  }
  
  /**
   * Evaluate condition
   */
  evaluateCondition(condition, context) {
    if (typeof condition === 'function') {
      return condition(context);
    }
    
    if (typeof condition === 'string') {
      return !!condition;
    }
    
    return !!condition;
  }
  
  /**
   * Apply template
   */
  applyTemplate(input, template) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return input[key] || match;
    });
  }
  
  /**
   * Generate unique flow ID
   */
  generateFlowId() {
    return `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get orchestrator statistics
   */
  getStats() {
    return {
      ...this.stats,
      flows: this.flows.size,
      eventBusStats: this.eventBus?.getStats(),
      ruleEngineStats: this.ruleEngine?.getStats(),
      actionFrameworkStats: this.actionFramework?.getStats()
    };
  }
}

module.exports = FlowOrchestrator; 