import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

/**
 * Event Timeline Visualization Component
 * 
 * Renders an event timeline animation using data from various connectors
 */
export const EventTimelineComponent = ({ data }) => {
  const frame = useCurrentFrame();
  const { events, eventTypes, startTime, endTime } = data;

  // Calculate progress through the timeline
  const totalFrames = 300; // 10 seconds at 30fps
  const progress = frame / totalFrames;

  // Find current events based on frame
  const currentTime = new Date(startTime).getTime() + (progress * (new Date(endTime).getTime() - new Date(startTime).getTime()));
  const currentEvents = events.filter(event => new Date(event.timestamp).getTime() <= currentTime);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a1a',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Background grid */}
      <svg width="1920" height="1080" style={{ position: 'absolute' }}>
        {/* Grid lines */}
        {Array.from({ length: 18 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * 100}
            y1="0"
            x2={i * 100}
            y2="1080"
            stroke="#333"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <line
            key={`h${i}`}
            x1="0"
            y1={i * 100}
            x2="1920"
            y2={i * 100}
            stroke="#333"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* Timeline */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          left: 100,
          right: 100,
          height: 400,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '10px',
          border: '1px solid #333',
          padding: '20px',
        }}
      >
        <h2 style={{ margin: '0 0 20px 0', color: '#00ff00', textAlign: 'center' }}>
          📊 Event Timeline
        </h2>
        
        {/* Timeline bar */}
        <div
          style={{
            width: '100%',
            height: 20,
            backgroundColor: '#333',
            borderRadius: '10px',
            position: 'relative',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              backgroundColor: '#00ff00',
              borderRadius: '10px',
              transition: 'width 0.1s ease',
            }}
          />
        </div>

        {/* Events list */}
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {currentEvents.map((event, index) => (
            <div
              key={index}
              style={{
                padding: '10px',
                margin: '5px 0',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '5px',
                border: '1px solid #555',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#00ff00' }}>
                  {event.type || 'Unknown Event'}
                </span>
                <span style={{ fontSize: '12px', color: '#ccc' }}>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {event.cameraId && (
                <div style={{ fontSize: '12px', color: '#ccc' }}>
                  Camera: {event.cameraId}
                </div>
              )}
              {event.data && event.data.smartDetectTypes && (
                <div style={{ fontSize: '12px', color: '#ccc' }}>
                  Detection: {event.data.smartDetectTypes.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Info panel */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: 50,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '20px',
          borderRadius: '10px',
          border: '1px solid #333',
        }}
      >
        <h3 style={{ margin: '0 0 10px 0', color: '#00ff00' }}>
          📈 Event Statistics
        </h3>
        <p style={{ margin: '5px 0' }}>
          <strong>Total Events:</strong> {events.length}
        </p>
        <p style={{ margin: '5px 0' }}>
          <strong>Current Events:</strong> {currentEvents.length}
        </p>
        <p style={{ margin: '5px 0' }}>
          <strong>Event Types:</strong> {eventTypes.join(', ')}
        </p>
        <p style={{ margin: '5px 0' }}>
          <strong>Progress:</strong> {Math.round(progress * 100)}%
        </p>
      </div>

      {/* Time display */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          right: 50,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '20px',
          borderRadius: '10px',
          border: '1px solid #333',
          textAlign: 'center',
        }}
      >
        <h3 style={{ margin: '0 0 10px 0', color: '#00ff00' }}>🕐 Timeline</h3>
        <p style={{ margin: '5px 0' }}>
          <strong>Start:</strong> {new Date(startTime).toLocaleTimeString()}
        </p>
        <p style={{ margin: '5px 0' }}>
          <strong>Current:</strong> {new Date(currentTime).toLocaleTimeString()}
        </p>
        <p style={{ margin: '5px 0' }}>
          <strong>End:</strong> {new Date(endTime).toLocaleTimeString()}
        </p>
      </div>
    </AbsoluteFill>
  );
}; 