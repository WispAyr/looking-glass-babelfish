const BaseConnector = require('../BaseConnector');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Remotion Connector for templated video rendering
 * 
 * Connects to Remotion video rendering engine and provides capabilities
 * for creating templated videos using data from other connectors.
 * Supports flight path visualization, event timelines, and custom templates.
 * Integrates with the event system for automated video generation.
 */
class RemotionConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // Remotion-specific configuration
    this.outputDir = config.outputDir || './renders';
    this.templatesDir = config.templatesDir || './templates';
    this.remotionProjectDir = config.remotionProjectDir || './remotion-project';
    this.defaultFps = config.defaultFps || 30;
    this.defaultDuration = config.defaultDuration || 10;
    this.quality = config.quality || 'medium'; // low, medium, high, ultra
    this.enableAudio = config.enableAudio !== false;
    this.enableSubtitles = config.enableSubtitles !== false;
    
    // Template management
    this.templates = new Map();
    this.activeRenders = new Map();
    this.renderQueue = [];
    
    // Data sources from other connectors
    this.dataSources = new Map();
    this.connectorRegistry = null;
    
    // Performance tracking
    this.renderStats = {
      totalRenders: 0,
      successfulRenders: 0,
      failedRenders: 0,
      totalRenderTime: 0,
      averageRenderTime: 0
    };
    
    // Event integration
    this.eventTriggers = new Map();
    this.autoRenderEnabled = config.autoRenderEnabled !== false;
    
    // Add global toggle for event-triggered video renders
    const globalConfig = require('../../config/config');
    this.enableRemotionVideoRenders = (typeof globalConfig.enableRemotionVideoRenders === 'boolean')
      ? globalConfig.enableRemotionVideoRenders
      : false;
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Set up event listeners for automated rendering
    this.setupEventListeners();

    this.webInterface = {
      enabled: true,
      route: '/remotion',
      port: 3000,
      host: 'localhost'
    };
    this.config.webInterface = this.webInterface;
  }

  /**
   * Set connector registry for data integration
   */
  setConnectorRegistry(connectorRegistry) {
    this.connectorRegistry = connectorRegistry;
    this.logger.info('Connector registry set for Remotion connector');
  }

  /**
   * Set event bus reference
   */
  setEventBus(eventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
    this.logger.info('Event bus set for Remotion connector');
  }

  /**
   * Set up event listeners for automated rendering
   */
  setupEventListeners() {
    if (!this.eventBus) return;
    
    // Remove existing listeners to avoid duplicates
    this.eventBus.removeAllListeners('event');
    this.eventBus.removeAllListeners('event:smartDetectZone');
    this.eventBus.removeAllListeners('event:motion');
    this.eventBus.removeAllListeners('event:flight:completed');
    this.eventBus.removeAllListeners('event:speed:alert');
    
    // Only set up listeners if enabled
    if (!this.enableRemotionVideoRenders) return;
    
    // Listen for events that should trigger video renders
    this.eventBus.on('event', (event) => {
      this.handleIncomingEvent(event);
    });
    
    // Listen for specific event types that commonly trigger renders
    this.eventBus.on('event:smartDetectZone', (event) => {
      this.handleSmartDetectEvent(event);
    });
    
    this.eventBus.on('event:motion', (event) => {
      this.handleMotionEvent(event);
    });
    
    this.eventBus.on('event:flight:completed', (event) => {
      this.handleFlightCompletedEvent(event);
    });
    
    this.eventBus.on('event:speed:alert', (event) => {
      this.handleSpeedAlertEvent(event);
    });
    
    this.logger.info('Event listeners configured for automated video rendering');
  }

  /**
   * Handle incoming events and check for render triggers
   */
  async handleIncomingEvent(event) {
    if (!this.autoRenderEnabled || !this.enableRemotionVideoRenders) return;
    
    // Check if this event type has any registered triggers
    const triggers = this.eventTriggers.get(event.type) || [];
    
    for (const trigger of triggers) {
      if (this.checkTriggerConditions(trigger, event)) {
        await this.executeTrigger(trigger, event);
      }
    }
  }

  /**
   * Handle smart detect events for automated video generation
   */
  async handleSmartDetectEvent(event) {
    if (!this.autoRenderEnabled || !this.enableRemotionVideoRenders) return;
    
    // Create event timeline video for smart detect events
    const renderId = await this.createEventTimeline({
      eventTypes: ['smartDetectZone'],
      startTime: new Date(Date.now() - 300000).toISOString(), // Last 5 minutes
      endTime: new Date().toISOString(),
      outputPath: `./renders/smart-detect-${Date.now()}.mp4`
    });
    
    this.logger.info(`Auto-generated smart detect video: ${renderId.renderId}`);
  }

  /**
   * Handle motion events for automated video generation
   */
  async handleMotionEvent(event) {
    if (!this.autoRenderEnabled || !this.enableRemotionVideoRenders) return;
    
    // Create motion event video
    const renderId = await this.createEventTimeline({
      eventTypes: ['motion'],
      startTime: new Date(Date.now() - 300000).toISOString(), // Last 5 minutes
      endTime: new Date().toISOString(),
      outputPath: `./renders/motion-${Date.now()}.mp4`
    });
    
    this.logger.info(`Auto-generated motion video: ${renderId.renderId}`);
  }

  /**
   * Handle flight completed events for automated video generation
   */
  async handleFlightCompletedEvent(event) {
    if (!this.autoRenderEnabled || !this.enableRemotionVideoRenders) return;
    
    const { callsign, registration, startTime, endTime } = event.data;
    
    // Create flight path video
    const renderId = await this.createFlightVideo({
      callsign,
      registration,
      startTime,
      endTime,
      outputPath: `./renders/flight-${callsign}-${Date.now()}.mp4`
    });
    
    this.logger.info(`Auto-generated flight video: ${renderId.renderId}`);
  }

  /**
   * Handle speed alert events for automated video generation
   */
  async handleSpeedAlertEvent(event) {
    if (!this.autoRenderEnabled || !this.enableRemotionVideoRenders) return;
    
    // Create speed alert video with context
    const renderId = await this.createEventTimeline({
      eventTypes: ['speed:alert', 'motion', 'smartDetectZone'],
      startTime: new Date(Date.now() - 600000).toISOString(), // Last 10 minutes
      endTime: new Date().toISOString(),
      outputPath: `./renders/speed-alert-${Date.now()}.mp4`
    });
    
    this.logger.info(`Auto-generated speed alert video: ${renderId.renderId}`);
  }

  /**
   * Check if trigger conditions are met
   */
  checkTriggerConditions(trigger, event) {
    const conditions = trigger.conditions;
    if (!conditions) return true;

    const data = event.data;
    
    for (const [field, condition] of Object.entries(conditions)) {
      const value = data[field];
      
      if (condition.min !== undefined && value < condition.min) {
        return false;
      }
      
      if (condition.max !== undefined && value > condition.max) {
        return false;
      }
      
      if (condition.equals !== undefined && value !== condition.equals) {
        return false;
      }
      
      if (condition.contains !== undefined && !value.includes(condition.contains)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Execute a render trigger
   */
  async executeTrigger(trigger, event) {
    try {
      const renderParams = {
        ...trigger.renderParams,
        data: {
          ...trigger.renderParams.data,
          triggerEvent: event
        }
      };
      
      const result = await this.renderVideo(renderParams);
      
      this.logger.info(`Triggered render ${result.renderId} for event ${event.type}`);
      
      // Emit trigger executed event
      this.emitRenderEvent('trigger-executed', {
        triggerId: trigger.id,
        eventId: event.id,
        renderId: result.renderId
      });
      
    } catch (error) {
      this.logger.error(`Failed to execute trigger ${trigger.id}:`, error.message);
      
      // Emit trigger failed event
      this.emitRenderEvent('trigger-failed', {
        triggerId: trigger.id,
        eventId: event.id,
        error: error.message
      });
    }
  }

  /**
   * Add a render trigger for an event type
   */
  addRenderTrigger(eventType, trigger) {
    if (!this.eventTriggers.has(eventType)) {
      this.eventTriggers.set(eventType, []);
    }
    
    this.eventTriggers.get(eventType).push(trigger);
    this.logger.info(`Added render trigger for event type: ${eventType}`);
  }

  /**
   * Remove a render trigger
   */
  removeRenderTrigger(eventType, triggerId) {
    const triggers = this.eventTriggers.get(eventType);
    if (triggers) {
      const index = triggers.findIndex(t => t.id === triggerId);
      if (index !== -1) {
        triggers.splice(index, 1);
        this.logger.info(`Removed render trigger: ${triggerId}`);
      }
    }
  }

  /**
   * Emit render events to the event bus
   */
  emitRenderEvent(eventType, data) {
    const event = {
      type: `render:${eventType}`,
      source: this.id,
      timestamp: new Date().toISOString(),
      data: {
        ...data,
        connectorId: this.id,
        connectorType: 'remotion'
      }
    };
    
    // Emit to event bus if available
    if (this.eventBus) {
      this.eventBus.publishEvent(event);
    }
    
    // Emit locally
    this.emit(eventType, event);
    
    this.logger.debug(`Render event emitted: ${eventType}`);
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    const dirs = [this.outputDir, this.templatesDir, this.remotionProjectDir];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        this.logger.warn(`Failed to create directory ${dir}:`, error.message);
      }
    }
    
    // Load existing templates from files
    await this.loadTemplatesFromFiles();
  }

  /**
   * Load templates from files
   */
  async loadTemplatesFromFiles() {
    try {
      const files = await fs.readdir(this.templatesDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const templatePath = path.join(this.templatesDir, file);
          const templateData = await fs.readFile(templatePath, 'utf8');
          const template = JSON.parse(templateData);
          
          this.templates.set(template.id, template);
          this.logger.info(`Loaded template: ${template.name}`);
        } catch (error) {
          this.logger.warn(`Failed to load template from ${file}:`, error.message);
        }
      }
    } catch (error) {
      // Directory might not exist yet, that's okay
      this.logger.debug(`Templates directory not found: ${error.message}`);
    }
  }

  /**
   * Get capability definitions for this connector
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'video-rendering',
        name: 'Video Rendering',
        description: 'Render templated videos using Remotion',
        operations: ['render', 'preview', 'cancel', 'status', 'list'],
        requiresConnection: false
      },
      {
        id: 'template-management',
        name: 'Template Management',
        description: 'Manage video templates and compositions',
        operations: ['create', 'update', 'delete', 'list', 'validate'],
        requiresConnection: false
      },
      {
        id: 'data-integration',
        name: 'Data Integration',
        description: 'Integrate data from other connectors for video rendering',
        operations: ['connect', 'disconnect', 'query', 'transform'],
        requiresConnection: false
      },
      {
        id: 'flight-visualization',
        name: 'Flight Visualization',
        description: 'Create flight path visualizations from ADSB data',
        operations: ['create-flight-video', 'create-flight-timeline', 'create-flight-summary'],
        requiresConnection: false
      },
      {
        id: 'event-timeline',
        name: 'Event Timeline',
        description: 'Create event timeline videos from various data sources',
        operations: ['create-event-timeline', 'create-event-summary', 'create-event-highlights'],
        requiresConnection: false
      },
      {
        id: 'render-triggers',
        name: 'Render Triggers',
        description: 'Manage automated video rendering based on events',
        operations: ['add-trigger', 'remove-trigger', 'list-triggers', 'enable-auto', 'disable-auto'],
        requiresConnection: false
      },
      {
        id: 'template-rendering',
        name: 'Template Rendering',
        description: 'Render videos using specific templates with data',
        operations: ['render-template', 'render-with-data', 'render-from-event'],
        requiresConnection: false
      }
    ];
  }

  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters = {}) {
    switch (capabilityId) {
      case 'video-rendering':
        return this.executeVideoRendering(operation, parameters);
      case 'template-management':
        return this.executeTemplateManagement(operation, parameters);
      case 'data-integration':
        return this.executeDataIntegration(operation, parameters);
      case 'flight-visualization':
        return this.executeFlightVisualization(operation, parameters);
      case 'event-timeline':
        return this.executeEventTimeline(operation, parameters);
      case 'render-triggers':
        return this.executeRenderTriggers(operation, parameters);
      case 'template-rendering':
        return this.executeTemplateRendering(operation, parameters);
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }

  /**
   * Execute video rendering operations
   */
  async executeVideoRendering(operation, parameters) {
    switch (operation) {
      case 'render':
        return this.renderVideo(parameters);
      case 'preview':
        return this.previewVideo(parameters);
      case 'cancel':
        return this.cancelRender(parameters);
      case 'status':
        return this.getRenderStatus(parameters.renderId);
      case 'list':
        return this.listActiveRenders(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute template management operations
   */
  async executeTemplateManagement(operation, parameters) {
    switch (operation) {
      case 'create':
        return this.createTemplate(parameters);
      case 'update':
        return this.updateTemplate(parameters);
      case 'delete':
        return this.deleteTemplate(parameters);
      case 'list':
        return this.listTemplates(parameters);
      case 'validate':
        return this.validateTemplate(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute data integration operations
   */
  async executeDataIntegration(operation, parameters) {
    switch (operation) {
      case 'connect':
        return this.connectDataSource(parameters);
      case 'disconnect':
        return this.disconnectDataSource(parameters);
      case 'query':
        return this.queryDataSource(parameters);
      case 'transform':
        return this.transformData(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute flight visualization operations
   */
  async executeFlightVisualization(operation, parameters) {
    switch (operation) {
      case 'create-flight-video':
        return this.createFlightVideo(parameters);
      case 'create-flight-timeline':
        return this.createFlightTimeline(parameters);
      case 'create-flight-summary':
        return this.createFlightSummary(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute event timeline operations
   */
  async executeEventTimeline(operation, parameters) {
    switch (operation) {
      case 'create-event-timeline':
        return this.createEventTimeline(parameters);
      case 'create-event-summary':
        return this.createEventSummary(parameters);
      case 'create-event-highlights':
        return this.createEventHighlights(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute render triggers operations
   */
  async executeRenderTriggers(operation, parameters) {
    switch (operation) {
      case 'add-trigger':
        return this.addRenderTrigger(parameters.eventType, parameters.trigger);
      case 'remove-trigger':
        return this.removeRenderTrigger(parameters.eventType, parameters.triggerId);
      case 'list-triggers':
        return this.listRenderTriggers(parameters);
      case 'enable-auto':
        this.autoRenderEnabled = true;
        return { enabled: true };
      case 'disable-auto':
        this.autoRenderEnabled = false;
        return { enabled: false };
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute template rendering operations
   */
  async executeTemplateRendering(operation, parameters) {
    switch (operation) {
      case 'render-template':
        return this.renderTemplate(parameters);
      case 'render-with-data':
        return this.renderWithData(parameters);
      case 'render-from-event':
        return this.renderFromEvent(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * List active renders
   */
  listActiveRenders(parameters = {}) {
    const renders = Array.from(this.activeRenders.values());
    
    if (parameters.status) {
      return renders.filter(r => r.status === parameters.status);
    }
    
    return renders;
  }

  /**
   * List render triggers
   */
  listRenderTriggers(parameters = {}) {
    const triggers = {};
    
    for (const [eventType, triggerList] of this.eventTriggers) {
      if (parameters.eventType && eventType !== parameters.eventType) {
        continue;
      }
      triggers[eventType] = triggerList;
    }
    
    return triggers;
  }

  /**
   * Render a template with specific data
   */
  async renderTemplate(parameters) {
    const { templateId, data, outputPath, ...renderOptions } = parameters;
    
    if (!templateId) {
      throw new Error('Template ID is required');
    }
    
    return this.renderVideo({
      templateId,
      data: data || {},
      outputPath,
      ...renderOptions
    });
  }

  /**
   * Render with data from other connectors
   */
  async renderWithData(parameters) {
    const { templateId, dataSource, dataQuery, outputPath, ...renderOptions } = parameters;
    
    if (!templateId || !dataSource) {
      throw new Error('Template ID and data source are required');
    }
    
    // Get data from specified source
    let data = {};
    
    if (this.connectorRegistry) {
      const connector = this.connectorRegistry.getConnector(dataSource);
      if (connector && dataQuery) {
        try {
          data = await connector.execute(dataQuery.capability, dataQuery.operation, dataQuery.parameters);
        } catch (error) {
          this.logger.warn(`Failed to get data from ${dataSource}:`, error.message);
        }
      }
    }
    
    return this.renderVideo({
      templateId,
      data,
      outputPath,
      ...renderOptions
    });
  }

  /**
   * Render from an event
   */
  async renderFromEvent(parameters) {
    const { templateId, event, outputPath, ...renderOptions } = parameters;
    
    if (!templateId || !event) {
      throw new Error('Template ID and event are required');
    }
    
    return this.renderVideo({
      templateId,
      data: {
        event,
        eventData: event.data,
        timestamp: event.timestamp
      },
      outputPath,
      ...renderOptions
    });
  }

  /**
   * Render a video using Remotion
   */
  async renderVideo(parameters) {
    const {
      templateId,
      data,
      outputPath,
      fps = this.defaultFps,
      duration = this.defaultDuration,
      quality = this.quality,
      audio = this.enableAudio,
      subtitles = this.enableSubtitles
    } = parameters;

    if (!templateId) {
      throw new Error('Template ID is required for video rendering');
    }

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const renderId = `render-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const finalOutputPath = outputPath || path.join(this.outputDir, `${renderId}.mp4`);

    // Create render job
    const renderJob = {
      id: renderId,
      templateId,
      data,
      outputPath: finalOutputPath,
      fps,
      duration,
      quality,
      audio,
      subtitles,
      status: 'queued',
      startTime: null,
      endTime: null,
      progress: 0,
      error: null
    };

    this.activeRenders.set(renderId, renderJob);
    this.renderQueue.push(renderId);

    // Emit render queued event
    this.emitRenderEvent('queued', {
      renderId,
      templateId,
      outputPath: finalOutputPath,
      parameters: { fps, duration, quality, audio, subtitles }
    });

    // Start rendering process
    this.processRenderQueue();

    return {
      renderId,
      status: 'queued',
      outputPath: finalOutputPath
    };
  }

  /**
   * Process the render queue
   */
  async processRenderQueue() {
    if (this.renderQueue.length === 0) return;

    const renderId = this.renderQueue.shift();
    const renderJob = this.activeRenders.get(renderId);

    if (!renderJob) return;

    try {
      renderJob.status = 'rendering';
      renderJob.startTime = new Date().toISOString();
      this.activeRenders.set(renderId, renderJob);

      // Emit render started event
      this.emitRenderEvent('started', {
        renderId,
        templateId: renderJob.templateId,
        startTime: renderJob.startTime
      });

      // Prepare composition data
      const compositionData = await this.prepareCompositionData(renderJob);
      
      // Emit render progress event
      this.emitRenderEvent('progress', {
        renderId,
        progress: 25,
        stage: 'composition-prepared'
      });
      
      // Generate Remotion composition file
      const compositionPath = await this.generateComposition(renderJob, compositionData);
      
      // Emit render progress event
      this.emitRenderEvent('progress', {
        renderId,
        progress: 50,
        stage: 'composition-generated'
      });
      
      // Execute Remotion render command
      const result = await this.executeRemotionRender(renderJob, compositionPath);
      
      renderJob.status = 'completed';
      renderJob.endTime = new Date().toISOString();
      renderJob.progress = 100;
      
      this.renderStats.totalRenders++;
      this.renderStats.successfulRenders++;
      this.renderStats.totalRenderTime += Date.now() - new Date(renderJob.startTime).getTime();
      this.renderStats.averageRenderTime = this.renderStats.totalRenderTime / this.renderStats.successfulRenders;

      // Emit render completed event
      this.emitRenderEvent('completed', {
        renderId,
        outputPath: renderJob.outputPath,
        duration: Date.now() - new Date(renderJob.startTime).getTime(),
        fileSize: await this.getFileSize(renderJob.outputPath)
      });

      // Clean up composition file
      try {
        await fs.unlink(compositionPath);
      } catch (error) {
        this.logger.warn(`Failed to clean up composition file ${compositionPath}:`, error.message);
      }

    } catch (error) {
      renderJob.status = 'failed';
      renderJob.error = error.message;
      renderJob.endTime = new Date().toISOString();
      
      this.renderStats.totalRenders++;
      this.renderStats.failedRenders++;

      // Emit render failed event
      this.emitRenderEvent('failed', {
        renderId,
        error: error.message,
        templateId: renderJob.templateId
      });

      this.logger.error(`Render failed for ${renderId}:`, error.message);
    }

    // Process next render
    this.processRenderQueue();
  }

  /**
   * Prepare composition data for rendering
   */
  async prepareCompositionData(renderJob) {
    const { templateId, data } = renderJob;
    const template = this.templates.get(templateId);

    // Transform data according to template requirements
    let compositionData = { ...data };

    if (template.dataTransform) {
      compositionData = await this.transformData({
        data: compositionData,
        transform: template.dataTransform
      });
    }

    return compositionData;
  }

  /**
   * Generate Remotion composition file
   */
  async generateComposition(renderJob, compositionData) {
    const { templateId, fps, duration } = renderJob;
    const template = this.templates.get(templateId);

    const compositionPath = path.join(this.remotionProjectDir, `composition-${renderJob.id}.js`);
    
    const compositionContent = `
import { Composition } from 'remotion';
import { ${template.componentName} } from './${template.componentPath}';

export const RemotionVideo = () => {
  return (
    <>
      <Composition
        id="${templateId}"
        component={${template.componentName}}
        durationInFrames={${duration * fps}}
        fps={${fps}}
        width={${template.width || 1920}}
        height={${template.height || 1080}}
        defaultProps={{
          data: ${JSON.stringify(compositionData, null, 2)}
        }}
      />
    </>
  );
};
`;

    await fs.writeFile(compositionPath, compositionContent);
    return compositionPath;
  }

  /**
   * Execute Remotion render command
   */
  async executeRemotionRender(renderJob, compositionPath) {
    const { outputPath, quality } = renderJob;
    
    const qualityFlags = {
      low: '--jpeg-quality=50',
      medium: '--jpeg-quality=80', 
      high: '--jpeg-quality=90',
      ultra: '--jpeg-quality=100'
    };

    // Use the main Remotion entry point (relative to remotion-project/)
    const entryPoint = 'src/index.jsx';
    // Output path should be relative to the root, so use ../renders
    const relativeOutputPath = path.relative(this.remotionProjectDir, outputPath);
    const command = `npx remotion render ${entryPoint} ${renderJob.templateId} ${relativeOutputPath} ${qualityFlags[quality] || qualityFlags.medium}`;
    
    this.logger.info(`Executing Remotion render: ${command}`);
    
    const { stdout, stderr } = await execAsync(command, {
      cwd: this.remotionProjectDir,
      timeout: 300000 // 5 minutes timeout
    });

    if (stderr) {
      this.logger.warn('Remotion render stderr:', stderr);
    }

    return { stdout, stderr };
  }

  /**
   * Create a flight visualization video
   */
  async createFlightVideo(parameters) {
    const {
      flightId,
      callsign,
      registration,
      startTime,
      endTime,
      templateId = 'flight-path',
      outputPath
    } = parameters;

    // Get flight data from ADSB connector
    const adsbConnector = this.connectorRegistry?.getConnectorsByType('adsb')[0];
    if (!adsbConnector) {
      throw new Error('ADSB connector not available for flight data');
    }

    // Get flight history
    const flightData = await adsbConnector.execute('flight-tracking', 'get-flight-history', {
      callsign,
      registration,
      startTime,
      endTime
    });

    if (!flightData || flightData.length === 0) {
      throw new Error('No flight data found for the specified parameters');
    }

    // Create video render job
    return this.renderVideo({
      templateId,
      data: {
        flightData,
        flightId,
        callsign,
        registration,
        startTime,
        endTime
      },
      outputPath,
      duration: Math.max(10, Math.min(60, flightData.length / 10)) // Dynamic duration based on data points
    });
  }

  /**
   * Create a flight timeline video
   */
  async createFlightTimeline(parameters) {
    const {
      flightId,
      callsign,
      registration,
      startTime,
      endTime,
      templateId = 'flight-timeline',
      outputPath
    } = parameters;

    // Get flight data and events
    const adsbConnector = this.connectorRegistry?.getConnectorsByType('adsb')[0];
    if (!adsbConnector) {
      throw new Error('ADSB connector not available for flight data');
    }

    const [flightData, events] = await Promise.all([
      adsbConnector.execute('flight-tracking', 'get-flight-history', {
        callsign,
        registration,
        startTime,
        endTime
      }),
      adsbConnector.execute('smart-events', 'get-events', {
        callsign,
        registration,
        startTime,
        endTime
      })
    ]);

    return this.renderVideo({
      templateId,
      data: {
        flightData: flightData || [],
        events: events || [],
        flightId,
        callsign,
        registration,
        startTime,
        endTime
      },
      outputPath,
      duration: 30
    });
  }

  /**
   * Create an event timeline video
   */
  async createEventTimeline(parameters) {
    const {
      eventTypes,
      startTime,
      endTime,
      templateId = 'event-timeline',
      outputPath
    } = parameters;

    // Collect events from all available connectors
    const events = [];
    
    if (this.connectorRegistry) {
      const connectors = this.connectorRegistry.getConnectors();
      
      for (const connector of connectors) {
        if (connector.isCapabilityEnabled('smart-events')) {
          try {
            const connectorEvents = await connector.execute('smart-events', 'get-events', {
              eventTypes,
              startTime,
              endTime
            });
            
            if (connectorEvents) {
              events.push(...connectorEvents);
            }
          } catch (error) {
            this.logger.warn(`Failed to get events from connector ${connector.id}:`, error.message);
          }
        }
      }
    }

    // Sort events by timestamp
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return this.renderVideo({
      templateId,
      data: {
        events,
        eventTypes,
        startTime,
        endTime
      },
      outputPath,
      duration: Math.max(10, Math.min(60, events.length / 5))
    });
  }

  /**
   * Create a template
   */
  async createTemplate(parameters) {
    const {
      id,
      name,
      description,
      componentName,
      componentPath,
      width = 1920,
      height = 1080,
      dataSchema,
      dataTransform
    } = parameters;

    if (!id || !name || !componentName || !componentPath) {
      throw new Error('Template ID, name, component name, and component path are required');
    }

    const template = {
      id,
      name,
      description,
      componentName,
      componentPath,
      width,
      height,
      dataSchema,
      dataTransform,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.set(id, template);
    
    // Save template to file
    await this.saveTemplateToFile(template);

    this.emit('template-created', { templateId: id, template });

    return template;
  }

  /**
   * Save template to file
   */
  async saveTemplateToFile(template) {
    try {
      // Ensure templates directory exists
      await fs.mkdir(this.templatesDir, { recursive: true });
      
      const templatePath = path.join(this.templatesDir, `${template.id}.json`);
      await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
    } catch (error) {
      this.logger.warn(`Failed to save template to file: ${error.message}`);
      // Don't throw error, just log it - template is still in memory
    }
  }

  /**
   * List all templates
   */
  async listTemplates(parameters = {}) {
    const templates = Array.from(this.templates.values());
    
    if (parameters.filter) {
      return templates.filter(template => 
        template.name.toLowerCase().includes(parameters.filter.toLowerCase()) ||
        template.description.toLowerCase().includes(parameters.filter.toLowerCase())
      );
    }
    
    return templates;
  }

  /**
   * Get render status
   */
  async getRenderStatus(renderId) {
    const renderJob = this.activeRenders.get(renderId);
    if (!renderJob) {
      throw new Error(`Render not found: ${renderId}`);
    }
    
    return renderJob;
  }

  /**
   * Cancel a render
   */
  async cancelRender(parameters) {
    const { renderId } = parameters;
    
    const renderJob = this.activeRenders.get(renderId);
    if (!renderJob) {
      throw new Error(`Render not found: ${renderId}`);
    }
    
    if (renderJob.status === 'rendering') {
      renderJob.status = 'cancelled';
      renderJob.endTime = new Date().toISOString();
      
      // Remove from queue if still there
      const queueIndex = this.renderQueue.indexOf(renderId);
      if (queueIndex > -1) {
        this.renderQueue.splice(queueIndex, 1);
      }
      
      this.emit('render-cancelled', { renderId });
    }
    
    return { status: 'cancelled' };
  }

  /**
   * Get render statistics
   */
  getRenderStats() {
    return {
      ...this.renderStats,
      activeRenders: this.activeRenders.size,
      queuedRenders: this.renderQueue.length,
      templates: this.templates.size
    };
  }

  /**
   * Validate configuration
   */
  static validateConfig(config) {
    if (!config.id) {
      throw new Error('Connector ID is required');
    }
    
    if (config.outputDir && typeof config.outputDir !== 'string') {
      throw new Error('Output directory must be a string');
    }
    
    if (config.templatesDir && typeof config.templatesDir !== 'string') {
      throw new Error('Templates directory must be a string');
    }
    
    if (config.defaultFps && (config.defaultFps < 1 || config.defaultFps > 120)) {
      throw new Error('Default FPS must be between 1 and 120');
    }
    
    if (config.defaultDuration && (config.defaultDuration < 1 || config.defaultDuration > 3600)) {
      throw new Error('Default duration must be between 1 and 3600 seconds');
    }
    
    const validQualities = ['low', 'medium', 'high', 'ultra'];
    if (config.quality && !validQualities.includes(config.quality)) {
      throw new Error(`Quality must be one of: ${validQualities.join(', ')}`);
    }
  }

  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      name: 'Remotion Video Renderer',
      version: '1.0.0',
      description: 'Templated video rendering using Remotion with data from other connectors',
      author: 'Looking Glass Team',
      capabilities: [
        'Video rendering with Remotion',
        'Template management',
        'Data integration from other connectors',
        'Flight path visualization',
        'Event timeline creation'
      ],
      dependencies: ['remotion', '@remotion/cli', '@remotion/renderer'],
      configuration: {
        outputDir: 'Output directory for rendered videos',
        templatesDir: 'Directory for video templates',
        remotionProjectDir: 'Remotion project directory',
        defaultFps: 'Default frames per second',
        defaultDuration: 'Default video duration in seconds',
        quality: 'Default render quality (low/medium/high/ultra)',
        enableAudio: 'Enable audio in rendered videos',
        enableSubtitles: 'Enable subtitles in rendered videos'
      }
    };
  }

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = RemotionConnector;
