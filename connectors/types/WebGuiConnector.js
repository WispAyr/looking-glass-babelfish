const BaseConnector = require('../BaseConnector');

/**
 * Web GUI Connector
 * 
 * Provides web-based graphical user interface capabilities for the Looking Glass platform.
 * Serves as the primary interface connector that automatically integrates with maps and
 * other connectors to provide a unified user experience.
 */
class WebGuiConnector extends BaseConnector {
  constructor(config) {
    // Ensure type is set for BaseConnector
    const connectorConfig = {
      ...config,
      type: 'web-gui'
    };
    
    super(connectorConfig);
    
    // Web GUI specific properties
    this.webInterface = {
      enabled: config.webInterface?.enabled ?? true,
      port: config.webInterface?.port ?? 3000,
      host: config.webInterface?.host ?? 'localhost',
      routes: new Map(),
      staticFiles: new Map(),
      templates: new Map()
    };

    // GUI components and pages
    this.pages = new Map();
    this.components = new Map();
    this.navigation = new Map();
    
    // Auto-registration settings
    this.autoRegisterWithMaps = config.autoRegisterWithMaps ?? true;
    this.autoDiscoverConnectors = config.autoDiscoverConnectors ?? true;
    
    // UI state management
    this.uiState = {
      currentPage: 'dashboard',
      userPreferences: {},
      theme: config.theme || 'dark',
      layout: config.layout || 'default'
    };

    // Real-time UI updates
    this.uiUpdates = new Map();
    this.broadcastQueue = [];
    
    // Performance tracking
    this.uiMetrics = {
      pageViews: 0,
      componentRenders: 0,
      realTimeUpdates: 0,
      lastUpdateTime: null
    };

    this.logger.info('Web GUI Connector initialized', {
      id: this.id,
      webInterface: this.webInterface,
      autoRegisterWithMaps: this.autoRegisterWithMaps
    });
  }

  /**
   * Get capability definitions for this connector
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'gui:pages',
        name: 'GUI Pages Management',
        description: 'Manage web pages and navigation',
        category: 'gui',
        operations: ['create', 'update', 'delete', 'navigate', 'render'],
        dataTypes: ['page', 'component', 'template', 'route'],
        events: ['page:created', 'page:updated', 'page:deleted', 'navigation:changed'],
        parameters: {
          pageId: { type: 'string', required: true },
          template: { type: 'string', required: false },
          data: { type: 'object', required: false }
        }
      },
      {
        id: 'gui:components',
        name: 'GUI Components',
        description: 'Manage reusable UI components',
        category: 'gui',
        operations: ['create', 'update', 'delete', 'render', 'update'],
        dataTypes: ['component', 'widget', 'chart', 'form'],
        events: ['component:created', 'component:updated', 'component:rendered'],
        parameters: {
          componentId: { type: 'string', required: true },
          type: { type: 'string', required: true },
          data: { type: 'object', required: false }
        }
      },
      {
        id: 'gui:realtime',
        name: 'Real-Time UI Updates',
        description: 'Provide real-time updates to the web interface',
        category: 'gui',
        operations: ['subscribe', 'unsubscribe', 'broadcast', 'update'],
        dataTypes: ['update', 'notification', 'alert', 'status'],
        events: ['ui:updated', 'notification:sent', 'alert:triggered'],
        parameters: {
          target: { type: 'string', required: true },
          data: { type: 'object', required: true },
          priority: { type: 'string', required: false }
        }
      },
      {
        id: 'gui:integration',
        name: 'GUI Integration',
        description: 'Integrate with other connectors and maps',
        category: 'integration',
        operations: ['register', 'unregister', 'sync', 'link'],
        dataTypes: ['connector:ui', 'map:ui', 'dashboard:config'],
        events: ['connector:linked', 'map:linked', 'dashboard:updated'],
        parameters: {
          connectorId: { type: 'string', required: true },
          uiConfig: { type: 'object', required: false }
        }
      }
    ];
  }

  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    switch (capabilityId) {
      case 'gui:pages':
        return await this.executeGuiPages(operation, parameters);
      case 'gui:components':
        return await this.executeGuiComponents(operation, parameters);
      case 'gui:realtime':
        return await this.executeGuiRealtime(operation, parameters);
      case 'gui:integration':
        return await this.executeGuiIntegration(operation, parameters);
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }

  /**
   * Execute GUI pages operations
   */
  async executeGuiPages(operation, parameters) {
    switch (operation) {
      case 'create':
        return await this.createPage(parameters);
      case 'update':
        return await this.updatePage(parameters);
      case 'delete':
        return await this.deletePage(parameters);
      case 'navigate':
        return await this.navigateToPage(parameters);
      case 'render':
        return await this.renderPage(parameters);
      default:
        throw new Error(`Unknown GUI pages operation: ${operation}`);
    }
  }

  /**
   * Execute GUI components operations
   */
  async executeGuiComponents(operation, parameters) {
    switch (operation) {
      case 'create':
        return await this.createComponent(parameters);
      case 'update':
        return await this.updateComponent(parameters);
      case 'delete':
        return await this.deleteComponent(parameters);
      case 'render':
        return await this.renderComponent(parameters);
      default:
        throw new Error(`Unknown GUI components operation: ${operation}`);
    }
  }

  /**
   * Execute GUI real-time operations
   */
  async executeGuiRealtime(operation, parameters) {
    switch (operation) {
      case 'subscribe':
        return await this.subscribeToUpdates(parameters);
      case 'unsubscribe':
        return await this.unsubscribeFromUpdates(parameters);
      case 'broadcast':
        return await this.broadcastUpdate(parameters);
      case 'update':
        return await this.updateUI(parameters);
      default:
        throw new Error(`Unknown GUI real-time operation: ${operation}`);
    }
  }

  /**
   * Execute GUI integration operations
   */
  async executeGuiIntegration(operation, parameters) {
    switch (operation) {
      case 'register':
        return await this.registerWithConnector(parameters);
      case 'unregister':
        return await this.unregisterFromConnector(parameters);
      case 'sync':
        return await this.syncWithConnector(parameters);
      case 'link':
        return await this.linkToConnector(parameters);
      default:
        throw new Error(`Unknown GUI integration operation: ${operation}`);
    }
  }

  /**
   * Create a new GUI page
   */
  async createPage(parameters) {
    const { pageId, template, data, route } = parameters;
    
    const page = {
      id: pageId,
      template: template || 'default',
      data: data || {},
      route: route || `/${pageId}`,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    this.pages.set(pageId, page);
    this.navigation.set(route, pageId);

    this.logger.info(`Created GUI page: ${pageId}`);
    this.emit('page:created', page);

    return page;
  }

  /**
   * Update a GUI page
   */
  async updatePage(parameters) {
    const { pageId, updates } = parameters;
    
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    const updatedPage = {
      ...page,
      ...updates,
      updated: new Date().toISOString()
    };

    this.pages.set(pageId, updatedPage);
    
    if (updates.route && updates.route !== page.route) {
      this.navigation.delete(page.route);
      this.navigation.set(updates.route, pageId);
    }

    this.logger.info(`Updated GUI page: ${pageId}`);
    this.emit('page:updated', updatedPage);

    return updatedPage;
  }

  /**
   * Delete a GUI page
   */
  async deletePage(parameters) {
    const { pageId } = parameters;
    
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    this.pages.delete(pageId);
    this.navigation.delete(page.route);

    this.logger.info(`Deleted GUI page: ${pageId}`);
    this.emit('page:deleted', { pageId });

    return { success: true, pageId };
  }

  /**
   * Navigate to a page
   */
  async navigateToPage(parameters) {
    const { pageId, data } = parameters;
    
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    this.uiState.currentPage = pageId;
    if (data) {
      page.data = { ...page.data, ...data };
    }

    this.logger.debug(`Navigated to page: ${pageId}`);
    this.emit('navigation:changed', { pageId, data });

    return page;
  }

  /**
   * Render a page
   */
  async renderPage(parameters) {
    const { pageId, context } = parameters;
    
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    const template = this.templates.get(page.template);
    if (!template) {
      throw new Error(`Template not found: ${page.template}`);
    }

    const renderedPage = {
      ...page,
      rendered: new Date().toISOString(),
      context: context || {}
    };

    this.uiMetrics.pageViews++;
    this.emit('page:rendered', renderedPage);

    return renderedPage;
  }

  /**
   * Create a GUI component
   */
  async createComponent(parameters) {
    const { componentId, type, data, config } = parameters;
    
    const component = {
      id: componentId,
      type: type,
      data: data || {},
      config: config || {},
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    this.components.set(componentId, component);

    this.logger.info(`Created GUI component: ${componentId} (${type})`);
    this.emit('component:created', component);

    return component;
  }

  /**
   * Update a GUI component
   */
  async updateComponent(parameters) {
    const { componentId, updates } = parameters;
    
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component not found: ${componentId}`);
    }

    const updatedComponent = {
      ...component,
      ...updates,
      updated: new Date().toISOString()
    };

    this.components.set(componentId, updatedComponent);

    this.logger.info(`Updated GUI component: ${componentId}`);
    this.emit('component:updated', updatedComponent);

    return updatedComponent;
  }

  /**
   * Delete a GUI component
   */
  async deleteComponent(parameters) {
    const { componentId } = parameters;
    
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component not found: ${componentId}`);
    }

    this.components.delete(componentId);

    this.logger.info(`Deleted GUI component: ${componentId}`);
    this.emit('component:deleted', { componentId });

    return { success: true, componentId };
  }

  /**
   * Render a component
   */
  async renderComponent(parameters) {
    const { componentId, context } = parameters;
    
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component not found: ${componentId}`);
    }

    const renderedComponent = {
      ...component,
      rendered: new Date().toISOString(),
      context: context || {}
    };

    this.uiMetrics.componentRenders++;
    this.emit('component:rendered', renderedComponent);

    return renderedComponent;
  }

  /**
   * Subscribe to UI updates
   */
  async subscribeToUpdates(parameters) {
    const { target, callback } = parameters;
    
    if (!this.uiUpdates.has(target)) {
      this.uiUpdates.set(target, new Set());
    }
    
    this.uiUpdates.get(target).add(callback);

    this.logger.debug(`Subscribed to UI updates: ${target}`);
    return { success: true, target };
  }

  /**
   * Unsubscribe from UI updates
   */
  async unsubscribeFromUpdates(parameters) {
    const { target, callback } = parameters;
    
    const subscribers = this.uiUpdates.get(target);
    if (subscribers) {
      subscribers.delete(callback);
    }

    this.logger.debug(`Unsubscribed from UI updates: ${target}`);
    return { success: true, target };
  }

  /**
   * Broadcast UI update
   */
  async broadcastUpdate(parameters) {
    const { target, data, priority = 'normal' } = parameters;
    
    const update = {
      target,
      data,
      priority,
      timestamp: new Date().toISOString()
    };

    this.broadcastQueue.push(update);
    this.uiMetrics.realTimeUpdates++;
    this.uiMetrics.lastUpdateTime = new Date().toISOString();

    this.logger.debug(`Broadcasted UI update: ${target}`);
    this.emit('ui:updated', update);

    return update;
  }

  /**
   * Update UI
   */
  async updateUI(parameters) {
    const { target, data } = parameters;
    
    const subscribers = this.uiUpdates.get(target);
    if (subscribers) {
      for (const callback of subscribers) {
        try {
          await callback(data);
        } catch (error) {
          this.logger.error(`Error in UI update callback: ${error.message}`);
        }
      }
    }

    return { success: true, target, updated: subscribers ? subscribers.size : 0 };
  }

  /**
   * Register with a connector
   */
  async registerWithConnector(parameters) {
    const { connectorId, uiConfig } = parameters;
    
    // Create UI integration for the connector
    const integration = {
      connectorId,
      uiConfig: uiConfig || {},
      registered: new Date().toISOString(),
      status: 'active'
    };

    this.logger.info(`Registered with connector: ${connectorId}`);
    this.emit('connector:linked', integration);

    return integration;
  }

  /**
   * Unregister from a connector
   */
  async unregisterFromConnector(parameters) {
    const { connectorId } = parameters;
    
    this.logger.info(`Unregistered from connector: ${connectorId}`);
    this.emit('connector:unlinked', { connectorId });

    return { success: true, connectorId };
  }

  /**
   * Sync with a connector
   */
  async syncWithConnector(parameters) {
    const { connectorId, data } = parameters;
    
    // Sync connector data with UI
    const syncResult = {
      connectorId,
      data,
      synced: new Date().toISOString(),
      status: 'synced'
    };

    this.logger.debug(`Synced with connector: ${connectorId}`);
    this.emit('connector:synced', syncResult);

    return syncResult;
  }

  /**
   * Link to a connector
   */
  async linkToConnector(parameters) {
    const { connectorId, linkType, config } = parameters;
    
    const link = {
      connectorId,
      linkType,
      config: config || {},
      linked: new Date().toISOString(),
      status: 'active'
    };

    this.logger.info(`Linked to connector: ${connectorId} (${linkType})`);
    this.emit('connector:linked', link);

    return link;
  }

  /**
   * Get spatial context for map integration
   */
  async getSpatialContext() {
    return {
      type: 'web-gui',
      name: this.name,
      description: this.description,
      capabilities: this.getCapabilities(),
      ui: {
        pages: Array.from(this.pages.keys()),
        components: Array.from(this.components.keys()),
        currentPage: this.uiState.currentPage,
        theme: this.uiState.theme,
        layout: this.uiState.layout
      },
      routes: Array.from(this.navigation.keys()),
      metrics: this.uiMetrics
    };
  }

  /**
   * Auto-register with maps
   */
  async autoRegisterWithMaps(mapConnector) {
    if (!this.autoRegisterWithMaps) {
      return;
    }

    try {
      const spatialContext = await this.getSpatialContext();
      
      await mapConnector.execute('integration:connector', 'register', {
        connectorId: this.id,
        context: spatialContext,
        capabilities: this.getCapabilities()
      });

      this.logger.info(`Auto-registered with map: ${mapConnector.id}`);
    } catch (error) {
      this.logger.error(`Failed to auto-register with map: ${mapConnector.id}`, error);
    }
  }

  /**
   * Get web interface configuration
   */
  getWebInterfaceConfig() {
    return {
      ...this.webInterface,
      url: `http://${this.webInterface.host}:${this.webInterface.port}`,
      websocketUrl: `ws://${this.webInterface.host}:${this.webInterface.port}/ws/gui`,
      pages: Array.from(this.pages.keys()),
      components: Array.from(this.components.keys()),
      currentPage: this.uiState.currentPage,
      theme: this.uiState.theme,
      layout: this.uiState.layout
    };
  }

  /**
   * Get GUI status
   */
  getGuiStatus() {
    return {
      status: 'active',
      pages: this.pages.size,
      components: this.components.size,
      navigation: this.navigation.size,
      currentPage: this.uiState.currentPage,
      theme: this.uiState.theme,
      layout: this.uiState.layout,
      metrics: this.uiMetrics,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get connector status
   */
  getStatus() {
    const baseStatus = super.getStatus();
    return {
      ...baseStatus,
      gui: this.getGuiStatus(),
      webInterface: this.getWebInterfaceConfig()
    };
  }

  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      type: 'web-gui',
      name: 'Web GUI Connector',
      description: 'Web-based graphical user interface connector',
      version: '1.0.0',
      author: 'Looking Glass Team',
      capabilities: ['gui:pages', 'gui:components', 'gui:realtime', 'gui:integration']
    };
  }
}

module.exports = WebGuiConnector;
