const BaseConnector = require('../BaseConnector');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs').promises;

/**
 * Display Manager Connector
 * 
 * Manages multiple displays in a command center environment with drag-and-drop
 * interface for creating views and templates. Each screen has a unique URL
 * updated via WebSocket for real-time content management.
 */
class DisplayManagerConnector extends BaseConnector {
  constructor(config) {
    // Ensure type is set for BaseConnector
    const connectorConfig = {
      ...config,
      type: 'display-manager'
    };
    
    super(connectorConfig);
    
    // Display management properties
    this.displays = new Map();
    this.views = new Map();
    this.templates = new Map();
    this.zones = new Map();
    
    // WebSocket management
    this.websocketServer = null;
    this.websocketConnections = new Map();
    
    // Display configuration
    this.displayConfig = {
      port: config.displayConfig?.port ?? 3001,
      host: config.displayConfig?.host ?? 'localhost',
      baseUrl: config.displayConfig?.baseUrl ?? 'http://localhost:3001',
      refreshInterval: config.displayConfig?.refreshInterval ?? 1000,
      blackoutMode: false,
      privacyMode: false
    };
    
    // Zone management
    this.zoneConfig = {
      enabled: config.zoneConfig?.enabled ?? true,
      defaultZone: config.zoneConfig?.defaultZone ?? 'main',
      zones: config.zoneConfig?.zones ?? ['main', 'secondary', 'emergency']
    };
    
    // Template system
    this.templateConfig = {
      defaultTemplates: config.templateConfig?.defaultTemplates ?? true,
      templatePath: config.templateConfig?.templatePath ?? './templates/display',
      customTemplates: new Map()
    };
    
    // Alarm integration
    this.alarmIntegration = {
      enabled: config.alarmIntegration?.enabled ?? true,
      alarmManagerId: config.alarmIntegration?.alarmManagerId ?? 'alarm-manager',
      priorityLevels: ['low', 'medium', 'high', 'critical']
    };
    
    // Performance tracking
    this.displayMetrics = {
      activeDisplays: 0,
      totalViews: 0,
      websocketConnections: 0,
      lastUpdateTime: null,
      blackoutEvents: 0
    };

    this.webInterface = {
      enabled: true,
      route: '/display',
      port: this.displayConfig.port || 3001,
      host: this.displayConfig.host || 'localhost'
    };
    this.config.webInterface = this.webInterface;

    this.logger.info('Display Manager Connector initialized', {
      id: this.id,
      displayConfig: this.displayConfig,
      zoneConfig: this.zoneConfig
    });
  }

  /**
   * Get capability definitions for this connector
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'display:management',
        name: 'Display Management',
        description: 'Manage individual displays and their content',
        category: 'display',
        operations: ['create', 'update', 'delete', 'activate', 'deactivate', 'blackout'],
        dataTypes: ['display', 'screen', 'content'],
        events: ['display:created', 'display:updated', 'display:deleted', 'display:activated'],
        parameters: {
          displayId: { type: 'string', required: true },
          content: { type: 'object', required: false },
          zone: { type: 'string', required: false }
        }
      },
      {
        id: 'display:views',
        name: 'View Management',
        description: 'Create and manage views that can be applied to groups of screens',
        category: 'display',
        operations: ['create', 'update', 'delete', 'apply', 'preview'],
        dataTypes: ['view', 'layout', 'composition'],
        events: ['view:created', 'view:updated', 'view:applied', 'view:deleted'],
        parameters: {
          viewId: { type: 'string', required: true },
          layout: { type: 'object', required: true },
          screens: { type: 'array', required: false }
        }
      },
      {
        id: 'display:templates',
        name: 'Template Management',
        description: 'Manage templates that can be applied to individual screens or views',
        category: 'display',
        operations: ['create', 'update', 'delete', 'apply', 'preview'],
        dataTypes: ['template', 'component', 'widget'],
        events: ['template:created', 'template:updated', 'template:applied'],
        parameters: {
          templateId: { type: 'string', required: true },
          content: { type: 'object', required: true },
          type: { type: 'string', required: true }
        }
      },
      {
        id: 'display:zones',
        name: 'Zone Management',
        description: 'Manage display zones for grouping and organization',
        category: 'display',
        operations: ['create', 'update', 'delete', 'assign', 'unassign'],
        dataTypes: ['zone', 'group', 'area'],
        events: ['zone:created', 'zone:updated', 'zone:assigned'],
        parameters: {
          zoneId: { type: 'string', required: true },
          displays: { type: 'array', required: false },
          settings: { type: 'object', required: false }
        }
      },
      {
        id: 'display:realtime',
        name: 'Real-Time Updates',
        description: 'Provide real-time updates to displays via WebSocket',
        category: 'display',
        operations: ['subscribe', 'unsubscribe', 'broadcast', 'update'],
        dataTypes: ['update', 'content', 'notification'],
        events: ['display:updated', 'content:changed', 'notification:sent'],
        parameters: {
          displayId: { type: 'string', required: true },
          content: { type: 'object', required: true },
          priority: { type: 'string', required: false }
        }
      },
      {
        id: 'display:alarms',
        name: 'Alarm Integration',
        description: 'Integrate with alarm manager for emergency displays',
        category: 'integration',
        operations: ['trigger', 'clear', 'escalate', 'blackout'],
        dataTypes: ['alarm', 'alert', 'emergency'],
        events: ['alarm:triggered', 'alarm:cleared', 'blackout:activated'],
        parameters: {
          alarmId: { type: 'string', required: true },
          priority: { type: 'string', required: true },
          displays: { type: 'array', required: false }
        }
      },
      {
        id: 'display:privacy',
        name: 'Privacy Controls',
        description: 'Manage privacy and blackout modes for displays',
        category: 'security',
        operations: ['enable', 'disable', 'schedule', 'override'],
        dataTypes: ['privacy', 'blackout', 'schedule'],
        events: ['privacy:enabled', 'blackout:activated', 'privacy:disabled'],
        parameters: {
          mode: { type: 'string', required: true },
          displays: { type: 'array', required: false },
          duration: { type: 'number', required: false }
        }
      }
    ];
  }

  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'display:management':
        return await this.executeDisplayManagement(operation, parameters);
      case 'display:views':
        return await this.executeDisplayViews(operation, parameters);
      case 'display:templates':
        return await this.executeDisplayTemplates(operation, parameters);
      case 'display:zones':
        return await this.executeDisplayZones(operation, parameters);
      case 'display:realtime':
        return await this.executeDisplayRealtime(operation, parameters);
      case 'display:alarms':
        return await this.executeDisplayAlarms(operation, parameters);
      case 'display:privacy':
        return await this.executeDisplayPrivacy(operation, parameters);
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }

  /**
   * Execute display management operations
   */
  async executeDisplayManagement(operation, parameters) {
    switch (operation) {
      case 'create':
        return await this.createDisplay(parameters);
      case 'update':
        return await this.updateDisplay(parameters);
      case 'delete':
        return await this.deleteDisplay(parameters);
      case 'activate':
        return await this.activateDisplay(parameters);
      case 'deactivate':
        return await this.deactivateDisplay(parameters);
      case 'blackout':
        return await this.blackoutDisplay(parameters);
      default:
        throw new Error(`Unknown display management operation: ${operation}`);
    }
  }

  /**
   * Execute display views operations
   */
  async executeDisplayViews(operation, parameters) {
    switch (operation) {
      case 'create':
        return await this.createView(parameters);
      case 'update':
        return await this.updateView(parameters);
      case 'delete':
        return await this.deleteView(parameters);
      case 'apply':
        return await this.applyView(parameters);
      case 'preview':
        return await this.previewView(parameters);
      default:
        throw new Error(`Unknown display views operation: ${operation}`);
    }
  }

  /**
   * Execute display templates operations
   */
  async executeDisplayTemplates(operation, parameters) {
    switch (operation) {
      case 'create':
        return await this.createTemplate(parameters);
      case 'update':
        return await this.updateTemplate(parameters);
      case 'delete':
        return await this.deleteTemplate(parameters);
      case 'apply':
        return await this.applyTemplate(parameters);
      case 'preview':
        return await this.previewTemplate(parameters);
      default:
        throw new Error(`Unknown display templates operation: ${operation}`);
    }
  }

  /**
   * Execute display zones operations
   */
  async executeDisplayZones(operation, parameters) {
    switch (operation) {
      case 'create':
        return await this.createZone(parameters);
      case 'update':
        return await this.updateZone(parameters);
      case 'delete':
        return await this.deleteZone(parameters);
      case 'assign':
        return await this.assignToZone(parameters);
      case 'unassign':
        return await this.unassignFromZone(parameters);
      default:
        throw new Error(`Unknown display zones operation: ${operation}`);
    }
  }

  /**
   * Execute display real-time operations
   */
  async executeDisplayRealtime(operation, parameters) {
    switch (operation) {
      case 'subscribe':
        return await this.subscribeToDisplay(parameters);
      case 'unsubscribe':
        return await this.unsubscribeFromDisplay(parameters);
      case 'broadcast':
        return await this.broadcastToDisplays(parameters);
      case 'update':
        return await this.updateDisplayContent(parameters);
      default:
        throw new Error(`Unknown display real-time operation: ${operation}`);
    }
  }

  /**
   * Execute display alarms operations
   */
  async executeDisplayAlarms(operation, parameters) {
    switch (operation) {
      case 'trigger':
        return await this.triggerAlarmDisplay(parameters);
      case 'clear':
        return await this.clearAlarmDisplay(parameters);
      case 'escalate':
        return await this.escalateAlarmDisplay(parameters);
      case 'blackout':
        return await this.blackoutForAlarm(parameters);
      default:
        throw new Error(`Unknown display alarms operation: ${operation}`);
    }
  }

  /**
   * Execute display privacy operations
   */
  async executeDisplayPrivacy(operation, parameters) {
    switch (operation) {
      case 'enable':
        return await this.enablePrivacyMode(parameters);
      case 'disable':
        return await this.disablePrivacyMode(parameters);
      case 'schedule':
        return await this.schedulePrivacyMode(parameters);
      case 'override':
        return await this.overridePrivacyMode(parameters);
      default:
        throw new Error(`Unknown display privacy operation: ${operation}`);
    }
  }

  /**
   * Create a new display
   */
  async createDisplay(parameters) {
    const { displayId, name, zone, template, settings } = parameters;
    
    if (!displayId) {
      throw new Error('Display ID is required');
    }
    
    if (this.displays.has(displayId)) {
      throw new Error(`Display ${displayId} already exists`);
    }
    
    const display = {
      id: displayId,
      name: name || displayId,
      zone: zone || this.zoneConfig.defaultZone,
      template: template || 'default',
      settings: settings || {},
      url: `${this.displayConfig.baseUrl}/display/${displayId}`,
      status: 'inactive',
      content: null,
      lastUpdate: null,
      createdAt: new Date().toISOString()
    };
    
    this.displays.set(displayId, display);
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('display:created', {
        source: this.id,
        data: display,
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`Display created: ${displayId}`, { display });
    return display;
  }

  /**
   * Update display configuration
   */
  async updateDisplay(parameters) {
    const { displayId, updates } = parameters;
    
    if (!displayId) {
      throw new Error('Display ID is required');
    }
    
    const display = this.displays.get(displayId);
    if (!display) {
      throw new Error(`Display ${displayId} not found`);
    }
    
    // Update display properties
    Object.assign(display, updates);
    display.lastUpdate = new Date().toISOString();
    
    // Update URL if display ID changed
    if (updates.id && updates.id !== displayId) {
      display.url = `${this.displayConfig.baseUrl}/display/${updates.id}`;
    }
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('display:updated', {
        source: this.id,
        data: display,
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`Display updated: ${displayId}`, { updates });
    return display;
  }

  /**
   * Delete a display
   */
  async deleteDisplay(parameters) {
    const { displayId } = parameters;
    
    if (!displayId) {
      throw new Error('Display ID is required');
    }
    
    const display = this.displays.get(displayId);
    if (!display) {
      throw new Error(`Display ${displayId} not found`);
    }
    
    // Remove from zones
    if (display.zone) {
      const zone = this.zones.get(display.zone);
      if (zone) {
        zone.displays = zone.displays.filter(id => id !== displayId);
      }
    }
    
    // Close WebSocket connections
    const connections = this.websocketConnections.get(displayId);
    if (connections) {
      connections.forEach(ws => ws.close());
      this.websocketConnections.delete(displayId);
    }
    
    this.displays.delete(displayId);
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('display:deleted', {
        source: this.id,
        data: { displayId },
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`Display deleted: ${displayId}`);
    return { success: true, displayId };
  }

  /**
   * Activate a display
   */
  async activateDisplay(parameters) {
    const { displayId } = parameters;
    
    if (!displayId) {
      throw new Error('Display ID is required');
    }
    
    const display = this.displays.get(displayId);
    if (!display) {
      throw new Error(`Display ${displayId} not found`);
    }
    
    display.status = 'active';
    display.lastUpdate = new Date().toISOString();
    
    // Send activation message via WebSocket
    await this.sendToDisplay(displayId, {
      type: 'display:activated',
      data: display
    });
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('display:activated', {
        source: this.id,
        data: display,
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`Display activated: ${displayId}`);
    return display;
  }

  /**
   * Deactivate a display
   */
  async deactivateDisplay(parameters) {
    const { displayId } = parameters;
    
    if (!displayId) {
      throw new Error('Display ID is required');
    }
    
    const display = this.displays.get(displayId);
    if (!display) {
      throw new Error(`Display ${displayId} not found`);
    }
    
    display.status = 'inactive';
    display.lastUpdate = new Date().toISOString();
    
    // Send deactivation message via WebSocket
    await this.sendToDisplay(displayId, {
      type: 'display:deactivated',
      data: display
    });
    
    this.logger.info(`Display deactivated: ${displayId}`);
    return display;
  }

  /**
   * Blackout a display
   */
  async blackoutDisplay(parameters) {
    const { displayId, reason } = parameters;
    
    if (!displayId) {
      throw new Error('Display ID is required');
    }
    
    const display = this.displays.get(displayId);
    if (!display) {
      throw new Error(`Display ${displayId} not found`);
    }
    
    display.status = 'blackout';
    display.lastUpdate = new Date().toISOString();
    
    // Send blackout message via WebSocket
    await this.sendToDisplay(displayId, {
      type: 'display:blackout',
      data: { reason: reason || 'Manual blackout' }
    });
    
    this.displayMetrics.blackoutEvents++;
    
    this.logger.info(`Display blackout: ${displayId}`, { reason });
    return display;
  }

  /**
   * Create a new view
   */
  async createView(parameters) {
    const { viewId, name, layout, screens, settings } = parameters;
    
    if (!viewId) {
      throw new Error('View ID is required');
    }
    
    if (this.views.has(viewId)) {
      throw new Error(`View ${viewId} already exists`);
    }
    
    const view = {
      id: viewId,
      name: name || viewId,
      layout: layout || {},
      screens: screens || [],
      settings: settings || {},
      status: 'inactive',
      createdAt: new Date().toISOString()
    };
    
    this.views.set(viewId, view);
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('view:created', {
        source: this.id,
        data: view,
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`View created: ${viewId}`, { view });
    return view;
  }

  /**
   * Apply a view to displays
   */
  async applyView(parameters) {
    const { viewId, displayIds } = parameters;
    
    if (!viewId) {
      throw new Error('View ID is required');
    }
    
    const view = this.views.get(viewId);
    if (!view) {
      throw new Error(`View ${viewId} not found`);
    }
    
    const targetDisplays = displayIds || view.screens;
    const results = [];
    
    for (const displayId of targetDisplays) {
      const display = this.displays.get(displayId);
      if (display) {
        // Apply view layout to display
        display.content = {
          type: 'view',
          viewId: viewId,
          layout: view.layout,
          settings: view.settings
        };
        
        display.lastUpdate = new Date().toISOString();
        
        // Send update via WebSocket
        await this.sendToDisplay(displayId, {
          type: 'content:updated',
          data: display.content
        });
        
        results.push({ displayId, success: true });
      } else {
        results.push({ displayId, success: false, error: 'Display not found' });
      }
    }
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('view:applied', {
        source: this.id,
        data: { viewId, results },
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`View applied: ${viewId}`, { results });
    return { viewId, results };
  }

  /**
   * Create a new template
   */
  async createTemplate(parameters) {
    const { templateId, name, content, type, settings } = parameters;
    
    if (!templateId) {
      throw new Error('Template ID is required');
    }
    
    if (this.templates.has(templateId)) {
      throw new Error(`Template ${templateId} already exists`);
    }
    
    const template = {
      id: templateId,
      name: name || templateId,
      content: content || {},
      type: type || 'default',
      settings: settings || {},
      createdAt: new Date().toISOString()
    };
    
    this.templates.set(templateId, template);
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('template:created', {
        source: this.id,
        data: template,
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`Template created: ${templateId}`, { template });
    return template;
  }

  /**
   * Apply a template to displays
   */
  async applyTemplate(parameters) {
    const { templateId, displayIds } = parameters;
    
    if (!templateId) {
      throw new Error('Template ID is required');
    }
    
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    const targetDisplays = displayIds || [];
    const results = [];
    
    for (const displayId of targetDisplays) {
      const display = this.displays.get(displayId);
      if (display) {
        // Apply template content to display
        display.content = {
          type: 'template',
          templateId: templateId,
          content: template.content,
          settings: template.settings
        };
        
        display.lastUpdate = new Date().toISOString();
        
        // Send update via WebSocket
        await this.sendToDisplay(displayId, {
          type: 'content:updated',
          data: display.content
        });
        
        results.push({ displayId, success: true });
      } else {
        results.push({ displayId, success: false, error: 'Display not found' });
      }
    }
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('template:applied', {
        source: this.id,
        data: { templateId, results },
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`Template applied: ${templateId}`, { results });
    return { templateId, results };
  }

  /**
   * Create a new zone
   */
  async createZone(parameters) {
    const { zoneId, name, displays, settings } = parameters;
    
    if (!zoneId) {
      throw new Error('Zone ID is required');
    }
    
    if (this.zones.has(zoneId)) {
      throw new Error(`Zone ${zoneId} already exists`);
    }
    
    const zone = {
      id: zoneId,
      name: name || zoneId,
      displays: displays || [],
      settings: settings || {},
      createdAt: new Date().toISOString()
    };
    
    this.zones.set(zoneId, zone);
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('zone:created', {
        source: this.id,
        data: zone,
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`Zone created: ${zoneId}`, { zone });
    return zone;
  }

  /**
   * Assign display to zone
   */
  async assignToZone(parameters) {
    const { displayId, zoneId } = parameters;
    
    if (!displayId) {
      throw new Error('Display ID is required');
    }
    
    if (!zoneId) {
      throw new Error('Zone ID is required');
    }
    
    const display = this.displays.get(displayId);
    if (!display) {
      throw new Error(`Display ${displayId} not found`);
    }
    
    const zone = this.zones.get(zoneId);
    if (!zone) {
      throw new Error(`Zone ${zoneId} not found`);
    }
    
    // Remove from previous zone
    if (display.zone && display.zone !== zoneId) {
      const oldZone = this.zones.get(display.zone);
      if (oldZone) {
        oldZone.displays = oldZone.displays.filter(id => id !== displayId);
      }
    }
    
    // Add to new zone
    display.zone = zoneId;
    if (!zone.displays.includes(displayId)) {
      zone.displays.push(displayId);
    }
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('zone:assigned', {
        source: this.id,
        data: { displayId, zoneId },
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`Display assigned to zone: ${displayId} -> ${zoneId}`);
    return { displayId, zoneId };
  }

  /**
   * Subscribe to display updates
   */
  async subscribeToDisplay(parameters) {
    const { displayId, callback } = parameters;
    
    if (!displayId) {
      throw new Error('Display ID is required');
    }
    
    // This would typically be handled by WebSocket connection
    // For now, we'll just log the subscription
    this.logger.info(`Subscription requested for display: ${displayId}`);
    
    return { displayId, subscribed: true };
  }

  /**
   * Send message to display via WebSocket
   */
  async sendToDisplay(displayId, message) {
    const connections = this.websocketConnections.get(displayId);
    if (connections && connections.length > 0) {
      const messageStr = JSON.stringify(message);
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
      return true;
    }
    return false;
  }

  /**
   * Broadcast to multiple displays
   */
  async broadcastToDisplays(parameters) {
    const { displayIds, message } = parameters;
    
    if (!displayIds || !Array.isArray(displayIds)) {
      throw new Error('Display IDs array is required');
    }
    
    if (!message) {
      throw new Error('Message is required');
    }
    
    const results = [];
    
    for (const displayId of displayIds) {
      const success = await this.sendToDisplay(displayId, message);
      results.push({ displayId, success });
    }
    
    this.logger.info(`Broadcast completed`, { results });
    return { results };
  }

  /**
   * Update display content
   */
  async updateDisplayContent(parameters) {
    const { displayId, content } = parameters;
    
    if (!displayId) {
      throw new Error('Display ID is required');
    }
    
    const display = this.displays.get(displayId);
    if (!display) {
      throw new Error(`Display ${displayId} not found`);
    }
    
    display.content = content;
    display.lastUpdate = new Date().toISOString();
    
    // Send update via WebSocket
    await this.sendToDisplay(displayId, {
      type: 'content:updated',
      data: content
    });
    
    this.logger.info(`Display content updated: ${displayId}`);
    return display;
  }

  /**
   * Trigger alarm display
   */
  async triggerAlarmDisplay(parameters) {
    const { alarmId, priority, displays, message } = parameters;
    
    if (!alarmId) {
      throw new Error('Alarm ID is required');
    }
    
    if (!priority || !this.alarmIntegration.priorityLevels.includes(priority)) {
      throw new Error(`Priority must be one of: ${this.alarmIntegration.priorityLevels.join(', ')}`);
    }
    
    const targetDisplays = displays || Array.from(this.displays.keys());
    const results = [];
    
    for (const displayId of targetDisplays) {
      const display = this.displays.get(displayId);
      if (display) {
        // Send alarm message via WebSocket
        await this.sendToDisplay(displayId, {
          type: 'alarm:triggered',
          data: {
            alarmId,
            priority,
            message: message || `Alarm ${alarmId} triggered`,
            timestamp: new Date().toISOString()
          }
        });
        
        results.push({ displayId, success: true });
      } else {
        results.push({ displayId, success: false, error: 'Display not found' });
      }
    }
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('alarm:triggered', {
        source: this.id,
        data: { alarmId, priority, results },
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`Alarm triggered: ${alarmId}`, { priority, results });
    return { alarmId, priority, results };
  }

  /**
   * Enable privacy mode
   */
  async enablePrivacyMode(parameters) {
    const { displays, duration } = parameters;
    
    this.displayConfig.privacyMode = true;
    
    const targetDisplays = displays || Array.from(this.displays.keys());
    const results = [];
    
    for (const displayId of targetDisplays) {
      const display = this.displays.get(displayId);
      if (display) {
        // Send privacy mode message via WebSocket
        await this.sendToDisplay(displayId, {
          type: 'privacy:enabled',
          data: { duration }
        });
        
        results.push({ displayId, success: true });
      } else {
        results.push({ displayId, success: false, error: 'Display not found' });
      }
    }
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('privacy:enabled', {
        source: this.id,
        data: { results, duration },
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`Privacy mode enabled`, { results, duration });
    return { results, duration };
  }

  /**
   * Disable privacy mode
   */
  async disablePrivacyMode(parameters) {
    const { displays } = parameters;
    
    this.displayConfig.privacyMode = false;
    
    const targetDisplays = displays || Array.from(this.displays.keys());
    const results = [];
    
    for (const displayId of targetDisplays) {
      const display = this.displays.get(displayId);
      if (display) {
        // Send privacy mode disabled message via WebSocket
        await this.sendToDisplay(displayId, {
          type: 'privacy:disabled',
          data: {}
        });
        
        results.push({ displayId, success: true });
      } else {
        results.push({ displayId, success: false, error: 'Display not found' });
      }
    }
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publishEvent('privacy:disabled', {
        source: this.id,
        data: { results },
        timestamp: Date.now()
      });
    }
    
    this.logger.info(`Privacy mode disabled`, { results });
    return { results };
  }

  /**
   * Connect to the service
   */
  async performConnect() {
    try {
      // Initialize WebSocket server
      this.websocketServer = new WebSocket.Server({
        port: this.displayConfig.port,
        host: this.displayConfig.host
      });
      
      this.websocketServer.on('connection', (ws, req) => {
        this.handleWebSocketConnection(ws, req);
      });
      
      this.websocketServer.on('error', (error) => {
        this.logger.error('WebSocket server error:', error);
      });
      
      // Load default templates if enabled
      if (this.templateConfig.defaultTemplates) {
        await this.loadDefaultTemplates();
      }
      
      // Initialize default zones
      await this.initializeDefaultZones();
      
      this.logger.info(`Display Manager connected on ${this.displayConfig.host}:${this.displayConfig.port}`);
    } catch (error) {
      this.logger.error('Failed to connect Display Manager:', error);
      throw error;
    }
  }

  /**
   * Handle WebSocket connection
   */
  handleWebSocketConnection(ws, req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(part => part);
    
    // Check if this is a GUI connection or display connection
    if (pathParts[1] === 'manager') {
      this.handleGUIConnection(ws, req);
    } else {
      this.handleDisplayConnection(ws, req);
    }
  }

  /**
   * Handle GUI WebSocket connection
   */
  handleGUIConnection(ws, req) {
    // Store GUI connection
    if (!this.guiConnections) {
      this.guiConnections = [];
    }
    this.guiConnections.push(ws);
    
    // Send initial data
    ws.send(JSON.stringify({
      type: 'displays:list',
      data: Array.from(this.displays.values())
    }));
    
    ws.send(JSON.stringify({
      type: 'templates:list',
      data: Array.from(this.templates.values())
    }));
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        this.handleGUIMessage(data);
      } catch (error) {
        this.logger.error('GUI WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      // Remove GUI connection
      const index = this.guiConnections.indexOf(ws);
      if (index > -1) {
        this.guiConnections.splice(index, 1);
      }
    });
    
    this.logger.info('GUI WebSocket connected');
  }

  /**
   * Handle display WebSocket connection
   */
  handleDisplayConnection(ws, req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const displayId = url.pathname.split('/').pop();
    
    if (!displayId) {
      ws.close(1008, 'Display ID required');
      return;
    }
    
    // Store connection
    if (!this.websocketConnections.has(displayId)) {
      this.websocketConnections.set(displayId, []);
    }
    this.websocketConnections.get(displayId).push(ws);
    
    this.displayMetrics.websocketConnections++;
    
    // Send initial display info
    const display = this.displays.get(displayId);
    if (display) {
      ws.send(JSON.stringify({
        type: 'display:info',
        data: display
      }));
    }
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        this.handleDisplayMessage(displayId, data);
      } catch (error) {
        this.logger.error('Display WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      // Remove connection
      const connections = this.websocketConnections.get(displayId);
      if (connections) {
        const index = connections.indexOf(ws);
        if (index > -1) {
          connections.splice(index, 1);
        }
        if (connections.length === 0) {
          this.websocketConnections.delete(displayId);
        }
      }
      
      this.displayMetrics.websocketConnections--;
    });
    
    this.logger.info(`Display WebSocket connected: ${displayId}`);
  }

  /**
   * Handle GUI WebSocket message
   */
  handleGUIMessage(message) {
    switch (message.type) {
      case 'displays:get':
        this.sendToGUI({
          type: 'displays:list',
          data: Array.from(this.displays.values())
        });
        break;
        
      case 'templates:get':
        this.sendToGUI({
          type: 'templates:list',
          data: Array.from(this.templates.values())
        });
        break;
        
      case 'view:save':
        this.saveViewFromGUI(message.data);
        break;
        
      case 'view:apply':
        this.applyViewFromGUI(message.data);
        break;
        
      default:
        this.logger.debug(`Unknown GUI message type: ${message.type}`);
    }
  }

  /**
   * Handle display WebSocket message
   */
  handleDisplayMessage(displayId, message) {
    // Handle display-specific messages
    switch (message.type) {
      case 'display:ready':
        this.logger.info(`Display ready: ${displayId}`);
        break;
      case 'display:error':
        this.logger.error(`Display error: ${displayId}`, message.data);
        break;
      default:
        this.logger.debug(`Unknown display message type: ${message.type}`);
    }
  }

  /**
   * Send message to GUI
   */
  sendToGUI(message) {
    if (this.guiConnections) {
      const messageStr = JSON.stringify(message);
      this.guiConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  }

  /**
   * Save view from GUI
   */
  async saveViewFromGUI(viewData) {
    try {
      const viewId = `view_${Date.now()}`;
      const view = {
        id: viewId,
        name: viewData.name,
        description: viewData.description,
        layout: viewData.layout,
        screens: [],
        status: 'inactive',
        createdAt: new Date().toISOString()
      };
      
      this.views.set(viewId, view);
      
      // Publish event
      if (this.eventBus) {
        this.eventBus.publishEvent('view:created', {
          source: this.id,
          data: view,
          timestamp: Date.now()
        });
      }
      
      this.sendToGUI({
        type: 'view:saved',
        data: { viewId, success: true }
      });
      
      this.logger.info(`View saved from GUI: ${viewId}`);
    } catch (error) {
      this.logger.error('Error saving view from GUI:', error);
      this.sendToGUI({
        type: 'view:saved',
        data: { success: false, error: error.message }
      });
    }
  }

  /**
   * Apply view from GUI
   */
  async applyViewFromGUI(viewData) {
    try {
      const results = [];
      
      for (const displayId of viewData.displays) {
        const display = this.displays.get(displayId);
        if (display) {
          // Apply view layout to display
          display.content = {
            type: 'view',
            layout: viewData.layout,
            components: viewData.layout.components
          };
          
          display.lastUpdate = new Date().toISOString();
          
          // Send update via WebSocket
          await this.sendToDisplay(displayId, {
            type: 'content:updated',
            data: display.content
          });
          
          results.push({ displayId, success: true });
        } else {
          results.push({ displayId, success: false, error: 'Display not found' });
        }
      }
      
      this.sendToGUI({
        type: 'view:applied',
        data: { results }
      });
      
      this.logger.info(`View applied from GUI`, { results });
    } catch (error) {
      this.logger.error('Error applying view from GUI:', error);
      this.sendToGUI({
        type: 'view:applied',
        data: { success: false, error: error.message }
      });
    }
  }

  /**
   * Load default templates
   */
  async loadDefaultTemplates() {
    try {
      const defaultTemplates = [
        {
          id: 'default',
          name: 'Default Template',
          content: { type: 'blank' },
          type: 'default'
        },
        {
          id: 'dashboard',
          name: 'Dashboard Template',
          content: { type: 'dashboard', layout: 'grid' },
          type: 'dashboard'
        },
        {
          id: 'emergency',
          name: 'Emergency Template',
          content: { type: 'emergency', layout: 'fullscreen' },
          type: 'emergency'
        }
      ];
      
      for (const template of defaultTemplates) {
        this.templates.set(template.id, {
          ...template,
          createdAt: new Date().toISOString()
        });
      }
      
      this.logger.info('Default templates loaded');
    } catch (error) {
      this.logger.error('Failed to load default templates:', error);
    }
  }

  /**
   * Initialize default zones
   */
  async initializeDefaultZones() {
    for (const zoneId of this.zoneConfig.zones) {
      if (!this.zones.has(zoneId)) {
        this.zones.set(zoneId, {
          id: zoneId,
          name: zoneId.charAt(0).toUpperCase() + zoneId.slice(1),
          displays: [],
          settings: {},
          createdAt: new Date().toISOString()
        });
      }
    }
    
    this.logger.info('Default zones initialized');
  }

  /**
   * Disconnect from the service
   */
  async performDisconnect() {
    try {
      // Close WebSocket server
      if (this.websocketServer) {
        this.websocketServer.close();
        this.websocketServer = null;
      }
      
      // Close all WebSocket connections
      for (const [displayId, connections] of this.websocketConnections) {
        connections.forEach(ws => ws.close());
      }
      this.websocketConnections.clear();
      
      this.logger.info('Display Manager disconnected');
    } catch (error) {
      this.logger.error('Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Get display manager status
   */
  getDisplayManagerStatus() {
    return {
      id: this.id,
      type: this.type,
      displays: {
        total: this.displays.size,
        active: Array.from(this.displays.values()).filter(d => d.status === 'active').length,
        inactive: Array.from(this.displays.values()).filter(d => d.status === 'inactive').length,
        blackout: Array.from(this.displays.values()).filter(d => d.status === 'blackout').length
      },
      views: {
        total: this.views.size
      },
      templates: {
        total: this.templates.size
      },
      zones: {
        total: this.zones.size
      },
      websockets: {
        connections: this.displayMetrics.websocketConnections
      },
      config: {
        privacyMode: this.displayConfig.privacyMode,
        blackoutMode: this.displayConfig.blackoutMode
      },
      metrics: this.displayMetrics
    };
  }

  /**
   * Get connector status
   */
  getStatus() {
    const baseStatus = super.getStatus();
    return {
      ...baseStatus,
      displayManager: this.getDisplayManagerStatus()
    };
  }

  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      type: 'display-manager',
      version: '1.0.0',
      description: 'Interactive display manager for command center environments',
      author: 'Looking Glass Platform',
      capabilities: [
        'display:management',
        'display:views',
        'display:templates',
        'display:zones',
        'display:realtime',
        'display:alarms',
        'display:privacy'
      ]
    };
  }
}

module.exports = DisplayManagerConnector; 