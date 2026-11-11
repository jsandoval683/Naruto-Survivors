import type { WebSocket } from 'ws';
import type { CharacterId } from '../src/game/characters';
import { CHARACTERS } from '../src/game/characters';
import { Game } from '../src/game/game';
import type { Hero } from '../src/game/hero';
import { rollChoices, type Choice } from '../src/game/levelup';
import { MAX_PLAYERS, SNAP_EVERY_TICKS, type ClientMsg, type NetBonuses, type RoomInfo, type RoomListing, type ServerMsg } from '../src/net/protocol';
import { recordRun } from './ranking';
import { SnapshotEncoder } from './snapshot';

const STEP = 1 / 60;
const PROMPT_SECONDS = 15;

export interface Conn {
  ws: WebSocket;
  user: { id: number; name: string };
  room: Room | null;
}

interface Member {
  conn: Conn;
  charId: CharacterId;
  lookId: string;
  bonus: NetBonuses | null;
  axis: { x: number; y: number };
  heroIndex: number | null;
  connected: boolean;
}

interface OpenPrompt {
  choices: Choice[];
  special: boolean;
  deadline: number;
}

function send(conn: Conn, msg: ServerMsg): void {
  if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(JSON.stringify(msg));
}

const rooms = new Map<string, Room>();

function newCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

class Room {
  code = newCode();
  members: Member[] = [];
  hostId: number;
  game: Game | null = null;
  private timer: NodeJS.Timeout | null = null;
  private tick = 0;
  private last = 0;
  private acc = 0;
  private encoder = new SnapshotEncoder();
  private prompts = new Map<number, OpenPrompt>();

  constructor(public isPublic: boolean, host: Conn) {
    this.hostId = host.user.id;
    rooms.set(this.code, this);
  }

  get started(): boolean {
    return this.game !== null;
  }

  get connectedMembers(): Member[] {
    return this.members.filter((m) => m.connected);
  }

  info(): RoomInfo {
    return {
      code: this.code,
      isPublic: this.isPublic,
      started: this.started,
      elapsed: Math.floor(this.game?.t ?? 0),
      players: this.members.map((m) => ({ id: m.conn.user.id, name: m.conn.user.name, charId: m.charId, lookId: m.lookId, host: m.conn.user.id === this.hostId, connected: m.connected })),
    };
  }

  listing(): RoomListing {
    const host = this.members.find((m) => m.conn.user.id === this.hostId);
    return { code: this.code, host: host?.conn.user.name ?? '?', count: this.connectedMembers.length, started: this.started, elapsed: Math.floor(this.game?.t ?? 0) };
  }

  broadcastRoom(): void {
    const room = this.info();
    for (const m of this.connectedMembers) send(m.conn, { type: 'room', room });
  }

  member(conn: Conn): Member | undefined {
    return this.members.find((m) => m.conn.user.id === conn.user.id);
  }

  canJoin(conn: Conn): boolean {
    return !!this.member(conn) || this.connectedMembers.length < MAX_PLAYERS;
  }

  join(conn: Conn): void {
    let m = this.member(conn);
    if (m) {
      m.conn = conn;
      m.connected = true;
    } else {
      m = { conn, charId: 'naruto', lookId: 'naruto', bonus: null, axis: { x: 0, y: 0 }, heroIndex: null, connected: true };
      this.members.push(m);
    }
    conn.room = this;
    this.broadcastRoom();
    if (this.game) this.enterRunningGame(m);
  }

  leave(conn: Conn): void {
    const m = this.member(conn);
    conn.room = null;
    if (!m) return;
    if (this.game && m.heroIndex !== null) {
      // Keep their hero (downed, idle) so indexes stay stable; they can rejoin.
      m.connected = false;
      m.axis = { x: 0, y: 0 };
    } else {
      this.members = this.members.filter((x) => x !== m);
    }
    if (!this.connectedMembers.length) {
      this.destroy();
      return;
    }
    if (m.conn.user.id === this.hostId) this.hostId = this.connectedMembers[0].conn.user.id;
    this.broadcastRoom();
  }

  setChar(conn: Conn, charId: CharacterId, lookId: string, bonus: NetBonuses): void {
    const m = this.member(conn);
    if (!m || !CHARACTERS[charId]) return;
    m.charId = charId;
    m.lookId = typeof lookId === 'string' ? lookId.slice(0, 32) : charId;
    m.bonus = sanitizeBonus(bonus);
    this.broadcastRoom();
  }

  private heroSpec(m: Member) {
    const b = m.bonus;
    return {
      name: m.conn.user.name,
      charId: m.charId,
      input: { axis: () => m.axis },
      opts: { mods: b?.mods, xpMult: b?.xpMult, rerolls: b?.rerolls, extraJutsu: b?.extraJutsu, lookId: m.lookId },
    };
  }

  start(conn: Conn): void {
    if (conn.user.id !== this.hostId || this.game) return;
    const players = this.connectedMembers;
    this.game = new Game({ onLevelUp: () => {}, onGameOver: (win) => this.finish(win) }, players.map((m) => this.heroSpec(m)));
    players.forEach((m, i) => {
      m.heroIndex = i;
      send(m.conn, { type: 'start', you: i });
    });
    this.encoder = new SnapshotEncoder();
    this.prompts.clear();
    this.tick = 0;
    this.acc = 0;
    this.last = performance.now();
    this.timer = setInterval(() => this.loop(), 1000 / 60);
    this.broadcastRoom();
  }

  private enterRunningGame(m: Member): void {
    const g = this.game!;
    if (m.heroIndex === null) {
      const h = g.addHero(this.heroSpec(m));
      m.heroIndex = h.id;
    }
    send(m.conn, { type: 'start', you: m.heroIndex });
    const open = this.prompts.get(m.heroIndex);
    if (open) this.sendPrompt(m, g.heroes[m.heroIndex], open);
  }

  private loop(): void {
    const g = this.game;
    if (!g) return;
    const now = performance.now();
    this.acc += Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      g.update(STEP);
      if (!this.game) return; // finished
      this.handlePrompts(g);
      this.tick++;
      if (this.tick % SNAP_EVERY_TICKS === 0) {
        const s = this.encoder.encode(g);
        const msg = JSON.stringify({ type: 'snap', s } satisfies ServerMsg);
        for (const m of this.connectedMembers) if (m.conn.ws.readyState === m.conn.ws.OPEN) m.conn.ws.send(msg);
      }
    }
  }

  /** Opens card choices for heroes that levelled up; picks automatically on timeout or for absent players. */
  private handlePrompts(g: Game): void {
    const now = Date.now();
    for (const m of this.members) {
      if (m.heroIndex === null) continue;
      const h = g.heroes[m.heroIndex];
      const open = this.prompts.get(h.id);
      if (!h.hasPrompt) {
        if (open) this.prompts.delete(h.id);
        continue;
      }
      if (!open) {
        const p = this.rollPrompt(g, h);
        this.prompts.set(h.id, p);
        if (m.connected) this.sendPrompt(m, h, p);
        else this.pick(m, 0);
      } else if (now > open.deadline || !m.connected) {
        this.pick(m, 0);
      }
    }
  }

  private rollPrompt(g: Game, h: Hero): OpenPrompt {
    const special = h.specials[0];
    let choices: Choice[] = [];
    if (special) choices = special.choices;
    else g.withActor(h, () => (choices = rollChoices(g)));
    return { choices, special: !!special, deadline: Date.now() + PROMPT_SECONDS * 1000 };
  }

  private sendPrompt(m: Member, h: Hero, p: OpenPrompt): void {
    const special = h.specials[0];
    send(m.conn, {
      type: 'prompt',
      prompt: {
        title: special ? special.title : `¡Nivel ${this.game!.level - h.pendingLevelUps + 1}!`,
        sub: special ? special.sub : 'Elige una mejora',
        choices: p.choices.map(({ key, title, tag, isNew, desc, icon, color }) => ({ key, title, tag, isNew, desc, icon, color })),
        rerolls: h.rerolls,
        canReroll: !p.special && h.rerolls > 0,
        seconds: Math.max(0, Math.round((p.deadline - Date.now()) / 1000)),
      },
    });
  }

  pick(m: Member, index: number): void {
    const g = this.game;
    if (!g || m.heroIndex === null) return;
    const h = g.heroes[m.heroIndex];
    const open = this.prompts.get(h.id);
    if (!open || !open.choices[index]) return;
    this.prompts.delete(h.id);
    g.applyChoice(h, open.choices[index]);
    send(m.conn, { type: 'prompt', prompt: null });
  }

  reroll(m: Member): void {
    const g = this.game;
    if (!g || m.heroIndex === null) return;
    const h = g.heroes[m.heroIndex];
    const open = this.prompts.get(h.id);
    if (!open || open.special || h.rerolls <= 0) return;
    h.rerolls--;
    const p = this.rollPrompt(g, h);
    p.deadline = open.deadline;
    this.prompts.set(h.id, p);
    this.sendPrompt(m, h, p);
  }

  private finish(win: boolean): void {
    const g = this.game;
    if (!g) return;
    for (const m of this.members) {
      if (m.heroIndex === null) continue;
      const h = g.heroes[m.heroIndex];
      const summary = g.summary(win, h);
      recordRun(m.conn.user.id, { char: summary.char, time: summary.time, kills: summary.kills, bosses: summary.bosses.length, level: summary.level, win, coop: true });
      if (m.connected) send(m.conn, { type: 'over', win, summary });
    }
    this.stopGame();
  }

  private stopGame(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.game = null;
    // Back to the lobby: drop players who left, reset hero slots.
    this.members = this.members.filter((m) => m.connected);
    for (const m of this.members) m.heroIndex = null;
    this.prompts.clear();
    if (!this.members.length) this.destroy();
    else this.broadcastRoom();
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.game = null;
    rooms.delete(this.code);
  }

  input(m: Member, x: number, y: number): void {
    let ax = Number(x) || 0;
    let ay = Number(y) || 0;
    const l = Math.hypot(ax, ay);
    if (l > 1) {
      ax /= l;
      ay /= l;
    }
    m.axis = { x: ax, y: ay };
  }
}

function sanitizeBonus(b: NetBonuses | undefined): NetBonuses | null {
  if (!b || typeof b !== 'object') return null;
  const n = (v: unknown, lo: number, hi: number, d: number) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d;
  };
  const m = b.mods ?? {};
  // Clamp to what the permanent upgrades can actually give.
  return {
    mods: {
      maxHp: n(m.maxHp, 0, 80, 0),
      dmg: n(m.dmg, 1, 1.4, 1),
      speed: n(m.speed, 1, 1.3, 1),
      cd: n(m.cd, 0.7, 1, 1),
      armor: n(m.armor, 0, 0.2, 0),
      regen: n(m.regen, 0, 2, 0),
      magnet: n(m.magnet, 1, 2.2, 1),
      crit: n(m.crit, 0, 0.2, 0),
    },
    xpMult: n(b.xpMult, 1, 1.5, 1),
    rerolls: Math.round(n(b.rerolls, 2, 5, 2)),
    extraJutsu: !!b.extraJutsu,
  };
}

function publicRooms(): RoomListing[] {
  return [...rooms.values()].filter((r) => r.isPublic && r.connectedMembers.length < MAX_PLAYERS).map((r) => r.listing());
}

export function handleMessage(conn: Conn, msg: ClientMsg): void {
  const room = conn.room;
  const m = room?.member(conn);
  switch (msg.type) {
    case 'list':
      send(conn, { type: 'rooms', rooms: publicRooms() });
      break;
    case 'create': {
      room?.leave(conn);
      const r = new Room(!!msg.isPublic, conn);
      r.join(conn);
      break;
    }
    case 'join': {
      const r = rooms.get(String(msg.code ?? '').toUpperCase().trim());
      if (!r) return send(conn, { type: 'error', message: 'No existe esa sala.' });
      if (!r.canJoin(conn)) return send(conn, { type: 'error', message: 'La sala está llena.' });
      if (room && room !== r) room.leave(conn);
      r.join(conn);
      break;
    }
    case 'quick': {
      const open = [...rooms.values()].filter((r) => r.isPublic && r.canJoin(conn) && r !== room);
      if (room) room.leave(conn);
      const r = open.sort((a, b) => b.connectedMembers.length - a.connectedMembers.length)[0] ?? new Room(true, conn);
      r.join(conn);
      break;
    }
    case 'leave':
      room?.leave(conn);
      send(conn, { type: 'room', room: null });
      break;
    case 'char':
      room?.setChar(conn, msg.charId, msg.lookId, msg.bonus);
      break;
    case 'start':
      room?.start(conn);
      break;
    case 'input':
      if (room && m) room.input(m, msg.x, msg.y);
      break;
    case 'pick':
      if (room && m) room.pick(m, Math.floor(Number(msg.index)));
      break;
    case 'reroll':
      if (room && m) room.reroll(m);
      break;
  }
}

export function handleClose(conn: Conn): void {
  conn.room?.leave(conn);
}
