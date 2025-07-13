const EventEmitter = require('events');
const winston = require('winston');

class FlowOrchestrator extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger || winston.createLogger();
    this.flows = new Map();
    this.executingFlows = new Set();
    this.logger.info('Flow Orchestrator initialized');
  }

  registerFlow(flow) {
    this.flows.set(flow.id, flow);
    this.logger.info(`Flow registered: ${flow.id} - ${flow.name}`);
    this.emit('flow:registered', flow);
  }

  async executeFlow(flowId, context = {}) {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow '${flowId}' not found`);
    }

    if (this.executingFlows.has(flowId)) {
      this.logger.warn(`Flow ${flowId} is already executing, skipping`);
      return;
    }

    this.executingFlows.add(flowId);

    try {
      this.logger.info(`Executing flow: ${flowId}`);
      this.emit('flow:executing', { flowId, flow, context });

      const result = await this.executeNodes(flow, context);

      this.emit('flow:completed', { flowId, flow, context, result });
      return result;
    } catch (error) {
      this.logger.error(`Error executing flow ${flowId}:`, error);
      this.emit('flow:error', { flowId, flow, context, error });
      throw error;
    } finally {
      this.executingFlows.delete(flowId);
    }
  }

  async executeNodes(flow, context) {
    const results = new Map();
    const nodeStates = new Map();

    const triggerNodes = flow.nodes.filter(node => node.type === 'trigger');

    for (const triggerNode of triggerNodes) {
      await this.executeNode(triggerNode, context, results, nodeStates, flow);
    }

    return results;
  }

  async executeNode(node, context, results, nodeStates, flow) {
    if (nodeStates.get(node.id) === 'executing') {
      return;
    }

    nodeStates.set(node.id, 'executing');

    try {
      this.logger.debug(`Executing node: ${node.id} (${node.type})`);

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
      this.logger.error(`Error executing node ${node.id}:`, error);
      throw error;
    }
  }

  async executeTriggerNode(node, context) {
    return {
      type: 'trigger',
      nodeId: node.id,
      triggered: true,
      eventData: context.eventData || {},
      timestamp: new Date().toISOString()
    };
  }

  async executeActionNode(node, context, results) {
    const actionType = node.config.actionType;
    const parameters = this.resolveParameters(node.config.parameters, context, results);

    this.logger.debug(`Executing action: ${actionType}`, parameters);

    this.emit('action:execute', {
      actionType,
      parameters,
      nodeId: node.id,
      flowId: context.flowId
    });

    return {
      type: 'action',
      nodeId: node.id,
      actionType,
      parameters,
      executed: true,
      timestamp: new Date().toISOString()
    };
  }

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
}

module.exports = FlowOrchestrator;
