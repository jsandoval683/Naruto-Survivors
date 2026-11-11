import type { SaveData } from '../core/save';
import type { StatMods } from '../game/characters';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  max: number;
  base: number;
}

/** Permanent upgrades, bought separately for each ninja (they only apply when playing that ninja). */
export const UPGRADES: UpgradeDef[] = [
  { id: 'vida', name: 'Vitalidad', desc: '+8 de vida', icon: '❤', max: 10, base: 60 },
  { id: 'fuerza', name: 'Fuerza', desc: '+4% de daño', icon: '拳', max: 10, base: 80 },
  { id: 'velocidad', name: 'Zancada', desc: '+3% de velocidad', icon: '瞬', max: 10, base: 70 },
  { id: 'recarga', name: 'Reflejos', desc: '-3% de recarga', icon: '気', max: 10, base: 90 },
  { id: 'coraza', name: 'Coraza', desc: '+2% de reducción de daño', icon: '盾', max: 10, base: 80 },
  { id: 'regen', name: 'Recuperación', desc: '+0,2 vida/s', icon: '癒', max: 10, base: 120 },
  { id: 'iman', name: 'Imán', desc: '+12% de radio de recogida', icon: '感', max: 10, base: 50 },
  { id: 'sabiduria', name: 'Sabiduría', desc: '+5% de experiencia', icon: '知', max: 10, base: 100 },
  { id: 'fortuna', name: 'Fortuna', desc: '+8% de ryō', icon: '両', max: 10, base: 120 },
  { id: 'critico', name: 'Golpe crítico', desc: '+2% de crítico', icon: '写', max: 10, base: 90 },
  { id: 'cambios', name: 'Cambio de cartas', desc: '+1 cambio de cartas por partida', icon: '↻', max: 3, base: 150 },
  { id: 'repertorio', name: 'Repertorio', desc: 'Empiezas con un segundo jutsu', icon: '巻', max: 1, base: 1500 },
];

export function upgradeCost(u: UpgradeDef, level: number): number {
  return Math.round(u.base * Math.pow(1.4, level));
}

export function upgradeLevel(save: SaveData, charId: string, id: string): number {
  return save.upgrades[charId]?.[id] ?? 0;
}

export function buyUpgrade(save: SaveData, charId: string, u: UpgradeDef): boolean {
  const lvl = upgradeLevel(save, charId, u.id);
  if (lvl >= u.max) return false;
  const cost = upgradeCost(u, lvl);
  if (save.ryo < cost) return false;
  save.ryo -= cost;
  (save.upgrades[charId] ??= {})[u.id] = lvl + 1;
  return true;
}

export interface RunBonuses {
  mods: StatMods;
  xpMult: number;
  ryoMult: number;
  rerolls: number;
  extraJutsu: boolean;
}

export function runBonuses(save: SaveData, charId: string): RunBonuses {
  const l = (id: string) => upgradeLevel(save, charId, id);
  return {
    mods: {
      maxHp: 8 * l('vida'),
      dmg: 1 + 0.04 * l('fuerza'),
      speed: 1 + 0.03 * l('velocidad'),
      cd: 1 - 0.03 * l('recarga'),
      armor: 0.02 * l('coraza'),
      regen: 0.2 * l('regen'),
      magnet: 1 + 0.12 * l('iman'),
      crit: 0.02 * l('critico'),
    },
    xpMult: 1 + 0.05 * l('sabiduria'),
    ryoMult: 1 + 0.08 * l('fortuna'),
    rerolls: 2 + l('cambios'),
    extraJutsu: l('repertorio') > 0,
  };
}
