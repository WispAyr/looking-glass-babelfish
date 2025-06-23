const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const EventEmitter = require('events');

/**
 * Alarm Manager Service
 * 
 * Manages alarm rules, conditions, and actions in the database.
 * Provides CRUD operations for alarm configuration with validation.
 */
class AlarmManagerService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      dbPath: config.dbPath || path.join(process.cwd(), 'data', 'babelfish.db'),
      autoSave: config.autoSave !== false,
      ...config
    };
    
    this.db = null;
    this.isInitialized = false;
    
    // Cache for performance
    this.rulesCache = new Map();
    this.cacheDirty = false;
  }

  /**
   * Initialize the service and database
   */
  async initialize() {
    try {
      await this.connectDatabase();
      await this.createTables();
      await this.loadRulesFromDatabase();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('Alarm Manager Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Alarm Manager Service:', error);
      throw error;
    }
  }

  /**
   * Connect to SQLite database
   */
  async connectDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.config.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to Alarm Manager database');
          resolve();
        }
      });
    });
  }

  /**
   * Create database tables
   */
  async createTables() {
    const tables = [
      // Alarm rules table
      `CREATE TABLE IF NOT EXISTS alarm_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'medium',
        category TEXT DEFAULT 'general',
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Rule conditions table
      `CREATE TABLE IF NOT EXISTS alarm_conditions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id TEXT NOT NULL,
        condition_type TEXT NOT NULL,
        condition_value TEXT,
        condition_operator TEXT DEFAULT 'equals',
        FOREIGN KEY (rule_id) REFERENCES alarm_rules(id) ON DELETE CASCADE
      )`,
      
      // Rule actions table
      `CREATE TABLE IF NOT EXISTS alarm_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_config TEXT,
        action_order INTEGER DEFAULT 0,
        FOREIGN KEY (rule_id) REFERENCES alarm_rules(id) ON DELETE CASCADE
      )`,
      
      // Alarm history table
      `CREATE TABLE IF NOT EXISTS alarm_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id TEXT,
        event_type TEXT,
        event_source TEXT,
        event_data TEXT,
        triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        status TEXT DEFAULT 'active'
      )`,
      
      // Alarm acknowledgments table
      `CREATE TABLE IF NOT EXISTS alarm_acknowledgments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alarm_id INTEGER,
        user_id TEXT,
        acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (alarm_id) REFERENCES alarm_history(id) ON DELETE CASCADE
      )`
    ];

    for (const table of tables) {
      await this.runQuery(table);
    }
    
    console.log('Alarm Manager database tables created');
  }

  /**
   * Load rules from database into cache
   */
  async loadRulesFromDatabase() {
    try {
      const rules = await this.getAllRules();
      this.rulesCache.clear();
      
      for (const rule of rules) {
        this.rulesCache.set(rule.id, rule);
      }
      
      this.cacheDirty = false;
      console.log(`Loaded ${rules.length} alarm rules from database`);
    } catch (error) {
      console.error('Failed to load rules from database:', error);
    }
  }

  /**
   * Create a new alarm rule
   */
  async createRule(ruleData) {
    const {
      id,
      name,
      description,
      priority = 'medium',
      category = 'general',
      enabled = true,
      conditions = [],
      actions = []
    } = ruleData;

    // Validate required fields
    if (!id || !name) {
      throw new Error('Rule ID and name are required');
    }

    // Check if rule already exists
    const existingRule = await this.getRule(id);
    if (existingRule) {
      throw new Error(`Rule with ID '${id}' already exists`);
    }

    try {
      await this.runQuery('BEGIN TRANSACTION');

      // Insert rule
      await this.runQuery(
        'INSERT INTO alarm_rules (id, name, description, priority, category, enabled) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, description, priority, category, enabled ? 1 : 0]
      );

      // Insert conditions
      for (const condition of conditions) {
        await this.runQuery(
          'INSERT INTO alarm_conditions (rule_id, condition_type, condition_value, condition_operator) VALUES (?, ?, ?, ?)',
          [id, condition.type, JSON.stringify(condition.value), condition.operator || 'equals']
        );
      }

      // Insert actions
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        await this.runQuery(
          'INSERT INTO alarm_actions (rule_id, action_type, action_config, action_order) VALUES (?, ?, ?, ?)',
          [id, action.type, JSON.stringify(action.config), i]
        );
      }

      await this.runQuery('COMMIT');

      // Update cache
      const newRule = await this.getRule(id);
      this.rulesCache.set(id, newRule);
      
      this.emit('rule:created', newRule);
      console.log(`Created alarm rule: ${id}`);
      
      return newRule;
    } catch (error) {
      await this.runQuery('ROLLBACK');
      throw error;
    }
  }

  /**
   * Update an existing alarm rule
   */
  async updateRule(id, updates) {
    const existingRule = await this.getRule(id);
    if (!existingRule) {
      throw new Error(`Rule with ID '${id}' not found`);
    }

    const {
      name,
      description,
      priority,
      category,
      enabled,
      conditions,
      actions
    } = updates;

    try {
      await this.runQuery('BEGIN TRANSACTION');

      // Update rule
      const updateFields = [];
      const updateValues = [];
      
      if (name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(name);
      }
      if (description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(description);
      }
      if (priority !== undefined) {
        updateFields.push('priority = ?');
        updateValues.push(priority);
      }
      if (category !== undefined) {
        updateFields.push('category = ?');
        updateValues.push(category);
      }
      if (enabled !== undefined) {
        updateFields.push('enabled = ?');
        updateValues.push(enabled ? 1 : 0);
      }
      
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);

      if (updateFields.length > 1) {
        await this.runQuery(
          `UPDATE alarm_rules SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }

      // Update conditions if provided
      if (conditions !== undefined) {
        await this.runQuery('DELETE FROM alarm_conditions WHERE rule_id = ?', [id]);
        for (const condition of conditions) {
          await this.runQuery(
            'INSERT INTO alarm_conditions (rule_id, condition_type, condition_value, condition_operator) VALUES (?, ?, ?, ?)',
            [id, condition.type, JSON.stringify(condition.value), condition.operator || 'equals']
          );
        }
      }

      // Update actions if provided
      if (actions !== undefined) {
        await this.runQuery('DELETE FROM alarm_actions WHERE rule_id = ?', [id]);
        for (let i = 0; i < actions.length; i++) {
          const action = actions[i];
          await this.runQuery(
            'INSERT INTO alarm_actions (rule_id, action_type, action_config, action_order) VALUES (?, ?, ?, ?)',
            [id, action.type, JSON.stringify(action.config), i]
          );
        }
      }

      await this.runQuery('COMMIT');

      // Update cache
      const updatedRule = await this.getRule(id);
      this.rulesCache.set(id, updatedRule);
      
      this.emit('rule:updated', updatedRule);
      console.log(`Updated alarm rule: ${id}`);
      
      return updatedRule;
    } catch (error) {
      await this.runQuery('ROLLBACK');
      throw error;
    }
  }

  /**
   * Delete an alarm rule
   */
  async deleteRule(id) {
    const existingRule = await this.getRule(id);
    if (!existingRule) {
      throw new Error(`Rule with ID '${id}' not found`);
    }

    try {
      await this.runQuery('DELETE FROM alarm_rules WHERE id = ?', [id]);
      
      // Update cache
      this.rulesCache.delete(id);
      
      this.emit('rule:deleted', { id });
      console.log(`Deleted alarm rule: ${id}`);
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a single rule by ID
   */
  async getRule(id) {
    try {
      const rule = await this.runQuery('SELECT * FROM alarm_rules WHERE id = ?', [id]);
      if (!rule || rule.length === 0) {
        return null;
      }

      const ruleData = rule[0];
      
      // Get conditions
      const conditions = await this.runQuery(
        'SELECT * FROM alarm_conditions WHERE rule_id = ? ORDER BY id',
        [id]
      );

      // Get actions
      const actions = await this.runQuery(
        'SELECT * FROM alarm_actions WHERE rule_id = ? ORDER BY action_order',
        [id]
      );

      return {
        id: ruleData.id,
        name: ruleData.name,
        description: ruleData.description,
        priority: ruleData.priority,
        category: ruleData.category,
        enabled: Boolean(ruleData.enabled),
        conditions: conditions.map(c => ({
          type: c.condition_type,
          value: JSON.parse(c.condition_value),
          operator: c.condition_operator
        })),
        actions: actions.map(a => ({
          type: a.action_type,
          config: JSON.parse(a.action_config)
        })),
        createdAt: ruleData.created_at,
        updatedAt: ruleData.updated_at
      };
    } catch (error) {
      console.error('Error getting rule:', error);
      return null;
    }
  }

  /**
   * Get all rules
   */
  async getAllRules() {
    try {
      const rules = await this.runQuery('SELECT * FROM alarm_rules ORDER BY created_at DESC');
      
      const result = [];
      for (const rule of rules) {
        const fullRule = await this.getRule(rule.id);
        if (fullRule) {
          result.push(fullRule);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting all rules:', error);
      return [];
    }
  }

  /**
   * Get rules by category
   */
  async getRulesByCategory(category) {
    try {
      const rules = await this.runQuery(
        'SELECT * FROM alarm_rules WHERE category = ? ORDER BY created_at DESC',
        [category]
      );
      
      const result = [];
      for (const rule of rules) {
        const fullRule = await this.getRule(rule.id);
        if (fullRule) {
          result.push(fullRule);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting rules by category:', error);
      return [];
    }
  }

  /**
   * Get enabled rules
   */
  async getEnabledRules() {
    try {
      const rules = await this.runQuery(
        'SELECT * FROM alarm_rules WHERE enabled = 1 ORDER BY created_at DESC'
      );
      
      const result = [];
      for (const rule of rules) {
        const fullRule = await this.getRule(rule.id);
        if (fullRule) {
          result.push(fullRule);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting enabled rules:', error);
      return [];
    }
  }

  /**
   * Record alarm trigger
   */
  async recordAlarmTrigger(ruleId, eventType, eventSource, eventData) {
    try {
      const result = await this.runQuery(
        'INSERT INTO alarm_history (rule_id, event_type, event_source, event_data) VALUES (?, ?, ?, ?)',
        [ruleId, eventType, eventSource, JSON.stringify(eventData)]
      );
      
      this.emit('alarm:triggered', {
        id: result.lastID,
        ruleId,
        eventType,
        eventSource,
        eventData
      });
      
      return result.lastID;
    } catch (error) {
      console.error('Error recording alarm trigger:', error);
      throw error;
    }
  }

  /**
   * Acknowledge an alarm
   */
  async acknowledgeAlarm(alarmId, userId, notes = '') {
    try {
      await this.runQuery(
        'INSERT INTO alarm_acknowledgments (alarm_id, user_id, notes) VALUES (?, ?, ?)',
        [alarmId, userId, notes]
      );
      
      await this.runQuery(
        'UPDATE alarm_history SET status = ? WHERE id = ?',
        ['acknowledged', alarmId]
      );
      
      this.emit('alarm:acknowledged', { alarmId, userId, notes });
      return true;
    } catch (error) {
      console.error('Error acknowledging alarm:', error);
      throw error;
    }
  }

  /**
   * Resolve an alarm
   */
  async resolveAlarm(alarmId, userId) {
    try {
      await this.runQuery(
        'UPDATE alarm_history SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['resolved', alarmId]
      );
      
      this.emit('alarm:resolved', { alarmId, userId });
      return true;
    } catch (error) {
      console.error('Error resolving alarm:', error);
      throw error;
    }
  }

  /**
   * Get alarm history
   */
  async getAlarmHistory(limit = 100, offset = 0, filters = {}) {
    try {
      let query = `
        SELECT ah.*, ar.name as rule_name, ar.priority as rule_priority
        FROM alarm_history ah
        LEFT JOIN alarm_rules ar ON ah.rule_id = ar.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.status) {
        query += ' AND ah.status = ?';
        params.push(filters.status);
      }

      if (filters.ruleId) {
        query += ' AND ah.rule_id = ?';
        params.push(filters.ruleId);
      }

      if (filters.eventType) {
        query += ' AND ah.event_type = ?';
        params.push(filters.eventType);
      }

      query += ' ORDER BY ah.triggered_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const alarms = await this.runQuery(query, params);
      
      return alarms.map(alarm => ({
        id: alarm.id,
        ruleId: alarm.rule_id,
        ruleName: alarm.rule_name,
        rulePriority: alarm.rule_priority,
        eventType: alarm.event_type,
        eventSource: alarm.event_source,
        eventData: JSON.parse(alarm.event_data),
        status: alarm.status,
        triggeredAt: alarm.triggered_at,
        resolvedAt: alarm.resolved_at
      }));
    } catch (error) {
      console.error('Error getting alarm history:', error);
      return [];
    }
  }

  /**
   * Get statistics
   */
  async getStats() {
    try {
      const stats = await this.runQuery(`
        SELECT 
          COUNT(*) as total_rules,
          SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled_rules,
          SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as disabled_rules
        FROM alarm_rules
      `);

      const alarmStats = await this.runQuery(`
        SELECT 
          COUNT(*) as total_alarms,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_alarms,
          SUM(CASE WHEN status = 'acknowledged' THEN 1 ELSE 0 END) as acknowledged_alarms,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_alarms
        FROM alarm_history
      `);

      return {
        rules: stats[0] || { total_rules: 0, enabled_rules: 0, disabled_rules: 0 },
        alarms: alarmStats[0] || { total_alarms: 0, active_alarms: 0, acknowledged_alarms: 0, resolved_alarms: 0 }
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { rules: {}, alarms: {} };
    }
  }

  /**
   * Run a database query
   */
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        this.db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      } else {
        this.db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this);
          }
        });
      }
    });
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          }
          this.db = null;
          this.isInitialized = false;
          resolve();
        });
      });
    }
  }
}

module.exports = AlarmManagerService;
