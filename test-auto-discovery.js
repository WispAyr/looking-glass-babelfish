#!/usr/bin/env node

/**
 * Test script for automatic camera discovery functionality
 * 
 * This script tests the UniFi Protect connector's automatic camera discovery
 * and entity management features.
 */

const config = require('./config/config');
const EntityManager = require('./services/entityManager');
const UnifiProtectConnector = require('./connectors/types/UnifiProtectConnector');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function testAutoDiscovery() {
  logger.info('Starting automatic camera discovery test...');
  
  try {
    // Initialize entity manager
    const entityManager = new EntityManager(config.entities || {}, logger);
    logger.info('Entity manager initialized');
    
    // Load connector configuration
    const connectorConfig = require('./config/connectors.json');
    const unifiConfig = connectorConfig.connectors.find(c => c.type === 'unifi-protect');
    
    if (!unifiConfig) {
      throw new Error('UniFi Protect connector configuration not found');
    }
    
    logger.info(`Found UniFi Protect connector: ${unifiConfig.name}`);
    
    // Create connector instance
    const connector = new UnifiProtectConnector({
      ...unifiConfig,
      logger
    });
    
    // Set entity manager reference
    connector.setEntityManager(entityManager);
    
    // Listen for events
    connector.on('discovery:completed', (data) => {
      logger.info('Discovery completed:', data);
    });
    
    connector.on('discovery:error', (data) => {
      logger.error('Discovery error:', data);
    });
    
    connector.on('camera:added', (data) => {
      logger.info('Camera added:', data.cameraId);
    });
    
    connector.on('motion:detected', (data) => {
      logger.info('Motion detected:', data.cameraId);
    });
    
    entityManager.on('entity:created', (entity) => {
      logger.info('Entity created:', entity.id, entity.name);
    });
    
    entityManager.on('entity:updated', (entity) => {
      logger.info('Entity updated:', entity.id);
    });
    
    // Connect to UniFi Protect
    logger.info('Connecting to UniFi Protect...');
    await connector.connect();
    
    logger.info('Connection successful');
    
    // Wait for initial discovery
    logger.info('Waiting for initial camera discovery...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check discovered entities
    const entities = entityManager.getEntities({ type: 'camera' });
    logger.info(`Found ${entities.length} camera entities:`);
    
    entities.forEach(entity => {
      logger.info(`  - ${entity.name} (${entity.id}) - Status: ${entity.status}`);
      if (entity.data?.capabilities) {
        logger.info(`    Capabilities: ${Object.keys(entity.data.capabilities).filter(k => entity.data.capabilities[k]).join(', ')}`);
      }
    });
    
    // Test manual discovery
    logger.info('Testing manual discovery...');
    await entityManager.performAutoDiscovery();
    
    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get final entity count
    const finalEntities = entityManager.getEntities({ type: 'camera' });
    logger.info(`Final entity count: ${finalEntities.length}`);
    
    // Get entity statistics
    const stats = entityManager.getStats();
    logger.info('Entity statistics:', stats);
    
    // Test entity operations
    if (entities.length > 0) {
      const testEntity = entities[0];
      logger.info(`Testing entity operations with: ${testEntity.id}`);
      
      // Update entity
      const updatedEntity = await entityManager.updateEntity(testEntity.id, {
        status: 'test-updated',
        data: {
          ...testEntity.data,
          testUpdate: new Date().toISOString()
        }
      });
      logger.info('Entity updated successfully');
      
      // Get entity by ID
      const retrievedEntity = entityManager.getEntity(testEntity.id);
      logger.info('Entity retrieved:', retrievedEntity.id === testEntity.id);
    }
    
    // Disconnect
    logger.info('Disconnecting...');
    await connector.disconnect();
    
    logger.info('Test completed successfully!');
    
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  testAutoDiscovery().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testAutoDiscovery }; 