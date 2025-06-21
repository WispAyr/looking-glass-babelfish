# Real-Time Map System - Looking Glass

## Overview

The Real-Time Map System is a sophisticated, multi-functional mapping solution designed to integrate seamlessly with the Looking Glass connector architecture. It serves as both a visualization platform and a configuration interface, allowing users to create, edit, and monitor spatial relationships between cameras, zones, and detection events in real-time.

## Core Concept

The map system operates as a **Map Connector** within the existing connector framework, providing:

1. **Spatial Configuration Interface**: Drag-and-drop camera positioning and zone definition
2. **Real-Time Visualization**: Live display of detections, events, and analytics
3. **Multi-Connector Integration**: Unified view of data from all connected systems
4. **Context-Aware Display**: Intelligent rendering based on connector capabilities and data types

## Architecture Design

### Map Connector Structure

```javascript
class MapConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    // Map-specific properties
    this.mapLayers = new Map();
    this.spatialData = new Map();
    this.connectorContexts = new Map();
    this.editMode = false;
    this.viewMode = 'realtime';
    
    // Real-time data streams
    this.dataStreams = new Map();
    this.visualizationRules = new Map();
  }
}
```

### Key Capabilities

#### 1. Spatial Configuration (`spatial:config`)
- **Operations**: `create`, `update`, `delete`, `position`, `resize`
- **Data Types**: `camera`, `zone`, `line`, `polygon`, `point`
- **Events**: `element:created`, `element:updated`, `element:deleted`

#### 2. Real-Time Visualization (`visualization:realtime`)
- **Operations**: `subscribe`, `unsubscribe`, `filter`, `highlight`
- **Data Types**: `detection`, `event`, `analytics`, `status`
- **Events**: `data:updated`, `visualization:changed`, `alert:triggered`

#### 3. Connector Integration (`integration:connector`)
- **Operations**: `register`, `unregister`, `configure`, `query`
- **Data Types**: `connector:metadata`, `connector:capabilities`, `connector:data`
- **Events**: `connector:registered`, `connector:data:received`, `connector:status:changed`

#### 4. Context Management (`context:spatial`)
- **Operations**: `store`, `retrieve`, `link`, `unlink`
- **Data Types**: `context:definition`, `context:data`, `context:relationship`
- **Events**: `context:created`, `context:updated`, `context:linked`

## Spatial Data Model

### Camera Elements
```javascript
{
  id: "cam-001",
  type: "camera",
  position: { x: 100, y: 200, z: 0 },
  rotation: { x: 0, y: 0, z: 45 },
  scale: { x: 1, y: 1, z: 1 },
  metadata: {
    connectorId: "unifi-protect:communications-van",
    cameraId: "6814da4203251903e40156ee",
    name: "Front Door Camera",
    model: "G4 Pro",
    capabilities: ["motion", "smartDetect", "recording"],
    coverage: {
      fov: 120,
      range: 50,
      height: 3
    }
  },
  visual: {
    icon: "camera",
    color: "#00d4ff",
    size: 24,
    label: "Front Door"
  }
}
```

### Zone Elements
```javascript
{
  id: "zone-entry",
  type: "zone",
  geometry: {
    type: "polygon",
    coordinates: [
      [100, 200],
      [150, 200],
      [150, 250],
      [100, 250]
    ]
  },
  metadata: {
    name: "Entry Zone",
    description: "Main entry point to facility",
    connectorId: "zone-manager",
    zoneId: "entry-zone-001",
    analytics: {
      currentOccupancy: 3,
      maxOccupancy: 10,
      averageDwellTime: 120
    }
  },
  visual: {
    fillColor: "rgba(0, 212, 255, 0.2)",
    borderColor: "#00d4ff",
    borderWidth: 2,
    label: "Entry Zone (3 people)"
  }
}
```

### Detection Line Elements
```javascript
{
  id: "line-speed-trap",
  type: "detection-line",
  geometry: {
    type: "line",
    coordinates: [
      [100, 200],
      [200, 200]
    ],
    direction: "eastbound"
  },
  metadata: {
    name: "Speed Trap Line",
    connectorId: "unifi-protect:communications-van",
    cameras: ["cam-001", "cam-002"],
    detectionTypes: ["vehicle"],
    analytics: {
      totalCrossings: 45,
      averageSpeed: 35,
      violations: 3
    }
  },
  visual: {
    color: "#ff6b35",
    width: 3,
    dashArray: [5, 5],
    label: "Speed Trap (35 km/h avg)"
  }
}
```

## Connector Integration Framework

### Context Storage System
Each connector can store spatial context data that the map uses for visualization:

```javascript
// Connector registers spatial context
await mapConnector.registerContext({
  connectorId: "unifi-protect:communications-van",
  context: {
    cameras: [
      {
        id: "6814da4203251903e40156ee",
        name: "Front Door",
        position: { x: 100, y: 200 },
        capabilities: ["motion", "smartDetect"]
      }
    ],
    zones: [
      {
        id: "entry-zone",
        name: "Entry Zone",
        geometry: { type: "polygon", coordinates: [...] }
      }
    ],
    detectionLines: [
      {
        id: "speed-trap-1",
        name: "Speed Trap",
        geometry: { type: "line", coordinates: [...] }
      }
    ]
  }
});
```

### Real-Time Data Streaming
Connectors can stream real-time data to the map for visualization:

```javascript
// Connector streams detection event
await mapConnector.streamData({
  connectorId: "unifi-protect:communications-van",
  data: {
    type: "smartDetectLine",
    elementId: "line-speed-trap",
    event: {
      id: "6856d340015d1c03e434e491",
      type: "vehicle",
      timestamp: "2025-06-21T15:44:02.647Z",
      speed: 45,
      direction: "eastbound"
    }
  }
});
```

### Visualization Rules
Define how different data types should be visualized:

```javascript
// Define visualization rule for vehicle detections
await mapConnector.defineVisualizationRule({
  dataType: "smartDetectLine:vehicle",
  visual: {
    animation: "pulse",
    color: "#00ff88",
    duration: 2000,
    icon: "car",
    label: "Vehicle detected"
  },
  conditions: {
    speed: {
      operator: ">",
      value: 50,
      visual: {
        color: "#ff4757",
        animation: "flash"
      }
    }
  }
});
```

## User Interface Design

### Edit Mode
- **Drag & Drop**: Position cameras and define zones
- **Property Panel**: Edit element properties and metadata
- **Snap-to-Grid**: Precise positioning with grid alignment
- **Undo/Redo**: Full history of spatial changes
- **Save/Load**: Export and import spatial configurations

### View Mode
- **Real-Time Updates**: Live data visualization
- **Filter Controls**: Show/hide specific data types
- **Time Controls**: Historical data playback
- **Alert Overlays**: Visual indicators for events
- **Analytics Display**: Charts and statistics

### Multi-Connector View
- **Connector Toggle**: Enable/disable connector data
- **Layer Management**: Organize data by connector
- **Context Switching**: Switch between different spatial contexts
- **Cross-Connector Analytics**: Combined data visualization

## Implementation Strategy

### Phase 1: Core Map Connector
1. Implement base MapConnector class
2. Add spatial data management
3. Create basic visualization engine
4. Implement edit mode functionality

### Phase 2: Connector Integration
1. Add context storage system
2. Implement real-time data streaming
3. Create visualization rule engine
4. Add connector registration interface

### Phase 3: Advanced Features
1. Multi-connector data fusion
2. Advanced analytics visualization
3. Historical data playback
4. Export/import functionality

### Phase 4: User Experience
1. Drag-and-drop interface
2. Property editing panels
3. Real-time alerts and notifications
4. Mobile-responsive design

## Technical Specifications

### Map Rendering Engine
- **Technology**: WebGL/Three.js for 3D, Canvas 2D for 2D
- **Performance**: 60fps real-time rendering
- **Scalability**: Support for 1000+ elements
- **Interactivity**: Smooth pan, zoom, and selection

### Data Management
- **Storage**: Spatial data in memory with persistence
- **Streaming**: WebSocket-based real-time updates
- **Caching**: Intelligent data caching for performance
- **Compression**: Efficient data serialization

### Integration Points
- **Event Bus**: Subscribe to connector events
- **API Endpoints**: RESTful API for configuration
- **WebSocket**: Real-time data streaming
- **File System**: Import/export spatial configurations

## Benefits and Use Cases

### Communications Van Deployment
- **Camera Positioning**: Visual setup of camera locations
- **Zone Definition**: Define monitoring zones
- **Real-Time Monitoring**: Live view of all detections
- **Speed Analysis**: Visualize vehicle speed patterns

### Multi-Site Management
- **Site Comparison**: Compare analytics across sites
- **Standardized Layouts**: Reuse spatial configurations
- **Centralized Monitoring**: Single view of all locations

### Analytics and Reporting
- **Spatial Analytics**: Location-based insights
- **Trend Visualization**: Historical pattern analysis
- **Alert Correlation**: Spatial relationship of events

### Training and Documentation
- **Visual Documentation**: Spatial layouts as documentation
- **Training Scenarios**: Simulate different situations
- **Audit Trails**: Track changes to spatial configurations

## Future Enhancements

### AI-Powered Features
- **Automatic Layout**: AI-suggested camera positioning
- **Anomaly Detection**: Spatial pattern recognition
- **Predictive Analytics**: Forecast based on spatial data

### Advanced Visualization
- **3D Rendering**: Full 3D environment modeling
- **AR Integration**: Augmented reality overlay
- **Heat Maps**: Density and activity visualization

### Integration Expansion
- **GIS Systems**: Integration with geographic data
- **Building Management**: HVAC, lighting, access control
- **IoT Sensors**: Environmental and occupancy sensors

This real-time map system represents a significant evolution of the Looking Glass platform, providing a unified spatial interface that enhances both configuration and monitoring capabilities while maintaining the modular connector architecture that makes the system so powerful. 