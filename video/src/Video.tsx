import React from 'react';
import {AbsoluteFill} from 'remotion';
import {TransitionSeries, linearTiming, springTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {Build, Hero, Intro, Outro, Slice} from './Scenes';

const SCENES = {intro: 90, build: 180, hero: 150, slice: 100, outro: 140};
const T = 15;
export const TOTAL_FRAMES =
  Object.values(SCENES).reduce((a, b) => a + b, 0) - 4 * T;

export const ConviviumPizza: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#050505'}}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENES.intro}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: T})} />
      <TransitionSeries.Sequence durationInFrames={SCENES.build}>
        <Build />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: T})} />
      <TransitionSeries.Sequence durationInFrames={SCENES.hero}>
        <Hero />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: T})} />
      <TransitionSeries.Sequence durationInFrames={SCENES.slice}>
        <Slice />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({direction: 'from-bottom'})}
        timing={springTiming({config: {damping: 200}, durationInFrames: T})}
      />
      <TransitionSeries.Sequence durationInFrames={SCENES.outro}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
