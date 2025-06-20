# MQTT Flow for Camera Events

The system automatically routes all camera events to MQTT topics for external processing and integration.

## Overview

When camera events occur (motion detection, smart detection, recording events, etc.), they are automatically published to MQTT topics with comprehensive event data.

## MQTT Topics

### Event-Specific Topics
- `camera/events/motionDetected` - Motion detection events
- `camera/events/smartDetected` - Smart detection events  
- `camera/events/recordingEvent` - Recording events
- `camera/events/connectionEvent` - Connection events
- `camera/events/cameraAdded` - Camera addition events
- `camera/events/cameraRemoved` - Camera removal events

### All Events Topic
- `camera/events/all` - All camera events (duplicate of event-specific topics)

## Message Format

All MQTT messages contain JSON payloads with the following structure:

```json
{
  "eventType": "motionDetected",
  "cameraId": "camera-id",
  "entityId": "camera-camera-id",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "source": "unifi-protect-websocket",
  "connectorId": "van-unifi",
  "eventData": {
    "state": "started",
    "score": 0.85,
    "zone": "zone-1"
  },
  "metadata": {
    "rule": "camera-events-mqtt-rule",
    "processed": true
  }
}
```

### Field Descriptions

- `eventType` - Type of camera event
- `cameraId` - Original camera ID from UniFi Protect
- `entityId` - Entity ID in the system
- `timestamp` - ISO timestamp of the event
- `source` - Event source (always "unifi-protect-websocket")
- `connectorId` - ID of the UniFi Protect connector
- `eventData` - Event-specific data (varies by event type)
- `metadata` - Processing metadata

## Event Types

### Motion Detection
```json
{
  "eventType": "motionDetected",
  "eventData": {
    "state": "started|ended",
    "score": 0.85,
    "zone": "zone-1"
  }
}
```

### Smart Detection
```json
{
  "eventType": "smartDetected", 
  "eventData": {
    "type": "person|vehicle|animal",
    "score": 0.92,
    "object": "person"
  }
}
```

### Recording Events
```json
{
  "eventType": "recordingEvent",
  "eventData": {
    "type": "motion|continuous|timelapse",
    "status": "started|stopped|completed",
    "duration": 30
  }
}
```

### Connection Events
```json
{
  "eventType": "connectionEvent",
  "eventData": {
    "state": "connected|disconnected",
    "ip": "192.168.1.100",
    "mac": "00:11:22:33:44:55"
  }
}
```

## Testing

### Start the MQTT Listener
```bash
npm run test:mqtt
```

This will:
1. Connect to the MQTT broker
2. Subscribe to all camera event topics
3. Display received messages in real-time

### Manual Testing
You can also use any MQTT client to subscribe to the topics:

```bash
# Using mosquitto_sub
mosquitto_sub -h localhost -t "camera/events/#" -v

# Using mqtt-cli
mqtt sub -h localhost -t "camera/events/#"
```

## Integration Examples

### Node.js MQTT Client
```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  client.subscribe('camera/events/motionDetected');
});

client.on('message', (topic, message) => {
  const event = JSON.parse(message.toString());
  console.log('Motion detected:', event.cameraId);
});
```

### Python MQTT Client
```python
import paho.mqtt.client as mqtt
import json

def on_connect(client, userdata, flags, rc):
    client.subscribe("camera/events/#")

def on_message(client, userdata, msg):
    event = json.loads(msg.payload.decode())
    print(f"Event: {event['eventType']} on camera {event['cameraId']}")

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883, 60)
client.loop_forever()
```

### Home Assistant Integration
```yaml
# configuration.yaml
mqtt:
  sensor:
    - name: "Camera Motion"
      state_topic: "camera/events/motionDetected"
      value_template: "{{ value_json.eventData.state }}"
      json_attributes_topic: "camera/events/motionDetected"
      json_attributes_template: "{{ value_json | tojson }}"
```

## Configuration

The MQTT flow is enabled by default when the flow system is enabled. The rule can be modified in `config/defaultRules.js`:

```javascript
{
  id: 'camera-events-mqtt-rule',
  name: 'Camera Events to MQTT',
  conditions: {
    eventType: ['motionDetected', 'smartDetected', 'recordingEvent', 'connectionEvent', 'cameraAdded', 'cameraRemoved'],
    source: 'unifi-protect-websocket'
  },
  actions: [
    {
      type: 'mqtt_publish',
      parameters: {
        topic: 'camera/events/{{type}}',
        payload: { /* event data */ },
        qos: 1,
        retain: false
      }
    }
  ]
}
```

## Troubleshooting

### No MQTT Messages
1. Check that MQTT is enabled in configuration
2. Verify MQTT broker is running
3. Check rule engine is enabled
4. Verify camera events are being generated

### Connection Issues
1. Check MQTT broker host/port
2. Verify network connectivity
3. Check MQTT broker logs

### Message Format Issues
1. Check event data structure
2. Verify JSON formatting
3. Check rule template syntax 