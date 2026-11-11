import type { Game } from './game';
import { NATURE_NAME, type Nature } from './natures';
import type { BossBrain, Enemy } from './types';

export type BossId =
  | 'deidara' | 'sasori' | 'hidan' | 'kakuzu' | 'itachi'
  | 'path0' | 'path1' | 'path2' | 'path3' | 'path4' | 'path5'
  | 'pain' | 'raikage' | 'tsuchikage' | 'mizukage' | 'madara'
  | 'orochimaru' | 'kisame' | 'konan' | 'kabuto';

export interface BossDef {
  name: string;
  lookId: string;
  hp: number;
  speed: number;
  r: number;
  dmg: number;
  nature: Nature;
  hearts?: Nature[];
  final?: boolean;
  brain: () => BossBrain;
}

// ---------------- helpers ----------------

class Every {
  constructor(public every: number, public t = every) {}
  tick(dt: number, rate = 1): boolean {
    this.t -= dt * rate;
    if (this.t <= 0) {
      this.t += this.every;
      return true;
    }
    return false;
  }
}

function toPlayer(g: Game, e: Enemy): { dx: number; dy: number; d: number; a: number } {
  const dx = g.player.x - e.x;
  const dy = g.player.y - e.y;
  return { dx, dy, d: Math.hypot(dx, dy) || 1, a: Math.atan2(dy, dx) };
}

function chase(g: Game, e: Enemy, mult = 1): void {
  const { dx, dy, d } = toPlayer(g, e);
  e.vx = (dx / d) * e.speed * mult;
  e.vy = (dy / d) * e.speed * mult;
}

/** Keep roughly `dist` away from the player, strafing around them. */
function kite(g: Game, e: Enemy, dist: number): void {
  const { dx, dy, d } = toPlayer(g, e);
  const toward = d > dist + 30 ? 1 : d < dist - 30 ? -1 : 0;
  e.vx = (dx / d) * e.speed * toward + (-dy / d) * e.speed * 0.5;
  e.vy = (dy / d) * e.speed * toward + (dx / d) * e.speed * 0.5;
}

function fan(g: Game, e: Enemy, n: number, spread: number, speed: number, dmg: number, color: string, extra: { homing?: number; burst?: number; life?: number; r?: number } = {}): void {
  const { a } = toPlayer(g, e);
  for (let i = 0; i < n; i++) {
    const ang = n === 1 ? a : a - spread / 2 + (spread * i) / (n - 1);
    g.bullet(e.x, e.y, ang, speed, dmg, color, extra);
  }
}

function radial(g: Game, e: Enemy, n: number, speed: number, dmg: number, color: string): void {
  const off = Math.random();
  for (let i = 0; i < n; i++) g.bullet(e.x, e.y, off + (i / n) * Math.PI * 2, speed, dmg, color);
}

function summon(g: Game, e: Enemy, kind: 'puppet' | 'crow' | 'brute' | 'zetsu' | 'snake' | 'sound', n: number, radius: number, aroundPlayer = false): void {
  const cx = aroundPlayer ? g.player.x : e.x;
  const cy = aroundPlayer ? g.player.y : e.y;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.spawnEnemy(kind, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
  }
}

/** Telegraphed dash: stand still showing the path, then charge. */
class Dash {
  state: 'idle' | 'aim' | 'go' = 'idle';
  private t = 0;
  private ax = 0;
  private ay = 0;
  constructor(private speed: number, private aimTime = 0.7, private goTime = 0.45) {}
  start(g: Game, e: Enemy): void {
    const { a } = toPlayer(g, e);
    this.ax = Math.cos(a);
    this.ay = Math.sin(a);
    this.state = 'aim';
    this.t = this.aimTime;
    const len = this.speed * this.goTime;
    for (let i = 1; i <= 5; i++) {
      g.zone(e.x + this.ax * (len * i) / 5, e.y + this.ay * (len * i) / 5, e.r, this.aimTime, 0, '#ff3b3b');
    }
  }
  /** Returns true while the dash controls movement. */
  update(e: Enemy, dt: number): boolean {
    if (this.state === 'idle') return false;
    this.t -= dt;
    if (this.state === 'aim') {
      e.vx = 0;
      e.vy = 0;
      if (this.t <= 0) {
        this.state = 'go';
        this.t = this.goTime;
      }
    } else {
      e.vx = this.ax * this.speed;
      e.vy = this.ay * this.speed;
      if (this.t <= 0) this.state = 'idle';
    }
    return true;
  }
}

// ---------------- brains ----------------

const deidara = (): BossBrain => {
  const birds = new Every(3, 1.5);
  const c3 = new Every(9, 6);
  return {
    update(g, e, dt) {
      kite(g, e, 170);
      // Clay birds glide toward you and land as a short telegraph you can step out of.
      if (birds.tick(dt)) fan(g, e, 2, 0.8, 140, 0, '#f0e6d2', { homing: 0.9, burst: 45, life: 2.5, r: 7 });
      if (c3.tick(dt)) {
        g.zone(g.player.x, g.player.y, 120, 1.6, 28, '#ffffff');
        g.announce('¡C3! ¡Sal del círculo!');
      }
    },
  };
};

const sasori = (): BossBrain => {
  const puppets = new Every(6, 2);
  const needles = new Every(2.8, 1.5);
  return {
    update(g, e, dt) {
      chase(g, e);
      if (puppets.tick(dt)) summon(g, e, 'puppet', 6, 60);
      if (needles.tick(dt)) fan(g, e, 5, 0.6, 250, 8, '#7bd36b');
    },
  };
};

const hidan = (): BossBrain => {
  const dash = new Dash(560);
  const every = new Every(4, 2.5);
  return {
    update(g, e, dt) {
      if (dash.update(e, dt)) return;
      chase(g, e);
      if (every.tick(dt)) dash.start(g, e);
    },
  };
};

const kakuzu = (): BossBrain => {
  const attack = new Every(3, 2);
  let heart = -1;
  let armor = 0;
  return {
    update(g, e, dt) {
      const hearts = e.boss!.hearts!;
      const idx = Math.min(hearts.length - 1, Math.floor((1 - e.hp / e.maxHp) * hearts.length));
      if (idx !== heart) {
        heart = idx;
        e.nature = hearts[idx];
        if (idx > 0) g.announce(`Kakuzu cambia de corazón: ${NATURE_NAME[e.nature]}`);
      }
      if (armor > 0) {
        armor -= dt;
        if (armor <= 0) e.dmgTaken = 1;
      }
      chase(g, e, e.nature === 'tierra' ? 1.3 : 1);
      if (!attack.tick(dt)) return;
      const p = g.player;
      switch (e.nature) {
        case 'fuego':
          g.zone(p.x, p.y, 90, 1.1, 22, '#ff6a3c', { linger: 2 });
          break;
        case 'viento':
          radial(g, e, 12, 200, 9, '#8fe3a8');
          break;
        case 'rayo': {
          const { dx, dy } = toPlayer(g, e);
          for (let i = 1; i <= 4; i++) g.zone(e.x + (dx * i) / 3, e.y + (dy * i) / 3, 45, 0.5 + i * 0.15, 18, '#ffe14d');
          break;
        }
        case 'tierra':
          e.dmgTaken = 0.4;
          armor = 3;
          g.announce('Kakuzu endurece la piel');
          break;
        default:
          fan(g, e, 7, 0.8, 230, 10, '#4fa8ff');
      }
    },
  };
};

const itachi = (): BossBrain => {
  const blink = new Every(5, 4);
  const crows = new Every(4, 1.5);
  const amaterasu = new Every(7, 5);
  const tsukuyomi = new Every(11, 8);
  return {
    update(g, e, dt) {
      kite(g, e, 200);
      if (blink.tick(dt)) {
        g.puff(e.x, e.y, '#222');
        const a = Math.random() * Math.PI * 2;
        e.x = g.player.x + Math.cos(a) * 180;
        e.y = g.player.y + Math.sin(a) * 180;
        g.puff(e.x, e.y, '#222');
      }
      if (crows.tick(dt)) summon(g, e, 'crow', 5, 30);
      if (amaterasu.tick(dt)) {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 80;
          g.zone(g.player.x + Math.cos(a) * r, g.player.y + Math.sin(a) * r, 45, 0.9, 8, '#1a0a24', { linger: 3.5 });
        }
      }
      if (tsukuyomi.tick(dt)) {
        g.announce('¡Tsukuyomi! Te mueves a cámara lenta');
        g.tint = { color: '160,0,0', life: 2.5, max: 2.5 };
        g.player.slow = 2.5;
      }
    },
  };
};

const path = (variant: number) => (): BossBrain => {
  const dash = new Dash(520);
  const every = new Every([5, 3, 6, 4, 4, 6][variant], 2 + variant * 0.4);
  return {
    update(g, e, dt) {
      if (dash.update(e, dt)) return;
      chase(g, e, variant === 3 ? 1.3 : 1);
      if (variant === 3) e.dmgTaken = 0.5; // Preta absorbs ninjutsu
      if (!every.tick(dt)) return;
      switch (variant) {
        case 0: // Deva
          g.zone(e.x, e.y, 140, 0.7, 12, '#e8e0ff', { push: 450 });
          break;
        case 1: // Asura
          fan(g, e, 3, 0.9, 170, 12, '#c0c6cc', { homing: 1.2, life: 3.5 });
          break;
        case 2: // Animal
          summon(g, e, 'brute', 2, 50);
          break;
        case 3: // Preta
          break;
        case 4: // Human
          dash.start(g, e);
          break;
        default: // Naraka: heals the other paths
          for (const o of g.enemies) {
            if (o.boss && !o.dead && o !== e) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.05);
          }
          g.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 120, life: 0.6, max: 0.6, color: '#5cc96b' });
      }
    },
  };
};

const pain = (): BossBrain => {
  const shinra = new Every(6, 3);
  const bansho = new Every(9, 6);
  let chibaku = -1;
  const rocks = new Every(0.5);
  return {
    update(g, e, dt) {
      kite(g, e, 240);
      if (shinra.tick(dt)) {
        g.zone(e.x, e.y, 210, 0.9, 20, '#e8e0ff', { push: 700 });
        g.announce('¡Shinra Tensei!');
      }
      if (bansho.tick(dt)) {
        const { dx, dy, d } = toPlayer(g, e);
        g.player.kbx -= (dx / d) * 380;
        g.player.kby -= (dy / d) * 380;
        g.announce('¡Bansho Ten\'in!');
      }
      if (chibaku < 0 && e.hp < e.maxHp / 2) {
        chibaku = 6;
        g.announce('¡Chibaku Tensei! Esquiva las rocas');
      }
      if (chibaku > 0) {
        chibaku -= dt;
        if (rocks.tick(dt)) {
          for (let i = 0; i < 2; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 180;
            g.zone(g.player.x + Math.cos(a) * r, g.player.y + Math.sin(a) * r, 60, 1.2, 22, '#8a7a6a');
          }
        }
        if (chibaku <= 0) chibaku = 0;
      }
    },
  };
};

const raikage = (): BossBrain => {
  const dash = new Dash(650, 0.55, 0.4);
  const every = new Every(3, 2);
  return {
    update(g, e, dt) {
      if (dash.update(e, dt)) return;
      chase(g, e);
      if (every.tick(dt)) dash.start(g, e);
    },
  };
};

const tsuchikage = (): BossBrain => {
  const jinton = new Every(4, 2);
  return {
    update(g, e, dt) {
      kite(g, e, 220);
      if (jinton.tick(dt)) g.zone(g.player.x, g.player.y, 70, 0.8, 25, '#e8f4ff');
    },
  };
};

const mizukage = (): BossBrain => {
  const spray = new Every(3, 1.5);
  return {
    update(g, e, dt) {
      chase(g, e);
      if (spray.tick(dt)) radial(g, e, 10, 190, 10, '#4fa8ff');
    },
  };
};

const madara = (): BossBrain => {
  const fire = new Every(7, 3);
  const meteor = new Every(12, 8);
  const clones = new Every(9, 5);
  let enraged = false;
  return {
    update(g, e, dt) {
      if (!enraged && e.hp < e.maxHp / 2) {
        enraged = true;
        g.announce('Madara despierta el Rinnegan');
      }
      const rate = enraged ? 1.4 : 1;
      chase(g, e, enraged ? 1.2 : 1);
      if (fire.tick(dt, rate)) {
        const { a } = toPlayer(g, e);
        g.announce('¡Gōka Mekkyaku!');
        for (let step = 1; step <= 4; step++) {
          for (let k = -1; k <= 1; k++) {
            const ang = a + k * 0.4;
            const d = step * 70;
            g.zone(e.x + Math.cos(ang) * d, e.y + Math.sin(ang) * d, 55, 0.8 + step * 0.15, 22, '#ff6a3c', { linger: 1.5 });
          }
        }
      }
      if (meteor.tick(dt, rate)) {
        g.zone(g.player.x, g.player.y, 170, 2.2, 55, '#8a5a3a');
        g.announce('¡Tengai Shinsei! ¡Corre!');
      }
      if (clones.tick(dt, rate)) summon(g, e, 'zetsu', 10, 220, true);
    },
  };
};

const orochimaru = (): BossBrain => {
  const snakes = new Every(3, 1.5);
  const kusanagi = new Every(5, 3);
  let shed = false;
  return {
    update(g, e, dt) {
      kite(g, e, 200);
      if (snakes.tick(dt)) summon(g, e, 'snake', 4, 40);
      if (kusanagi.tick(dt)) {
        // Kusanagi blade lunges out along a line.
        const { a } = toPlayer(g, e);
        for (let i = 1; i <= 6; i++) g.zone(e.x + Math.cos(a) * i * 45, e.y + Math.sin(a) * i * 45, 26, 0.7, 20, '#c9d1d9');
      }
      if (!shed && e.hp < e.maxHp / 2) {
        shed = true;
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25);
        g.puff(e.x, e.y, '#e8e4f0', 40);
        g.announce('¡Orochimaru muda de piel!', 'Recupera vida');
      }
    },
  };
};

const kisame = (): BossBrain => {
  const sharks = new Every(4, 2);
  const prison = new Every(9, 6);
  const samehada = new Every(6, 6);
  return {
    update(g, e, dt) {
      chase(g, e);
      if (sharks.tick(dt)) fan(g, e, 5, 0.9, 200, 11, '#4fa8ff', { homing: 0.6, life: 3, r: 7 });
      if (prison.tick(dt)) {
        g.zone(g.player.x, g.player.y, 60, 1, 14, '#4fa8ff', { slow: 2 });
        g.announce('¡Prisión de agua!', 'Te ralentiza si te atrapa');
      }
      // Samehada drains chakra from whoever is close.
      if (samehada.tick(dt) && toPlayer(g, e).d < 70) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04);
    },
  };
};

const konan = (): BossBrain => {
  const butterflies = new Every(2.5, 1.5);
  const bombs = new Every(8, 5);
  return {
    update(g, e, dt) {
      kite(g, e, 220);
      if (butterflies.tick(dt)) radial(g, e, 12, 150, 8, '#f4f1ea');
      if (bombs.tick(dt)) {
        g.announce('¡Bombas de papel!');
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + Math.random();
          g.zone(g.player.x + Math.cos(a) * 70, g.player.y + Math.sin(a) * 70, 55, 1.2, 18, '#f4f1ea');
        }
      }
    },
  };
};

const kabuto = (): BossBrain => {
  const army = new Every(4, 2);
  const heal = new Every(7, 7);
  const snakes = new Every(5, 3);
  return {
    update(g, e, dt) {
      chase(g, e);
      if (army.tick(dt)) summon(g, e, 'sound', 3, 50);
      if (heal.tick(dt)) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.05);
        g.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 60, life: 0.5, max: 0.5, color: '#5cc96b' });
      }
      if (snakes.tick(dt)) fan(g, e, 4, 1.2, 170, 12, '#7ad35a', { homing: 1, life: 3 });
    },
  };
};

export const BOSSES: Record<BossId, BossDef> = {
  deidara: { name: 'Deidara', lookId: 'deidara', hp: 1100, speed: 70, r: 22, dmg: 12, nature: 'tierra', brain: deidara },
  sasori: { name: 'Sasori', lookId: 'sasori', hp: 2400, speed: 55, r: 22, dmg: 14, nature: 'viento', brain: sasori },
  hidan: { name: 'Hidan', lookId: 'hidan', hp: 7000, speed: 75, r: 22, dmg: 22, nature: 'neutral', brain: hidan },
  kakuzu: { name: 'Kakuzu', lookId: 'kakuzu', hp: 9000, speed: 55, r: 24, dmg: 18, nature: 'fuego', hearts: ['fuego', 'viento', 'rayo', 'tierra', 'agua'], brain: kakuzu },
  itachi: { name: 'Itachi', lookId: 'itachi', hp: 14000, speed: 80, r: 22, dmg: 16, nature: 'fuego', brain: itachi },
  path0: { name: 'Camino Deva', lookId: 'path', hp: 4500, speed: 65, r: 20, dmg: 18, nature: 'neutral', brain: path(0) },
  path1: { name: 'Camino Asura', lookId: 'path', hp: 4500, speed: 65, r: 20, dmg: 18, nature: 'rayo', brain: path(1) },
  path2: { name: 'Camino Animal', lookId: 'path', hp: 4500, speed: 65, r: 20, dmg: 18, nature: 'tierra', brain: path(2) },
  path3: { name: 'Camino Preta', lookId: 'path', hp: 4500, speed: 65, r: 20, dmg: 18, nature: 'agua', brain: path(3) },
  path4: { name: 'Camino Humano', lookId: 'path', hp: 4500, speed: 65, r: 20, dmg: 18, nature: 'viento', brain: path(4) },
  path5: { name: 'Camino Naraka', lookId: 'path', hp: 4500, speed: 65, r: 20, dmg: 18, nature: 'fuego', brain: path(5) },
  pain: { name: 'Pain', lookId: 'pain', hp: 24000, speed: 60, r: 26, dmg: 24, nature: 'neutral', brain: pain },
  raikage: { name: 'Raikage (Edo Tensei)', lookId: 'raikage', hp: 16000, speed: 95, r: 26, dmg: 24, nature: 'rayo', brain: raikage },
  tsuchikage: { name: 'Tsuchikage (Edo Tensei)', lookId: 'tsuchikage', hp: 16000, speed: 55, r: 20, dmg: 24, nature: 'tierra', brain: tsuchikage },
  mizukage: { name: 'Mizukage (Edo Tensei)', lookId: 'mizukage', hp: 16000, speed: 60, r: 22, dmg: 24, nature: 'agua', brain: mizukage },
  orochimaru: { name: 'Orochimaru', lookId: 'orochimaru', hp: 4500, speed: 65, r: 22, dmg: 16, nature: 'viento', brain: orochimaru },
  kisame: { name: 'Kisame', lookId: 'kisame', hp: 10000, speed: 70, r: 24, dmg: 18, nature: 'agua', brain: kisame },
  konan: { name: 'Konan', lookId: 'konan', hp: 12000, speed: 65, r: 21, dmg: 18, nature: 'viento', brain: konan },
  kabuto: { name: 'Kabuto', lookId: 'kabuto', hp: 20000, speed: 65, r: 22, dmg: 22, nature: 'agua', brain: kabuto },
  madara: { name: 'Madara Uchiha', lookId: 'madara', hp: 120000, speed: 70, r: 28, dmg: 30, nature: 'fuego', final: true, brain: madara },
};
