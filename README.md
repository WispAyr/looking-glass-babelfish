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

### 6. Configuration & Database System
- **Purpose**: Persistent storage and configuration management
- **Components**: `DatabaseService`, `ConfigManager`, `SetupWizard`
- **Features**: SQLite database, configuration validation, setup wizard, import/export

### 7. API & Integration
- **REST API**: `/api/*` for all system operations
- **Map API**: `/api/map/*` for spatial and connector management
- **Analytics API**: `/api/analytics/*` for analytics endpoints
- **Config API**: `/api/config/*` for configuration management
- **WebSocket**: Real-time event and UI updates

---

## Directory Structure (Key Parts)

- `connectors/` — All connector types and registry
- `services/` — Core services (map, analytics, event bus, database, config, etc.)
- `routes/` — API route handlers
- `config/` — Configuration files and defaults
- `data/` — Database files and persistent storage
- `docs/` — In-depth documentation for subsystems
- `examples/` — Example scripts for integration and automation
- `public/` — Static files for the web interface
- `test-*.js` — Test scripts for connectors and features

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
The system now uses SQLite for persistent storage of:
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

## Extending the Platform

- **Add a new connector**: Create a new file in `connectors/types/`, export a class extending `BaseConnector`, and define capabilities/metadata
- **Add a new map**: Instantiate a new `MapConnector` with a unique ID
- **Add a new UI page/component**: Use the `WebGuiConnector` API to create pages/components
- **Add automation**: Define new rules in the `RuleEngine` or flows in the `FlowOrchestrator`
- **Add configuration templates**: Extend `ConfigManager` with new template definitions

---

## Documentation

- See `docs/connector-map-relationship.md` for the connector-map relationship and auto-registration system
- See `docs/` for subsystem details (analytics, flow, smart events, etc.)

---

## Status

- **Production-ready**: Modular, extensible, and supports real-time operations
- **Database integration**: Persistent storage for configurations and data
- **Setup wizard**: Guided initial configuration
- **Actively developed**: See test scripts and docs for latest features

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
- **Database Integration**: Persistent storage and configuration management
- **Setup Wizard**: Guided initial configuration

## 🚐 Communications Van Integration

The platform is specifically designed for communications van deployments with:

- **UniFi Protect Integration**: Full integration with UniFi Protect video management
- **Real-time Monitoring**: Live video feeds and event notifications
- **Mobile-Ready**: Responsive web interface for mobile devices
- **Offline Capable**: Local processing and caching
- **Multi-Camera Support**: Manage multiple cameras simultaneously
- **Zone-Based Analytics**: Context-aware monitoring for complex deployments
- **Spatial Visualization**: Real-time map interface for camera and zone management
- **Persistent Configuration**: Database storage for reliable configuration management

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

## 🎨 GUI Configuration System 