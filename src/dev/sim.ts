/**
 * Dev-only balance simulation: a simple bot plays a full run at accelerated speed.
 * Usage from the browser console (dev server): (await import('/src/dev/sim.ts')).simulate('naruto')
 */
import { Game } from '../game/game';
import { rollChoices } from '../game/levelup';
import type { CharacterId } from '../game/characters';
import type { Input } from '../core/input';

export interface SimResult {
  char: string;
  win: boolean;
  time: number;
  level: number;
  kills: number;
  bosses: { id: string; spawned: number; killed: number | null }[];
  hpLog: string[];
  killedBy: string;
}

export function simulate(charId: CharacterId = 'naruto', maxTime = 1500): SimResult {
  let over = false;
  let win = false;
  const bot = { axis: () => ({ x: 0, y: 0 }) } as unknown as Input;
  const g = new Game(bot, { onLevelUp: () => {}, onGameOver: (w) => { over = true; win = w; } }, charId);

  bot.axis = () => {
    const p = g.player;
    let vx = 0;
    let vy = 0;
    for (const e of g.enemies) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d2 = dx * dx + dy * dy;
      const range = e.boss ? 260 : 130;
      if (d2 < range * range && d2 > 1) {
        const w = (e.boss ? 6 : 1) / d2;
        vx += dx * w;
        vy += dy * w;
      }
    }
    for (const h of g.hazards) {
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      const d = Math.hypot(dx, dy) || 1;
      const danger = h.kind === 'zone' ? h.r + 25 : 90;
      if (d < danger && (h.kind === 'bullet' || h.dmg > 0)) {
        vx += (dx / d) * 0.05;
        vy += (dy / d) * 0.05;
      }
    }
    // Drift toward gems when it's calm.
    let best = 220 * 220;
    let gx = 0;
    let gy = 0;
    for (const pk of g.pickups) {
      const d2 = (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2;
      if (d2 < best) {
        best = d2;
        gx = pk.x - p.x;
        gy = pk.y - p.y;
      }
    }
    const gl = Math.hypot(gx, gy) || 1;
    vx += (gx / gl) * 0.012;
    vy += (gy / gl) * 0.012;
    // Gentle orbit so it never stands still.
    vx += Math.cos(g.t * 0.3) * 0.002;
    vy += Math.sin(g.t * 0.3) * 0.002;
    const l = Math.hypot(vx, vy);
    return l > 0 ? { x: vx / l, y: vy / l } : { x: 0, y: 0 };
  };

  const bosses = new Map<string, { id: string; spawned: number; killed: number | null }>();
  const hpLog: string[] = [];
  const dt = 1 / 30;
  let nextLog = 60;
  while (!over && g.t < maxTime) {
    if (g.state === 'levelup') {
      while (g.specials.length) g.specials.shift()!.choices[0].apply(g);
      while (g.pendingLevelUps > 0) {
        const opts = rollChoices(g);
        const rank = (c: (typeof opts)[number]) =>
          c.tag === 'Evolución' ? 0 : c.key.startsWith('j:') && !c.isNew ? 1 : c.key.startsWith('j:') ? 2 : c.key.startsWith('p:') ? 3 : 4;
        opts.sort((a, b) => rank(a) - rank(b))[0].apply(g);
        g.pendingLevelUps--;
      }
      g.state = 'play';
    }
    g.update(dt);
    for (const e of g.enemies) {
      if (e.boss && !bosses.has(e.boss.id)) bosses.set(e.boss.id, { id: e.boss.id, spawned: Math.round(g.t), killed: null });
    }
    for (const id of g.bossesDefeated) {
      const b = bosses.get(id);
      if (b && b.killed === null) b.killed = Math.round(g.t);
    }
    if (g.t >= nextLog) {
      nextLog += 60;
      hpLog.push(`${Math.round(g.t / 60)}m L${g.level} hp${Math.round(g.player.hp)}/${g.stats.maxHp} en${g.enemies.length} ${g.weapons.map((w) => w.id + w.level + (w.evolved ? '*' : '')).join(',')}`);
    }
  }
  return { char: charId, win, time: Math.round(g.t), level: g.level, kills: g.kills, bosses: [...bosses.values()], hpLog, killedBy: win ? '' : g.lastHitBy };
}
