import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {TEXTS} from './config';
import {
  Background,
  BrandFooter,
  Burst,
  FadeUp,
  GoldDivider,
  LetterReveal,
  Logo,
  MeanderBand,
  Steam,
} from './components';
import {Pizza} from './Pizza';
import {C, CLAMP, GOLD_GRADIENT, SANS, SERIF, goldText} from './theme';

const centered = (top: number): React.CSSProperties => ({
  position: 'absolute',
  top,
  left: 0,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
});

/* ================================================================== */
/* 1. INTRO — médaillon + « NOS PIZZAS »                               */
/* ================================================================== */
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const band = interpolate(frame, [0, 35], [0, 1], {
    ...CLAMP,
    easing: Easing.inOut(Easing.cubic),
  });
  const logoS = spring({frame: frame - 6, fps, config: {damping: 12, mass: 0.9}});
  const shine = interpolate(frame, [40, 72], [0, 1], CLAMP);
  const divider = interpolate(frame, [62, 85], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <Background />
      <MeanderBand y={70} progress={band} />
      <MeanderBand y={height - 126} progress={band} reverse />

      <div style={{...centered(330), height: 600, justifyContent: 'center'}}>
        {[0, 1, 2].map((i) => {
          const p = interpolate(frame, [14 + i * 9, 64 + i * 9], [0, 1], CLAMP);
          if (p <= 0 || p >= 1) return null;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 560,
                height: 560,
                borderRadius: '50%',
                border: `3px solid ${C.gold}`,
                transform: `scale(${1 + p})`,
                opacity: (1 - p) * 0.6,
              }}
            />
          );
        })}
        <div
          style={{
            transform: `scale(${logoS}) rotate(${interpolate(logoS, [0, 1], [-140, 0])}deg)`,
          }}
        >
          <Logo size={560} shine={shine} />
        </div>
      </div>

      <div style={centered(1080)}>
        <LetterReveal
          text={TEXTS.introKicker.toUpperCase()}
          delay={36}
          stagger={1}
          style={{
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: 34,
            letterSpacing: '0.35em',
            color: C.cream,
          }}
        />
        <LetterReveal
          text={TEXTS.introTitle}
          delay={46}
          stagger={3}
          gradient
          style={{fontFamily: SERIF, fontWeight: 900, fontSize: 136, marginTop: 10}}
        />
        <div style={{marginTop: 20}}>
          <GoldDivider progress={divider} width={520} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* 2. CONSTRUCTION — la pizza se compose couche par couche             */
/* ================================================================== */
export const STEP_WINDOWS: [number, number][] = [
  [0, 45],
  [45, 90],
  [90, 132],
  [132, 180],
];
const PIZZA_SIZE = 860;
const PIZZA_CY = 1060;

export const Build: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const plate = spring({frame, fps, config: {damping: 15}});
  const dough = spring({frame: frame - 6, fps, config: {damping: 10, stiffness: 90}});
  const sauce = interpolate(frame, [48, 82], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const cheese = interpolate(frame, [100, 124], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.back(1.5)),
  });
  const toppings = interpolate(frame, [134, 174], [0, 1], CLAMP);
  const rot = frame * 0.4;
  const k = PIZZA_SIZE / 520;

  return (
    <AbsoluteFill>
      <Background glow={0.7} />

      {/* Légendes successives */}
      {STEP_WINDOWS.map(([s, e], i) => {
        const last = i === STEP_WINDOWS.length - 1;
        const exit = last ? 1 : interpolate(frame, [e - 8, e], [1, 0], CLAMP);
        const lift = last ? 0 : interpolate(frame, [e - 8, e], [0, -40], CLAMP);
        return (
          <Sequence key={i} from={s} durationInFrames={last ? Infinity : e - s + 1} layout="none">
            <div style={{...centered(210), opacity: exit, transform: `translateY(${lift}px)`}}>
              <FadeUp delay={0} distance={20}>
                <span
                  style={{
                    fontFamily: SANS,
                    fontWeight: 800,
                    fontSize: 30,
                    letterSpacing: '0.3em',
                    color: C.gold,
                  }}
                >
                  {String(i + 1).padStart(2, '0')} / {String(STEP_WINDOWS.length).padStart(2, '0')}
                </span>
              </FadeUp>
              <LetterReveal
                text={TEXTS.steps[i]}
                delay={3}
                stagger={1}
                style={{
                  fontFamily: SERIF,
                  fontWeight: 700,
                  fontSize: 92,
                  color: C.cream,
                  marginTop: 14,
                  maxWidth: 940,
                }}
              />
            </div>
          </Sequence>
        );
      })}

      {/* Pizza */}
      <div
        style={{
          position: 'absolute',
          left: 540,
          top: PIZZA_CY,
          width: 0,
          height: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -PIZZA_SIZE / 2,
            top: -PIZZA_SIZE / 2,
            filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.65))',
          }}
        >
          <Pizza
            size={PIZZA_SIZE}
            plate={plate}
            dough={dough}
            sauce={sauce}
            cheese={cheese}
            toppings={toppings}
            rotation={rot}
          />
        </div>

        {/* Farine au moment où la pâte arrive */}
        <Burst start={8} duration={45} count={50} color="#FFF8EA" radius={560} seed="flour" />

        {/* Fromage râpé qui tombe */}
        {new Array(34).fill(0).map((_, i) => {
          const st = 88 + random(`cs${i}`) * 16;
          const t = interpolate(frame, [st, st + 12], [0, 1], {
            ...CLAMP,
            easing: Easing.in(Easing.quad),
          });
          const fade = interpolate(frame, [st + 12, st + 26], [1, 0], CLAMP);
          if (t <= 0 || fade <= 0) return null;
          const a = random(`ca${i}`) * Math.PI * 2;
          const r = Math.sqrt(random(`cr${i}`)) * 170 * k;
          const tx = Math.cos(a) * r;
          const ty = Math.sin(a) * r;
          const y = interpolate(t, [0, 1], [ty - 900, ty]);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: tx - 5,
                top: y - 20,
                width: 10,
                height: 40,
                borderRadius: 6,
                background: '#F9D877',
                transform: `rotate(${random(`cro${i}`) * 180}deg)`,
                opacity: fade,
                boxShadow: '0 4px 6px rgba(0,0,0,0.25)',
              }}
            />
          );
        })}

        {/* Gouttes de sauce */}
        {new Array(10).fill(0).map((_, i) => {
          const st = 44 + i * 1.5;
          const t = interpolate(frame, [st, st + 10], [0, 1], {
            ...CLAMP,
            easing: Easing.in(Easing.quad),
          });
          if (t <= 0 || t >= 1) return null;
          const a = random(`sd${i}`) * Math.PI * 2;
          const r = random(`sr${i}`) * 120 * k;
          const tx = Math.cos(a) * r;
          const ty = Math.sin(a) * r;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: tx - 14,
                top: interpolate(t, [0, 1], [ty - 800, ty]) - 20,
                width: 28,
                height: 40,
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                background: '#C3301C',
              }}
            />
          );
        })}
      </div>

      <BrandFooter label={TEXTS.brand} />
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* 3. HÉROS — la pizza finie, rayons dorés, vapeur                     */
/* ================================================================== */
export const Hero: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 150], [1, 1.12], {
    ...CLAMP,
    easing: Easing.inOut(Easing.sin),
  });
  const glow = 0.55 + 0.15 * Math.sin(frame / 8);
  const rays = interpolate(frame, [0, 20], [0, 1], CLAMP);

  return (
    <AbsoluteFill>
      <Background />
      {/* Rayons tournants */}
      <AbsoluteFill style={{opacity: rays * 0.35}}>
        <div
          style={{
            position: 'absolute',
            left: 540 - 1100,
            top: PIZZA_CY - 1100,
            width: 2200,
            height: 2200,
            borderRadius: '50%',
            background: `repeating-conic-gradient(from ${frame * 0.5}deg, rgba(212,175,55,0.5) 0deg 6deg, transparent 6deg 20deg)`,
            maskImage: 'radial-gradient(circle, black 20%, transparent 65%)',
            WebkitMaskImage: 'radial-gradient(circle, black 20%, transparent 65%)',
          }}
        />
      </AbsoluteFill>
      {/* Halo */}
      <div
        style={{
          position: 'absolute',
          left: 540 - 600,
          top: PIZZA_CY - 600,
          width: 1200,
          height: 1200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(234,205,109,0.55) 0%, transparent 65%)',
          opacity: glow,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 540 - PIZZA_SIZE / 2,
          top: PIZZA_CY - PIZZA_SIZE / 2,
          transform: `scale(${scale})`,
          filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.65))',
        }}
      >
        <Pizza size={PIZZA_SIZE} plate={1} rotation={66 + frame * 0.4} />
      </div>

      <div style={{position: 'absolute', left: 140, top: PIZZA_CY - 520}}>
        <Steam width={800} height={620} />
      </div>

      <div style={centered(200)}>
        <LetterReveal
          text={TEXTS.heroTitle}
          delay={6}
          stagger={2}
          gradient
          style={{fontFamily: SERIF, fontWeight: 900, fontSize: 104, maxWidth: 960}}
        />
      </div>

      <div
        style={{
          ...centered(1640),
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 22,
        }}
      >
        {TEXTS.badges.map((b, i) => (
          <FadeUp key={b} delay={36 + i * 9}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '18px 30px',
                borderRadius: 999,
                border: `2px solid ${C.gold}`,
                background: 'rgba(10,10,10,0.75)',
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: 30,
                color: C.cream,
              }}
            >
              <div style={{width: 10, height: 10, background: C.gold, transform: 'rotate(45deg)'}} />
              {b}
            </div>
          </FadeUp>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* 4. LA PART — fromage qui file                                       */
/* ================================================================== */
export const Slice: React.FC = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [10, 62], [0, 235], {
    ...CLAMP,
    easing: Easing.inOut(Easing.cubic),
  });
  const tilt = interpolate(frame, [10, 62], [0, -5], CLAMP);
  const zoom = interpolate(frame, [0, 100], [1.0, 1.08], CLAMP);
  const divider = interpolate(frame, [45, 70], [0, 1], {...CLAMP, easing: Easing.out(Easing.cubic)});
  const size = 900;
  const cy = 1120;

  return (
    <AbsoluteFill>
      <Background glow={0.8} />
      <div
        style={{
          position: 'absolute',
          left: 540 - size / 2,
          top: cy - size / 2,
          transform: `scale(${zoom})`,
          filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.65))',
        }}
      >
        <Pizza size={size} plate={1} sliceOut={out} sliceRotation={tilt} />
      </div>
      <div style={{position: 'absolute', left: 240, top: 150}}>
        <Steam width={600} height={500} count={5} opacity={interpolate(frame, [40, 70], [0, 1], CLAMP)} />
      </div>

      <div
        style={{
          ...centered(1560),
          paddingTop: 30,
          paddingBottom: 40,
          background: 'linear-gradient(180deg, transparent, rgba(5,5,5,0.85) 30%)',
        }}
      >
        <LetterReveal
          text={TEXTS.sliceTitle}
          delay={28}
          stagger={2}
          gradient
          style={{fontFamily: SERIF, fontWeight: 900, fontSize: 100}}
        />
        <div style={{margin: '16px 0'}}>
          <GoldDivider progress={divider} />
        </div>
        <FadeUp delay={50}>
          <span style={{fontFamily: SANS, fontSize: 36, color: C.cream, letterSpacing: '0.04em'}}>
            {TEXTS.sliceSub}
          </span>
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== */
/* 5. OUTRO — appel à l'action                                         */
/* ================================================================== */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const band = interpolate(frame, [0, 30], [0, 1], {...CLAMP, easing: Easing.inOut(Easing.cubic)});
  const logoS = spring({frame: frame - 4, fps, config: {damping: 13}});
  const cta = spring({frame: frame - 42, fps, config: {damping: 10, stiffness: 120}});
  const pulse = frame > 60 ? 1 + 0.03 * Math.sin((frame - 60) / 5) : 1;
  const shine = interpolate((frame - 55) % 45, [0, 30], [0, 1], CLAMP);
  const rise = spring({frame: frame - 10, fps, config: {damping: 18}});

  return (
    <AbsoluteFill>
      <Background />
      <MeanderBand y={60} progress={band} />

      <div style={{...centered(200)}}>
        <div style={{transform: `scale(${logoS})`}}>
          <Logo size={420} shine={interpolate(frame, [20, 50], [0, 1], CLAMP)} />
        </div>
      </div>

      <div style={centered(700)}>
        <LetterReveal
          text={TEXTS.outroTitle}
          delay={16}
          stagger={1.5}
          style={{fontFamily: SERIF, fontWeight: 700, fontSize: 96, color: C.cream, maxWidth: 940}}
        />
      </div>

      <div style={centered(1000)}>
        <div
          style={{
            transform: `scale(${cta * pulse})`,
            position: 'relative',
            overflow: 'hidden',
            padding: '34px 70px',
            borderRadius: 999,
            background: GOLD_GRADIENT,
            boxShadow: '0 20px 50px rgba(212,175,55,0.35)',
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 42,
            letterSpacing: '0.12em',
            color: C.bg,
            textTransform: 'uppercase',
          }}
        >
          {TEXTS.cta}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.65) 50%, transparent 65%)',
              transform: `translateX(${interpolate(shine, [0, 1], [-120, 120])}%)`,
            }}
          />
        </div>
        <FadeUp delay={58} style={{marginTop: 40}}>
          <span style={{fontFamily: SANS, fontSize: 32, color: C.gold, letterSpacing: '0.06em'}}>
            {TEXTS.outroSub}
          </span>
        </FadeUp>
      </div>

      {/* Pizza qui monte depuis le bas */}
      <div
        style={{
          position: 'absolute',
          left: 540 - 520,
          top: 1440 + (1 - rise) * 600,
          filter: 'drop-shadow(0 -20px 50px rgba(0,0,0,0.7))',
        }}
      >
        <Pizza size={1040} plate={1} rotation={frame * 0.35} />
      </div>
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, transparent 88%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
