import type { Game } from './game';
import type { Hero } from './hero';
import { ArenaWeapon, ClonesWeapon, JUTSUS, SellosWeapon } from './jutsus';
import { PASSIVES } from './passives';
import type { SceneId } from './timeline';
import type { Nature } from './natures';
import type { Effect, EnemyKind, FloatText, PickupKind } from './types';

/**
 * Everything the renderer needs for one frame. Built from the local Game in solo,
 * or from server snapshots in co-op, so the same drawing code serves both.
 */
export interface SlotView {
  /** Jutsu id (pixel icon); passives use the kanji `icon`. */
  id?: string;
  icon: string;
  color: string;
  level: number;
  evolved?: boolean;
}

export interface HeroView {
  id: number;
  name: string;
  charName: string;
  lookId: string;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  facingX: number;
  moving: boolean;
  anim: number;
  invuln: number;
  slow: number;
  downed: boolean;
  revive: number;
  pillTime: number;
  hurtFlash: number;
  formName: string | null;
  aura: string | null;
  clones: { x: number; y: number; facingLeft: boolean; anim: number }[];
  tags: { x: number; y: number; arm: number }[];
  orbs: { x: number; y: number; r: number }[];
  slots: SlotView[];
  passives: SlotView[];
}

export interface EnemyView {
  id: number;
  kind: EnemyKind;
  nature: Nature;
  x: number;
  y: number;
  r: number;
  flash: number;
  hp: number;
  maxHp: number;
  dmgTaken: number;
  boss: { name: string; lookId: string; hearts?: Nature[] } | null;
}

export interface ProjectileView {
  kind: 'kunai' | 'rasengan' | 'fireball';
  x: number;
  y: number;
  r: number;
  angle: number;
  big?: boolean;
}

export interface HazardView {
  kind: 'bullet' | 'zone';
  x: number;
  y: number;
  r: number;
  color: string;
  dmg: number;
  life: number;
  delay?: number;
  maxDelay?: number;
  linger?: number;
}

export interface FieldView {
  x: number;
  y: number;
  r: number;
  life: number;
  style: 'shuriken' | 'blackfire' | 'sand';
}

export interface PickupView {
  kind: PickupKind;
  x: number;
  y: number;
  value: number;
}

export interface SceneView {
  t: number;
  scene: SceneId;
  arcName: string;
  kills: number;
  ryo: number;
  level: number;
  xp: number;
  xpNext: number;
  biju: number;
  heroes: HeroView[];
  localIndex: number;
  enemies: EnemyView[];
  projectiles: ProjectileView[];
  hazards: HazardView[];
  fields: FieldView[];
  pickups: PickupView[];
  effects: Effect[];
  texts: FloatText[];
  banner: { text: string; life: number; sub?: string } | null;
  tint: { color: string; life: number; max: number } | null;
  nextBoss: { t: number; ids: string[] } | null;
}

export function heroView(h: Hero): HeroView {
  const p = h.body;
  const clones: HeroView['clones'] = [];
  const tags: HeroView['tags'] = [];
  const orbs: HeroView['orbs'] = [];
  for (const w of h.weapons) {
    if (w instanceof ClonesWeapon) for (const c of w.clones) clones.push({ x: c.x, y: c.y, facingLeft: c.facingLeft, anim: c.anim });
    else if (w instanceof SellosWeapon) for (const t of w.tags) tags.push({ x: t.x, y: t.y, arm: t.arm });
    else if (w instanceof ArenaWeapon) for (const o of w.orbs) orbs.push({ x: o.x, y: o.y, r: o.r });
  }
  return {
    id: h.id,
    name: h.name,
    charName: h.char.name,
    lookId: h.lookId,
    x: p.x,
    y: p.y,
    r: p.r,
    hp: p.hp,
    maxHp: h.stats.maxHp,
    facingX: p.facingX,
    moving: p.moving,
    anim: p.anim,
    invuln: p.invuln,
    slow: p.slow,
    downed: h.downed,
    revive: h.revive,
    pillTime: h.pillTime,
    hurtFlash: h.hurtFlash,
    formName: h.transform?.name ?? null,
    aura: h.transform?.aura ?? null,
    clones,
    tags,
    orbs,
    slots: h.weapons.map((w) => ({ id: w.id, icon: JUTSUS[w.id].icon, color: w.evolved ? '#ffd23f' : JUTSUS[w.id].color, level: w.level, evolved: w.evolved })),
    passives: [...h.passives.entries()].map(([id, l]) => ({ icon: PASSIVES[id].icon, color: PASSIVES[id].color, level: l })),
  };
}

export function gameView(g: Game): SceneView {
  return {
    t: g.t,
    scene: g.scene,
    arcName: g.arcName,
    kills: g.kills,
    ryo: g.ryo,
    level: g.level,
    xp: g.xp,
    xpNext: g.xpNext,
    biju: g.biju,
    heroes: g.heroes.map(heroView),
    localIndex: g.localIndex,
    enemies: g.enemies,
    projectiles: g.projectiles,
    hazards: g.hazards,
    fields: g.fields,
    pickups: g.pickups,
    effects: g.effects,
    texts: g.texts,
    banner: g.banner,
    tint: g.tint,
    nextBoss: g.director.nextBoss(g.t),
  };
}
