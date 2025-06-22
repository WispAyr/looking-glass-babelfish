# Remotion Connector Event Integration

The Remotion Connector has been enhanced with comprehensive event integration capabilities, allowing for automated video generation based on system events and seamless integration with the broader event system.

## Overview

The enhanced Remotion connector provides:
- **Event-driven video rendering**: Automatically generate videos when specific events occur
- **Render lifecycle events**: Track render progress from queued to completed
- **Template-based rendering**: Use predefined templates with dynamic data
- **Data integration**: Pull data from other connectors for video content
- **Trigger management**: Configure automated rendering rules

## Event Integration Features

### 1. Event-Driven Rendering

The connector listens for specific event types and can automatically trigger video renders:

```javascript
// Smart detect events trigger timeline videos
eventBus.on('event:smartDetectZone', (event) => {
  // Automatically creates event timeline video
});

// Motion events trigger motion videos
eventBus.on('event:motion', (event) => {
  // Automatically creates motion event video
});

// Flight completion triggers flight path videos
eventBus.on('event:flight:completed', (event) => {
  // Automatically creates flight path video
});

// Speed alerts trigger context videos
eventBus.on('event:speed:alert', (event) => {
  // Automatically creates speed alert video with context
});
```

### 2. Render Lifecycle Events

The connector emits events throughout the render lifecycle:

```javascript
// Listen for render events
eventBus.on('event:render:queued', (event) => {
  console.log(`Render queued: ${event.data.renderId}`);
});

eventBus.on('event:render:started', (event) => {
  console.log(`Render started: ${event.data.renderId}`);
});

eventBus.on('event:render:progress', (event) => {
  console.log(`Progress: ${event.data.progress}% - ${event.data.stage}`);
});

eventBus.on('event:render:completed', (event) => {
  console.log(`Completed: ${event.data.outputPath}`);
  console.log(`File size: ${event.data.fileSize} bytes`);
});

eventBus.on('event:render:failed', (event) => {
  console.log(`Failed: ${event.data.error}`);
});
```

## Capabilities

### Video Rendering
- `render` - Render a video using a template
- `preview` - Generate a preview
- `cancel` - Cancel an active render
- `status` - Get render status
- `list` - List active renders

### Template Management
- `create` - Create a new template
- `update` - Update an existing template
- `delete` - Delete a template
- `list` - List all templates
- `validate` - Validate template configuration

### Render Triggers
- `add-trigger` - Add an automated render trigger
- `remove-trigger` - Remove a trigger
- `list-triggers` - List all triggers
- `enable-auto` - Enable automatic rendering
- `disable-auto` - Disable automatic rendering

### Template Rendering
- `render-template` - Render using a specific template
- `render-with-data` - Render with data from other connectors
- `render-from-event` - Render based on an event

## Usage Examples

### 1. Basic Template Rendering

```javascript
const remotion = new RemotionConnector(config);
remotion.setEventBus(eventBus);

// Render a template with data
const result = await remotion.execute('template-rendering', 'render-template', {
  templateId: 'event-timeline',
  data: {
    title: 'Security Events',
    events: [
      { type: 'motion', timestamp: '2025-06-22T10:00:00Z' },
      { type: 'smartDetectZone', timestamp: '2025-06-22T10:05:00Z' }
    ]
  },
  outputPath: './renders/security-events.mp4'
});
```

### 2. Data Integration Rendering

```javascript
// Render with data from ADSB connector
const result = await remotion.execute('template-rendering', 'render-with-data', {
  templateId: 'flight-path',
  dataSource: 'adsb-connector',
  dataQuery: {
    capability: 'flight-tracking',
    operation: 'get-flight-history',
    parameters: {
      callsign: 'BA123',
      startTime: '2025-06-22T08:00:00Z',
      endTime: '2025-06-22T10:00:00Z'
    }
  },
  outputPath: './renders/flight-ba123.mp4'
});
```

### 3. Event-Based Rendering

```javascript
// Render from an event
const result = await remotion.execute('template-rendering', 'render-from-event', {
  templateId: 'event-timeline',
  event: {
    type: 'smartDetectZone',
    data: { cameraId: 'cam1', confidence: 0.8 }
  },
  outputPath: './renders/event-video.mp4'
});
```

### 4. Automated Render Triggers

```javascript
// Add a trigger for smart detect events
await remotion.execute('render-triggers', 'add-trigger', {
  eventType: 'smartDetectZone',
  trigger: {
    id: 'smart-detect-video',
    name: 'Smart Detect Video Trigger',
    conditions: {
      confidence: { min: 0.5 }
    },
    renderParams: {
      templateId: 'event-timeline',
      outputPath: './renders/auto-smart-detect-{timestamp}.mp4',
      duration: 15
    }
  }
});

// Enable automatic rendering
await remotion.execute('render-triggers', 'enable-auto');
```

## Configuration

### Basic Configuration

```javascript
const config = {
  id: 'remotion-connector',
  type: 'remotion',
  config: {
    outputDir: './renders',
    templatesDir: './templates',
    remotionProjectDir: './remotion-project',
    defaultFps: 30,
    defaultDuration: 10,
    quality: 'medium', // low, medium, high, ultra
    autoRenderEnabled: true
  }
};
```

### Event Integration Setup

```javascript
// Set up event bus integration
remotion.setEventBus(eventBus);
remotion.setConnectorRegistry(connectorRegistry);

// Listen for render events
eventBus.on('event:render:completed', (event) => {
  // Handle completed renders
  console.log(`Video ready: ${event.data.outputPath}`);
});
```

## Template Structure

Templates define the video composition and data requirements:

```javascript
{
  id: 'event-timeline',
  name: 'Event Timeline Template',
  description: 'Event timeline visualization template',
  componentName: 'EventTimelineComponent',
  componentPath: 'EventTimelineComponent.jsx',
  width: 1920,
  height: 1080,
  dataSchema: {
    title: 'string',
    events: 'array'
  },
  dataTransform: {
    // Optional data transformation logic
  }
}
```

## Event Types

### Render Events
- `render:queued` - Render job queued
- `render:started` - Render started
- `render:progress` - Render progress update
- `render:completed` - Render completed successfully
- `render:failed` - Render failed
- `render:trigger-executed` - Trigger executed
- `render:trigger-failed` - Trigger failed

### Trigger Events
- `smartDetectZone` - Smart detection events
- `motion` - Motion detection events
- `flight:completed` - Flight completion events
- `speed:alert` - Speed alert events

## Integration with Other Connectors

The Remotion connector can integrate with other connectors to pull data:

```javascript
// Get flight data from ADSB connector
const adsbConnector = connectorRegistry.getConnectorsByType('adsb')[0];
const flightData = await adsbConnector.execute('flight-tracking', 'get-flight-history', {
  callsign: 'BA123',
  startTime: '2025-06-22T08:00:00Z',
  endTime: '2025-06-22T10:00:00Z'
});

// Use data in video render
await remotion.execute('template-rendering', 'render-template', {
  templateId: 'flight-path',
  data: { flightData },
  outputPath: './renders/flight-ba123.mp4'
});
```

## Best Practices

1. **Template Management**: Create reusable templates for common video types
2. **Event Filtering**: Use trigger conditions to avoid unnecessary renders
3. **Resource Management**: Monitor render queue and clean up completed jobs
4. **Error Handling**: Implement proper error handling for failed renders
5. **Performance**: Use appropriate quality settings for different use cases

## Testing

Use the provided test file to verify event integration:

```bash
node test-remotion-event-integration.js
```

This will test:
- Event-driven rendering
- Template rendering
- Data integration
- Render triggers
- Event emission
- File generation

## Troubleshooting

### Common Issues

1. **Templates not found**: Ensure templates are created before rendering
2. **Event bus not connected**: Call `setEventBus()` before using event features
3. **Render failures**: Check Remotion project configuration and dependencies
4. **Missing data**: Verify connector registry is set up correctly

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
const remotion = new RemotionConnector({
  ...config,
  debug: true
});
```

## Future Enhancements

- Real-time render progress streaming
- Advanced trigger conditions
- Template versioning
- Render scheduling
- Cloud rendering support
- Video post-processing pipelines 