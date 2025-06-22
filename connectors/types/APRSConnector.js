const BaseConnector = require('../BaseConnector');
const axios = require('axios');
const https = require('https');

/**
 * APRS Connector for aprs.fi API integration
 * 
 * Connects to aprs.fi API to fetch UK APRS data and provides real-time
 * visualization on the map system. Supports station tracking, weather data,
 * and message monitoring for amateur radio stations.
 */
class APRSConnector extends BaseConnector {
  constructor(config = {}) {
    super(config);
    
    // APRS-specific configuration
    this.apiKey = this.config.apiKey;
    this.apiUrl = 'https://api.aprs.fi/api/get';
    this.pollInterval = this.config.pollInterval || 120000; // 2 minutes default (was 30 seconds)
    this.ukBounds = this.config.ukBounds || {
      north: 60.8604,
      south: 49.1623,
      east: 1.7633,
      west: -8.6500
    };
    
    // Station tracking
    this.stations = new Map();
    this.weatherStations = new Map();
    this.messages = [];
    
    // Polling
    this.pollTimer = null;
    this.isPolling = false;
    
    // Performance tracking
    this.stats = {
      stationsTracked: 0,
      weatherReports: 0,
      messagesReceived: 0,
      apiCalls: 0,
      lastUpdate: null
    };
    
    // Map integration
    this.connectorRegistry = null;
    this.mapConnectors = new Map();
    this.spatialElements = new Map();
    
    // Validate API key
    if (!this.apiKey) {
      throw new Error('APRS API key is required');
    }
  }

  /**
   * Set connector registry reference for map integration
   */
  setConnectorRegistry(connectorRegistry) {
    this.connectorRegistry = connectorRegistry;
    
    // Listen for new map connector registrations
    if (connectorRegistry) {
      connectorRegistry.on('connector:registered', (connector) => {
        if (connector.type === 'map') {
          this.handleMapConnectorRegistered(connector);
        }
      });
    }
    
    this.logger.info('Connector registry integrated for APRS connector');
  }

  /**
   * Get spatial context for map integration
   */
  async getSpatialContext() {
    const stations = Array.from(this.stations.values());
    const weatherStations = Array.from(this.weatherStations.values());
    
    return {
      type: 'aprs',
      name: this.name,
      description: this.description,
      capabilities: this.getCapabilities(),
      spatialData: {
        stations: stations.map(station => ({
          id: station.id,
          type: 'aprs-station',
          name: station.name,
          position: {
            lat: station.lat,
            lng: station.lng
          },
          properties: {
            callsign: station.name,
            symbol: station.symbol,
            comment: station.comment,
            lastSeen: station.lastSeen,
            course: station.course,
            speed: station.speed,
            altitude: station.altitude,
            status: station.status,
            hasWeather: this.weatherStations.has(station.id)
          }
        })),
        weatherStations: weatherStations.map(weather => ({
          id: `weather-${weather.stationId}`,
          type: 'aprs-weather',
          name: `${weather.stationId} Weather`,
          position: {
            lat: this.stations.get(weather.stationId)?.lat,
            lng: this.stations.get(weather.stationId)?.lng
          },
          properties: {
            temperature: weather.temperature,
            pressure: weather.pressure,
            humidity: weather.humidity,
            windDirection: weather.windDirection,
            windSpeed: weather.windSpeed,
            timestamp: weather.timestamp
          }
        }))
      },
      bounds: this.ukBounds,
      metadata: {
        totalStations: stations.length,
        weatherStations: weatherStations.length,
        lastUpdate: this.stats.lastUpdate,
        apiCalls: this.stats.apiCalls
      }
    };
  }

  /**
   * Handle map sync updates
   */
  async handleMapSync(syncData) {
    const { elementId, changes, timestamp } = syncData;
    
    this.logger.debug('Map sync received', { elementId, changes, timestamp });
    
    // Handle map element updates if needed
    if (changes && elementId) {
      // Update spatial element if it exists
      if (this.spatialElements.has(elementId)) {
        const element = this.spatialElements.get(elementId);
        Object.assign(element, changes);
        this.spatialElements.set(elementId, element);
      }
    }
  }

  /**
   * Register with map connector
   */
  async registerWithMap(mapConnector) {
    try {
      this.mapConnectors.set(mapConnector.id, mapConnector);
      
      // Get spatial context
      const spatialContext = await this.getSpatialContext();
      
      // Register with map
      await mapConnector.execute('integration:connector', 'register', {
        connectorId: this.id,
        context: spatialContext,
        capabilities: this.getCapabilities()
      });
      
      this.logger.info(`APRS connector registered with map: ${mapConnector.id}`);
      
      // Set up event listeners for map updates
      this.setupMapEventListeners(mapConnector);
      
    } catch (error) {
      this.logger.error(`Failed to register with map ${mapConnector.id}:`, error);
      throw error;
    }
  }

  /**
   * Unregister from map connector
   */
  async unregisterFromMap(mapConnectorId) {
    const mapConnector = this.mapConnectors.get(mapConnectorId);
    if (!mapConnector) {
      return;
    }
    
    try {
      await mapConnector.execute('integration:connector', 'unregister', {
        connectorId: this.id
      });
      
      this.mapConnectors.delete(mapConnectorId);
      this.logger.info(`APRS connector unregistered from map: ${mapConnectorId}`);
      
    } catch (error) {
      this.logger.error(`Failed to unregister from map ${mapConnectorId}:`, error);
    }
  }

  /**
   * Set up event listeners for map integration
   */
  setupMapEventListeners(mapConnector) {
    // Listen for map element updates
    mapConnector.on('element:updated', async (element) => {
      if (element.metadata?.sourceConnectorId === this.id) {
        await this.handleMapSync({
          elementId: element.metadata.sourceElementId,
          changes: element.changes,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Broadcast APRS data to all connected maps
   */
  async broadcastToMaps(data) {
    for (const mapConnector of this.mapConnectors.values()) {
      try {
        mapConnector.broadcastToWebSockets({
          type: 'aprs:data',
          connectorId: this.id,
          data: data,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error(`Failed to broadcast to map ${mapConnector.id}:`, error);
      }
    }
  }

  /**
   * Get capability definitions for this connector
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'aprs:tracking',
        name: 'APRS Station Tracking',
        description: 'Track APRS stations and their locations',
        operations: ['read', 'subscribe'],
        requiresConnection: true,
        category: 'tracking'
      },
      {
        id: 'aprs:weather',
        name: 'Weather Data',
        description: 'Access weather station data from APRS',
        operations: ['read', 'subscribe'],
        requiresConnection: true,
        category: 'weather'
      },
      {
        id: 'aprs:messages',
        name: 'Message Monitoring',
        description: 'Monitor APRS text messages',
        operations: ['read', 'subscribe'],
        requiresConnection: true,
        category: 'communication'
      },
      {
        id: 'aprs:visualization',
        name: 'Map Visualization',
        description: 'Visualize APRS data on maps',
        operations: ['read', 'write'],
        requiresConnection: false,
        category: 'visualization'
      }
    ];
  }

  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters = {}) {
    switch (capabilityId) {
      case 'aprs:tracking':
        return this.executeStationTracking(operation, parameters);
      case 'aprs:weather':
        return this.executeWeatherData(operation, parameters);
      case 'aprs:messages':
        return this.executeMessageMonitoring(operation, parameters);
      case 'aprs:visualization':
        return this.executeMapVisualization(operation, parameters);
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }

  /**
   * Execute station tracking operations
   */
  async executeStationTracking(operation, parameters) {
    switch (operation) {
      case 'read':
        return this.getStations(parameters);
      case 'subscribe':
        return this.subscribeToStationUpdates(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute weather data operations
   */
  async executeWeatherData(operation, parameters) {
    switch (operation) {
      case 'read':
        return this.getWeatherData(parameters);
      case 'subscribe':
        return this.subscribeToWeatherUpdates(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute message monitoring operations
   */
  async executeMessageMonitoring(operation, parameters) {
    switch (operation) {
      case 'read':
        return this.getMessages(parameters);
      case 'subscribe':
        return this.subscribeToMessages(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute map visualization operations
   */
  async executeMapVisualization(operation, parameters) {
    switch (operation) {
      case 'read':
        return this.getVisualizationData(parameters);
      case 'write':
        return this.updateVisualization(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Perform connection to APRS API
   */
  async performConnect() {
    try {
      // Test API connection with a simple query
      try {
        const testResponse = await this.makeApiCall({
          what: 'loc',
          name: 'G0RDI', // Test with a known UK station
          apikey: this.apiKey,
          format: 'json'
        });

        if (testResponse.result !== 'ok') {
          this.logger.warn(`API test warning: ${testResponse.description}`);
        } else {
          this.logger.info('APRS API connection test successful');
        }
      } catch (error) {
        // Don't fail the entire connection if there's a rate limit or API issue
        if (error.message.includes('rate limit') || error.message.includes('Rate limited')) {
          this.logger.warn('APRS API rate limited during connection test - will retry during polling');
        } else {
          this.logger.warn(`APRS API connection test failed: ${error.message}`);
        }
      }

      this.logger.info('APRS API connection established');
      
      // Start polling for data
      this.startPolling();
      
      // Auto-register with map connectors if available
      if (this.connectorRegistry) {
        const mapConnectors = this.connectorRegistry.getConnectorsByType('map');
        for (const mapConnector of mapConnectors) {
          try {
            await this.registerWithMap(mapConnector);
          } catch (error) {
            this.logger.warn(`Failed to auto-register with map ${mapConnector.id}:`, error.message);
          }
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to APRS API', error);
      throw error;
    }
  }

  /**
   * Perform disconnection
   */
  async performDisconnect() {
    this.stopPolling();
    
    // Unregister from all map connectors
    for (const mapConnectorId of this.mapConnectors.keys()) {
      try {
        await this.unregisterFromMap(mapConnectorId);
      } catch (error) {
        this.logger.warn(`Failed to unregister from map ${mapConnectorId}:`, error.message);
      }
    }
    
    this.logger.info('APRS connector disconnected');
    return true;
  }

  /**
   * Start polling for APRS data
   */
  startPolling() {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.pollTimer = setInterval(() => {
      this.pollAPRSData();
    }, this.pollInterval);

    this.logger.info('APRS polling started');
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
    this.logger.info('APRS polling stopped');
  }

  /**
   * Poll APRS data from the API
   */
  async pollAPRSData() {
    try {
      this.stats.apiCalls++;
      
      // Get UK stations
      await this.fetchUKStations();
      
      // Get weather data for weather stations
      await this.fetchWeatherData();
      
      this.stats.lastUpdate = new Date().toISOString();
      
      this.emit('data:updated', {
        connectorId: this.id,
        timestamp: this.stats.lastUpdate,
        stationsCount: this.stations.size,
        weatherStationsCount: this.weatherStations.size
      });
      
    } catch (error) {
      this.logger.error('Error polling APRS data', error);
      this.stats.errors++;
    }
  }

  /**
   * Fetch UK APRS stations
   */
  async fetchUKStations() {
    try {
      // Try multiple search strategies to find active stations
      
      // Strategy 1: Search for recent activity in UK area
      const recentResponse = await this.makeApiCall({
        what: 'loc',
        name: 'G0', // Search for G0 prefix stations (UK)
        apikey: this.apiKey,
        format: 'json',
        how: 'l' // Include recent activity
      });

      if (recentResponse.result === 'ok' && recentResponse.entries) {
        for (const entry of recentResponse.entries) {
          // Filter to UK bounds
          if (this.isInUKBounds(entry.lat, entry.lng)) {
            await this.processStationData(entry);
          }
        }
      }

      // Add delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Strategy 2: Search for weather stations in UK
      const weatherResponse = await this.makeApiCall({
        what: 'wx',
        name: 'G0', // Search for G0 prefix weather stations
        apikey: this.apiKey,
        format: 'json'
      });

      if (weatherResponse.result === 'ok' && weatherResponse.entries) {
        for (const entry of weatherResponse.entries) {
          // Filter to UK bounds
          if (this.isInUKBounds(entry.lat, entry.lng)) {
            await this.processStationData(entry);
          }
        }
      }

      // Add delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Strategy 3: Search for any recent activity in broader area
      if (this.stations.size === 0) {
        const broadResponse = await this.makeApiCall({
          what: 'loc',
          name: 'G', // Search for any G prefix (UK)
          apikey: this.apiKey,
          format: 'json',
          how: 'l', // Include recent activity
          limit: 100 // Get more results
        });

        if (broadResponse.result === 'ok' && broadResponse.entries) {
          for (const entry of broadResponse.entries) {
            // Filter to UK bounds
            if (this.isInUKBounds(entry.lat, entry.lng)) {
              await this.processStationData(entry);
            }
          }
        }
      }

      // Strategy 4: If still no stations, try searching for specific known UK stations
      if (this.stations.size === 0) {
        const knownStations = ['G0RDI', 'G4FON', 'G8IMZ', 'G0GJV', 'G4ZFE'];
        
        for (const station of knownStations) {
          try {
            const stationResponse = await this.makeApiCall({
              what: 'loc',
              name: station,
              apikey: this.apiKey,
              format: 'json'
            });

            if (stationResponse.result === 'ok' && stationResponse.entries) {
              for (const entry of stationResponse.entries) {
                if (this.isInUKBounds(entry.lat, entry.lng)) {
                  await this.processStationData(entry);
                }
              }
            }

            // Add delay between individual station queries
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            this.logger.warn(`Failed to query station ${station}: ${error.message}`);
          }
        }
      }

    } catch (error) {
      this.logger.error('Error fetching UK stations', error);
    }
  }

  /**
   * Fetch weather data
   */
  async fetchWeatherData() {
    try {
      // Get weather data for known weather stations
      const weatherStations = Array.from(this.stations.values())
        .filter(station => station.type === 'w' || station.hasWeather);

      if (weatherStations.length > 0) {
        const stationNames = weatherStations.map(s => s.name).join(',');
        
        const response = await this.makeApiCall({
          what: 'wx',
          name: stationNames,
          apikey: this.apiKey,
          format: 'json'
        });

        if (response.result === 'ok' && response.entries) {
          for (const entry of response.entries) {
            await this.processWeatherData(entry);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error fetching weather data', error);
    }
  }

  /**
   * Process station data
   */
  async processStationData(entry) {
    const station = {
      id: entry.name,
      name: entry.name,
      type: entry.type,
      lat: parseFloat(entry.lat),
      lng: parseFloat(entry.lng),
      symbol: entry.symbol,
      comment: entry.comment,
      lastSeen: new Date(parseInt(entry.lasttime) * 1000),
      course: entry.course ? parseFloat(entry.course) : null,
      speed: entry.speed ? parseFloat(entry.speed) : null,
      altitude: entry.altitude ? parseFloat(entry.altitude) : null,
      status: entry.status,
      path: entry.path,
      phg: entry.phg
    };

    const existingStation = this.stations.get(station.id);
    this.stations.set(station.id, station);

    // Create or update spatial element for map
    const spatialElement = {
      id: `aprs-${station.id}`,
      type: 'aprs-station',
      name: station.name,
      position: {
        lat: station.lat,
        lng: station.lng
      },
      properties: {
        callsign: station.name,
        symbol: station.symbol,
        comment: station.comment,
        lastSeen: station.lastSeen,
        course: station.course,
        speed: station.speed,
        altitude: station.altitude,
        status: station.status,
        hasWeather: this.weatherStations.has(station.id)
      },
      metadata: {
        sourceConnectorId: this.id,
        sourceElementId: station.id,
        timestamp: new Date().toISOString()
      }
    };
    
    this.spatialElements.set(spatialElement.id, spatialElement);

    if (!existingStation) {
      // New station
      this.stats.stationsTracked++;
      this.emit('station:appeared', station);
      
      // Broadcast new station to maps
      await this.broadcastToMaps({
        type: 'station:appeared',
        station: spatialElement
      });
    } else {
      // Updated station
      this.emit('station:updated', { old: existingStation, new: station });
      
      // Broadcast station update to maps
      await this.broadcastToMaps({
        type: 'station:updated',
        station: spatialElement,
        changes: {
          position: spatialElement.position,
          properties: spatialElement.properties
        }
      });
    }

    // Emit map visualization data
    this.emit('visualization:station', this.formatStationForMap(station));
  }

  /**
   * Process weather data
   */
  async processWeatherData(entry) {
    const weatherData = {
      stationId: entry.name,
      timestamp: new Date(parseInt(entry.time) * 1000),
      temperature: entry.temp ? parseFloat(entry.temp) : null,
      pressure: entry.pressure ? parseFloat(entry.pressure) : null,
      humidity: entry.humidity ? parseFloat(entry.humidity) : null,
      windDirection: entry.wind_direction ? parseFloat(entry.wind_direction) : null,
      windSpeed: entry.wind_speed ? parseFloat(entry.wind_speed) : null,
      windGust: entry.wind_gust ? parseFloat(entry.wind_gust) : null,
      rain1h: entry.rain_1h ? parseFloat(entry.rain_1h) : null,
      rain24h: entry.rain_24h ? parseFloat(entry.rain_24h) : null,
      rainMn: entry.rain_mn ? parseFloat(entry.rain_mn) : null,
      luminosity: entry.luminosity ? parseFloat(entry.luminosity) : null
    };

    this.weatherStations.set(entry.name, weatherData);
    this.stats.weatherReports++;

    // Get associated station for position
    const station = this.stations.get(entry.name);
    
    // Create or update spatial element for weather
    const spatialElement = {
      id: `aprs-weather-${weatherData.stationId}`,
      type: 'aprs-weather',
      name: `${weatherData.stationId} Weather`,
      position: station ? {
        lat: station.lat,
        lng: station.lng
      } : null,
      properties: {
        temperature: weatherData.temperature,
        pressure: weatherData.pressure,
        humidity: weatherData.humidity,
        windDirection: weatherData.windDirection,
        windSpeed: weatherData.windSpeed,
        timestamp: weatherData.timestamp
      },
      metadata: {
        sourceConnectorId: this.id,
        sourceElementId: weatherData.stationId,
        timestamp: new Date().toISOString()
      }
    };
    
    this.spatialElements.set(spatialElement.id, spatialElement);

    this.emit('weather:updated', weatherData);
    
    // Broadcast weather update to maps
    await this.broadcastToMaps({
      type: 'weather:updated',
      weather: spatialElement
    });
    
    this.emit('visualization:weather', this.formatWeatherForMap(weatherData));
  }

  /**
   * Make API call to aprs.fi
   */
  async makeApiCall(params) {
    try {
      const response = await axios.get(this.apiUrl, {
        params: {
          ...params,
          apikey: this.apiKey
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Babelfish-LookingGlass/1.0 (+https://github.com/your-repo)'
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false // Ignore SSL certificate validation
        })
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        // Check for rate limiting
        if (error.response.data && error.response.data.code === 'ratelimit') {
          this.logger.warn('APRS API rate limited, waiting 60 seconds before retry');
          // Wait 60 seconds before allowing another call
          await new Promise(resolve => setTimeout(resolve, 60000));
          throw new Error('Rate limited - please wait before retrying');
        }
        throw new Error(`API Error: ${error.response.status} - ${error.response.data}`);
      } else {
        throw new Error(`Network Error: ${error.message}`);
      }
    }
  }

  /**
   * Check if coordinates are within UK bounds
   */
  isInUKBounds(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    return latNum >= this.ukBounds.south && 
           latNum <= this.ukBounds.north && 
           lngNum >= this.ukBounds.west && 
           lngNum <= this.ukBounds.east;
  }

  /**
   * Format station data for map visualization
   */
  formatStationForMap(station) {
    return {
      id: `aprs-${station.id}`,
      type: 'aprs-station',
      name: station.name,
      position: {
        lat: station.lat,
        lng: station.lng
      },
      properties: {
        symbol: station.symbol,
        comment: station.comment,
        lastSeen: station.lastSeen,
        course: station.course,
        speed: station.speed,
        altitude: station.altitude,
        status: station.status
      },
      style: {
        color: this.getStationColor(station),
        size: 8,
        opacity: 0.8
      }
    };
  }

  /**
   * Format weather data for map visualization
   */
  formatWeatherForMap(weatherData) {
    const station = this.stations.get(weatherData.stationId);
    if (!station) return null;

    return {
      id: `aprs-weather-${weatherData.stationId}`,
      type: 'aprs-weather',
      name: `${weatherData.stationId} Weather`,
      position: {
        lat: station.lat,
        lng: station.lng
      },
      properties: {
        temperature: weatherData.temperature,
        pressure: weatherData.pressure,
        humidity: weatherData.humidity,
        windDirection: weatherData.windDirection,
        windSpeed: weatherData.windSpeed,
        timestamp: weatherData.timestamp
      },
      style: {
        color: this.getWeatherColor(weatherData),
        size: 6,
        opacity: 0.9
      }
    };
  }

  /**
   * Get station color based on type and status
   */
  getStationColor(station) {
    if (station.status && station.status.includes('EMERGENCY')) {
      return '#ff0000'; // Red for emergency
    }
    
    switch (station.type) {
      case 'l': return '#00ff00'; // Green for APRS station
      case 'w': return '#0000ff'; // Blue for weather station
      case 'i': return '#ffff00'; // Yellow for item
      case 'o': return '#ff00ff'; // Magenta for object
      default: return '#cccccc'; // Gray for unknown
    }
  }

  /**
   * Get weather color based on conditions
   */
  getWeatherColor(weatherData) {
    if (weatherData.temperature !== null) {
      if (weatherData.temperature < 0) return '#0000ff'; // Blue for cold
      if (weatherData.temperature > 25) return '#ff0000'; // Red for hot
      return '#00ff00'; // Green for moderate
    }
    return '#888888'; // Gray for no temperature data
  }

  /**
   * Get all stations
   */
  getStations(parameters = {}) {
    let stations = Array.from(this.stations.values());
    
    // Apply filters
    if (parameters.type) {
      stations = stations.filter(s => s.type === parameters.type);
    }
    
    if (parameters.active) {
      const cutoff = new Date(Date.now() - 3600000); // 1 hour
      stations = stations.filter(s => s.lastSeen > cutoff);
    }
    
    return stations;
  }

  /**
   * Get weather data
   */
  getWeatherData(parameters = {}) {
    let weatherData = Array.from(this.weatherStations.values());
    
    if (parameters.stationId) {
      weatherData = weatherData.filter(w => w.stationId === parameters.stationId);
    }
    
    return weatherData;
  }

  /**
   * Get messages
   */
  getMessages(parameters = {}) {
    return this.messages;
  }

  /**
   * Get visualization data for map integration
   */
  getVisualizationData(parameters = {}) {
    const { type = 'all' } = parameters;
    
    const data = {
      stations: [],
      weatherStations: [],
      spatialElements: Array.from(this.spatialElements.values()),
      stats: this.stats,
      bounds: this.ukBounds,
      timestamp: new Date().toISOString()
    };

    if (type === 'all' || type === 'stations') {
      data.stations = Array.from(this.stations.values()).map(station => 
        this.formatStationForMap(station)
      );
    }

    if (type === 'all' || type === 'weather') {
      data.weatherStations = Array.from(this.weatherStations.values()).map(weather => 
        this.formatWeatherForMap(weather)
      );
    }

    return data;
  }

  /**
   * Get connector statistics
   */
  getStats() {
    return {
      ...this.stats,
      status: this.status,
      isPolling: this.isPolling,
      stationsCount: this.stations.size,
      weatherStationsCount: this.weatherStations.size,
      messagesCount: this.messages.length
    };
  }

  /**
   * Validate configuration
   */
  static validateConfig(config) {
    const errors = [];
    
    if (!config.apiKey) {
      errors.push('API key is required');
    }
    
    if (config.pollInterval && (config.pollInterval < 5000 || config.pollInterval > 300000)) {
      errors.push('Poll interval must be between 5 and 300 seconds');
    }
    
    return errors;
  }

  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      name: 'APRS Connector',
      description: 'APRS.fi API integration for UK amateur radio station tracking',
      version: '1.0.0',
      author: 'Babelfish LookingGlass',
      capabilities: [
        'aprs:tracking',
        'aprs:weather', 
        'aprs:messages',
        'aprs:visualization'
      ],
      configSchema: {
        apiKey: { type: 'string', required: true, description: 'APRS.fi API key' },
        pollInterval: { type: 'number', default: 30000, description: 'Polling interval in milliseconds' },
        ukBounds: { type: 'object', description: 'UK geographic bounds' }
      }
    };
  }

  /**
   * Handle new map connector registration
   */
  async handleMapConnectorRegistered(mapConnector) {
    if (this.isConnected && mapConnector.type === 'map') {
      try {
        await this.registerWithMap(mapConnector);
      } catch (error) {
        this.logger.warn(`Failed to register with new map ${mapConnector.id}:`, error.message);
      }
    }
  }
}

module.exports = APRSConnector; 