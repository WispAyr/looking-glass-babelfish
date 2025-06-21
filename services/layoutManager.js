const EventEmitter = require('events');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

/**
 * Layout Manager Service
 * 
 * Manages different GUI layouts for different scenarios in the Looking Glass platform.
 * Supports layout creation, editing, switching, and persistence.
 */
class LayoutManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      layoutsPath: config.layoutsPath || './config/layouts',
      defaultLayout: config.defaultLayout || 'default',
      autoSave: config.autoSave !== false,
      ...config
    };
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'layout-manager' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
    
    // Layout storage
    this.layouts = new Map();
    this.activeLayout = null;
    this.layoutHistory = [];
    this.maxHistorySize = 10;
    
    // Layout templates for different scenarios
    this.layoutTemplates = {
      default: {
        name: 'Default Dashboard',
        description: 'Standard dashboard layout for general monitoring',
        type: 'dashboard',
        grid: { columns: 12, rows: 8 },
        components: [
          { id: 'header', type: 'header', position: { x: 0, y: 0, w: 12, h: 1 } },
          { id: 'sidebar', type: 'sidebar', position: { x: 0, y: 1, w: 3, h: 7 } },
          { id: 'main-content', type: 'content', position: { x: 3, y: 1, w: 9, h: 7 } }
        ],
        theme: 'dark',
        responsive: true
      },
      surveillance: {
        name: 'Surveillance Center',
        description: 'Layout optimized for camera monitoring and security',
        type: 'surveillance',
        grid: { columns: 12, rows: 10 },
        components: [
          { id: 'camera-grid', type: 'camera-grid', position: { x: 0, y: 0, w: 8, h: 6 } },
          { id: 'camera-controls', type: 'camera-controls', position: { x: 8, y: 0, w: 4, h: 6 } },
          { id: 'events-panel', type: 'events-panel', position: { x: 0, y: 6, w: 6, h: 4 } },
          { id: 'analytics-panel', type: 'analytics-panel', position: { x: 6, y: 6, w: 6, h: 4 } }
        ],
        theme: 'dark',
        responsive: true
      },
      command: {
        name: 'Command Center',
        description: 'Layout for command and control operations',
        type: 'command',
        grid: { columns: 16, rows: 12 },
        components: [
          { id: 'command-header', type: 'header', position: { x: 0, y: 0, w: 16, h: 1 } },
          { id: 'status-board', type: 'status-board', position: { x: 0, y: 1, w: 4, h: 4 } },
          { id: 'map-view', type: 'map', position: { x: 4, y: 1, w: 8, h: 6 } },
          { id: 'communications', type: 'communications', position: { x: 12, y: 1, w: 4, h: 6 } },
          { id: 'alerts-panel', type: 'alerts', position: { x: 0, y: 5, w: 16, h: 3 } },
          { id: 'control-panel', type: 'controls', position: { x: 0, y: 8, w: 16, h: 4 } }
        ],
        theme: 'dark',
        responsive: true
      },
      mobile: {
        name: 'Mobile Interface',
        description: 'Optimized layout for mobile devices',
        type: 'mobile',
        grid: { columns: 4, rows: 8 },
        components: [
          { id: 'mobile-header', type: 'header', position: { x: 0, y: 0, w: 4, h: 1 } },
          { id: 'mobile-nav', type: 'navigation', position: { x: 0, y: 1, w: 4, h: 1 } },
          { id: 'mobile-content', type: 'content', position: { x: 0, y: 2, w: 4, h: 5 } },
          { id: 'mobile-footer', type: 'footer', position: { x: 0, y: 7, w: 4, h: 1 } }
        ],
        theme: 'dark',
        responsive: true
      },
      analytics: {
        name: 'Analytics Dashboard',
        description: 'Layout focused on data visualization and analytics',
        type: 'analytics',
        grid: { columns: 12, rows: 10 },
        components: [
          { id: 'analytics-header', type: 'header', position: { x: 0, y: 0, w: 12, h: 1 } },
          { id: 'chart-1', type: 'chart', position: { x: 0, y: 1, w: 6, h: 3 } },
          { id: 'chart-2', type: 'chart', position: { x: 6, y: 1, w: 6, h: 3 } },
          { id: 'chart-3', type: 'chart', position: { x: 0, y: 4, w: 4, h: 3 } },
          { id: 'chart-4', type: 'chart', position: { x: 4, y: 4, w: 4, h: 3 } },
          { id: 'chart-5', type: 'chart', position: { x: 8, y: 4, w: 4, h: 3 } },
          { id: 'data-table', type: 'table', position: { x: 0, y: 7, w: 12, h: 3 } }
        ],
        theme: 'dark',
        responsive: true
      }
    };
    
    this.logger.info('Layout Manager initialized', {
      layoutsPath: this.config.layoutsPath,
      defaultLayout: this.config.defaultLayout
    });
  }
  
  /**
   * Initialize the layout manager
   */
  async initialize() {
    try {
      // Ensure layouts directory exists
      await this.ensureLayoutsDirectory();
      
      // Load existing layouts
      await this.loadLayouts();
      
      // Set default layout if none active
      if (!this.activeLayout) {
        await this.setActiveLayout(this.config.defaultLayout);
      }
      
      this.logger.info('Layout Manager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Layout Manager', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Ensure layouts directory exists
   */
  async ensureLayoutsDirectory() {
    try {
      await fs.mkdir(this.config.layoutsPath, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create layouts directory', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Load layouts from disk
   */
  async loadLayouts() {
    try {
      const files = await fs.readdir(this.config.layoutsPath);
      const layoutFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of layoutFiles) {
        const layoutId = path.basename(file, '.json');
        const layoutPath = path.join(this.config.layoutsPath, file);
        const layoutData = await fs.readFile(layoutPath, 'utf8');
        const layout = JSON.parse(layoutData);
        
        this.layouts.set(layoutId, layout);
        this.logger.info(`Loaded layout: ${layoutId}`);
      }
      
      // Add template layouts if they don't exist
      for (const [templateId, template] of Object.entries(this.layoutTemplates)) {
        if (!this.layouts.has(templateId)) {
          this.layouts.set(templateId, {
            id: templateId,
            ...template,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      
      this.logger.info(`Loaded ${this.layouts.size} layouts`);
    } catch (error) {
      this.logger.error('Failed to load layouts', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Save layout to disk
   */
  async saveLayout(layoutId) {
    try {
      const layout = this.layouts.get(layoutId);
      if (!layout) {
        throw new Error(`Layout ${layoutId} not found`);
      }
      
      const layoutPath = path.join(this.config.layoutsPath, `${layoutId}.json`);
      await fs.writeFile(layoutPath, JSON.stringify(layout, null, 2));
      
      this.logger.info(`Saved layout: ${layoutId}`);
      this.emit('layout:saved', { layoutId, layout });
    } catch (error) {
      this.logger.error(`Failed to save layout ${layoutId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Create a new layout
   */
  async createLayout(layoutData) {
    try {
      const layoutId = layoutData.id || `layout_${Date.now()}`;
      
      if (this.layouts.has(layoutId)) {
        throw new Error(`Layout ${layoutId} already exists`);
      }
      
      const layout = {
        id: layoutId,
        name: layoutData.name || 'New Layout',
        description: layoutData.description || '',
        type: layoutData.type || 'custom',
        grid: layoutData.grid || { columns: 12, rows: 8 },
        components: layoutData.components || [],
        theme: layoutData.theme || 'dark',
        responsive: layoutData.responsive !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.layouts.set(layoutId, layout);
      
      if (this.config.autoSave) {
        await this.saveLayout(layoutId);
      }
      
      this.logger.info(`Created layout: ${layoutId}`);
      this.emit('layout:created', { layoutId, layout });
      
      return layout;
    } catch (error) {
      this.logger.error('Failed to create layout', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Update an existing layout
   */
  async updateLayout(layoutId, updates) {
    try {
      const layout = this.layouts.get(layoutId);
      if (!layout) {
        throw new Error(`Layout ${layoutId} not found`);
      }
      
      const updatedLayout = {
        ...layout,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      this.layouts.set(layoutId, updatedLayout);
      
      if (this.config.autoSave) {
        await this.saveLayout(layoutId);
      }
      
      this.logger.info(`Updated layout: ${layoutId}`);
      this.emit('layout:updated', { layoutId, layout: updatedLayout });
      
      return updatedLayout;
    } catch (error) {
      this.logger.error(`Failed to update layout ${layoutId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Delete a layout
   */
  async deleteLayout(layoutId) {
    try {
      if (!this.layouts.has(layoutId)) {
        throw new Error(`Layout ${layoutId} not found`);
      }
      
      // Don't allow deletion of active layout
      if (this.activeLayout === layoutId) {
        throw new Error(`Cannot delete active layout: ${layoutId}`);
      }
      
      this.layouts.delete(layoutId);
      
      // Remove from disk
      const layoutPath = path.join(this.config.layoutsPath, `${layoutId}.json`);
      try {
        await fs.unlink(layoutPath);
      } catch (error) {
        // File might not exist, that's okay
      }
      
      this.logger.info(`Deleted layout: ${layoutId}`);
      this.emit('layout:deleted', { layoutId });
    } catch (error) {
      this.logger.error(`Failed to delete layout ${layoutId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Set active layout
   */
  async setActiveLayout(layoutId) {
    try {
      if (!this.layouts.has(layoutId)) {
        throw new Error(`Layout ${layoutId} not found`);
      }
      
      const previousLayout = this.activeLayout;
      this.activeLayout = layoutId;
      
      // Add to history
      if (previousLayout && previousLayout !== layoutId) {
        this.layoutHistory.unshift(previousLayout);
        if (this.layoutHistory.length > this.maxHistorySize) {
          this.layoutHistory.pop();
        }
      }
      
      this.logger.info(`Set active layout: ${layoutId}`);
      this.emit('layout:activated', { 
        layoutId, 
        previousLayout,
        layout: this.layouts.get(layoutId)
      });
      
      return this.layouts.get(layoutId);
    } catch (error) {
      this.logger.error(`Failed to set active layout ${layoutId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get active layout
   */
  getActiveLayout() {
    if (!this.activeLayout) {
      return null;
    }
    return this.layouts.get(this.activeLayout);
  }
  
  /**
   * Get all layouts
   */
  getAllLayouts() {
    return Array.from(this.layouts.values());
  }
  
  /**
   * Get layout by ID
   */
  getLayout(layoutId) {
    return this.layouts.get(layoutId);
  }
  
  /**
   * Get layout templates
   */
  getLayoutTemplates() {
    return this.layoutTemplates;
  }
  
  /**
   * Create layout from template
   */
  async createFromTemplate(templateId, customizations = {}) {
    try {
      const template = this.layoutTemplates[templateId];
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }
      
      const layoutData = {
        ...template,
        ...customizations,
        id: customizations.id || `${templateId}_${Date.now()}`
      };
      
      return await this.createLayout(layoutData);
    } catch (error) {
      this.logger.error(`Failed to create layout from template ${templateId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Duplicate existing layout
   */
  async duplicateLayout(layoutId, newId = null) {
    try {
      const originalLayout = this.layouts.get(layoutId);
      if (!originalLayout) {
        throw new Error(`Layout ${layoutId} not found`);
      }
      
      const newLayoutId = newId || `${layoutId}_copy_${Date.now()}`;
      const duplicatedLayout = {
        ...originalLayout,
        id: newLayoutId,
        name: `${originalLayout.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.layouts.set(newLayoutId, duplicatedLayout);
      
      if (this.config.autoSave) {
        await this.saveLayout(newLayoutId);
      }
      
      this.logger.info(`Duplicated layout ${layoutId} to ${newLayoutId}`);
      this.emit('layout:duplicated', { originalId: layoutId, newId: newLayoutId, layout: duplicatedLayout });
      
      return duplicatedLayout;
    } catch (error) {
      this.logger.error(`Failed to duplicate layout ${layoutId}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Export layout to JSON
   */
  exportLayout(layoutId) {
    const layout = this.layouts.get(layoutId);
    if (!layout) {
      throw new Error(`Layout ${layoutId} not found`);
    }
    return JSON.stringify(layout, null, 2);
  }
  
  /**
   * Import layout from JSON
   */
  async importLayout(layoutJson) {
    try {
      const layoutData = JSON.parse(layoutJson);
      return await this.createLayout(layoutData);
    } catch (error) {
      this.logger.error('Failed to import layout', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get layout statistics
   */
  getLayoutStats() {
    const layouts = Array.from(this.layouts.values());
    const stats = {
      total: layouts.length,
      byType: {},
      activeLayout: this.activeLayout,
      recentlyUsed: this.layoutHistory.slice(0, 5)
    };
    
    layouts.forEach(layout => {
      stats.byType[layout.type] = (stats.byType[layout.type] || 0) + 1;
    });
    
    return stats;
  }
  
  /**
   * Validate layout structure
   */
  validateLayout(layout) {
    const errors = [];
    
    if (!layout.id) errors.push('Layout ID is required');
    if (!layout.name) errors.push('Layout name is required');
    if (!layout.grid) errors.push('Grid configuration is required');
    if (!layout.components) errors.push('Components array is required');
    
    // Validate grid
    if (layout.grid) {
      if (!layout.grid.columns || layout.grid.columns < 1) {
        errors.push('Grid must have at least 1 column');
      }
      if (!layout.grid.rows || layout.grid.rows < 1) {
        errors.push('Grid must have at least 1 row');
      }
    }
    
    // Validate components
    if (layout.components && Array.isArray(layout.components)) {
      layout.components.forEach((component, index) => {
        if (!component.id) errors.push(`Component ${index} must have an ID`);
        if (!component.type) errors.push(`Component ${index} must have a type`);
        if (!component.position) errors.push(`Component ${index} must have a position`);
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = LayoutManager; 