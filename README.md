# Babelfish Looking Glass

## Overview

Babelfish Looking Glass is a modular, real-time spatial visualization and event orchestration platform. It integrates a wide variety of systems (cameras, IoT, analytics, messaging, etc.) into a unified map-based interface, enabling live monitoring, automation, and analytics across physical and digital environments.

---

## Purpose

- **Unify disparate systems** (security, IoT, analytics, messaging, etc.) into a single, extensible platform
- **Visualize spatial data** and real-time events on interactive maps
- **Automate workflows** and event-driven actions across connectors
- **Enable rapid integration** of new systems via a connector architecture
- **Provide a modern, web-based GUI** for operators and analysts

---

## High-Level Architecture

```
+-------------------+      +-------------------+      +-------------------+
|   Connectors      | <--> |   Map System      | <--> |   Web GUI         |
| (Cameras, IoT,    |      | (Spatial, Events, |      | (User Interface,  |
|  Analytics, etc.) |      |  Integration)     |      |  Real-Time, API)  |
+-------------------+      +-------------------+      +-------------------+
```

- **Connectors**: Modular adapters for external systems (see below)
- **Map System**: Central spatial context, real-time event bus, and orchestration
- **Web GUI**: Modern web interface, now implemented as a connector
- **APIs**: REST and WebSocket endpoints for integration and automation

---

## Key Components

### 1. Connector System
- **Purpose**: Integrate external systems (cameras, MQTT, LLMs, Telegram, etc.)
- **Pattern**: Each connector is a class extending `BaseConnector`, with capability definitions
- **Auto-discovery**: New connectors are auto-registered from the `connectors/types/` directory
- **Examples**: `UnifiProtectConnector`, `MqttConnector`, `LLMConnector`, `TelegramConnector`, `WebGuiConnector`, `MapConnector`

### 2. Map System
- **Purpose**: Provide spatial context, visualization, and event integration
- **Features**: Drag-and-drop elements, real-time event overlays, zone/line/camera management
- **Connector**: Implemented as `MapConnector`, auto-registers with all other connectors
- **Integration**: Managed by `MapIntegrationService`

### 3. Web GUI (as a Connector)
- **Purpose**: Provide the main user interface for the platform
- **Pattern**: Implemented as `WebGuiConnector`, auto-registers with maps and other connectors
- **Features**: Page/component management, real-time updates, theming, navigation
- **Endpoints**: `/`, `/map/{map-id}`, `/api/gui/*`, WebSocket for real-time UI

### 4. Event & Flow System
- **Purpose**: Orchestrate automation, rules, and event-driven actions
- **Components**: `EventBus`, `RuleEngine`, `ActionFramework`, `FlowOrchestrator`
- **Features**: Rule-based automation, event publishing, action execution, flow orchestration

### 5. Analytics & Monitoring
- **Purpose**: Provide analytics, dashboards, and monitoring
- **Components**: `AnalyticsEngine`, `DashboardService`, `ZoneManager`
- **Features**: Real-time and historical analytics, dashboard widgets, zone-based metrics

### 6. API & Integration
- **REST API**: `/api/*` for all system operations
- **Map API**: `/api/map/*` for spatial and connector management
- **Analytics API**: `/api/analytics/*` for analytics endpoints
- **WebSocket**: Real-time event and UI updates

---

## Directory Structure (Key Parts)

- `connectors/` — All connector types and registry
- `services/` — Core services (map, analytics, event bus, etc.)
- `routes/` — API route handlers
- `config/` — Configuration files and defaults
- `docs/` — In-depth documentation for subsystems
- `examples/` — Example scripts for integration and automation
- `public/` — Static files for the web interface
- `test-*.js` — Test scripts for connectors and features

---

## Extending the Platform

- **Add a new connector**: Create a new file in `connectors/types/`, export a class extending `BaseConnector`, and define capabilities/metadata
- **Add a new map**: Instantiate a new `MapConnector` with a unique ID
- **Add a new UI page/component**: Use the `WebGuiConnector` API to create pages/components
- **Add automation**: Define new rules in the `RuleEngine` or flows in the `FlowOrchestrator`

---

## Documentation

- See `docs/connector-map-relationship.md` for the connector-map relationship and auto-registration system
- See `docs/` for subsystem details (analytics, flow, smart events, etc.)

---

## Status

- **Production-ready**: Modular, extensible, and supports real-time operations
- **Actively developed**: See test scripts and docs for latest features

---

## Quick Start

1. Configure connectors in `config/connectors.json`
2. Start the server: `npm start`
3. Access the web UI at `http://localhost:3000/`
4. Explore API at `/api/*` and `/api/map/*`

---

## Authors & License

- (c) Babelfish Looking Glass Team
- MIT License

## 🚀 Key Features

### 🔌 **Multi-Protocol Connectors**
- **UniFi Protect**: Real-time video streaming, motion detection, smart detection, doorbell rings
- **MQTT**: IoT device communication and automation
- **Telegram**: Real-time notifications and alerts via Telegram Bot API
- **LLM**: AI-powered automation and decision making
- **Hikvision**: IP camera integration
- **Ankke DVR**: Digital video recorder support
- **Map Connector**: Spatial configuration and real-time visualization

### 🗺️ **Real-Time Map System**
- **Spatial Configuration**: Drag-and-drop camera positioning and zone definition
- **Real-Time Visualization**: Live display of detections, events, and analytics
- **Multi-Connector Integration**: Unified view of data from all connected systems
- **Context-Aware Display**: Intelligent rendering based on connector capabilities
- **Edit & View Modes**: Toggle between configuration and monitoring modes
- **Export/Import**: Save and load spatial configurations
- **Undo/Redo**: Full history of spatial changes

### 📹 **Advanced Video & Security**
- **Real-time Video Streaming**: RTSP and HTTP video streams from UniFi Protect cameras
- **Motion Detection**: Instant notifications for motion events
- **Smart Detection**: Person, vehicle, and animal detection
- **Doorbell Integration**: Real-time doorbell ring notifications
- **Recording Management**: Access and manage video recordings
- **Camera Snapshots**: Get still images from cameras

### 🎯 **Zone Management & Analytics**
- **Multi-Zone Monitoring**: Define zones and assign cameras for area-specific monitoring
- **Cross-Zone Tracking**: Track objects and people moving between zones
- **Speed Calculations**: Automatic speed calculation for vehicles crossing zones
- **People Counting**: Real-time occupancy tracking per zone
- **Plate Recognition**: Vehicle tracking with license plate detection
- **Derived Context**: Intelligent analytics from camera events

### 📊 **Single Pane of Glass Dashboard**
- **Unified Monitoring**: All zones, cameras, and analytics in one interface
- **Real-time Updates**: Live data updates via Server-Sent Events
- **Speed Violations**: Automatic alerts for speeding vehicles
- **Occupancy Monitoring**: Live people counts across all zones
- **Event History**: Comprehensive event logging and analysis
- **Mobile Responsive**: Works on all devices

### 🔄 **Real-time Events & Automation**
- **WebSocket Binary Protocol**: High-performance real-time event streaming
- **Event Deduplication**: Prevents duplicate event processing
- **Automatic Reconnection**: Exponential backoff reconnection strategy
- **Session Management**: Automatic session handling and token refresh
- **Bootstrap Caching**: Efficient device state management

### 🏗️ **Architecture & Scalability**
- **Modular Connector System**: Easy to add new protocols and devices
- **Entity Management**: Automatic device discovery and entity creation
- **Flow Orchestration**: Complex automation workflows
- **Event Bus**: Centralized event distribution
- **Rule Engine**: Configurable automation rules

## 🚐 Communications Van Integration

The platform is specifically designed for communications van deployments with:

- **UniFi Protect Integration**: Full integration with UniFi Protect video management
- **Real-time Monitoring**: Live video feeds and event notifications
- **Mobile-Ready**: Responsive web interface for mobile devices
- **Offline Capable**: Local processing and caching
- **Multi-Camera Support**: Manage multiple cameras simultaneously
- **Zone-Based Analytics**: Context-aware monitoring for complex deployments
- **Spatial Visualization**: Real-time map interface for camera and zone management

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- UniFi Protect system (optional, for video features)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bablefish-lookingglass

# Install dependencies
npm install

# Copy environment configuration
cp env.example .env

# Edit configuration
nano .env
```

### Configuration

Edit `.env` to configure your connectors:

```env
# UniFi Protect Configuration
UNIFI_PROTECT_HOST=10.0.0.1
UNIFI_PROTECT_API_KEY=your-api-key-here
UNIFI_PROTECT_USERNAME=your-username
UNIFI_PROTECT_PASSWORD=your-password

# MQTT Configuration
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=your-mqtt-username
MQTT_PASSWORD=your-mqtt-password

# Analytics Configuration
ANALYTICS_ENABLED=true
ZONE_MANAGER_ENABLED=true
ANALYTICS_ENGINE_ENABLED=true
SPEED_CALCULATION_ENABLED=true
PEOPLE_COUNTING_ENABLED=true

# Dashboard Configuration
DASHBOARD_ENABLED=true
DASHBOARD_REFRESH_INTERVAL=5000
SPEED_ALERTS_ENABLED=true
SPEED_ALERT_THRESHOLD=100

# Map Configuration
MAP_ENABLED=true
MAP_EDIT_MODE=false
MAP_VIEW_MODE=realtime
```

### Running the Application

```bash
# Start the server
npm start

# Or run in development mode
npm run dev
```

The application will be available at `http://localhost:3000`

## 🗺️ Real-Time Map System

The real-time map system provides a sophisticated spatial interface for configuring and monitoring your IoT infrastructure:

### Accessing the Map Interface

Navigate to `http://localhost:3000/map.html` to access the interactive map interface.

### Key Features

#### Edit Mode
- **Drag & Drop**: Position cameras and define zones with intuitive controls
- **Element Creation**: Add cameras, zones, and detection lines
- **Property Editing**: Modify element properties through the properties panel
- **Grid Alignment**: Snap-to-grid for precise positioning
- **Undo/Redo**: Full history of spatial changes

#### View Mode
- **Real-Time Updates**: Live visualization of detections and events
- **Filter Controls**: Show/hide specific data types
- **Alert Overlays**: Visual indicators for events and violations
- **Analytics Display**: Real-time statistics and occupancy data

#### Multi-Connector Integration
- **Unified View**: Display data from all connected systems
- **Context Switching**: Switch between different spatial contexts
- **Cross-Connector Analytics**: Combined data visualization
- **Real-Time Streaming**: Live data from UniFi Protect, MQTT, and other connectors

### Map Connector Capabilities

The Map Connector provides four main capability categories:

#### 1. Spatial Configuration (`spatial:config`)
- Create, update, delete spatial elements
- Position and resize elements
- Duplicate existing elements
- Manage element properties

#### 2. Real-Time Visualization (`visualization:realtime`)
- Subscribe to data streams
- Filter and highlight elements
- Animate real-time events
- Display analytics data

#### 3. Connector Integration (`integration:connector`)
- Register other connectors
- Configure spatial contexts
- Query connector capabilities
- Sync connector data

#### 4. Context Management (`context:spatial`)
- Store spatial context data
- Link elements to connectors
- Export/import configurations
- Manage relationships

### Example Usage

```javascript
// Create a map connector
const mapConnector = new MapConnector({
  id: 'map-main',
  type: 'map',
  name: 'Main Map',
  description: 'Primary map for spatial visualization'
});

// Add a camera element
const camera = await mapConnector.execute('spatial:config', 'create', {
  elementType: 'camera',
  position: { x: 100, y: 200, z: 0 },
  properties: {
    name: 'Front Door Camera',
    model: 'G4 Pro',
    capabilities: ['motion', 'smartDetect']
  }
});

// Register a UniFi Protect connector
await mapConnector.execute('integration:connector', 'register', {
  connectorId: 'unifi-protect:communications-van',
  context: {
    cameras: [
      {
        id: '6814da4203251903e40156ee',
        name: 'Front Door',
        position: { x: 100, y: 200 }
      }
    ]
  }
});

// Subscribe to real-time events
await mapConnector.execute('visualization:realtime', 'subscribe', {
  dataType: 'smartDetectLine:vehicle',
  filter: { elementId: 'line-speed-trap' },
  visual: {
    animation: 'pulse',
    color: '#00ff88',
    duration: 2000
  }
});
```

## 🎯 Zone Management & Analytics

The platform provides sophisticated zone-based monitoring and analytics:

### Creating Zones
```javascript
// Create a zone
const zone = await zoneManager.createZone({
  name: 'Entry Zone',
  type: 'entry',
  description: 'Main entry point to the facility',
  location: { x: 0, y: 0 },
  active: true
});

// Assign cameras to zones
await zoneManager.assignCameraToZone('camera-001', zone.id, {
  coverage: 0.8
});
```

### Speed Calculations
The system automatically calculates vehicle speeds when the same plate is detected in different zones:

```javascript
// Speed calculation is triggered automatically
analyticsEngine.on('speed:calculated', (data) => {
  console.log(`Vehicle ${data.plateNumber} speed: ${data.speedKmh} km/h`);
  console.log(`From ${data.zone1Id} to ${data.zone2Id}`);
});
```

### People Counting
Real-time occupancy tracking per zone:

```javascript
// People count updates
analyticsEngine.on('people:counted', (data) => {
  console.log(`Zone ${data.zoneId}: ${data.count} people`);
});
```

## 📊 Dashboard Interface

Access the unified monitoring dashboard at `http://localhost:3000/dashboard.html`

### Features
- **Overview Cards**: Total zones, cameras, people count, speed violations
- **Zone Monitoring**: Real-time status and analytics for each zone
- **Recent Events**: Live event feed from all cameras
- **Active Alerts**: Speed violations and other alerts
- **Speed Violations**: Recent vehicle speed calculations
- **Real-time Updates**: Live data via Server-Sent Events

### API Endpoints

#### Zone Management
- `GET /api/analytics/zones` - List all zones
- `POST /api/analytics/zones` - Create a new zone
- `GET /api/analytics/zones/:id` - Get zone details
- `PUT /api/analytics/zones/:id` - Update zone
- `POST /api/analytics/zones/:id/cameras/:cameraId` - Assign camera to zone

#### Analytics
- `GET /api/analytics` - Get all analytics data
- `GET /api/analytics/cameras/:id` - Get camera analytics
- `GET /api/analytics/zones/:id` - Get zone analytics
- `GET /api/analytics/speed` - Get speed calculations
- `GET /api/analytics/plates/:plateNumber` - Get plate tracking data

#### Map System
- `GET /api/map/elements` - Get all spatial elements
- `POST /api/map/elements` - Create spatial element
- `PUT /api/map/elements/:id` - Update spatial element
- `DELETE /api/map/elements/:id` - Delete spatial element
- `GET /api/map/contexts` - Get connector contexts
- `POST /api/map/export` - Export map configuration
- `POST /api/map/import` - Import map configuration

#### Dashboard
- `GET /api/analytics/dashboard` - Get dashboard data
- `GET /api/analytics/dashboard/overview` - Get overview statistics
- `GET /api/analytics/dashboard/zones` - Get zones data
- `GET /api/analytics/dashboard/cameras` - Get cameras data
- `GET /api/analytics/dashboard/events` - Get recent events
- `GET /api/analytics/dashboard/alerts` - Get active alerts
- `GET /api/analytics/dashboard/realtime` - Real-time updates (SSE)

## 📹 UniFi Protect Integration

The UniFi Protect connector provides comprehensive integration with Ubiquiti's video management system:

### Real-time Video Streaming
```javascript
// Get RTSP stream URL
const rtspUrl = await connector.getStreamUrl({
  cameraId: 'camera-id',
  quality: 'high',
  format: 'rtsp'
});

// Get HTTP stream URL
const httpUrl = await connector.getStreamUrl({
  cameraId: 'camera-id',
  quality: 'medium',
  format: 'http',
  duration: 60
});
```

### Real-time Events
```javascript
// Subscribe to motion events
connector.on('event:motion', (event) => {
  console.log('Motion detected:', event.motionData);
});

// Subscribe to doorbell rings
connector.on('event:ring', (event) => {
  console.log('Doorbell ring:', event.ringData);
});

// Subscribe to smart detection
connector.on('event:smart', (event) => {
  console.log('Smart detection:', event.smartData);
});
```

### Camera Management
```javascript
// List all cameras
const cameras = await connector.listCameras();

// Get camera details
const camera = await connector.getCamera({ cameraId: 'camera-id' });

// Get camera snapshot
const snapshot = await connector.getCameraSnapshot({
  cameraId: 'camera-id',
  quality: 'high'
});
```

## 📱 Telegram Integration

The Telegram connector provides real-time notifications and alerts via Telegram Bot API:

### Setup
1. Create a Telegram bot via [@BotFather](https://t.me/botfather)
2. Add the bot to your channel: `@fhNYM0MnPJQ2NjE8`
3. Configure the bot token in `config/connectors.json`

### Automatic Notifications
The system automatically sends notifications for:
- **Motion Detection**: Real-time motion alerts with camera details
- **Smart Detection**: Person, vehicle, and animal detection alerts
- **Recording Events**: Video recording start/stop notifications
- **Connection Events**: Camera online/offline status changes
- **Camera Management**: Camera addition/removal notifications

### Message Format
```javascript
// Motion detection alert
🚨 *Motion Detected* 🚨

📹 Camera: Front Door Camera
📍 Location: Front Door
⏰ Time: 2025-01-20 15:30:00

Motion activity detected on your UniFi Protect system.

// Smart detection alert
🤖 *Smart Detection Alert* 🤖

📹 Camera: Backyard Camera
📍 Location: Backyard
🔍 Detection: Person
⏰ Time: 2025-01-20 15:30:00

Smart detection triggered on your UniFi Protect system.
```

### Testing Integration
```bash
# Test Telegram integration
node test-telegram-integration.js
```

### Manual Message Sending
```javascript
// Send text message
await telegramConnector.execute('telegram:send', 'text', {
  chatId: '@fhNYM0MnPJQ2NjE8',
  text: 'Test message from Babelfish',
  parseMode: 'Markdown'
});

// Send photo with caption
await telegramConnector.execute('telegram:send', 'photo', {
  chatId: '@fhNYM0MnPJQ2NjE8',
  photo: 'https://example.com/image.jpg',
  caption: 'Camera snapshot'
});
```

## 🔧 API Endpoints

### Connector Management
- `GET /api/connectors` - List all connectors
- `POST /api/connectors/:id/connect` - Connect to a specific connector
- `POST /api/connectors/:id/disconnect` - Disconnect from a connector
- `GET /api/connectors/:id/status` - Get connector status

### Capability Execution
- `POST /api/connectors/:id/capabilities/:capability` - Execute a capability
- `GET /api/connectors/:id/capabilities` - List available capabilities

### Entity Management
- `GET /api/entities` - List all entities
- `GET /api/entities/:id` - Get specific entity
- `POST /api/entities/discovery` - Trigger entity discovery

### Real-time Events
- `GET /api/events` - WebSocket endpoint for real-time events

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Test Zone Analytics
```bash
# Test the new zone management and analytics system
node test-zone-analytics.js
```

### Test Specific Connectors
```bash
# Test UniFi Protect integration
node test-unifi-protect-mock.js

# Test MQTT flow
node test-mqtt-flow.js

# Test LLM connector
node test-llm-connector.js
```

### Web Interface Demo
Access the UniFi Protect demo interface at:
```
http://localhost:3000
```

Access the unified dashboard at:
```
http://localhost:3000/dashboard.html
```

## 📚 Documentation

- [Connector Architecture](./docs/connector-architecture.md)
- [Flow System](./docs/flow-system.md)
- [MQTT Flow](./docs/mqtt-flow.md)
- [Connector Documentation](./docs/connectors/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [hjdhjd/unifi-protect](https://github.com/hjdhjd/unifi-protect) - UniFi Protect API implementation
- [UniFi Protect Updates API](https://github.com/hjdhjd/unifi-protect/blob/main/README.md) - Binary protocol documentation

## Features

- **Multi-Connector Support**: UniFi Protect, Hikvision, Ankke DVR, MQTT, Telegram, and LLM connectors
- **Real-time Event Processing**: WebSocket-based real-time event handling with automatic reconnection
- **Smart Detection Analytics**: Advanced analytics for person, vehicle, animal, package, and face detection
- **Zone Management**: Define and manage monitoring zones with camera assignments
- **Analytics Engine**: Speed calculations, people counting, cross-zone tracking, and pattern recognition
- **MQTT Integration**: Publish events to MQTT topics for external system integration
- **Dashboard Service**: Real-time dashboard with comprehensive monitoring data
- **Rule Engine**: Configurable rules for event processing and automation
- **Entity Management**: Automatic camera discovery and entity creation
- **REST API**: Comprehensive API for data access and system management
- **Event Deduplication**: Prevents duplicate event processing
- **Session Management**: Automatic session handling and reconnection
- **Bootstrap Caching**: Efficient device state management

## Smart Events Integration

The application provides comprehensive smart events integration with UniFi Protect cameras, offering advanced analytics and real-time processing for smart detection events.

### Smart Detection Types
- **Person Detection**: Human detection with confidence scoring and tracking
- **Vehicle Detection**: Car, truck, motorcycle detection with tracking
- **Animal Detection**: Pet and wildlife detection
- **Package Detection**: Package and object detection
- **Face Detection**: Facial recognition and detection

### Key Features
- **Confidence Analysis**: Track detection confidence levels and identify anomalies
- **Pattern Recognition**: Identify unusual detection patterns and frequency
- **Cross-Zone Tracking**: Track objects moving between monitoring zones
- **Real-time Alerts**: Immediate notifications for smart events and patterns
- **Historical Analytics**: Store and analyze detection history and trends
- **MQTT Integration**: Publish smart events to MQTT for external processing

### API Endpoints
- `GET /api/analytics/smart-detections` - Get smart detection analytics
- `GET /api/analytics/smart-detections/{cameraId}` - Get camera-specific analytics
- `GET /api/analytics/smart-patterns` - Get pattern analysis

For detailed information about smart events integration, see [Smart Events Documentation](docs/smart-events.md). 