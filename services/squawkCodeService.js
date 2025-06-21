const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const winston = require('winston');

/**
 * Squawk Code Service
 * 
 * Manages UK aviation squawk codes for enhanced ADSB monitoring and analysis.
 * Provides lookup, categorization, and intelligent event generation based on
 * squawk code patterns and aviation authority assignments.
 */
class SquawkCodeService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      dataFile: config.dataFile || path.join(__dirname, '../connectors/types/UK aviation, Squawk Codes are four-digit.ini'),
      enableCaching: config.enableCaching !== false,
      cacheExpiry: config.cacheExpiry || 3600000, // 1 hour
      enableNotifications: config.enableNotifications !== false,
      ...config
    };

    this.logger = winston.createLogger({
      level: config.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    // Squawk code data structures
    this.squawkCodes = new Map();
    this.codeCategories = new Map();
    this.authorityAssignments = new Map();
    this.emergencyCodes = new Set();
    this.conspicuityCodes = new Set();
    this.militaryCodes = new Set();
    this.natoCodes = new Set();
    this.transitCodes = new Set();
    
    // Caching
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    
    // Statistics
    this.stats = {
      totalCodes: 0,
      categories: {},
      lookups: 0,
      cacheHits: 0,
      cacheMisses: 0,
      events: 0
    };

    this.logger.info('Squawk Code Service initialized');
  }

  /**
   * Initialize the service by loading squawk code data
   */
  async initialize() {
    try {
      this.logger.info('Loading squawk code data...');
      await this.loadSquawkCodeData();
      await this.categorizeCodes();
      this.logger.info(`Squawk Code Service initialized with ${this.stats.totalCodes} codes`);
      this.emit('service:initialized', { totalCodes: this.stats.totalCodes });
    } catch (error) {
      this.logger.error('Failed to initialize Squawk Code Service', error);
      throw error;
    }
  }

  /**
   * Load squawk code data from file
   */
  async loadSquawkCodeData() {
    try {
      const data = await fs.readFile(this.config.dataFile, 'utf8');
      const lines = data.split('\n');
      
      let currentCategory = null;
      let currentAuthority = null;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (!trimmedLine || trimmedLine.startsWith('UK aviation') || trimmedLine.startsWith('Here')) {
          continue;
        }
        
        // Parse category headers
        if (trimmedLine.startsWith('Codes / Series')) {
          currentCategory = 'general';
          continue;
        }
        
        // Parse code entries
        const codeMatch = trimmedLine.match(/^(\*?\s*)(\d{4})\s*(.*)/);
        if (codeMatch) {
          const [, asterisk, code, description] = codeMatch;
          const isSpecial = asterisk.includes('*');
          
          this.squawkCodes.set(code, {
            code,
            description: description.trim(),
            category: currentCategory,
            authority: currentAuthority,
            special: isSpecial,
            priority: this.determinePriority(code, description, isSpecial)
          });
          
          this.stats.totalCodes++;
        }
        
        // Parse authority assignments
        const authorityMatch = trimmedLine.match(/^(\d{4})\s*—\s*(\d{4})\s*(.*)/);
        if (authorityMatch) {
          const [, startCode, endCode, authority] = authorityMatch;
          this.addAuthorityAssignment(startCode, endCode, authority.trim());
        }
        
        // Parse single authority assignments
        const singleAuthorityMatch = trimmedLine.match(/^(\d{4})\s*—\s*(\d{4})\s*([A-Za-z\s]+)$/);
        if (singleAuthorityMatch) {
          const [, startCode, endCode, authority] = singleAuthorityMatch;
          this.addAuthorityAssignment(startCode, endCode, authority.trim());
        }
      }
      
      this.logger.info(`Loaded ${this.squawkCodes.size} squawk codes`);
    } catch (error) {
      this.logger.error('Failed to load squawk code data', error);
      throw error;
    }
  }

  /**
   * Add authority assignment for a range of codes
   */
  addAuthorityAssignment(startCode, endCode, authority) {
    const start = parseInt(startCode);
    const end = parseInt(endCode);
    
    for (let code = start; code <= end; code++) {
      const codeStr = code.toString().padStart(4, '0');
      if (this.squawkCodes.has(codeStr)) {
        this.squawkCodes.get(codeStr).authority = authority;
      }
    }
  }

  /**
   * Categorize squawk codes
   */
  async categorizeCodes() {
    for (const [code, data] of this.squawkCodes) {
      const category = this.determineCategory(code, data);
      data.category = category;
      
      // Add to category sets
      if (!this.codeCategories.has(category)) {
        this.codeCategories.set(category, new Set());
      }
      this.codeCategories.get(category).add(code);
      
      // Add to specific sets
      if (this.isEmergencyCode(code, data)) {
        this.emergencyCodes.add(code);
      }
      if (this.isConspicuityCode(code, data)) {
        this.conspicuityCodes.add(code);
      }
      if (this.isMilitaryCode(code, data)) {
        this.militaryCodes.add(code);
      }
      if (this.isNatoCode(code, data)) {
        this.natoCodes.add(code);
      }
      if (this.isTransitCode(code, data)) {
        this.transitCodes.add(code);
      }
    }
    
    // Update statistics
    this.stats.categories = {
      emergency: this.emergencyCodes.size,
      conspicuity: this.conspicuityCodes.size,
      military: this.militaryCodes.size,
      nato: this.natoCodes.size,
      transit: this.transitCodes.size,
      total: this.squawkCodes.size
    };
  }

  /**
   * Determine category for a squawk code
   */
  determineCategory(code, data) {
    const description = data.description.toLowerCase();
    
    if (this.isEmergencyCode(code, data)) {
      return 'emergency';
    }
    if (description.includes('nato') || description.includes('caoc')) {
      return 'nato';
    }
    if (description.includes('military') || description.includes('raf') || description.includes('rnas')) {
      return 'military';
    }
    if (description.includes('transit') || description.includes('orcam')) {
      return 'transit';
    }
    if (description.includes('conspicuity') || description.includes('monitoring')) {
      return 'conspicuity';
    }
    if (description.includes('approach') || description.includes('radar') || description.includes('control')) {
      return 'atc';
    }
    if (description.includes('air ambulance') || description.includes('hems')) {
      return 'emergency_services';
    }
    if (description.includes('police') || description.includes('law enforcement')) {
      return 'law_enforcement';
    }
    if (description.includes('offshore') || description.includes('oil')) {
      return 'offshore';
    }
    
    return 'general';
  }

  /**
   * Determine priority for a squawk code
   */
  determinePriority(code, description, isSpecial) {
    if (this.isEmergencyCode(code, { description })) {
      return 'critical';
    }
    if (isSpecial) {
      return 'high';
    }
    if (description.toLowerCase().includes('military') || description.toLowerCase().includes('nato')) {
      return 'high';
    }
    if (description.toLowerCase().includes('approach') || description.toLowerCase().includes('control')) {
      return 'medium';
    }
    return 'normal';
  }

  /**
   * Check if code is emergency code
   */
  isEmergencyCode(code, data) {
    const emergencyCodes = ['7500', '7600', '7700'];
    const description = data.description.toLowerCase();
    
    return emergencyCodes.includes(code) || 
           description.includes('emergency') || 
           description.includes('hijacking') || 
           description.includes('radio failure');
  }

  /**
   * Check if code is conspicuity code
   */
  isConspicuityCode(code, data) {
    const description = data.description.toLowerCase();
    return description.includes('conspicuity') || description.includes('monitoring');
  }

  /**
   * Check if code is military code
   */
  isMilitaryCode(code, data) {
    const description = data.description.toLowerCase();
    return description.includes('military') || 
           description.includes('raf') || 
           description.includes('rnas') || 
           description.includes('mod');
  }

  /**
   * Check if code is NATO code
   */
  isNatoCode(code, data) {
    const description = data.description.toLowerCase();
    return description.includes('nato') || description.includes('caoc');
  }

  /**
   * Check if code is transit code
   */
  isTransitCode(code, data) {
    const description = data.description.toLowerCase();
    return description.includes('transit') || description.includes('orcam');
  }

  /**
   * Look up squawk code information
   */
  lookupSquawkCode(code) {
    this.stats.lookups++;
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedResult(code);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
    }
    
    this.stats.cacheMisses++;
    const result = this.performLookup(code);
    
    // Cache result
    if (this.config.enableCaching && result) {
      this.cacheResult(code, result);
    }
    
    return result;
  }

  /**
   * Perform actual squawk code lookup
   */
  performLookup(code) {
    const normalizedCode = code.toString().padStart(4, '0');
    
    if (this.squawkCodes.has(normalizedCode)) {
      const data = this.squawkCodes.get(normalizedCode);
      return {
        code: normalizedCode,
        found: true,
        ...data,
        enhanced: this.enhanceCodeData(data)
      };
    }
    
    // Check if code falls within any authority ranges
    const authorityInfo = this.findAuthorityForCode(normalizedCode);
    if (authorityInfo) {
      return {
        code: normalizedCode,
        found: true,
        description: `Assigned by ${authorityInfo.authority}`,
        category: 'assigned',
        authority: authorityInfo.authority,
        priority: 'normal',
        enhanced: {
          type: 'assigned',
          authority: authorityInfo.authority,
          range: authorityInfo.range
        }
      };
    }
    
    return {
      code: normalizedCode,
      found: false,
      description: 'Unknown squawk code',
      category: 'unknown',
      priority: 'normal'
    };
  }

  /**
   * Find authority assignment for a code
   */
  findAuthorityForCode(code) {
    const codeNum = parseInt(code);
    
    for (const [range, authority] of this.authorityAssignments) {
      const [start, end] = range.split('-').map(Number);
      if (codeNum >= start && codeNum <= end) {
        return { authority, range: `${start}-${end}` };
      }
    }
    
    return null;
  }

  /**
   * Enhance code data with additional information
   */
  enhanceCodeData(data) {
    const enhanced = {
      type: data.category,
      priority: data.priority,
      special: data.special
    };
    
    // Add specific enhancements based on category
    switch (data.category) {
      case 'emergency':
        enhanced.requiresImmediateAttention = true;
        enhanced.alertLevel = 'critical';
        break;
      case 'military':
        enhanced.militaryActivity = true;
        enhanced.alertLevel = 'high';
        break;
      case 'nato':
        enhanced.natoActivity = true;
        enhanced.alertLevel = 'high';
        break;
      case 'atc':
        enhanced.atcControlled = true;
        enhanced.alertLevel = 'medium';
        break;
      case 'emergency_services':
        enhanced.emergencyService = true;
        enhanced.alertLevel = 'medium';
        break;
    }
    
    return enhanced;
  }

  /**
   * Get cached result
   */
  getCachedResult(code) {
    if (!this.cache.has(code)) {
      return null;
    }
    
    const timestamp = this.cacheTimestamps.get(code);
    if (Date.now() - timestamp > this.config.cacheExpiry) {
      this.cache.delete(code);
      this.cacheTimestamps.delete(code);
      return null;
    }
    
    return this.cache.get(code);
  }

  /**
   * Cache result
   */
  cacheResult(code, result) {
    this.cache.set(code, result);
    this.cacheTimestamps.set(code, Date.now());
  }

  /**
   * Analyze aircraft squawk code and generate events
   */
  analyzeAircraftSquawk(aircraft) {
    if (!aircraft.squawk) {
      return null;
    }
    
    const squawkInfo = this.lookupSquawkCode(aircraft.squawk);
    
    if (!squawkInfo.found) {
      return null;
    }
    
    const event = {
      id: `squawk_${aircraft.icao24}_${Date.now()}`,
      timestamp: new Date(),
      type: 'squawk:analysis',
      aircraft: aircraft,
      squawk: aircraft.squawk,
      squawkInfo: squawkInfo,
      priority: squawkInfo.priority,
      category: squawkInfo.category,
      enhanced: squawkInfo.enhanced
    };
    
    // Generate specific events based on squawk code
    if (squawkInfo.category === 'emergency') {
      this.generateEmergencyEvent(event);
    } else if (squawkInfo.category === 'military') {
      this.generateMilitaryEvent(event);
    } else if (squawkInfo.category === 'nato') {
      this.generateNatoEvent(event);
    } else if (squawkInfo.category === 'atc') {
      this.generateAtcEvent(event);
    }
    
    this.stats.events++;
    this.emit('squawk:analyzed', event);
    
    return event;
  }

  /**
   * Generate emergency event
   */
  generateEmergencyEvent(event) {
    const emergencyEvent = {
      ...event,
      type: 'emergency:squawk',
      priority: 'critical',
      requiresAction: true
    };
    
    this.emit('emergency:squawk', emergencyEvent);
    this.logger.warn('Emergency squawk detected', {
      aircraft: event.aircraft.icao24,
      squawk: event.squawk,
      description: event.squawkInfo.description
    });
  }

  /**
   * Generate military event
   */
  generateMilitaryEvent(event) {
    const militaryEvent = {
      ...event,
      type: 'military:squawk',
      priority: 'high'
    };
    
    this.emit('military:squawk', militaryEvent);
    this.logger.info('Military squawk detected', {
      aircraft: event.aircraft.icao24,
      squawk: event.squawk,
      description: event.squawkInfo.description
    });
  }

  /**
   * Generate NATO event
   */
  generateNatoEvent(event) {
    const natoEvent = {
      ...event,
      type: 'nato:squawk',
      priority: 'high'
    };
    
    this.emit('nato:squawk', natoEvent);
    this.logger.info('NATO squawk detected', {
      aircraft: event.aircraft.icao24,
      squawk: event.squawk,
      description: event.squawkInfo.description
    });
  }

  /**
   * Generate ATC event
   */
  generateAtcEvent(event) {
    const atcEvent = {
      ...event,
      type: 'atc:squawk',
      priority: 'medium'
    };
    
    this.emit('atc:squawk', atcEvent);
  }

  /**
   * Search squawk codes by criteria
   */
  searchSquawkCodes(criteria = {}) {
    const results = [];
    
    for (const [code, data] of this.squawkCodes) {
      let match = true;
      
      if (criteria.category && data.category !== criteria.category) {
        match = false;
      }
      
      if (criteria.authority && data.authority && !data.authority.toLowerCase().includes(criteria.authority.toLowerCase())) {
        match = false;
      }
      
      if (criteria.description && !data.description.toLowerCase().includes(criteria.description.toLowerCase())) {
        match = false;
      }
      
      if (criteria.priority && data.priority !== criteria.priority) {
        match = false;
      }
      
      if (match) {
        results.push({
          code,
          ...data,
          enhanced: this.enhanceCodeData(data)
        });
      }
    }
    
    return results;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      cache: {
        size: this.cache.size,
        hitRate: this.stats.lookups > 0 ? (this.stats.cacheHits / this.stats.lookups) : 0
      }
    };
  }

  /**
   * Get categories
   */
  getCategories() {
    return Array.from(this.codeCategories.keys());
  }

  /**
   * Get codes by category
   */
  getCodesByCategory(category) {
    return this.codeCategories.has(category) ? 
      Array.from(this.codeCategories.get(category)) : [];
  }

  /**
   * Get emergency codes
   */
  getEmergencyCodes() {
    return Array.from(this.emergencyCodes);
  }

  /**
   * Get military codes
   */
  getMilitaryCodes() {
    return Array.from(this.militaryCodes);
  }

  /**
   * Get NATO codes
   */
  getNatoCodes() {
    return Array.from(this.natoCodes);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.logger.info('Squawk code cache cleared');
  }
}

module.exports = SquawkCodeService; 