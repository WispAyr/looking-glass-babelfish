import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

/**
 * Flight Path Visualization Component
 * 
 * Renders a flight path animation using data from ADSB connector
 */
export const FlightPathComponent = ({ data }) => {
  const frame = useCurrentFrame();
  const { flightData, callsign, registration, startTime, endTime } = data;

  // Calculate progress through the flight
  const totalFrames = 300; // 10 seconds at 30fps
  const progress = frame / totalFrames;

  // Find current position based on frame
  const currentIndex = Math.floor(progress * (flightData.length - 1));
  const currentPosition = flightData[currentIndex] || flightData[0];

  // Interpolate between positions for smooth animation
  const nextIndex = Math.min(currentIndex + 1, flightData.length - 1);
  const nextPosition = flightData[nextIndex];
  
  const interpolatedLat = interpolate(
    frame,
    [currentIndex * (totalFrames / flightData.length), (currentIndex + 1) * (totalFrames / flightData.length)],
    [currentPosition?.lat || 0, nextPosition?.lat || 0]
  );
  
  const interpolatedLon = interpolate(
    frame,
    [currentIndex * (totalFrames / flightData.length), (currentIndex + 1) * (totalFrames / flightData.length)],
    [currentPosition?.lon || 0, nextPosition?.lon || 0]
  );

  // Convert lat/lon to screen coordinates (simplified)
  const screenX = (interpolatedLon + 180) * (1920 / 360);
  const screenY = (90 - interpolatedLat) * (1080 / 180);

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

      {/* Flight path trail */}
      <svg width="1920" height="1080" style={{ position: 'absolute' }}>
        <path
          d={flightData
            .slice(0, currentIndex + 1)
            .map((point, i) => {
              const x = (point.lon + 180) * (1920 / 360);
              const y = (90 - point.lat) * (1080 / 180);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            })
            .join(' ')}
          stroke="#00ff00"
          strokeWidth="3"
          fill="none"
          opacity="0.7"
        />
      </svg>

      {/* Aircraft position */}
      <div
        style={{
          position: 'absolute',
          left: screenX - 10,
          top: screenY - 10,
          width: 20,
          height: 20,
          backgroundColor: '#ff0000',
          borderRadius: '50%',
          border: '2px solid white',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Flight info */}
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
        <h2 style={{ margin: '0 0 10px 0', color: '#00ff00' }}>
          ✈️ Flight Path Visualization
        </h2>
        <p style={{ margin: '5px 0' }}><strong>Callsign:</strong> {callsign || 'N/A'}</p>
        <p style={{ margin: '5px 0' }}><strong>Registration:</strong> {registration || 'N/A'}</p>
        <p style={{ margin: '5px 0' }}><strong>Current Position:</strong></p>
        <p style={{ margin: '5px 0', fontSize: '14px' }}>
          Lat: {interpolatedLat.toFixed(4)}° | Lon: {interpolatedLon.toFixed(4)}°
        </p>
        <p style={{ margin: '5px 0' }}>
          <strong>Progress:</strong> {Math.round(progress * 100)}%
        </p>
        <p style={{ margin: '5px 0' }}>
          <strong>Data Points:</strong> {flightData.length}
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
          <strong>End:</strong> {new Date(endTime).toLocaleTimeString()}
        </p>
        <p style={{ margin: '5px 0' }}>
          <strong>Duration:</strong> {Math.round((new Date(endTime) - new Date(startTime)) / 1000)}s
        </p>
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 50,
          left: 50,
          right: 50,
          height: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '10px',
          border: '1px solid #333',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: '#00ff00',
            transition: 'width 0.1s ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
          }}
        >
          Flight Progress: {Math.round(progress * 100)}%
        </div>
      </div>
    </AbsoluteFill>
  );
}; 