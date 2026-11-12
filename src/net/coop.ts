import type { SceneId } from '../game/timeline';
import type { Effect, FloatText } from '../game/types';
import type { EnemyView, FieldView, HeroView, PickupView, ProjectileView, SceneView } from '../game/view';
import type { RunSummary } from '../meta/summary';
import {
  E_STRIDE,
  ENEMY_KINDS,
  F_STRIDE,
  FIELD_STYLES,
  NATURES,
  P_STRIDE,
  PICKUP_KINDS,
  PK_STRIDE,
  PROJ_KINDS,
  type ClientMsg,
  type HeroSnap,
  type PromptMsg,
  type RoomInfo,
  type RoomListing,
  type ServerMsg,
  type Snapshot,
} from './protocol';

export interface CoopEvents {
  onRooms(rooms: RoomListing[]): void;
  onRoom(room: RoomInfo | null): void;
  onError(message: string): void;
  onStart(you: number): void;
  onSnap(s: Snapshot): void;
  onPrompt(p: PromptMsg | null): void;
  onOver(win: boolean, summary: RunSummary): void;
  onClose(): void;
}

/** WebSocket connection to the co-op server. */
export class CoopClient {
  private ws: WebSocket | null = null;
  room: RoomInfo | null = null;
  userId = 0;

  constructor(private events: CoopEvents) {}

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(token: string): Promise<void> {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return Promise.resolve();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
    this.ws = ws;
    return new Promise((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('No se puede conectar con el servidor de cooperativo.'));
      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
        this.room = null;
        this.events.onClose();
      };
      ws.onmessage = (ev) => this.handle(JSON.parse(String(ev.data)) as ServerMsg);
    });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  send(msg: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private handle(m: ServerMsg): void {
    switch (m.type) {
      case 'hello':
        this.userId = m.userId;
        break;
      case 'rooms':
        this.events.onRooms(m.rooms);
        break;
      case 'room':
        this.room = m.room;
        this.events.onRoom(m.room);
        break;
      case 'error':
        this.events.onError(m.message);
        break;
      case 'start':
        this.events.onStart(m.you);
        break;
      case 'snap':
        this.events.onSnap(m.s);
        break;
      case 'prompt':
        this.events.onPrompt(m.prompt);
        break;
      case 'over':
        this.events.onOver(m.win, m.summary);
        break;
    }
  }
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Client view of a co-op run: interpolates between the last two server snapshots
 * and nudges the local hero ahead with the player's own input so moving feels instant.
 */
export class NetGame {
  private prev: Snapshot | null = null;
  private cur: Snapshot | null = null;
  private curAt = 0;
  private interval = 50;
  private effects: Effect[] = [];
  private texts: FloatText[] = [];
  private offX = 0;
  private offY = 0;
  prompt: PromptMsg | null = null;
  over = false;

  constructor(public you: number) {}

  get ready(): boolean {
    return this.cur !== null;
  }

  get choosing(): string[] {
    return this.cur?.choosing ?? [];
  }

  get local(): HeroSnap | null {
    return this.cur?.h[this.you] ?? null;
  }

  onSnap(s: Snapshot): void {
    const now = performance.now();
    if (this.cur) this.interval = Math.max(30, Math.min(150, lerp(this.interval, now - this.curAt, 0.2)));
    this.prev = this.cur;
    this.cur = s;
    this.curAt = now;
    this.effects.push(...s.fx);
    for (const t of s.tx) if (this.texts.length < 150) this.texts.push(t);
  }

  /** Ages local-only cosmetics and applies movement prediction. */
  update(dt: number, axis: { x: number; y: number }): void {
    for (const fx of this.effects) fx.life -= dt;
    this.effects = this.effects.filter((f) => f.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 30 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    const me = this.local;
    const paused = (this.cur?.choosing.length ?? 0) > 0;
    if (me && !me.downed && !paused) {
      this.offX += axis.x * me.spd * dt;
      this.offY += axis.y * me.spd * dt;
    }
    // The offset settles at about "speed × latency", then fades when you stop.
    const k = Math.exp(-dt / 0.12);
    this.offX *= k;
    this.offY *= k;
  }

  view(): SceneView | null {
    const s = this.cur;
    if (!s) return null;
    const p = this.prev ?? s;
    const k = Math.min(1, (performance.now() - this.curAt) / this.interval);

    const prevHeroes = new Map(p.h.map((h) => [h.id, h]));
    const heroes: HeroView[] = s.h.map((h) => {
      const o = prevHeroes.get(h.id) ?? h;
      const v = { ...h, x: lerp(o.x, h.x, k), y: lerp(o.y, h.y, k) };
      if (h.id === this.you) {
        v.x += this.offX;
        v.y += this.offY;
      }
      return v;
    });

    const prevMin = new Map<number, [number, number]>();
    for (let i = 0; i < p.e.length; i += E_STRIDE) prevMin.set(p.e[i], [p.e[i + 3], p.e[i + 4]]);
    const enemies: EnemyView[] = [];
    for (let i = 0; i < s.e.length; i += E_STRIDE) {
      const id = s.e[i];
      const o = prevMin.get(id);
      const x = s.e[i + 3];
      const y = s.e[i + 4];
      enemies.push({
        id,
        kind: ENEMY_KINDS[s.e[i + 1]],
        nature: NATURES[s.e[i + 2]],
        x: o ? lerp(o[0], x, k) : x,
        y: o ? lerp(o[1], y, k) : y,
        r: s.e[i + 5],
        flash: s.e[i + 6],
        hp: s.e[i + 7],
        maxHp: 100,
        dmgTaken: 1,
        boss: null,
      });
    }
    const prevBoss = new Map(p.b.map((b) => [b.id, b]));
    for (const b of s.b) {
      const o = prevBoss.get(b.id) ?? b;
      enemies.push({
        id: b.id,
        kind: 'boss',
        nature: b.nature,
        x: lerp(o.x, b.x, k),
        y: lerp(o.y, b.y, k),
        r: b.r,
        flash: b.flash,
        hp: b.hp,
        maxHp: b.maxHp,
        dmgTaken: b.dmgTaken,
        boss: { name: b.name, lookId: b.lookId, hearts: b.hearts },
      });
    }

    const projectiles: ProjectileView[] = [];
    for (let i = 0; i < s.p.length; i += P_STRIDE) {
      projectiles.push({ kind: PROJ_KINDS[s.p[i]], x: s.p[i + 1], y: s.p[i + 2], r: s.p[i + 3], angle: s.p[i + 4] / 100, big: s.p[i + 5] === 1 });
    }
    const fields: FieldView[] = [];
    for (let i = 0; i < s.f.length; i += F_STRIDE) {
      fields.push({ x: s.f[i], y: s.f[i + 1], r: s.f[i + 2], life: s.f[i + 3] / 10, style: FIELD_STYLES[s.f[i + 4]] });
    }
    const pickups: PickupView[] = [];
    for (let i = 0; i < s.pk.length; i += PK_STRIDE) {
      pickups.push({ kind: PICKUP_KINDS[s.pk[i]], x: s.pk[i + 1], y: s.pk[i + 2], value: s.pk[i + 3] });
    }

    return {
      t: s.t,
      scene: s.sc as SceneId,
      arcName: s.arc,
      kills: s.k,
      ryo: s.ryo,
      level: s.lv,
      xp: s.xp,
      xpNext: s.xpn,
      biju: s.biju,
      heroes,
      localIndex: this.you,
      enemies,
      projectiles,
      hazards: s.hz,
      fields,
      pickups,
      effects: this.effects,
      texts: this.texts,
      banner: s.bn,
      tint: s.tn,
      nextBoss: s.nb,
      dimension: s.dim,
    };
  }
}
