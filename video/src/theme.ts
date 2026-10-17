import React from 'react';
import {staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';

export const SERIF = 'Playfair Display';
export const SANS = 'Plus Jakarta Sans';

// Polices embarquées localement (public/fonts) : le rendu fonctionne hors-ligne.
[400, 700, 900].forEach((w) =>
  loadFont({
    family: SERIF,
    url: staticFile(`fonts/playfair-display-latin-${w}-normal.woff2`),
    weight: String(w),
  }),
);
[400, 600, 800].forEach((w) =>
  loadFont({
    family: SANS,
    url: staticFile(`fonts/plus-jakarta-sans-latin-${w}-normal.woff2`),
    weight: String(w),
  }),
);

/** Palette officielle : Noir Onyx & Or Impérial. */
export const C = {
  bg: '#0A0A0A',
  bg2: '#121212',
  gold: '#D4AF37',
  goldBright: '#EACD6D',
  goldDeep: '#A8862A',
  cream: '#F5EBD7',
};

export const GOLD_GRADIENT =
  'linear-gradient(180deg, #F8E58C 0%, #EACD6D 35%, #D4AF37 62%, #A8862A 100%)';

export const goldText: React.CSSProperties = {
  backgroundImage: GOLD_GRADIENT,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

export const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;
