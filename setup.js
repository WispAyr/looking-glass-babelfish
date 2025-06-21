#!/usr/bin/env node

/**
 * Babelfish Looking Glass Setup Script
 * 
 * Initializes the database and performs initial configuration.
 * Can be run independently or as part of the main application.
 */

const path = require('path');
const fs = require('fs');
const winston = require('winston');

// Load configuration
const config = require('./config/config.js');

// Create logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'setup' },
  transports: [
    new winston.transports.File({ filename: config.logging.file }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Import services
const DatabaseService = require('./services/databaseService.js');
const ConfigManager = require('./services/configManager.js');
const SetupWizard = require('./services/setupWizard.js');

async function main() {
  console.log('🚀 Babelfish Looking Glass Setup');
  console.log('================================\n');

  try {
    // Initialize database service
    console.log('📊 Initializing database...');
    const databaseService = new DatabaseService(config, logger);
    await databaseService.initialize();
    console.log('✅ Database initialized successfully\n');

    // Initialize configuration manager
    console.log('⚙️  Initializing configuration manager...');
    const configManager = new ConfigManager(config, logger);
    configManager.setDatabaseService(databaseService);
    await configManager.initialize();
    console.log('✅ Configuration manager initialized\n');

    // Initialize setup wizard
    console.log('🧙‍♂️ Initializing setup wizard...');
    const setupWizard = new SetupWizard(config, logger);
    setupWizard.setServices(configManager, null, databaseService);
    await setupWizard.initialize();
    console.log('✅ Setup wizard initialized\n');

    // Check if setup is already completed
    const setupConfig = await configManager.getConfiguration('system', 'setup');
    if (setupConfig && setupConfig.config.completed) {
      console.log('✅ Setup already completed');
      console.log(`   Completed at: ${setupConfig.config.completedAt}`);
      console.log(`   Steps completed: ${setupConfig.config.steps}`);
      
      const stats = await databaseService.getStats();
      console.log('\n📈 Current System Stats:');
      console.log(`   Connectors: ${stats.connectors}`);
      console.log(`   Entities: ${stats.entities}`);
      console.log(`   Events: ${stats.events}`);
      console.log(`   Configurations: ${stats.configurations}`);
      console.log(`   Rules: ${stats.rules}`);
      
      return;
    }

    // Start interactive setup
    console.log('🎯 Starting interactive setup...\n');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => {
      return new Promise((resolve) => {
        rl.question(prompt, resolve);
      });
    };

    // Welcome step
    console.log('Welcome to Babelfish Looking Glass Setup!');
    console.log('This wizard will help you configure your system.\n');

    // System configuration
    console.log('📋 Step 1: System Configuration');
    const serverName = await question('Server Name (default: Babelfish-LG): ') || 'Babelfish-LG';
    const environment = await question('Environment (development/production, default: development): ') || 'development';
    const logLevel = await question('Log Level (debug/info/warn/error, default: info): ') || 'info';

    await setupWizard.submitStepData({
      serverName,
      environment,
      logLevel
    });
    console.log('✅ System configuration saved\n');

    // Database setup
    console.log('📊 Step 2: Database Setup');
    const dbEnabled = await question('Enable Database? (y/n, default: y): ') || 'y';
    
    if (dbEnabled.toLowerCase() === 'y') {
      const dbType = await question('Database Type (sqlite/mysql/postgresql, default: sqlite): ') || 'sqlite';
      
      let dbConfig = {
        enabled: true,
        type: dbType
      };

      if (dbType !== 'sqlite') {
        dbConfig.host = await question('Database Host: ');
        dbConfig.port = parseInt(await question('Database Port: ')) || 3306;
        dbConfig.name = await question('Database Name (default: babelfish): ') || 'babelfish';
        dbConfig.username = await question('Database Username: ');
        dbConfig.password = await question('Database Password: ');
      }

      await setupWizard.submitStepData(dbConfig);
      console.log('✅ Database configuration saved\n');
    }

    // Connector discovery
    console.log('🔍 Step 3: Connector Discovery');
    console.log('Discovering available connectors...');
    await setupWizard.nextStep();
    await setupWizard.executeDiscoveryStep();
    console.log('✅ Connector discovery completed\n');

    // UniFi Protect setup
    console.log('📹 Step 4: UniFi Protect Setup');
    const setupUnifi = await question('Configure UniFi Protect connector? (y/n, default: y): ') || 'y';
    
    if (setupUnifi.toLowerCase() === 'y') {
      const host = await question('NVR IP Address: ');
      const port = parseInt(await question('Port (default: 443): ')) || 443;
      const protocol = await question('Protocol (http/https, default: https): ') || 'https';
      const apiKey = await question('API Key: ');
      const username = await question('Username (optional): ');
      const password = await question('Password (optional): ');

      await setupWizard.submitStepData({
        host,
        port,
        protocol,
        apiKey,
        username: username || undefined,
        password: password || undefined
      });
      console.log('✅ UniFi Protect configuration saved\n');
    }

    // MQTT setup
    console.log('📡 Step 5: MQTT Setup');
    const setupMqtt = await question('Configure MQTT connector? (y/n, default: n): ') || 'n';
    
    if (setupMqtt.toLowerCase() === 'y') {
      const host = await question('MQTT Broker Host: ');
      const port = parseInt(await question('Port (default: 1883): ')) || 1883;
      const username = await question('Username (optional): ');
      const password = await question('Password (optional): ');
      const clientId = await question('Client ID (default: babelfish-lookingglass): ') || 'babelfish-lookingglass';

      await setupWizard.submitStepData({
        host,
        port,
        username: username || undefined,
        password: password || undefined,
        clientId
      });
      console.log('✅ MQTT configuration saved\n');
    }

    // Map setup
    console.log('🗺️  Step 6: Map Configuration');
    const autoRegister = await question('Auto-register connectors with maps? (y/n, default: y): ') || 'y';
    const enableWebSockets = await question('Enable WebSockets? (y/n, default: y): ') || 'y';
    const editMode = await question('Enable edit mode? (y/n, default: n): ') || 'n';

    await setupWizard.submitStepData({
      autoRegisterConnectors: autoRegister.toLowerCase() === 'y',
      enableWebSockets: enableWebSockets.toLowerCase() === 'y',
      editMode: editMode.toLowerCase() === 'y'
    });
    console.log('✅ Map configuration saved\n');

    // GUI setup
    console.log('🖥️  Step 7: Web Interface Setup');
    const theme = await question('Theme (dark/light, default: dark): ') || 'dark';
    const layout = await question('Layout (default/compact/wide, default: default): ') || 'default';
    const autoRegisterWithMaps = await question('Auto-register with maps? (y/n, default: y): ') || 'y';

    await setupWizard.submitStepData({
      theme,
      layout,
      autoRegisterWithMaps: autoRegisterWithMaps.toLowerCase() === 'y'
    });
    console.log('✅ Web interface configuration saved\n');

    // Rules setup
    console.log('⚡ Step 8: Rules Configuration');
    const setupRules = await question('Import default rules? (y/n, default: y): ') || 'y';
    
    if (setupRules.toLowerCase() === 'y') {
      await setupWizard.executeRulesStep();
      console.log('✅ Default rules imported\n');
    }

    // Completion
    console.log('🎉 Step 9: Setup Complete');
    await setupWizard.executeCompletionStep();
    console.log('✅ Setup completed successfully!\n');

    // Display final stats
    const stats = await databaseService.getStats();
    console.log('📈 Final System Stats:');
    console.log(`   Connectors: ${stats.connectors}`);
    console.log(`   Entities: ${stats.entities}`);
    console.log(`   Events: ${stats.events}`);
    console.log(`   Configurations: ${stats.configurations}`);
    console.log(`   Rules: ${stats.rules}`);

    console.log('\n🚀 You can now start the server with: npm start');
    console.log('📖 Check the README.md for more information');

    rl.close();

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    logger.error('Setup failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Setup interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Setup terminated');
  process.exit(0);
});

// Run setup
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}

module.exports = { main }; 