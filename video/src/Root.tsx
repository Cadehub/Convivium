import React from 'react';
import {Composition} from 'remotion';
import {ConviviumPizza, TOTAL_FRAMES} from './Video';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="ConviviumPizza"
    component={ConviviumPizza}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1080}
    height={1920}
  />
);
