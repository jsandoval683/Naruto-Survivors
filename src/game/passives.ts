import type { StatMods } from './characters';
import type { Stats } from './types';

export type PassiveId = 'taijutsu' | 'chakra' | 'resistencia' | 'shunshin' | 'sensor' | 'energia' | 'sharingan';

export interface PassiveDef {
  id: PassiveId;
  name: string;
  desc: string;
  icon: string;
  color: string;
  max: number;
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  taijutsu: { id: 'taijutsu', name: 'Taijutsu', desc: '+12% de daño.', icon: '拳', color: '#e5534b', max: 5 },
  chakra: { id: 'chakra', name: 'Reserva de chakra', desc: '-7% de recarga de los jutsus.', icon: '気', color: '#4fb3ff', max: 5 },
  resistencia: { id: 'resistencia', name: 'Resistencia', desc: '+20 de vida máxima y +0,3 vida/s.', icon: '体', color: '#5cc96b', max: 5 },
  shunshin: { id: 'shunshin', name: 'Shunshin', desc: '+8% de velocidad de movimiento.', icon: '瞬', color: '#c9d1d9', max: 5 },
  sensor: { id: 'sensor', name: 'Sensor', desc: '+35% de radio de recogida.', icon: '感', color: '#b48cff', max: 5 },
  energia: { id: 'energia', name: 'Energía natural', desc: '+10% de área de los jutsus.', icon: '仙', color: '#f39c32', max: 5 },
  sharingan: { id: 'sharingan', name: 'Ojo Sharingan', desc: '+6% de probabilidad de crítico (×1,5 de daño).', icon: '写', color: '#e01b1b', max: 5 },
};

export const BASE_STATS: Stats = {
  dmg: 1,
  cd: 1,
  speed: 1,
  area: 1,
  maxHp: 100,
  magnet: 85,
  regen: 0,
  xp: 1,
  amount: 0,
  crit: 0.03,
  armor: 0,
};

function applyMods(s: Stats, m: StatMods): void {
  if (m.dmg) s.dmg *= m.dmg;
  if (m.cd) s.cd *= m.cd;
  if (m.speed) s.speed *= m.speed;
  if (m.area) s.area *= m.area;
  if (m.magnet) s.magnet *= m.magnet;
  if (m.maxHp) s.maxHp += m.maxHp;
  if (m.regen) s.regen += m.regen;
  if (m.crit) s.crit += m.crit;
  if (m.armor) s.armor += m.armor;
}

/** Passives + character trait + every transformation reached so far. */
export function computeStats(levels: Map<PassiveId, number>, mods: StatMods[] = []): Stats {
  const l = (id: PassiveId) => levels.get(id) ?? 0;
  const s: Stats = {
    ...BASE_STATS,
    dmg: BASE_STATS.dmg * (1 + 0.12 * l('taijutsu')),
    cd: BASE_STATS.cd * (1 - 0.07 * l('chakra')),
    maxHp: BASE_STATS.maxHp + 20 * l('resistencia'),
    regen: BASE_STATS.regen + 0.3 * l('resistencia'),
    speed: BASE_STATS.speed * (1 + 0.08 * l('shunshin')),
    magnet: BASE_STATS.magnet * (1 + 0.35 * l('sensor')),
    area: BASE_STATS.area * (1 + 0.1 * l('energia')),
    crit: BASE_STATS.crit + 0.06 * l('sharingan'),
  };
  for (const m of mods) applyMods(s, m);
  s.armor = Math.min(0.6, s.armor);
  s.maxHp = Math.round(s.maxHp);
  return s;
}
