
import { Composition } from 'remotion';
import { TestComponent } from './TestComponent.jsx';

export const RemotionVideo = () => {
  return (
    <>
      <Composition
        id="test-template"
        component={TestComponent}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          data: {
  "test": "data"
}
        }}
      />
    </>
  );
};
