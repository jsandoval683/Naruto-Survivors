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
}

export type MinionKind = Exclude<EnemyKind, 'boss'>;

export const ENEMIES: Record<MinionKind, EnemyDef> = {
  grunt: { name: 'Ninja renegado', hp: 10, speed: 62, dmg: 7, r: 11, xp: 1, kbRes: 1, ryoChance: 0.04 },
  puppet: { name: 'Marioneta', hp: 7, speed: 104, dmg: 5, r: 9, xp: 1, kbRes: 1.3, ryoChance: 0.03 },
  brute: { name: 'Ninja pesado', hp: 55, speed: 46, dmg: 14, r: 17, xp: 5, kbRes: 0.3, ryoChance: 0.25 },
  crow: { name: 'Cuervo', hp: 5, speed: 150, dmg: 4, r: 7, xp: 1, kbRes: 1.5, ryoChance: 0.02 },
  zetsu: { name: 'Zetsu blanco', hp: 18, speed: 58, dmg: 9, r: 12, xp: 2, kbRes: 0.8, ryoChance: 0.05 },
};
