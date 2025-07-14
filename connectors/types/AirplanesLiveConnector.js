const BaseConnector = require('../BaseConnector');
const fetch = require('node-fetch');

class AirplanesLiveConnector extends BaseConnector {
  static getCapabilityDefinitions() {
    return [
      {
        id: 'airplaneslive:aircraft',
        name: 'Airplanes.Live Aircraft Tracking',
        description: 'Track aircraft using Airplanes.Live API',
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
    // If API key is required in future: if (!config.apiKey) errors.push('API key is required');
    return { valid: errors.length === 0, errors };
  }

  static getMetadata() {
    return {
      id: 'airplaneslive',
      name: 'Airplanes.Live ADSB',
      version: '1.0.0',
      author: 'Looking Glass Team',
      description: 'Connector for Airplanes.Live ADS-B API',
      tags: ['adsb', 'aviation', 'airplaneslive']
    };
  }

  constructor(config) {
    super(config);
    this.lat = config.lat;
    this.lon = config.lon;
    this.radius = config.radius;
    this.pollInterval = config.pollInterval || 1000; // ms
    this.apiBase = 'https://airplanes.live';
    this.running = false;
    this.lastFetch = 0;
  }

  async performConnect() {
    this.running = true;
    this.pollLoop();
    this.logger.info('AirplanesLiveConnector started polling');
  }

  async performDisconnect() {
    this.running = false;
    this.logger.info('AirplanesLiveConnector stopped polling');
  }

  async pollLoop() {
    while (this.running) {
      try {
        await this.fetchAndPublish();
      } catch (err) {
        this.logger.error('AirplanesLive poll error:', err);
      }
      await new Promise(r => setTimeout(r, this.pollInterval));
    }
  }

  async fetchAndPublish() {
    try {
      // Airplanes.Live requires authentication, so for now we'll skip this
      // and focus on the working ADS-B.fi connector
      this.logger.debug('Airplanes.Live API requires authentication - skipping for now');
      return;
      
      // TODO: Implement with proper authentication
      // const url = `${this.apiBase}/point/${this.lat}/${this.lon}/${this.radius}`;
      // const res = await fetch(url, {
      //   method: 'GET',
      //   headers: {
      //     'Accept': 'application/json',
      //     'User-Agent': 'LookingGlass/1.0'
      //   }
      // });
      // 
      // if (!res.ok) {
      //   throw new Error(`Airplanes.Live API error: ${res.status} - ${res.statusText}`);
      // }
      // 
      // const data = await res.json();
      // if (Array.isArray(data)) {
      //   data.forEach(aircraft => {
      //     this.eventBus.publishEvent('aircraft:detected', {
      //       source: this.id,
      //       data: aircraft,
      //       timestamp: Date.now()
      //     });
      //   });
      // }
    } catch (error) {
      this.logger.error(`Airplanes.Live fetch error: ${error.message}`);
      throw error;
    }
  }

  async executeCapability(capabilityId, operation, parameters) {
    if (capabilityId !== 'airplaneslive:aircraft') throw new Error('Unknown capability');
    if (operation === 'list') {
      return await this.fetchAircraft();
    }
    throw new Error('Unsupported operation');
  }

  async fetchAircraft() {
    const url = `${this.apiBase}/point/${this.lat}/${this.lon}/${this.radius}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Airplanes.Live API error: ${res.status}`);
    return await res.json();
  }
}

module.exports = AirplanesLiveConnector; 