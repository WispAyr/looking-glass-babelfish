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
- **Telegram**: Real-time notifications, alerts, and two-way communication (✅ **Recently Fixed**)
- **LLM Integration**: AI-powered automation, decision making, and natural language processing
- **Hikvision**: IP camera integration with advanced analytics
- **Ankke DVR**: Digital video recorder support and management
- **ADSB**: Aircraft tracking and aviation monitoring with squawk code analysis
- **APRS**: Amateur radio station tracking, weather data, and message monitoring with automatic map integration
- **NOTAM**: UK NOTAM data integration with geospatial analysis, proximity alerts, and temporal analysis
- **Alarm Manager**: Centralized alarm management with multi-channel notifications (✅ **New**)
- **Map Connector**: Spatial configuration and real-time visualization
- **Web GUI Connector**: Modern web interface with component system
- **Speed Calculation**: ANPR-based vehicle speed monitoring
- **GUI Designer**: Visual layout editor and component management
- **Overwatch**: Central event processing and orchestration system
- **System Visualizer**: Real-time system architecture visualization and monitoring

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
- **Squawk Code Analysis**: UK aviation squawk code integration with 442 codes categorized (✅ **Enhanced**)
- **Zone Management**: Define and monitor spatial zones for aircraft
- **Advanced Filtering**: Filter aircraft by altitude, speed, distance, type, callsign, and squawk
- **Radar Visualization**: Classic radar scope display with sweep animation
- **Emergency Monitoring**: Highlight emergency aircraft and situations
- **Data Export**: Export radar data in JSON or CSV formats
- **WebSocket Updates**: Real-time updates via WebSocket connections

### 📻 **APRS & Amateur Radio System**
- **Automatic Map Integration**: Seamless integration with map system for real-time visualization
- **Station Tracking**: Real-time tracking of APRS stations with position, course, and speed
- **Weather Data**: Live weather station data including temperature, pressure, humidity, and wind
- **Message Monitoring**: APRS text message monitoring and display
- **UK Coverage**: Focused on UK APRS network with configurable geographic bounds
- **Spatial Context**: Automatic spatial element creation for map visualization
- **Real-time Broadcasting**: Instant updates to all connected map connectors
- **Station Filtering**: Filter stations by type, activity, and geographic area
- **Weather Integration**: Weather data automatically linked to station positions
- **Performance Monitoring**: Track API calls, station counts, and system performance

### 🚨 **Alarm Management System** (✅ **New**)
- **Centralized Alarm Management**: Unified alarm handling across all connectors
- **Multi-Channel Notifications**: Telegram, MQTT, email, and custom notification channels
- **Alarm Rules Engine**: Configurable rules for alarm generation and escalation
- **Alarm History**: Comprehensive alarm logging and analysis
- **Alarm Acknowledgment**: User acknowledgment and status tracking
- **Alarm Categories**: Categorize alarms by severity, type, and source
- **Real-time Dashboard**: Live alarm status and management interface
- **Integration APIs**: REST APIs for alarm management and status

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

### 🛩️ **Aviation & Aerospace**
- **Airport Security**: Aircraft tracking, runway monitoring, and security perimeter management
- **Flight Training**: Student pilot tracking and safety monitoring
- **Emergency Response**: Search and rescue coordination with real-time aircraft data
- **Air Traffic Management**: Local airspace monitoring and traffic coordination
- **NOTAM Integration**: Real-time NOTAM data with geospatial analysis and proximity alerts
  - **Prestwick Airport Integration**: Automatic NOTAM checking for aircraft approaching, landing, and taking off
  - **Geospatial Analysis**: Query NOTAMs by location, radius, category, and priority
  - **Proximity Alerts**: Real-time alerts when aircraft approach NOTAM-affected areas
  - **Telegram Notifications**: Instant NOTAM alerts via Telegram with formatted messages (✅ **Fixed**)
  - **Temporal Analysis**: Track NOTAM validity periods and expiration
  - **UK NOTAM Archive**: Integration with UK NOTAM archive for comprehensive coverage
- **Squawk Code Monitoring**: Real-time monitoring of aviation squawk codes with emergency detection
  - **Emergency Codes**: Automatic detection of 7500 (hijacking), 7600 (radio failure), 7700 (emergency)
  - **Military Tracking**: Monitor military aircraft and operations
  - **NATO Operations**: Track NATO operations and CAOC codes
  - **ATC Integration**: Air traffic control code monitoring and analysis

### 🏭 **Industrial & Manufacturing**
- **Factory Automation**: IoT sensor integration with production line monitoring
- **Safety Compliance**: Worker safety monitoring and incident prevention
- **Quality Control**: Automated inspection and defect detection
- **Supply Chain**: Real-time tracking of materials and finished goods

### 🏠 **Smart Cities & Infrastructure**
- **Traffic Management**: Real-time traffic flow monitoring and optimization
- **Public Safety**: Emergency response coordination and incident management
- **Environmental Monitoring**: Air quality, noise, and pollution tracking
- **Utility Management**: Power, water, and waste management optimization

### 🚐 **Mobile & Communications**
- **Communications Vans**: Mobile command centers with full system capabilities
- **Event Security**: Temporary security deployments with rapid setup
- **Disaster Response**: Emergency communications and coordination systems
- **Field Operations**: Remote monitoring and control capabilities

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- SQLite3 (included with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bablefish-lookingglass
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example env.complete
   # Edit env.complete with your configuration
   ```

4. **Run setup wizard**
   ```bash
   node setup.js
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the web interface**
   ```
   http://localhost:3000
   ```

### Quick Configuration

1. **Add your first connector** (e.g., UniFi Protect):
   ```json
   {
     "id": "unifi-protect",
     "type": "unifi-protect",
     "name": "Security Cameras",
     "config": {
       "host": "192.168.1.1",
       "port": 443,
       "protocol": "https",
       "apiKey": "your-api-key"
     }
   }
   ```

2. **Configure Telegram notifications** (✅ **Now Working**):
   ```json
   {
     "id": "telegram-bot-main",
     "type": "telegram",
     "name": "Telegram Bot",
     "config": {
       "token": "your-bot-token",
       "defaultChatId": "your-chat-id"
     }
   }
   ```

3. **Configure map zones** for your deployment area

4. **Set up automation rules** for your use case

5. **Customize the dashboard** for your needs

---

## 📚 Documentation

### Core Documentation
- **[Connector System](README-connectors.md)** - Complete guide to the connector architecture
- **[Configuration Guide](docs/configuration-refactor.md)** - System configuration and setup
- **[Flow System](docs/flow-system.md)** - Automation and workflow management
- **[Map System](docs/map-system-summary.md)** - Spatial visualization and management

### Connector Documentation
- **[UniFi Protect](docs/connectors/unifi-protect.md)** - Video management integration
- **[MQTT](docs/connectors/mqtt.md)** - IoT and messaging integration
- **[Telegram](docs/connectors/telegram.md)** - Notification and communication (✅ **Updated**)
- **[ADSB](docs/connectors/adsb.md)** - Aircraft tracking and aviation
- **[APRS](docs/connectors/aprs.md)** - Amateur radio and weather data
- **[Hikvision](docs/connectors/hikvision.md)** - IP camera integration
- **[Ankke DVR](docs/connectors/ankke-dvr.md)** - DVR system integration
- **[LLM](docs/connectors/llm.md)** - AI and natural language processing
- **[Overwatch](docs/connectors/overwatch.md)** - Event processing and orchestration
- **[Alarm Manager](docs/connectors/alarm-manager.md)** - Centralized alarm management (✅ **New**)
- **[NOTAM](docs/connectors/notam.md)** - Aviation NOTAM integration

### System Documentation
- **[Analytics System](docs/analytics-system.md)** - Data analysis and reporting
- **[Health Monitoring](docs/health-monitoring.md)** - System health and performance
- **[Smart Events](docs/smart-events.md)** - Intelligent event processing
- **[Real-time Map System](docs/realtime-map-system.md)** - Spatial visualization
- **[Speed Calculation](docs/speed-calculation-system.md)** - Vehicle speed monitoring
- **[Line Crossing Detection](docs/line-crossing-speed-detection.md)** - Boundary monitoring
- **[Squawk Code Integration](docs/squawk-code-integration-summary.md)** - Aviation squawk code analysis (✅ **New**)

---

## 🔧 Development

### Project Structure
```
bablefish-lookingglass/
├── connectors/          # Connector implementations
├── config/             # Configuration files
├── docs/               # Documentation
├── middleware/         # Express middleware
├── routes/             # API routes
├── services/           # Core services
├── templates/          # UI templates
└── test-*.js          # Test files
```

### Running Tests
```bash
# Test all connectors
node test-connectors.js

# Test specific functionality
node test-unifi-protect.js
node test-adsb-connector.js
node test-speed-calculation-system.js
node test-prestwick-notam-integration.js
node test-telegram-simple.js  # ✅ Test Telegram integration
```

### Adding New Connectors
1. Create connector class in `connectors/types/`
2. Implement required methods from `BaseConnector`
3. Add configuration validation
4. Create documentation in `docs/connectors/`
5. Add test file

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for details on:
- Code style and standards
- Testing requirements
- Documentation updates
- Issue reporting

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🆘 Support

- **Documentation**: Check the docs folder for detailed guides
- **Issues**: Report bugs and feature requests via GitHub issues
- **Discussions**: Join community discussions for help and ideas

---

## 🔄 Recent Updates

### ✅ **Telegram Connector Integration Fixed**
- **Issue**: 409 Conflict error due to missing connector registration
- **Solution**: Added TelegramConnector import and registration in server.js
- **Result**: Telegram notifications now work correctly with all connectors

### ✅ **New Alarm Manager Connector**
- **Centralized alarm management** across all system components
- **Multi-channel notifications** (Telegram, MQTT, email)
- **Configurable alarm rules** and escalation
- **Real-time alarm dashboard** and management interface

### ✅ **Enhanced Squawk Code Integration**
- **442 UK squawk codes** loaded and categorized
- **Emergency code detection** (7500, 7600, 7700)
- **Military and NATO tracking** capabilities
- **Real-time event generation** for different squawk types

### ✅ **System Visualizer Enhancement**
- **Real-time system architecture** visualization
- **Multiple layout algorithms** (Force Directed, Circular, Hierarchical, Grid)
- **Live metrics and health monitoring**
- **WebSocket-based real-time updates**

---

*Babelfish Looking Glass - Unified Spatial Intelligence Platform* 