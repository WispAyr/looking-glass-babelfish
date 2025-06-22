import { Composition, registerRoot } from 'remotion';
import { FlightPathComponent } from './FlightPathComponent';
import { EventTimelineComponent } from './EventTimelineComponent';

const RemotionVideo = () => {
  return (
    <>
      <Composition
        id="flight-path"
        component={FlightPathComponent}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          data: {
            flightData: [
              { lat: 55.5074, lon: -4.5933 },
              { lat: 55.5075, lon: -4.5934 },
              { lat: 55.5076, lon: -4.5935 }
            ],
            callsign: 'TEST123',
            registration: 'G-TEST',
            startTime: new Date(Date.now() - 3600000).toISOString(),
            endTime: new Date().toISOString()
          }
        }}
      />
      <Composition
        id="event-timeline"
        component={EventTimelineComponent}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          data: {
            events: [
              { type: 'motion', timestamp: new Date(Date.now() - 3500000).toISOString(), cameraId: 'cam1' },
              { type: 'smartDetectZone', timestamp: new Date(Date.now() - 3400000).toISOString(), cameraId: 'cam2', data: { smartDetectTypes: ['vehicle'] } }
            ],
            eventTypes: ['motion', 'smartDetectZone'],
            startTime: new Date(Date.now() - 3600000).toISOString(),
            endTime: new Date().toISOString()
          }
        }}
      />
    </>
  );
};

registerRoot(RemotionVideo); 