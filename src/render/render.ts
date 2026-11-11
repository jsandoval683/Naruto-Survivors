import { Input } from '../core/input';
import { FINAL_TIME, type Game } from '../game/game';
import { ArenaWeapon, ClonesWeapon, JUTSUS, SellosWeapon } from '../game/jutsus';
import { LOOKS } from '../game/looks';
import { NATURE_COLOR } from '../game/natures';
import { PASSIVES } from '../game/passives';
import type { SceneId } from '../game/timeline';
import { BOSSES, type BossId } from '../game/bosses';
import type { Enemy, Field, Hazard, Pickup, Projectile } from '../game/types';
import { drawLook, minionSprite } from './sprites';

export interface View {
  w: number; // CSS pixels
  h: number;
  dpr: number;
  zoom: number;
}

const TILE = 64;

interface Palette {
  base: string;
  patchA: string;
  patchB: string;
  tuft: string | null;
  dirt: string;
  rock: string;
  rockHi: string;
  flowers: boolean;
  crack: string | null;
}

const SCENES: Record<SceneId, Palette> = {
  desierto: { base: '#d9b77a', patchA: '#e3c68e', patchB: '#cba468', tuft: '#a8884e', dirt: '#c49a5a', rock: '#a8865a', rockHi: '#c4a272', flowers: false, crack: null },
  bosque: { base: '#2f5a2a', patchA: '#356530', patchB: '#284d24', tuft: '#4a8a3c', dirt: '#5a4a32', rock: '#6a6e70', rockHi: '#8a8e90', flowers: true, crack: null },
  uchiha: { base: '#3a3540', patchA: '#433d4a', patchB: '#322e38', tuft: null, dirt: '#4a3a3a', rock: '#5a5560', rockHi: '#706a78', flowers: false, crack: '#26232b' },
  konoha: { base: '#3d6b33', patchA: '#427236', patchB: '#3a6631', tuft: '#5a9a48', dirt: '#9a8060', rock: '#7c8088', rockHi: '#9aa0a8', flowers: true, crack: null },
  crater: { base: '#7a6048', patchA: '#86694e', patchB: '#6a5240', tuft: null, dirt: '#5e4a38', rock: '#5a4a3a', rockHi: '#7a6a5a', flowers: false, crack: '#4a3a2c' },
  guerra: { base: '#9a8a6a', patchA: '#a89878', patchB: '#8a7a5a', tuft: '#7a6a4a', dirt: '#7a6a50', rock: '#6a6458', rockHi: '#8a8478', flowers: false, crack: '#6a5a44' },
};

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ---------------- world ----------------

export function drawGround(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, scene: SceneId = 'konoha'): void {
  const P = SCENES[scene];
  ctx.fillStyle = P.base;
  ctx.fillRect(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4);
  const tx0 = Math.floor((cx - w / 2) / TILE) - 1;
  const tx1 = Math.floor((cx + w / 2) / TILE) + 1;
  const ty0 = Math.floor((cy - h / 2) / TILE) - 1;
  const ty1 = Math.floor((cy + h / 2) / TILE) + 1;
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      const hv = hash(tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      const shade = hv & 7;
      // Soft round patches instead of hard squares so the grid doesn't show.
      if (shade === 0 || shade === 1) {
        ctx.fillStyle = shade === 0 ? P.patchA : P.patchB;
        ctx.beginPath();
        ctx.ellipse(x + 32, y + 32, 44, 30, ((hv >>> 5) & 3) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (((hv >>> 3) & 63) === 0) {
        ctx.fillStyle = P.dirt;
        ctx.beginPath();
        ctx.ellipse(x + 32, y + 32, 30, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (P.tuft && ((hv >>> 9) & 3) === 0) {
        ctx.strokeStyle = P.tuft;
        ctx.lineWidth = 2;
        const gx = x + ((hv >>> 11) & 31) + 10;
        const gy = y + ((hv >>> 16) & 31) + 16;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx - 3, gy - 7);
        ctx.moveTo(gx + 4, gy);
        ctx.lineTo(gx + 4, gy - 9);
        ctx.moveTo(gx + 8, gy);
        ctx.lineTo(gx + 11, gy - 6);
        ctx.stroke();
      }
      if (P.crack && ((hv >>> 9) & 7) === 0) {
        ctx.strokeStyle = P.crack;
        ctx.lineWidth = 2;
        const gx = x + ((hv >>> 11) & 31) + 10;
        const gy = y + ((hv >>> 16) & 31) + 10;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 10, gy + 6);
        ctx.lineTo(gx + 14, gy + 18);
        ctx.moveTo(gx + 10, gy + 6);
        ctx.lineTo(gx + 22, gy + 4);
        ctx.stroke();
      }
      if (P.flowers && ((hv >>> 21) & 15) === 0) {
        ctx.fillStyle = (hv >>> 25) & 1 ? '#f4e285' : '#f7a8c8';
        ctx.fillRect(x + ((hv >>> 26) & 31) + 16, y + ((hv >>> 4) & 31) + 16, 4, 4);
      }
      if (((hv >>> 12) & 127) === 1) {
        ctx.fillStyle = P.rock;
        ctx.beginPath();
        ctx.ellipse(x + 40, y + 30, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = P.rockHi;
        ctx.beginPath();
        ctx.ellipse(x + 37, y + 27, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, t: number, playerX: number): void {
  const white = e.flash > 0;
  if (e.boss) {
    // Nature ring under the boss.
    ctx.strokeStyle = NATURE_COLOR[e.nature];
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.r * 0.9, e.r * 1.1, e.r * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (e.dmgTaken < 1) {
      ctx.fillStyle = 'rgba(180,180,200,0.25)';
      ctx.beginPath();
      ctx.arc(e.x, e.y - e.r * 0.3, e.r * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    drawLook(ctx, LOOKS[e.boss.lookId], e.x, e.y, e.r, playerX < e.x, Math.sin(t * 6) * 1.5, 1, white);
    return;
  }
  const r = e.r;
  const wob = Math.sin(t * 10 + e.x * 0.05) * 1.2;
  const img = minionSprite(e.kind, e.nature, r, white);
  const size = r * 2 + 8;
  ctx.drawImage(img, e.x - size / 2, e.y - size / 2 + wob, size, size);
  if (e.kind === 'brute' && e.hp < e.maxHp) {
    ctx.fillStyle = '#300';
    ctx.fillRect(e.x - r, e.y - r - 8, r * 2, 3);
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(e.x - r, e.y - r - 8, r * 2 * Math.max(0, e.hp / e.maxHp), 3);
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, t: number): void {
  if (p.kind === 'kunai') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#d9dde3';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(1, -3.5);
    ctx.lineTo(1, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(-8, -1.5, 9, 3);
    ctx.strokeStyle = '#3a3f47';
    ctx.beginPath();
    ctx.arc(-10, 0, 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (p.kind === 'fireball') {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.5);
    g.addColorStop(0, p.big ? '#b48cff' : '#fff4c2');
    g.addColorStop(0.5, p.big ? '#3a1050' : '#ff7a2a');
    g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // rasengan
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.6);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(120,200,255,0.95)');
  g.addColorStop(1, 'rgba(40,120,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const a = t * 18 + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.8, a, a + 1.6);
    ctx.stroke();
  }
  if (p.big) {
    // Rasen-shuriken blades
    ctx.fillStyle = 'rgba(220,240,255,0.7)';
    for (let i = 0; i < 4; i++) {
      const a = t * 14 + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(a) * p.r * 3, p.y + Math.sin(a) * p.r * 3);
      ctx.lineTo(p.x + Math.cos(a + 0.35) * p.r * 1.4, p.y + Math.sin(a + 0.35) * p.r * 1.4);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawField(ctx: CanvasRenderingContext2D, f: Field, t: number): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, f.life * 3) * 0.75;
  if (f.style === 'shuriken') {
    ctx.fillStyle = 'rgba(160,215,255,0.25)';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(230,245,255,0.8)';
    for (let i = 0; i < 4; i++) {
      const a = t * 16 + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r);
      ctx.lineTo(f.x + Math.cos(a + 0.3) * f.r * 0.5, f.y + Math.sin(a + 0.3) * f.r * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  } else if (f.style === 'blackfire') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + i;
      const d = f.r * 0.55 * ((i % 3) / 3 + 0.3);
      const fl = 6 + Math.sin(t * 12 + i) * 3;
      ctx.fillStyle = i % 2 ? '#1a0a24' : '#3a1050';
      ctx.beginPath();
      ctx.ellipse(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - fl / 2, 7, fl + 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = 'rgba(216,178,106,0.55)';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * (1 - f.life * 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a8864e';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (0.3 + i * 0.25), t * 5 + i, t * 5 + i + 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard): void {
  if (h.kind === 'bullet') {
    ctx.fillStyle = h.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (h.delay! > 0) {
    // Telegraph: outline + fill growing until it detonates.
    const k = 1 - h.delay! / (h.maxDelay || 1);
    ctx.strokeStyle = h.dmg > 0 ? 'rgba(255,60,60,0.85)' : 'rgba(255,60,60,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,60,60,0.22)';
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r * k, 0, Math.PI * 2);
    ctx.fill();
  } else if (h.linger) {
    ctx.globalAlpha = Math.min(1, h.life * 2) * 0.7;
    ctx.fillStyle = h.color;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPickup(ctx: CanvasRenderingContext2D, pk: Pickup, t: number): void {
  const bob = Math.sin(t * 4 + pk.x) * 1.5;
  const x = pk.x;
  const y = pk.y + bob;
  switch (pk.kind) {
    case 'xp': {
      const c = pk.value >= 20 ? '#ff5a5a' : pk.value >= 5 ? '#5cdc7a' : '#5ab8ff';
      const s = pk.value >= 20 ? 7 : pk.value >= 5 ? 6 : 4.5;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.7, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.7, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x - 1, y - s * 0.6, 2, s * 0.6);
      break;
    }
    case 'ryo':
      ctx.fillStyle = '#e8b923';
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5a00';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      break;
    case 'ramen':
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#f4c06a';
      ctx.fillRect(x - 7, y - 2, 14, 3);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(x - 6, y + 2, 12, 1.5);
      break;
    case 'scroll':
      ctx.fillStyle = '#e9d8a6';
      ctx.fillRect(x - 7, y - 4, 14, 8);
      ctx.fillStyle = '#8b5e3c';
      ctx.fillRect(x - 9, y - 5, 3, 10);
      ctx.fillRect(x + 6, y - 5, 3, 10);
      break;
    case 'biju': {
      // Tailed beast orb: colour by number of tails, tails drawn as little flames.
      const colors = ['#c9a26b', '#4fa8ff', '#7fd0c0', '#e5534b', '#f4f1ea', '#b8e0a0', '#7ad35a', '#b48cff', '#ff8a3c'];
      const c = colors[(pk.value - 1) % colors.length];
      const glow = 0.5 + Math.sin(t * 4) * 0.25;
      ctx.fillStyle = `rgba(255,140,60,${glow * 0.35})`;
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      for (let i = 0; i < pk.value; i++) {
        const a = -Math.PI / 2 + (i - (pk.value - 1) / 2) * 0.35;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 13, y + Math.sin(a) * 13, 3, 6, a + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(pk.value), x, y + 3.5);
      break;
    }
    case 'tenten': {
      // Little weapon stall.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 20, y + 10, 40, 5);
      ctx.fillStyle = '#8b5e3c';
      ctx.fillRect(x - 18, y - 4, 36, 16);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(x - 22, y - 16, 44, 8);
      ctx.fillStyle = '#f4f1ea';
      for (let i = 0; i < 4; i++) ctx.fillRect(x - 20 + i * 11, y - 16, 5, 8);
      ctx.strokeStyle = '#c9d1d9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 2);
      ctx.lineTo(x - 2, y - 6);
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + 12, y - 4);
      ctx.stroke();
      ctx.fillStyle = '#5cc96b';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TENTEN', x, y - 20 + Math.sin(t * 3) * 1.5);
      break;
    }
    case 'pill':
      ctx.fillStyle = '#e5534b';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - 1.5, y - 1.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'chest': {
      const glow = 0.5 + Math.sin(t * 5) * 0.3;
      ctx.fillStyle = `rgba(255,210,63,${glow * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8b5e3c';
      ctx.fillRect(x - 12, y - 6, 24, 14);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x - 13, y - 10, 26, 6);
      ctx.fillRect(x - 2, y - 4, 4, 6);
      break;
    }
  }
}

// ---------------- frame ----------------

export function render(ctx: CanvasRenderingContext2D, g: Game, view: View, input: Input): void {
  const { dpr, zoom } = view;
  const s = dpr * zoom;
  const p = g.player;
  const ww = view.w / zoom;
  const wh = view.h / zoom;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  ctx.setTransform(s, 0, 0, s, W / 2 - p.x * s, H / 2 - p.y * s);
  drawGround(ctx, p.x, p.y, ww, wh, g.scene);

  for (const h of g.hazards) if (h.kind === 'zone') drawHazard(ctx, h);
  for (const f of g.fields) drawField(ctx, f, g.t);
  for (const pk of g.pickups) drawPickup(ctx, pk, g.t);

  for (const w of g.weapons) {
    if (w instanceof SellosWeapon) {
      for (const t of w.tags) {
        ctx.fillStyle = '#efe3c2';
        ctx.fillRect(t.x - 5, t.y - 8, 10, 16);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(t.x - 1, t.y - 6, 2, 12);
        if (t.arm <= 0 && Math.floor(g.t * 6) % 2 === 0) {
          ctx.fillStyle = '#ff3b1f';
          ctx.beginPath();
          ctx.arc(t.x, t.y - 10, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Cull to the visible area plus a margin.
  const left = p.x - ww / 2 - 60;
  const right = p.x + ww / 2 + 60;
  const top = p.y - wh / 2 - 60;
  const bottom = p.y + wh / 2 + 60;
  for (const e of g.enemies) {
    if (e.x < left || e.x > right || e.y < top || e.y > bottom) continue;
    drawEnemy(ctx, e, g.t, p.x);
  }

  const look = LOOKS[g.lookId] ?? LOOKS[g.char.id];
  for (const w of g.weapons) {
    if (w instanceof ClonesWeapon) {
      for (const c of w.clones) drawLook(ctx, look, c.x, c.y, 11, c.facingLeft, Math.sin(c.anim * 14) * 1.2, 0.75);
    }
  }

  // Transformation aura
  const form = g.transform;
  if (form) {
    const pulse = 1 + Math.sin(g.t * 8) * 0.08;
    const grad = ctx.createRadialGradient(p.x, p.y - 4, 4, p.x, p.y - 4, p.r * 2.4 * pulse);
    grad.addColorStop(0, form.aura + 'aa');
    grad.addColorStop(1, form.aura + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 4, p.r * 2.4 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  if (g.pillTime > 0) {
    ctx.strokeStyle = `rgba(229,83,75,${0.5 + Math.sin(g.t * 12) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 2, p.r * 1.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  const blink = p.invuln > 0 && Math.floor(g.t * 20) % 2 === 0;
  drawLook(ctx, look, p.x, p.y, p.r, p.facingX < 0, p.moving ? Math.sin(p.anim * 14) * 1.5 : 0, blink ? 0.4 : 1);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(p.x - 14, p.y + 17, 28, 4);
  ctx.fillStyle = '#5cc96b';
  ctx.fillRect(p.x - 14, p.y + 17, 28 * Math.max(0, p.hp / g.stats.maxHp), 4);

  for (const w of g.weapons) {
    if (w instanceof ArenaWeapon) {
      for (const o of w.orbs) {
        ctx.fillStyle = '#d8b26a';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#efd49a';
        ctx.beginPath();
        ctx.arc(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (const pr of g.projectiles) drawProjectile(ctx, pr, g.t);
  for (const h of g.hazards) if (h.kind === 'bullet') drawHazard(ctx, h);

  for (const fx of g.effects) {
    const k = fx.life / fx.max;
    ctx.globalAlpha = Math.max(0, k);
    if (fx.kind === 'boom') {
      ctx.fillStyle = fx.color;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff4c2';
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r * 0.4 * k, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.kind === 'ring') {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 4 * k + 1;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r * (1.1 - k * 0.4), 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.kind === 'bolt' && fx.pts) {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = fx.r;
      ctx.shadowColor = '#7fd0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(fx.pts[0], fx.pts[1]);
      for (let i = 2; i < fx.pts.length; i += 2) ctx.lineTo(fx.pts[i], fx.pts[i + 1]);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (fx.kind === 'puff') {
      ctx.fillStyle = fx.color;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const d = fx.r * (1 - k);
        ctx.beginPath();
        ctx.arc(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d, fx.r * 0.3 * k + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  for (const tx of g.texts) {
    ctx.font = tx.big ? 'bold 13px system-ui, sans-serif' : 'bold 10px system-ui, sans-serif';
    ctx.globalAlpha = Math.min(1, tx.life * 3);
    ctx.fillStyle = '#000';
    ctx.fillText(tx.text, tx.x + 1, tx.y + 1);
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.text, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;

  drawHud(ctx, g, view, input);
}

// ---------------- HUD (screen space, CSS pixels) ----------------

function drawBossBars(ctx: CanvasRenderingContext2D, g: Game, W: number, top: number): void {
  const bosses = g.enemies.filter((e) => e.boss && !e.dead);
  if (!bosses.length) {
    const next = g.director.nextBoss(g.t);
    if (next) {
      const name = next.ids.length > 1 ? (next.ids[0].startsWith('path') ? 'Los Seis Caminos' : 'Jefes') : BOSSES[next.ids[0] as BossId].name;
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = '#ffb3a8';
      ctx.textAlign = 'center';
      ctx.fillText(`${name} llega en ${formatTime(next.t - g.t)}`, W / 2, 72 + top);
    }
    return;
  }
  const shown = bosses.slice(0, 3);
  const bw = Math.min(320, W - 140);
  shown.forEach((e, i) => {
    const y = 66 + top + i * 22;
    const x = W / 2 - bw / 2;
    ctx.fillStyle = 'rgba(10,14,28,0.8)';
    ctx.fillRect(x - 2, y - 2, bw + 4, 12);
    ctx.fillStyle = '#5a1010';
    ctx.fillRect(x, y, bw, 8);
    ctx.fillStyle = e.dmgTaken < 1 ? '#9aa0b0' : '#e5534b';
    ctx.fillRect(x, y, bw * Math.max(0, e.hp / e.maxHp), 8);
    const hearts = e.boss!.hearts;
    if (hearts) {
      for (let k = 0; k < hearts.length; k++) {
        const sx = x + (bw * k) / hearts.length;
        ctx.fillStyle = NATURE_COLOR[hearts[hearts.length - 1 - k]];
        ctx.fillRect(sx, y + 8, bw / hearts.length - 2, 2);
      }
    }
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText(e.boss!.name, x + 4, y + 7.5);
    ctx.fillStyle = NATURE_COLOR[e.nature];
    ctx.textAlign = 'right';
    ctx.fillText('●', x + bw - 4, y + 7.5);
  });
  if (bosses.length > 3) {
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb3a8';
    ctx.fillText(`+${bosses.length - 3} más`, W / 2, 66 + top + 3 * 22 + 6);
  }
}

function drawEdgeArrows(ctx: CanvasRenderingContext2D, g: Game, view: View): void {
  const p = g.player;
  const hw = view.w / 2;
  const hh = view.h / 2;
  const targets: { x: number; y: number; color: string }[] = [];
  for (const e of g.enemies) if (e.boss && !e.dead) targets.push({ x: e.x, y: e.y, color: '#ff3b3b' });
  for (const pk of g.pickups) {
    if (pk.kind === 'biju') targets.push({ x: pk.x, y: pk.y, color: '#ff8a3c' });
    else if (pk.kind === 'tenten') targets.push({ x: pk.x, y: pk.y, color: '#5cc96b' });
  }
  for (const e of targets) {
    const sx = (e.x - p.x) * view.zoom;
    const sy = (e.y - p.y) * view.zoom;
    if (Math.abs(sx) < hw - 20 && Math.abs(sy) < hh - 20) continue;
    const a = Math.atan2(sy, sx);
    const k = Math.min((hw - 28) / Math.abs(Math.cos(a) || 1e-6), (hh - 28) / Math.abs(Math.sin(a) || 1e-6));
    const x = hw + Math.cos(a) * k;
    const y = hh + Math.sin(a) * k;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game, view: View, input: Input): void {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const W = view.w;
  const H = view.h;

  if (g.tint) {
    const k = g.tint.life / g.tint.max;
    ctx.fillStyle = `rgba(${g.tint.color},${0.35 * Math.min(1, k * 2)})`;
    ctx.fillRect(0, 0, W, H);
  }
  for (const fx of g.effects) {
    if (fx.kind !== 'flash') continue;
    ctx.fillStyle = `rgba(${fx.color},${0.6 * (fx.life / fx.max)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (g.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200,0,0,${g.hurtFlash})`;
    ctx.fillRect(0, 0, W, H);
  }

  // XP bar
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = '#4fb3ff';
  ctx.fillRect(0, 0, W * (g.xp / g.xpNext), 10);

  // Player panel
  ctx.fillStyle = 'rgba(10,14,28,0.75)';
  ctx.beginPath();
  ctx.roundRect(10, 18, 190, 60, 8);
  ctx.fill();
  ctx.fillStyle = g.transform ? g.transform.aura : '#ffd23f';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(g.char.name, 20, 36);
  ctx.fillStyle = '#c9d1d9';
  ctx.textAlign = 'right';
  ctx.fillText(`Nv. ${g.level}`, 190, 36);
  ctx.fillStyle = '#3a1010';
  ctx.fillRect(20, 44, 170, 9);
  ctx.fillStyle = g.player.slow > 0 ? '#b48cff' : '#e5534b';
  ctx.fillRect(20, 44, 170 * Math.max(0, g.player.hp / g.stats.maxHp), 9);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(g.player.hp)} / ${g.stats.maxHp}`, 105, 52);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i < g.biju ? '#ff8a3c' : 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(20 + i * 11, 70, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (g.pillTime > 0) {
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e5534b';
    ctx.fillText(`Píldora ${Math.ceil(g.pillTime)} s`, 122, 74);
  }
  if (g.transform) {
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = g.transform.aura;
    ctx.fillText(g.transform.name, 14, 90);
  }

  // Timer + arc (pushed below the player panel on narrow portrait screens)
  const top = W < 560 ? 76 : 0;
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = '#000';
  ctx.fillText(formatTime(g.t), W / 2 + 1, 39 + top);
  ctx.fillStyle = g.t >= FINAL_TIME ? '#ff5a5a' : '#fff';
  ctx.fillText(formatTime(g.t), W / 2, 38 + top);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = '#c9d1d9';
  ctx.fillText(`${g.arcName} · ${g.kills} derrotados · ${g.ryo} ryō`, W / 2, 54 + top);

  drawBossBars(ctx, g, W, top);
  drawEdgeArrows(ctx, g, view);

  // Banner
  if (g.banner) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, g.banner.life * 2);
    ctx.font = 'bold 24px system-ui, sans-serif';
    const by = H * 0.3;
    ctx.fillStyle = '#000';
    ctx.fillText(g.banner.text, W / 2 + 2, by + 2);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(g.banner.text, W / 2, by);
    if (g.banner.sub) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#000';
      ctx.fillText(g.banner.sub, W / 2 + 1, by + 23);
      ctx.fillStyle = '#fff';
      ctx.fillText(g.banner.sub, W / 2, by + 22);
    }
    ctx.globalAlpha = 1;
  }

  // Jutsu + passive slots
  const size = 40;
  const gap = 6;
  type Slot = { icon: string; color: string; level: number; max: number; evolved?: boolean };
  const slots: Slot[] = g.weapons.map((w) => ({ icon: JUTSUS[w.id].icon, color: w.evolved ? '#ffd23f' : JUTSUS[w.id].color, level: w.level, max: 5, evolved: w.evolved }));
  const pas: Slot[] = [...g.passives.entries()].map(([id, l]) => ({ icon: PASSIVES[id].icon, color: PASSIVES[id].color, level: l, max: 5 }));
  const drawRow = (items: Slot[], y: number, sz: number) => {
    const total = items.length * sz + (items.length - 1) * gap;
    let x = W / 2 - total / 2;
    for (const it of items) {
      ctx.fillStyle = it.evolved ? 'rgba(80,60,0,0.85)' : 'rgba(10,14,28,0.8)';
      ctx.strokeStyle = it.color;
      ctx.lineWidth = it.evolved ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(x, y, sz, sz, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = it.color;
      ctx.font = `bold ${Math.round(sz * 0.5)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(it.icon, x + sz / 2, y + sz * 0.62);
      for (let i = 0; i < it.max; i++) {
        ctx.fillStyle = i < it.level ? '#ffd23f' : 'rgba(255,255,255,0.2)';
        ctx.fillRect(x + 4 + i * ((sz - 8) / it.max), y + sz - 6, (sz - 8) / it.max - 1.5, 3);
      }
      x += sz + gap;
    }
  };
  drawRow(slots, H - size - 12, size);
  if (pas.length) drawRow(pas, H - size - 12 - 34, 28);

  // Touch joystick
  if (input.touch) {
    const t = input.touch;
    const R = Input.STICK_RADIUS;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.ox, t.oy, R, 0, Math.PI * 2);
    ctx.stroke();
    let dx = t.x - t.ox;
    let dy = t.y - t.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(t.ox + dx, t.oy + dy, 20, 0, Math.PI * 2);
    ctx.fill();
  }
}
