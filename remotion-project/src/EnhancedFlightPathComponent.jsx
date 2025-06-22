import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring, useVideoMetadata } from 'remotion';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const EnhancedFlightPathComponent = ({ flightData, config = {} }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const metadata = useVideoMetadata();
  
  // Default configuration
  const defaultConfig = {
    mapStyle: 'satellite',
    animationSpeed: 'normal',
    showDataOverlays: true,
    showAirspace: true,
    showWeather: false,
    showParticles: true,
    cameraMovement: 'smooth',
    colorScheme: 'aviation',
    fontFamily: 'monospace',
    enableAudio: true,
    enableSubtitles: true
  };
  
  const finalConfig = { ...defaultConfig, ...config };
  
  // Extract flight data
  const {
    callsign = 'Unknown',
    registration = 'N/A',
    icao24 = 'N/A',
    startTime,
    endTime,
    flightPath = [],
    startPosition,
    endPosition,
    maxAltitude = 0,
    maxSpeed = 0,
    totalDistance = 0,
    squawk = 'N/A',
    emergency = false,
    airspaceInfo = [],
    aircraftInfo = {},
    alerts = []
  } = flightData || {};
  
  // Animation timing
  const animationProgress = frame / durationInFrames;
  const springConfig = { damping: 20, stiffness: 100 };
  
  // Title animation
  const titleOpacity = spring({
    frame: frame - 30,
    fps,
    config: springConfig,
  });
  
  const titleScale = spring({
    frame: frame - 30,
    fps,
    config: springConfig,
  });
  
  // Flight path animation
  const pathProgress = spring({
    frame: frame - 60,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  
  // Calculate animated flight path
  const animatedPath = useMemo(() => {
    if (!flightPath || flightPath.length === 0) {
      // Create simple path from start to end position
      if (startPosition && endPosition) {
        return [startPosition, endPosition];
      }
      return [];
    }
    
    const totalPoints = flightPath.length;
    const currentPointIndex = Math.floor(pathProgress * totalPoints);
    return flightPath.slice(0, currentPointIndex + 1);
  }, [flightPath, pathProgress, startPosition, endPosition]);
  
  // Current position for aircraft marker
  const currentPosition = useMemo(() => {
    if (animatedPath.length === 0) return null;
    return animatedPath[animatedPath.length - 1];
  }, [animatedPath]);
  
  // Data overlay animations
  const dataOpacity = spring({
    frame: frame - 120,
    fps,
    config: springConfig,
  });
  
  // Emergency alert animation
  const emergencyBlink = emergency ? Math.sin(frame * 0.2) * 0.5 + 0.5 : 0;
  
  // Color scheme
  const colors = {
    aviation: {
      primary: '#00ff00',
      secondary: '#ffff00',
      accent: '#00ffff',
      warning: '#ff8800',
      emergency: '#ff0000',
      background: 'rgba(0, 0, 0, 0.8)',
      text: '#ffffff'
    }
  };
  
  const colorScheme = colors[finalConfig.colorScheme] || colors.aviation;
  
  // Map tile URL based on style
  const getMapTileUrl = () => {
    switch (finalConfig.mapStyle) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };
  
  // Calculate map bounds
  const mapBounds = useMemo(() => {
    if (flightPath.length === 0) {
      return [[55, -5], [56, -4]]; // Default UK bounds
    }
    
    const lats = flightPath.map(p => p.lat);
    const lons = flightPath.map(p => p.lon);
    
    return [
      [Math.min(...lats) - 0.1, Math.min(...lons) - 0.1],
      [Math.max(...lats) + 0.1, Math.max(...lons) + 0.1]
    ];
  }, [flightPath]);
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Background Map */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <MapContainer
          bounds={mapBounds}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url={getMapTileUrl()}
            attribution=""
          />
          
          {/* Flight Path */}
          {animatedPath.length > 1 && (
            <Polyline
              positions={animatedPath.map(p => [p.lat, p.lon])}
              color={colorScheme.primary}
              weight={4}
              opacity={0.8}
              dashArray="10, 5"
            />
          )}
          
          {/* Start Marker */}
          {startPosition && (
            <Marker position={[startPosition.lat, startPosition.lon]}>
              <Popup>
                <div style={{ color: colorScheme.text }}>
                  <strong>Start Position</strong><br />
                  {startPosition.lat.toFixed(4)}, {startPosition.lon.toFixed(4)}
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* End Marker */}
          {endPosition && (
            <Marker position={[endPosition.lat, endPosition.lon]}>
              <Popup>
                <div style={{ color: colorScheme.text }}>
                  <strong>End Position</strong><br />
                  {endPosition.lat.toFixed(4)}, {endPosition.lon.toFixed(4)}
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* Current Aircraft Position */}
          {currentPosition && (
            <Marker position={[currentPosition.lat, currentPosition.lon]}>
              <Popup>
                <div style={{ color: colorScheme.text }}>
                  <strong>{callsign}</strong><br />
                  {currentPosition.lat.toFixed(4)}, {currentPosition.lon.toFixed(4)}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      
      {/* Title Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: 50,
          right: 50,
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          zIndex: 1000
        }}
      >
        <h1
          style={{
            color: colorScheme.primary,
            fontSize: '4rem',
            fontFamily: finalConfig.fontFamily,
            textShadow: `0 0 20px ${colorScheme.primary}`,
            margin: 0,
            textAlign: 'center'
          }}
        >
          {callsign} Flight Path
        </h1>
        <h2
          style={{
            color: colorScheme.secondary,
            fontSize: '2rem',
            fontFamily: finalConfig.fontFamily,
            textAlign: 'center',
            margin: '10px 0 0 0'
          }}
        >
          {registration} • {icao24}
        </h2>
      </div>
      
      {/* Data Overlay */}
      {finalConfig.showDataOverlays && (
        <div
          style={{
            position: 'absolute',
            top: 200,
            right: 50,
            width: 400,
            opacity: dataOpacity,
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: colorScheme.background,
              border: `2px solid ${colorScheme.primary}`,
              borderRadius: '10px',
              padding: '20px',
              color: colorScheme.text,
              fontFamily: finalConfig.fontFamily
            }}
          >
            <h3 style={{ color: colorScheme.primary, margin: '0 0 15px 0' }}>
              Flight Data
            </h3>
            
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Max Altitude:</span>
                <span style={{ color: colorScheme.accent }}>{maxAltitude} ft</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Max Speed:</span>
                <span style={{ color: colorScheme.accent }}>{maxSpeed} kts</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Distance:</span>
                <span style={{ color: colorScheme.accent }}>{totalDistance.toFixed(1)} nm</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Squawk:</span>
                <span style={{ 
                  color: squawk === '7500' || squawk === '7700' ? colorScheme.emergency : colorScheme.accent 
                }}>
                  {squawk}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Duration:</span>
                <span style={{ color: colorScheme.accent }}>
                  {startTime && endTime ? 
                    `${Math.round((new Date(endTime) - new Date(startTime)) / 1000 / 60)} min` : 
                    'Active'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Emergency Alert */}
      {emergency && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: emergencyBlink,
            zIndex: 2000
          }}
        >
          <div
            style={{
              backgroundColor: colorScheme.emergency,
              color: '#fff',
              padding: '20px 40px',
              borderRadius: '10px',
              fontSize: '2rem',
              fontFamily: finalConfig.fontFamily,
              fontWeight: 'bold',
              textAlign: 'center',
              border: `3px solid #fff`,
              boxShadow: `0 0 30px ${colorScheme.emergency}`
            }}
          >
            EMERGENCY FLIGHT
          </div>
        </div>
      )}
      
      {/* Progress Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 50,
          left: 50,
          right: 50,
          height: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 5,
          overflow: 'hidden',
          zIndex: 1000
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${animationProgress * 100}%`,
            backgroundColor: colorScheme.primary,
            transition: 'width 0.1s ease'
          }}
        />
      </div>
      
      {/* Alerts */}
      {alerts.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            left: 50,
            opacity: dataOpacity,
            zIndex: 1000
          }}
        >
          {alerts.map((alert, index) => (
            <div
              key={index}
              style={{
                backgroundColor: alert.type === 'emergency' ? colorScheme.emergency : colorScheme.warning,
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '5px',
                marginBottom: '10px',
                fontFamily: finalConfig.fontFamily,
                fontWeight: 'bold'
              }}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}
      
      {/* Airspace Information */}
      {finalConfig.showAirspace && airspaceInfo.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            right: 50,
            opacity: dataOpacity,
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: colorScheme.background,
              border: `2px solid ${colorScheme.accent}`,
              borderRadius: '10px',
              padding: '15px',
              color: colorScheme.text,
              fontFamily: finalConfig.fontFamily
            }}
          >
            <h4 style={{ color: colorScheme.accent, margin: '0 0 10px 0' }}>
              Airspace
            </h4>
            {airspaceInfo.map((airspace, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                <span style={{ color: colorScheme.secondary }}>{airspace.type}:</span> {airspace.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default EnhancedFlightPathComponent; 