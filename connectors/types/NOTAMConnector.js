const BaseConnector = require('../BaseConnector');
const axios = require('axios');
const xml2js = require('xml2js');
const https = require('https');

/**
 * NOTAM Connector for UK NOTAM data integration
 * 
 * Connects to the UK NOTAM archive XML feed to fetch NOTAM data and provides
 * geospatial visualization on the map system. Supports NOTAM tracking,
 * proximity alerts, and temporal analysis.
 */
class NOTAMConnector extends BaseConnector {
  constructor(config = {}) {
    super(config);
    
    // NOTAM-specific configuration
    this.notamUrl = this.config.notamUrl || 'https://raw.githubusercontent.com/Jonty/uk-notam-archive/main/data/PIB.xml';
    this.pollInterval = this.config.pollInterval || 1200000; // 20 minutes default
    this.ukBounds = this.config.ukBounds || {
      north: 60.8604,
      south: 49.1623,
      east: 1.7633,
      west: -8.6500
    };
    
    // NOTAM data storage
    this.notams = new Map();
    this.activeNotams = new Map();
    this.expiredNotams = new Map();
    
    // Spatial data for map integration
    this.spatialElements = new Map();
    this.spatialIndex = new Map();
    
    // Polling
    this.pollTimer = null;
    this.isPolling = false;
    
    // Performance tracking
    this.stats = {
      totalNotams: 0,
      activeNotams: 0,
      expiredNotams: 0,
      apiCalls: 0,
      lastUpdate: null,
      parseErrors: 0
    };
    
    // Map integration
    this.connectorRegistry = null;
    this.mapConnectors = new Map();
    
    // XML parser - configured for lenient parsing
    this.xmlParser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      strict: false,
      ignoreAttrs: false,
      attrNameProcessors: [xml2js.processors.stripPrefix],
      tagNameProcessors: [xml2js.processors.stripPrefix],
      valueProcessors: [xml2js.processors.parseBooleans, xml2js.processors.parseNumbers],
      emptyTag: null,
      explicitChildren: false,
      childkey: 'children',
      charsAsChildren: false,
      includeWhiteChars: false,
      async: false,
      explicitRoot: true,
      normalize: true,
      normalizeTags: false,
      trim: true
    });
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
    
    this.logger.info('Connector registry integrated for NOTAM connector');
  }

  /**
   * Get spatial context for map integration
   */
  async getSpatialContext() {
    const activeNotams = Array.from(this.activeNotams.values());
    
    return {
      type: 'notam',
      name: this.name,
      description: this.description,
      capabilities: this.getCapabilities(),
      spatialData: {
        notams: activeNotams.map(notam => ({
          id: notam.id,
          type: 'notam',
          name: notam.title || `NOTAM ${notam.notamNumber}`,
          position: notam.position,
          properties: {
            notamNumber: notam.notamNumber,
            title: notam.title,
            description: notam.description,
            startTime: notam.startTime,
            endTime: notam.endTime,
            status: notam.status,
            category: notam.category,
            priority: notam.priority,
            affectedArea: notam.affectedArea
          }
        }))
      },
      bounds: this.ukBounds,
      metadata: {
        totalNotams: this.stats.totalNotams,
        activeNotams: this.stats.activeNotams,
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
      
      this.logger.info(`NOTAM connector registered with map: ${mapConnector.id}`);
      
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
      this.logger.info(`NOTAM connector unregistered from map: ${mapConnectorId}`);
      
    } catch (error) {
      this.logger.error(`Failed to unregister from map ${mapConnectorId}:`, error);
    }
  }

  /**
   * Setup event listeners for map connector
   */
  setupMapEventListeners(mapConnector) {
    mapConnector.on('element:updated', (data) => {
      this.handleMapSync({
        elementId: data.elementId,
        changes: data.changes,
        timestamp: new Date().toISOString()
      });
    });
    
    mapConnector.on('element:deleted', (data) => {
      this.spatialElements.delete(data.elementId);
    });
  }

  /**
   * Broadcast NOTAM data to all registered maps
   */
  async broadcastToMaps(data) {
    for (const [mapId, mapConnector] of this.mapConnectors) {
      try {
        await mapConnector.execute('integration:data', 'update', {
          connectorId: this.id,
          data: data
        });
      } catch (error) {
        this.logger.error(`Failed to broadcast to map ${mapId}:`, error);
      }
    }
  }

  /**
   * Get capability definitions
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'notam:tracking',
        name: 'NOTAM Tracking',
        description: 'Track and monitor NOTAM data',
        operations: ['read', 'list', 'get'],
        requiresConnection: false
      },
      {
        id: 'notam:geospatial',
        name: 'Geospatial Analysis',
        description: 'Convert NOTAM data to geospatial format',
        operations: ['convert', 'analyze', 'query'],
        requiresConnection: false
      },
      {
        id: 'notam:proximity',
        name: 'Proximity Alerts',
        description: 'Generate alerts when aircraft approach NOTAM areas',
        operations: ['monitor', 'alert', 'check'],
        requiresConnection: false
      },
      {
        id: 'notam:temporal',
        name: 'Temporal Analysis',
        description: 'Analyze NOTAM temporal patterns and validity',
        operations: ['analyze', 'validate', 'expire'],
        requiresConnection: false
      },
      {
        id: 'notam:map:visualization',
        name: 'Map Visualization',
        description: 'Display NOTAM data on maps',
        operations: ['display', 'update', 'remove'],
        requiresConnection: false
      }
    ];
  }

  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters = {}) {
    switch (capabilityId) {
      case 'notam:tracking':
        return await this.executeNOTAMTracking(operation, parameters);
      case 'notam:geospatial':
        return await this.executeGeospatialAnalysis(operation, parameters);
      case 'notam:proximity':
        return await this.executeProximityAlerts(operation, parameters);
      case 'notam:temporal':
        return await this.executeTemporalAnalysis(operation, parameters);
      case 'notam:map:visualization':
        return await this.executeMapVisualization(operation, parameters);
      default:
        throw new Error(`Unknown capability: ${capabilityId}`);
    }
  }

  /**
   * Execute NOTAM tracking operations
   */
  async executeNOTAMTracking(operation, parameters) {
    switch (operation) {
      case 'read':
        return await this.fetchNOTAMData();
      case 'list':
        return this.getNOTAMs(parameters);
      case 'get':
        return this.getNOTAM(parameters.notamId);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute geospatial analysis operations
   */
  async executeGeospatialAnalysis(operation, parameters) {
    switch (operation) {
      case 'convert':
        return this.convertToGeospatial(parameters.notamData);
      case 'analyze':
        return this.analyzeGeospatial(parameters);
      case 'query':
        return this.queryGeospatial(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute proximity alert operations
   */
  async executeProximityAlerts(operation, parameters) {
    switch (operation) {
      case 'monitor':
        return this.monitorProximity(parameters);
      case 'alert':
        return this.generateProximityAlert(parameters);
      case 'check':
        return this.checkProximity(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute temporal analysis operations
   */
  async executeTemporalAnalysis(operation, parameters) {
    switch (operation) {
      case 'analyze':
        return this.analyzeTemporal(parameters);
      case 'validate':
        return this.validateTemporal(parameters);
      case 'expire':
        return this.expireNOTAMs();
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute map visualization operations
   */
  async executeMapVisualization(operation, parameters) {
    switch (operation) {
      case 'display':
        return await this.displayOnMap(parameters);
      case 'update':
        return await this.updateMapDisplay(parameters);
      case 'remove':
        return await this.removeFromMap(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Perform connection
   */
  async performConnect() {
    try {
      this.logger.info('Connecting to NOTAM data source...');
      
      // Test connection by fetching initial data
      await this.fetchNOTAMData();
      
      // Start polling
      this.startPolling();
      
      this.logger.info('NOTAM connector connected successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to NOTAM data source:', error);
      throw error;
    }
  }

  /**
   * Perform disconnection
   */
  async performDisconnect() {
    try {
      this.logger.info('Disconnecting from NOTAM data source...');
      
      // Stop polling
      this.stopPolling();
      
      this.logger.info('NOTAM connector disconnected successfully');
      return true;
    } catch (error) {
      this.logger.error('Error during NOTAM connector disconnect:', error);
      throw error;
    }
  }

  /**
   * Start polling for NOTAM data
   */
  startPolling() {
    if (this.isPolling) {
      return;
    }
    
    this.isPolling = true;
    this.pollTimer = setInterval(async () => {
      try {
        await this.pollNOTAMData();
      } catch (error) {
        this.logger.error('Error during NOTAM polling:', error);
      }
    }, this.pollInterval);
    
    this.logger.info(`Started NOTAM polling every ${this.pollInterval / 1000} seconds`);
  }

  /**
   * Stop polling for NOTAM data
   */
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
    this.logger.info('Stopped NOTAM polling');
  }

  /**
   * Poll NOTAM data
   */
  async pollNOTAMData() {
    try {
      this.logger.debug('Polling NOTAM data...');
      
      const newNotams = await this.fetchNOTAMData();
      
      // Process new NOTAMs
      for (const notam of newNotams) {
        await this.processNOTAM(notam);
      }
      
      // Check for expired NOTAMs
      await this.expireNOTAMs();
      
      // Update map displays
      await this.updateMapDisplays();
      
      this.stats.lastUpdate = new Date().toISOString();
      
    } catch (error) {
      this.logger.error('Error polling NOTAM data:', error);
      this.stats.parseErrors++;
    }
  }

  /**
   * Fetch NOTAM data from XML source
   */
  async fetchNOTAMData() {
    try {
      this.stats.apiCalls++;
      
      // Create HTTPS agent to ignore SSL issues
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
      
      const response = await axios.get(this.notamUrl, {
        httpsAgent,
        timeout: 30000,
        headers: {
          'User-Agent': 'Babelfish-LookingGlass/1.0'
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Log the first 500 characters for debugging
      this.logger.debug('Raw XML response (first 500 chars):', response.data.substring(0, 500));
      
      // Parse XML
      const result = await this.xmlParser.parseStringPromise(response.data);
      
      // Debug: Log the structure
      this.logger.debug('Parsed XML structure keys:', Object.keys(result));
      if (result.PIB) {
        this.logger.debug('PIB keys:', Object.keys(result.PIB));
        if (result.PIB.NotamList) {
          this.logger.debug('NotamList type:', Array.isArray(result.PIB.NotamList) ? 'array' : 'object');
          this.logger.debug('NotamList keys:', Object.keys(result.PIB.NotamList));
        }
      }
      
      // Extract NOTAM data
      const notams = this.extractNOTAMs(result);
      
      this.logger.info(`Fetched ${notams.length} NOTAMs from XML source`);
      
      return notams;
      
    } catch (error) {
      this.logger.error('Failed to fetch NOTAM data:', error.message);
      this.logger.error('Error details:', error.stack);
      throw error;
    }
  }

  /**
   * Extract NOTAMs from parsed XML
   */
  extractNOTAMs(xmlData) {
    const notams = [];
    
    try {
      // More robust approach - search for NOTAM elements recursively
      const findNotams = (obj) => {
        if (typeof obj !== 'object' || obj === null) return;
        
        for (const [key, value] of Object.entries(obj)) {
          // Look for NOTAM elements (case insensitive)
          if (key.toLowerCase() === 'notam' || 
              key.toLowerCase() === 'notamlist' ||
              key.toLowerCase() === 'adsection' ||
              key.toLowerCase() === 'firsection') {
            this.logger.debug(`Found NOTAM-related element with key: ${key}`);
            
            if (key.toLowerCase() === 'notam') {
              if (Array.isArray(value)) {
                this.logger.debug(`Found ${value.length} NOTAM elements in array`);
                for (const notamElement of value) {
                  const notam = this.parseNOTAMElement(notamElement);
                  if (notam) {
                    notams.push(notam);
                  }
                }
              } else if (typeof value === 'object') {
                this.logger.debug('Found single NOTAM element');
                const notam = this.parseNOTAMElement(value);
                if (notam) {
                  notams.push(notam);
                }
              }
            }
          }
          
          // Recursively search nested objects
          if (typeof value === 'object' && value !== null) {
            findNotams(value);
          }
        }
      };
      
      findNotams(xmlData);
      
      this.logger.debug(`Found ${notams.length} NOTAM elements in XML structure`);
      
    } catch (error) {
      this.logger.error('Error extracting NOTAMs from XML:', error);
      this.stats.parseErrors++;
    }
    
    return notams;
  }

  /**
   * Parse individual NOTAM element
   */
  parseNOTAMElement(element) {
    try {
      // Log the first NOTAM element for debugging
      if (!this._loggedFirstNotam) {
        this.logger.debug('Sample NOTAM element:', JSON.stringify(element, null, 2));
        this._loggedFirstNotam = true;
      }
      // Extract basic NOTAM information
      const notam = {
        id: this.generateNOTAMId(element),
        notamNumber: this.extractNOTAMNumber(element),
        title: this.extractTitle(element),
        description: this.extractDescription(element),
        startTime: this.extractStartTime(element),
        endTime: this.extractEndTime(element),
        category: this.extractCategory(element),
        priority: this.extractPriority(element),
        affectedArea: this.extractAffectedArea(element),
        position: this.extractPosition(element),
        status: 'active',
        rawData: element
      };
      // Do not skip NOTAMs if id or notamNumber is missing
      return notam;
    } catch (error) {
      this.logger.error('Error parsing NOTAM element:', error);
      return null;
    }
  }

  /**
   * Generate unique NOTAM ID
   */
  generateNOTAMId(element) {
    // Try to extract a unique identifier
    const notamNumber = this.extractNOTAMNumber(element);
    if (notamNumber) {
      return `notam-${notamNumber}`;
    }
    
    // Fallback to hash of element
    const hash = require('crypto').createHash('md5')
      .update(JSON.stringify(element))
      .digest('hex');
    return `notam-${hash.substring(0, 8)}`;
  }

  /**
   * Extract NOTAM number
   */
  extractNOTAMNumber(element) {
    try {
      // UK NOTAM structure: Series + Number + Year + Type
      // e.g., L3206/25N
      const series = element.Series || '';
      const number = element.Number || '';
      const year = element.Year || '';
      const type = element.Type || '';
      
      if (series && number && year) {
        return `${series}${number}/${year}${type}`;
      }
      
      // Fallback to other possible fields
      const possibleFields = ['notamNumber', 'number', 'id', 'notam_id', 'aip_id'];
      
      for (const field of possibleFields) {
        if (element[field]) {
          return element[field].toString();
        }
      }
      
      return null;
      
    } catch (error) {
      this.logger.error('Error extracting NOTAM number:', error);
      return null;
    }
  }

  /**
   * Extract title
   */
  extractTitle(element) {
    try {
      // UK NOTAM structure: ITEMA contains aerodrome identifier
      if (element.ITEMA) {
        return `NOTAM for ${element.ITEMA}`;
      }
      
      // Fallback to other possible fields
      const possibleFields = ['title', 'subject', 'name', 'summary'];
      
      for (const field of possibleFields) {
        if (element[field]) {
          return element[field].toString();
        }
      }
      
      return 'NOTAM';
      
    } catch (error) {
      this.logger.error('Error extracting title:', error);
      return 'NOTAM';
    }
  }

  /**
   * Extract description
   */
  extractDescription(element) {
    try {
      // UK NOTAM structure: ITEME contains the NOTAM description
      if (element.ITEME) {
        return element.ITEME.toString();
      }
      
      // Fallback to other possible fields
      const possibleFields = ['description', 'content', 'text', 'message', 'details'];
      
      for (const field of possibleFields) {
        if (element[field]) {
          return element[field].toString();
        }
      }
      
      return '';
      
    } catch (error) {
      this.logger.error('Error extracting description:', error);
      return '';
    }
  }

  /**
   * Extract start time
   */
  extractStartTime(element) {
    try {
      // UK NOTAM structure: STARTVALIDITY in format DDMMYYHHMM
      if (element.STARTVALIDITY) {
        const validity = element.STARTVALIDITY.toString();
        if (validity.length === 10) {
          const day = validity.substring(0, 2);
          const month = validity.substring(2, 4);
          const year = '20' + validity.substring(4, 6);
          const hour = validity.substring(6, 8);
          const minute = validity.substring(8, 10);
          
          return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
        }
      }
      
      // Fallback to other possible fields
      const possibleFields = ['startTime', 'start', 'validFrom', 'from', 'begin'];
      
      for (const field of possibleFields) {
        if (element[field]) {
          return element[field].toString();
        }
      }
      
      return null;
      
    } catch (error) {
      this.logger.error('Error extracting start time:', error);
      return null;
    }
  }

  /**
   * Extract end time
   */
  extractEndTime(element) {
    try {
      // UK NOTAM structure: ENDVALIDITY in format DDMMYYHHMM
      if (element.ENDVALIDITY) {
        const validity = element.ENDVALIDITY.toString();
        if (validity.length === 10) {
          const day = validity.substring(0, 2);
          const month = validity.substring(2, 4);
          const year = '20' + validity.substring(4, 6);
          const hour = validity.substring(6, 8);
          const minute = validity.substring(8, 10);
          
          return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
        }
      }
      
      // Fallback to other possible fields
      const possibleFields = ['endTime', 'end', 'validTo', 'to', 'until'];
      
      for (const field of possibleFields) {
        if (element[field]) {
          return element[field].toString();
        }
      }
      
      return null;
      
    } catch (error) {
      this.logger.error('Error extracting end time:', error);
      return null;
    }
  }

  /**
   * Extract category
   */
  extractCategory(element) {
    const possibleFields = ['category', 'type', 'class', 'classification'];
    
    for (const field of possibleFields) {
      if (element[field]) {
        return element[field].toString();
      }
    }
    
    return 'general';
  }

  /**
   * Extract priority
   */
  extractPriority(element) {
    const possibleFields = ['priority', 'urgency', 'importance'];
    
    for (const field of possibleFields) {
      if (element[field]) {
        return element[field].toString();
      }
    }
    
    return 'normal';
  }

  /**
   * Extract affected area
   */
  extractAffectedArea(element) {
    const possibleFields = ['area', 'affectedArea', 'region', 'zone'];
    
    for (const field of possibleFields) {
      if (element[field]) {
        return element[field].toString();
      }
    }
    
    return 'UK';
  }

  /**
   * Extract position
   */
  extractPosition(element) {
    try {
      // UK NOTAM structure: Coordinates in format "DDMMN/SDDDMME/W"
      if (element.Coordinates) {
        const coords = element.Coordinates.toString();
        const lat = this.extractLatitude(element);
        const lon = this.extractLongitude(element);
        
        if (lat !== null && lon !== null) {
          return { lat, lon };
        }
      }
      
      // Fallback to other possible fields
      const possibleFields = ['position', 'coordinates', 'location', 'latlon'];
      
      for (const field of possibleFields) {
        if (element[field]) {
          return element[field];
        }
      }
      
      return null;
      
    } catch (error) {
      this.logger.error('Error extracting position:', error);
      return null;
    }
  }

  /**
   * Extract latitude
   */
  extractLatitude(element) {
    try {
      // UK NOTAM structure: Coordinates in format "DDMMN/SDDDMME/W"
      if (element.COORDINATES) {
        const coords = element.COORDINATES.toString();
        this.logger.debug(`Parsing coordinates: ${coords}`);
        
        // Extract latitude part (first part before longitude)
        const latMatch = coords.match(/^(\d{2})(\d{2})([NS])/);
        if (latMatch) {
          const degrees = parseInt(latMatch[1]);
          const minutes = parseInt(latMatch[2]);
          const direction = latMatch[3];
          
          let lat = degrees + (minutes / 60);
          if (direction === 'S') {
            lat = -lat;
          }
          
          this.logger.debug(`Parsed latitude: ${lat} from ${degrees}°${minutes}'${direction}`);
          return lat;
        }
      }
      
      // Fallback to other possible fields
      const possibleFields = ['latitude', 'lat', 'y'];
      
      for (const field of possibleFields) {
        if (element[field]) {
          const lat = parseFloat(element[field]);
          if (!isNaN(lat)) {
            return lat;
          }
        }
      }
      
      return null;
      
    } catch (error) {
      this.logger.error('Error extracting latitude:', error);
      return null;
    }
  }

  /**
   * Extract longitude
   */
  extractLongitude(element) {
    try {
      // UK NOTAM structure: Coordinates in format "DDMMN/SDDDMME/W"
      if (element.COORDINATES) {
        const coords = element.COORDINATES.toString();
        
        // Extract longitude part (after latitude)
        const lonMatch = coords.match(/(\d{3})(\d{2})([EW])/);
        if (lonMatch) {
          const degrees = parseInt(lonMatch[1]);
          const minutes = parseInt(lonMatch[2]);
          const direction = lonMatch[3];
          
          let lon = degrees + (minutes / 60);
          if (direction === 'W') {
            lon = -lon;
          }
          
          this.logger.debug(`Parsed longitude: ${lon} from ${degrees}°${minutes}'${direction}`);
          return lon;
        }
      }
      
      // Fallback to other possible fields
      const possibleFields = ['longitude', 'lon', 'lng', 'x'];
      
      for (const field of possibleFields) {
        if (element[field]) {
          const lon = parseFloat(element[field]);
          if (!isNaN(lon)) {
            return lon;
          }
        }
      }
      
      return null;
      
    } catch (error) {
      this.logger.error('Error extracting longitude:', error);
      return null;
    }
  }

  /**
   * Process NOTAM data
   */
  async processNOTAM(notam) {
    try {
      const existingNotam = this.notams.get(notam.id);
      
      if (!existingNotam) {
        // New NOTAM
        this.notams.set(notam.id, notam);
        this.activeNotams.set(notam.id, notam);
        this.stats.totalNotams++;
        this.stats.activeNotams++;
        
        // Create spatial element
        await this.createSpatialElement(notam);
        
        // Emit new NOTAM event
        this.emit('notam:new', {
          notam,
          timestamp: new Date().toISOString()
        });
        
        this.logger.info(`New NOTAM added: ${notam.notamNumber}`);
        
      } else {
        // Update existing NOTAM
        const updatedNotam = { ...existingNotam, ...notam };
        this.notams.set(notam.id, updatedNotam);
        this.activeNotams.set(notam.id, updatedNotam);
        
        // Update spatial element
        await this.updateSpatialElement(notam.id, updatedNotam);
        
        // Emit update event
        this.emit('notam:updated', {
          notam: updatedNotam,
          timestamp: new Date().toISOString()
        });
        
        this.logger.debug(`NOTAM updated: ${notam.notamNumber}`);
      }
      
    } catch (error) {
      this.logger.error('Error processing NOTAM:', error);
    }
  }

  /**
   * Create spatial element for map
   */
  async createSpatialElement(notam) {
    const spatialElement = {
      id: `notam-${notam.id}`,
      type: 'notam',
      name: notam.title || `NOTAM ${notam.notamNumber}`,
      position: notam.position,
      properties: {
        notamNumber: notam.notamNumber,
        title: notam.title,
        description: notam.description,
        startTime: notam.startTime,
        endTime: notam.endTime,
        status: notam.status,
        category: notam.category,
        priority: notam.priority,
        affectedArea: notam.affectedArea
      },
      metadata: {
        sourceConnectorId: this.id,
        sourceElementId: notam.id,
        timestamp: new Date().toISOString()
      }
    };
    
    this.spatialElements.set(spatialElement.id, spatialElement);
    
    // Broadcast to maps
    await this.broadcastToMaps({
      type: 'notam:new',
      element: spatialElement
    });
  }

  /**
   * Update spatial element
   */
  async updateSpatialElement(notamId, notam) {
    const elementId = `notam-${notamId}`;
    const existingElement = this.spatialElements.get(elementId);
    
    if (existingElement) {
      const updatedElement = {
        ...existingElement,
        name: notam.title || `NOTAM ${notam.notamNumber}`,
        position: notam.position,
        properties: {
          notamNumber: notam.notamNumber,
          title: notam.title,
          description: notam.description,
          startTime: notam.startTime,
          endTime: notam.endTime,
          status: notam.status,
          category: notam.category,
          priority: notam.priority,
          affectedArea: notam.affectedArea
        },
        metadata: {
          ...existingElement.metadata,
          timestamp: new Date().toISOString()
        }
      };
      
      this.spatialElements.set(elementId, updatedElement);
      
      // Broadcast to maps
      await this.broadcastToMaps({
        type: 'notam:updated',
        element: updatedElement
      });
    }
  }

  /**
   * Expire NOTAMs
   */
  async expireNOTAMs() {
    const now = new Date();
    const expiredIds = [];
    
    for (const [id, notam] of this.activeNotams) {
      if (notam.endTime && now > notam.endTime) {
        expiredIds.push(id);
      }
    }
    
    for (const id of expiredIds) {
      const notam = this.activeNotams.get(id);
      notam.status = 'expired';
      
      this.activeNotams.delete(id);
      this.expiredNotams.set(id, notam);
      this.stats.activeNotams--;
      this.stats.expiredNotams++;
      
      // Remove from spatial elements
      const elementId = `notam-${id}`;
      this.spatialElements.delete(elementId);
      
      // Emit expired event
      this.emit('notam:expired', {
        notam,
        timestamp: new Date().toISOString()
      });
      
      this.logger.info(`NOTAM expired: ${notam.notamNumber}`);
    }
  }

  /**
   * Update map displays
   */
  async updateMapDisplays() {
    const spatialContext = await this.getSpatialContext();
    
    for (const [mapId, mapConnector] of this.mapConnectors) {
      try {
        await mapConnector.execute('integration:context', 'update', {
          connectorId: this.id,
          context: spatialContext
        });
      } catch (error) {
        this.logger.error(`Failed to update map ${mapId}:`, error);
      }
    }
  }

  /**
   * Get NOTAMs with optional filtering
   */
  getNOTAMs(parameters = {}) {
    let notams = Array.from(this.notams.values());
    
    // Filter by status
    if (parameters.status) {
      notams = notams.filter(notam => notam.status === parameters.status);
    }
    
    // Filter by category
    if (parameters.category) {
      notams = notams.filter(notam => notam.category === parameters.category);
    }
    
    // Filter by priority
    if (parameters.priority) {
      notams = notams.filter(notam => notam.priority === parameters.priority);
    }
    
    // Filter by time range
    if (parameters.startTime) {
      const startTime = new Date(parameters.startTime);
      notams = notams.filter(notam => notam.startTime >= startTime);
    }
    
    if (parameters.endTime) {
      const endTime = new Date(parameters.endTime);
      notams = notams.filter(notam => notam.endTime <= endTime);
    }
    
    return notams;
  }

  /**
   * Get specific NOTAM
   */
  getNOTAM(notamId) {
    return this.notams.get(notamId) || null;
  }

  /**
   * Convert NOTAM to geospatial format
   */
  convertToGeospatial(notamData) {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [notamData.position.lon, notamData.position.lat]
      },
      properties: {
        id: notamData.id,
        notamNumber: notamData.notamNumber,
        title: notamData.title,
        description: notamData.description,
        startTime: notamData.startTime,
        endTime: notamData.endTime,
        status: notamData.status,
        category: notamData.category,
        priority: notamData.priority
      }
    };
  }

  /**
   * Analyze geospatial data
   */
  analyzeGeospatial(parameters) {
    const { lat, lon, radius = 50 } = parameters;
    
    const nearbyNotams = [];
    
    for (const notam of this.activeNotams.values()) {
      const distance = this.calculateDistance(lat, lon, notam.position.lat, notam.position.lon);
      if (distance <= radius) {
        nearbyNotams.push({
          ...notam,
          distance
        });
      }
    }
    
    return nearbyNotams.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Query geospatial data
   */
  queryGeospatial(parameters) {
    const { bounds, category, priority } = parameters;
    
    let notams = Array.from(this.activeNotams.values());
    
    // Filter by bounds
    if (bounds) {
      notams = notams.filter(notam => 
        notam.position.lat >= bounds.south &&
        notam.position.lat <= bounds.north &&
        notam.position.lon >= bounds.west &&
        notam.position.lon <= bounds.east
      );
    }
    
    // Filter by category
    if (category) {
      notams = notams.filter(notam => notam.category === category);
    }
    
    // Filter by priority
    if (priority) {
      notams = notams.filter(notam => notam.priority === priority);
    }
    
    return notams;
  }

  /**
   * Monitor proximity
   */
  monitorProximity(parameters) {
    const { aircraftPosition, radius = 10 } = parameters;
    
    const nearbyNotams = this.analyzeGeospatial({
      lat: aircraftPosition.lat,
      lon: aircraftPosition.lon,
      radius
    });
    
    return nearbyNotams;
  }

  /**
   * Generate proximity alert
   */
  generateProximityAlert(parameters) {
    const { aircraftId, aircraftPosition, notamId } = parameters;
    
    const notam = this.getNOTAM(notamId);
    if (!notam) {
      return null;
    }
    
    const distance = this.calculateDistance(
      aircraftPosition.lat,
      aircraftPosition.lon,
      notam.position.lat,
      notam.position.lon
    );
    
    return {
      type: 'notam:proximity',
      aircraftId,
      notamId,
      notamNumber: notam.notamNumber,
      distance,
      position: aircraftPosition,
      notamPosition: notam.position,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check proximity
   */
  checkProximity(parameters) {
    const { aircraftPosition, radius = 10 } = parameters;
    
    const nearbyNotams = this.monitorProximity({ aircraftPosition, radius });
    
    if (nearbyNotams.length > 0) {
      // Emit proximity event
      this.emit('notam:proximity', {
        aircraftPosition,
        nearbyNotams,
        radius,
        timestamp: new Date().toISOString()
      });
    }
    
    return nearbyNotams;
  }

  /**
   * Analyze temporal patterns
   */
  analyzeTemporal(parameters) {
    const { startTime, endTime } = parameters;
    
    const notams = this.getNOTAMs({ startTime, endTime });
    
    // Group by category
    const byCategory = {};
    for (const notam of notams) {
      if (!byCategory[notam.category]) {
        byCategory[notam.category] = [];
      }
      byCategory[notam.category].push(notam);
    }
    
    // Group by priority
    const byPriority = {};
    for (const notam of notams) {
      if (!byPriority[notam.priority]) {
        byPriority[notam.priority] = [];
      }
      byPriority[notam.priority].push(notam);
    }
    
    return {
      total: notams.length,
      byCategory,
      byPriority,
      timeRange: { startTime, endTime }
    };
  }

  /**
   * Validate temporal data
   */
  validateTemporal(parameters) {
    const { notamId } = parameters;
    
    const notam = this.getNOTAM(notamId);
    if (!notam) {
      return { valid: false, reason: 'NOTAM not found' };
    }
    
    const now = new Date();
    
    if (notam.endTime && now > notam.endTime) {
      return { valid: false, reason: 'NOTAM expired' };
    }
    
    if (notam.startTime && now < notam.startTime) {
      return { valid: false, reason: 'NOTAM not yet active' };
    }
    
    return { valid: true };
  }

  /**
   * Display NOTAM on map
   */
  async displayOnMap(parameters) {
    const { notamId, mapId } = parameters;
    
    const notam = this.getNOTAM(notamId);
    if (!notam) {
      throw new Error('NOTAM not found');
    }
    
    const mapConnector = this.mapConnectors.get(mapId);
    if (!mapConnector) {
      throw new Error('Map connector not found');
    }
    
    const spatialElement = this.spatialElements.get(`notam-${notamId}`);
    if (!spatialElement) {
      throw new Error('Spatial element not found');
    }
    
    await mapConnector.execute('spatial:config', 'create', {
      elementType: 'notam',
      position: spatialElement.position,
      properties: spatialElement.properties
    });
    
    return spatialElement;
  }

  /**
   * Update map display
   */
  async updateMapDisplay(parameters) {
    const { notamId, mapId, updates } = parameters;
    
    const mapConnector = this.mapConnectors.get(mapId);
    if (!mapConnector) {
      throw new Error('Map connector not found');
    }
    
    await mapConnector.execute('spatial:config', 'update', {
      elementId: `notam-${notamId}`,
      updates
    });
    
    return true;
  }

  /**
   * Remove from map
   */
  async removeFromMap(parameters) {
    const { notamId, mapId } = parameters;
    
    const mapConnector = this.mapConnectors.get(mapId);
    if (!mapConnector) {
      throw new Error('Map connector not found');
    }
    
    await mapConnector.execute('spatial:config', 'delete', {
      elementId: `notam-${notamId}`
    });
    
    return true;
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get visualization data
   */
  getVisualizationData(parameters = {}) {
    const notams = this.getNOTAMs(parameters);
    
    return notams.map(notam => ({
      id: notam.id,
      type: 'notam',
      name: notam.title || `NOTAM ${notam.notamNumber}`,
      position: notam.position,
      properties: {
        notamNumber: notam.notamNumber,
        title: notam.title,
        description: notam.description,
        startTime: notam.startTime,
        endTime: notam.endTime,
        status: notam.status,
        category: notam.category,
        priority: notam.priority,
        affectedArea: notam.affectedArea
      },
      style: this.getNOTAMStyle(notam)
    }));
  }

  /**
   * Get NOTAM style for visualization
   */
  getNOTAMStyle(notam) {
    const baseStyle = {
      color: '#FF6B6B',
      size: 8,
      opacity: 0.8
    };
    
    // Adjust style based on priority
    switch (notam.priority) {
      case 'high':
        baseStyle.color = '#FF0000';
        baseStyle.size = 12;
        break;
      case 'medium':
        baseStyle.color = '#FFA500';
        baseStyle.size = 10;
        break;
      case 'low':
        baseStyle.color = '#FFFF00';
        baseStyle.size = 6;
        break;
    }
    
    // Adjust style based on category
    switch (notam.category) {
      case 'emergency':
        baseStyle.color = '#FF0000';
        baseStyle.size = 14;
        break;
      case 'warning':
        baseStyle.color = '#FFA500';
        baseStyle.size = 12;
        break;
    }
    
    return baseStyle;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      notams: {
        total: this.stats.totalNotams,
        active: this.stats.activeNotams,
        expired: this.stats.expiredNotams
      },
      spatial: {
        elements: this.spatialElements.size,
        maps: this.mapConnectors.size
      }
    };
  }

  /**
   * Validate configuration
   */
  static validateConfig(config) {
    const errors = [];
    
    if (!config.id) {
      errors.push('Connector ID is required');
    }
    
    if (!config.type || config.type !== 'notam') {
      errors.push('Connector type must be "notam"');
    }
    
    if (config.pollInterval && (typeof config.pollInterval !== 'number' || config.pollInterval < 60000)) {
      errors.push('Poll interval must be at least 60 seconds');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Get metadata
   */
  static getMetadata() {
    return {
      name: 'NOTAM Connector',
      version: '1.0.0',
      description: 'Connector for UK NOTAM data integration',
      author: 'Looking Glass Team',
      capabilities: [
        'notam:tracking',
        'notam:geospatial',
        'notam:proximity',
        'notam:temporal',
        'notam:map:visualization'
      ],
      configuration: {
        notamUrl: {
          type: 'string',
          description: 'URL to NOTAM XML feed',
          default: 'https://raw.githubusercontent.com/Jonty/uk-notam-archive/main/data/PIB.xml'
        },
        pollInterval: {
          type: 'number',
          description: 'Polling interval in milliseconds',
          default: 1200000
        },
        ukBounds: {
          type: 'object',
          description: 'UK bounding box coordinates',
          default: {
            north: 60.8604,
            south: 49.1623,
            east: 1.7633,
            west: -8.6500
          }
        }
      }
    };
  }

  /**
   * Handle map connector registration
   */
  async handleMapConnectorRegistered(mapConnector) {
    try {
      await this.registerWithMap(mapConnector);
    } catch (error) {
      this.logger.error('Failed to register with new map connector:', error);
    }
  }
}

module.exports = NOTAMConnector; 