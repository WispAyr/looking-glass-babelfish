const BaseConnector = require('../BaseConnector');
const fetch = require('node-fetch');

class OpendataAdsbFiConnector extends BaseConnector {
  static getCapabilityDefinitions() {
    return [
      {
        id: 'adsbfi:aircraft',
        name: 'OpenData ADS-B.fi Aircraft Tracking',
        description: 'Track aircraft using opendata.adsb.fi API',
        category: 'aviation',
        operations: ['list', 'get'],
        dataTypes: ['aircraft'],
        events: ['aircraft:detected'],
        parameters: {
          lat: { type: 'number', required: true },
          lon: { type: 'number', required: true },
          radius: { type: 'number', required: true }
        }
      }
    ];
  }

  static validateConfig(config) {
    const errors = [];
    if (typeof config.lat !== 'number') errors.push('Latitude (lat) is required');
    if (typeof config.lon !== 'number') errors.push('Longitude (lon) is required');
    if (typeof config.radius !== 'number') errors.push('Radius is required');
    return { valid: errors.length === 0, errors };
  }

  static getMetadata() {
    return {
      id: 'adsbfi',
      name: 'OpenData ADS-B.fi',
      version: '1.0.0',
      author: 'Looking Glass Team',
      description: 'Connector for opendata.adsb.fi ADS-B API',
      tags: ['adsb', 'aviation', 'adsbfi']
    };
  }

  constructor(config) {
    super(config);
    
    // Extract config from the config object
    const connectorConfig = this.config;
    
    this.lat = connectorConfig.lat;
    this.lon = connectorConfig.lon;
    this.radius = connectorConfig.radius;
    this.pollInterval = connectorConfig.pollInterval || 300000; // 300 seconds (5 minutes)
    this.apiBase = 'https://opendata.adsb.fi/api/v2';
    this.running = false;
    
    // Validate config
    if (typeof this.lat !== 'number' || typeof this.lon !== 'number' || typeof this.radius !== 'number') {
      this.logger.error(`Invalid config: lat=${this.lat}, lon=${this.lon}, radius=${this.radius}`);
    }
  }

  async performConnect() {
    this.running = true;
    this.pollLoop();
    this.logger.info('OpendataAdsbFiConnector started polling');
  }

  async performDisconnect() {
    this.running = false;
    this.logger.info('OpendataAdsbFiConnector stopped polling');
  }

  async pollLoop() {
    while (this.running) {
      try {
        await this.fetchAndPublish();
      } catch (err) {
        this.logger.error('OpendataAdsbFi poll error:', err);
      }
      await new Promise(r => setTimeout(r, this.pollInterval));
    }
  }

  async fetchAndPublish() {
    try {
      const url = `${this.apiBase}/lat/${this.lat}/lon/${this.lon}/dist/${this.radius}`;
      this.logger.debug(`Fetching from: ${url}`);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LookingGlass/1.0'
        },
        timeout: 5000
      });
      
      if (!res.ok) {
        throw new Error(`adsb.fi API error: ${res.status} - ${res.statusText}`);
      }
      
      const data = await res.json();
      this.logger.debug(`Received ${data.aircraft?.length || 0} aircraft from ADS-B.fi`);
      
      if (data && Array.isArray(data.aircraft)) {
        data.aircraft.forEach(aircraft => {
          this.eventBus.publishEvent({
            type: 'aircraft:detected',
            source: this.id,
            data: aircraft,
            timestamp: Date.now()
          });
        });
      }
    } catch (error) {
      this.logger.error(`ADS-B.fi fetch error: ${error.message}`);
      throw error;
    }
  }

  async executeCapability(capabilityId, operation, parameters) {
    if (capabilityId !== 'adsbfi:aircraft') throw new Error('Unknown capability');
    if (operation === 'list') {
      return await this.fetchAircraft();
    }
    throw new Error('Unsupported operation');
  }

  async fetchAircraft() {
    const url = `${this.apiBase}/lat/${this.lat}/lon/${this.lon}/dist/${this.radius}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`adsb.fi API error: ${res.status}`);
    const data = await res.json();
    return data.aircraft || [];
  }
}

module.exports = OpendataAdsbFiConnector; 