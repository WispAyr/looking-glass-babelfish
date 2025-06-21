const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * Flow Builder Service
 * 
 * Manages the creation, storage, and execution of visual flows
 * with drag-and-drop capabilities and rule-based automation.
 */
class FlowBuilder extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      flowsDir: path.join(process.cwd(), 'config', 'flows'),
      autoSave: true,
      maxFlows: 100,
      ...config
    };
    
    this.flows = new Map();
    this.executingFlows = new Set();
    this.flowTemplates = new Map();
    
    // Initialize flow templates
    this.initializeTemplates();
  }

  /**
   * Initialize default flow templates
   */
  initializeTemplates() {
    // Loitering Detection to Telegram Flow
    this.flowTemplates.set('loitering-telegram', {
      id: 'loitering-telegram',
      name: 'Loitering Detection to Telegram',
      description: 'Detect loitering and send camera snapshot to Telegram',
      category: 'security',
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          name: 'Loitering Detected',
          position: { x: 100, y: 100 },
          config: {
            eventType: 'smartDetectLoiterZone',
            conditions: {
              confidence: { min: 50 }
            }
          }
        },
        {
          id: 'action-1',
          type: 'action',
          name: 'Get Camera Snapshot',
          position: { x: 300, y: 100 },
          config: {
            actionType: 'connector_execute',
            connectorId: 'unifi-protect-main',
            capability: 'camera:snapshot',
            parameters: {
              cameraId: '{{trigger.device}}'
            }
          }
        },
        {
          id: 'action-2',
          type: 'action',
          name: 'Send to Telegram',
          position: { x: 500, y: 100 },
          config: {
            actionType: 'telegram_send',
            parameters: {
              chatId: '{{config.chatId}}',
              message: '🚨 Loitering detected on camera {{trigger.device}}',
              photo: '{{action-1.result.snapshotUrl}}',
              caption: 'Loitering detected at {{trigger.timestamp}}'
            }
          }
        }
      ],
      connections: [
        { from: 'trigger-1', to: 'action-1', type: 'success' },
        { from: 'action-1', to: 'action-2', type: 'success' }
      ]
    });

    // Motion Notification Flow
    this.flowTemplates.set('motion-notification', {
      id: 'motion-notification',
      name: 'Motion Detection Notification',
      description: 'Send notification when motion is detected',
      category: 'monitoring',
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          name: 'Motion Detected',
          position: { x: 100, y: 100 },
          config: {
            eventType: 'motion',
            conditions: {
              duration: { min: 2000 }
            }
          }
        },
        {
          id: 'action-1',
          type: 'action',
          name: 'Send Notification',
          position: { x: 300, y: 100 },
          config: {
            actionType: 'send_notification',
            parameters: {
              title: 'Motion Detected',
              message: 'Motion detected on camera {{trigger.device}}',
              priority: 'medium'
            }
          }
        }
      ],
      connections: [
        { from: 'trigger-1', to: 'action-1', type: 'success' }
      ]
    });
  }

  /**
   * Create a new flow
   */
  async createFlow(flowData) {
    const flowId = flowData.id || this.generateFlowId();
    const flow = {
      id: flowId,
      name: flowData.name || 'New Flow',
      description: flowData.description || '',
      category: flowData.category || 'general',
      nodes: flowData.nodes || [],
      connections: flowData.connections || [],
      config: flowData.config || {},
      enabled: flowData.enabled !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    this.flows.set(flowId, flow);
    
    if (this.config.autoSave) {
      await this.saveFlow(flowId);
    }

    this.emit('flow:created', { flowId, flow });
    return flow;
  }

  /**
   * Load flows from filesystem
   */
  async loadFlows() {
    try {
      await fs.mkdir(this.config.flowsDir, { recursive: true });
      const files = await fs.readdir(this.config.flowsDir);
      
      for (const file of files) {
        if (path.extname(file) === '.json') {
          const flowId = path.basename(file, '.json');
          try {
            const content = await fs.readFile(path.join(this.config.flowsDir, file), 'utf-8');
            const flow = JSON.parse(content);
            this.flows.set(flowId, flow);
            this.logger?.info(`Loaded flow: ${flowId}`);
          } catch (parseError) {
            this.logger?.error(`Failed to parse flow file ${file}:`, parseError);
          }
        }
      }
    } catch (error) {
      this.logger?.error('Error loading flows:', error);
    }
  }

  /**
   * Save flow to filesystem
   */
  async saveFlow(flowId) {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow '${flowId}' not found`);
    }

    try {
      const filePath = path.join(this.config.flowsDir, `${flowId}.json`);
      await fs.writeFile(filePath, JSON.stringify(flow, null, 2));
      this.logger?.info(`Saved flow: ${flowId}`);
    } catch (error) {
      this.logger?.error(`Failed to save flow ${flowId}:`, error);
      throw error;
    }
  }

  /**
   * Get a flow by ID
   */
  getFlow(flowId) {
    return this.flows.get(flowId);
  }

  /**
   * List all flows
   */
  listFlows() {
    return Array.from(this.flows.values());
  }

  /**
   * Update a flow
   */
  async updateFlow(flowId, updates) {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow '${flowId}' not found`);
    }

    const updatedFlow = {
      ...flow,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.flows.set(flowId, updatedFlow);
    
    if (this.config.autoSave) {
      await this.saveFlow(flowId);
    }

    this.emit('flow:updated', { flowId, flow: updatedFlow });
    return updatedFlow;
  }

  /**
   * Delete a flow
   */
  async deleteFlow(flowId) {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow '${flowId}' not found`);
    }

    try {
      const filePath = path.join(this.config.flowsDir, `${flowId}.json`);
      await fs.unlink(filePath);
      this.flows.delete(flowId);
      this.logger?.info(`Deleted flow: ${flowId}`);
      this.emit('flow:deleted', { flowId });
    } catch (error) {
      this.logger?.error(`Failed to delete flow ${flowId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a flow
   */
  async executeFlow(flowId, context = {}) {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow '${flowId}' not found`);
    }

    if (!flow.enabled) {
      this.logger?.info(`Flow ${flowId} is disabled, skipping execution`);
      return;
    }

    if (this.executingFlows.has(flowId)) {
      this.logger?.warn(`Flow ${flowId} is already executing, skipping`);
      return;
    }

    this.executingFlows.add(flowId);
    
    try {
      this.logger?.info(`Executing flow: ${flowId}`);
      this.emit('flow:executing', { flowId, flow, context });

      const result = await this.executeFlowNodes(flow, context);
      
      this.emit('flow:completed', { flowId, flow, context, result });
      return result;
    } catch (error) {
      this.logger?.error(`Error executing flow ${flowId}:`, error);
      this.emit('flow:error', { flowId, flow, context, error });
      throw error;
    } finally {
      this.executingFlows.delete(flowId);
    }
  }

  /**
   * Execute flow nodes
   */
  async executeFlowNodes(flow, context) {
    const results = new Map();
    const nodeStates = new Map();

    // Find trigger nodes
    const triggerNodes = flow.nodes.filter(node => node.type === 'trigger');
    
    for (const triggerNode of triggerNodes) {
      await this.executeNode(triggerNode, context, results, nodeStates, flow);
    }

    return results;
  }

  /**
   * Execute a single node
   */
  async executeNode(node, context, results, nodeStates, flow) {
    if (nodeStates.get(node.id) === 'executing') {
      return; // Prevent circular execution
    }

    nodeStates.set(node.id, 'executing');
    
    try {
      this.logger?.debug(`Executing node: ${node.id} (${node.type})`);
      
      let result;
      
      switch (node.type) {
        case 'trigger':
          result = await this.executeTriggerNode(node, context);
          break;
        case 'action':
          result = await this.executeActionNode(node, context, results);
          break;
        case 'condition':
          result = await this.executeConditionNode(node, context, results);
          break;
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      results.set(node.id, result);
      nodeStates.set(node.id, 'completed');
      
      // Execute connected nodes
      const connections = flow.connections.filter(conn => conn.from === node.id);
      for (const connection of connections) {
        const nextNode = flow.nodes.find(n => n.id === connection.to);
        if (nextNode) {
          await this.executeNode(nextNode, context, results, nodeStates, flow);
        }
      }

      return result;
    } catch (error) {
      nodeStates.set(node.id, 'error');
      this.logger?.error(`Error executing node ${node.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute trigger node
   */
  async executeTriggerNode(node, context) {
    // Trigger nodes are typically executed by external events
    // This method handles the trigger logic when an event matches
    return {
      type: 'trigger',
      nodeId: node.id,
      triggered: true,
      eventData: context.eventData || {},
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute action node
   */
  async executeActionNode(node, context, results) {
    const actionType = node.config.actionType;
    const parameters = this.resolveParameters(node.config.parameters, context, results);
    
    this.logger?.debug(`Executing action: ${actionType}`, parameters);
    
    // Emit action execution event for external handlers
    this.emit('action:execute', {
      actionType,
      parameters,
      nodeId: node.id,
      flowId: context.flowId
    });

    // Execute action using Action Framework if available
    let actionResult = null;
    try {
      const actionFramework = global.actionFramework || this.actionFramework;
      if (actionFramework) {
        const action = {
          type: actionType,
          parameters: parameters
        };
        
        const executionContext = {
          connectors: this.getConnectorsMap(),
          eventBus: global.eventBus || this.eventBus,
          flowId: context.flowId,
          nodeId: node.id
        };
        
        const result = await actionFramework.executeAction(action, executionContext);
        actionResult = result.result || result;
      }
    } catch (error) {
      this.logger?.error(`Error executing action ${actionType}:`, error);
      actionResult = { error: error.message };
    }

    return {
      type: 'action',
      nodeId: node.id,
      actionType,
      parameters,
      executed: true,
      result: actionResult,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get connectors map for action execution
   */
  getConnectorsMap() {
    const connectorsMap = new Map();
    
    try {
      const connectorRegistry = global.connectorRegistry || this.connectorRegistry;
      if (connectorRegistry) {
        const connectors = connectorRegistry.getConnectors();
        connectors.forEach(connector => {
          connectorsMap.set(connector.id, connector);
        });
      }
    } catch (error) {
      this.logger?.error('Error getting connectors map:', error);
    }
    
    return connectorsMap;
  }

  /**
   * Execute condition node
   */
  async executeConditionNode(node, context, results) {
    const conditions = node.config.conditions;
    const data = this.resolveParameters(node.config.data, context, results);
    
    let result = true;
    
    for (const [field, condition] of Object.entries(conditions)) {
      const value = data[field];
      
      if (condition.min !== undefined && value < condition.min) {
        result = false;
        break;
      }
      
      if (condition.max !== undefined && value > condition.max) {
        result = false;
        break;
      }
      
      if (condition.equals !== undefined && value !== condition.equals) {
        result = false;
        break;
      }
      
      if (condition.contains !== undefined && !value.includes(condition.contains)) {
        result = false;
        break;
      }
    }

    return {
      type: 'condition',
      nodeId: node.id,
      conditions,
      data,
      result,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Resolve parameters with variable substitution
   */
  resolveParameters(parameters, context, results) {
    if (!parameters) return {};
    
    const resolved = {};
    
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveString(value, context, results);
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveParameters(value, context, results);
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }

  /**
   * Resolve string with variable substitution
   */
  resolveString(str, context, results) {
    return str.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const parts = variable.split('.');
      
      if (parts[0] === 'trigger') {
        return this.getNestedValue(context.eventData, parts.slice(1));
      } else if (parts[0] === 'config') {
        return this.getNestedValue(context.config, parts.slice(1));
      } else if (parts[0] === 'results') {
        const nodeId = parts[1];
        const result = results.get(nodeId);
        return this.getNestedValue(result, parts.slice(2));
      } else {
        return this.getNestedValue(context, parts);
      }
    });
  }

  /**
   * Get nested object value
   */
  getNestedValue(obj, parts) {
    let current = obj;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return '';
      }
    }
    
    return current || '';
  }

  /**
   * Generate unique flow ID
   */
  generateFlowId() {
    return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get flow templates
   */
  getTemplates() {
    return Array.from(this.flowTemplates.values());
  }

  /**
   * Create flow from template
   */
  async createFromTemplate(templateId, customizations = {}) {
    const template = this.flowTemplates.get(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    const flowData = {
      ...template,
      ...customizations,
      id: customizations.id || this.generateFlowId()
    };

    return await this.createFlow(flowData);
  }

  /**
   * Validate flow structure
   */
  validateFlow(flow) {
    const errors = [];

    if (!flow.name) {
      errors.push('Flow name is required');
    }

    if (!flow.nodes || flow.nodes.length === 0) {
      errors.push('Flow must have at least one node');
    }

    // Check for trigger nodes
    const triggerNodes = flow.nodes.filter(node => node.type === 'trigger');
    if (triggerNodes.length === 0) {
      errors.push('Flow must have at least one trigger node');
    }

    // Validate connections
    for (const connection of flow.connections || []) {
      const fromNode = flow.nodes.find(n => n.id === connection.from);
      const toNode = flow.nodes.find(n => n.id === connection.to);
      
      if (!fromNode) {
        errors.push(`Connection references non-existent node: ${connection.from}`);
      }
      
      if (!toNode) {
        errors.push(`Connection references non-existent node: ${connection.to}`);
      }
    }

    return errors;
  }

  /**
   * Initialize the flow builder
   */
  async initialize() {
    await this.loadFlows();
    this.logger?.info(`Flow Builder initialized with ${this.flows.size} flows`);
  }
}

module.exports = FlowBuilder; 