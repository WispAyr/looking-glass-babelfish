
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
    "smartDetectZone"
  ],
  "startTime": "2025-06-22T09:17:25.999Z",
  "endTime": "2025-06-22T09:22:25.999Z"
}
        }}
      />
    </>
  );
};
