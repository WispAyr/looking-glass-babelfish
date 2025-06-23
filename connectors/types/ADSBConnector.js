const BaseConnector = require('../BaseConnector');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const SquawkCodeService = require('../../services/squawkCodeService');
const AircraftDataService = require('../../services/aircraftDataService');

/**
 * ADSB Connector for dump1090 with BaseStation.sqb integration, Airspace Awareness, and Squawk Code Analysis
 * 
 * Connects to dump1090 ADS-B receiver and provides aircraft tracking,
 * zone monitoring, and radar display capabilities. Supports real-time
 * aircraft data, emergency priority handling, and spatial zone management.
 * Enhanced with BaseStation.sqb database integration for aircraft registration data,
 * UK airspace data for airspace awareness, and UK squawk code analysis for
 * intelligent event generation and enhanced monitoring.
 */
class ADSBConnector extends BaseConnector {
  constructor(config) {
    // Handle both old format (id, config) and new format (config object)
    let id, connectorConfig;
    if (typeof config === 'string') {
      // Old format: constructor(id, config)
      id = config;
      connectorConfig = arguments[1] || {};
    } else {
      // New format: constructor(config)
      id = config.id;
      connectorConfig = config.config || config;
    }
    
    // Create the config object that BaseConnector expects
    const baseConfig = {
      id: id,
      type: 'adsb',
      name: config.name || 'ADSB Receiver',
      description: config.description || 'ADSB aircraft data receiver',
      config: connectorConfig,
      capabilities: config.capabilities || {
        enabled: [
          'aircraft:tracking',
          'zones:management',
          'radar:display',
          'events:smart',
          'emergency:monitoring',
          'basestation:database',
          'squawk:analysis'
        ],
        disabled: []
      },
      logger: config.logger
    };
    
    super(baseConfig);
    
    // ADSB-specific configuration
    this.url = connectorConfig.url || 'http://localhost:8080/data/aircraft.json';
    this.pollInterval = connectorConfig.pollInterval || 5000;
    this.emergencyCodes = connectorConfig.emergencyCodes || ['7500', '7600', '7700'];
    this.radarRange = connectorConfig.radarRange || 50;
    this.radarCenter = connectorConfig.radarCenter || { lat: 55.5074, lon: -4.5933 };
    this.enableSquawkCodeAnalysis = connectorConfig.enableSquawkCodeAnalysis !== false;
    this.enableBaseStationIntegration = connectorConfig.enableBaseStationIntegration !== false;
    this.enableAircraftDataService = connectorConfig.enableAircraftDataService !== false;
    this.baseStationDbPath = connectorConfig.baseStationDbPath || './aviationdata/BaseStation.sqb';
    this.enableAirspaceAwareness = connectorConfig.enableAirspaceAwareness !== false;
    
    // Radar configuration
    this.radarConfig = {
      range: connectorConfig.radarRange || 50,
      center: connectorConfig.radarCenter || { lat: 55.5074, lon: -4.5933 },
      zoom: connectorConfig.radarZoom || 10,
      rotation: connectorConfig.radarRotation || 0,
      sweepSpeed: connectorConfig.radarSweepSpeed || 4,
      showTrails: connectorConfig.showTrails !== false,
      trailLength: connectorConfig.trailLength || 20,
      showLabels: connectorConfig.showLabels !== false,
      showAltitude: connectorConfig.showAltitude !== false,
      showSpeed: connectorConfig.showSpeed !== false,
      showHeading: connectorConfig.showHeading !== false,
      showSquawk: connectorConfig.showSquawk !== false,
      showEmergency: connectorConfig.showEmergency !== false,
      colorByAltitude: connectorConfig.colorByAltitude !== false,
      colorBySpeed: connectorConfig.colorBySpeed !== false,
      colorByType: connectorConfig.colorByType !== false,
      showCoastline: connectorConfig.showCoastline !== false,
      coastlineColor: connectorConfig.coastlineColor || '#0066cc',
      coastlineWidth: connectorConfig.coastlineWidth || 2,
      coastlineOpacity: connectorConfig.coastlineOpacity || 0.8
    };
    
    // Airport configuration
    this.airport = connectorConfig.airport || null;
    
    // Initialize ADSB-specific properties
    this.aircraft = new Map();
    this.events = [];
    this.pollingInterval = null;
    this.aircraftDataService = null;
    this.airspaceService = null;
    this.squawkCodeService = null;
    this.runwayUsage = new Map();
    this.activeRunway = null;
    this.aircraftRegistry = new Map(); // Initialize aircraft registry
    this.baseStationDb = null; // Initialize BaseStation database reference
    
    // Event tracking
    this.lastEventTime = new Map();
    this.eventCooldown = 30000; // 30 seconds between same event types
    
    // Flight tracking
    this.enableFlightTracking = connectorConfig.enableFlightTracking !== false;
    this.activeFlights = new Map();
    this.flightSessionId = 1;
    
    // Flight detection configuration
    this.flightDetectionConfig = {
      maxGroundSpeed: connectorConfig.maxGroundSpeed || 30, // knots
      minAltitude: connectorConfig.minAltitude || 500, // feet
      minFlightDuration: connectorConfig.minFlightDuration || 30000, // 30 seconds
      flightEndTimeout: connectorConfig.flightEndTimeout || 300000 // 5 minutes
    };
    
    // Aircraft tracking arrays
    this.appearances = [];
    this.disappearances = [];
    this.recentChanges = [];
    
    // Performance tracking
    this.performance = {
      errorCount: 0,
      squawkCodeEvents: 0,
      airspaceEvents: 0,
      aircraftUpdates: 0,
      eventsGenerated: 0,
      pollCount: 0,
      averageResponseTime: 0,
      lastPoll: null,
      aircraftCount: 0,
      airspaceQueries: 0,
      squawkCodeQueries: 0,
      baseStationCacheHits: 0,
      baseStationQueries: 0,
      flightStarts: 0
    };
    
    // Event storage
    this.squawkCodeEvents = [];
    this.airspaceEvents = [];
    this.emergencyEvents = [];
    this.aircraftSquawkContext = new Map();
    
    // Airspace awareness
    this.enableAirspaceAwareness = config.enableAirspaceAwareness !== false;
    this.airspaceService = null;
    this.aircraftAirspaceContext = new Map();
    
    // Ground event detection
    this.enableGroundEventDetection = config.enableGroundEventDetection !== false;
    
    // Squawk code analysis
    this.enableSquawkCodeAnalysis = config.enableSquawkCodeAnalysis !== false;
    this.squawkCodeService = null;
  }

  /**
   * Set aircraft data service reference
   */
  setAircraftDataService(aircraftDataService) {
    this.aircraftDataService = aircraftDataService;
    if (this.aircraftDataService && this.enableAircraftDataService) {
      this.logger.info('Aircraft data service integrated');
    }
  }

  /**
   * Set airspace service reference
   */
  setAirspaceService(airspaceService) {
    this.airspaceService = airspaceService;
    if (this.airspaceService && this.enableAirspaceAwareness) {
      // Subscribe to airspace events
      this.airspaceService.onAirspaceEvent((event) => {
        this.handleAirspaceEvent(event);
      });
      
      this.logger.info('Airspace service integrated');
    }
  }

  /**
   * Set squawk code service reference
   */
  setSquawkCodeService(squawkCodeService) {
    this.squawkCodeService = squawkCodeService;
    if (this.squawkCodeService && this.enableSquawkCodeAnalysis) {
      // Subscribe to squawk code events
      this.squawkCodeService.on('squawk:analyzed', (event) => {
        this.handleSquawkCodeEvent(event);
      });
      
      this.squawkCodeService.on('emergency:squawk', (event) => {
        this.handleEmergencySquawkEvent(event);
      });
      
      this.squawkCodeService.on('military:squawk', (event) => {
        this.handleMilitarySquawkEvent(event);
      });
      
      this.squawkCodeService.on('nato:squawk', (event) => {
        this.handleNatoSquawkEvent(event);
      });
      
      this.logger.info('Squawk code service integrated');
    }
  }

  /**
   * Set connector registry reference
   */
  setConnectorRegistry(connectorRegistry) {
    this.connectorRegistry = connectorRegistry;
    this.logger.info('Connector registry integrated');
  }

  /**
   * Handle squawk code events from the squawk code service
   */
  handleSquawkCodeEvent(event) {
    this.squawkCodeEvents.push(event);
    this.performance.squawkCodeEvents++;
    
    // Keep only recent events
    if (this.squawkCodeEvents.length > 1000) {
      this.squawkCodeEvents = this.squawkCodeEvents.slice(-1000);
    }
    
    // Store squawk context for this aircraft
    this.aircraftSquawkContext.set(event.aircraft.icao24, {
      squawk: event.squawk,
      squawkInfo: event.squawkInfo,
      timestamp: event.timestamp,
      category: event.category,
      priority: event.priority
    });
    
    // Emit squawk code event
    this.emit('squawk:analyzed', event);
    
    this.logger.info('Squawk code event processed', {
      eventType: event.type,
      aircraft: event.aircraft.icao24,
      squawk: event.squawk,
      category: event.category,
      priority: event.priority
    });
  }

  /**
   * Handle emergency squawk events
   */
  handleEmergencySquawkEvent(event) {
    this.emergencyEvents.push(event);
    this.emit('emergency:squawk', event);
    
    this.logger.warn('Emergency squawk event processed', {
      aircraft: event.aircraft.icao24,
      squawk: event.squawk,
      description: event.squawkInfo.description
    });
  }

  /**
   * Handle military squawk events
   */
  handleMilitarySquawkEvent(event) {
    this.emit('military:squawk', event);
    
    this.logger.info('Military squawk event processed', {
      aircraft: event.aircraft.icao24,
      squawk: event.squawk,
      description: event.squawkInfo.description
    });
  }

  /**
   * Handle NATO squawk events
   */
  handleNatoSquawkEvent(event) {
    this.emit('nato:squawk', event);
    
    this.logger.info('NATO squawk event processed', {
      aircraft: event.aircraft.icao24,
      squawk: event.squawk,
      description: event.squawkInfo.description
    });
  }

  /**
   * Handle airspace events from the airspace service
   */
  handleAirspaceEvent(event) {
    this.airspaceEvents.push(event);
    this.performance.airspaceEvents++;
    
    // Keep only recent events
    if (this.airspaceEvents.length > 1000) {
      this.airspaceEvents = this.airspaceEvents.slice(-1000);
    }
    
    // Emit airspace event
    this.emit('airspace:event', event);
    
    // Publish to event bus for rule processing
    if (this.eventBus) {
      this.eventBus.publishEvent({
        type: event.type,
        source: this.id,
        timestamp: event.timestamp || new Date().toISOString(),
        data: {
          aircraft: event.aircraft,
          airspace: event.airspace,
          metadata: event.metadata
        }
      }).catch(error => {
        this.logger.debug('Failed to publish airspace event to event bus', { error: error.message });
      });
    }
    
    // Generate enhanced smart events based on airspace context
    this.generateAirspaceBasedEvents(event);
    
    this.logger.info('Airspace event processed', {
      eventType: event.type,
      aircraft: event.aircraft.icao24,
      airspace: event.airspace.name,
      airspaceType: event.airspace.type
    });
  }

  /**
   * Generate airspace-based events
   */
  generateAirspaceBasedEvents(airspaceEvent) {
    const { aircraft, airspace } = airspaceEvent;
    
    // Approach detection
    if (airspace.type === 'Final_Approach' && airspaceEvent.type === 'airspace:entry') {
      this.generateApproachEvent(aircraft, airspace);
    }
    
    // Departure detection
    if (airspace.type === 'Final_Approach' && airspaceEvent.type === 'airspace:exit') {
      this.generateDepartureEvent(aircraft, airspace);
    }
    
    // Landing detection - check for aircraft that have been on approach and are now at low altitude
    if (this.isAircraftLikelyLanding(aircraft)) {
      this.generateLandingEvent(aircraft, airspace);
    }
    
    // Ground movement detection
    if (this.isAircraftOnGround(aircraft)) {
      this.generateGroundMovementEvent(aircraft, airspace);
    }
    
    // Helicopter specific events
    if (this.isHelicopter(aircraft)) {
      this.generateHelicopterEvent(aircraft, airspace);
    }
    
    // Taxi detection
    if (this.isAircraftTaxiing(aircraft)) {
      this.generateTaxiEvent(aircraft, airspace);
    }
    
    // Parking/gate detection
    if (this.isAircraftParked(aircraft)) {
      this.generateParkingEvent(aircraft, airspace);
    }
  }

  /**
   * Generate approach event
   */
  generateApproachEvent(aircraft, airspace) {
    const event = {
      id: `approach_${aircraft.icao24}_${Date.now()}`,
      timestamp: new Date(),
      type: 'approach:detected',
      aircraft: aircraft,
      airspace: airspace,
      metadata: {
        eventType: 'approach',
        runway: airspace.name,
        airport: this.extractAirportFromAirspace(airspace),
        confidence: this.calculateApproachConfidence(aircraft, airspace)
      }
    };
    
    this.events.push(event);
    this.emit('approach:detected', event);
    
    // Publish to event bus for rule processing
    if (this.eventBus) {
      this.eventBus.publishEvent({
        type: 'approach:detected',
        source: this.id,
        timestamp: new Date().toISOString(),
        data: {
          aircraft: aircraft,
          airspace: airspace,
          metadata: event.metadata
        }
      }).catch(error => {
        this.logger.debug('Failed to publish approach event to event bus', { error: error.message });
      });
    }
    
    this.logger.info('Approach detected', {
      aircraft: aircraft.icao24,
      runway: airspace.name,
      airport: event.metadata.airport
    });
  }

  /**
   * Generate departure event
   */
  generateDepartureEvent(aircraft, airspace) {
    const event = {
      id: `departure_${aircraft.icao24}_${Date.now()}`,
      timestamp: new Date(),
      type: 'departure:detected',
      aircraft: aircraft,
      airspace: airspace,
      metadata: {
        eventType: 'departure',
        runway: airspace.name,
        airport: this.extractAirportFromAirspace(airspace),
        confidence: this.calculateDepartureConfidence(aircraft, airspace)
      }
    };
    
    this.events.push(event);
    this.emit('departure:detected', event);
    
    // Publish to event bus for rule processing
    if (this.eventBus) {
      this.eventBus.publishEvent({
        type: 'departure:detected',
        source: this.id,
        timestamp: new Date().toISOString(),
        data: {
          aircraft: aircraft,
          airspace: airspace,
          metadata: event.metadata
        }
      }).catch(error => {
        this.logger.debug('Failed to publish departure event to event bus', { error: error.message });
      });
    }
    
    this.logger.info('Departure detected', {
      aircraft: aircraft.icao24,
      runway: airspace.name,
      airport: event.metadata.airport
    });
  }

  /**
   * Check if aircraft is likely landing based on behavior patterns
   */
  isAircraftLikelyLanding(aircraft) {
    // Must have position data
    if (!aircraft.lat || !aircraft.lon || !aircraft.altitude) {
      return false;
    }

    // Check altitude - must be very low (landing threshold)
    if (aircraft.altitude > 100) {
      return false;
    }

    // Check vertical rate - should be descending or level
    if (aircraft.vertical_rate && aircraft.vertical_rate > 100) {
      return false;
    }

    // Check speed - should be slow for landing
    if (aircraft.speed && aircraft.speed > 150) {
      return false;
    }

    // Check if aircraft was recently on approach (within last 5 minutes)
    const recentApproach = this.events.find(event => 
      event.type === 'approach:detected' && 
      event.aircraft.icao24 === aircraft.icao24 &&
      (Date.now() - event.timestamp.getTime()) < 300000 // 5 minutes
    );

    return !!recentApproach;
  }

  /**
   * Generate landing event
   */
  generateLandingEvent(aircraft, airspace) {
    const airport = this.determineAirport(aircraft);
    const runway = this.determineRunway(aircraft, airport);
    const runwayUsage = this.trackRunwayUsage(aircraft, airport);
    
    const event = {
      id: `landing_${aircraft.icao24}_${Date.now()}`,
      timestamp: new Date(),
      type: 'landing:detected',
      aircraft: aircraft,
      airspace: airspace,
      metadata: {
        eventType: 'landing',
        airport: airport,
        runway: runway,
        runwayUsage: runwayUsage,
        confidence: this.calculateLandingConfidence(aircraft, airport, runway),
        touchdownPoint: {
          lat: aircraft.lat,
          lon: aircraft.lon,
          altitude: aircraft.altitude
        }
      }
    };
    
    this.events.push(event);
    this.emit('landing:detected', event);
    
    // Publish to event bus for rule processing
    if (this.eventBus) {
      this.eventBus.publishEvent({
        type: 'landing:detected',
        source: this.id,
        timestamp: new Date().toISOString(),
        data: {
          aircraft: aircraft,
          airspace: airspace,
          metadata: event.metadata
        }
      }).catch(error => {
        this.logger.debug('Failed to publish landing event to event bus', { error: error.message });
      });
    }
    
    this.logger.info('Landing detected', {
      aircraft: aircraft.icao24,
      airport: airport?.icao,
      runway: runway?.id,
      confidence: event.metadata.confidence
    });
  }

  /**
   * Generate ground movement event
   */
  generateGroundMovementEvent(aircraft, airspace) {
    const airport = this.determineAirport(aircraft);
    const movementType = this.determineGroundMovementType(aircraft);
    
    const event = {
      id: `ground_movement_${aircraft.icao24}_${Date.now()}`,
      timestamp: new Date(),
      type: 'ground:movement',
      aircraft: aircraft,
      airspace: airspace,
      metadata: {
        eventType: 'ground_movement',
        airport: airport,
        movementType: movementType,
        confidence: this.calculateGroundMovementConfidence(aircraft),
        location: {
          lat: aircraft.lat,
          lon: aircraft.lon,
          altitude: aircraft.altitude
        }
      }
    };
    
    this.events.push(event);
    this.emit('ground:movement', event);
    
    this.logger.info('Ground movement detected', {
      aircraft: aircraft.icao24,
      airport: airport?.icao,
      movementType: movementType,
      confidence: event.metadata.confidence
    });
  }

  /**
   * Generate helicopter specific event
   */
  generateHelicopterEvent(aircraft, airspace) {
    const airport = this.determineAirport(aircraft);
    const helicopterAction = this.determineHelicopterAction(aircraft);
    
    const event = {
      id: `helicopter_${aircraft.icao24}_${Date.now()}`,
      timestamp: new Date(),
      type: 'helicopter:action',
      aircraft: aircraft,
      airspace: airspace,
      metadata: {
        eventType: 'helicopter_action',
        airport: airport,
        action: helicopterAction,
        confidence: this.calculateHelicopterConfidence(aircraft),
        location: {
          lat: aircraft.lat,
          lon: aircraft.lon,
          altitude: aircraft.altitude
        }
      }
    };
    
    this.events.push(event);
    this.emit('helicopter:action', event);
    
    this.logger.info('Helicopter action detected', {
      aircraft: aircraft.icao24,
      airport: airport?.icao,
      action: helicopterAction,
      confidence: event.metadata.confidence
    });
  }

  /**
   * Generate taxi event
   */
  generateTaxiEvent(aircraft, airspace) {
    const airport = this.determineAirport(aircraft);
    const taxiPhase = this.determineTaxiPhase(aircraft);
    
    const event = {
      id: `taxi_${aircraft.icao24}_${Date.now()}`,
      timestamp: new Date(),
      type: 'taxi:movement',
      aircraft: aircraft,
      airspace: airspace,
      metadata: {
        eventType: 'taxi_movement',
        airport: airport,
        taxiPhase: taxiPhase,
        confidence: this.calculateTaxiConfidence(aircraft),
        location: {
          lat: aircraft.lat,
          lon: aircraft.lon,
          altitude: aircraft.altitude
        }
      }
    };
    
    this.events.push(event);
    this.emit('taxi:movement', event);
    
    this.logger.info('Taxi movement detected', {
      aircraft: aircraft.icao24,
      airport: airport?.icao,
      taxiPhase: taxiPhase,
      confidence: event.metadata.confidence
    });
  }

  /**
   * Generate parking event
   */
  generateParkingEvent(aircraft, airspace) {
    const airport = this.determineAirport(aircraft);
    const parkingArea = this.determineParkingArea(aircraft, airport);
    
    const event = {
      id: `parking_${aircraft.icao24}_${Date.now()}`,
      timestamp: new Date(),
      type: 'parking:status',
      aircraft: aircraft,
      airspace: airspace,
      metadata: {
        eventType: 'parking_status',
        airport: airport,
        parkingArea: parkingArea,
        confidence: this.calculateParkingConfidence(aircraft),
        location: {
          lat: aircraft.lat,
          lon: aircraft.lon,
          altitude: aircraft.altitude
        }
      }
    };
    
    this.events.push(event);
    this.emit('parking:status', event);
    
    this.logger.info('Parking status detected', {
      aircraft: aircraft.icao24,
      airport: airport?.icao,
      parkingArea: parkingArea,
      confidence: event.metadata.confidence
    });
  }

  /**
   * Generate controlled airspace event
   */
  generateControlledAirspaceEvent(aircraft, airspace, action) {
    const event = {
      id: `controlled_${aircraft.icao24}_${action}_${Date.now()}`,
      timestamp: new Date(),
      type: `controlled_airspace:${action}`,
      aircraft: aircraft,
      airspace: airspace,
      metadata: {
        eventType: 'controlled_airspace',
        action: action,
        airspaceType: airspace.type,
        airspaceName: airspace.name,
        requiresClearance: this.requiresClearance(airspace.type)
      }
    };
    
    this.events.push(event);
    this.emit(`controlled_airspace:${action}`, event);
    
    this.logger.info(`Controlled airspace ${action}`, {
      aircraft: aircraft.icao24,
      airspace: airspace.name,
      type: airspace.type
    });
  }

  /**
   * Generate danger area event
   */
  generateDangerAreaEvent(aircraft, airspace, action) {
    const event = {
      id: `danger_${aircraft.icao24}_${action}_${Date.now()}`,
      timestamp: new Date(),
      type: `danger_area:${action}`,
      aircraft: aircraft,
      airspace: airspace,
      metadata: {
        eventType: 'danger_area',
        action: action,
        airspaceName: airspace.name,
        riskLevel: this.assessDangerAreaRisk(aircraft, airspace)
      }
    };
    
    this.events.push(event);
    this.emit(`danger_area:${action}`, event);
    
    this.logger.warn(`Danger area ${action}`, {
      aircraft: aircraft.icao24,
      airspace: airspace.name,
      riskLevel: event.metadata.riskLevel
    });
  }

  /**
   * Generate military airspace event
   */
  generateMilitaryAirspaceEvent(aircraft, airspace, action) {
    const event = {
      id: `military_${aircraft.icao24}_${action}_${Date.now()}`,
      timestamp: new Date(),
      type: `military_airspace:${action}`,
      aircraft: aircraft,
      airspace: airspace,
      metadata: {
        eventType: 'military_airspace',
        action: action,
        airspaceName: airspace.name,
        militaryActivity: this.detectMilitaryActivity(airspace)
      }
    };
    
    this.events.push(event);
    this.emit(`military_airspace:${action}`, event);
    
    this.logger.info(`Military airspace ${action}`, {
      aircraft: aircraft.icao24,
      airspace: airspace.name
    });
  }

  /**
   * Generate holding pattern event
   */
  generateHoldingPatternEvent(aircraft, airspace, action) {
    const event = {
      id: `holding_${aircraft.icao24}_${action}_${Date.now()}`,
      timestamp: new Date(),
      type: `holding_pattern:${action}`,
      aircraft: aircraft,
      airspace: airspace,
      metadata: {
        eventType: 'holding_pattern',
        action: action,
        holdingFix: airspace.name,
        estimatedHoldTime: this.estimateHoldTime(aircraft, airspace)
      }
    };
    
    this.events.push(event);
    this.emit(`holding_pattern:${action}`, event);
    
    this.logger.info(`Holding pattern ${action}`, {
      aircraft: aircraft.icao24,
      holdingFix: airspace.name
    });
  }

  /**
   * Extract airport information from airspace data
   */
  extractAirportFromAirspace(airspace) {
    // Try to extract airport code from airspace name
    const airportMatch = airspace.name.match(/([A-Z]{4})/);
    if (airportMatch) {
      return airportMatch[1];
    }
    
    // Fallback to airspace name
    return airspace.name;
  }

  /**
   * Calculate approach confidence based on aircraft behavior
   */
  calculateApproachConfidence(aircraft, airspace) {
    let confidence = 0.5; // Base confidence
    
    // Check if aircraft is descending
    if (aircraft.vertical_rate && aircraft.vertical_rate < -500) {
      confidence += 0.3;
    }
    
    // Check if aircraft is slowing down
    if (aircraft.speed && aircraft.speed < 200) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate departure confidence based on aircraft behavior
   */
  calculateDepartureConfidence(aircraft, airspace) {
    let confidence = 0.5; // Base confidence
    
    // Check if aircraft is climbing
    if (aircraft.vertical_rate && aircraft.vertical_rate > 500) {
      confidence += 0.3;
    }
    
    // Check if aircraft is accelerating
    if (aircraft.speed && aircraft.speed > 100) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate landing confidence based on aircraft behavior and airport proximity
   */
  calculateLandingConfidence(aircraft, airport, runway) {
    let confidence = 0.6; // Base confidence for landing
    
    // Check altitude - lower is better
    if (aircraft.altitude && aircraft.altitude < 100) {
      confidence += 0.2;
    }
    
    // Check speed - slower is better for landing
    if (aircraft.speed && aircraft.speed < 150) {
      confidence += 0.1;
    }
    
    // Check vertical rate - descending
    if (aircraft.vertical_rate && aircraft.vertical_rate < -200) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Determine which airport the aircraft is operating at
   */
  determineAirport(aircraft) {
    // Use the connector's configured airport
    if (this.airport) {
      const distance = this.calculateDistance(
        aircraft.lat, aircraft.lon,
        this.airport.lat, this.airport.lon
      );
      
      // If aircraft is within 10km of configured airport, use it
      if (distance < 10) {
        return this.airport;
      }
    }

    // Fallback to known airport coordinates (can be expanded)
    const airports = {
      'EGPK': { // Prestwick
        name: 'Glasgow Prestwick Airport',
        icao: 'EGPK',
        lat: 55.5074,
        lon: -4.5933,
        runways: [
          { id: '12/30', heading: 120, length: 2987, lat: 55.5074, lon: -4.5933 },
          { id: '03/21', heading: 30, length: 2987, lat: 55.5074, lon: -4.5933 }
        ]
      },
      'EGPF': { // Glasgow
        name: 'Glasgow Airport',
        icao: 'EGPF',
        lat: 55.8719,
        lon: -4.4331,
        runways: [
          { id: '05/23', heading: 50, length: 2658, lat: 55.8719, lon: -4.4331 }
        ]
      },
      'EGAA': { // Belfast
        name: 'Belfast International Airport',
        icao: 'EGAA',
        lat: 54.6575,
        lon: -6.2158,
        runways: [
          { id: '07/25', heading: 70, length: 2780, lat: 54.6575, lon: -6.2158 }
        ]
      }
    };

    // Find closest airport
    let closestAirport = null;
    let closestDistance = Infinity;

    for (const [icao, airport] of Object.entries(airports)) {
      const distance = this.calculateDistance(
        aircraft.lat, aircraft.lon,
        airport.lat, airport.lon
      );
      
      if (distance < closestDistance && distance < 10) { // Within 10km
        closestDistance = distance;
        closestAirport = airport;
      }
    }

    return closestAirport;
  }

  /**
   * Determine which runway is likely in use based on aircraft position and heading
   */
  determineRunway(aircraft, airport) {
    if (!airport || !aircraft.heading) {
      return null;
    }

    let bestRunway = null;
    let bestScore = 0;

    for (const runway of airport.runways) {
      // Calculate heading difference
      const headingDiff = Math.abs(aircraft.heading - runway.heading);
      const normalizedDiff = Math.min(headingDiff, 360 - headingDiff);
      
      // Score based on heading alignment (lower difference = higher score)
      const headingScore = Math.max(0, 1 - (normalizedDiff / 45)); // 45 degrees tolerance
      
      // Distance from runway centerline
      const distance = this.calculateDistance(
        aircraft.lat, aircraft.lon,
        runway.lat, runway.lon
      );
      const distanceScore = Math.max(0, 1 - (distance / 2)); // 2km tolerance
      
      const totalScore = (headingScore * 0.7) + (distanceScore * 0.3);
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestRunway = runway;
      }
    }

    return bestScore > 0.5 ? bestRunway : null;
  }

  /**
   * Calculate distance between two coordinates in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Track runway usage and determine active runway
   */
  trackRunwayUsage(aircraft, airport) {
    if (!airport || !aircraft.heading) {
      return null;
    }

    const runway = this.determineRunway(aircraft, airport);
    if (!runway) {
      return null;
    }

    // Track runway usage for this aircraft
    const aircraftKey = aircraft.icao24;
    if (!this.runwayUsage) {
      this.runwayUsage = new Map();
    }

    if (!this.runwayUsage.has(aircraftKey)) {
      this.runwayUsage.set(aircraftKey, {
        runway: runway,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        usageCount: 1
      });
    } else {
      const usage = this.runwayUsage.get(aircraftKey);
      usage.lastSeen = Date.now();
      usage.usageCount++;
    }

    // Determine most active runway in the last 30 minutes
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    const recentUsage = new Map();

    for (const [icao, usage] of this.runwayUsage.entries()) {
      if (usage.lastSeen > thirtyMinutesAgo) {
        const runwayId = usage.runway.id;
        if (!recentUsage.has(runwayId)) {
          recentUsage.set(runwayId, 0);
        }
        recentUsage.set(runwayId, recentUsage.get(runwayId) + usage.usageCount);
      }
    }

    // Find most used runway
    let mostUsedRunway = null;
    let maxUsage = 0;

    for (const [runwayId, usage] of recentUsage.entries()) {
      if (usage > maxUsage) {
        maxUsage = usage;
        mostUsedRunway = runwayId;
      }
    }

    // Update airport runway status
    if (airport.runways) {
      for (const rwy of airport.runways) {
        rwy.active = (rwy.id === mostUsedRunway);
      }
    }

    return {
      currentRunway: runway,
      mostActiveRunway: mostUsedRunway,
      usageStats: Object.fromEntries(recentUsage)
    };
  }

  /**
   * Get current runway status
   */
  getRunwayStatus() {
    if (!this.airport || !this.airport.runways) {
      return null;
    }

    return {
      airport: this.airport.icao,
      runways: this.airport.runways.map(rwy => ({
        id: rwy.id,
        heading: rwy.heading,
        length: rwy.length,
        active: rwy.active,
        lastUpdate: Date.now()
      })),
      usageStats: this.runwayUsage ? Object.fromEntries(this.runwayUsage) : {}
    };
  }

  /**
   * Check if airspace type requires clearance
   */
  requiresClearance(airspaceType) {
    return ['CTR', 'CTA', 'TMA'].includes(airspaceType);
  }

  /**
   * Assess danger area risk level
   */
  assessDangerAreaRisk(aircraft, airspace) {
    // Simple risk assessment - could be enhanced with more sophisticated logic
    return 'medium'; // low, medium, high
  }

  /**
   * Detect military activity in airspace
   */
  detectMilitaryActivity(airspace) {
    // Simple detection - could be enhanced with more sophisticated logic
    return 'unknown'; // unknown, training, refueling, etc.
  }

  /**
   * Estimate hold time for aircraft
   */
  estimateHoldTime(aircraft, airspace) {
    // Simple estimation - could be enhanced with more sophisticated logic
    return 15; // minutes
  }

  /**
   * Get capability definitions for this connector
   */
  static getCapabilityDefinitions() {
    return [
      {
        id: 'aircraft:tracking',
        name: 'Aircraft Tracking',
        description: 'Track aircraft positions, movements, and status',
        category: 'tracking',
        operations: ['get', 'subscribe', 'filter', 'history'],
        dataTypes: ['aircraft:current', 'aircraft:history', 'aircraft:changes'],
        events: ['aircraft:appeared', 'aircraft:disappeared', 'aircraft:moved', 'aircraft:emergency'],
        parameters: {
          icao24: { type: 'string', required: false },
          callsign: { type: 'string', required: false },
          filter: { type: 'object', required: false }
        }
      },
      {
        id: 'zones:management',
        name: 'Zone Management',
        description: 'Define and manage spatial zones for aircraft monitoring',
        category: 'spatial',
        operations: ['create', 'update', 'delete', 'list', 'monitor'],
        dataTypes: ['zone:definition', 'zone:violation', 'zone:status'],
        events: ['zone:entered', 'zone:exited', 'zone:violation'],
        parameters: {
          zoneId: { type: 'string', required: false },
          zoneType: { type: 'string', required: false },
          coordinates: { type: 'array', required: false }
        }
      },
      {
        id: 'radar:display',
        name: 'Radar Display',
        description: 'Real-time radar display of aircraft positions',
        category: 'visualization',
        operations: ['get', 'configure', 'filter', 'export'],
        dataTypes: ['radar:display', 'radar:trails', 'radar:alerts'],
        events: ['radar:update', 'radar:alert', 'radar:emergency'],
        parameters: {
          range: { type: 'number', required: false },
          center: { type: 'object', required: false },
          filter: { type: 'object', required: false }
        }
      },
      {
        id: 'events:smart',
        name: 'Smart Events',
        description: 'Generate intelligent events based on aircraft behavior and zones',
        category: 'intelligence',
        operations: ['generate', 'configure', 'list', 'subscribe'],
        dataTypes: ['event:smart', 'event:pattern', 'event:rule'],
        events: ['event:generated', 'event:pattern:detected', 'event:rule:triggered'],
        parameters: {
          eventType: { type: 'string', required: false },
          pattern: { type: 'object', required: false },
          rule: { type: 'object', required: false }
        }
      },
      {
        id: 'emergency:monitoring',
        name: 'Emergency Monitoring',
        description: 'Monitor and handle emergency situations',
        category: 'safety',
        operations: ['monitor', 'alert', 'log', 'escalate'],
        dataTypes: ['emergency:status', 'emergency:alert', 'emergency:log'],
        events: ['emergency:detected', 'emergency:cleared', 'emergency:escalated'],
        parameters: {
          emergencyCode: { type: 'string', required: false },
          priority: { type: 'string', required: false },
          action: { type: 'string', required: false }
        }
      },
      {
        id: 'basestation:database',
        name: 'BaseStation Database',
        description: 'Access aircraft registration data from BaseStation.sqb database',
        category: 'database',
        operations: ['search', 'lookup', 'stats', 'export'],
        dataTypes: ['aircraft:registration', 'aircraft:search', 'database:stats'],
        events: ['database:connected', 'database:error', 'registry:loaded'],
        parameters: {
          icao24: { type: 'string', required: false },
          registration: { type: 'string', required: false },
          manufacturer: { type: 'string', required: false },
          type: { type: 'string', required: false },
          operator: { type: 'string', required: false },
          limit: { type: 'number', required: false }
        }
      },
      {
        id: 'squawk:analysis',
        name: 'Squawk Code Analysis',
        description: 'Analyze and manage UK aviation squawk codes for enhanced monitoring',
        category: 'intelligence',
        operations: ['lookup', 'search', 'analyze', 'stats', 'categories'],
        dataTypes: ['squawk:info', 'squawk:analysis', 'squawk:stats', 'squawk:categories'],
        events: ['squawk:analyzed', 'emergency:squawk', 'military:squawk', 'nato:squawk'],
        parameters: {
          code: { type: 'string', required: false },
          category: { type: 'string', required: false },
          authority: { type: 'string', required: false },
          description: { type: 'string', required: false },
          priority: { type: 'string', required: false }
        }
      }
    ];
  }

  /**
   * Execute capability operations
   */
  async executeCapability(capabilityId, operation, parameters) {
    try {
      let result;
      switch (capabilityId) {
        case 'aircraft:tracking':
          result = await this.executeAircraftTracking(operation, parameters);
          break;
        case 'zones:management':
          result = await this.executeZoneManagement(operation, parameters);
          break;
        case 'radar:display':
          result = await this.executeRadarDisplay(operation, parameters);
          break;
        case 'events:smart':
          result = await this.executeSmartEvents(operation, parameters);
          break;
        case 'emergency:monitoring':
          result = await this.executeEmergencyMonitoring(operation, parameters);
          break;
        case 'basestation:database':
          result = await this.executeBaseStationDatabase(operation, parameters);
          break;
        case 'squawk:analysis':
          result = await this.executeSquawkAnalysis(operation, parameters);
          break;
        default:
          throw new Error(`Unknown capability: ${capabilityId}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Capability execution failed: ${capabilityId}.${operation}`, error);
      throw error;
    }
  }

  /**
   * Execute aircraft tracking operations
   */
  async executeAircraftTracking(operation, parameters) {
    switch (operation) {
      case 'get':
        return this.getAircraft(parameters);
      case 'subscribe':
        return this.subscribeToAircraftUpdates(parameters);
      case 'filter':
        return this.filterAircraft(parameters);
      case 'history':
        return this.getAircraftHistory(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute zone management operations
   */
  async executeZoneManagement(operation, parameters) {
    switch (operation) {
      case 'create':
        return this.createZone(parameters);
      case 'update':
        return this.updateZone(parameters);
      case 'delete':
        return this.deleteZone(parameters);
      case 'list':
        return this.listZones(parameters);
      case 'monitor':
        return this.monitorZone(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute radar display operations
   */
  async executeRadarDisplay(operation, parameters) {
    switch (operation) {
      case 'get':
        return this.getRadarDisplay(parameters);
      case 'configure':
        return this.configureRadar(parameters);
      case 'filter':
        return this.filterRadarData(parameters);
      case 'export':
        return this.exportRadarData(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute smart events operations
   */
  async executeSmartEvents(operation, parameters) {
    switch (operation) {
      case 'generate':
        return this.generateSmartEvent(parameters);
      case 'configure':
        return this.configureSmartEvents(parameters);
      case 'list':
        return this.listSmartEvents(parameters);
      case 'subscribe':
        return this.subscribeToSmartEvents(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute emergency monitoring operations
   */
  async executeEmergencyMonitoring(operation, parameters) {
    switch (operation) {
      case 'monitor':
        return this.monitorEmergencies(parameters);
      case 'alert':
        return this.sendEmergencyAlert(parameters);
      case 'log':
        return this.logEmergency(parameters);
      case 'escalate':
        return this.escalateEmergency(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute BaseStation database operations
   */
  async executeBaseStationDatabase(operation, parameters) {
    switch (operation) {
      case 'search':
        return this.searchAircraft(parameters);
      case 'lookup':
        return this.getAircraftRegistration(parameters.icao24);
      case 'stats':
        return this.getStats();
      case 'export':
        return this.exportAircraftRegistry(parameters);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Execute squawk code analysis operations
   */
  async executeSquawkAnalysis(operation, parameters) {
    if (!this.squawkCodeService) {
      throw new Error('Squawk code service not available');
    }
    
    switch (operation) {
      case 'lookup':
        return this.squawkCodeService.lookupSquawkCode(parameters.code);
      case 'search':
        return this.squawkCodeService.searchSquawkCodes(parameters);
      case 'analyze':
        return this.analyzeAircraftSquawk(parameters.aircraft);
      case 'stats':
        return this.squawkCodeService.getStats();
      case 'categories':
        return {
          categories: this.squawkCodeService.getCategories(),
          emergencyCodes: this.squawkCodeService.getEmergencyCodes(),
          militaryCodes: this.squawkCodeService.getMilitaryCodes(),
          natoCodes: this.squawkCodeService.getNatoCodes()
        };
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Analyze aircraft squawk code
   */
  analyzeAircraftSquawk(aircraft) {
    if (!this.squawkCodeService || !aircraft) {
      return null;
    }
    
    return this.squawkCodeService.analyzeAircraftSquawk(aircraft);
  }

  /**
   * Connect to dump1090
   */
  async performConnect() {
    try {
      this.logger.info('Connecting to dump1090...', { url: this.url });
      
      // Test connection
      const response = await axios.get(this.url, { timeout: 5000 });
      
      if (response.status === 200) {
        this.logger.info('Successfully connected to dump1090');
        
        // Initialize BaseStation database if enabled
        if (this.enableBaseStationIntegration) {
          await this.initializeBaseStationDatabase();
        }
        
        // Initialize aircraft data service if available
        if (this.enableAircraftDataService && this.aircraftDataService) {
          try {
            await this.aircraftDataService.initialize();
            this.logger.info('Aircraft data service initialized successfully');
          } catch (error) {
            this.logger.warn('Failed to initialize aircraft data service', { error: error.message });
            this.enableAircraftDataService = false;
          }
        }
        
        this.startPolling();
        return true;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error('Failed to connect to dump1090', error);
      throw error;
    }
  }

  /**
   * Initialize BaseStation database connection
   */
  async initializeBaseStationDatabase() {
    try {
      this.logger.info('Initializing BaseStation database...', { path: this.baseStationDbPath });
      
      return new Promise((resolve, reject) => {
        this.baseStationDb = new sqlite3.Database(this.baseStationDbPath, sqlite3.OPEN_READONLY, (err) => {
          if (err) {
            this.logger.warn('Failed to connect to BaseStation database', { error: err.message });
            this.enableBaseStationIntegration = false;
            resolve(false);
          } else {
            this.logger.info('Successfully connected to BaseStation database');
            this.loadAircraftRegistry();
            resolve(true);
          }
        });
      });
    } catch (error) {
      this.logger.warn('BaseStation database initialization failed', { error: error.message });
      this.enableBaseStationIntegration = false;
      return false;
    }
  }

  /**
   * Load aircraft registry from BaseStation database
   */
  async loadAircraftRegistry() {
    if (!this.baseStationDb) return;
    
    try {
      const query = `
        SELECT 
          ModeS,
          Registration,
          ICAOTypeCode,
          Type,
          Manufacturer,
          OperatorFlagCode,
          SerialNo,
          YearBuilt,
          RegisteredOwners,
          Country
        FROM Aircraft 
        WHERE ModeS IS NOT NULL AND ModeS != ''
      `;
      
      return new Promise((resolve, reject) => {
        this.baseStationDb.all(query, [], (err, rows) => {
          if (err) {
            this.logger.error('Failed to load aircraft registry', { error: err.message });
            reject(err);
          } else {
            // Clear existing registry
            this.aircraftRegistry.clear();
            
            // Load aircraft data into registry
            for (const row of rows) {
              if (row.ModeS) {
                this.aircraftRegistry.set(row.ModeS.toUpperCase(), {
                  icao24: row.ModeS.toUpperCase(),
                  registration: row.Registration || null,
                  icaoTypeCode: row.ICAOTypeCode || null,
                  type: row.Type || null,
                  manufacturer: row.Manufacturer || null,
                  operatorFlagCode: row.OperatorFlagCode || null,
                  serialNo: row.SerialNo || null,
                  yearBuilt: row.YearBuilt || null,
                  owner: row.RegisteredOwners || null,
                  country: row.Country || null
                });
              }
            }
            
            this.logger.info('Aircraft registry loaded', { 
              count: this.aircraftRegistry.size,
              databasePath: this.baseStationDbPath 
            });
            resolve(this.aircraftRegistry.size);
          }
        });
      });
    } catch (error) {
      this.logger.error('Failed to load aircraft registry', { error: error.message });
      return 0;
    }
  }

  /**
   * Get aircraft registration data from BaseStation database
   */
  async getAircraftRegistration(icao24) {
    if (!this.enableBaseStationIntegration || !this.baseStationDb) {
      return null;
    }
    
    const icao24Upper = icao24.toUpperCase();
    
    // Check cache first
    if (this.aircraftRegistry.has(icao24Upper)) {
      this.performance.baseStationCacheHits++;
      return this.aircraftRegistry.get(icao24Upper);
    }
    
    // Query database
    this.performance.baseStationQueries++;
    
    try {
      const query = `
        SELECT 
          ModeS,
          Registration,
          ICAOTypeCode,
          Type,
          Manufacturer,
          OperatorFlagCode,
          SerialNo,
          YearBuilt,
          RegisteredOwners,
          Country
        FROM Aircraft 
        WHERE ModeS = ?
      `;
      
      return new Promise((resolve, reject) => {
        this.baseStationDb.get(query, [icao24Upper], (err, row) => {
          if (err) {
            this.logger.error('Failed to query aircraft registration', { icao24: icao24Upper, error: err.message });
            resolve(null);
          } else if (row) {
            const registrationData = {
              icao24: row.ModeS.toUpperCase(),
              registration: row.Registration || null,
              icaoTypeCode: row.ICAOTypeCode || null,
              type: row.Type || null,
              manufacturer: row.Manufacturer || null,
              operatorFlagCode: row.OperatorFlagCode || null,
              serialNo: row.SerialNo || null,
              yearBuilt: row.YearBuilt || null,
              owner: row.RegisteredOwners || null,
              country: row.Country || null
            };
            
            // Cache the result
            this.aircraftRegistry.set(icao24Upper, registrationData);
            resolve(registrationData);
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      this.logger.error('Failed to query aircraft registration', { icao24: icao24Upper, error: error.message });
      return null;
    }
  }

  /**
   * Search aircraft in BaseStation database
   */
  async searchAircraft(parameters = {}) {
    if (!this.enableBaseStationIntegration || !this.baseStationDb) {
      return { aircraft: [], count: 0 };
    }
    
    try {
      let query = `
        SELECT 
          ModeS,
          Registration,
          ICAOTypeCode,
          Type,
          Manufacturer,
          OperatorFlagCode,
          SerialNo,
          YearBuilt,
          RegisteredOwners,
          Country
        FROM Aircraft 
        WHERE 1=1
      `;
      
      const params = [];
      
      if (parameters.registration) {
        query += ` AND Registration LIKE ?`;
        params.push(`%${parameters.registration.toUpperCase()}%`);
      }
      
      if (parameters.manufacturer) {
        query += ` AND Manufacturer LIKE ?`;
        params.push(`%${parameters.manufacturer}%`);
      }
      
      if (parameters.type) {
        query += ` AND (Type LIKE ? OR ICAOTypeCode LIKE ?)`;
        params.push(`%${parameters.type}%`, `%${parameters.type}%`);
      }
      
      if (parameters.operator) {
        query += ` AND OperatorFlagCode LIKE ?`;
        params.push(`%${parameters.operator}%`);
      }
      
      query += ` ORDER BY Registration LIMIT ?`;
      params.push(parameters.limit || 100);
      
      return new Promise((resolve, reject) => {
        this.baseStationDb.all(query, params, (err, rows) => {
          if (err) {
            this.logger.error('Failed to search aircraft', { error: err.message });
            resolve({ aircraft: [], count: 0 });
          } else {
            const aircraft = rows.map(row => ({
              icao24: row.ModeS.toUpperCase(),
              registration: row.Registration || null,
              icaoTypeCode: row.ICAOTypeCode || null,
              type: row.Type || null,
              manufacturer: row.Manufacturer || null,
              operatorFlagCode: row.OperatorFlagCode || null,
              serialNo: row.SerialNo || null,
              yearBuilt: row.YearBuilt || null,
              owner: row.RegisteredOwners || null,
              country: row.Country || null
            }));
            
            resolve({ aircraft, count: aircraft.length });
          }
        });
      });
    } catch (error) {
      this.logger.error('Failed to search aircraft', { error: error.message });
      return { aircraft: [], count: 0 };
    }
  }

  /**
   * Disconnect from dump1090
   */
  async performDisconnect() {
    this.stopPolling();
    this.logger.info('Disconnected from dump1090');
    return true;
  }

  /**
   * Start polling for aircraft data
   */
  startPolling() {
    if (this.isPolling) {
      return;
    }
    
    this.isPolling = true;
    this.pollAircraftData();
    
    this.logger.info('Started aircraft data polling', { interval: this.pollInterval });
  }

  /**
   * Stop polling for aircraft data
   */
  stopPolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
    this.logger.info('Stopped aircraft data polling');
  }

  /**
   * Poll aircraft data from dump1090
   */
  async pollAircraftData() {
    if (!this.isPolling) {
      return;
    }

    const startTime = Date.now();
    
    try {
      const response = await axios.get(this.url, { timeout: 10000 });
      
      if (response.status === 200 && response.data) {
        await this.processAircraftData(response.data);
        
        // Check for flight timeouts
        if (this.enableFlightTracking) {
          this.checkFlightTimeouts();
        }
        
        // Update performance metrics
        const responseTime = Date.now() - startTime;
        this.performance.averageResponseTime = 
          (this.performance.averageResponseTime * this.performance.pollCount + responseTime) / 
          (this.performance.pollCount + 1);
        this.performance.pollCount++;
        this.performance.lastPoll = new Date().toISOString();
        this.performance.aircraftCount = this.aircraft.size;
        
        this.logger.debug('Aircraft data polled successfully', {
          aircraftCount: this.aircraft.size,
          activeFlights: this.activeFlights.size,
          responseTime: `${responseTime}ms`
        });
        
        // Publish periodic status event to event bus
        if (this.eventBus) {
          this.eventBus.publishEvent({
            type: 'adsb:status',
            source: this.id,
            timestamp: new Date().toISOString(),
            data: {
              aircraftCount: this.aircraft.size,
              activeFlights: this.activeFlights.size,
              responseTime: responseTime,
              performance: this.performance,
              metadata: {
                eventType: 'adsb_status',
                pollCount: this.performance.pollCount
              }
            }
          }).catch(error => {
            this.logger.debug('Failed to publish ADSB status event to event bus', { error: error.message });
          });
        }
      }
    } catch (error) {
      this.performance.errorCount++;
      this.logger.error('Failed to poll aircraft data', error);
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.pollAircraftData(), this.pollInterval);
  }

  /**
   * Process aircraft data from dump1090
   */
  async processAircraftData(data) {
    const now = Date.now();
    const newAircraft = new Map();
    const currentIcao24s = new Set();
    
    // Process each aircraft
    if (data.aircraft && Array.isArray(data.aircraft)) {
      for (const aircraftData of data.aircraft) {
        if (!aircraftData.hex) continue;
        
        const icao24 = aircraftData.hex.toUpperCase();
        currentIcao24s.add(icao24);
        
        // Create aircraft object
        const aircraft = {
          icao24: icao24,
          callsign: aircraftData.flight?.trim() || null,
          lat: aircraftData.lat || null,
          lon: aircraftData.lon || null,
          altitude: aircraftData.alt_baro || aircraftData.alt_geom || null,
          speed: aircraftData.gs || null,
          track: aircraftData.track || null,
          vertical_rate: aircraftData.baro_rate || null,
          squawk: aircraftData.squawk || null,
          emergency: aircraftData.squawk ? this.emergencyCodes.includes(aircraftData.squawk) : false,
          timestamp: now,
          last_seen: aircraftData.last_seen || now,
          messages: aircraftData.messages || 0,
          seen: aircraftData.seen || 0,
          rssi: aircraftData.rssi || null
        };
        
        // Enhance with BaseStation registration data if available
        if (this.enableBaseStationIntegration) {
          try {
            const registrationData = await this.getAircraftRegistration(icao24);
            if (registrationData) {
              aircraft.registration = registrationData.registration;
              aircraft.icaoTypeCode = registrationData.icaoTypeCode;
              aircraft.type = registrationData.type;
              aircraft.manufacturer = registrationData.manufacturer;
              aircraft.operatorFlagCode = registrationData.operatorFlagCode;
              aircraft.serialNo = registrationData.serialNo;
              aircraft.yearBuilt = registrationData.yearBuilt;
              aircraft.owner = registrationData.owner;
              aircraft.operator = registrationData.operator;
              
              // Use registration as display name if callsign is not available
              if (!aircraft.callsign && aircraft.registration) {
                aircraft.displayName = aircraft.registration;
              } else if (aircraft.callsign) {
                aircraft.displayName = aircraft.callsign;
              } else {
                aircraft.displayName = aircraft.icao24;
              }
            } else {
              // No registration data found
              aircraft.displayName = aircraft.callsign || aircraft.icao24;
            }
          } catch (error) {
            this.logger.debug('Failed to get registration data for aircraft', { 
              icao24, 
              error: error.message 
            });
            aircraft.displayName = aircraft.callsign || aircraft.icao24;
          }
        } else {
          aircraft.displayName = aircraft.callsign || aircraft.icao24;
        }
        
        // Process airspace data if available
        if (this.enableAirspaceAwareness && this.airspaceService && aircraft.lat && aircraft.lon) {
          try {
            this.performance.airspaceQueries++;
            const airspaceUpdate = this.airspaceService.updateAircraftAirspace(aircraft);
            
            // Add airspace context to aircraft
            aircraft.airspace = airspaceUpdate.current;
            aircraft.airspaceContext = this.generateAirspaceContext(airspaceUpdate.current);
            
            // Store airspace context for this aircraft
            this.aircraftAirspaceContext.set(icao24, {
              current: airspaceUpdate.current,
              new: airspaceUpdate.new,
              exited: airspaceUpdate.exited,
              timestamp: now
            });
            
            // Process airspace events
            if (airspaceUpdate.new && airspaceUpdate.new.length > 0) {
              for (const airspace of airspaceUpdate.new) {
                this.handleAirspaceEvent({
                  type: 'airspace:entry',
                  aircraft: aircraft,
                  airspace: airspace,
                  timestamp: now
                });
              }
            }
            
            if (airspaceUpdate.exited && airspaceUpdate.exited.length > 0) {
              for (const airspace of airspaceUpdate.exited) {
                this.handleAirspaceEvent({
                  type: 'airspace:exit',
                  aircraft: aircraft,
                  airspace: airspace,
                  timestamp: now
                });
              }
            }
          } catch (error) {
            this.logger.debug('Failed to process airspace data for aircraft', { 
              icao24, 
              error: error.message,
              airspaceServiceAvailable: !!this.airspaceService,
              enableAirspaceAwareness: this.enableAirspaceAwareness
            });
          }
        }
        
        // Process ground events for aircraft on the ground
        if (this.enableGroundEventDetection && aircraft.lat && aircraft.lon && aircraft.altitude) {
          try {
            // Check if aircraft is on ground and generate appropriate events
            if (this.isAircraftOnGround(aircraft)) {
              // Get current airspace context for the aircraft
              const airspaceContext = this.aircraftAirspaceContext.get(icao24);
              const currentAirspace = airspaceContext?.current?.[0] || null;
              
              // Generate ground movement event
              this.generateGroundMovementEvent(aircraft, currentAirspace);
              
              // Generate helicopter specific events
              if (this.isHelicopter(aircraft)) {
                this.generateHelicopterEvent(aircraft, currentAirspace);
              }
              
              // Generate taxi events
              if (this.isAircraftTaxiing(aircraft)) {
                this.generateTaxiEvent(aircraft, currentAirspace);
              }
              
              // Generate parking events
              if (this.isAircraftParked(aircraft)) {
                this.generateParkingEvent(aircraft, currentAirspace);
              }
            }
          } catch (error) {
            this.logger.debug('Failed to process ground events for aircraft', { 
              icao24, 
              error: error.message 
            });
          }
        }
        
        // Enhance with squawk code analysis if available
        if (this.enableSquawkCodeAnalysis && this.squawkCodeService && aircraft.squawk) {
          try {
            this.performance.squawkCodeQueries++;
            const squawkEvent = this.squawkCodeService.analyzeAircraftSquawk(aircraft);
            
            if (squawkEvent) {
              aircraft.squawkAnalysis = squawkEvent;
              
              // Handle squawk code events
              this.handleSquawkCodeEvent(squawkEvent);
            }
          } catch (error) {
            this.logger.debug('Failed to analyze squawk code for aircraft', { 
              icao24, 
              error: error.message 
            });
          }
        }
        
        // Store aircraft data
        newAircraft.set(icao24, aircraft);
        
        // Check if this is a new aircraft
        if (!this.aircraft.has(icao24)) {
          this.handleAircraftAppearance(aircraft);
        } else {
          // Update existing aircraft
          const oldAircraft = this.aircraft.get(icao24);
          await this.handleAircraftUpdate(oldAircraft, aircraft);
        }
        
        // Update aircraft in main storage
        this.aircraft.set(icao24, aircraft);
      }
    }
    
    // Check for disappeared aircraft
    for (const [icao24, aircraft] of this.aircraft.entries()) {
      if (!currentIcao24s.has(icao24)) {
        await this.handleAircraftDisappearance(aircraft);
        this.aircraft.delete(icao24);
      }
    }
    
    // Broadcast aircraft data to other connectors
    this.broadcastAircraftData(Array.from(newAircraft.values()));
  }
  
  /**
   * Broadcast aircraft data to other connectors
   */
  broadcastAircraftData(aircraftList) {
    try {
      // Find radar connector and send aircraft data
      if (this.connectorRegistry) {
        const radarConnector = this.connectorRegistry.getConnector('radar-main');
        if (radarConnector && radarConnector.updateAircraftData) {
          radarConnector.updateAircraftData(aircraftList);
        }
      }
    } catch (error) {
      this.logger.debug('Failed to broadcast aircraft data', { error: error.message });
    }
  }

  /**
   * Get emergency type based on squawk code
   */
  getEmergencyType(squawk) {
    switch (squawk) {
      case '7500':
        return 'hijacking';
      case '7600':
        return 'radio_failure';
      case '7700':
        return 'general_emergency';
      default:
        return 'unknown';
    }
  }

  /**
   * Handle aircraft appearance
   */
  handleAircraftAppearance(aircraft) {
    this.appearances.push({
      ...aircraft,
      appeared_at: new Date().toISOString()
    });
    
    // Keep only recent appearances
    if (this.appearances.length > 100) {
      this.appearances = this.appearances.slice(-100);
    }
    
    this.recentChanges.push({
      type: 'appearance',
      aircraft: aircraft,
      timestamp: new Date().toISOString()
    });
    
    this.emit('aircraft:appeared', aircraft);
    
    // Publish to event bus for rule processing
    if (this.eventBus) {
      this.eventBus.publishEvent({
        type: 'aircraft:appeared',
        source: this.id,
        timestamp: new Date().toISOString(),
        data: {
          aircraft: aircraft,
          metadata: {
            eventType: 'aircraft_appearance',
            icao24: aircraft.icao24,
            callsign: aircraft.callsign
          }
        }
      }).catch(error => {
        this.logger.debug('Failed to publish aircraft appearance event to event bus', { error: error.message });
      });
    }
    
    this.logger.info('Aircraft appeared', {
      icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      lat: aircraft.lat,
      lon: aircraft.lon
    });
  }

  /**
   * Handle aircraft update
   */
  async handleAircraftUpdate(oldAircraft, newAircraft) {
    const changes = {};
    
    // Check for significant changes
    if (newAircraft.lat !== oldAircraft.lat || newAircraft.lon !== oldAircraft.lon) {
      changes.position = {
        old: { lat: oldAircraft.lat, lon: oldAircraft.lon },
        new: { lat: newAircraft.lat, lon: newAircraft.lon }
      };
    }
    
    if (newAircraft.altitude !== oldAircraft.altitude) {
      changes.altitude = { old: oldAircraft.altitude, new: newAircraft.altitude };
    }
    
    if (newAircraft.speed !== oldAircraft.speed) {
      changes.speed = { old: oldAircraft.speed, new: newAircraft.speed };
    }
    
    if (newAircraft.emergency !== oldAircraft.emergency) {
      changes.emergency = { old: oldAircraft.emergency, new: newAircraft.emergency };
      
      if (newAircraft.emergency) {
        this.handleEmergency(newAircraft);
      }
    }
    
    // Flight tracking integration
    if (this.enableFlightTracking) {
      const wasInFlight = this.isAircraftInFlight(oldAircraft);
      const isInFlight = this.isAircraftInFlight(newAircraft);
      const isTracked = this.activeFlights.has(newAircraft.icao24);
      
      if (!wasInFlight && isInFlight) {
        // Aircraft just started flying
        await this.startFlightTracking(newAircraft);
      } else if (wasInFlight && isInFlight) {
        // Aircraft continues flying, update tracking
        if (isTracked) {
          await this.updateFlightTracking(newAircraft);
        } else {
          // Aircraft is in flight but not being tracked (first appearance while in flight)
          await this.startFlightTracking(newAircraft);
        }
      } else if (wasInFlight && !isInFlight) {
        // Aircraft stopped flying
        await this.endFlightTracking(newAircraft, 'landed');
      }
    }
    
    if (Object.keys(changes).length > 0) {
      this.recentChanges.push({
        type: 'update',
        aircraft: newAircraft,
        changes: changes,
        timestamp: new Date().toISOString()
      });
      
      this.emit('aircraft:moved', { aircraft: newAircraft, changes: changes });
      
      // Publish significant changes to event bus for rule processing
      if (this.eventBus && (changes.position || changes.altitude || changes.speed)) {
        this.eventBus.publishEvent({
          type: 'aircraft:updated',
          source: this.id,
          timestamp: new Date().toISOString(),
          data: {
            aircraft: newAircraft,
            changes: changes,
            metadata: {
              eventType: 'aircraft_update',
              icao24: newAircraft.icao24,
              callsign: newAircraft.callsign
            }
          }
        }).catch(error => {
          this.logger.debug('Failed to publish aircraft update event to event bus', { error: error.message });
        });
      }
    }
  }

  /**
   * Handle aircraft disappearance
   */
  async handleAircraftDisappearance(aircraft) {
    this.disappearances.push({
      ...aircraft,
      disappeared_at: new Date().toISOString()
    });
    
    // Keep only recent disappearances
    if (this.disappearances.length > 100) {
      this.disappearances = this.disappearances.slice(-100);
    }
    
    this.recentChanges.push({
      type: 'disappearance',
      aircraft: aircraft,
      timestamp: new Date().toISOString()
    });
    
    // Flight tracking integration - end flight if aircraft disappears
    if (this.enableFlightTracking) {
      await this.endFlightTracking(aircraft, 'disappeared');
    }
    
    this.emit('aircraft:disappeared', aircraft);
    
    // Publish to event bus for rule processing
    if (this.eventBus) {
      this.eventBus.publishEvent({
        type: 'aircraft:disappeared',
        source: this.id,
        timestamp: new Date().toISOString(),
        data: {
          aircraft: aircraft,
          metadata: {
            eventType: 'aircraft_disappearance',
            icao24: aircraft.icao24,
            callsign: aircraft.callsign
          }
        }
      }).catch(error => {
        this.logger.debug('Failed to publish aircraft disappearance event to event bus', { error: error.message });
      });
    }
    
    this.logger.info('Aircraft disappeared', {
      icao24: aircraft.icao24,
      callsign: aircraft.callsign
    });
  }

  /**
   * Handle emergency situation
   */
  handleEmergency(aircraft) {
    const emergencyType = this.getEmergencyType(aircraft.squawk);
    
    const emergencyEvent = {
      id: `emergency_${aircraft.icao24}_${Date.now()}`,
      timestamp: new Date(),
      type: 'emergency:detected',
      aircraft: aircraft,
      metadata: {
        eventType: 'emergency',
        emergencyType: emergencyType,
        squawk: aircraft.squawk,
        severity: 'high'
      }
    };
    
    this.events.push(emergencyEvent);
    this.emit('emergency:detected', emergencyEvent);
    
    // Publish to event bus for rule processing
    if (this.eventBus) {
      this.eventBus.publishEvent({
        type: 'emergency:detected',
        source: this.id,
        timestamp: new Date().toISOString(),
        data: {
          aircraft: aircraft,
          emergencyType: emergencyType,
          squawk: aircraft.squawk,
          metadata: emergencyEvent.metadata
        }
      }).catch(error => {
        this.logger.debug('Failed to publish emergency event to event bus', { error: error.message });
      });
    }
    
    this.logger.warn('Emergency detected', {
      icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      squawk: aircraft.squawk,
      emergencyType: emergencyType
    });
  }

  /**
   * Get aircraft data
   */
  getAircraft(parameters = {}) {
    let aircraft = Array.from(this.aircraft.values());
    
    // Apply filters
    if (parameters.icao24) {
      aircraft = aircraft.filter(a => a.icao24 === parameters.icao24.toUpperCase());
    }
    
    if (parameters.callsign) {
      aircraft = aircraft.filter(a => a.callsign && a.callsign.includes(parameters.callsign.toUpperCase()));
    }
    
    if (parameters.filter) {
      aircraft = aircraft.filter(a => this.applyFilter(a, parameters.filter));
    }
    
    return {
      aircraft: aircraft,
      count: aircraft.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Apply filter to aircraft
   */
  applyFilter(aircraft, filter) {
    for (const [key, value] of Object.entries(filter)) {
      switch (key) {
        case 'emergency':
          if (aircraft.emergency !== value) return false;
          break;
        case 'min_altitude':
          if (aircraft.altitude && aircraft.altitude < value) return false;
          break;
        case 'max_altitude':
          if (aircraft.altitude && aircraft.altitude > value) return false;
          break;
        case 'min_speed':
          if (aircraft.speed && aircraft.speed < value) return false;
          break;
        case 'max_speed':
          if (aircraft.speed && aircraft.speed > value) return false;
          break;
        case 'within_range':
          if (value.center && value.range) {
            const distance = this.spatialUtils.calculateDistance(
              value.center.lat, value.center.lon,
              aircraft.lat, aircraft.lon
            );
            if (distance > value.range) return false;
          }
          break;
      }
    }
    return true;
  }

  /**
   * Get aircraft history
   */
  getAircraftHistory(parameters = {}) {
    const icao24 = parameters.icao24?.toUpperCase();
    if (!icao24) {
      throw new Error('ICAO24 is required for history lookup');
    }
    
    return this.aircraftHistory.get(icao24) || [];
  }

  /**
   * Create a zone
   */
  createZone(parameters) {
    const zoneId = parameters.zoneId || `zone_${Date.now()}`;
    const zoneType = parameters.zoneType || 'custom';
    
    if (!parameters.coordinates || !Array.isArray(parameters.coordinates)) {
      throw new Error('Zone coordinates are required');
    }
    
    const zone = {
      id: zoneId,
      name: parameters.name || `Zone ${zoneId}`,
      type: zoneType,
      coordinates: parameters.coordinates,
      properties: parameters.properties || {},
      created: new Date().toISOString(),
      active: true,
      violations: []
    };
    
    this.zones.set(zoneId, zone);
    
    this.emit('zone:created', zone);
    
    this.logger.info('Zone created', {
      zoneId: zoneId,
      type: zoneType,
      coordinates: parameters.coordinates.length
    });
    
    return zone;
  }

  /**
   * Update a zone
   */
  updateZone(parameters) {
    const zoneId = parameters.zoneId;
    if (!zoneId) {
      throw new Error('Zone ID is required');
    }
    
    const zone = this.zones.get(zoneId);
    if (!zone) {
      throw new Error(`Zone not found: ${zoneId}`);
    }
    
    // Update zone properties
    if (parameters.name) zone.name = parameters.name;
    if (parameters.coordinates) zone.coordinates = parameters.coordinates;
    if (parameters.properties) zone.properties = { ...zone.properties, ...parameters.properties };
    if (parameters.active !== undefined) zone.active = parameters.active;
    
    zone.updated = new Date().toISOString();
    
    this.emit('zone:updated', zone);
    
    this.logger.info('Zone updated', { zoneId: zoneId });
    
    return zone;
  }

  /**
   * Delete a zone
   */
  deleteZone(parameters) {
    const zoneId = parameters.zoneId;
    if (!zoneId) {
      throw new Error('Zone ID is required');
    }
    
    const zone = this.zones.get(zoneId);
    if (!zone) {
      throw new Error(`Zone not found: ${zoneId}`);
    }
    
    this.zones.delete(zoneId);
    
    this.emit('zone:deleted', zone);
    
    this.logger.info('Zone deleted', { zoneId: zoneId });
    
    return { success: true, zoneId: zoneId };
  }

  /**
   * List zones
   */
  listZones(parameters = {}) {
    let zones = Array.from(this.zones.values());
    
    if (parameters.type) {
      zones = zones.filter(z => z.type === parameters.type);
    }
    
    if (parameters.active !== undefined) {
      zones = zones.filter(z => z.active === parameters.active);
    }
    
    return {
      zones: zones,
      count: zones.length,
      types: Object.keys(this.zoneTypes)
    };
  }

  /**
   * Check aircraft against zones
   */
  async checkZones() {
    for (const [zoneId, zone] of this.zones) {
      if (!zone.active) continue;
      
      for (const [icao24, aircraft] of this.aircraft) {
        if (!aircraft.lat || !aircraft.lon) continue;
        
        const isInZone = this.spatialUtils.pointInPolygon(
          { lat: aircraft.lat, lon: aircraft.lon },
          zone.coordinates
        );
        
        const wasInZone = zone.violations.some(v => 
          v.icao24 === icao24 && v.status === 'active'
        );
        
        if (isInZone && !wasInZone) {
          // Aircraft entered zone
          const violation = {
            id: `violation_${zoneId}_${icao24}_${Date.now()}`,
            zoneId: zoneId,
            zoneName: zone.name,
            zoneType: zone.type,
            icao24: icao24,
            aircraft: aircraft,
            timestamp: new Date().toISOString(),
            status: 'active'
          };
          
          zone.violations.push(violation);
          this.performance.zoneViolations++;
          
          this.emit('zone:entered', violation);
          
          this.logger.info('Aircraft entered zone', {
            zoneId: zoneId,
            zoneName: zone.name,
            icao24: icao24,
            callsign: aircraft.callsign
          });
        } else if (!isInZone && wasInZone) {
          // Aircraft exited zone
          const violation = zone.violations.find(v => 
            v.icao24 === icao24 && v.status === 'active'
          );
          
          if (violation) {
            violation.status = 'resolved';
            violation.resolved_at = new Date().toISOString();
            
            this.emit('zone:exited', violation);
            
            this.logger.info('Aircraft exited zone', {
              zoneId: zoneId,
              zoneName: zone.name,
              icao24: icao24,
              callsign: aircraft.callsign
            });
          }
        }
      }
      
      // Clean up old violations
      zone.violations = zone.violations.filter(v => 
        v.status === 'active' || 
        (new Date() - new Date(v.timestamp)) < 24 * 60 * 60 * 1000 // Keep for 24 hours
      );
    }
  }

  /**
   * Get radar display data
   */
  getRadarDisplay(parameters = {}) {
    const range = parameters.range || this.radarConfig.range;
    const center = parameters.center || this.radarConfig.center;
    const filter = parameters.filter || {};
    const showAirspace = parameters.showAirspace !== undefined ? parameters.showAirspace : this.radarConfig.showAirspace;
    
    let aircraft = Array.from(this.aircraft.values());
    
    // Filter by range if center is specified
    if (center.lat && center.lon) {
      aircraft = aircraft.filter(a => {
        if (!a.lat || !a.lon) return false;
        const distance = this.spatialUtils.calculateDistance(
          center.lat, center.lon, a.lat, a.lon
        );
        return distance <= range;
      });
    }
    
    // Apply additional filters
    if (filter.emergency !== undefined) {
      aircraft = aircraft.filter(a => a.emergency === filter.emergency);
    }
    
    if (filter.min_altitude !== undefined) {
      aircraft = aircraft.filter(a => a.altitude && a.altitude >= filter.min_altitude);
    }
    
    if (filter.max_altitude !== undefined) {
      aircraft = aircraft.filter(a => a.altitude && a.altitude <= filter.max_altitude);
    }
    
    // Filter by airspace type if specified
    if (filter.airspaceType) {
      aircraft = aircraft.filter(a => 
        a.airspace && a.airspace.some(space => space.type === filter.airspaceType)
      );
    }
    
    // Filter by airspace priority if specified
    if (filter.airspacePriority) {
      aircraft = aircraft.filter(a => 
        a.airspaceContext && a.airspaceContext.priority === filter.airspacePriority
      );
    }
    
    // Add calculated fields for display
    const displayAircraft = aircraft.map(a => ({
      ...a,
      distance: center.lat && center.lon ? 
        this.spatialUtils.calculateDistance(center.lat, center.lon, a.lat, a.lon) : null,
      bearing: center.lat && center.lon ? 
        this.spatialUtils.calculateBearing(center.lat, center.lon, a.lat, a.lon) : null,
      // Enhanced display information with airspace context
      displayInfo: this.generateAircraftDisplayInfo(a)
    }));
    
    // Get airspace data for visualization if enabled
    let airspaces = [];
    if (showAirspace && this.enableAirspaceAwareness && this.airspaceService) {
      try {
        airspaces = this.airspaceService.getAirspaceForVisualization(center, range);
      } catch (error) {
        this.logger.debug('Failed to get airspace data for radar display', { error: error.message });
      }
    }
    
    return {
      aircraft: displayAircraft,
      airspaces: airspaces,
      count: displayAircraft.length,
      airspaceCount: airspaces.length,
      range: range,
      center: center,
      timestamp: new Date().toISOString(),
      config: this.radarConfig,
      airspaceEnabled: this.enableAirspaceAwareness && showAirspace
    };
  }

  /**
   * Generate enhanced display information for aircraft
   */
  generateAircraftDisplayInfo(aircraft) {
    const info = {
      callsign: aircraft.callsign || aircraft.icao24,
      registration: aircraft.registration,
      type: aircraft.type,
      altitude: aircraft.altitude ? `${Math.round(aircraft.altitude)}ft` : 'Unknown',
      speed: aircraft.speed ? `${Math.round(aircraft.speed)}kt` : 'Unknown',
      heading: aircraft.track ? `${Math.round(aircraft.track)}°` : 'Unknown',
      squawk: aircraft.squawk || 'Unknown',
      emergency: aircraft.emergency,
      airspaceContext: null
    };
    
    // Add airspace context information
    if (aircraft.airspaceContext) {
      info.airspaceContext = {
        type: aircraft.airspaceContext.type,
        name: aircraft.airspaceContext.name,
        description: aircraft.airspaceContext.description,
        priority: aircraft.airspaceContext.priority,
        requiresClearance: aircraft.airspaceContext.requiresClearance,
        airspaceCount: aircraft.airspaceContext.airspaceCount
      };
      
      // Add specific airspace information
      if (aircraft.airspace && aircraft.airspace.length > 0) {
        info.airspaces = aircraft.airspace.map(space => ({
          name: space.name,
          type: space.type,
          color: this.getAirspaceDisplayColor(space.type)
        }));
      }
    }
    
    // Add status indicators
    info.status = {
      emergency: aircraft.emergency,
      inControlledAirspace: aircraft.airspaceContext?.requiresClearance || false,
      onApproach: aircraft.airspace?.some(space => space.type === 'Final_Approach') || false,
      inDangerArea: aircraft.airspace?.some(space => space.type === 'Danger_Area') || false,
      inMilitaryAirspace: aircraft.airspace?.some(space => space.type === 'Military') || false
    };
    
    return info;
  }

  /**
   * Get display color for airspace type
   */
  getAirspaceDisplayColor(type) {
    const colors = {
      'Final_Approach': '#00FF00',
      'Final_Approach_20nm': '#00FF00',
      'ATZ': '#FFD700',
      'CTA': '#FFA500',
      'TMA': '#FFA500',
      'CTR': '#FF0000',
      'Danger_Area': '#FF00FF',
      'FIR': '#0000FF',
      'LARS': '#00FFFF',
      'Military': '#800080',
      'VOR': '#FFFF00',
      'Holding_Pattern': '#FF8000',
      'Airway_Lower': '#0080FF',
      'Airway_Upper': '#8000FF'
    };
    
    return colors[type] || '#808080';
  }

  /**
   * Configure radar display
   */
  configureRadar(parameters) {
    // Safety check - ensure radarConfig is always defined
    if (!this.radarConfig) {
      this.radarConfig = {
        range: 50,
        center: { lat: 55.5074, lon: -4.5933 },
        zoom: 10,
        rotation: 0,
        sweepSpeed: 4,
        showTrails: true,
        trailLength: 20,
        showLabels: true,
        showAltitude: true,
        showSpeed: true,
        showHeading: true,
        showSquawk: true,
        showEmergency: true,
        colorByAltitude: true,
        colorBySpeed: true,
        colorByType: true,
        showCoastline: true,
        coastlineColor: '#0066cc',
        coastlineWidth: 2,
        coastlineOpacity: 0.8
      };
      this.logger.info('ADSB radar config initialized with defaults');
    }
    
    if (parameters.range !== undefined) {
      this.radarConfig.range = parameters.range;
    }
    
    if (parameters.center !== undefined) {
      this.radarConfig.center = parameters.center;
    }
    
    if (parameters.displayMode !== undefined) {
      this.radarConfig.displayMode = parameters.displayMode;
    }
    
    if (parameters.showTrails !== undefined) {
      this.radarConfig.showTrails = parameters.showTrails;
    }
    
    if (parameters.trailLength !== undefined) {
      this.radarConfig.trailLength = parameters.trailLength;
    }
    
    this.logger.info('Radar configuration updated', this.radarConfig);
    
    return this.radarConfig;
  }

  /**
   * Generate smart events
   */
  async generateSmartEvents() {
    const events = [];
    
    // Check for patterns in aircraft behavior
    for (const [icao24, aircraft] of this.aircraft) {
      // Low altitude alert
      if (aircraft.altitude && aircraft.altitude < 1000) {
        events.push({
          type: 'low_altitude',
          aircraft: aircraft,
          priority: 'medium',
          timestamp: new Date().toISOString()
        });
      }
      
      // High speed alert
      if (aircraft.speed && aircraft.speed > 500) {
        events.push({
          type: 'high_speed',
          aircraft: aircraft,
          priority: 'medium',
          timestamp: new Date().toISOString()
        });
      }
      
      // Rapid descent
      if (aircraft.vertical_rate && aircraft.vertical_rate < -2000) {
        events.push({
          type: 'rapid_descent',
          aircraft: aircraft,
          priority: 'high',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Add events to history
    this.events.push(...events);
    
    // Keep only recent events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
    
    // Emit events
    for (const event of events) {
      this.emit('event:generated', event);
    }
    
    return events;
  }

  /**
   * Get smart events
   */
  listSmartEvents(parameters = {}) {
    let events = [...this.events];
    
    if (parameters.type) {
      events = events.filter(e => e.type === parameters.type);
    }
    
    if (parameters.priority) {
      events = events.filter(e => e.priority === parameters.priority);
    }
    
    if (parameters.since) {
      const since = new Date(parameters.since);
      events = events.filter(e => new Date(e.timestamp) >= since);
    }
    
    return {
      events: events,
      count: events.length,
      types: [...new Set(events.map(e => e.type))],
      priorities: [...new Set(events.map(e => e.priority))]
    };
  }

  /**
   * Get emergency events
   */
  getEmergencyEvents(parameters = {}) {
    let events = [...this.emergencyEvents];
    
    if (parameters.status) {
      events = events.filter(e => e.status === parameters.status);
    }
    
    if (parameters.since) {
      const since = new Date(parameters.since);
      events = events.filter(e => new Date(e.timestamp) >= since);
    }
    
    return {
      events: events,
      count: events.length,
      active: events.filter(e => e.status === 'active').length
    };
  }

  /**
   * Get connector statistics
   */
  getStats() {
    return {
      ...this.stats,
      performance: this.performance,
      aircraft: {
        current: this.aircraft.size,
        appearances: this.appearances.length,
        disappearances: this.disappearances.length,
        changes: this.recentChanges.length
      },
      zones: {
        total: this.zones.size,
        active: Array.from(this.zones.values()).filter(z => z.active).length,
        violations: this.performance.zoneViolations
      },
      events: {
        total: this.events.length,
        emergency: this.emergencyEvents.length,
        recent: this.events.slice(-10)
      },
      baseStation: {
        enabled: this.enableBaseStationIntegration,
        connected: this.baseStationDb !== null,
        registrySize: this.aircraftRegistry.size,
        queries: this.performance.baseStationQueries,
        cacheHits: this.performance.baseStationCacheHits,
        cacheHitRate: this.performance.baseStationQueries > 0 ? 
          (this.performance.baseStationCacheHits / this.performance.baseStationQueries * 100).toFixed(2) + '%' : '0%'
      }
    };
  }

  /**
   * Export aircraft registry data
   */
  async exportAircraftRegistry(parameters = {}) {
    if (!this.enableBaseStationIntegration || !this.baseStationDb) {
      return { aircraft: [], count: 0, error: 'BaseStation integration not enabled' };
    }
    
    try {
      const limit = parameters.limit || 1000;
      const format = parameters.format || 'json';
      
      let query = `
        SELECT 
          ModeS,
          Registration,
          ICAOTypeCode,
          Type,
          Manufacturer,
          OperatorFlagCode,
          SerialNo,
          YearBuilt,
          RegisteredOwners,
          Country
        FROM Aircraft 
        WHERE ModeS IS NOT NULL AND ModeS != ''
      `;
      
      const params = [];
      
      if (parameters.manufacturer) {
        query += ` AND Manufacturer LIKE ?`;
        params.push(`%${parameters.manufacturer}%`);
      }
      
      if (parameters.type) {
        query += ` AND (Type LIKE ? OR ICAOTypeCode LIKE ?)`;
        params.push(`%${parameters.type}%`, `%${parameters.type}%`);
      }
      
      query += ` ORDER BY Registration LIMIT ?`;
      params.push(limit);
      
      return new Promise((resolve, reject) => {
        this.baseStationDb.all(query, params, (err, rows) => {
          if (err) {
            this.logger.error('Failed to export aircraft registry', { error: err.message });
            resolve({ aircraft: [], count: 0, error: err.message });
          } else {
            const aircraft = rows.map(row => ({
              icao24: row.ModeS.toUpperCase(),
              registration: row.Registration || null,
              icaoTypeCode: row.ICAOTypeCode || null,
              type: row.Type || null,
              manufacturer: row.Manufacturer || null,
              operatorFlagCode: row.OperatorFlagCode || null,
              serialNo: row.SerialNo || null,
              yearBuilt: row.YearBuilt || null,
              owner: row.RegisteredOwners || null,
              country: row.Country || null
            }));
            
            const result = {
              aircraft,
              count: aircraft.length,
              format,
              timestamp: new Date().toISOString(),
              totalInRegistry: this.aircraftRegistry.size
            };
            
            if (format === 'csv') {
              result.csv = this.convertToCSV(aircraft);
            }
            
            resolve(result);
          }
        });
      });
    } catch (error) {
      this.logger.error('Failed to export aircraft registry', { error: error.message });
      return { aircraft: [], count: 0, error: error.message };
    }
  }

  /**
   * Convert aircraft data to CSV format
   */
  convertToCSV(aircraft) {
    if (!aircraft || aircraft.length === 0) return '';
    
    const headers = [
      'ICAO24',
      'Registration',
      'ICAOTypeCode',
      'Type',
      'Manufacturer',
      'OperatorFlagCode',
      'SerialNo',
      'YearBuilt',
      'RegisteredOwners',
      'Country'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const plane of aircraft) {
      const row = headers.map(header => {
        const value = plane[header.toLowerCase()] || '';
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
  }

  /**
   * Validate configuration
   */
  static validateConfig(config) {
    const errors = [];
    
    if (!config.config?.url) {
      errors.push('dump1090 URL is required');
    }
    
    if (config.config?.pollInterval && config.config.pollInterval < 1000) {
      errors.push('Poll interval must be at least 1000ms');
    }
    
    if (config.config?.radarRange && config.config.radarRange <= 0) {
      errors.push('Radar range must be positive');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Get connector metadata
   */
  static getMetadata() {
    return {
      name: 'ADSB Connector with BaseStation Integration',
      description: 'Connector for dump1090 ADS-B receiver with BaseStation.sqb database integration for aircraft tracking, zone monitoring, radar display, and registration data lookup',
      version: '2.0.0',
      author: 'Babelfish Looking Glass',
      capabilities: [
        'Aircraft tracking and monitoring',
        'Spatial zone management',
        'Real-time radar display',
        'Smart event generation',
        'Emergency situation monitoring',
        'BaseStation database integration',
        'Aircraft registration lookup',
        'Aircraft search and filtering',
        'Registration data export'
      ],
      configuration: {
        url: 'dump1090 URL (required)',
        pollInterval: 'Polling interval in milliseconds (default: 5000)',
        emergencyCodes: 'Array of emergency squawk codes (default: ["7500", "7600", "7700"])',
        radarRange: 'Radar display range in nautical miles (default: 0.5)',
        radarCenter: 'Radar center coordinates {lat, lon}',
        baseStationDbPath: 'Path to BaseStation.sqb database file (default: aviationdata/BaseStation.sqb)',
        enableBaseStationIntegration: 'Enable BaseStation database integration (default: true)'
      }
    };
  }

  /**
   * Generate airspace context for aircraft
   */
  generateAirspaceContext(airspaces) {
    if (!airspaces || airspaces.length === 0) {
      return {
        type: 'uncontrolled',
        description: 'Uncontrolled airspace',
        priority: 'low',
        requiresClearance: false
      };
    }
    
    // Find highest priority airspace
    const priorityOrder = {
      'CTR': 10,
      'CTA': 9,
      'TMA': 8,
      'Danger_Area': 7,
      'Military': 6,
      'Final_Approach': 5,
      'ATZ': 4,
      'FIR': 3,
      'LARS': 2,
      'Holding_Pattern': 1
    };
    
    let highestPriority = null;
    let maxPriority = -1;
    
    for (const airspace of airspaces) {
      const priority = priorityOrder[airspace.type] || 0;
      if (priority > maxPriority) {
        maxPriority = priority;
        highestPriority = airspace;
      }
    }
    
    if (!highestPriority) {
      return {
        type: 'uncontrolled',
        description: 'Uncontrolled airspace',
        priority: 'low',
        requiresClearance: false
      };
    }
    
    return {
      type: highestPriority.type,
      name: highestPriority.name,
      description: this.getAirspaceDescription(highestPriority.type),
      priority: this.getAirspacePriority(highestPriority.type),
      requiresClearance: this.requiresClearance(highestPriority.type),
      airspaceCount: airspaces.length,
      allAirspaces: airspaces
    };
  }

  /**
   * Get airspace description
   */
  getAirspaceDescription(type) {
    const descriptions = {
      'CTR': 'Control Zone - Highest level of air traffic control',
      'CTA': 'Control Area - Controlled airspace around airports',
      'TMA': 'Terminal Control Area - Controlled airspace for terminal operations',
      'Danger_Area': 'Danger Area - Military or hazardous activities',
      'Military': 'Military Airspace - Military training or operations',
      'Final_Approach': 'Final Approach - Aircraft on approach to runway',
      'ATZ': 'Aerodrome Traffic Zone - Airspace around aerodrome',
      'FIR': 'Flight Information Region - Air traffic information service',
      'LARS': 'Lower Airspace Radar Service - Radar service area',
      'Holding_Pattern': 'Holding Pattern - Aircraft in holding pattern'
    };
    
    return descriptions[type] || 'Unknown airspace type';
  }

  /**
   * Get airspace priority level
   */
  getAirspacePriority(type) {
    const priorities = {
      'CTR': 'critical',
      'CTA': 'high',
      'TMA': 'high',
      'Danger_Area': 'high',
      'Military': 'medium',
      'Final_Approach': 'medium',
      'ATZ': 'medium',
      'FIR': 'low',
      'LARS': 'low',
      'Holding_Pattern': 'low'
    };
    
    return priorities[type] || 'low';
  }

  /**
   * Check if aircraft is in flight
   */
  isAircraftInFlight(aircraft) {
    if (!aircraft) return false;
    
    // Check if aircraft is moving fast enough
    if (aircraft.speed && aircraft.speed > this.flightDetectionConfig.maxGroundSpeed) {
      return true;
    }
    
    // Check if aircraft is at sufficient altitude
    if (aircraft.altitude && aircraft.altitude > this.flightDetectionConfig.minAltitude) {
      return true;
    }
    
    // Check if aircraft is climbing or descending significantly
    if (aircraft.vertical_rate && Math.abs(aircraft.vertical_rate) > 100) {
      return true;
    }
    
    return false;
  }

  /**
   * Start tracking a flight
   */
  async startFlightTracking(aircraft) {
    if (!this.enableFlightTracking || !this.aircraftDataService) return;
    
    const icao24 = aircraft.icao24;
    
    // Check if flight is already being tracked
    if (this.activeFlights.has(icao24)) {
      return;
    }
    
    // Get aircraft registration data
    const registration = await this.aircraftDataService.getAircraftRegistration(icao24);
    
    // Create flight record
    const flight = {
      icao24: icao24,
      callsign: aircraft.callsign,
      registration: registration?.registration,
      startTime: new Date().toISOString(),
      startPosition: {
        lat: aircraft.lat,
        lon: aircraft.lon,
        altitude: aircraft.altitude,
        speed: aircraft.speed,
        track: aircraft.track,
        vertical_rate: aircraft.vertical_rate,
        squawk: aircraft.squawk,
        isOnGround: aircraft.isOnGround || false
      },
      lastPosition: {
        lat: aircraft.lat,
        lon: aircraft.lon,
        altitude: aircraft.altitude,
        speed: aircraft.speed,
        track: aircraft.track,
        vertical_rate: aircraft.vertical_rate,
        squawk: aircraft.squawk,
        isOnGround: aircraft.isOnGround || false
      },
      lastUpdate: new Date(),
      sessionId: this.flightSessionId++,
      aircraftId: registration?.icao24 || icao24
    };
    
    // Store in BaseStation if enabled
    if (this.aircraftDataService.config.enableBaseStationFlightLogging) {
      try {
        const flightId = await this.aircraftDataService.startFlightInBaseStation({
          sessionId: flight.sessionId,
          aircraftId: flight.aircraftId,
          startTime: flight.startTime,
          callsign: flight.callsign,
          pos: flight.startPosition
        });
        flight.baseStationFlightId = flightId;
      } catch (error) {
        this.logger.error('Failed to start flight in BaseStation', { icao24, error: error.message });
      }
    }
    
    // Store in aircraft data service
    if (this.aircraftDataService) {
      await this.aircraftDataService.storeAircraftEvent(icao24, 'flight_started', {
        callsign: flight.callsign,
        registration: flight.registration,
        startTime: flight.startTime,
        startPosition: flight.startPosition
      });
    }
    
    // Track the flight
    this.activeFlights.set(icao24, flight);
    
    // Emit flight started event
    const flightEvent = {
      id: `flight_started_${icao24}_${Date.now()}`,
      type: 'flight:started',
      aircraft: aircraft,
      flight: flight,
      timestamp: new Date().toISOString(),
      metadata: {
        callsign: flight.callsign,
        registration: flight.registration,
        startPosition: flight.startPosition,
        sessionId: flight.sessionId
      }
    };
    
    this.events.push(flightEvent);
    this.emit('flight:started', flightEvent);
    this.performance.flightStarts++;
    
    this.logger.info('Flight started tracking', {
      icao24: icao24,
      callsign: flight.callsign,
      registration: flight.registration,
      sessionId: flight.sessionId
    });
  }

  /**
   * Update flight tracking
   */
  async updateFlightTracking(aircraft) {
    if (!this.enableFlightTracking || !this.aircraftDataService) return;
    
    const icao24 = aircraft.icao24;
    const flight = this.activeFlights.get(icao24);
    
    if (!flight) return;
    
    // Update flight data
    flight.lastPosition = {
      lat: aircraft.lat,
      lon: aircraft.lon,
      altitude: aircraft.altitude,
      speed: aircraft.speed,
      track: aircraft.track,
      vertical_rate: aircraft.vertical_rate,
      squawk: aircraft.squawk,
      isOnGround: aircraft.isOnGround || false
    };
    flight.lastUpdate = new Date();
    
    // Update in BaseStation if enabled
    if (this.aircraftDataService.config.enableBaseStationFlightLogging && flight.baseStationFlightId) {
      try {
        await this.aircraftDataService.logFlightPositionInBaseStation({
          flightId: flight.baseStationFlightId,
          pos: flight.lastPosition
        });
      } catch (error) {
        this.logger.error('Failed to update flight position in BaseStation', { icao24, error: error.message });
      }
    }
    
    // Store position in aircraft data service
    if (this.aircraftDataService) {
      await this.aircraftDataService.storeAircraftPosition(aircraft);
    }
  }

  /**
   * End flight tracking
   */
  async endFlightTracking(aircraft, reason = 'disappeared') {
    if (!this.enableFlightTracking || !this.aircraftDataService) return;
    
    const icao24 = aircraft.icao24;
    const flight = this.activeFlights.get(icao24);
    
    if (!flight) return;
    
    const endTime = new Date().toISOString();
    const flightDuration = new Date(endTime) - new Date(flight.startTime);
    
    // Only end flight if it lasted long enough
    if (flightDuration < this.flightDetectionConfig.minFlightDuration) {
      this.activeFlights.delete(icao24);
      return;
    }
    
    // Update flight end data
    flight.endTime = endTime;
    flight.endPosition = {
      lat: aircraft.lat,
      lon: aircraft.lon,
      altitude: aircraft.altitude,
      speed: aircraft.speed,
      track: aircraft.track,
      vertical_rate: aircraft.vertical_rate,
      squawk: aircraft.squawk,
      isOnGround: aircraft.isOnGround || false
    };
    flight.duration = flightDuration;
    flight.reason = reason;
    
    // Update in BaseStation if enabled
    if (this.aircraftDataService.config.enableBaseStationFlightLogging && flight.baseStationFlightId) {
      try {
        await this.aircraftDataService.endFlightInBaseStation({
          flightId: flight.baseStationFlightId,
          endTime: endTime,
          pos: flight.endPosition
        });
      } catch (error) {
        this.logger.error('Failed to end flight in BaseStation', { icao24, error: error.message });
      }
    }
    
    // Store in aircraft data service
    if (this.aircraftDataService) {
      await this.aircraftDataService.storeAircraftEvent(icao24, 'flight_ended', {
        callsign: flight.callsign,
        registration: flight.registration,
        startTime: flight.startTime,
        endTime: flight.endTime,
        duration: flightDuration,
        startPosition: flight.startPosition,
        endPosition: flight.endPosition,
        reason: reason
      });
    }
    
    // Remove from active flights
    this.activeFlights.delete(icao24);
    
    // Emit flight ended event
    const flightEvent = {
      id: `flight_ended_${icao24}_${Date.now()}`,
      type: 'flight:ended',
      aircraft: aircraft,
      flight: flight,
      timestamp: new Date().toISOString(),
      metadata: {
        callsign: flight.callsign,
        registration: flight.registration,
        startTime: flight.startTime,
        endTime: flight.endTime,
        duration: flightDuration,
        startPosition: flight.startPosition,
        endPosition: flight.endPosition,
        reason: reason,
        sessionId: flight.sessionId
      }
    };
    
    this.events.push(flightEvent);
    this.emit('flight:ended', flightEvent);
    this.performance.flightEnds++;
    
    this.logger.info('Flight ended tracking', {
      icao24: icao24,
      callsign: flight.callsign,
      registration: flight.registration,
      duration: flightDuration,
      reason: reason
    });
  }

  /**
   * Check for flight timeouts
   */
  checkFlightTimeouts() {
    if (!this.enableFlightTracking) return;
    
    const now = new Date();
    const timeoutThreshold = now.getTime() - this.flightDetectionConfig.flightEndTimeout;
    
    for (const [icao24, flight] of this.activeFlights.entries()) {
      if (flight.lastUpdate.getTime() < timeoutThreshold) {
        // Flight has timed out, end it
        const aircraft = this.aircraft.get(icao24) || {
          icao24: icao24,
          callsign: flight.callsign,
          lat: flight.lastPosition.lat,
          lon: flight.lastPosition.lon,
          altitude: flight.lastPosition.altitude,
          speed: flight.lastPosition.speed,
          track: flight.lastPosition.track,
          vertical_rate: flight.lastPosition.vertical_rate,
          squawk: flight.lastPosition.squawk
        };
        
        this.endFlightTracking(aircraft, 'timeout');
      }
    }
  }

  /**
   * Get active flights with augmented data
   */
  getActiveFlights() {
    if (!this.enableFlightTracking) return [];
    
    const activeFlights = [];
    
    for (const [icao24, flight] of this.activeFlights.entries()) {
      const currentAircraft = this.aircraft.get(icao24);
      
      const augmentedFlight = {
        icao24: icao24,
        callsign: flight.callsign,
        registration: flight.registration,
        startTime: flight.startTime,
        lastUpdate: flight.lastUpdate,
        duration: new Date() - new Date(flight.startTime),
        startPosition: flight.startPosition,
        currentPosition: flight.lastPosition,
        emergency: currentAircraft?.emergency || false,
        squawk: flight.lastPosition.squawk,
        sessionId: flight.sessionId,
        baseStationFlightId: flight.baseStationFlightId,
        // Augmented data
        airspaceInfo: null,
        squawkInfo: null,
        aircraftInfo: null,
        flightPath: null,
        alerts: []
      };
      
      // Get airspace information if available
      if (this.airspaceService && flight.lastPosition) {
        const airspaces = this.airspaceService.getAirspacesAtPosition(
          flight.lastPosition.lat, 
          flight.lastPosition.lon, 
          flight.lastPosition.altitude
        );
        if (airspaces.length > 0) {
          augmentedFlight.airspaceInfo = airspaces.map(airspace => ({
            id: airspace.id,
            type: airspace.type,
            name: airspace.name,
            class: airspace.class,
            floor: airspace.floor,
            ceiling: airspace.ceiling
          }));
        }
      }
      
      // Get squawk code information if available
      if (this.squawkCodeService && flight.lastPosition.squawk) {
        const squawkInfo = this.squawkCodeService.lookupSquawkCode(flight.lastPosition.squawk);
        if (squawkInfo) {
          augmentedFlight.squawkInfo = squawkInfo;
        }
      }
      
      // Get aircraft information if available
      // Note: aircraftInfo is not set here because getAircraftRegistration is async and this method is not async.
      
      // Get flight path if available
      if (flight.flightPath && flight.flightPath.length > 0) {
        augmentedFlight.flightPath = flight.flightPath.map(point => ({
          lat: point.lat,
          lon: point.lon,
          altitude: point.altitude,
          timestamp: point.timestamp
        }));
      }
      
      // Check for alerts
      if (currentAircraft?.emergency) {
        augmentedFlight.alerts.push('EMERGENCY');
      }
      
      if (flight.lastPosition.squawk === '7500') {
        augmentedFlight.alerts.push('HIJACK');
      } else if (flight.lastPosition.squawk === '7600') {
        augmentedFlight.alerts.push('COMM_FAILURE');
      } else if (flight.lastPosition.squawk === '7700') {
        augmentedFlight.alerts.push('EMERGENCY');
      }
      
      activeFlights.push(augmentedFlight);
    }
    
    return activeFlights;
  }

  /**
   * Get enhanced aircraft data with airport and runway information
   */
  getEnhancedAircraftData(icao24) {
    const aircraft = this.aircraft.get(icao24);
    if (!aircraft) {
      return null;
    }

    const airport = this.determineAirport(aircraft);
    const runway = this.determineRunway(aircraft, airport);
    const runwayUsage = this.trackRunwayUsage(aircraft, airport);

    return {
      ...aircraft,
      airport: airport ? {
        icao: airport.icao,
        name: airport.name,
        distance: this.calculateDistance(
          aircraft.lat, aircraft.lon,
          airport.lat, airport.lon
        )
      } : null,
      runway: runway ? {
        id: runway.id,
        heading: runway.heading,
        alignment: runway.heading ? 
          Math.abs(aircraft.heading - runway.heading) : null
      } : null,
      runwayUsage: runwayUsage,
      isNearAirport: airport && this.calculateDistance(
        aircraft.lat, aircraft.lon,
        airport.lat, airport.lon
      ) < 5, // Within 5km
      isOnApproach: this.isAircraftLikelyLanding(aircraft),
      isOnDeparture: aircraft.vertical_rate && aircraft.vertical_rate > 500
    };
  }

  /**
   * Get all enhanced aircraft data
   */
  getAllEnhancedAircraftData() {
    const enhancedAircraft = [];
    
    for (const [icao24, aircraft] of this.aircraft.entries()) {
      const enhanced = this.getEnhancedAircraftData(icao24);
      if (enhanced) {
        enhancedAircraft.push(enhanced);
      }
    }
    
    return enhancedAircraft;
  }

  /**
   * Check if aircraft is on ground
   */
  isAircraftOnGround(aircraft) {
    return aircraft.altitude && aircraft.altitude < 50;
  }

  /**
   * Check if aircraft is a helicopter
   */
  isHelicopter(aircraft) {
    // Check aircraft type from BaseStation database
    if (this.aircraftDataService && aircraft.icao24) {
      const aircraftInfo = this.aircraftDataService.getAircraftRegistration(aircraft.icao24);
      if (aircraftInfo && aircraftInfo.type) {
        const type = aircraftInfo.type.toLowerCase();
        return type.includes('helicopter') || type.includes('rotorcraft') || type.includes('rotor');
      }
    }
    
    // Fallback: check for helicopter-like behavior
    return aircraft.vertical_rate && Math.abs(aircraft.vertical_rate) > 1000 && 
           aircraft.speed && aircraft.speed < 100;
  }

  /**
   * Check if aircraft is taxiing
   */
  isAircraftTaxiing(aircraft) {
    return aircraft.altitude && aircraft.altitude < 20 && 
           aircraft.speed && aircraft.speed > 5 && aircraft.speed < 50;
  }

  /**
   * Check if aircraft is parked
   */
  isAircraftParked(aircraft) {
    return aircraft.altitude && aircraft.altitude < 10 && 
           aircraft.speed && aircraft.speed < 5;
  }

  /**
   * Determine ground movement type
   */
  determineGroundMovementType(aircraft) {
    if (this.isAircraftTaxiing(aircraft)) {
      return 'taxi';
    } else if (this.isAircraftParked(aircraft)) {
      return 'parked';
    } else if (aircraft.speed && aircraft.speed > 0) {
      return 'moving';
    } else {
      return 'stationary';
    }
  }

  /**
   * Determine helicopter action
   */
  determineHelicopterAction(aircraft) {
    if (aircraft.vertical_rate && aircraft.vertical_rate > 500) {
      return 'takeoff';
    } else if (aircraft.vertical_rate && aircraft.vertical_rate < -500) {
      return 'landing';
    } else if (aircraft.altitude && aircraft.altitude < 50) {
      return 'hovering_low';
    } else if (aircraft.altitude && aircraft.altitude < 200) {
      return 'hovering_high';
    } else {
      return 'flying';
    }
  }

  /**
   * Determine taxi phase
   */
  determineTaxiPhase(aircraft) {
    const airport = this.determineAirport(aircraft);
    if (!airport) return 'unknown';
    
    // Simple logic based on position relative to runway
    const runway = this.determineRunway(aircraft, airport);
    if (runway) {
      const distance = this.calculateDistance(
        aircraft.lat, aircraft.lon,
        runway.lat, runway.lon
      );
      
      if (distance < 0.5) {
        return 'runway_approach';
      } else if (distance < 1.0) {
        return 'taxiway';
      } else {
        return 'apron';
      }
    }
    
    return 'unknown';
  }

  /**
   * Determine parking area
   */
  determineParkingArea(aircraft, airport) {
    if (!airport) return 'unknown';
    
    // Simple logic based on distance from airport center
    const distance = this.calculateDistance(
      aircraft.lat, aircraft.lon,
      airport.lat, airport.lon
    );
    
    if (distance < 0.3) {
      return 'terminal';
    } else if (distance < 0.8) {
      return 'apron';
    } else if (distance < 1.5) {
      return 'remote_parking';
    } else {
      return 'maintenance_area';
    }
  }

  /**
   * Calculate ground movement confidence
   */
  calculateGroundMovementConfidence(aircraft) {
    let confidence = 0.7; // Base confidence
    
    if (aircraft.altitude && aircraft.altitude < 20) {
      confidence += 0.2;
    }
    
    if (aircraft.speed && aircraft.speed > 0) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate helicopter confidence
   */
  calculateHelicopterConfidence(aircraft) {
    let confidence = 0.6; // Base confidence
    
    if (this.isHelicopter(aircraft)) {
      confidence += 0.3;
    }
    
    if (aircraft.vertical_rate && Math.abs(aircraft.vertical_rate) > 500) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate taxi confidence
   */
  calculateTaxiConfidence(aircraft) {
    let confidence = 0.8; // Base confidence for taxi
    
    if (aircraft.altitude && aircraft.altitude < 20) {
      confidence += 0.1;
    }
    
    if (aircraft.speed && aircraft.speed > 5 && aircraft.speed < 50) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate parking confidence
   */
  calculateParkingConfidence(aircraft) {
    let confidence = 0.9; // Base confidence for parking
    
    if (aircraft.altitude && aircraft.altitude < 10) {
      confidence += 0.1;
    }
    
    if (aircraft.speed && aircraft.speed < 5) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }
}

module.exports = ADSBConnector;
