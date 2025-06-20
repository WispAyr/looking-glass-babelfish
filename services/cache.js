class Cache {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
    this.timers = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  async initialize() {
    // Cache is ready immediately for in-memory implementation
    return Promise.resolve();
  }

  set(key, value, ttl = null) {
    const expiry = ttl ? Date.now() + (ttl * 1000) : null;
    
    this.cache.set(key, {
      value,
      expiry,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0
    });

    // Set expiry timer if TTL is provided
    if (expiry) {
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
      }
      
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl * 1000);
      
      this.timers.set(key, timer);
    }

    this.stats.sets++;
    
    // Check cache size limit
    if (this.cache.size > this.config.maxSize) {
      this.evictOldest();
    }
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Check if item has expired
    if (item.expiry && Date.now() > item.expiry) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    item.accessedAt = Date.now();
    item.accessCount++;
    
    this.stats.hits++;
    return item.value;
  }

  delete(key) {
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.stats.deletes++;
      
      // Clear timer if exists
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
    }
    
    return deleted;
  }

  has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    // Check if item has expired
    if (item.expiry && Date.now() > item.expiry) {
      this.delete(key);
      return false;
    }

    return true;
  }

  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.timers.clear();
    this.cache.clear();
    
    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache) {
      if (item.accessedAt < oldestTime) {
        oldestTime = item.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      ...this.stats
    };
  }

  getKeys() {
    return Array.from(this.cache.keys());
  }

  getSize() {
    return this.cache.size;
  }

  // Cache with automatic TTL from config
  setWithDefaultTTL(key, value) {
    this.set(key, value, this.config.ttl);
  }

  // Get or set pattern
  async getOrSet(key, fetchFunction, ttl = null) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    try {
      const value = await fetchFunction();
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      throw error;
    }
  }

  // Batch operations
  mget(keys) {
    const result = {};
    for (const key of keys) {
      result[key] = this.get(key);
    }
    return result;
  }

  mset(items, ttl = null) {
    for (const [key, value] of Object.entries(items)) {
      this.set(key, value, ttl);
    }
  }

  // Pattern-based operations
  keys(pattern = null) {
    const keys = Array.from(this.cache.keys());
    
    if (!pattern) {
      return keys;
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  deletePattern(pattern) {
    const keysToDelete = this.keys(pattern);
    let deletedCount = 0;
    
    for (const key of keysToDelete) {
      if (this.delete(key)) {
        deletedCount++;
      }
    }
    
    return deletedCount;
  }
}

module.exports = Cache; 