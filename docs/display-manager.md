# Display Manager

The Display Manager is a comprehensive system for managing digital displays, views, templates, and zones. It provides real-time content distribution, layout management, and display control capabilities.

## Features

- **Display Management**: Create, configure, and control multiple displays
- **View System**: Design and apply custom layouts to displays
- **Template System**: Reusable layout templates for quick deployment
- **Zone Management**: Group displays into zones for coordinated control
- **Real-time Updates**: WebSocket-based real-time content distribution
- **Privacy Controls**: Privacy mode and blackout capabilities
- **Drag & Drop GUI**: Visual interface for creating layouts and managing displays

## Architecture

### Core Components

#### Display Manager Connector
The main connector that orchestrates all display operations:
- Display lifecycle management
- View and template storage
- WebSocket connection management
- Real-time content distribution

#### Display Clients
Individual display endpoints that receive and render content:
- WebSocket connections for real-time updates
- Content rendering and display
- Status reporting and health monitoring

#### GUI Interface
Drag-and-drop interface for visual layout creation:
- Component palette with pre-built widgets
- Grid-based layout system
- Real-time preview and testing
- Template management

## GUI Interface

### Accessing the GUI

The Display Manager GUI is available at:
```
http://localhost:3002/display/manager
```

### Features

#### Component Palette
The GUI includes a drag-and-drop component palette with:
- **Map**: Interactive map displays
- **Radar**: Radar visualization components
- **Alarms**: Alarm and alert displays
- **Status**: System status dashboards
- **Weather**: Weather information displays
- **Camera**: Camera feed displays
- **Chart**: Data visualization charts
- **Table**: Data table displays

#### Layout System
- **Grid-based Layout**: 12x6 grid system for precise positioning
- **Component Sizing**: Resize components to span multiple grid cells
- **Real-time Preview**: See changes immediately as you design
- **Responsive Design**: Layouts adapt to different display sizes

#### View Management
- **Save Views**: Save layouts as reusable views
- **Apply to Displays**: Apply views to one or multiple displays
- **Template System**: Convert views to templates for reuse
- **Version Control**: Track changes and manage view versions

### Using the GUI

1. **Open the GUI**: Navigate to `/display/manager`
2. **Select Displays**: Choose which displays to manage from the sidebar
3. **Drag Components**: Drag components from the palette to the canvas
4. **Configure Properties**: Select components to edit their properties
5. **Save and Apply**: Save your layout and apply it to displays

## API Endpoints

### GUI Endpoints

#### WebSocket Connection
```
ws://localhost:3002/display/manager
```

#### HTTP Endpoints
- `GET /display/manager` - Serve the GUI interface
- `GET /display/api/status` - Get display manager status
- `GET /display/api/displays` - Get all displays
- `GET /display/api/views` - Get all views
- `GET /display/api/templates` - Get all templates

### Display Endpoints

#### WebSocket Connection
```
ws://localhost:3002/display/{displayId}
```

#### HTTP Endpoints
- `POST /display/api/displays` - Create a new display
- `PUT /display/api/displays/:id` - Update a display
- `DELETE /display/api/displays/:id` - Delete a display
- `POST /display/api/displays/:id/activate` - Activate a display
- `POST /display/api/displays/:id/deactivate` - Deactivate a display
- `POST /display/api/displays/:id/blackout` - Blackout a display

### View Endpoints

- `POST /display/api/views` - Create a new view
- `POST /display/api/views/:id/apply` - Apply a view to displays

### Template Endpoints

- `POST /display/api/templates` - Create a new template
- `POST /display/api/templates/:id/apply` - Apply a template to displays

## WebSocket Protocol

### GUI Messages

#### Client to Server
```javascript
// Get displays list
{
  "type": "displays:get"
}

// Get templates list
{
  "type": "templates:get"
}

// Save view
{
  "type": "view:save",
  "data": {
    "name": "My View",
    "description": "A custom view",
    "layout": {
      "type": "grid",
      "components": [...]
    }
  }
}

// Apply view
{
  "type": "view:apply",
  "data": {
    "layout": {...},
    "displays": ["display1", "display2"]
  }
}
```

#### Server to Client
```javascript
// Displays list
{
  "type": "displays:list",
  "data": [...]
}

// Templates list
{
  "type": "templates:list",
  "data": [...]
}

// View saved confirmation
{
  "type": "view:saved",
  "data": {
    "viewId": "view_123",
    "success": true
  }
}

// View applied confirmation
{
  "type": "view:applied",
  "data": {
    "results": [...]
  }
}
```

### Display Messages

#### Server to Display
```javascript
// Display info
{
  "type": "display:info",
  "data": {
    "id": "display1",
    "name": "Main Display",
    "status": "active",
    "content": {...}
  }
}

// Content update
{
  "type": "content:updated",
  "data": {
    "type": "view",
    "layout": {...},
    "components": [...]
  }
}
```

#### Display to Server
```javascript
// Display ready
{
  "type": "display:ready"
}

// Display error
{
  "type": "display:error",
  "data": {
    "error": "Failed to load content"
  }
}
```

## Configuration

### Display Manager Configuration

```javascript
{
  "id": "display-manager-main",
  "type": "display-manager",
  "name": "Main Display Manager",
  "config": {
    "websocketPort": 3002,
    "maxConnections": 100,
    "heartbeatInterval": 30000,
    "displayConfig": {
      "privacyMode": false,
      "blackoutMode": false,
      "defaultTimeout": 300000
    },
    "zoneConfig": {
      "zones": ["zone1", "zone2", "zone3"]
    }
  }
}
```

### Display Configuration

```javascript
{
  "id": "display-main",
  "name": "Main Display",
  "type": "web",
  "status": "active",
  "content": {
    "type": "view",
    "layout": {
      "type": "grid",
      "components": [
        {
          "id": "comp1",
          "type": "map",
          "position": { "x": 0, "y": 0, "width": 6, "height": 3 }
        },
        {
          "id": "comp2",
          "type": "status",
          "position": { "x": 6, "y": 0, "width": 6, "height": 3 }
        }
      ]
    }
  }
}
```

## Usage Examples

### Creating a Display via API

```javascript
const displayManager = connectorRegistry.getConnector('display-manager-main');

const result = await displayManager.executeCapability('display:management', 'create', {
  name: 'New Display',
  type: 'web',
  location: 'Control Room',
  settings: {
    width: 1920,
    height: 1080
  }
});
```

### Applying a View via API

```javascript
const result = await displayManager.executeCapability('display:views', 'apply', {
  viewId: 'view_123',
  displayIds: ['display1', 'display2']
});
```

### Using the GUI

1. Open `http://localhost:3002/display/manager`
2. Drag a map component to the canvas
3. Drag a status component next to it
4. Configure component properties
5. Save the view
6. Apply to selected displays

## Testing

### Test the GUI

```bash
node test-display-manager-gui.js
```

### Test Display Creation

```javascript
const displayManager = connectorRegistry.getConnector('display-manager-main');

// Create a test display
const display = await displayManager.executeCapability('display:management', 'create', {
  name: 'Test Display',
  type: 'web',
  location: 'Test Room'
});

console.log('Created display:', display);
```

### Test View Application

```javascript
// Create a simple view
const view = await displayManager.executeCapability('display:views', 'create', {
  name: 'Test View',
  layout: {
    type: 'grid',
    components: [
      {
        id: 'test-comp',
        type: 'status',
        position: { x: 0, y: 0, width: 12, height: 6 }
      }
    ]
  }
});

// Apply to display
await displayManager.executeCapability('display:views', 'apply', {
  viewId: view.id,
  displayIds: ['test-display']
});
```

## Integration

### With Map System

The Display Manager integrates with the Map Connector to provide map components:

```javascript
// Map component configuration
{
  "id": "map-comp",
  "type": "map",
  "position": { "x": 0, "y": 0, "width": 8, "height": 4 },
  "settings": {
    "center": { "lat": 55.5074, "lng": -4.5861 },
    "zoom": 10,
    "layers": ["adsb", "aprs", "cameras"]
  }
}
```

### With Alarm System

Integration with the Alarm Manager for alert displays:

```javascript
// Alarm component configuration
{
  "id": "alarm-comp",
  "type": "alarms",
  "position": { "x": 8, "y": 0, "width": 4, "height": 4 },
  "settings": {
    "showActive": true,
    "showHistory": false,
    "autoRefresh": true
  }
}
```

### With Camera System

Integration with UniFi Protect for camera feeds:

```javascript
// Camera component configuration
{
  "id": "camera-comp",
  "type": "camera",
  "position": { "x": 0, "y": 4, "width": 6, "height": 2 },
  "settings": {
    "cameraId": "camera-123",
    "quality": "high",
    "autoplay": true
  }
}
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if Display Manager connector is running
   - Verify WebSocket port configuration
   - Check firewall settings

2. **GUI Not Loading**
   - Ensure display route is properly registered
   - Check template file exists at correct path
   - Verify server is running on correct port

3. **Displays Not Updating**
   - Check WebSocket connections are active
   - Verify display IDs match
   - Check content format is valid

4. **Components Not Rendering**
   - Verify component types are supported
   - Check component configuration
   - Ensure required services are running

### Debug Mode

Enable debug logging in the Display Manager connector:

```javascript
{
  "config": {
    "debug": true,
    "logLevel": "debug"
  }
}
```

## Future Enhancements

- **Advanced Layouts**: Support for more complex layout types
- **Component Library**: Expandable component library
- **Real-time Collaboration**: Multi-user editing capabilities
- **Mobile Support**: Mobile-optimized interface
- **Analytics**: Display usage analytics and metrics
- **Automation**: Automated display scheduling and content rotation 