import { SpatialHash } from '../core/spatialHash';
import { BOSSES, type BossId } from './bosses';
import type { CharacterDef, CharacterId, StatMods, Transform } from './characters';
import { ENEMIES, type MinionKind } from './enemies';
import { Hero, type Controller, type RunOptions, type SpecialPrompt } from './hero';
import { JUTSUS, type JutsuId, type Weapon } from './jutsus';
import { rollChoices, type Choice } from './levelup';
import { affinity, type Nature } from './natures';
import type { PassiveId } from './passives';
import { Spawner } from './spawner';
import { Director, type Arc, type SceneId } from './timeline';
import type { RunSummary } from '../meta/summary';
import type { Effect, Enemy, Field, FloatText, Hazard, Pickup, PickupKind, Player, Projectile, Stats } from './types';

export type { RunOptions, SpecialPrompt } from './hero';

/** Madara arrives at 20:00; beating him wins the run. */
export const FINAL_TIME = 20 * 60;
const BASE_SPEED = 135;
const MAX_TEXTS = 120;
const MAX_XP_GEMS = 300;
const CRIT_MULT = 1.5;
const REVIVE_TIME = 5;
const REVIVE_RANGE = 45;

export const BIJU_NAMES = ['Shukaku', 'Matatabi', 'Isobu', 'Son Gokū', 'Kokuō', 'Saiken', 'Chōmei', 'Gyūki', 'Kurama'];
const BIJU_FIRST = 60;
const BIJU_EVERY = 115;
const TENTEN_EVERY = 240;
const PILL_TIME = 12;

export type GameState = 'play' | 'levelup' | 'paused' | 'over';

export interface GameCallbacks {
  onLevelUp(): void;
  onGameOver(win: boolean): void;
}

export interface HeroSpec {
  name: string;
  charId: CharacterId;
  input: Controller;
  opts?: RunOptions;
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

/**
 * The run simulation. Works for one hero (solo) or up to four (co-op, run on the server).
 *
 * Per-hero code (jutsus, level-up cards, pickups, boss targeting) runs with `actor` set to
 * the hero involved; `player`, `stats`, `weapons`… read from the actor. Outside update(),
 * the actor is the local hero, so the UI can read those accessors directly.
 */
export class Game {
  t = 0;
  state: GameState = 'play';
  heroes: Hero[];
  actor: Hero;
  /** Hero shown by this client (0 in solo). */
  localIndex = 0;

  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  hazards: Hazard[] = [];
  fields: Field[] = [];
  pickups: Pickup[] = [];
  effects: Effect[] = [];
  texts: FloatText[] = [];
  hash = new SpatialHash<Enemy>(64);
  spawner = new Spawner();
  director = new Director();

  scene: SceneId = 'desierto';
  arcName = '';
  bossesDefeated: string[] = [];

  level = 1;
  xp = 0;
  xpNext = xpForLevel(1);
  kills = 0;
  ryo = 0;
  banner: { text: string; life: number; sub?: string } | null = null;
  tint: { color: string; life: number; max: number } | null = null;

  /** Bijū collected this run (0-9) and how many have been placed on the map. */
  biju = 0;
  bijuSpawned = 0;
  wishUsed = false;

  /** Visible world size; set by the renderer on resize. */
  viewW = 960;
  viewH = 600;

  private near: Enemy[] = [];
  private xpGemCount = 0;
  private nextTenten = TENTEN_EVERY;
  private nextEnemyId = 1;

  constructor(private cb: GameCallbacks, specs: HeroSpec[]) {
    this.heroes = specs.map((s, i) => new Hero(i, s.name, s.charId, s.input, s.opts));
    // Spread co-op heroes a little so they don't start stacked.
    this.heroes.forEach((h, i) => {
      if (i > 0) {
        h.body.x = Math.cos(i * 2) * 40;
        h.body.y = Math.sin(i * 2) * 40;
      }
    });
    this.actor = this.heroes[0];
    this.director.update(this);
  }

  /** Someone joins a run in progress: they arrive at the team's level with automatic picks. */
  addHero(spec: HeroSpec): Hero {
    const h = new Hero(this.heroes.length, spec.name, spec.charId, spec.input, spec.opts);
    const anchor = (this.aliveHeroes[0] ?? this.heroes[0]).body;
    h.body.x = anchor.x + 30;
    h.body.y = anchor.y;
    h.body.invuln = 2;
    this.heroes.push(h);
    this.withActor(h, () => {
      for (let i = 1; i < this.level; i++) {
        const o = rollChoices(this);
        (o.find((c) => c.tag === 'Evolución') ?? o[0]).apply(this);
      }
      for (let i = 0; i < h.char.transforms.length; i++) this.checkTransform();
      h.body.hp = h.stats.maxHp;
    });
    this.announce(`¡${h.name} se une a la partida!`);
    return h;
  }

  // ---------- acting-hero accessors (used by jutsus, cards and the UI) ----------

  get local(): Hero {
    return this.heroes[this.localIndex];
  }
  get player(): Player {
    return this.actor.body;
  }
  get stats(): Stats {
    return this.actor.stats;
  }
  get weapons(): Weapon[] {
    return this.actor.weapons;
  }
  get passives(): Map<PassiveId, number> {
    return this.actor.passives;
  }
  get char(): CharacterDef {
    return this.actor.char;
  }
  get transform(): Transform | null {
    return this.actor.transform;
  }
  get lookId(): string {
    return this.actor.lookId;
  }
  get pillTime(): number {
    return this.actor.pillTime;
  }
  get dmgBy(): Record<string, number> {
    return this.actor.dmgBy;
  }
  get rerolls(): number {
    return this.actor.rerolls;
  }
  set rerolls(v: number) {
    this.actor.rerolls = v;
  }
  get pendingLevelUps(): number {
    return this.actor.pendingLevelUps;
  }
  set pendingLevelUps(v: number) {
    this.actor.pendingLevelUps = v;
  }
  get specials(): SpecialPrompt[] {
    return this.actor.specials;
  }
  get currentSpecial(): SpecialPrompt | null {
    return this.actor.specials[0] ?? null;
  }
  get hasPrompt(): boolean {
    return this.actor.hasPrompt;
  }
  get hurtFlash(): number {
    return this.actor.hurtFlash;
  }
  get lastHitBy(): string {
    return this.actor.lastHitBy;
  }

  get aliveHeroes(): Hero[] {
    return this.heroes.filter((h) => h.alive);
  }

  get anyPrompt(): boolean {
    return this.heroes.some((h) => h.hasPrompt);
  }

  /** Co-op scaling: more players, tougher enemies. */
  get partyScale(): number {
    return this.heroes.length - 1;
  }

  get spawnRadius(): number {
    return Math.hypot(this.viewW, this.viewH) / 2 + 40;
  }

  setView(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  nearestHero(x: number, y: number): Hero {
    let best = this.heroes[0];
    let bestD = Infinity;
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const d = (h.body.x - x) ** 2 + (h.body.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  /** Runs `fn` as hero `h`, tagging any projectile or field it creates as theirs. */
  withActor(h: Hero, fn: () => void): void {
    const prev = this.actor;
    this.actor = h;
    const np = this.projectiles.length;
    const nf = this.fields.length;
    fn();
    for (let i = np; i < this.projectiles.length; i++) this.projectiles[i].owner ??= h;
    for (let i = nf; i < this.fields.length; i++) this.fields[i].owner ??= h;
    this.actor = prev;
  }

  // ---------- progression (acts on the actor) ----------

  jutsuLevel(id: JutsuId): number {
    return this.actor.weapons.find((w) => w.id === id)?.level ?? 0;
  }

  addJutsu(id: JutsuId): void {
    this.actor.addJutsu(id);
  }

  evolve(id: JutsuId): void {
    const w = this.actor.weapons.find((x) => x.id === id);
    if (!w) return;
    w.evolved = true;
    this.announce(`¡${JUTSUS[id].evolution.name}!`, this.heroes.length > 1 ? `${this.actor.name}: evolución de jutsu` : 'Evolución de jutsu');
    this.effects.push({ kind: 'flash', x: 0, y: 0, r: 0, life: 0.4, max: 0.4, color: '255,255,255' });
  }

  addPassive(id: PassiveId): void {
    this.actor.passives.set(id, (this.actor.passives.get(id) ?? 0) + 1);
    this.actor.refreshStats();
  }

  heal(amount: number): void {
    const p = this.actor.body;
    if (this.actor.downed) return;
    const before = p.hp;
    p.hp = Math.min(this.actor.stats.maxHp, p.hp + amount);
    const healed = Math.round(p.hp - before);
    if (healed > 0) this.addText(p.x, p.y - 24, `+${healed}`, '#5cc96b');
  }

  /** Shared team XP; every hero gets a level-up card. */
  addXp(v: number): void {
    this.xp += v * this.actor.stats.xp;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpForLevel(this.level);
      for (const h of this.heroes) {
        h.pendingLevelUps++;
        this.withActor(h, () => this.checkTransform());
      }
    }
  }

  private checkTransform(): void {
    const h = this.actor;
    const next = h.char.transforms[h.form + 1];
    if (!next || this.level < next.level) return;
    h.form++;
    h.refreshStats();
    this.heal(h.stats.maxHp * 0.3);
    this.announce(`¡${next.name}!`, this.heroes.length > 1 ? `${h.name}: ${next.desc}` : next.desc);
    this.effects.push({ kind: 'flash', x: 0, y: 0, r: 0, life: 0.6, max: 0.6, color: '255,240,200' });
    // Burst that throws nearby enemies back.
    const p = h.body;
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

  /** Called once a card has been applied for the actor (the local hero in solo). */
  finishLevelUp(): void {
    const h = this.actor;
    if (h.specials.length) h.specials.shift();
    else h.pendingLevelUps = Math.max(0, h.pendingLevelUps - 1);
    if (h.hasPrompt) this.cb.onLevelUp();
    else if (!this.anyPrompt) this.state = 'play';
  }

  /** Applies choice `c` for hero `h` (network play). */
  applyChoice(h: Hero, c: Choice): void {
    this.withActor(h, () => c.apply(this));
    if (h.specials.length) h.specials.shift();
    else h.pendingLevelUps = Math.max(0, h.pendingLevelUps - 1);
    if (!this.anyPrompt && this.state === 'levelup') this.state = 'play';
  }

  // ---------- bijū, Tenten, pills ----------

  private placeNear(kind: PickupKind, value: number, min: number, max: number): void {
    const h = this.aliveHeroes[Math.floor(Math.random() * this.aliveHeroes.length)] ?? this.heroes[0];
    const a = Math.random() * Math.PI * 2;
    const d = min + Math.random() * (max - min);
    this.drop(kind, h.body.x + Math.cos(a) * d, h.body.y + Math.sin(a) * d, value);
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
      this.actor.specials.push({ title: '¡El Juubi te concede un deseo!', sub: 'Has reunido a los 9 bijū', choices: this.wishChoices() });
    }
  }

  private wishChoices(): Choice[] {
    const mk = (key: string, title: string, desc: string, icon: string, color: string, apply: (g: Game) => void): Choice => ({ key, title, tag: 'Deseo', isNew: true, desc, icon, color, weight: 1, apply });
    return [
      mk('w:vida', 'Vida del Juubi', 'Te cura por completo, +50 de vida máxima y +1 vida/s.', '命', '#5cc96b', (g) => {
        g.actor.extraMods.push({ maxHp: 50, regen: 1 });
        g.actor.refreshStats();
        g.heal(g.stats.maxHp);
      }),
      mk('w:poder', 'Poder del Juubi', 'Todos tus jutsus suben un nivel y +20% de daño.', '力', '#ff8a3c', (g) => {
        for (const w of g.weapons) if (w.level < 5) w.level++;
        g.actor.extraMods.push({ dmg: 1.2 });
        g.actor.refreshStats();
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
    const h = this.actor;
    const had = h.pillTime > 0;
    h.pillTime = Math.max(h.pillTime, seconds);
    if (!had) h.refreshStats();
    this.announce('¡Píldora de soldado!', '+30% de daño y +20% de velocidad');
  }

  summary(win: boolean, h: Hero = this.local): RunSummary {
    return {
      char: h.char.id,
      win,
      time: this.t,
      level: this.level,
      kills: this.kills,
      bosses: [...this.bossesDefeated],
      form: h.form,
      finalForm: h.form >= 0 && h.form === h.char.transforms.length - 1,
      evolutions: h.weapons.filter((w) => w.evolved).map((w) => w.id),
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

  /** A point on the spawn ring around a random living hero. */
  spawnPoint(radiusMul = 1): { x: number; y: number } {
    const alive = this.aliveHeroes;
    const h = alive[Math.floor(Math.random() * alive.length)] ?? this.heroes[0];
    const a = Math.random() * Math.PI * 2;
    return { x: h.body.x + Math.cos(a) * this.spawnRadius * radiusMul, y: h.body.y + Math.sin(a) * this.spawnRadius * radiusMul };
  }

  spawnEnemy(kind: MinionKind, x: number, y: number): void {
    const d = ENEMIES[kind];
    const minutes = this.t / 60;
    const hp = d.hp * (1 + minutes * 0.25 + minutes * minutes * 0.03) * (1 + 0.5 * this.partyScale);
    const natures = this.director.arc.natures;
    this.enemies.push({
      id: this.nextEnemyId++,
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
    const anchor = this.aliveHeroes[0] ?? this.heroes[0];
    const hp = d.hp * (1 + 0.6 * this.partyScale);
    this.enemies.push({
      id: this.nextEnemyId++,
      kind: 'boss',
      nature: d.hearts ? d.hearts[0] : d.nature,
      x: anchor.body.x + Math.cos(a) * r,
      y: anchor.body.y + Math.sin(a) * r,
      hp,
      maxHp: hp,
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
    if (index === 0) this.announce(count > 1 ? `¡${count} enemigos poderosos!` : `¡${d.name}!`, count > 1 ? (d.name.split(' ')[0] === 'Camino' ? 'Los Seis Caminos de Pain' : 'Llegan los jefes') : 'Ha aparecido un jefe');
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

  /** Damage from the actor's jutsu `src`, with nature affinity and the actor's crit chance. */
  hit(e: Enemy, dmg: number, kx: number, ky: number, src: string): void {
    if (e.dead) return;
    const nature: Nature = JUTSUS[src as JutsuId]?.nature ?? 'neutral';
    const aff = affinity(nature, e.nature);
    const crit = Math.random() < this.actor.stats.crit;
    const amount = Math.max(1, Math.round(dmg * aff * e.dmgTaken * (crit ? CRIT_MULT : 1)));
    e.hp -= amount;
    e.flash = 0.1;
    e.kbx += kx * e.kbRes;
    e.kby += ky * e.kbRes;
    this.actor.dmgBy[src] = (this.actor.dmgBy[src] ?? 0) + amount;
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

  hurtHero(h: Hero, dmg: number, src = 'ataque'): void {
    const p = h.body;
    if (h.downed || p.invuln > 0 || dmg <= 0) return;
    h.lastHitBy = src;
    const amount = dmg * (1 - h.stats.armor);
    p.hp -= amount;
    p.invuln = 0.45;
    h.hurtFlash = 0.2;
    this.addText(p.x, p.y - 20, `-${Math.round(amount)}`, '#ff5a5a');
    if (p.hp <= 0) {
      p.hp = 0;
      h.downed = true;
      h.revive = 0;
      if (this.heroes.length > 1 && this.aliveHeroes.length) this.announce(`¡${h.name} ha caído!`, 'Quédate a su lado para revivirle');
    }
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
    if (b.final) this.finish(true);
  }

  private finish(win: boolean): void {
    if (this.state === 'over') return;
    this.state = 'over';
    this.cb.onGameOver(win);
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

  /** Golden chest: several free upgrades for every living hero, evolutions first. */
  private openChest(count: number): void {
    const got: string[] = [];
    for (const h of this.aliveHeroes) {
      this.withActor(h, () => {
        for (let i = 0; i < count; i++) {
          const options = rollChoices(this);
          const pick = options.find((c) => c.tag === 'Evolución') ?? options[0];
          pick.apply(this);
          if (h === this.local || this.heroes.length === 1) got.push(pick.title);
        }
      });
    }
    this.announce('¡Cofre dorado!', got.join(' · '));
  }

  // ---------- update ----------

  update(dt: number): void {
    if (this.state !== 'play') return;
    this.t += dt;

    this.director.update(this);
    this.updateWorldEvents();
    if (this.tint) {
      this.tint.life -= dt;
      if (this.tint.life <= 0) this.tint = null;
    }

    for (const h of this.heroes) this.updateHero(h, dt);

    this.spawner.update(this, dt);

    this.hash.clear();
    for (const e of this.enemies) if (!e.dead) this.hash.insert(e);

    this.updateEnemies(dt);
    for (const h of this.heroes) {
      if (!h.alive) continue;
      this.withActor(h, () => {
        for (const w of h.weapons) w.update(this, dt);
      });
    }
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

    this.actor = this.local;
    if (this.state !== 'play') return; // final boss died this frame
    if (!this.aliveHeroes.length) {
      this.finish(false);
      return;
    }
    if (this.anyPrompt) {
      this.state = 'levelup';
      this.cb.onLevelUp();
    }
  }

  private updateHero(h: Hero, dt: number): void {
    const p = h.body;
    if (h.hurtFlash > 0) h.hurtFlash -= dt;
    if (h.pillTime > 0) {
      h.pillTime -= dt;
      if (h.pillTime <= 0) h.refreshStats();
    }
    if (h.downed) {
      p.moving = false;
      // A living teammate close by brings them back.
      const helper = this.heroes.some((o) => o !== h && o.alive && Math.hypot(o.body.x - p.x, o.body.y - p.y) < REVIVE_RANGE);
      h.revive = helper ? h.revive + dt / REVIVE_TIME : Math.max(0, h.revive - dt / REVIVE_TIME);
      if (h.revive >= 1) {
        h.downed = false;
        h.revive = 0;
        p.hp = h.stats.maxHp * 0.5;
        p.invuln = 2;
        this.announce(`¡${h.name} vuelve a la lucha!`);
      }
      return;
    }
    const s = h.stats;
    const ax = h.input.axis();
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
    if (s.regen > 0) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);
  }

  private updateEnemies(dt: number): void {
    const far = this.spawnRadius * 1.5;
    const decay = Math.exp(-10 * dt);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const target = this.nearestHero(e.x, e.y);
      const p = target.body;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      if (e.boss) {
        const brain = e.boss.brain;
        this.withActor(target, () => brain.update(this, e, dt));
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

      if (target.alive && d < e.r + p.r) this.hurtHero(target, e.dmg, e.boss ? e.boss.name : e.kind);
    }
  }

  private updateProjectiles(dt: number): void {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      const owner = pr.owner ?? this.heroes[0];
      this.withActor(owner, () => {
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
      });
    }
  }

  private updateFields(dt: number): void {
    for (const f of this.fields) {
      f.life -= dt;
      f.timer -= dt;
      if (f.timer <= 0) {
        f.timer = f.tick;
        this.withActor(f.owner ?? this.heroes[0], () => {
          for (const e of this.enemiesInRadius(f.x, f.y, f.r)) this.hit(e, f.dmg, 0, 0, f.src);
        });
      }
      if (f.life <= 0) f.dead = true;
    }
  }

  private updateHazards(dt: number): void {
    const alive = this.aliveHeroes;
    for (const h of this.hazards) {
      h.life -= dt;
      if (h.kind === 'bullet') {
        if (h.homing) {
          const p = this.nearestHero(h.x, h.y).body;
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
        let ended = h.life <= 0;
        for (const hero of alive) {
          const p = hero.body;
          // Bursting bullets (clay birds) stop short of the player and leave a dodgeable telegraph.
          const reach = h.burst ? h.burst * 0.6 : h.r + p.r;
          if (Math.hypot(p.x - h.x, p.y - h.y) < reach) {
            if (!h.burst) this.hurtHero(hero, h.dmg, 'bala');
            ended = true;
            break;
          }
        }
        if (ended) {
          h.dead = true;
          if (h.burst) this.zone(h.x, h.y, h.burst, 0.55, 12, '#f0e6d2');
        }
        continue;
      }
      // zone
      if (h.delay! > 0) {
        h.delay! -= dt;
        if (h.delay! <= 0) {
          if (h.dmg > 0) {
            this.effects.push({ kind: 'boom', x: h.x, y: h.y, r: h.r, life: 0.3, max: 0.3, color: h.color });
            for (const hero of alive) {
              const p = hero.body;
              if (Math.hypot(p.x - h.x, p.y - h.y) >= h.r + p.r * 0.5) continue;
              this.hurtHero(hero, h.dmg, 'zona');
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
      } else if (h.linger) {
        for (const hero of alive) {
          const p = hero.body;
          if (Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r * 0.5) this.hurtHero(hero, h.dmg, 'fuego');
        }
      }
      if (h.life <= 0) h.dead = true;
    }
  }

  private updatePickups(dt: number): void {
    let gems = 0;
    for (const pk of this.pickups) {
      if (pk.dead) continue;
      if (pk.kind === 'xp') gems++;
      const hero = this.nearestHero(pk.x, pk.y);
      if (!hero.alive) continue;
      const p = hero.body;
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      if (!pk.attracted && d < hero.stats.magnet) pk.attracted = true;
      if (pk.attracted) {
        pk.speed += 900 * dt;
        const step = Math.min(d, (220 + pk.speed) * dt);
        pk.x += (dx / d) * step;
        pk.y += (dy / d) * step;
      }
      if (d < p.r + 8) {
        pk.dead = true;
        this.withActor(hero, () => this.collect(pk));
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
        this.actor.specials.push({ title: 'Tienda de Tenten', sub: 'Elige un regalo', choices: this.tentenChoices() });
        break;
      case 'pill':
        this.takePill(PILL_TIME);
        break;
    }
  }
}

export type { StatMods };
