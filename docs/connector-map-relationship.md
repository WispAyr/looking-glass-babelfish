# Connector-Map Relationship System

## Overview

The Looking Glass platform implements a sophisticated relationship system between connectors and maps, enabling unified spatial visualization and real-time monitoring across all connected systems. This document outlines the architecture, implementation, and usage patterns for production deployments.

## Core Architecture

### Web GUI as a Connector

The web interface is now implemented as a **WebGuiConnector** within the existing connector framework, providing:

- **Automatic Registration**: Self-registers with maps and other connectors
- **Unified Interface**: Serves as the primary web-based GUI for the entire platform
- **Real-Time Updates**: Provides WebSocket-based real-time UI updates
- **Component Management**: Manages pages, components, and navigation
- **Theme & Layout**: Supports customizable themes and layouts

### Map as a Connector

The map system is implemented as a **Map Connector** within the existing connector framework, providing:

- **Spatial Configuration**: Drag-and-drop positioning and zone definition
- **Real-Time Visualization**: Live display of events and analytics
- **Multi-Connector Integration**: Unified view of all connected systems
- **Context-Aware Display**: Intelligent positioning based on connector capabilities

### Relationship Model

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Connector A   │    │   Connector B   │    │   Connector C   │
│  (UniFi Protect)│    │     (MQTT)      │    │   (Telegram)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      Map Connector        │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │   Spatial Context   │  │
                    │  │   Management        │  │
                    │  └─────────────────────┘  │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │   Real-Time Data    │  │
                    │  │   Streaming         │  │
                    │  └─────────────────────┘  │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │   Visualization     │  │
                    │  │   Engine            │  │
                    │  └─────────────────────┘  │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      Web Interface        │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │   Edit Mode         │  │
                    │  │   (Configuration)   │  │
                    │  └─────────────────────┘  │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │   View Mode         │  │
                    │  │   (Monitoring)      │  │
                    │  └─────────────────────┘  │
                    └───────────────────────────┘
```

## Automatic Registration System

### WebGuiConnector Auto-Registration

The WebGuiConnector automatically registers itself with the system:

```javascript
// Auto-created during server startup
{
  id: 'web-gui',
  type: 'web-gui',
  name: 'Web GUI',
  description: 'Web-based graphical user interface',
  config: {
    webInterface: {
      enabled: true,
      port: 3000,
      host: 'localhost'
    },
    autoRegisterWithMaps: true,
    autoDiscoverConnectors: true,
    theme: 'dark',
    layout: 'default'
  }
}
```

### Map Connector Auto-Registration

The Map Connector is automatically created and configured:

```javascript
// Auto-created during server startup
{
  id: 'main-map',
  type: 'map',
  name: 'Main Map',
  description: 'Primary spatial visualization map',
  config: {
    autoRegisterConnectors: true,
    enableWebSockets: true,
    editMode: false,
    viewMode: 'realtime',
    spatialElements: [],
    connectorContexts: []
  }
}
```

### Automatic Connector Discovery

All connectors are automatically registered with maps:

1. **Server Startup**: WebGuiConnector and MapConnector are auto-created
2. **Connector Discovery**: All other connectors are automatically registered with maps
3. **Spatial Context**: Each connector provides spatial context for map integration
4. **Real-Time Updates**: WebSocket connections established for live updates

## Map UI Exposure

### Unique URL Generation

Each map creates unique URLs for web interface access:

- **Main Map**: `http://localhost:3000/map/main-map`
- **Custom Maps**: `http://localhost:3000/map/{map-id}`
- **WebSocket**: `ws://localhost:3000/ws/map/{map-id}`
- **API Endpoints**: `/api/map/{map-id}/elements`

### Web Interface Integration

The WebGuiConnector provides the web interface:

- **Primary URL**: `http://localhost:3000/` (main dashboard)
- **Map Views**: `http://localhost:3000/map/{map-id}` (specific map views)
- **Component API**: `/api/gui/components` (component management)
- **Real-Time Updates**: `ws://localhost:3000/ws/gui` (UI updates)

## Production Implementation

### MapIntegrationService

The `MapIntegrationService` manages all connector-map relationships:

```javascript
const mapIntegrationService = new MapIntegrationService(config, logger);

await mapIntegrationService.initialize({
  webGuiConnector: webGui,
  mapConnector: map,
  connectorRegistry: connectorRegistry
});
```

### Automatic Registration Flow

1. **Server Initialization**:
   ```javascript
   // Auto-create Web GUI and Map connectors
   await autoRegisterGuiAndMapConnectors();
   ```

2. **Connector Registration**:
   ```javascript
   // Auto-register all connectors with maps
   for (const connector of otherConnectors) {
     await mapIntegrationService.registerConnectorWithMap(connector, map);
   }
   ```

3. **Spatial Context Creation**:
   ```javascript
   // Each connector provides spatial context
   const spatialContext = await connector.getSpatialContext();
   await mapConnector.registerSpatialElement(spatialContext);
   ```

### Web Interface Configuration

The WebGuiConnector manages the web interface:

```javascript
// Get web interface configuration
const webConfig = webGuiConnector.getWebInterfaceConfig();
// Returns: { url, websocketUrl, pages, components, theme, layout }

// Get GUI status
const guiStatus = webGuiConnector.getGuiStatus();
// Returns: { status, pages, components, metrics, uptime }
```

## API Endpoints

### Map API (`/api/map`)

- `GET /api/map/elements` - Get all spatial elements
- `POST /api/map/elements` - Create spatial element
- `PUT /api/map/elements/:id` - Update spatial element
- `DELETE /api/map/elements/:id` - Delete spatial element
- `GET /api/map/connectors` - Get registered connectors
- `POST /api/map/connectors/:id/register` - Register connector with map
- `GET /api/map/status` - Get map status and metrics

### Web GUI API (`/api/gui`)

- `GET /api/gui/pages` - Get all GUI pages
- `POST /api/gui/pages` - Create GUI page
- `GET /api/gui/components` - Get all GUI components
- `POST /api/gui/components` - Create GUI component
- `GET /api/gui/status` - Get GUI status and metrics

## Configuration Management

### Connector Configuration

```json
{
  "connectors": [
    {
      "id": "web-gui",
      "type": "web-gui",
      "config": {
        "webInterface": {
          "enabled": true,
          "port": 3000,
          "host": "localhost"
        },
        "autoRegisterWithMaps": true,
        "theme": "dark",
        "layout": "default"
      }
    },
    {
      "id": "main-map",
      "type": "map",
      "config": {
        "autoRegisterConnectors": true,
        "enableWebSockets": true,
        "editMode": false,
        "viewMode": "realtime"
      }
    }
  ]
}
```

### Map Integration Configuration

```json
{
  "mapIntegration": {
    "autoRegisterConnectors": true,
    "enableWebSockets": true,
    "syncInterval": 5000,
    "maxRetries": 3,
    "retryDelay": 1000
  }
}
```

## Security Considerations

### Access Control

- **Map Access**: Maps require authentication for edit operations
- **API Security**: All API endpoints use proper authentication
- **WebSocket Security**: WebSocket connections are authenticated
- **CORS Configuration**: Proper CORS settings for web interface

### Data Protection

- **Spatial Data**: Spatial elements are encrypted at rest
- **Real-Time Data**: WebSocket data is encrypted in transit
- **Configuration**: Connector configurations are secured
- **Logging**: Sensitive data is not logged

## Performance Optimization

### Caching Strategy

- **Spatial Elements**: Cached for fast map rendering
- **Connector Status**: Cached for UI responsiveness
- **Real-Time Updates**: Optimized WebSocket message delivery
- **Component Rendering**: Cached component templates

### Scalability

- **Multiple Maps**: Support for multiple map instances
- **Connector Scaling**: Horizontal scaling of connectors
- **WebSocket Scaling**: WebSocket clustering support
- **Database Optimization**: Efficient spatial queries

## Monitoring and Analytics

### Map Metrics

- **Spatial Elements**: Count and types of elements
- **Connector Integration**: Number of integrated connectors
- **Real-Time Updates**: Update frequency and latency
- **User Interactions**: Map interaction analytics

### Web GUI Metrics

- **Page Views**: Page view counts and patterns
- **Component Usage**: Component render statistics
- **Real-Time Updates**: UI update performance
- **User Experience**: Theme and layout preferences

## Troubleshooting

### Common Issues

1. **Connector Not Appearing on Map**:
   - Check connector registration status
   - Verify spatial context generation
   - Review connector capabilities

2. **Web Interface Not Loading**:
   - Verify WebGuiConnector status
   - Check web interface configuration
   - Review network connectivity

3. **Real-Time Updates Not Working**:
   - Check WebSocket connections
   - Verify event propagation
   - Review connector event handling

### Debug Commands

```javascript
// Check connector status
const status = connectorRegistry.getStatus();

// Check map integration
const mapStatus = mapIntegrationService.getStatus();

// Check Web GUI status
const guiStatus = webGuiConnector.getGuiStatus();

// Check spatial elements
const elements = mapConnector.getSpatialElements();
```

## Future Enhancements

### Planned Features

- **3D Map Support**: Three-dimensional spatial visualization
- **AR/VR Integration**: Augmented and virtual reality support
- **Mobile Interface**: Mobile-optimized web interface
- **Advanced Analytics**: Machine learning-based insights
- **Multi-Tenant Support**: Multi-tenant map management

### Integration Roadmap

- **IoT Devices**: Direct IoT device integration
- **Cloud Services**: Cloud-based map hosting
- **External APIs**: Third-party service integration
- **Custom Connectors**: Plugin-based connector system

This comprehensive system provides a robust foundation for spatial visualization and real-time monitoring across all connected systems in the Looking Glass platform. 