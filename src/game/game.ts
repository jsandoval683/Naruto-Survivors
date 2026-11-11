import { SpatialHash } from '../core/spatialHash';
import type { Input } from '../core/input';
import { BOSSES, type BossId } from './bosses';
import { CHARACTERS, type CharacterDef, type CharacterId, type StatMods, type Transform } from './characters';
import { ENEMIES, type MinionKind } from './enemies';
import { JUTSUS, type JutsuId, type Weapon } from './jutsus';
import { rollChoices, type Choice } from './levelup';
import { affinity, type Nature } from './natures';
import { computeStats, type PassiveId } from './passives';
import { Spawner } from './spawner';
import { Director, type Arc, type SceneId } from './timeline';
import type { RunSummary } from '../meta/summary';
import type { Effect, Enemy, Field, FloatText, Hazard, Pickup, PickupKind, Player, Projectile, Stats } from './types';

/** Madara arrives at 20:00; beating him wins the run. */
export const FINAL_TIME = 20 * 60;
const BASE_SPEED = 135;
const MAX_TEXTS = 120;
const MAX_XP_GEMS = 300;
const CRIT_MULT = 1.5;

export type GameState = 'play' | 'levelup' | 'paused' | 'over';

/** Bonuses brought in from outside the run (permanent upgrades, skin). */
export interface RunOptions {
  mods?: StatMods;
  xpMult?: number;
  rerolls?: number;
  extraJutsu?: boolean;
  lookId?: string;
}

/** A modal choice that isn't a level-up (Tenten's shop, the Juubi's wish). */
export interface SpecialPrompt {
  title: string;
  sub: string;
  choices: Choice[];
}

export const BIJU_NAMES = ['Shukaku', 'Matatabi', 'Isobu', 'Son Gokū', 'Kokuō', 'Saiken', 'Chōmei', 'Gyūki', 'Kurama'];
const BIJU_FIRST = 60;
const BIJU_EVERY = 115;
const TENTEN_EVERY = 240;
const PILL_TIME = 12;
const PILL_MODS: StatMods = { dmg: 1.3, speed: 1.2 };

export interface GameCallbacks {
  onLevelUp(): void;
  onGameOver(win: boolean): void;
}

function compact<T extends { dead: boolean }>(a: T[]): void {
  let j = 0;
  for (let i = 0; i < a.length; i++) if (!a[i].dead) a[j++] = a[i];
  a.length = j;
}

export function xpForLevel(level: number): number {
  const n = level - 1;
  // Gentle early, quadratic late so a strong build can't snowball forever.
  return Math.floor(5 + n * 6 + 0.4 * n * n);
}

export class Game {
  t = 0;
  state: GameState = 'play';
  player: Player = { x: 0, y: 0, r: 13, hp: 100, facingX: 1, facingY: 0, invuln: 0, moving: false, anim: 0, slow: 0, kbx: 0, kby: 0 };
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  hazards: Hazard[] = [];
  fields: Field[] = [];
  pickups: Pickup[] = [];
  effects: Effect[] = [];
  texts: FloatText[] = [];
  weapons: Weapon[] = [];
  passives = new Map<PassiveId, number>();
  stats: Stats;
  hash = new SpatialHash<Enemy>(64);
  spawner = new Spawner();
  director = new Director();

  char: CharacterDef;
  /** Index of the last transformation reached (-1 = none). */
  form = -1;
  scene: SceneId = 'desierto';
  arcName = '';
  bossesDefeated: string[] = [];

  level = 1;
  xp = 0;
  xpNext = xpForLevel(1);
  pendingLevelUps = 0;
  rerolls = 2;
  kills = 0;
  ryo = 0;
  dmgBy: Record<string, number> = {};
  hurtFlash = 0;
  banner: { text: string; life: number; sub?: string } | null = null;
  tint: { color: string; life: number; max: number } | null = null;

  /** Visible world size; set by the renderer on resize. */
  viewW = 960;
  viewH = 600;

  lookId: string;
  specials: SpecialPrompt[] = [];
  /** Bijū collected this run (0-9) and how many have been placed on the map. */
  biju = 0;
  bijuSpawned = 0;
  wishUsed = false;
  pillTime = 0;

  private near: Enemy[] = [];
  private xpGemCount = 0;
  private extraMods: StatMods[] = [];
  private xpMult: number;
  private nextTenten = TENTEN_EVERY;

  constructor(public input: Input, private cb: GameCallbacks, charId: CharacterId = 'naruto', private opts: RunOptions = {}) {
    this.char = CHARACTERS[charId];
    this.lookId = opts.lookId ?? charId;
    this.xpMult = opts.xpMult ?? 1;
    this.rerolls = opts.rerolls ?? 2;
    this.stats = this.computeStats();
    this.player.hp = this.stats.maxHp;
    this.addJutsu(this.char.start);
    if (opts.extraJutsu) {
      const others = this.char.pool.filter((j) => j !== this.char.start);
      this.addJutsu(others[Math.floor(Math.random() * others.length)]);
    }
    this.director.update(this);
  }

  get spawnRadius(): number {
    return Math.hypot(this.viewW, this.viewH) / 2 + 40;
  }

  get transform(): Transform | null {
    return this.form >= 0 ? this.char.transforms[this.form] : null;
  }

  setView(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  // ---------- progression ----------

  private computeStats(): Stats {
    const mods: StatMods[] = [this.char.mods];
    if (this.opts.mods) mods.push(this.opts.mods);
    for (let i = 0; i <= this.form; i++) mods.push(this.char.transforms[i].mods);
    mods.push(...this.extraMods);
    if (this.pillTime > 0) mods.push(PILL_MODS);
    const s = computeStats(this.passives, mods);
    s.xp *= this.xpMult;
    return s;
  }

  private refreshStats(): void {
    const oldMax = this.stats.maxHp;
    this.stats = this.computeStats();
    if (this.stats.maxHp > oldMax) this.player.hp += this.stats.maxHp - oldMax;
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
  }

  jutsuLevel(id: JutsuId): number {
    return this.weapons.find((w) => w.id === id)?.level ?? 0;
  }

  addJutsu(id: JutsuId): void {
    const existing = this.weapons.find((w) => w.id === id);
    if (existing) existing.level++;
    else this.weapons.push(JUTSUS[id].create());
  }

  evolve(id: JutsuId): void {
    const w = this.weapons.find((x) => x.id === id);
    if (!w) return;
    w.evolved = true;
    this.announce(`¡${JUTSUS[id].evolution.name}!`, 'Evolución de jutsu');
    this.effects.push({ kind: 'flash', x: 0, y: 0, r: 0, life: 0.4, max: 0.4, color: '255,255,255' });
  }

  addPassive(id: PassiveId): void {
    this.passives.set(id, (this.passives.get(id) ?? 0) + 1);
    this.refreshStats();
  }

  heal(amount: number): void {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(this.stats.maxHp, p.hp + amount);
    const healed = Math.round(p.hp - before);
    if (healed > 0) this.addText(p.x, p.y - 24, `+${healed}`, '#5cc96b');
  }

  addXp(v: number): void {
    this.xp += v * this.stats.xp;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpForLevel(this.level);
      this.pendingLevelUps++;
      this.checkTransform();
    }
  }

  private checkTransform(): void {
    const next = this.char.transforms[this.form + 1];
    if (!next || this.level < next.level) return;
    this.form++;
    this.refreshStats();
    this.heal(this.stats.maxHp * 0.3);
    this.announce(`¡${next.name}!`, next.desc);
    this.effects.push({ kind: 'flash', x: 0, y: 0, r: 0, life: 0.6, max: 0.6, color: '255,240,200' });
    // Burst that throws nearby enemies back.
    const p = this.player;
    for (const e of this.enemies) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 160) {
        e.kbx += (dx / d) * 500 * e.kbRes;
        e.kby += (dy / d) * 500 * e.kbRes;
      }
    }
    this.effects.push({ kind: 'ring', x: p.x, y: p.y, r: 160, life: 0.5, max: 0.5, color: next.aura });
  }

  /** The prompt the UI should show next: a special (shop, wish) before level-ups. */
  get currentSpecial(): SpecialPrompt | null {
    return this.specials[0] ?? null;
  }

  get hasPrompt(): boolean {
    return this.specials.length > 0 || this.pendingLevelUps > 0;
  }

  /** Called by the UI once a card has been applied. */
  finishLevelUp(): void {
    if (this.specials.length) this.specials.shift();
    else this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    if (this.hasPrompt) this.cb.onLevelUp();
    else this.state = 'play';
  }

  // ---------- bijū, Tenten, pills ----------

  private placeNear(kind: PickupKind, value: number, min: number, max: number): void {
    const a = Math.random() * Math.PI * 2;
    const d = min + Math.random() * (max - min);
    this.drop(kind, this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d, value);
  }

  private updateWorldEvents(): void {
    if (this.bijuSpawned < 9 && this.t >= BIJU_FIRST + this.bijuSpawned * BIJU_EVERY) {
      this.placeNear('biju', this.bijuSpawned + 1, 500, 750);
      this.bijuSpawned++;
      if (!this.banner) this.announce(`${BIJU_NAMES[this.bijuSpawned - 1]} ha aparecido`, 'Sigue la flecha naranja');
    }
    if (this.t >= this.nextTenten && this.t < FINAL_TIME) {
      this.nextTenten += TENTEN_EVERY;
      this.placeNear('tenten', 0, 300, 450);
      if (!this.banner) this.announce('La tienda de Tenten está cerca', 'Sigue la flecha verde');
    }
  }

  private collectBiju(n: number): void {
    this.biju++;
    this.announce(`¡${BIJU_NAMES[n - 1]}!`, `Bijū ${this.biju} de 9`);
    this.effects.push({ kind: 'ring', x: this.player.x, y: this.player.y, r: 90, life: 0.6, max: 0.6, color: '#ff8a3c' });
    if (this.biju >= 9 && !this.wishUsed) {
      this.wishUsed = true;
      this.specials.push({ title: '¡El Juubi te concede un deseo!', sub: 'Has reunido a los 9 bijū', choices: this.wishChoices() });
    }
  }

  private wishChoices(): Choice[] {
    const mk = (key: string, title: string, desc: string, icon: string, color: string, apply: (g: Game) => void): Choice => ({ key, title, tag: 'Deseo', isNew: true, desc, icon, color, weight: 1, apply });
    return [
      mk('w:vida', 'Vida del Juubi', 'Te cura por completo, +50 de vida máxima y +1 vida/s.', '命', '#5cc96b', (g) => {
        g.extraMods.push({ maxHp: 50, regen: 1 });
        g.refreshStats();
        g.heal(g.stats.maxHp);
      }),
      mk('w:poder', 'Poder del Juubi', 'Todos tus jutsus suben un nivel y +20% de daño.', '力', '#ff8a3c', (g) => {
        for (const w of g.weapons) if (w.level < 5) w.level++;
        g.extraMods.push({ dmg: 1.2 });
        g.refreshStats();
      }),
      mk('w:bijudama', 'Bijūdama', 'Arrasa a todos los enemigos de la pantalla; los jefes pierden un 15% de vida.', '玉', '#b48cff', (g) => {
        const p = g.player;
        for (const e of g.enemies) {
          if (e.dead || Math.abs(e.x - p.x) > g.viewW / 2 + 40 || Math.abs(e.y - p.y) > g.viewH / 2 + 40) continue;
          if (e.boss) g.hit(e, e.maxHp * 0.15, 0, 0, 'bijudama');
          else g.hit(e, e.hp + 1, 0, 0, 'bijudama');
        }
        g.effects.push({ kind: 'flash', x: 0, y: 0, r: 0, life: 0.8, max: 0.8, color: '180,140,255' });
      }),
    ];
  }

  private tentenChoices(): Choice[] {
    const items: Choice[] = [
      { key: 't:pill', title: 'Píldoras de soldado', tag: 'Tienda de Tenten', isNew: true, desc: `+30% de daño y +20% de velocidad durante ${PILL_TIME * 2} s.`, icon: '丸', color: '#e5534b', weight: 1, apply: (g) => g.takePill(PILL_TIME * 2) },
      { key: 't:ramen', title: 'Ramen completo', tag: 'Tienda de Tenten', isNew: true, desc: 'Recupera toda la vida.', icon: '麺', color: '#ffb347', weight: 1, apply: (g) => g.heal(g.stats.maxHp) },
      { key: 't:scroll', title: 'Pergamino de sellado', tag: 'Tienda de Tenten', isNew: true, desc: '+2 cambios de cartas.', icon: '巻', color: '#e9d8a6', weight: 1, apply: (g) => { g.rerolls += 2; } },
    ];
    const item = items[Math.floor(Math.random() * items.length)];
    const rolled = rollChoices(this).filter((c) => !c.key.startsWith('f:')).slice(0, 2);
    return [...rolled.map((c) => ({ ...c, tag: `Regalo · ${c.tag}` })), item];
  }

  takePill(seconds: number): void {
    const had = this.pillTime > 0;
    this.pillTime = Math.max(this.pillTime, seconds);
    if (!had) this.refreshStats();
    this.announce('¡Píldora de soldado!', '+30% de daño y +20% de velocidad');
  }

  summary(win: boolean): RunSummary {
    return {
      char: this.char.id,
      win,
      time: this.t,
      level: this.level,
      kills: this.kills,
      bosses: [...this.bossesDefeated],
      form: this.form,
      finalForm: this.form >= 0 && this.form === this.char.transforms.length - 1,
      evolutions: this.weapons.filter((w) => w.evolved).map((w) => w.id),
      biju: this.biju,
      wish: this.wishUsed,
      ryo: this.ryo,
    };
  }

  announce(text: string, sub?: string): void {
    this.banner = { text, sub, life: 2.8 };
  }

  enterArc(arc: Arc, travel: boolean): void {
    this.scene = arc.scene;
    this.arcName = arc.name;
    this.announce(arc.name, travel ? 'Nuevo arco' : 'Sobrevive');
    if (travel) this.effects.push({ kind: 'flash', x: 0, y: 0, r: 0, life: 0.8, max: 0.8, color: '0,0,0' });
  }

  // ---------- spawning ----------

  spawnEnemy(kind: MinionKind, x: number, y: number): void {
    const d = ENEMIES[kind];
    const minutes = this.t / 60;
    const hp = d.hp * (1 + minutes * 0.25 + minutes * minutes * 0.03);
    const natures = this.director.arc.natures;
    this.enemies.push({
      kind,
      nature: natures[Math.floor(Math.random() * natures.length)],
      x,
      y,
      hp,
      maxHp: hp,
      r: d.r,
      speed: d.speed * (1 + Math.min(0.25, minutes * 0.02)),
      dmg: d.dmg * (1 + minutes * 0.15),
      xp: d.xp,
      kbRes: d.kbRes,
      dmgTaken: 1,
      flash: 0,
      kbx: 0,
      kby: 0,
      dead: false,
      boss: null,
    });
  }

  spawnBoss(id: BossId, index = 0, count = 1): void {
    const d = BOSSES[id];
    const a = (index / count) * Math.PI * 2 - Math.PI / 2;
    const r = this.spawnRadius * 0.85;
    this.enemies.push({
      kind: 'boss',
      nature: d.hearts ? d.hearts[0] : d.nature,
      x: this.player.x + Math.cos(a) * r,
      y: this.player.y + Math.sin(a) * r,
      hp: d.hp,
      maxHp: d.hp,
      r: d.r,
      speed: d.speed,
      dmg: d.dmg,
      xp: 0,
      kbRes: 0.05,
      dmgTaken: 1,
      flash: 0,
      kbx: 0,
      kby: 0,
      dead: false,
      vx: 0,
      vy: 0,
      boss: { id, name: d.name, lookId: d.lookId, brain: d.brain(), hearts: d.hearts, final: d.final },
    });
    if (index === 0) this.announce(count > 1 ? `¡${count} enemigos poderosos!` : `¡${d.name}!`, count > 1 ? d.name.split(' ')[0] === 'Camino' ? 'Los Seis Caminos de Pain' : 'Llegan los jefes' : 'Ha aparecido un jefe');
  }

  /** Enemy bullet toward an angle. */
  bullet(x: number, y: number, angle: number, speed: number, dmg: number, color: string, extra: { homing?: number; burst?: number; life?: number; r?: number } = {}): void {
    this.hazards.push({
      kind: 'bullet',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: extra.r ?? 6,
      dmg,
      life: extra.life ?? 3,
      color,
      dead: false,
      homing: extra.homing,
      burst: extra.burst,
    });
  }

  /** Telegraphed ground attack: fills up for `delay` seconds, then hits whoever stands inside. */
  zone(x: number, y: number, r: number, delay: number, dmg: number, color: string, extra: { linger?: number; push?: number } = {}): void {
    this.hazards.push({ kind: 'zone', x, y, vx: 0, vy: 0, r, dmg, life: delay + (extra.linger ?? 0), color, dead: false, delay, maxDelay: delay, ...extra });
  }

  puff(x: number, y: number, color = '#ddd', r = 24): void {
    this.effects.push({ kind: 'puff', x, y, r, life: 0.35, max: 0.35, color });
  }

  /** Jagged lightning line effect. */
  bolt(x1: number, y1: number, x2: number, y2: number, color: string, width = 2): void {
    const pts = [x1, y1];
    const segs = Math.max(3, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 18));
    for (let i = 1; i < segs; i++) {
      const k = i / segs;
      pts.push(x1 + (x2 - x1) * k + (Math.random() - 0.5) * 14, y1 + (y2 - y1) * k + (Math.random() - 0.5) * 14);
    }
    pts.push(x2, y2);
    this.effects.push({ kind: 'bolt', x: x1, y: y1, r: width, life: 0.18, max: 0.18, color, pts });
  }

  // ---------- queries ----------

  nearestEnemy(x: number, y: number, maxDist: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxDist * maxDist;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  randomVisibleEnemy(): Enemy | null {
    const p = this.player;
    const hw = this.viewW / 2;
    const hh = this.viewH / 2;
    const vis = this.enemies.filter((e) => !e.dead && Math.abs(e.x - p.x) < hw && Math.abs(e.y - p.y) < hh);
    return vis.length ? vis[Math.floor(Math.random() * vis.length)] : null;
  }

  enemiesInRadius(x: number, y: number, r: number): Enemy[] {
    this.near.length = 0;
    const out: Enemy[] = [];
    // Bosses are large; widen the broad phase so they aren't missed.
    for (const e of this.hash.query(x, y, r + 30, this.near)) {
      if (e.dead) continue;
      const rr = r + e.r;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 <= rr * rr) out.push(e);
    }
    return out;
  }

  enemiesOnSegment(x1: number, y1: number, x2: number, y2: number, width: number): Enemy[] {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    return this.enemies.filter((e) => {
      if (e.dead) return false;
      const k = Math.max(0, Math.min(1, ((e.x - x1) * dx + (e.y - y1) * dy) / len2));
      const px = x1 + dx * k - e.x;
      const py = y1 + dy * k - e.y;
      const rr = width + e.r;
      return px * px + py * py <= rr * rr;
    });
  }

  // ---------- combat ----------

  hit(e: Enemy, dmg: number, kx: number, ky: number, src: string): void {
    if (e.dead) return;
    const nature: Nature = JUTSUS[src as JutsuId]?.nature ?? 'neutral';
    const aff = affinity(nature, e.nature);
    const crit = Math.random() < this.stats.crit;
    const amount = Math.max(1, Math.round(dmg * aff * e.dmgTaken * (crit ? CRIT_MULT : 1)));
    e.hp -= amount;
    e.flash = 0.1;
    e.kbx += kx * e.kbRes;
    e.kby += ky * e.kbRes;
    this.dmgBy[src] = (this.dmgBy[src] ?? 0) + amount;
    const color = crit ? '#ffd23f' : aff > 1 ? '#ff9a3c' : aff < 1 ? '#8a94a6' : '#fff';
    this.addText(e.x, e.y - e.r, crit ? `${amount}!` : String(amount), color, crit || aff > 1);
    if (e.hp <= 0) this.kill(e);
  }

  explode(x: number, y: number, r: number, dmg: number, src: string, color = '#ff8a3c'): void {
    for (const e of this.enemiesInRadius(x, y, r)) {
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy) || 1;
      this.hit(e, dmg, (dx / d) * 220, (dy / d) * 220, src);
    }
    this.effects.push({ kind: 'boom', x, y, r, life: 0.35, max: 0.35, color });
  }

  /** Who dealt the last hit (shown in the dev sim). */
  lastHitBy = '';

  hurtPlayer(dmg: number, src = 'ataque'): void {
    const p = this.player;
    if (p.invuln > 0 || dmg <= 0) return;
    this.lastHitBy = src;
    const amount = dmg * (1 - this.stats.armor);
    p.hp -= amount;
    p.invuln = 0.45;
    this.hurtFlash = 0.2;
    this.addText(p.x, p.y - 20, `-${Math.round(amount)}`, '#ff5a5a');
  }

  private kill(e: Enemy): void {
    e.dead = true;
    this.kills++;
    this.puff(e.x, e.y, '#ddd', e.r * 1.4);
    if (e.boss) {
      this.killBoss(e);
      return;
    }
    this.dropXp(e.x, e.y, e.xp);
    const def = ENEMIES[e.kind as MinionKind];
    const roll = Math.random();
    if (roll < def.ryoChance) this.drop('ryo', e.x + 6, e.y, 1 + Math.floor(Math.random() * 3));
    else if (roll < def.ryoChance + 0.008) this.drop('ramen', e.x + 6, e.y, 0.3);
    else if (roll < def.ryoChance + 0.011) this.drop('scroll', e.x + 6, e.y, 0);
    else if (roll < def.ryoChance + 0.013) this.drop('pill', e.x + 6, e.y, 0);
  }

  private killBoss(e: Enemy): void {
    const b = e.boss!;
    if (!this.bossesDefeated.includes(b.id)) this.bossesDefeated.push(b.id);
    this.effects.push({ kind: 'boom', x: e.x, y: e.y, r: 120, life: 0.6, max: 0.6, color: '#ffd23f' });
    this.drop('chest', e.x, e.y, 3);
    this.drop('xp', e.x + 20, e.y, 25);
    for (let i = 0; i < 6; i++) this.drop('ryo', e.x + (Math.random() - 0.5) * 60, e.y + (Math.random() - 0.5) * 60, 4);
    this.announce(`¡${b.name} derrotado!`, 'Recoge el cofre');
    if (b.final) {
      this.state = 'over';
      this.cb.onGameOver(true);
    }
  }

  private dropXp(x: number, y: number, value: number): void {
    if (this.xpGemCount >= MAX_XP_GEMS) {
      // Too many gems lying around: fold the value into an existing one.
      const gems = this.pickups.filter((p) => p.kind === 'xp' && !p.dead);
      if (gems.length) {
        gems[Math.floor(Math.random() * gems.length)].value += value;
        return;
      }
    }
    this.drop('xp', x, y, value);
    this.xpGemCount++;
  }

  private drop(kind: PickupKind, x: number, y: number, value: number): void {
    this.pickups.push({ kind, x, y, value, attracted: false, speed: 0, dead: false });
  }

  addText(x: number, y: number, text: string, color: string, big = false): void {
    if (this.texts.length >= MAX_TEXTS) return;
    this.texts.push({ x: x + (Math.random() - 0.5) * 8, y, text, life: 0.6, color, big });
  }

  /** Golden chest: several free upgrades, evolutions first. */
  private openChest(count: number): void {
    const got: string[] = [];
    for (let i = 0; i < count; i++) {
      const options = rollChoices(this);
      const pick = options.find((c) => c.tag === 'Evolución') ?? options[0];
      pick.apply(this);
      got.push(pick.title);
    }
    this.announce('¡Cofre dorado!', got.join(' · '));
  }

  // ---------- update ----------

  update(dt: number): void {
    if (this.state !== 'play') return;
    this.t += dt;
    const p = this.player;
    const s = this.stats;

    this.director.update(this);
    this.updateWorldEvents();
    if (this.pillTime > 0) {
      this.pillTime -= dt;
      if (this.pillTime <= 0) this.refreshStats();
    }

    const ax = this.input.axis();
    p.moving = ax.x !== 0 || ax.y !== 0;
    const slowMul = p.slow > 0 ? 0.5 : 1;
    if (p.moving) {
      p.x += ax.x * BASE_SPEED * s.speed * slowMul * dt;
      p.y += ax.y * BASE_SPEED * s.speed * slowMul * dt;
      const l = Math.hypot(ax.x, ax.y);
      p.facingX = ax.x / l;
      p.facingY = ax.y / l;
      p.anim += dt;
    }
    p.x += p.kbx * dt;
    p.y += p.kby * dt;
    const decay = Math.exp(-6 * dt);
    p.kbx *= decay;
    p.kby *= decay;
    if (p.slow > 0) p.slow -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.tint) {
      this.tint.life -= dt;
      if (this.tint.life <= 0) this.tint = null;
    }
    if (s.regen > 0) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);

    this.spawner.update(this, dt);

    this.hash.clear();
    for (const e of this.enemies) if (!e.dead) this.hash.insert(e);

    this.updateEnemies(dt);
    for (const w of this.weapons) w.update(this, dt);
    this.updateProjectiles(dt);
    this.updateFields(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);

    for (const fx of this.effects) fx.life -= dt;
    this.effects = this.effects.filter((fx) => fx.life > 0);
    for (const tx of this.texts) {
      tx.life -= dt;
      tx.y -= 30 * dt;
    }
    this.texts = this.texts.filter((tx) => tx.life > 0);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }

    compact(this.enemies);
    compact(this.projectiles);
    compact(this.hazards);
    compact(this.fields);
    compact(this.pickups);

    if (this.state !== 'play') return; // final boss died this frame
    if (p.hp <= 0) {
      p.hp = 0;
      this.state = 'over';
      this.cb.onGameOver(false);
      return;
    }
    if (this.hasPrompt) {
      this.state = 'levelup';
      this.cb.onLevelUp();
    }
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const far = this.spawnRadius * 1.5;
    const decay = Math.exp(-10 * dt);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      if (e.boss) {
        e.boss.brain.update(this, e, dt);
        // Bosses never despawn; pull them back in if the player outran them.
        if (d > far) {
          e.x = p.x - (dx / d) * this.spawnRadius;
          e.y = p.y - (dy / d) * this.spawnRadius;
        }
      } else if (d > far) {
        // Left far behind: move it back in front of the player to keep the pressure up.
        e.x = p.x + (dx / d) * this.spawnRadius;
        e.y = p.y + (dy / d) * this.spawnRadius;
        continue;
      }

      let vx = e.boss ? e.vx ?? 0 : (dx / d) * e.speed;
      let vy = e.boss ? e.vy ?? 0 : (dy / d) * e.speed;

      if (!e.boss) {
        // Cheap separation so the horde doesn't collapse into one point.
        this.near.length = 0;
        this.hash.query(e.x, e.y, e.r * 2, this.near);
        let sx = 0;
        let sy = 0;
        for (const o of this.near) {
          if (o === e || o.dead) continue;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const min = e.r + o.r;
          const od2 = ox * ox + oy * oy;
          if (od2 < min * min && od2 > 0.01) {
            const od = Math.sqrt(od2);
            const push = (min - od) / min;
            sx += (ox / od) * push;
            sy += (oy / od) * push;
          }
        }
        vx += sx * 70;
        vy += sy * 70;
      }

      e.x += (vx + e.kbx) * dt;
      e.y += (vy + e.kby) * dt;
      e.kbx *= decay;
      e.kby *= decay;
      if (e.flash > 0) e.flash -= dt;

      if (d < e.r + p.r) this.hurtPlayer(e.dmg, e.boss ? e.boss.name : e.kind);
    }
  }

  private updateProjectiles(dt: number): void {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life > 0) {
        for (const e of this.enemiesInRadius(pr.x, pr.y, pr.r)) {
          const next = pr.hits.get(e) ?? -1;
          if (next > this.t) continue;
          pr.hits.set(e, this.t + pr.rehit);
          const sp = Math.hypot(pr.vx, pr.vy) || 1;
          this.hit(e, pr.dmg, (pr.vx / sp) * pr.knock, (pr.vy / sp) * pr.knock, pr.src);
          if (--pr.pierce <= 0) break;
        }
      }
      if (pr.life <= 0 || pr.pierce <= 0) {
        pr.dead = true;
        pr.onEnd?.(pr);
      }
    }
  }

  private updateFields(dt: number): void {
    for (const f of this.fields) {
      f.life -= dt;
      f.timer -= dt;
      if (f.timer <= 0) {
        f.timer = f.tick;
        for (const e of this.enemiesInRadius(f.x, f.y, f.r)) this.hit(e, f.dmg, 0, 0, f.src);
      }
      if (f.life <= 0) f.dead = true;
    }
  }

  private updateHazards(dt: number): void {
    const p = this.player;
    for (const h of this.hazards) {
      h.life -= dt;
      if (h.kind === 'bullet') {
        if (h.homing) {
          const want = Math.atan2(p.y - h.y, p.x - h.x);
          const cur = Math.atan2(h.vy, h.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = Math.max(-h.homing * dt, Math.min(h.homing * dt, diff));
          const sp = Math.hypot(h.vx, h.vy);
          h.vx = Math.cos(cur + turn) * sp;
          h.vy = Math.sin(cur + turn) * sp;
        }
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        // Bursting bullets (clay birds) stop short of the player and leave a dodgeable telegraph.
        const reach = h.burst ? h.burst * 0.6 : h.r + p.r;
        const touching = Math.hypot(p.x - h.x, p.y - h.y) < reach;
        if (touching && !h.burst) this.hurtPlayer(h.dmg, 'bala');
        if (touching || h.life <= 0) {
          h.dead = true;
          if (h.burst) this.zone(h.x, h.y, h.burst, 0.55, 12, '#f0e6d2');
        }
        continue;
      }
      // zone
      const inside = Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r * 0.5;
      if (h.delay! > 0) {
        h.delay! -= dt;
        if (h.delay! <= 0) {
          if (h.dmg > 0) {
            this.effects.push({ kind: 'boom', x: h.x, y: h.y, r: h.r, life: 0.3, max: 0.3, color: h.color });
            if (inside) {
              this.hurtPlayer(h.dmg, 'zona');
              if (h.push) {
                const dx = p.x - h.x;
                const dy = p.y - h.y;
                const d = Math.hypot(dx, dy) || 1;
                p.kbx += (dx / d) * h.push;
                p.kby += (dy / d) * h.push;
              }
            }
          }
          if (!h.linger) h.dead = true;
        }
      } else if (h.linger && inside) {
        this.hurtPlayer(h.dmg, 'fuego');
      }
      if (h.life <= 0) h.dead = true;
    }
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    const mag = this.stats.magnet;
    let gems = 0;
    for (const pk of this.pickups) {
      if (pk.dead) continue;
      if (pk.kind === 'xp') gems++;
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      if (!pk.attracted && d < mag) pk.attracted = true;
      if (pk.attracted) {
        pk.speed += 900 * dt;
        const step = Math.min(d, (220 + pk.speed) * dt);
        pk.x += (dx / d) * step;
        pk.y += (dy / d) * step;
      }
      if (d < p.r + 8) {
        pk.dead = true;
        this.collect(pk);
      }
    }
    this.xpGemCount = gems;
  }

  private collect(pk: Pickup): void {
    switch (pk.kind) {
      case 'xp':
        this.addXp(pk.value);
        break;
      case 'ryo':
        this.ryo += pk.value;
        this.addText(this.player.x, this.player.y - 24, `+${pk.value} ryō`, '#ffd23f');
        break;
      case 'ramen':
        this.heal(this.stats.maxHp * pk.value);
        break;
      case 'scroll':
        for (const o of this.pickups) if (o.kind === 'xp') o.attracted = true;
        this.announce('¡Pergamino de invocación!');
        break;
      case 'chest':
        this.openChest(pk.value);
        break;
      case 'biju':
        this.collectBiju(pk.value);
        break;
      case 'tenten':
        this.specials.push({ title: 'Tienda de Tenten', sub: 'Elige un regalo', choices: this.tentenChoices() });
        break;
      case 'pill':
        this.takePill(PILL_TIME);
        break;
    }
  }
}
