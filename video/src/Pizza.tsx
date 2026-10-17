import React, {useId} from 'react';
import {Easing, interpolate, random} from 'remotion';
import {C, CLAMP} from './theme';

/** Génère un contour organique lissé (Catmull-Rom -> Bézier). */
const blobPath = (r: number, n: number, amp: number, seed: number) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr =
      r *
      (1 +
        amp * 0.6 * Math.sin(a * 3 + seed) +
        amp * 0.4 * Math.sin(a * 7 + seed * 2.3));
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const p = (i: number) => pts[(i + n) % n];
  let d = `M${p(0)[0].toFixed(1)},${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
};

const SAUCE_PATH = blobPath(200, 48, 0.035, 1);
const CHEESE_PATH = blobPath(182, 60, 0.09, 4);

type Topping = {type: 'pep' | 'olive' | 'basil'; r: number; a: number; rot?: number};
const TOPPINGS: Topping[] = [
  {type: 'pep', r: 125, a: 15},
  {type: 'pep', r: 125, a: 195},
  {type: 'pep', r: 125, a: 105},
  {type: 'pep', r: 125, a: 285},
  {type: 'pep', r: 158, a: 60},
  {type: 'pep', r: 158, a: 240},
  {type: 'pep', r: 158, a: 150},
  {type: 'pep', r: 158, a: 330},
  {type: 'pep', r: 55, a: 60},
  {type: 'pep', r: 55, a: 240},
  {type: 'olive', r: 92, a: 155},
  {type: 'olive', r: 92, a: 335},
  {type: 'olive', r: 168, a: 15},
  {type: 'olive', r: 168, a: 195},
  {type: 'olive', r: 172, a: 105},
  {type: 'basil', r: 0, a: 0, rot: 20},
  {type: 'basil', r: 95, a: 65, rot: 50},
  {type: 'basil', r: 95, a: 245, rot: -30},
  {type: 'basil', r: 178, a: 285, rot: 75},
];

const CHAR_SPOTS = new Array(14).fill(0).map((_, i) => ({
  a: i * (360 / 14) + random(`ch${i}`) * 14,
  rx: 6 + random(`chx${i}`) * 7,
  ry: 3 + random(`chy${i}`) * 3,
}));

const polar = (r: number, deg: number): [number, number] => [
  Math.cos((deg * Math.PI) / 180) * r,
  Math.sin((deg * Math.PI) / 180) * r,
];

const inDisc = (seed: string, maxR: number): [number, number] => {
  const r = Math.sqrt(random(`${seed}r`)) * maxR;
  return polar(r, random(`${seed}a`) * 360);
};

const BUBBLES = new Array(16).fill(0).map((_, i) => ({
  p: inDisc(`bub${i}`, 165),
  r: 5 + random(`bubr${i}`) * 10,
}));
const BROWN = new Array(10).fill(0).map((_, i) => ({
  p: inDisc(`br${i}`, 165),
  r: 4 + random(`brr${i}`) * 6,
}));

export type PizzaProps = {
  size: number;
  dough?: number;
  sauce?: number;
  cheese?: number;
  toppings?: number;
  rotation?: number;
  plate?: number;
  /** Distance (unités viewBox) de la part extraite. undefined = pizza entière. */
  sliceOut?: number;
  sliceRotation?: number;
};

export const Pizza: React.FC<PizzaProps> = ({
  size,
  dough = 1,
  sauce = 1,
  cheese = 1,
  toppings = 1,
  rotation = 0,
  plate = 0,
  sliceOut,
  sliceRotation = 0,
}) => {
  const id = useId().replace(/:/g, '');
  const N = TOPPINGS.length;

  const layers = (
    <g>
      {/* Pâte */}
      <g transform={`scale(${dough})`}>
        <circle r={236} fill={`url(#${id}crust)`} />
        <circle r={212} fill="#EDBF77" />
        {CHAR_SPOTS.map((s, i) => {
          const [x, y] = polar(224, s.a);
          return (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx={s.rx}
              ry={s.ry}
              fill="#7A4A1F"
              opacity={0.35}
              transform={`rotate(${s.a + 90} ${x} ${y})`}
            />
          );
        })}
      </g>
      {/* Sauce */}
      {sauce > 0 && (
        <g transform={`rotate(${(1 - sauce) * -120}) scale(${sauce})`}>
          <path d={SAUCE_PATH} fill={`url(#${id}sauce)`} />
        </g>
      )}
      {/* Fromage */}
      {cheese > 0 && (
        <g transform={`scale(${cheese})`}>
          <path d={CHEESE_PATH} fill={`url(#${id}cheese)`} />
          {BROWN.map((b, i) => (
            <circle key={`b${i}`} cx={b.p[0]} cy={b.p[1]} r={b.r} fill="#D08A2E" opacity={0.45} />
          ))}
          {BUBBLES.map((b, i) => (
            <circle key={`u${i}`} cx={b.p[0]} cy={b.p[1]} r={b.r} fill="#FFF6D5" opacity={0.55} />
          ))}
        </g>
      )}
      {/* Garnitures */}
      {TOPPINGS.map((t, i) => {
        const start = (i / N) * 0.72;
        const local = interpolate(toppings, [start, start + 0.28], [0, 1], CLAMP);
        if (local <= 0) return null;
        const s = interpolate(local, [0, 1], [2.6, 1], {
          ...CLAMP,
          easing: Easing.out(Easing.back(2.2)),
        });
        const o = interpolate(local, [0, 0.3], [0, 1], CLAMP);
        const [x, y] = polar(t.r, t.a);
        return (
          <g
            key={i}
            opacity={o}
            transform={`translate(${x} ${y}) rotate(${t.rot ?? 0}) scale(${s})`}
          >
            {t.type === 'pep' && (
              <>
                <circle r={27} fill={`url(#${id}pep)`} />
                <circle r={26} fill="none" stroke="#6E1A12" strokeWidth={2} />
                {[[-9, 6], [8, 9], [4, -10], [-6, -4], [12, -2]].map(([dx, dy], k) => (
                  <circle key={k} cx={dx} cy={dy} r={2.6} fill="#5C140E" opacity={0.55} />
                ))}
                <ellipse cx={-8} cy={-10} rx={9} ry={4} fill="white" opacity={0.18} />
              </>
            )}
            {t.type === 'olive' && (
              <>
                <circle r={9} fill="none" stroke="#151515" strokeWidth={7} />
                <circle r={11} fill="none" stroke="#3A3A3A" strokeWidth={1.4} transform="translate(-1 -1)" />
              </>
            )}
            {t.type === 'basil' && (
              <g transform="scale(1.25)">
                <path d="M0,-22 C15,-12 15,12 0,22 C-15,12 -15,-12 0,-22 Z" fill="#2E7D32" />
                <path d="M0,-20 L0,20" stroke="#66BB6A" strokeWidth={1.5} />
                <path d="M0,-6 L7,-12 M0,4 L-7,-2 M0,10 L6,6" stroke="#66BB6A" strokeWidth={1} />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );

  // Part extraite (pointe vers le haut)
  const a1 = -112.5;
  const a2 = -67.5;
  const R = 300;
  const [w1x, w1y] = polar(R, a1);
  const [w2x, w2y] = polar(R, a2);
  const out = sliceOut ?? 0;

  const strings: React.ReactNode[] = [];
  if (sliceOut !== undefined && out > 0) {
    const sources: [number, number][] = [
      [0, 0], [0, 0],
      ...[50, 95, 140, 175].flatMap((r) => [polar(r, a1), polar(r, a2)]),
    ];
    sources.forEach(([px, py], i) => {
      const qx = px;
      const qy = py - out;
      const breakAt = 120 + random(`str${i}`) * 110;
      const op = interpolate(out, [breakAt - 40, breakAt], [1, 0], CLAMP);
      if (op <= 0) return;
      const sag = (random(`sag${i}`) - 0.5) * out * 0.25 + (px === 0 ? (i ? 8 : -8) : 0);
      const w = interpolate(out, [0, breakAt], [7, 1.4], CLAMP);
      strings.push(
        <path
          key={i}
          d={`M${px},${py} Q${px + sag},${py - out / 2} ${qx},${qy}`}
          stroke="#FBE3A0"
          strokeWidth={w}
          strokeLinecap="round"
          fill="none"
          opacity={op}
        />,
      );
    });
  }

  return (
    <svg
      viewBox="-260 -260 520 520"
      width={size}
      height={size}
      style={{overflow: 'visible'}}
    >
      <defs>
        <radialGradient id={`${id}crust`}>
          <stop offset="0.8" stopColor="#F3C77E" />
          <stop offset="0.93" stopColor="#D9994A" />
          <stop offset="1" stopColor="#A5652A" />
        </radialGradient>
        <radialGradient id={`${id}sauce`}>
          <stop offset="0" stopColor="#D63C22" />
          <stop offset="1" stopColor="#9C1E13" />
        </radialGradient>
        <radialGradient id={`${id}cheese`}>
          <stop offset="0" stopColor="#FFF1BE" />
          <stop offset="0.6" stopColor="#F9D877" />
          <stop offset="1" stopColor="#EDB94C" />
        </radialGradient>
        <radialGradient id={`${id}pep`} cx="0.4" cy="0.4">
          <stop offset="0" stopColor="#C8402F" />
          <stop offset="1" stopColor="#7B1E14" />
        </radialGradient>
        <radialGradient id={`${id}plate`}>
          <stop offset="0.85" stopColor="#1A1A1A" />
          <stop offset="1" stopColor="#0B0B0B" />
        </radialGradient>
        <clipPath id={`${id}wedge`}>
          <path d={`M0,0 L${w1x},${w1y} A${R},${R} 0 0 1 ${w2x},${w2y} Z`} />
        </clipPath>
        <clipPath id={`${id}rest`}>
          <path d={`M0,0 L${w2x},${w2y} A${R},${R} 0 1 1 ${w1x},${w1y} Z`} />
        </clipPath>
        <filter id={`${id}shadow`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="14" stdDeviation="10" floodOpacity="0.55" />
        </filter>
      </defs>

      {plate > 0 && (
        <g transform={`scale(${plate})`}>
          <circle r={258} fill={`url(#${id}plate)`} />
          <circle r={252} fill="none" stroke={C.gold} strokeWidth={2.5} />
          <circle r={244} fill="none" stroke={C.gold} strokeWidth={0.8} opacity={0.6} />
        </g>
      )}

      <g transform={`rotate(${rotation})`}>
        {sliceOut === undefined ? (
          layers
        ) : (
          <>
            <g clipPath={`url(#${id}rest)`}>{layers}</g>
            {strings}
            <g
              transform={`translate(0 ${-out}) rotate(${sliceRotation})`}
              filter={out > 0 ? `url(#${id}shadow)` : undefined}
            >
              <g clipPath={`url(#${id}wedge)`}>{layers}</g>
            </g>
          </>
        )}
      </g>
    </svg>
  );
};
