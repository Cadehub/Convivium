import React, {useId} from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {C, CLAMP, SANS, SERIF, goldText} from './theme';

/* ------------------------------------------------------------------ */
/* Fond : dégradé onyx + bokeh doré flottant                            */
/* ------------------------------------------------------------------ */
export const Background: React.FC<{glow?: number}> = ({glow = 1}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const span = height + 300;
  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(circle at 50% 50%, #221a10 0%, #0e0c09 45%, #050505 100%)',
      }}
    >
      {new Array(20).fill(0).map((_, i) => {
        const x = random(`bx${i}`) * width;
        const y0 = random(`by${i}`) * span;
        const s = 20 + random(`bs${i}`) * 90;
        const speed = 0.4 + random(`bv${i}`) * 1.1;
        const y = (((y0 - frame * speed) % span) + span) % span - 150;
        const o = (0.06 + random(`bo${i}`) * 0.14) * glow;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              transform: `translate(${x}px, ${y}px)`,
              width: s,
              height: s,
              borderRadius: '50%',
              background: C.gold,
              opacity: o,
              filter: `blur(${s / 3.5}px)`,
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.75) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Bande à méandres grecs (reprise du médaillon)                        */
/* ------------------------------------------------------------------ */
export const MeanderBand: React.FC<{
  y: number;
  progress: number;
  reverse?: boolean;
}> = ({y, progress, reverse}) => {
  const {width} = useVideoConfig();
  const id = useId().replace(/:/g, '');
  const h = 56;
  return (
    <svg
      width={width}
      height={h}
      style={{position: 'absolute', top: y, left: 0}}
    >
      <defs>
        <pattern
          id={`m${id}`}
          x={0}
          y={8}
          width={40}
          height={40}
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 38 H40 M4 38 V4 H36 V34 H12 V12 H28 V26 H20 V20"
            stroke={C.gold}
            strokeWidth={3}
            fill="none"
            strokeLinecap="square"
          />
        </pattern>
        <clipPath id={`c${id}`}>
          <rect
            x={reverse ? width * (1 - progress) : 0}
            y={0}
            width={width * progress}
            height={h}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <line x1={0} y1={2} x2={width} y2={2} stroke={C.gold} strokeWidth={3} />
        <rect x={0} y={8} width={width} height={40} fill={`url(#m${id})`} />
        <line
          x1={0}
          y1={h - 2}
          x2={width}
          y2={h - 2}
          stroke={C.gold}
          strokeWidth={3}
        />
      </g>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Médaillon officiel                                                   */
/* ------------------------------------------------------------------ */
export const Logo: React.FC<{size: number; shine?: number}> = ({
  size,
  shine,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: `0 0 ${size * 0.18}px rgba(212,175,55,0.35)`,
    }}
  >
    <Img
      src={staticFile('logo.jpg')}
      style={{
        position: 'absolute',
        width: '106%',
        height: '106%',
        left: '-3%',
        top: '-3%',
      }}
    />
    {shine !== undefined && (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(115deg, transparent 38%, rgba(255,240,200,0.6) 50%, transparent 62%)',
          transform: `translateX(${interpolate(shine, [0, 1], [-130, 130])}%)`,
        }}
      />
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* Texte révélé lettre par lettre                                       */
/* ------------------------------------------------------------------ */
export const LetterReveal: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  gradient?: boolean;
  style?: React.CSSProperties;
}> = ({text, delay = 0, stagger = 2, gradient, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  let idx = 0;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: '0.28em',
        lineHeight: 1.15,
        ...style,
      }}
    >
      {text.split(' ').map((word, w) => (
        <span
          key={w}
          style={{
            display: 'inline-flex',
            overflow: 'hidden',
            paddingBottom: '0.12em',
          }}
        >
          {word.split('').map((ch) => {
            const i = idx++;
            const s = spring({
              frame: frame - delay - i * stagger,
              fps,
              config: {damping: 14, stiffness: 120},
            });
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  transform: `translateY(${(1 - s) * 115}%)`,
                  opacity: s,
                  ...(gradient ? goldText : {}),
                }}
              >
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Apparition en fondu + glissement                                     */
/* ------------------------------------------------------------------ */
export const FadeUp: React.FC<{
  delay?: number;
  distance?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({delay = 0, distance = 40, style, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 16}});
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${(1 - s) * distance}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Ligne dorée qui se déploie avec losange central                      */
/* ------------------------------------------------------------------ */
export const GoldDivider: React.FC<{progress: number; width?: number}> = ({
  progress,
  width = 420,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
    }}
  >
    <div
      style={{
        height: 2,
        width: (width / 2) * progress,
        background: `linear-gradient(90deg, transparent, ${C.gold})`,
      }}
    />
    <div
      style={{
        width: 14,
        height: 14,
        background: C.gold,
        transform: `rotate(45deg) scale(${progress})`,
      }}
    />
    <div
      style={{
        height: 2,
        width: (width / 2) * progress,
        background: `linear-gradient(90deg, ${C.gold}, transparent)`,
      }}
    />
  </div>
);

/* ------------------------------------------------------------------ */
/* Signature de marque en bas d'écran                                   */
/* ------------------------------------------------------------------ */
export const BrandFooter: React.FC<{label: string}> = ({label}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [5, 25], [0, 1], CLAMP);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 90,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 22,
        opacity: o,
      }}
    >
      <Logo size={86} />
      <div style={{display: 'flex', flexDirection: 'column'}}>
        <span
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 38,
            letterSpacing: '0.12em',
            ...goldText,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: SANS,
            fontSize: 20,
            letterSpacing: '0.5em',
            color: C.gold,
          }}
        >
          ★★★
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Vapeur qui s'élève                                                   */
/* ------------------------------------------------------------------ */
export const Steam: React.FC<{
  width: number;
  height: number;
  count?: number;
  opacity?: number;
}> = ({width, height, count = 7, opacity = 1}) => {
  const frame = useCurrentFrame();
  const cycle = 80;
  return (
    <svg
      width={width}
      height={height}
      style={{overflow: 'visible', filter: 'blur(7px)', opacity}}
    >
      {new Array(count).fill(0).map((_, i) => {
        const t = ((frame + i * (cycle / count)) % cycle) / cycle;
        const x0 = width * (0.15 + 0.7 * random(`sx${i}`));
        const pts: string[] = [];
        for (let k = 0; k <= 24; k++) {
          const yy = height - (k / 24) * height * 0.65 - t * height * 0.35;
          const xx =
            x0 + Math.sin(k * 0.45 + frame * 0.07 + i * 1.7) * 22 * (k / 24 + 0.3);
          pts.push(`${k === 0 ? 'M' : 'L'}${xx.toFixed(1)},${yy.toFixed(1)}`);
        }
        return (
          <path
            key={i}
            d={pts.join(' ')}
            stroke="white"
            strokeWidth={12}
            fill="none"
            strokeLinecap="round"
            opacity={Math.sin(t * Math.PI) * 0.3}
          />
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Explosion de particules (farine, étincelles…)                       */
/* ------------------------------------------------------------------ */
export const Burst: React.FC<{
  start: number;
  duration?: number;
  count?: number;
  color: string;
  radius: number;
  seed: string;
}> = ({start, duration = 40, count = 40, color, radius, seed}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [start, start + duration], [0, 1], CLAMP);
  if (t <= 0 || t >= 1) return null;
  const ease = 1 - Math.pow(1 - t, 3);
  return (
    <>
      {new Array(count).fill(0).map((_, i) => {
        const a = random(`${seed}a${i}`) * Math.PI * 2;
        const d = radius * (0.55 + random(`${seed}d${i}`) * 0.6) * ease;
        const s = 4 + random(`${seed}s${i}`) * 9;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: Math.cos(a) * d - s / 2,
              top: Math.sin(a) * d - s / 2,
              width: s,
              height: s,
              borderRadius: '50%',
              background: color,
              opacity: (1 - t) * 0.9,
            }}
          />
        );
      })}
    </>
  );
};
