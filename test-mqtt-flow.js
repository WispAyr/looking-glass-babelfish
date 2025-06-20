#!/usr/bin/env node

/**
 * Test script for MQTT flow functionality
 * 
 * This script tests the automatic MQTT publishing of camera events.
 */

const mqtt = require('mqtt');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function testMqttFlow() {
  logger.info('Starting MQTT flow test...');
  
  // Connect to MQTT broker
  const client = mqtt.connect('mqtt://localhost:1883');
  
  client.on('connect', () => {
    logger.info('Connected to MQTT broker');
    
    // Subscribe to camera event topics
    const topics = [
      'camera/events/motionDetected',
      'camera/events/smartDetected', 
      'camera/events/recordingEvent',
      'camera/events/connectionEvent',
      'camera/events/cameraAdded',
      'camera/events/cameraRemoved',
      'camera/events/all'
    ];
    
    topics.forEach(topic => {
      client.subscribe(topic, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to ${topic}:`, err);
        } else {
          logger.info(`Subscribed to ${topic}`);
        }
      });
    });
  });
  
  client.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      logger.info(`📡 MQTT Message received on ${topic}:`);
      logger.info(`   Event Type: ${payload.eventType}`);
      logger.info(`   Camera ID: ${payload.cameraId}`);
      logger.info(`   Timestamp: ${payload.timestamp}`);
      logger.info(`   Source: ${payload.source}`);
      
      if (payload.eventData) {
        logger.info(`   Event Data: ${JSON.stringify(payload.eventData, null, 2)}`);
      }
      
      logger.info('---');
    } catch (error) {
      logger.error('Error parsing MQTT message:', error);
    }
  });
  
  client.on('error', (error) => {
    logger.error('MQTT connection error:', error);
  });
  
  client.on('close', () => {
    logger.info('MQTT connection closed');
  });
  
  // Keep the script running
  logger.info('Listening for camera events on MQTT...');
  logger.info('Press Ctrl+C to stop');
  
  process.on('SIGINT', () => {
    logger.info('Stopping MQTT test...');
    client.end();
    process.exit(0);
  });
}

// Run test if called directly
if (require.main === module) {
  testMqttFlow().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testMqttFlow }; 