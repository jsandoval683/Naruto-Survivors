import type { Game } from './game';
import type { Nature } from './natures';

export type EnemyKind = 'grunt' | 'puppet' | 'brute' | 'crow' | 'zetsu' | 'boss';

export interface BossBrain {
  update(g: Game, e: Enemy, dt: number): void;
}

export interface BossInfo {
  id: string;
  name: string;
  lookId: string;
  brain: BossBrain;
  /** Kakuzu-style segmented HP: one nature per heart. */
  hearts?: Nature[];
  final?: boolean;
}

export interface Enemy {
  kind: EnemyKind;
  nature: Nature;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  dmg: number;
  xp: number;
  kbRes: number;
  /** Incoming damage multiplier (temporary armor, etc.). */
  dmgTaken: number;
  flash: number;
  kbx: number;
  kby: number;
  dead: boolean;
  /** Overrides chasing when set (bosses use it for dashes/kiting). */
  vx?: number;
  vy?: number;
  boss: BossInfo | null;
}

export interface Projectile {
  kind: 'kunai' | 'rasengan' | 'fireball';
  src: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  pierce: number;
  life: number;
  /** Seconds before the same enemy can be hit again (Infinity = once). */
  rehit: number;
  knock: number;
  hits: Map<Enemy, number>;
  dead: boolean;
  angle: number;
  big?: boolean;
  onEnd?: (p: Projectile) => void;
}

/** Enemy attacks: bullets that hit the player, and telegraphed ground zones. */
export interface Hazard {
  kind: 'bullet' | 'zone';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  color: string;
  dead: boolean;
  /** bullet: turn rate toward the player (rad/s). */
  homing?: number;
  /** bullet: explode into a zone of this radius when it ends. */
  burst?: number;
  /** zone: seconds until it detonates, and the full delay (for the fill animation). */
  delay?: number;
  maxDelay?: number;
  /** zone: keeps burning this long after detonating. */
  linger?: number;
  /** zone: push the player away from the center when it detonates. */
  push?: number;
}

/** Player-owned damage areas (Rasen-shuriken, Amaterasu, sand). */
export interface Field {
  x: number;
  y: number;
  r: number;
  life: number;
  tick: number;
  timer: number;
  dmg: number;
  src: string;
  color: string;
  style: 'shuriken' | 'blackfire' | 'sand';
  dead: boolean;
}

export type PickupKind = 'xp' | 'ryo' | 'ramen' | 'scroll' | 'chest' | 'biju' | 'tenten' | 'pill';

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  value: number;
  attracted: boolean;
  speed: number;
  dead: boolean;
}

export interface Effect {
  kind: 'boom' | 'puff' | 'ring' | 'bolt' | 'flash';
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  color: string;
  pts?: number[];
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  big?: boolean;
}

export interface Stats {
  dmg: number;
  cd: number;
  speed: number;
  area: number;
  maxHp: number;
  magnet: number;
  regen: number;
  xp: number;
  amount: number;
  crit: number;
  armor: number;
}

export interface Player {
  x: number;
  y: number;
  r: number;
  hp: number;
  facingX: number;
  facingY: number;
  invuln: number;
  moving: boolean;
  anim: number;
  slow: number;
  kbx: number;
  kby: number;
}
