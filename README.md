# Babelfish Looking Glass

## 🌟 Vision & Mission

Babelfish Looking Glass is a revolutionary **unified spatial intelligence platform** that transforms how organizations monitor, analyze, and respond to real-world events. Born from the need to break down silos between disparate security, IoT, and analytics systems, it provides a **single pane of glass** for understanding complex spatial relationships and orchestrating intelligent responses.

### Our Vision
To create a world where **every sensor, camera, and system speaks the same language**, enabling organizations to make better decisions faster through unified spatial awareness and intelligent automation.

### Core Philosophy
- **Unified Intelligence**: One platform, infinite possibilities
- **Spatial First**: Everything has a location, every location has context
- **Real-Time Everything**: Instant awareness, immediate response
- **Modular by Design**: Add capabilities without complexity
- **Open & Extensible**: Your data, your rules, your way

---

## 🎯 Purpose & Value Proposition

### The Problem We Solve
Modern organizations face a **fragmented technology landscape**:
- **Security systems** that don't talk to each other
- **IoT devices** operating in isolation
- **Analytics platforms** disconnected from real-time events
- **Manual processes** that can't scale
- **Spatial blindness** in digital systems

### Our Solution
A **unified spatial intelligence platform** that:
- **Integrates everything** - cameras, sensors, IoT, analytics, messaging
- **Visualizes spatially** - real-time maps with context-aware overlays
- **Automates intelligently** - AI-powered workflows and responses
- **Scales effortlessly** - modular architecture grows with your needs
- **Operates anywhere** - from communications vans to enterprise deployments

---

## 🏗️ High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Connectors    │◄──►│   Map System    │◄──►│   Web GUI       │
│ (UniFi, MQTT,   │    │ (Spatial,       │    │ (User Interface,│
│  Telegram,      │    │  Events,        │    │  Real-Time,     │
│  LLM, Radar,    │    │  Integration)   │    │  API)           │
│  Speed, etc.)   │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Event Bus     │    │   Analytics     │    │   Health        │
│ (Real-time      │    │   Engine        │    │   Monitor       │
│  Orchestration) │    │ (Speed, Zones,  │    │ (System Health, │
│                 │    │  People Count)  │    │  Performance)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Rule Engine   │    │   Database      │    │   Configuration │
│ (Automation,    │    │   Service       │    │   Manager       │
│  Workflows)     │    │ (SQLite,        │    │ (Templates,     │
│                 │    │  Persistence)   │    │  Validation)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🚀 Key Features & Capabilities

### 🔌 **Multi-Protocol Connector Ecosystem**
- **UniFi Protect**: Real-time video streaming, motion detection, smart detection, doorbell rings, ANPR
- **MQTT**: IoT device communication, sensor data, automation triggers
- **Telegram**: Real-time notifications, alerts, and two-way communication
- **LLM Integration**: AI-powered automation, decision making, and natural language processing
- **Hikvision**: IP camera integration with advanced analytics
- **Ankke DVR**: Digital video recorder support and management
- **ADSB**: Aircraft tracking and aviation monitoring
- **Map Connector**: Spatial configuration and real-time visualization
- **Web GUI Connector**: Modern web interface with component system
- **Speed Calculation**: ANPR-based vehicle speed monitoring
- **GUI Designer**: Visual layout editor and component management

### 🗺️ **Advanced Spatial Intelligence**
- **Real-Time Map System**: Interactive spatial visualization with drag-and-drop configuration
- **Multi-Connector Integration**: Unified view of data from all connected systems
- **Context-Aware Display**: Intelligent rendering based on connector capabilities
- **Edit & View Modes**: Toggle between configuration and monitoring modes
- **Export/Import**: Save and load spatial configurations
- **Undo/Redo**: Full history of spatial changes
- **Zone Management**: Define monitoring zones with custom rules and analytics
- **Line Crossing Detection**: Track objects crossing defined boundaries

### 📹 **Comprehensive Video & Security**
- **Real-time Video Streaming**: RTSP and HTTP video streams from multiple camera systems
- **Motion Detection**: Instant notifications for motion events with intelligent filtering
- **Smart Detection**: Person, vehicle, and animal detection with confidence scoring
- **ANPR (License Plate Recognition)**: Automatic license plate reading and tracking
- **Doorbell Integration**: Real-time doorbell ring notifications and video
- **Recording Management**: Access and manage video recordings with search capabilities
- **Camera Snapshots**: Get still images from cameras on demand
- **Multi-Camera Support**: Manage hundreds of cameras simultaneously

### 🎯 **Advanced Analytics & Intelligence**
- **Speed Calculation System**: ANPR-based vehicle speed monitoring between detection points
- **Zone-Based Analytics**: Context-aware monitoring for complex deployments
- **Cross-Zone Tracking**: Track objects and people moving between zones
- **People Counting**: Real-time occupancy tracking per zone with historical trends
- **Plate Recognition**: Vehicle tracking with license plate detection and history
- **Derived Context**: Intelligent analytics from camera events and spatial relationships
- **Real-Time Dashboards**: Live analytics with customizable widgets and metrics

### 🛩️ **Aviation & Radar System**
- **Real-time Aircraft Tracking**: Display aircraft positions, trails, and information
- **ADSB Integration**: Automatic Dependent Surveillance-Broadcast data processing
- **Zone Management**: Define and monitor spatial zones for aircraft
- **Advanced Filtering**: Filter aircraft by altitude, speed, distance, type, callsign, and squawk
- **Radar Visualization**: Classic radar scope display with sweep animation
- **Emergency Monitoring**: Highlight emergency aircraft and situations
- **Data Export**: Export radar data in JSON or CSV formats
- **WebSocket Updates**: Real-time updates via WebSocket connections

### 📊 **Unified Dashboard & Monitoring**
- **Single Pane of Glass**: All zones, cameras, and analytics in one interface
- **Real-time Updates**: Live data updates via Server-Sent Events and WebSockets
- **Speed Violations**: Automatic alerts for speeding vehicles with configurable thresholds
- **Occupancy Monitoring**: Live people counts across all zones with trends
- **Event History**: Comprehensive event logging and analysis
- **Mobile Responsive**: Works seamlessly on all devices
- **Customizable Layouts**: Drag-and-drop dashboard configuration
- **Theme Support**: Dark and light themes with custom styling

### 🔄 **Real-time Events & Automation**
- **WebSocket Binary Protocol**: High-performance real-time event streaming
- **Event Deduplication**: Prevents duplicate event processing
- **Automatic Reconnection**: Exponential backoff reconnection strategy
- **Session Management**: Automatic session handling and token refresh
- **Bootstrap Caching**: Efficient device state management
- **Rule Engine**: Configurable automation rules with complex conditions
- **Flow Orchestration**: Complex automation workflows and decision trees
- **Action Framework**: Extensible action system for automated responses

### 🏗️ **Enterprise Architecture & Scalability**
- **Modular Connector System**: Easy to add new protocols and devices
- **Entity Management**: Automatic device discovery and entity creation
- **Database Integration**: SQLite database with persistent storage
- **Configuration Management**: Centralized configuration with validation
- **Health Monitoring**: Real-time system health and performance monitoring
- **Setup Wizard**: Guided initial configuration and onboarding
- **API-First Design**: REST and WebSocket APIs for all operations
- **Security**: Built-in security with rate limiting and authentication

### 🎨 **GUI Configuration System**
- **Visual Layout Editor**: Drag-and-drop interface design
- **Component Library**: Pre-built components for common use cases
- **Real-time Preview**: See changes instantly as you design
- **Template System**: Save and reuse layout templates
- **Responsive Design**: Automatic adaptation to different screen sizes
- **Theme Management**: Customizable themes and styling
- **Component Configuration**: Visual property editors for all components
- **Undo/Redo**: Full history of design changes

### 🚐 **Communications Van Integration**
- **Mobile-Ready**: Responsive web interface for mobile devices
- **Offline Capable**: Local processing and caching for remote deployments
- **UniFi Protect Integration**: Full integration with UniFi Protect video management
- **Real-time Monitoring**: Live video feeds and event notifications
- **Zone-Based Analytics**: Context-aware monitoring for complex deployments
- **Spatial Visualization**: Real-time map interface for camera and zone management
- **Persistent Configuration**: Database storage for reliable configuration management

---

## 🎯 Use Cases & Applications

### 🏢 **Enterprise Security & Surveillance**
- **Corporate Campus Monitoring**: Unified view of security cameras, access control, and IoT sensors
- **Retail Loss Prevention**: Integration of POS systems, cameras, and analytics for theft detection
- **Manufacturing Security**: Monitor production areas, track personnel, and detect anomalies
- **Healthcare Facilities**: Patient monitoring, staff tracking, and security management
- **Educational Institutions**: Campus security, student tracking, and emergency response

### 🚗 **Transportation & Traffic Management**
- **Highway Speed Monitoring**: ANPR-based speed detection and violation tracking
- **Parking Facility Management**: Vehicle tracking, occupancy monitoring, and revenue optimization
- **Public Transit**: Real-time vehicle tracking and passenger analytics
- **Logistics & Fleet Management**: Vehicle tracking, route optimization, and delivery monitoring
- **Traffic Flow Analysis**: Real-time traffic pattern analysis and congestion detection

### 🏭 **Industrial & IoT Applications**
- **Smart Manufacturing**: Production line monitoring, quality control, and predictive maintenance
- **Warehouse Management**: Inventory tracking, personnel monitoring, and automation
- **Energy Management**: Power plant monitoring, grid management, and consumption analytics
- **Environmental Monitoring**: Air quality, weather, and pollution tracking
- **Agricultural IoT**: Crop monitoring, livestock tracking, and automated irrigation

### 🛩️ **Aviation & Aerospace**
- **Airport Operations**: Aircraft tracking, ground vehicle monitoring, and safety management
- **Flight Training**: Student pilot tracking and performance monitoring
- **Emergency Response**: Search and rescue operations with real-time aircraft tracking
- **Military Applications**: Tactical awareness and mission planning
- **Drone Operations**: UAV tracking, geofencing, and regulatory compliance

### 🚐 **Mobile & Communications Van Deployments**
- **Event Security**: Temporary security deployments with rapid setup
- **Emergency Response**: Mobile command centers with real-time situational awareness
- **Construction Site Monitoring**: Temporary security and safety monitoring
- **Film Production**: Location security and crew management
- **Military Operations**: Mobile tactical operations centers

### 🏠 **Smart Cities & Municipal**
- **City-Wide Monitoring**: Integration of traffic cameras, environmental sensors, and public safety
- **Public Safety**: Police, fire, and emergency services coordination
- **Infrastructure Monitoring**: Bridge, road, and utility monitoring
- **Public Events**: Large event security and crowd management
- **Environmental Protection**: Pollution monitoring and wildlife tracking

### 🏥 **Healthcare & Medical**
- **Hospital Security**: Patient safety, staff tracking, and emergency response
- **Medical Device Monitoring**: Equipment tracking and maintenance scheduling
- **Patient Flow Management**: Optimize patient movement and reduce wait times
- **Infection Control**: Monitor compliance with safety protocols
- **Research Facilities**: Secure monitoring of sensitive research areas

### 🎓 **Education & Research**
- **Campus Security**: Student safety, facility monitoring, and emergency response
- **Research Laboratories**: Secure monitoring of sensitive research areas
- **Student Analytics**: Attendance tracking and behavioral analysis
- **Facility Management**: Building automation and energy optimization
- **Distance Learning**: Remote classroom monitoring and engagement tracking

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- UniFi Protect system (optional, for video features)

### Installation & Setup

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd bablefish-lookingglass
   npm install
   ```

2. **Run the setup wizard**
   ```bash
   npm run setup
   ```
   
   The setup wizard will guide you through:
   - System configuration
   - Database setup
   - Connector discovery and configuration
   - UniFi Protect setup
   - MQTT configuration
   - Map and GUI settings
   - Default rules import

3. **Start the server**
   ```bash
   npm start
   ```

4. **Access the web interface**
   - Open `http://localhost:3000/` in your browser
   - Explore the API at `/api/*`
   - Access radar interface at `/radar`

### Alternative: Manual Configuration

1. **Copy environment file**
   ```bash
   cp env.example .env
   ```

2. **Edit configuration**
   - Update `.env` with your settings
   - Configure connectors in `config/connectors.json`

3. **Start the server**
   ```bash
   npm start
   ```

---

## 🔧 Configuration Management

### Database Storage
The system uses SQLite for persistent storage of:
- **Connector configurations** - All connector settings and capabilities
- **Entities** - Cameras, devices, and other discovered resources
- **Events** - Historical event data and analytics
- **Spatial elements** - Map configurations and spatial data
- **Analytics** - Speed calculations, people counts, plate tracking
- **Rules** - Automation rules and configurations
- **System configurations** - Application settings and preferences

### Configuration API
Access configuration management via REST API:

```bash
# Get all configuration templates
GET /api/config/templates

# Get configurations by category
GET /api/config/connectors
GET /api/config/maps
GET /api/config/rules

# Create/update configuration
POST /api/config/connectors/my-connector
{
  "type": "unifi-protect",
  "config": { "host": "192.168.1.100", "apiKey": "..." }
}

# Validate configuration
POST /api/config/validate
{
  "templateName": "unifi-protect",
  "config": { "host": "192.168.1.100" }
}

# Export/import configurations
GET /api/config/export
POST /api/config/import
```

### Setup Wizard API
Manage the setup process programmatically:

```bash
# Get setup status
GET /api/setup/status

# Start setup process
POST /api/setup/start

# Navigate setup steps
GET /api/setup/current
POST /api/setup/next
POST /api/setup/previous

# Submit step data
POST /api/setup/submit
{
  "data": { "host": "192.168.1.100", "apiKey": "..." }
}
```

---

## 🗄️ Database Management

### Database Statistics
```bash
GET /api/database/stats
```

### Database Cleanup
```bash
POST /api/database/cleanup
```

### Data Retention
- **Events**: 30 days (configurable)
- **Analytics**: 90 days (configurable)
- **Configurations**: Indefinite (versioned)
- **Spatial data**: Indefinite

---

## 🔄 Flow System & Automation

The platform includes a sophisticated flow system for event processing and automation.

### Core Components

#### Event Bus
- **Event Normalization**: Standardizes events from all sources
- **Event Routing**: Routes events to appropriate rules and subscribers
- **Event Storage**: Maintains event history with configurable limits
- **Real-time Broadcasting**: Sends events to WebSocket clients and MQTT

#### Rule Engine
- **Complex Conditions**: Support for multiple condition types and operators
- **Action Execution**: Execute multiple actions per rule
- **Rule Chaining**: Chain rules together for complex workflows
- **Performance Optimization**: Efficient rule matching and execution

#### Action Framework
- **Extensible Actions**: Add custom actions for specific needs
- **Action Types**: Notifications, MQTT publishing, logging, data storage
- **Error Handling**: Robust error handling and retry mechanisms
- **Context Sharing**: Share context between actions in a rule

#### Flow Orchestrator
- **Complex Workflows**: Define multi-step workflows with conditions
- **Flow Management**: Create, update, and manage flows
- **Auto-generation**: Automatically generate flows for new event types
- **Flow Statistics**: Track flow execution and performance

### API Endpoints
- `GET /api/flows/status` - Get flow system status
- `GET /api/flows` - List all flows
- `POST /api/flows` - Create new flow
- `PUT /api/flows/:id` - Update flow
- `DELETE /api/flows/:id` - Delete flow
- `POST /api/flows/:id/execute` - Execute flow manually

### Configuration
```javascript
// config/config.js
module.exports = {
  flow: {
    enabled: true,
    eventBus: {
      maxEvents: 1000,
      processingInterval: 100
    },
    ruleEngine: {
      maxRules: 100,
      executionTimeout: 30000
    },
    actionFramework: {
      maxActions: 50,
      executionTimeout: 10000
    },
    orchestrator: {
      maxFlows: 50,
      flowExecutionTimeout: 60000
    }
  }
}
```

---

## 📊 Analytics & Zone Management

The platform includes comprehensive analytics and zone management capabilities.

### Analytics Engine
- **Event Processing**: Process camera events for analytics
- **Derived Metrics**: Calculate speed, occupancy, and patterns
- **Plate Tracking**: Track vehicles across multiple detection points
- **Historical Analysis**: Store and analyze historical data
- **Real-time Dashboards**: Live analytics with customizable widgets

### Zone Manager
- **Zone Definition**: Define monitoring zones with custom properties
- **Camera Assignment**: Assign cameras to zones for coverage
- **Zone Analytics**: Track zone-specific metrics and events
- **Cross-zone Tracking**: Monitor objects moving between zones
- **Zone Templates**: Pre-defined zone types for common use cases

### Dashboard Service
- **Unified View**: Single pane of glass for all monitoring data
- **Real-time Updates**: Live data updates via Server-Sent Events
- **Alert Management**: Centralized alert generation and management
- **Performance Metrics**: Track system performance and usage
- **Customizable Layouts**: Drag-and-drop dashboard configuration

### API Endpoints
- `GET /api/analytics/stats` - Get analytics statistics
- `GET /api/analytics/zones/:zoneId` - Get zone analytics
- `GET /api/analytics/people-count` - Get people count data
- `GET /api/analytics/speed-calculations` - Get speed calculations
- `GET /api/zones` - List all zones
- `POST /api/zones` - Create new zone
- `PUT /api/zones/:id` - Update zone
- `DELETE /api/zones/:id` - Delete zone

---

## 🛩️ Radar System

The Looking Glass platform includes a comprehensive radar system for ADSB aircraft tracking and visualization.

### Features
- **Real-time Aircraft Tracking**: Display aircraft positions, trails, and information
- **Zone Management**: Define and monitor spatial zones for aircraft
- **Advanced Filtering**: Filter aircraft by altitude, speed, distance, type, callsign, and squawk
- **Radar Visualization**: Classic radar scope display with sweep animation
- **Emergency Monitoring**: Highlight emergency aircraft and situations
- **Data Export**: Export radar data in JSON or CSV formats
- **WebSocket Updates**: Real-time updates via WebSocket connections

### Access
- **Radar Interface**: `http://localhost:3000/radar`
- **Radar API**: `http://localhost:3000/radar/api/*`
- **Integration API**: `http://localhost:3000/api/radar/*`

### Configuration
```javascript
// config/config.js
module.exports = {
  radar: {
    range: 50, // nautical miles
    center: { lat: 51.5074, lon: -0.1278 }, // London
    showTrails: true,
    trailLength: 20,
    showLabels: true,
    showZones: true,
    sweepAnimation: true,
    sweepSpeed: 4, // seconds per sweep
    colorByAltitude: false,
    colorBySpeed: false,
    colorByType: false
  }
}
```

### API Endpoints

#### Radar Display
- `GET /radar/api/display` - Get current radar display data
- `POST /radar/api/configure` - Configure radar settings
- `POST /radar/api/filters` - Set radar filters

#### Aircraft Management
- `GET /radar/api/aircraft` - Get aircraft data
- `POST /radar/api/aircraft/highlight` - Highlight specific aircraft
- `GET /radar/api/aircraft/:icao24/trail` - Get aircraft trail

#### Zone Management
- `GET /radar/api/zones` - List all zones
- `POST /radar/api/zones` - Create new zone
- `PUT /radar/api/zones/:id` - Update zone
- `DELETE /radar/api/zones/:id` - Delete zone

#### Data Export
- `GET /radar/api/export?format=json` - Export as JSON
- `GET /radar/api/export?format=csv` - Export as CSV

#### Integration
- `GET /api/radar/status` - Get radar and ADSB status
- `POST /api/radar/sync-adsb` - Sync ADSB data to radar

### Zone Types
- **Parking**: Aircraft parking areas
- **Taxiway**: Aircraft taxi routes
- **Runway**: Active runways
- **Approach**: Approach paths
- **Departure**: Departure paths
- **Emergency**: Emergency areas
- **Custom**: Custom defined zones

### Testing
Run the radar system test:
```bash
node test-radar-system.js
```

---

## 🎨 GUI Configuration System

The platform includes a comprehensive GUI configuration system for creating custom interfaces.

### Features
- **Visual Layout Editor**: Drag-and-drop interface design
- **Component Library**: Pre-built components for common use cases
- **Real-time Preview**: See changes instantly as you design
- **Template System**: Save and reuse layout templates
- **Responsive Design**: Automatic adaptation to different screen sizes
- **Theme Management**: Customizable themes and styling
- **Component Configuration**: Visual property editors for all components
- **Undo/Redo**: Full history of design changes

### Component Types
- **Layout Components**: Header, sidebar, content areas
- **Data Components**: Charts, tables, gauges
- **Media Components**: Camera feeds, camera grids
- **Control Components**: Buttons, forms, controls
- **Information Components**: Status indicators, alerts
- **Map Components**: Interactive maps with markers
- **Specialized Components**: Events panels, analytics panels

### API Endpoints
- `GET /api/gui/config` - Get GUI configuration
- `GET /api/gui/pages` - Get all GUI pages
- `POST /api/gui/pages` - Create GUI page
- `GET /api/gui/components` - Get all GUI components
- `POST /api/gui/components` - Create GUI component
- `GET /api/gui/status` - Get GUI status and metrics

---

## 🏥 Health Monitoring System

The platform includes comprehensive health monitoring for system reliability.

### Features
- **System Health Checks**: Memory, CPU, disk, and connection monitoring
- **Performance Metrics**: Response times, throughput, and resource utilization
- **Alerting**: Threshold-based alerts with configurable severity levels
- **Database Health**: Query performance and connection monitoring
- **Connector Health**: Status monitoring for all connected systems
- **Real-time Metrics**: Live performance data and trends

### API Endpoints
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health status
- `GET /health/database` - Database health
- `GET /health/connectors` - Connector health
- `GET /health/metrics` - Performance metrics
- `GET /health/system` - System information
- `GET /ready` - Kubernetes readiness check
- `GET /live` - Kubernetes liveness check

### Configuration
```javascript
// config/config.js
module.exports = {
  health: {
    enabled: true,
    checkInterval: 30000, // 30 seconds
    memoryThreshold: 0.8, // 80%
    cpuThreshold: 0.7, // 70%
    diskThreshold: 0.9, // 90%
    connectionThreshold: 1000,
    errorThreshold: 100,
    alertRetention: 10
  }
}
```

---

## 🚗 Speed Calculation System

Advanced ANPR-based vehicle speed monitoring system.

### Features
- **ANPR Integration**: Automatic license plate recognition
- **Speed Calculation**: Calculate vehicle speeds between detection points
- **Real-time Alerts**: Instant speed violation notifications
- **Historical Analysis**: Speed data retention and analysis
- **Multi-lane Support**: Support for multiple lanes per detection point
- **Configurable Thresholds**: Customizable speed limits and alert levels

### API Endpoints
- `GET /api/speed/stats` - Get speed calculation statistics
- `GET /api/speed/calculations` - Get speed calculations
- `GET /api/speed/alerts` - Get speed alerts
- `GET /api/speed/tracking/:plateNumber` - Get tracking data for plate
- `GET /api/speed/detection-points` - List detection points
- `POST /api/speed/detection-points` - Register detection point
- `PUT /api/speed/detection-points/:id` - Update detection point
- `DELETE /api/speed/detection-points/:id` - Remove detection point
- `POST /api/speed/connect-unifi` - Connect to UniFi Protect
- `POST /api/speed/process-anpr` - Process ANPR event manually
- `GET /api/speed/realtime` - Real-time speed data (SSE)

### Configuration
```javascript
// config/config.js
module.exports = {
  speedCalculation: {
    enabled: true,
    minTimeBetweenDetections: 1000, // 1 second
    maxTimeBetweenDetections: 300000, // 5 minutes
    minSpeedThreshold: 5, // 5 km/h
    maxSpeedThreshold: 200, // 200 km/h
    confidenceThreshold: 0.8,
    retentionHours: 24,
    alerts: {
      enabled: true,
      threshold: 100, // km/h
      highThreshold: 120, // km/h
      mediumThreshold: 100 // km/h
    }
  }
}
```

---

## 🔌 Extending the Platform

### Adding New Connectors
Create a new file in `connectors/types/`, export a class extending `BaseConnector`, and define capabilities/metadata:

```javascript
const BaseConnector = require('../BaseConnector');

class MyCustomConnector extends BaseConnector {
  static getCapabilityDefinitions() {
    return [
      {
        id: 'my:capability',
        name: 'My Capability',
        description: 'Description of my capability',
        category: 'custom',
        operations: ['create', 'read', 'update', 'delete'],
        dataTypes: ['my-data'],
        events: ['my:event']
      }
    ];
  }
  
  async executeCapability(capabilityId, operation, parameters) {
    // Implementation
  }
}

module.exports = MyCustomConnector;
```

### Adding New Maps
Instantiate a new `MapConnector` with a unique ID:

```javascript
const mapConnector = new MapConnector({
  id: 'my-custom-map',
  name: 'My Custom Map',
  config: {
    autoRegisterConnectors: true,
    enableWebSockets: true
  }
});
```

### Adding New UI Components
Use the `WebGuiConnector` API to create pages/components:

```javascript
await webGuiConnector.execute('gui:components', 'create', {
  componentId: 'my-component',
  type: 'custom',
  data: { /* component data */ }
});
```

### Adding Automation
Define new rules in the `RuleEngine` or flows in the `FlowOrchestrator`:

```javascript
const rule = {
  id: 'my-custom-rule',
  name: 'My Custom Rule',
  conditions: { /* rule conditions */ },
  actions: [ /* rule actions */ ]
};
```

---

## 📚 Documentation

### System Documentation
- **Connector Architecture**: `docs/connector-architecture.md`
- **Connector-Map Relationship**: `docs/connector-map-relationship.md`
- **Analytics System**: `docs/analytics-system.md`
- **Flow System**: `docs/flow-system.md`
- **Smart Events**: `docs/smart-events.md`
- **Speed Calculation**: `docs/speed-calculation-system.md`
- **Health Monitoring**: `docs/health-monitoring.md`
- **Real-time Map System**: `docs/realtime-map-system.md`
- **MQTT Flow**: `docs/mqtt-flow.md`
- **Line Crossing Speed Detection**: `docs/line-crossing-speed-detection.md`

### Connector Documentation
- **ADSB**: `docs/connectors/adsb.md`
- **Ankke DVR**: `docs/connectors/ankke-dvr.md`
- **Hikvision**: `docs/connectors/hikvision.md`
- **LLM**: `docs/connectors/llm.md`
- **MQTT**: `docs/connectors/mqtt.md`
- **Telegram**: `docs/connectors/telegram.md`
- **UniFi Protect**: `docs/connectors/unifi-protect.md`

---

## 🧪 Testing

The platform includes comprehensive test scripts for all major features:

```bash
# Test individual connectors
node test-unifi-protect-connector.js
node test-mqtt-connector.js
node test-telegram-connector.js
node test-llm-connector.js

# Test system features
node test-speed-calculation-system.js
node test-radar-system.js
node test-web-gui-connector.js

# Test integrations
node test-adsb-map-integration.js
node test-map-unifi-sync.js
node test-llm-autonomous-system.js

# Test analytics and zones
node test-zone-analytics.js
```

---

## 📊 Status & Roadmap

### Current Status
- **✅ Production-ready**: Modular, extensible, and supports real-time operations
- **✅ Database integration**: Persistent storage for configurations and data
- **✅ Setup wizard**: Guided initial configuration
- **✅ Health monitoring**: Real-time system health and performance monitoring
- **✅ Speed calculation**: ANPR-based vehicle speed monitoring
- **✅ Radar system**: ADSB aircraft tracking and visualization
- **✅ GUI configuration**: Visual layout editor and component system
- **✅ Multi-connector support**: UniFi Protect, MQTT, Telegram, LLM, ADSB, and more
- **✅ Flow system**: Complete event processing and automation
- **✅ Analytics engine**: Comprehensive analytics and zone management
- **✅ Dashboard service**: Unified monitoring interface

### Planned Features
- **🔄 Machine Learning Integration**: Advanced analytics and predictive capabilities
- **🔄 Mobile Applications**: Native iOS and Android apps
- **🔄 Cloud Integration**: Multi-site synchronization and cloud backup
- **🔄 Advanced Analytics**: Business intelligence and reporting
- **🔄 API Marketplace**: Third-party integrations and extensions
- **🔄 Edge Computing**: Distributed processing for large deployments

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for details on:
- Code style and standards
- Testing requirements
- Documentation updates
- Feature proposals

---

## 📄 License

- **License**: MIT License
- **Copyright**: (c) Babelfish Looking Glass Team

---

## 🆘 Support

For support and questions:
1. Check the documentation in the `docs/` directory
2. Review example scripts in the `examples/` directory
3. Run test scripts to verify functionality
4. Check system logs for error messages
5. Open an issue on our repository

---

*Babelfish Looking Glass - Unifying the world's sensors, one connector at a time.* 🌟 