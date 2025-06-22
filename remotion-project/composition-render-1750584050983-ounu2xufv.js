
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
    "motion"
  ],
  "startTime": "2025-06-22T09:15:50.983Z",
  "endTime": "2025-06-22T09:20:50.983Z"
}
        }}
      />
    </>
  );
};
