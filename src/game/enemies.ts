import type { EnemyKind } from './types';

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  dmg: number;
  r: number;
  xp: number;
  /** Knockback multiplier (lower = heavier). */
  kbRes: number;
  /** Chance to drop a ryō coin. */
  ryoChance: number;
  /** Keeps its distance and shoots at the player. */
  ranged?: { range: number; cd: number; dmg: number; speed: number; color: string };
}

export type MinionKind = Exclude<EnemyKind, 'boss'>;

export const ENEMIES: Record<MinionKind, EnemyDef> = {
  grunt: { name: 'Ninja renegado', hp: 10, speed: 62, dmg: 7, r: 11, xp: 1, kbRes: 1, ryoChance: 0.04 },
  puppet: { name: 'Marioneta', hp: 7, speed: 104, dmg: 5, r: 9, xp: 1, kbRes: 1.3, ryoChance: 0.03 },
  brute: { name: 'Ninja pesado', hp: 55, speed: 46, dmg: 14, r: 17, xp: 5, kbRes: 0.3, ryoChance: 0.25 },
  crow: { name: 'Cuervo', hp: 5, speed: 150, dmg: 4, r: 7, xp: 1, kbRes: 1.5, ryoChance: 0.02 },
  zetsu: { name: 'Zetsu blanco', hp: 18, speed: 58, dmg: 9, r: 12, xp: 2, kbRes: 0.8, ryoChance: 0.05 },
  snake: { name: 'Serpiente', hp: 6, speed: 125, dmg: 5, r: 8, xp: 1, kbRes: 1.3, ryoChance: 0.02 },
  sound: { name: 'Ninja del Sonido', hp: 14, speed: 62, dmg: 6, r: 11, xp: 2, kbRes: 1, ryoChance: 0.05, ranged: { range: 190, cd: 2.8, dmg: 6, speed: 170, color: '#c9a0e0' } },
  shark: { name: 'Ninja de la Niebla', hp: 32, speed: 68, dmg: 11, r: 13, xp: 3, kbRes: 0.6, ryoChance: 0.08 },
};
