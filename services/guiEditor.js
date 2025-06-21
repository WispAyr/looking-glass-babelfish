const EventEmitter = require('events');
const winston = require('winston');

/**
 * GUI Editor Service
 * 
 * Provides visual editing capabilities for layouts and components in the Looking Glass platform.
 * Handles drag-and-drop, component configuration, and real-time preview.
 */
class GuiEditor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableRealTimePreview: config.enableRealTimePreview !== false,
      autoSaveInterval: config.autoSaveInterval || 30000, // 30 seconds
      maxUndoSteps: config.maxUndoSteps || 50,
      ...config
    };
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'gui-editor' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
    
    // Editor state
    this.isEditing = false;
    this.currentLayout = null;
    this.selectedComponent = null;
    this.hoveredComponent = null;
    
    // Undo/Redo system
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSteps = this.config.maxUndoSteps;
    
    // Component library
    this.componentLibrary = {
      // Layout components
      header: {
        name: 'Header',
        category: 'layout',
        icon: 'header',
        defaultProps: {
          title: 'Looking Glass',
          showNavigation: true,
          showUserMenu: true
        },
        configurableProps: ['title', 'showNavigation', 'showUserMenu', 'backgroundColor', 'textColor']
      },
      sidebar: {
        name: 'Sidebar',
        category: 'layout',
        icon: 'sidebar',
        defaultProps: {
          width: 280,
          collapsible: true,
          items: []
        },
        configurableProps: ['width', 'collapsible', 'items', 'backgroundColor']
      },
      content: {
        name: 'Content Area',
        category: 'layout',
        icon: 'content',
        defaultProps: {
          padding: 16,
          scrollable: true
        },
        configurableProps: ['padding', 'scrollable', 'backgroundColor']
      },
      
      // Data components
      chart: {
        name: 'Chart',
        category: 'data',
        icon: 'chart',
        defaultProps: {
          type: 'line',
          data: [],
          height: 300
        },
        configurableProps: ['type', 'data', 'height', 'title', 'colors']
      },
      table: {
        name: 'Data Table',
        category: 'data',
        icon: 'table',
        defaultProps: {
          columns: [],
          data: [],
          pagination: true
        },
        configurableProps: ['columns', 'data', 'pagination', 'pageSize', 'sortable']
      },
      gauge: {
        name: 'Gauge',
        category: 'data',
        icon: 'gauge',
        defaultProps: {
          value: 0,
          min: 0,
          max: 100,
          unit: '%'
        },
        configurableProps: ['value', 'min', 'max', 'unit', 'color', 'title']
      },
      
      // Media components
      camera: {
        name: 'Camera Feed',
        category: 'media',
        icon: 'camera',
        defaultProps: {
          cameraId: null,
          showControls: true,
          autoRefresh: true
        },
        configurableProps: ['cameraId', 'showControls', 'autoRefresh', 'quality', 'aspectRatio']
      },
      cameraGrid: {
        name: 'Camera Grid',
        category: 'media',
        icon: 'camera-grid',
        defaultProps: {
          cameras: [],
          columns: 2,
          rows: 2
        },
        configurableProps: ['cameras', 'columns', 'rows', 'autoLayout']
      },
      
      // Control components
      button: {
        name: 'Button',
        category: 'control',
        icon: 'button',
        defaultProps: {
          text: 'Click Me',
          variant: 'primary',
          size: 'medium'
        },
        configurableProps: ['text', 'variant', 'size', 'disabled', 'onClick']
      },
      form: {
        name: 'Form',
        category: 'control',
        icon: 'form',
        defaultProps: {
          fields: [],
          submitText: 'Submit'
        },
        configurableProps: ['fields', 'submitText', 'validation']
      },
      
      // Information components
      status: {
        name: 'Status Indicator',
        category: 'info',
        icon: 'status',
        defaultProps: {
          status: 'online',
          text: 'System Online'
        },
        configurableProps: ['status', 'text', 'showIcon']
      },
      alert: {
        name: 'Alert',
        category: 'info',
        icon: 'alert',
        defaultProps: {
          type: 'info',
          message: 'This is an alert message',
          dismissible: true
        },
        configurableProps: ['type', 'message', 'dismissible', 'autoHide']
      },
      
      // Map components
      map: {
        name: 'Map',
        category: 'map',
        icon: 'map',
        defaultProps: {
          center: [0, 0],
          zoom: 10,
          markers: []
        },
        configurableProps: ['center', 'zoom', 'markers', 'layers', 'interactive']
      },
      
      // Specialized components
      eventsPanel: {
        name: 'Events Panel',
        category: 'specialized',
        icon: 'events',
        defaultProps: {
          eventTypes: ['all'],
          maxEvents: 50,
          autoScroll: true
        },
        configurableProps: ['eventTypes', 'maxEvents', 'autoScroll', 'refreshInterval']
      },
      analyticsPanel: {
        name: 'Analytics Panel',
        category: 'specialized',
        icon: 'analytics',
        defaultProps: {
          metrics: [],
          timeRange: '24h',
          refreshInterval: 30000
        },
        configurableProps: ['metrics', 'timeRange', 'refreshInterval', 'chartTypes']
      }
    };
    
    // Auto-save timer
    this.autoSaveTimer = null;
    
    this.logger.info('GUI Editor initialized');
  }
  
  /**
   * Start editing a layout
   */
  startEditing(layoutId, layoutManager) {
    try {
      this.isEditing = true;
      this.currentLayout = layoutManager.getLayout(layoutId);
      this.layoutManager = layoutManager;
      
      if (!this.currentLayout) {
        throw new Error(`Layout ${layoutId} not found`);
      }
      
      // Clear undo/redo stacks
      this.undoStack = [];
      this.redoStack = [];
      
      // Start auto-save if enabled
      if (this.config.autoSaveInterval > 0) {
        this.startAutoSave();
      }
      
      this.logger.info(`Started editing layout: ${layoutId}`);
      this.emit('editing:started', { layoutId, layout: this.currentLayout });
      
      return this.currentLayout;
    } catch (error) {
      this.logger.error('Failed to start editing', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Stop editing
   */
  stopEditing() {
    try {
      this.isEditing = false;
      this.currentLayout = null;
      this.selectedComponent = null;
      this.hoveredComponent = null;
      
      // Stop auto-save
      this.stopAutoSave();
      
      this.logger.info('Stopped editing');
      this.emit('editing:stopped');
    } catch (error) {
      this.logger.error('Failed to stop editing', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Add component to layout
   */
  addComponent(componentType, position = null) {
    try {
      if (!this.isEditing || !this.currentLayout) {
        throw new Error('Not currently editing a layout');
      }
      
      const componentTemplate = this.componentLibrary[componentType];
      if (!componentTemplate) {
        throw new Error(`Unknown component type: ${componentType}`);
      }
      
      const componentId = `${componentType}_${Date.now()}`;
      const component = {
        id: componentId,
        type: componentType,
        name: componentTemplate.name,
        position: position || { x: 0, y: 0, w: 6, h: 4 },
        props: { ...componentTemplate.defaultProps },
        configurable: componentTemplate.configurableProps
      };
      
      // Save current state for undo
      this.saveUndoState();
      
      // Add component to layout
      this.currentLayout.components.push(component);
      
      this.logger.info(`Added component: ${componentId} (${componentType})`);
      this.emit('component:added', { component, layout: this.currentLayout });
      
      return component;
    } catch (error) {
      this.logger.error('Failed to add component', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Remove component from layout
   */
  removeComponent(componentId) {
    try {
      if (!this.isEditing || !this.currentLayout) {
        throw new Error('Not currently editing a layout');
      }
      
      const componentIndex = this.currentLayout.components.findIndex(c => c.id === componentId);
      if (componentIndex === -1) {
        throw new Error(`Component ${componentId} not found`);
      }
      
      // Save current state for undo
      this.saveUndoState();
      
      const removedComponent = this.currentLayout.components.splice(componentIndex, 1)[0];
      
      // Clear selection if this was the selected component
      if (this.selectedComponent === componentId) {
        this.selectedComponent = null;
      }
      
      this.logger.info(`Removed component: ${componentId}`);
      this.emit('component:removed', { componentId, component: removedComponent, layout: this.currentLayout });
      
      return removedComponent;
    } catch (error) {
      this.logger.error('Failed to remove component', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Update component properties
   */
  updateComponent(componentId, updates) {
    try {
      if (!this.isEditing || !this.currentLayout) {
        throw new Error('Not currently editing a layout');
      }
      
      const component = this.currentLayout.components.find(c => c.id === componentId);
      if (!component) {
        throw new Error(`Component ${componentId} not found`);
      }
      
      // Save current state for undo
      this.saveUndoState();
      
      // Update component
      Object.assign(component, updates);
      component.updatedAt = new Date().toISOString();
      
      this.logger.info(`Updated component: ${componentId}`);
      this.emit('component:updated', { componentId, component, updates, layout: this.currentLayout });
      
      return component;
    } catch (error) {
      this.logger.error('Failed to update component', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Move component to new position
   */
  moveComponent(componentId, newPosition) {
    try {
      if (!this.isEditing || !this.currentLayout) {
        throw new Error('Not currently editing a layout');
      }
      
      const component = this.currentLayout.components.find(c => c.id === componentId);
      if (!component) {
        throw new Error(`Component ${componentId} not found`);
      }
      
      // Save current state for undo
      this.saveUndoState();
      
      // Update position
      component.position = { ...component.position, ...newPosition };
      component.updatedAt = new Date().toISOString();
      
      this.logger.info(`Moved component: ${componentId} to ${JSON.stringify(newPosition)}`);
      this.emit('component:moved', { componentId, component, newPosition, layout: this.currentLayout });
      
      return component;
    } catch (error) {
      this.logger.error('Failed to move component', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Select component
   */
  selectComponent(componentId) {
    try {
      if (!this.isEditing || !this.currentLayout) {
        throw new Error('Not currently editing a layout');
      }
      
      if (componentId && !this.currentLayout.components.find(c => c.id === componentId)) {
        throw new Error(`Component ${componentId} not found`);
      }
      
      this.selectedComponent = componentId;
      
      this.logger.info(`Selected component: ${componentId || 'none'}`);
      this.emit('component:selected', { componentId, component: componentId ? this.currentLayout.components.find(c => c.id === componentId) : null });
      
      return this.selectedComponent;
    } catch (error) {
      this.logger.error('Failed to select component', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get selected component
   */
  getSelectedComponent() {
    if (!this.selectedComponent || !this.currentLayout) {
      return null;
    }
    return this.currentLayout.components.find(c => c.id === this.selectedComponent);
  }
  
  /**
   * Get component library
   */
  getComponentLibrary() {
    return this.componentLibrary;
  }
  
  /**
   * Get components by category
   */
  getComponentsByCategory(category) {
    return Object.entries(this.componentLibrary)
      .filter(([id, component]) => component.category === category)
      .map(([id, component]) => ({ id, ...component }));
  }
  
  /**
   * Save current layout
   */
  async saveLayout() {
    try {
      if (!this.isEditing || !this.currentLayout || !this.layoutManager) {
        throw new Error('Not currently editing a layout');
      }
      
      await this.layoutManager.updateLayout(this.currentLayout.id, this.currentLayout);
      
      this.logger.info(`Saved layout: ${this.currentLayout.id}`);
      this.emit('layout:saved', { layout: this.currentLayout });
      
      return this.currentLayout;
    } catch (error) {
      this.logger.error('Failed to save layout', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Undo last action
   */
  undo() {
    try {
      if (this.undoStack.length === 0) {
        throw new Error('Nothing to undo');
      }
      
      // Save current state for redo
      this.saveRedoState();
      
      // Restore previous state
      const previousState = this.undoStack.pop();
      this.currentLayout = previousState;
      
      this.logger.info('Undid last action');
      this.emit('action:undone', { layout: this.currentLayout });
      
      return this.currentLayout;
    } catch (error) {
      this.logger.error('Failed to undo', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Redo last undone action
   */
  redo() {
    try {
      if (this.redoStack.length === 0) {
        throw new Error('Nothing to redo');
      }
      
      // Save current state for undo
      this.saveUndoState();
      
      // Restore next state
      const nextState = this.redoStack.pop();
      this.currentLayout = nextState;
      
      this.logger.info('Redid last action');
      this.emit('action:redone', { layout: this.currentLayout });
      
      return this.currentLayout;
    } catch (error) {
      this.logger.error('Failed to redo', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Save current state for undo
   */
  saveUndoState() {
    if (this.currentLayout) {
      this.undoStack.push(JSON.parse(JSON.stringify(this.currentLayout)));
      if (this.undoStack.length > this.maxUndoSteps) {
        this.undoStack.shift();
      }
      // Clear redo stack when new action is performed
      this.redoStack = [];
    }
  }
  
  /**
   * Save current state for redo
   */
  saveRedoState() {
    if (this.currentLayout) {
      this.redoStack.push(JSON.parse(JSON.stringify(this.currentLayout)));
      if (this.redoStack.length > this.maxUndoSteps) {
        this.redoStack.shift();
      }
    }
  }
  
  /**
   * Start auto-save timer
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(async () => {
      try {
        if (this.isEditing && this.currentLayout) {
          await this.saveLayout();
        }
      } catch (error) {
        this.logger.error('Auto-save failed', { error: error.message });
      }
    }, this.config.autoSaveInterval);
  }
  
  /**
   * Stop auto-save timer
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  
  /**
   * Get editor state
   */
  getEditorState() {
    return {
      isEditing: this.isEditing,
      currentLayout: this.currentLayout,
      selectedComponent: this.selectedComponent,
      hoveredComponent: this.hoveredComponent,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length
    };
  }
  
  /**
   * Validate layout
   */
  validateLayout() {
    if (!this.currentLayout) {
      return { isValid: false, errors: ['No layout loaded'] };
    }
    
    const errors = [];
    
    // Check for overlapping components
    const components = this.currentLayout.components;
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const comp1 = components[i];
        const comp2 = components[j];
        
        if (this.componentsOverlap(comp1.position, comp2.position)) {
          errors.push(`Components "${comp1.id}" and "${comp2.id}" overlap`);
        }
      }
    }
    
    // Check for components outside grid bounds
    const grid = this.currentLayout.grid;
    components.forEach(component => {
      const pos = component.position;
      if (pos.x < 0 || pos.y < 0 || pos.x + pos.w > grid.columns || pos.y + pos.h > grid.rows) {
        errors.push(`Component "${component.id}" is outside grid bounds`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Check if two component positions overlap
   */
  componentsOverlap(pos1, pos2) {
    return !(pos1.x + pos1.w <= pos2.x || pos2.x + pos2.w <= pos1.x ||
             pos1.y + pos1.h <= pos2.y || pos2.y + pos2.h <= pos1.y);
  }
}

module.exports = GuiEditor; 