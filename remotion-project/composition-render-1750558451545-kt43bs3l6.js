
import { Composition } from 'remotion';
import { FlightPathComponent } from './FlightPathComponent.jsx';

export const RemotionVideo = () => {
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
  "flightData": [
    {
      "lat": 55.5074,
      "lon": -4.5933,
      "timestamp": "2025-06-22T01:14:11.545Z"
    },
    {
      "lat": 55.5075,
      "lon": -4.5934,
      "timestamp": "2025-06-22T01:44:11.545Z"
    },
    {
      "lat": 55.5076,
      "lon": -4.5935,
      "timestamp": "2025-06-22T02:14:11.545Z"
    }
  ],
  "callsign": "TEST123",
  "registration": "G-TEST",
  "startTime": "2025-06-22T01:14:11.545Z",
  "endTime": "2025-06-22T02:14:11.545Z"
}
        }}
      />
    </>
  );
};
