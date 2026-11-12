import type { Game } from './game';
import type { Nature } from './natures';
import type { PassiveId } from './passives';
import type { Enemy, Projectile } from './types';

export type JutsuId =
  | 'kunai' | 'clones' | 'rasengan' | 'sellos' | 'puno' | 'raikiri' | 'chidori' | 'katon' | 'arena' | 'huracan'
  | 'sombra' | 'kaiten' | 'leones' | 'sapo' | 'cuervos' | 'hiraishin';

export const JUTSU_MAX_LEVEL = 5;

export abstract class Weapon {
  level = 1;
  evolved = false;
  protected timer = 0;
  constructor(public readonly id: JutsuId) {}
  abstract update(g: Game, dt: number): void;
}

export interface JutsuDef {
  id: JutsuId;
  name: string;
  icon: string;
  color: string;
  nature: Nature;
  desc: string;
  /** What each upgrade gives; index 0 = going to level 2. */
  upgrades: string[];
  /** Max level + this passive unlocks the evolution card. */
  evolution: { passive: PassiveId; name: string; desc: string };
  create(): Weapon;
}

function aimAt(g: Game, range: number): number {
  const p = g.player;
  const target = g.nearestEnemy(p.x, p.y, range);
  return target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(p.facingY, p.facingX);
}

function projectile(g: Game, init: Partial<Projectile> & Pick<Projectile, 'kind' | 'src' | 'vx' | 'vy' | 'r' | 'dmg'>): Projectile {
  const p: Projectile = {
    x: g.player.x,
    y: g.player.y,
    pierce: 1,
    life: 1.2,
    rehit: Infinity,
    knock: 60,
    hits: new Map(),
    dead: false,
    angle: Math.atan2(init.vy, init.vx),
    ...init,
  };
  g.projectiles.push(p);
  return p;
}

// ---------------- Kunai ----------------

const KUNAI = [
  { n: 1, dmg: 8, cd: 0.9, pierce: 1 },
  { n: 2, dmg: 8, cd: 0.9, pierce: 1 },
  { n: 2, dmg: 12, cd: 0.85, pierce: 1 },
  { n: 3, dmg: 12, cd: 0.8, pierce: 2 },
  { n: 4, dmg: 16, cd: 0.7, pierce: 2 },
];

class KunaiWeapon extends Weapon {
  constructor() {
    super('kunai');
  }
  update(g: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = KUNAI[this.level - 1];
    this.timer = L.cd * g.stats.cd;
    const n = L.n + g.stats.amount;
    const base = aimAt(g, 600);
    const dmg = L.dmg * g.stats.dmg;
    const fire = (a: number, pierce: number) =>
      projectile(g, { kind: 'kunai', src: 'kunai', vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, r: 6, dmg, pierce });
    for (let i = 0; i < n; i++) fire(base + (i - (n - 1) / 2) * 0.16, L.pierce);
    if (this.evolved) for (let i = 0; i < 8; i++) fire(base + (i / 8) * Math.PI * 2 + Math.PI / 8, 3);
  }
}

// ---------------- Clones de sombra ----------------

const CLONES = [
  { n: 1, dmg: 7, hitCd: 0.55, speed: 210 },
  { n: 2, dmg: 7, hitCd: 0.55, speed: 210 },
  { n: 2, dmg: 11, hitCd: 0.5, speed: 220 },
  { n: 3, dmg: 11, hitCd: 0.5, speed: 230 },
  { n: 4, dmg: 15, hitCd: 0.45, speed: 250 },
];

export interface Clone {
  x: number;
  y: number;
  cd: number;
  anim: number;
  facingLeft: boolean;
}

const CLONE_LEASH = 260;

export class ClonesWeapon extends Weapon {
  clones: Clone[] = [];
  constructor() {
    super('clones');
  }
  update(g: Game, dt: number): void {
    const L = CLONES[this.level - 1];
    const p = g.player;
    const want = L.n + g.stats.amount + (this.evolved ? 3 : 0);
    const dmg = L.dmg * g.stats.dmg * (this.evolved ? 1.5 : 1);
    while (this.clones.length < want) {
      const a = Math.random() * Math.PI * 2;
      const c = { x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30, cd: 0, anim: 0, facingLeft: false };
      this.clones.push(c);
      g.effects.push({ kind: 'puff', x: c.x, y: c.y, r: 22, life: 0.4, max: 0.4, color: '#fff' });
    }
    const area = (this.evolved ? 30 : 22) * g.stats.area;
    this.clones.forEach((c, i) => {
      c.cd -= dt;
      let tx: number;
      let ty: number;
      const target: Enemy | null = g.nearestEnemy(c.x, c.y, 240);
      if (target && Math.hypot(target.x - p.x, target.y - p.y) < CLONE_LEASH) {
        tx = target.x;
        ty = target.y;
      } else {
        const a = (i / this.clones.length) * Math.PI * 2 + g.t;
        tx = p.x + Math.cos(a) * 42;
        ty = p.y + Math.sin(a) * 42;
      }
      const dx = tx - c.x;
      const dy = ty - c.y;
      const d = Math.hypot(dx, dy);
      if (d > 2) {
        const step = Math.min(d, L.speed * dt);
        c.x += (dx / d) * step;
        c.y += (dy / d) * step;
        c.anim += dt;
        c.facingLeft = dx < 0;
      }
      if (c.cd <= 0) {
        const hits = g.enemiesInRadius(c.x, c.y, area);
        if (hits.length) {
          c.cd = L.hitCd * g.stats.cd;
          for (const e of hits) {
            const ex = e.x - c.x;
            const ey = e.y - c.y;
            const ed = Math.hypot(ex, ey) || 1;
            g.hit(e, dmg, (ex / ed) * 120, (ey / ed) * 120, 'clones');
          }
        }
      }
    });
  }
}

// ---------------- Rasengan ----------------

const RASENGAN = [
  { n: 1, dmg: 16, cd: 1.5, r: 14, boom: 12, boomR: 55 },
  { n: 1, dmg: 22, cd: 1.5, r: 14, boom: 16, boomR: 55 },
  { n: 1, dmg: 22, cd: 1.2, r: 14, boom: 16, boomR: 55 },
  { n: 1, dmg: 26, cd: 1.2, r: 18, boom: 22, boomR: 75 },
  { n: 2, dmg: 32, cd: 1.1, r: 18, boom: 28, boomR: 80 },
];

class RasenganWeapon extends Weapon {
  constructor() {
    super('rasengan');
  }
  update(g: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = RASENGAN[this.level - 1];
    this.timer = L.cd * g.stats.cd;
    const n = L.n + g.stats.amount;
    const base = aimAt(g, 500);
    const s = g.stats;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.5;
      projectile(g, {
        kind: 'rasengan',
        src: 'rasengan',
        vx: Math.cos(a) * 240,
        vy: Math.sin(a) * 240,
        r: L.r * s.area * (this.evolved ? 1.3 : 1),
        dmg: L.dmg * s.dmg,
        pierce: Infinity,
        life: 0.95,
        rehit: 0.25,
        knock: 140,
        big: this.evolved,
        onEnd: (pr) => {
          if (this.evolved) {
            // Rasen-shuriken: a spinning blade field that keeps cutting.
            g.fields.push({ x: pr.x, y: pr.y, r: 110 * s.area, life: 1.2, tick: 0.15, timer: 0, dmg: L.dmg * 0.5 * s.dmg, src: 'rasengan', color: '#bfe8ff', style: 'shuriken', dead: false });
          } else {
            g.explode(pr.x, pr.y, L.boomR * s.area, L.boom * s.dmg, 'rasengan', '#7fd0ff');
          }
        },
      });
    }
  }
}

// ---------------- Sellos explosivos ----------------

const SELLOS = [
  { n: 1, dmg: 28, cd: 2.2, r: 65 },
  { n: 1, dmg: 38, cd: 2.2, r: 65 },
  { n: 1, dmg: 38, cd: 1.7, r: 65 },
  { n: 2, dmg: 38, cd: 1.7, r: 65 },
  { n: 2, dmg: 55, cd: 1.6, r: 90 },
];

export interface Tag {
  x: number;
  y: number;
  arm: number;
  life: number;
}

export class SellosWeapon extends Weapon {
  tags: Tag[] = [];
  private chain: { x: number; y: number; t: number }[] = [];
  constructor() {
    super('sellos');
  }
  update(g: Game, dt: number): void {
    const L = SELLOS[this.level - 1];
    const p = g.player;
    const r = L.r * g.stats.area;
    const dmg = L.dmg * g.stats.dmg;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = L.cd * g.stats.cd;
      const n = L.n + g.stats.amount;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const off = i === 0 ? 0 : 40 + Math.random() * 50;
        this.tags.push({ x: p.x + Math.cos(a) * off, y: p.y + Math.sin(a) * off, arm: 0.5, life: 5 });
      }
    }
    for (const t of this.tags) {
      t.arm -= dt;
      t.life -= dt;
      const triggered = t.arm <= 0 && g.enemiesInRadius(t.x, t.y, 14).length > 0;
      if (triggered || t.life <= 0) {
        g.explode(t.x, t.y, r, dmg, 'sellos');
        if (this.evolved) {
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + Math.random();
            this.chain.push({ x: t.x + Math.cos(a) * r * 0.9, y: t.y + Math.sin(a) * r * 0.9, t: 0.18 });
          }
        }
        t.life = -1;
      }
    }
    this.tags = this.tags.filter((t) => t.life > 0);
    for (const c of this.chain) {
      c.t -= dt;
      if (c.t <= 0) g.explode(c.x, c.y, r * 0.7, dmg * 0.6, 'sellos');
    }
    this.chain = this.chain.filter((c) => c.t > 0);
  }
}

// ---------------- Puño de chakra (Sakura) ----------------

const PUNO = [
  { dmg: 26, cd: 1.3, r: 58 },
  { dmg: 34, cd: 1.3, r: 58 },
  { dmg: 34, cd: 1.1, r: 68 },
  { dmg: 46, cd: 1.1, r: 78 },
  { dmg: 60, cd: 0.95, r: 92 },
];

class PunoWeapon extends Weapon {
  constructor() {
    super('puno');
  }
  update(g: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = PUNO[this.level - 1];
    this.timer = L.cd * g.stats.cd;
    const p = g.player;
    const target = g.nearestEnemy(p.x, p.y, 170);
    const x = target ? target.x : p.x;
    const y = target ? target.y : p.y;
    const mult = this.evolved ? 1.6 : 1;
    g.explode(x, y, L.r * g.stats.area * mult, L.dmg * g.stats.dmg * (this.evolved ? 1.5 : 1), 'puno', '#c49a5a');
    g.effects.push({ kind: 'ring', x, y, r: L.r * g.stats.area * mult * 1.2, life: 0.4, max: 0.4, color: '#f7a8c8' });
  }
}

// ---------------- Raikiri (Kakashi): chain lightning ----------------

const RAIKIRI = [
  { dmg: 18, chains: 2, cd: 1.3 },
  { dmg: 24, chains: 3, cd: 1.2 },
  { dmg: 24, chains: 4, cd: 1.1 },
  { dmg: 30, chains: 4, cd: 1.0 },
  { dmg: 38, chains: 6, cd: 0.9 },
];

class RaikiriWeapon extends Weapon {
  constructor() {
    super('raikiri');
  }
  private chain(g: Game, first: Enemy, chains: number, dmg: number): void {
    const hit = new Set<Enemy>();
    let fromX = g.player.x;
    let fromY = g.player.y;
    let cur: Enemy | null = first;
    for (let i = 0; i <= chains && cur; i++) {
      g.bolt(fromX, fromY, cur.x, cur.y, '#bfe8ff');
      g.hit(cur, dmg, 0, 0, 'raikiri');
      hit.add(cur);
      fromX = cur.x;
      fromY = cur.y;
      let next: Enemy | null = null;
      let best = 130 * 130 * g.stats.area * g.stats.area;
      for (const e of g.enemiesInRadius(fromX, fromY, 130 * g.stats.area)) {
        if (hit.has(e)) continue;
        const d = (e.x - fromX) ** 2 + (e.y - fromY) ** 2;
        if (d < best) {
          best = d;
          next = e;
        }
      }
      cur = next;
    }
  }
  update(g: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = RAIKIRI[this.level - 1];
    const p = g.player;
    const first = g.nearestEnemy(p.x, p.y, 320);
    if (!first) return;
    this.timer = L.cd * g.stats.cd * (this.evolved ? 0.7 : 1);
    const chains = L.chains + g.stats.amount + (this.evolved ? 6 : 0);
    const dmg = L.dmg * g.stats.dmg;
    this.chain(g, first, chains, dmg);
    if (this.evolved) {
      const other = g.randomVisibleEnemy();
      if (other && other !== first) this.chain(g, other, chains, dmg);
    }
  }
}

// ---------------- Chidori (Sasuke): lightning spear ----------------

const CHIDORI = [
  { dmg: 22, len: 200, cd: 1.6, n: 1 },
  { dmg: 30, len: 200, cd: 1.5, n: 1 },
  { dmg: 30, len: 240, cd: 1.3, n: 1 },
  { dmg: 38, len: 260, cd: 1.2, n: 2 },
  { dmg: 48, len: 280, cd: 1.0, n: 2 },
];

class ChidoriWeapon extends Weapon {
  constructor() {
    super('chidori');
  }
  update(g: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = CHIDORI[this.level - 1];
    this.timer = L.cd * g.stats.cd;
    const p = g.player;
    const base = aimAt(g, 400);
    const n = L.n + g.stats.amount;
    const len = L.len * g.stats.area;
    const dmg = L.dmg * g.stats.dmg;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.35;
      const ex = p.x + Math.cos(a) * len;
      const ey = p.y + Math.sin(a) * len;
      g.bolt(p.x, p.y, ex, ey, '#d6f0ff', 3);
      for (const e of g.enemiesOnSegment(p.x, p.y, ex, ey, 14 * g.stats.area)) {
        g.hit(e, dmg, Math.cos(a) * 160, Math.sin(a) * 160, 'chidori');
      }
    }
    if (this.evolved) {
      // Kirin: lightning strikes from the sky.
      for (let i = 0; i < 3; i++) {
        const e = g.randomVisibleEnemy();
        if (!e) break;
        g.bolt(e.x + (Math.random() - 0.5) * 60, e.y - 320, e.x, e.y, '#ffffff', 4);
        g.explode(e.x, e.y, 70 * g.stats.area, dmg * 2, 'chidori', '#ffe14d');
      }
    }
  }
}

// ---------------- Katon: Gōkakyū ----------------

const KATON = [
  { dmg: 24, r: 50, cd: 1.6, n: 1 },
  { dmg: 32, r: 50, cd: 1.6, n: 1 },
  { dmg: 32, r: 60, cd: 1.3, n: 2 },
  { dmg: 40, r: 70, cd: 1.3, n: 2 },
  { dmg: 52, r: 80, cd: 1.1, n: 3 },
];

class KatonWeapon extends Weapon {
  constructor() {
    super('katon');
  }
  update(g: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = KATON[this.level - 1];
    this.timer = L.cd * g.stats.cd;
    const n = L.n + g.stats.amount;
    const base = aimAt(g, 450);
    const s = g.stats;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.3;
      projectile(g, {
        kind: 'fireball',
        src: 'katon',
        vx: Math.cos(a) * 300,
        vy: Math.sin(a) * 300,
        r: 10 * s.area,
        dmg: L.dmg * 0.4 * s.dmg,
        life: 1.1,
        big: this.evolved,
        onEnd: (pr) => {
          const r = L.r * s.area;
          g.explode(pr.x, pr.y, r, L.dmg * s.dmg, 'katon', this.evolved ? '#3a1050' : '#ff7a2a');
          if (this.evolved) {
            g.fields.push({ x: pr.x, y: pr.y, r: r * 0.8, life: 3, tick: 0.3, timer: 0, dmg: L.dmg * 0.3 * s.dmg, src: 'katon', color: '#1a0a24', style: 'blackfire', dead: false });
          }
        },
      });
    }
  }
}

// ---------------- Arena (Gaara): orbiting sand ----------------

const ARENA = [
  { n: 3, dmg: 12, R: 58 },
  { n: 3, dmg: 15, R: 62 },
  { n: 4, dmg: 17, R: 66 },
  { n: 4, dmg: 21, R: 72 },
  { n: 5, dmg: 26, R: 78 },
];

export class ArenaWeapon extends Weapon {
  orbs: { x: number; y: number; r: number }[] = [];
  private angle = 0;
  private hits = new Map<Enemy, number>();
  constructor() {
    super('arena');
  }
  update(g: Game, dt: number): void {
    const L = ARENA[this.level - 1];
    const p = g.player;
    const n = L.n + g.stats.amount;
    const R = L.R * g.stats.area;
    const orbR = 9 * g.stats.area * (this.evolved ? 1.6 : 1);
    const dmg = L.dmg * g.stats.dmg * (this.evolved ? 1.5 : 1);
    this.angle += dt * 3 / g.stats.cd;
    this.orbs.length = 0;
    for (let i = 0; i < n; i++) {
      const a = this.angle + (i / n) * Math.PI * 2;
      const o = { x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R, r: orbR };
      this.orbs.push(o);
      for (const e of g.enemiesInRadius(o.x, o.y, orbR)) {
        if ((this.hits.get(e) ?? -1) > g.t) continue;
        this.hits.set(e, g.t + 0.5);
        g.hit(e, dmg, Math.cos(a) * 140, Math.sin(a) * 140, 'arena');
      }
    }
    if (this.hits.size > 600) this.hits.clear();
    if (this.evolved) {
      // Funeral de arena: crushes the nearest group every few seconds.
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 3 * g.stats.cd;
        const e = g.nearestEnemy(p.x, p.y, 300);
        if (e) g.fields.push({ x: e.x, y: e.y, r: 90 * g.stats.area, life: 1, tick: 0.2, timer: 0, dmg: L.dmg * 1.2 * g.stats.dmg, src: 'arena', color: '#d8b26a', style: 'sand', dead: false });
      }
    }
  }
}

// ---------------- Huracán de la hoja (Rock Lee) ----------------

const HURACAN = [
  { dmg: 16, r: 68, cd: 1.1 },
  { dmg: 22, r: 72, cd: 1.05 },
  { dmg: 26, r: 82, cd: 0.95 },
  { dmg: 32, r: 92, cd: 0.85 },
  { dmg: 40, r: 105, cd: 0.75 },
];

class HuracanWeapon extends Weapon {
  constructor() {
    super('huracan');
  }
  update(g: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = HURACAN[this.level - 1];
    this.timer = L.cd * g.stats.cd;
    const p = g.player;
    const r = L.r * g.stats.area;
    for (const e of g.enemiesInRadius(p.x, p.y, r)) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      g.hit(e, L.dmg * g.stats.dmg, (dx / d) * 260, (dy / d) * 260, 'huracan');
    }
    g.effects.push({ kind: 'ring', x: p.x, y: p.y, r, life: 0.3, max: 0.3, color: '#8fe3a8' });
    if (this.evolved) {
      // Pavo real matutino: a burst of burning punches in every direction.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + g.t;
        projectile(g, {
          kind: 'fireball',
          src: 'huracan',
          vx: Math.cos(a) * 380,
          vy: Math.sin(a) * 380,
          r: 8,
          dmg: L.dmg * 0.8 * g.stats.dmg,
          pierce: 3,
          life: 0.5,
        });
      }
    }
  }
}

// ---------------- Posesión de sombra (Shikamaru) ----------------

const SOMBRA = [
  { n: 2, dmg: 10, stun: 1.2, cd: 2.4 },
  { n: 3, dmg: 14, stun: 1.4, cd: 2.2 },
  { n: 4, dmg: 18, stun: 1.6, cd: 2.0 },
  { n: 5, dmg: 22, stun: 1.8, cd: 1.8 },
  { n: 6, dmg: 28, stun: 2.0, cd: 1.6 },
];

/** Nearest `n` enemies within `range` of (x, y). */
function nearestN(g: Game, x: number, y: number, range: number, n: number): Enemy[] {
  return g.enemies
    .filter((e) => !e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 < range * range)
    .sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2))
    .slice(0, n);
}

class SombraWeapon extends Weapon {
  constructor() {
    super('sombra');
  }
  update(g: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = SOMBRA[this.level - 1];
    const p = g.player;
    const n = L.n + g.stats.amount + (this.evolved ? 4 : 0);
    const targets = nearestN(g, p.x, p.y, 240 * g.stats.area, n);
    if (!targets.length) return;
    this.timer = L.cd * g.stats.cd;
    const dmg = L.dmg * g.stats.dmg * (this.evolved ? 2 : 1);
    for (const e of targets) {
      e.stun = Math.max(e.stun ?? 0, (L.stun + (this.evolved ? 1 : 0)) * (e.boss ? 0.4 : 1));
      g.effects.push({ kind: 'shadow', x: p.x, y: p.y, r: 3, life: 0.5, max: 0.5, color: '#120c1a', pts: [p.x, p.y + 10, e.x, e.y + e.r * 0.8] });
      g.hit(e, dmg, 0, 0, 'sombra');
    }
  }
}

// ---------------- Rotación / Kaiten (Neji, Hinata) ----------------

const KAITEN = [
  { dmg: 22, r: 82, cd: 1.3 },
  { dmg: 27, r: 88, cd: 1.2 },
  { dmg: 29, r: 96, cd: 1.2 },
  { dmg: 35, r: 106, cd: 1.1 },
  { dmg: 44, r: 120, cd: 0.95 },
];

class KaitenWeapon extends Weapon {
  constructor() {
    super('kaiten');
  }
  update(g: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = KAITEN[this.level - 1];
    this.timer = L.cd * g.stats.cd;
    const p = g.player;
    const r = L.r * g.stats.area;
    const dmg = L.dmg * g.stats.dmg;
    for (const e of g.enemiesInRadius(p.x, p.y, r)) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      g.hit(e, dmg, (dx / d) * 110, (dy / d) * 110, 'kaiten');
    }
    // The spinning dome also swats enemy projectiles out of the air.
    for (const h of g.hazards) {
      if (h.kind === 'bullet' && Math.hypot(h.x - p.x, h.y - p.y) < r) h.dead = true;
    }
    g.effects.push({ kind: 'ring', x: p.x, y: p.y, r, life: 0.35, max: 0.35, color: '#cfeeff' });
    // Vacuum palm: a blast of chakra towards the nearest enemy (reach beyond the dome).
    const base = aimAt(g, 380);
    const palms = this.level >= 3 ? 2 : 1;
    for (let i = 0; i < palms; i++) {
      const a = base + (i - (palms - 1) / 2) * 0.3;
      projectile(g, { kind: 'lion', src: 'kaiten', vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, r: 10, dmg, pierce: 2, life: 0.9, knock: 120 });
    }
    if (this.evolved) {
      // Eight Trigrams Sixty-Four Palms: a flurry on the closest enemies.
      for (const e of nearestN(g, p.x, p.y, r * 1.4, 8)) {
        g.bolt(p.x, p.y - 6, e.x, e.y, '#e8f6ff', 1);
        g.hit(e, dmg * 0.6, 0, 0, 'kaiten');
      }
    }
  }
}

// ---------------- Puños de león (Hinata) ----------------

const LEONES = [
  { n: 1, dmg: 18, cd: 1.6 },
  { n: 2, dmg: 22, cd: 1.5 },
  { n: 2, dmg: 28, cd: 1.3 },
  { n: 3, dmg: 32, cd: 1.2 },
  { n: 4, dmg: 40, cd: 1.0 },
];

class LeonesWeapon extends Weapon {
  constructor() {
    super('leones');
  }
  update(g: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = LEONES[this.level - 1];
    this.timer = L.cd * g.stats.cd;
    const n = L.n + g.stats.amount + (this.evolved ? 2 : 0);
    const base = aimAt(g, 400);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.6;
      projectile(g, {
        kind: 'lion',
        src: 'leones',
        vx: Math.cos(a) * 260,
        vy: Math.sin(a) * 260,
        r: 11 * g.stats.area,
        dmg: L.dmg * g.stats.dmg * (this.evolved ? 1.5 : 1),
        pierce: 3,
        life: 1.6,
        rehit: 0.4,
        knock: 140,
        homing: 4,
      });
    }
  }
}

// ---------------- Invocación: Gamabunta (Jiraiya) ----------------

const SAPO = [
  { dmg: 42, r: 85, cd: 3.8 },
  { dmg: 56, r: 90, cd: 3.6 },
  { dmg: 56, r: 100, cd: 3.3 },
  { dmg: 74, r: 108, cd: 3.1 },
  { dmg: 96, r: 120, cd: 2.9 },
];

const TOAD_FALL = 0.6;

class SapoWeapon extends Weapon {
  private landings: { x: number; y: number; t: number }[] = [];
  constructor() {
    super('sapo');
  }
  update(g: Game, dt: number): void {
    const L = SAPO[this.level - 1];
    const r = L.r * g.stats.area;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = L.cd * g.stats.cd;
      const p = g.player;
      const e = g.nearestEnemy(p.x, p.y, 320);
      const x = e ? e.x : p.x + p.facingX * 120;
      const y = e ? e.y : p.y + p.facingY * 120;
      this.landings.push({ x, y, t: TOAD_FALL });
      g.effects.push({ kind: 'drop', x, y, r, life: TOAD_FALL, max: TOAD_FALL, color: '#000' });
    }
    for (const l of this.landings) {
      l.t -= dt;
      if (l.t > 0) continue;
      g.explode(l.x, l.y, r, L.dmg * g.stats.dmg, 'sapo', '#c9a26b');
      g.effects.push({ kind: 'toad', x: l.x, y: l.y, r, life: 0.9, max: 0.9, color: this.evolved ? '#ff7a2a' : '#e8701f' });
      if (this.evolved) {
        // Toad oil + fire: the landing spot keeps burning.
        g.fields.push({ x: l.x, y: l.y, r: r * 0.8, life: 3, tick: 0.3, timer: 0, dmg: L.dmg * 0.15 * g.stats.dmg, src: 'sapo', color: '#ff7a2a', style: 'fire', dead: false });
      }
    }
    this.landings = this.landings.filter((l) => l.t > 0);
  }
}

// ---------------- Cuervos (Itachi) ----------------

const CUERVOS = [
  { n: 4, dmg: 9, cd: 1.6 },
  { n: 5, dmg: 11, cd: 1.5 },
  { n: 6, dmg: 14, cd: 1.4 },
  { n: 7, dmg: 17, cd: 1.3 },
  { n: 8, dmg: 21, cd: 1.1 },
];

class CuervosWeapon extends Weapon {
  private tsukuyomi = 0;
  constructor() {
    super('cuervos');
  }
  update(g: Game, dt: number): void {
    if (this.evolved) {
      // Tsukuyomi: every few seconds, everything on screen freezes in the genjutsu.
      this.tsukuyomi -= dt;
      if (this.tsukuyomi <= 0) {
        this.tsukuyomi = 6 * g.stats.cd;
        const p = g.player;
        for (const e of g.enemies) {
          if (e.dead || Math.abs(e.x - p.x) > g.viewW / 2 || Math.abs(e.y - p.y) > g.viewH / 2) continue;
          e.stun = Math.max(e.stun ?? 0, e.boss ? 0.6 : 1.5);
          g.hit(e, CUERVOS[this.level - 1].dmg * g.stats.dmg, 0, 0, 'cuervos');
        }
        g.effects.push({ kind: 'ring', x: p.x, y: p.y, r: 200, life: 0.5, max: 0.5, color: '#e01b1b' });
      }
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = CUERVOS[this.level - 1];
    this.timer = L.cd * g.stats.cd;
    const n = L.n + g.stats.amount;
    const base = aimAt(g, 450);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.22;
      projectile(g, {
        kind: 'crow',
        src: 'cuervos',
        vx: Math.cos(a) * 330,
        vy: Math.sin(a) * 330,
        r: 8,
        dmg: L.dmg * g.stats.dmg,
        pierce: 2,
        life: 1.1,
        knock: 50,
      });
    }
  }
}

// ---------------- Hiraishin (Minato) ----------------

const HIRAISHIN = [
  { n: 2, dmg: 16, cd: 1.5 },
  { n: 3, dmg: 20, cd: 1.4 },
  { n: 4, dmg: 24, cd: 1.3 },
  { n: 5, dmg: 30, cd: 1.2 },
  { n: 6, dmg: 38, cd: 1.0 },
];

class HiraishinWeapon extends Weapon {
  constructor() {
    super('hiraishin');
  }
  update(g: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const L = HIRAISHIN[this.level - 1];
    const p = g.player;
    const n = L.n + g.stats.amount + (this.evolved ? 4 : 0);
    const targets = nearestN(g, p.x, p.y, 330, n);
    if (!targets.length) return;
    this.timer = L.cd * g.stats.cd * (this.evolved ? 0.7 : 1);
    // A yellow flash jumps between marked targets, striking each one.
    let fx = p.x;
    let fy = p.y;
    for (const e of targets) {
      g.bolt(fx, fy, e.x, e.y, '#ffe14d', 2);
      g.puff(e.x, e.y, '#ffe14d', 14);
      g.hit(e, L.dmg * g.stats.dmg, 0, 0, 'hiraishin');
      fx = e.x;
      fy = e.y;
    }
  }
}

// ---------------- Registry ----------------

export const JUTSUS: Record<JutsuId, JutsuDef> = {
  kunai: {
    id: 'kunai',
    name: 'Kunai',
    icon: '苦',
    color: '#9aa4b1',
    nature: 'neutral',
    desc: 'Lanza kunais al enemigo más cercano.',
    upgrades: ['+1 kunai.', '+50% de daño.', '+1 kunai y atraviesa a 2 enemigos.', '+1 kunai, +33% de daño y menos recarga.'],
    evolution: { passive: 'sensor', name: 'Tormenta de kunais', desc: 'Además lanza 8 kunais en todas direcciones que atraviesan a 3 enemigos.' },
    create: () => new KunaiWeapon(),
  },
  clones: {
    id: 'clones',
    name: 'Clones de sombra',
    icon: '影',
    color: '#f39c32',
    nature: 'neutral',
    desc: 'Un clon que persigue a los enemigos y los golpea.',
    upgrades: ['+1 clon.', '+57% de daño y golpean más rápido.', '+1 clon.', '+1 clon, +36% de daño y más velocidad.'],
    evolution: { passive: 'chakra', name: 'Ejército de mil clones', desc: '+3 clones, +50% de daño y golpes más amplios.' },
    create: () => new ClonesWeapon(),
  },
  rasengan: {
    id: 'rasengan',
    name: 'Rasengan',
    icon: '螺',
    color: '#4fb3ff',
    nature: 'viento',
    desc: 'Esfera de chakra que arrolla a los enemigos y estalla al final.',
    upgrades: ['+38% de daño.', '-20% de recarga.', 'Esfera y explosión más grandes.', 'Lanza 2 Rasengan y +23% de daño.'],
    evolution: { passive: 'energia', name: 'Rasen-shuriken', desc: 'Al final crea un torbellino de cuchillas que corta todo a su alrededor.' },
    create: () => new RasenganWeapon(),
  },
  sellos: {
    id: 'sellos',
    name: 'Sellos explosivos',
    icon: '爆',
    color: '#ff5a3c',
    nature: 'fuego',
    desc: 'Deja sellos en el suelo que estallan al pisarlos.',
    upgrades: ['+36% de daño.', '-23% de recarga.', '+1 sello cada vez.', '+45% de daño y explosión más grande.'],
    evolution: { passive: 'taijutsu', name: 'Cadena de sellos', desc: 'Cada explosión provoca otras 3 a su alrededor.' },
    create: () => new SellosWeapon(),
  },
  puno: {
    id: 'puno',
    name: 'Puño de chakra',
    icon: '桜',
    color: '#f7a8c8',
    nature: 'tierra',
    desc: 'Golpea el suelo junto al enemigo más cercano y lo hace añicos.',
    upgrades: ['+33% de daño.', '-17% de recarga y más área.', '+38% de daño y más área.', '+27% de daño, más área y menos recarga.'],
    evolution: { passive: 'taijutsu', name: 'Puño de Cien Fuerzas', desc: '+60% de área y +50% de daño.' },
    create: () => new PunoWeapon(),
  },
  raikiri: {
    id: 'raikiri',
    name: 'Raikiri',
    icon: '雷',
    color: '#bfe8ff',
    nature: 'rayo',
    desc: 'Un rayo que salta de enemigo en enemigo.',
    upgrades: ['+33% de daño y +1 salto.', '+1 salto.', '+25% de daño.', '+27% de daño y +2 saltos.'],
    evolution: { passive: 'shunshin', name: 'Shiden', desc: 'Dos rayos a la vez, +6 saltos y -30% de recarga.' },
    create: () => new RaikiriWeapon(),
  },
  chidori: {
    id: 'chidori',
    name: 'Chidori',
    icon: '千',
    color: '#d6f0ff',
    nature: 'rayo',
    desc: 'Una lanza de rayo que atraviesa a todos en línea recta.',
    upgrades: ['+36% de daño.', 'Más alcance y menos recarga.', '2 lanzas y +27% de daño.', '+26% de daño, más alcance y menos recarga.'],
    evolution: { passive: 'sharingan', name: 'Kirin', desc: 'Además caen 3 rayos del cielo sobre los enemigos.' },
    create: () => new ChidoriWeapon(),
  },
  katon: {
    id: 'katon',
    name: 'Katon: Gran bola de fuego',
    icon: '火',
    color: '#ff7a2a',
    nature: 'fuego',
    desc: 'Una bola de fuego que estalla al tocar a un enemigo.',
    upgrades: ['+33% de daño.', '2 bolas, más área y menos recarga.', '+25% de daño y más área.', '3 bolas, +30% de daño y menos recarga.'],
    evolution: { passive: 'sharingan', name: 'Amaterasu', desc: 'Las explosiones dejan llamas negras que siguen quemando.' },
    create: () => new KatonWeapon(),
  },
  arena: {
    id: 'arena',
    name: 'Arena de Gaara',
    icon: '砂',
    color: '#d8b26a',
    nature: 'tierra',
    desc: 'Esferas de arena que giran a tu alrededor.',
    upgrades: ['+1 esfera y +20% de daño.', '+33% de daño.', '+1 esfera.', '+1 esfera y +33% de daño.'],
    evolution: { passive: 'resistencia', name: 'Funeral de arena', desc: 'Esferas más grandes y fuertes; además aplasta a los enemigos cercanos.' },
    create: () => new ArenaWeapon(),
  },
  huracan: {
    id: 'huracan',
    name: 'Huracán de la hoja',
    icon: '旋',
    color: '#8fe3a8',
    nature: 'viento',
    desc: 'Una patada giratoria que golpea y empuja a todos a tu alrededor.',
    upgrades: ['+43% de daño.', 'Más área y +20% de daño.', '+25% de daño, más área y menos recarga.', '+27% de daño, más área y menos recarga.'],
    evolution: { passive: 'shunshin', name: 'Pavo real matutino', desc: 'Además lanza 8 puñetazos de fuego en todas direcciones.' },
    create: () => new HuracanWeapon(),
  },
  sombra: {
    id: 'sombra',
    name: 'Posesión de sombra',
    icon: '影',
    color: '#6b5a8a',
    nature: 'neutral',
    desc: 'Su sombra atrapa a los enemigos más cercanos y los deja inmóviles.',
    upgrades: ['+1 objetivo, más daño y más tiempo atrapados.', '+1 objetivo y +29% de daño.', '+1 objetivo y menos recarga.', '+1 objetivo, +27% de daño y menos recarga.'],
    evolution: { passive: 'chakra', name: 'Estrangulamiento de sombra', desc: '+4 objetivos, doble de daño y 1 s más atrapados.' },
    create: () => new SombraWeapon(),
  },
  kaiten: {
    id: 'kaiten',
    name: 'Rotación (Kaiten)',
    icon: '廻',
    color: '#cfeeff',
    nature: 'neutral',
    desc: 'Una cúpula de chakra que empuja y destruye proyectiles, y una palma de vacío al enemigo más cercano.',
    upgrades: ['+33% de daño y más área.', '+30% de daño, más área y menos recarga.', '+23% de daño y más área.', '+25% de daño, más área y menos recarga.'],
    evolution: { passive: 'taijutsu', name: 'Ocho trigramas: 64 palmas', desc: 'Tras cada rotación, una ráfaga de golpes a los 8 enemigos más cercanos.' },
    create: () => new KaitenWeapon(),
  },
  leones: {
    id: 'leones',
    name: 'Puños de león',
    icon: '獅',
    color: '#b48cff',
    nature: 'fuego',
    desc: 'Leones de chakra que persiguen a los enemigos y los atraviesan.',
    upgrades: ['+1 león y +22% de daño.', '+27% de daño y menos recarga.', '+1 león y +14% de daño.', '+1 león, +25% de daño y menos recarga.'],
    evolution: { passive: 'resistencia', name: 'León gemelo', desc: '+2 leones y +50% de daño.' },
    create: () => new LeonesWeapon(),
  },
  sapo: {
    id: 'sapo',
    name: 'Invocación: Gamabunta',
    icon: '蛙',
    color: '#e8701f',
    nature: 'agua',
    desc: 'Un sapo gigante cae del cielo sobre los enemigos.',
    upgrades: ['+40% de daño y menos recarga.', 'Más área y menos recarga.', '+36% de daño, más área y menos recarga.', '+37% de daño, más área y menos recarga.'],
    evolution: { passive: 'energia', name: 'Aceite y fuego del sapo', desc: 'Donde cae el sapo, el suelo arde durante 3 s.' },
    create: () => new SapoWeapon(),
  },
  cuervos: {
    id: 'cuervos',
    name: 'Cuervos de Itachi',
    icon: '烏',
    color: '#e01b1b',
    nature: 'neutral',
    desc: 'Una bandada de cuervos que atraviesa a los enemigos en abanico.',
    upgrades: ['+1 cuervo y +22% de daño.', '+1 cuervo y +27% de daño.', '+1 cuervo y +21% de daño.', '+1 cuervo, +24% de daño y menos recarga.'],
    evolution: { passive: 'sharingan', name: 'Tsukuyomi', desc: 'Cada 6 s, todos los enemigos a la vista quedan atrapados en el genjutsu.' },
    create: () => new CuervosWeapon(),
  },
  hiraishin: {
    id: 'hiraishin',
    name: 'Hiraishin',
    icon: '閃',
    color: '#ffe14d',
    nature: 'rayo',
    desc: 'Un destello amarillo salta entre los enemigos marcados y los golpea a todos.',
    upgrades: ['+1 objetivo y +25% de daño.', '+1 objetivo y +20% de daño.', '+1 objetivo y +25% de daño.', '+1 objetivo, +27% de daño y menos recarga.'],
    evolution: { passive: 'shunshin', name: 'Destello amarillo de Konoha', desc: '+4 objetivos y -30% de recarga.' },
    create: () => new HiraishinWeapon(),
  },
};
