
import { Composition } from 'remotion';
import { EventTimelineComponent } from './EventTimelineComponent.jsx';

export const RemotionVideo = () => {
  return (
    <>
      <Composition
        id="event-timeline"
        component={EventTimelineComponent}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          data: {
  "events": [],
  "eventTypes": [
    "motion",
    "smartDetectZone"
  ],
  "startTime": "2025-06-22T01:14:16.548Z",
  "endTime": "2025-06-22T02:14:16.548Z"
}
        }}
      />
    </>
  );
};
