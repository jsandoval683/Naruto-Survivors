export type Nature = 'fuego' | 'viento' | 'rayo' | 'tierra' | 'agua' | 'neutral';

export const NATURE_NAME: Record<Nature, string> = {
  fuego: 'Fuego',
  viento: 'Viento',
  rayo: 'Rayo',
  tierra: 'Tierra',
  agua: 'Agua',
  neutral: 'Neutral',
};

export const NATURE_COLOR: Record<Nature, string> = {
  fuego: '#ff6a3c',
  viento: '#8fe3a8',
  rayo: '#ffe14d',
  tierra: '#c49a5a',
  agua: '#4fa8ff',
  neutral: '#b8bec6',
};

/** Fuego > Viento > Rayo > Tierra > Agua > Fuego */
const BEATS: Partial<Record<Nature, Nature>> = {
  fuego: 'viento',
  viento: 'rayo',
  rayo: 'tierra',
  tierra: 'agua',
  agua: 'fuego',
};

export function affinity(attacker: Nature, defender: Nature): number {
  if (attacker === 'neutral' || defender === 'neutral') return 1;
  if (BEATS[attacker] === defender) return 1.5;
  if (BEATS[defender] === attacker) return 0.75;
  return 1;
}
