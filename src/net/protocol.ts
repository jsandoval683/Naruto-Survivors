import type { CharacterId, StatMods } from '../game/characters';
import type { Nature } from '../game/natures';
import type { Effect, EnemyKind, FloatText, PickupKind } from '../game/types';
import type { HazardView, HeroView } from '../game/view';
import type { RunSummary } from '../meta/summary';

/** Index tables so snapshots can send small numbers instead of strings. */
export const ENEMY_KINDS: EnemyKind[] = ['grunt', 'puppet', 'brute', 'crow', 'zetsu', 'boss'];
export const NATURES: Nature[] = ['fuego', 'viento', 'rayo', 'tierra', 'agua', 'neutral'];
export const PROJ_KINDS = ['kunai', 'rasengan', 'fireball'] as const;
export const PICKUP_KINDS: PickupKind[] = ['xp', 'ryo', 'ramen', 'scroll', 'chest', 'biju', 'tenten', 'pill'];
export const FIELD_STYLES = ['shuriken', 'blackfire', 'sand'] as const;

/** Strides of the flat number arrays in a snapshot. */
export const E_STRIDE = 8; // id, kind, nature, x, y, r, flash, hp%
export const P_STRIDE = 6; // kind, x, y, r, angle*100, big
export const F_STRIDE = 5; // x, y, r, life*10, style
export const PK_STRIDE = 4; // kind, x, y, value

export interface BossSnap {
  id: number;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  dmgTaken: number;
  nature: Nature;
  name: string;
  lookId: string;
  hearts?: Nature[];
  flash: number;
}

export interface HeroSnap extends HeroView {
  /** Movement speed (world units/s), for client-side prediction. */
  spd: number;
}

export interface Snapshot {
  t: number;
  sc: string;
  arc: string;
  k: number;
  ryo: number;
  lv: number;
  xp: number;
  xpn: number;
  biju: number;
  nb: { t: number; ids: string[] } | null;
  bn: { text: string; life: number; sub?: string } | null;
  tn: { color: string; life: number; max: number } | null;
  /** Names of players currently choosing a card (the world is paused meanwhile). */
  choosing: string[];
  h: HeroSnap[];
  e: number[];
  b: BossSnap[];
  p: number[];
  hz: HazardView[];
  f: number[];
  pk: number[];
  fx: Effect[];
  tx: FloatText[];
}

export interface ChoiceSnap {
  title: string;
  tag: string;
  isNew: boolean;
  desc: string;
  icon: string;
  color: string;
}

export interface PromptMsg {
  title: string;
  sub: string;
  choices: ChoiceSnap[];
  rerolls: number;
  canReroll: boolean;
  /** Seconds left before a card is picked automatically. */
  seconds: number;
}

export interface RoomPlayer {
  id: number;
  name: string;
  charId: CharacterId;
  lookId: string;
  host: boolean;
  connected: boolean;
}

export interface RoomInfo {
  code: string;
  isPublic: boolean;
  started: boolean;
  elapsed: number;
  players: RoomPlayer[];
}

export interface RoomListing {
  code: string;
  host: string;
  count: number;
  started: boolean;
  elapsed: number;
}

/** Permanent bonuses the client brings into a co-op run. */
export interface NetBonuses {
  mods: StatMods;
  xpMult: number;
  rerolls: number;
  extraJutsu: boolean;
}

export type ClientMsg =
  | { type: 'list' }
  | { type: 'create'; isPublic: boolean }
  | { type: 'join'; code: string }
  | { type: 'quick' }
  | { type: 'leave' }
  | { type: 'char'; charId: CharacterId; lookId: string; bonus: NetBonuses }
  | { type: 'start' }
  | { type: 'input'; x: number; y: number }
  | { type: 'pick'; index: number }
  | { type: 'reroll' };

export type ServerMsg =
  | { type: 'hello'; userId: number; name: string }
  | { type: 'rooms'; rooms: RoomListing[] }
  | { type: 'room'; room: RoomInfo | null }
  | { type: 'error'; message: string }
  | { type: 'start'; you: number }
  | { type: 'snap'; s: Snapshot }
  | { type: 'prompt'; prompt: PromptMsg | null }
  | { type: 'over'; win: boolean; summary: RunSummary };

export const MAX_PLAYERS = 4;
export const SNAP_EVERY_TICKS = 3; // 60 Hz simulation → 20 snapshots/s
