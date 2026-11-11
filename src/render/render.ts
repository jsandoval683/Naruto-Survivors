import { Input } from '../core/input';
import { FINAL_TIME } from '../game/game';
import { LOOKS } from '../game/looks';
import { NATURE_COLOR } from '../game/natures';
import { BOSSES, type BossId } from '../game/bosses';
import type { EnemyView, FieldView, HazardView, HeroView, PickupView, ProjectileView, SceneView, SlotView } from '../game/view';
import { bijuSprite, blastSprite, crowSprite, fireballSprite, gemSprite, headSprite, ITEM_SPRITES, jutsuIcon, lionSprite, rasenganSprite, sandOrbSprite, toadSprite, walkFrame } from './pixel';
import { drawLook, drawMinion } from './sprites';

export { drawGround } from './scenery';
import { drawGround } from './scenery';

export interface View {
  w: number; // CSS pixels
  h: number;
  dpr: number;
  zoom: number;
}

/** Pixel font for the HUD (loaded from Google Fonts, with a system fallback). */
export const FONT = "'Pixelify Sans', system-ui, sans-serif";

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Draws a pixel sprite centred at (x, y) with `px` world units per pixel. */
function stamp(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, px: number): void {
  const w = img.width * px;
  const h = img.height * px;
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
}

// ---------------- world ----------------

function drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyView, t: number, playerX: number): void {
  const white = e.flash > 0;
  if (e.boss) {
    // Nature ring under the boss.
    ctx.strokeStyle = NATURE_COLOR[e.nature];
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.r * 0.95, e.r * 1.1, e.r * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (e.dmgTaken < 1) {
      ctx.fillStyle = 'rgba(180,180,200,0.25)';
      ctx.beginPath();
      ctx.arc(e.x, e.y - e.r * 0.3, e.r * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    drawLook(ctx, LOOKS[e.boss.lookId], e.x, e.y, e.r, playerX < e.x, walkFrame(true, t + e.id), 1, white);
    return;
  }
  drawMinion(ctx, e, t, playerX < e.x);
  if (e.kind === 'brute' && e.hp < e.maxHp) {
    const r = e.r;
    ctx.fillStyle = '#300';
    ctx.fillRect(e.x - r, e.y - r * 1.9 - 6, r * 2, 3);
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(e.x - r, e.y - r * 1.9 - 6, r * 2 * Math.max(0, e.hp / e.maxHp), 3);
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: ProjectileView, t: number): void {
  if (p.kind === 'kunai') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    stamp(ctx, ITEM_SPRITES.kunai(), 0, 0, 1.8);
    ctx.restore();
    return;
  }
  if (p.kind === 'lion') {
    const img = lionSprite(Math.floor(t * 10));
    stamp(ctx, img, p.x, p.y, (p.r * 2.6) / img.width);
    return;
  }
  if (p.kind === 'crow') {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (Math.cos(p.angle) < 0) ctx.scale(-1, 1);
    stamp(ctx, crowSprite(Math.floor(t * 12) % 2 === 0 ? 0 : 1), 0, 0, 1.8);
    ctx.restore();
    return;
  }
  if (p.kind === 'fireball') {
    const img = fireballSprite(Math.floor(t * 12), !!p.big);
    stamp(ctx, img, p.x, p.y, (p.r * 2.6) / img.width);
    return;
  }
  const img = rasenganSprite(Math.floor(t * 16), !!p.big);
  ctx.globalAlpha = 0.95;
  stamp(ctx, img, p.x, p.y, (p.r * (p.big ? 3.6 : 2.8)) / img.width);
  ctx.globalAlpha = 1;
}

function drawField(ctx: CanvasRenderingContext2D, f: FieldView, t: number): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, f.life * 3) * 0.8;
  if (f.style === 'shuriken') {
    ctx.fillStyle = 'rgba(160,215,255,0.22)';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    const img = rasenganSprite(Math.floor(t * 16), true);
    stamp(ctx, img, f.x, f.y, (f.r * 1.3) / img.width);
    ctx.fillStyle = '#e8f6ff';
    for (let i = 0; i < 4; i++) {
      const a = t * 16 + (i * Math.PI) / 2;
      for (let k = 0.45; k < 1; k += 0.12) ctx.fillRect(f.x + Math.cos(a) * f.r * k - 2, f.y + Math.sin(a) * f.r * k - 2, 4, 4);
    }
  } else if (f.style === 'blackfire' || f.style === 'fire') {
    const fire = f.style === 'fire';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + i;
      const d = f.r * 0.6 * ((i % 3) / 3 + 0.25);
      const fl = Math.floor((Math.sin(t * 12 + i) + 1) * 2);
      ctx.fillStyle = fire ? (i % 2 ? '#c0391b' : '#ff7a2a') : i % 2 ? '#1a0a24' : '#3a1050';
      ctx.fillRect(f.x + Math.cos(a) * d - 4, f.y + Math.sin(a) * d - 8 - fl * 2, 8, 10 + fl * 2);
      ctx.fillStyle = fire ? '#ffe14d' : '#6b3fa0';
      ctx.fillRect(f.x + Math.cos(a) * d - 2, f.y + Math.sin(a) * d - 10 - fl * 2, 4, 4);
    }
  } else {
    ctx.fillStyle = 'rgba(216,178,106,0.5)';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * (1 - f.life * 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8904a';
    for (let i = 0; i < 18; i++) {
      const a = t * 5 + i * 0.9;
      const d = f.r * (0.2 + (i % 5) * 0.17);
      ctx.fillRect(f.x + Math.cos(a) * d - 2, f.y + Math.sin(a) * d - 2, 4, 4);
    }
  }
  ctx.restore();
}

function drawHazard(ctx: CanvasRenderingContext2D, h: HazardView, t: number): void {
  if (h.kind === 'bullet') {
    stamp(ctx, blastSprite(h.color, Math.max(2, h.r / 2), false), h.x, h.y, 2);
    return;
  }
  if (h.delay! > 0) {
    // Telegraph: outline + fill growing until it detonates.
    const k = 1 - h.delay! / (h.maxDelay || 1);
    const blink = h.delay! < 0.3 && Math.floor(t * 20) % 2 === 0;
    ctx.strokeStyle = h.dmg > 0 ? (blink ? '#ffffff' : 'rgba(255,60,60,0.9)') : 'rgba(255,60,60,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
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
    // Pixel flames on top of burning ground.
    ctx.fillStyle = h.color === '#1a0a24' ? '#6b3fa0' : '#ffb347';
    for (let i = 0; i < 6; i++) {
      const a = i * 1.7 + h.x;
      const fl = Math.floor((Math.sin(t * 10 + i) + 1) * 2);
      ctx.fillRect(h.x + Math.cos(a) * h.r * 0.55 - 2, h.y + Math.sin(a) * h.r * 0.55 - 6 - fl * 2, 4, 6 + fl * 2);
    }
    ctx.globalAlpha = 1;
  }
}

function drawPickup(ctx: CanvasRenderingContext2D, pk: PickupView, t: number): void {
  const bob = Math.round(Math.sin(t * 4 + pk.x) * 1.5);
  const x = pk.x;
  const y = pk.y + bob;
  switch (pk.kind) {
    case 'xp':
      stamp(ctx, gemSprite(pk.value >= 20 ? 'red' : pk.value >= 5 ? 'green' : 'blue'), x, y, pk.value >= 20 ? 2 : pk.value >= 5 ? 1.7 : 1.4);
      break;
    case 'ryo':
      stamp(ctx, ITEM_SPRITES.coin(), x, y, 1.7);
      break;
    case 'ramen':
      stamp(ctx, ITEM_SPRITES.ramen(), x, y, 1.8);
      break;
    case 'scroll':
      stamp(ctx, ITEM_SPRITES.scroll(), x, y, 1.8);
      break;
    case 'pill':
      stamp(ctx, ITEM_SPRITES.pill(), x, y, 2);
      break;
    case 'biju': {
      const glow = 0.5 + Math.sin(t * 4) * 0.25;
      ctx.fillStyle = `rgba(255,140,60,${glow * 0.35})`;
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fill();
      stamp(ctx, bijuSprite(pk.value), x, y, 2.2);
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#160f1c';
      ctx.fillText(String(pk.value), x, y + 4);
      break;
    }
    case 'tenten':
      stamp(ctx, ITEM_SPRITES.stall(), x, y, 2.6);
      ctx.font = `700 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('TENTEN', x + 1, y - 19 + Math.round(Math.sin(t * 3) * 1.5));
      ctx.fillStyle = '#5cc96b';
      ctx.fillText('TENTEN', x, y - 20 + Math.round(Math.sin(t * 3) * 1.5));
      break;
    case 'chest': {
      const glow = 0.5 + Math.sin(t * 5) * 0.3;
      ctx.fillStyle = `rgba(255,210,63,${glow * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      stamp(ctx, ITEM_SPRITES.chest(), x, y, 2);
      break;
    }
  }
}

// ---------------- frame ----------------

function drawHero(ctx: CanvasRenderingContext2D, h: HeroView, t: number, isLocal: boolean, coop: boolean): void {
  const look = LOOKS[h.lookId] ?? LOOKS.naruto;
  if (h.downed) {
    // Downed: lying grey sprite and a revive ring that fills while a teammate stands close.
    drawLook(ctx, look, h.x, h.y, h.r, h.facingX < 0, 0, 0.5, true);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#5cc96b';
    ctx.beginPath();
    ctx.arc(h.x, h.y, 45, -Math.PI / 2, -Math.PI / 2 + h.revive * Math.PI * 2);
    ctx.stroke();
    ctx.font = `bold 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${h.name} · ¡Revíveme!`, h.x, h.y - 30);
    return;
  }
  for (const c of h.clones) drawLook(ctx, look, c.x, c.y, 11, c.facingLeft, walkFrame(true, c.anim), 0.7);

  if (h.aura) {
    const pulse = 1 + Math.sin(t * 8) * 0.08;
    const grad = ctx.createRadialGradient(h.x, h.y - 4, 4, h.x, h.y - 4, h.r * 2.4 * pulse);
    grad.addColorStop(0, h.aura + 'aa');
    grad.addColorStop(1, h.aura + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(h.x, h.y - 4, h.r * 2.4 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  if (h.pillTime > 0) {
    ctx.strokeStyle = `rgba(229,83,75,${0.5 + Math.sin(t * 12) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(h.x, h.y - 2, h.r * 1.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  const blink = h.invuln > 0 && Math.floor(t * 20) % 2 === 0;
  drawLook(ctx, look, h.x, h.y, h.r, h.facingX < 0, walkFrame(h.moving, h.anim), blink ? 0.4 : 1);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(h.x - 14, h.y + 17, 28, 4);
  ctx.fillStyle = isLocal ? '#5cc96b' : '#4fb3ff';
  ctx.fillRect(h.x - 14, h.y + 17, 28 * Math.max(0, h.hp / h.maxHp), 4);
  if (coop && !isLocal) {
    ctx.font = `bold 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(h.name, h.x + 1, h.y - 27);
    ctx.fillStyle = '#bfe8ff';
    ctx.fillText(h.name, h.x, h.y - 28);
  }
  for (const o of h.orbs) stamp(ctx, sandOrbSprite(), o.x, o.y, (o.r * 2.4) / 7);
}

export function render(ctx: CanvasRenderingContext2D, g: SceneView, view: View, input: Input): void {
  const { dpr, zoom } = view;
  const s = dpr * zoom;
  const me = g.heroes[g.localIndex];
  const coop = g.heroes.length > 1;
  const ww = view.w / zoom;
  const wh = view.h / zoom;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // Screen shake on big moments (transformations, arc changes, large explosions).
  let shake = 0;
  for (const fx of g.effects) {
    const k = fx.life / fx.max;
    if (fx.kind === 'flash') shake = Math.max(shake, 5 * k);
    else if ((fx.kind === 'boom' && fx.r >= 100) || (fx.kind === 'ring' && fx.r >= 150)) shake = Math.max(shake, 4 * k);
  }
  const shx = shake ? (Math.random() - 0.5) * shake * 2 : 0;
  const shy = shake ? (Math.random() - 0.5) * shake * 2 : 0;
  ctx.setTransform(s, 0, 0, s, W / 2 - (me.x + shx) * s, H / 2 - (me.y + shy) * s);
  ctx.imageSmoothingEnabled = false;
  drawGround(ctx, me.x, me.y, ww, wh, g.scene);

  for (const h of g.hazards) if (h.kind === 'zone') drawHazard(ctx, h, g.t);
  for (const f of g.fields) drawField(ctx, f, g.t);
  for (const pk of g.pickups) drawPickup(ctx, pk, g.t);

  for (const h of g.heroes) {
    for (const t of h.tags) {
      stamp(ctx, ITEM_SPRITES.tag(), t.x, t.y, 2);
      if (t.arm <= 0 && Math.floor(g.t * 6) % 2 === 0) {
        ctx.fillStyle = '#ff3b1f';
        ctx.beginPath();
        ctx.arc(t.x, t.y - 10, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Cull to the visible area plus a margin.
  const left = me.x - ww / 2 - 60;
  const right = me.x + ww / 2 + 60;
  const top = me.y - wh / 2 - 60;
  const bottom = me.y + wh / 2 + 60;
  for (const e of g.enemies) {
    if (e.x < left || e.x > right || e.y < top || e.y > bottom) continue;
    drawEnemy(ctx, e, g.t, me.x);
  }

  // Teammates first, the local hero on top.
  g.heroes.forEach((h, i) => {
    if (i !== g.localIndex) drawHero(ctx, h, g.t, false, coop);
  });
  drawHero(ctx, me, g.t, true, coop);

  for (const pr of g.projectiles) drawProjectile(ctx, pr, g.t);
  for (const h of g.hazards) if (h.kind === 'bullet') drawHazard(ctx, h, g.t);

  for (const fx of g.effects) {
    const k = fx.life / fx.max;
    ctx.globalAlpha = Math.max(0, k);
    if (fx.kind === 'boom') {
      // Pixel blast in phases: white flash, coloured fire ring, grey smoke, with embers.
      const p = 1 - k;
      const r = fx.r * (0.55 + p * 0.55);
      ctx.globalAlpha = Math.min(1, k * 1.8) * 0.85;
      if (p < 0.3) stamp(ctx, blastSprite('#fff4c2', Math.round((r * 0.7) / 3), false), fx.x, fx.y, 3);
      ctx.globalAlpha *= 0.45;
      stamp(ctx, blastSprite(p < 0.55 ? fx.color : '#7a7a84', Math.round((r * 0.85) / 3), false), fx.x, fx.y, 3);
      ctx.globalAlpha = Math.min(1, k * 1.8) * 0.9;
      stamp(ctx, blastSprite(p < 0.55 ? fx.color : '#9a9aa4', Math.round(r / 3), true), fx.x, fx.y, 3);
      const seed = (fx.x * 13 + fx.y * 7) | 0;
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785 + (seed % 7);
        const d = r * (0.7 + p * 0.7) + ((seed >> i) & 7);
        const sz = p < 0.5 ? 4 : 3;
        ctx.fillStyle = i % 2 ? '#ffd23f' : fx.color;
        ctx.fillRect(Math.round(fx.x + Math.cos(a) * d), Math.round(fx.y + Math.sin(a) * d - p * 6), sz, sz);
      }
    } else if (fx.kind === 'ring') {
      const r = fx.r * (1.1 - k * 0.4);
      stamp(ctx, blastSprite(fx.color, Math.round(r / 3), true), fx.x, fx.y, 3);
    } else if (fx.kind === 'drop') {
      // Shadow of a falling summon, growing until it lands.
      const p = 1 - k;
      ctx.globalAlpha = 0.25 + p * 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(fx.x, fx.y, fx.r * (0.3 + p * 0.7), fx.r * (0.15 + p * 0.35), 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.kind === 'toad') {
      const img = toadSprite();
      const p = 1 - k;
      ctx.globalAlpha = Math.min(1, k * 3);
      stamp(ctx, img, fx.x, fx.y - fx.r * 0.25 - (p < 0.15 ? (0.15 - p) * 300 : 0), (fx.r * 1.5) / img.width);
    } else if (fx.kind === 'shadow' && fx.pts) {
      // Shikamaru's shadow: a thick dark band snaking along the ground.
      ctx.globalAlpha = Math.min(1, k * 2) * 0.85;
      ctx.strokeStyle = fx.color;
      ctx.lineCap = 'round';
      ctx.lineWidth = 6;
      ctx.beginPath();
      const [x1, y1, x2, y2] = fx.pts;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo((x1 + x2) / 2 + (y2 - y1) * 0.15, (y1 + y2) / 2 - (x2 - x1) * 0.15, x2, y2);
      ctx.stroke();
      ctx.lineCap = 'butt';
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
      // Pixel smoke: chunks drift outwards and up while shrinking.
      const p = 1 - k;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const d = fx.r * (0.3 + p * 0.8);
        const sz = Math.max(2, Math.round((fx.r * 0.5 * k + 2) / 2) * 2);
        ctx.fillStyle = i % 2 ? fx.color : '#9aa0a8';
        ctx.fillRect(Math.round(fx.x + Math.cos(a) * d - sz / 2), Math.round(fx.y + Math.sin(a) * d * 0.8 - sz / 2 - p * 10), sz, sz);
      }
    }
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#160f1c';
  for (const tx of g.texts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, tx.life * 3));
    // Fresh damage numbers come with a little pixel hit spark.
    if (tx.life > 0.42 && tx.color !== '#ff5a5a' && tx.color !== '#5cc96b') {
      const p = (0.6 - tx.life) * 40;
      ctx.fillStyle = tx.big ? '#ffd23f' : '#ffffff';
      const cy = tx.y + 8;
      ctx.fillRect(tx.x - 1, cy - 3 - p, 2, 2);
      ctx.fillRect(tx.x - 1, cy + 1 + p, 2, 2);
      ctx.fillRect(tx.x - 3 - p, cy - 1, 2, 2);
      ctx.fillRect(tx.x + 1 + p, cy - 1, 2, 2);
    }
    ctx.font = tx.big ? `700 13px ${FONT}` : `700 10px ${FONT}`;
    ctx.strokeText(tx.text, tx.x, tx.y);
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.text, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;

  drawHud(ctx, g, view, input);
}

// ---------------- HUD (screen space, CSS pixels) ----------------

/** Panel with a dark outer edge and a light inner bevel, pixel-style. */
function pixelPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = 'rgba(20,26,48,0.88)'): void {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = '#160f1c';
  ctx.fillRect(x - 2, y, w + 4, h);
  ctx.fillRect(x, y - 2, w, h + 4);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
}

/** Bar with a dark track, pixel segments and a highlight line. */
function pixelBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string, track = '#3a1010'): void {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = '#160f1c';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = track;
  ctx.fillRect(x, y, w, h);
  const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x, y, fw, Math.max(1, Math.floor(h / 3)));
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let sx = x + 8; sx < x + fw; sx += 8) ctx.fillRect(sx, y, 1, h);
}

const HEART = ['.oo.oo.', 'orrorro', 'orwrrro', 'orrrrro', '.orrro.', '..oro..', '...o...'];
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, px: number): void {
  const pal: Record<string, string> = { o: '#160f1c', r: '#e5534b', w: '#ffd0d0' };
  HEART.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (!pal[ch]) return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x + i * px, y + j * px, px, px);
    }),
  );
}

function drawBossBars(ctx: CanvasRenderingContext2D, g: SceneView, W: number, top: number): void {
  const bosses = g.enemies.filter((e) => e.boss);
  if (!bosses.length) {
    const next = g.nextBoss;
    if (next) {
      const name = next.ids.length > 1 ? (next.ids[0].startsWith('path') ? 'Los Seis Caminos' : 'Jefes') : BOSSES[next.ids[0] as BossId].name;
      ctx.font = `11px ${FONT}`;
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
    pixelBar(ctx, x, y, bw, 8, e.hp / e.maxHp, e.dmgTaken < 1 ? '#9aa0b0' : '#e5534b', '#4a0e0e');
    const hearts = e.boss!.hearts;
    if (hearts) {
      for (let k = 0; k < hearts.length; k++) {
        const sx = x + (bw * k) / hearts.length;
        ctx.fillStyle = NATURE_COLOR[hearts[hearts.length - 1 - k]];
        ctx.fillRect(sx, y + 8, bw / hearts.length - 2, 2);
      }
    }
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#160f1c';
    ctx.strokeText(e.boss!.name, x + 4, y + 7.5);
    ctx.fillStyle = '#fff';
    ctx.fillText(e.boss!.name, x + 4, y + 7.5);
    ctx.fillStyle = NATURE_COLOR[e.nature];
    ctx.textAlign = 'right';
    ctx.fillText('●', x + bw - 4, y + 7.5);
  });
  if (bosses.length > 3) {
    ctx.font = `10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb3a8';
    ctx.fillText(`+${bosses.length - 3} más`, W / 2, 66 + top + 3 * 22 + 6);
  }
}

function drawEdgeArrows(ctx: CanvasRenderingContext2D, g: SceneView, view: View): void {
  const p = g.heroes[g.localIndex];
  const hw = view.w / 2;
  const hh = view.h / 2;
  const targets: { x: number; y: number; color: string }[] = [];
  for (const e of g.enemies) if (e.boss) targets.push({ x: e.x, y: e.y, color: '#ff3b3b' });
  for (const pk of g.pickups) {
    if (pk.kind === 'biju') targets.push({ x: pk.x, y: pk.y, color: '#ff8a3c' });
    else if (pk.kind === 'tenten') targets.push({ x: pk.x, y: pk.y, color: '#5cc96b' });
  }
  g.heroes.forEach((h, i) => {
    if (i !== g.localIndex) targets.push({ x: h.x, y: h.y, color: h.downed ? '#ffffff' : '#4fb3ff' });
  });
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

function drawHud(ctx: CanvasRenderingContext2D, g: SceneView, view: View, input: Input): void {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const W = view.w;
  const H = view.h;
  const me = g.heroes[g.localIndex];

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
  if (me.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200,0,0,${me.hurtFlash})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (me.downed) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText('Has caído: un compañero puede revivirte', W / 2, H * 0.62);
  }

  // XP bar (chakra)
  pixelBar(ctx, 1, 1, W - 2, 7, g.xp / g.xpNext, '#4fb3ff', 'rgba(10,14,28,0.85)');

  // Player panel: portrait, name, level, HP and bijū collected.
  ctx.imageSmoothingEnabled = false;
  pixelPanel(ctx, 12, 18, 196, 60);
  pixelPanel(ctx, 18, 24, 40, 48, me.aura ? `${me.aura}55` : 'rgba(60,80,140,0.6)');
  const head = headSprite(LOOKS[me.lookId] ?? LOOKS.naruto);
  ctx.drawImage(head, 38 - head.width, 30, head.width * 2, head.height * 2);
  ctx.textAlign = 'left';
  ctx.font = `700 13px ${FONT}`;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#160f1c';
  ctx.strokeText(me.charName, 66, 35);
  ctx.fillStyle = me.aura ?? '#ffd23f';
  ctx.fillText(me.charName, 66, 35);
  ctx.fillStyle = '#c9d1d9';
  ctx.textAlign = 'right';
  ctx.font = `700 11px ${FONT}`;
  ctx.fillText(`Nv. ${g.level}`, 200, 35);
  drawHeart(ctx, 64, 41, 2);
  pixelBar(ctx, 82, 43, 116, 9, me.hp / me.maxHp, me.slow > 0 ? '#b48cff' : '#e5534b');
  ctx.fillStyle = '#fff';
  ctx.font = `700 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.strokeText(`${Math.ceil(me.hp)}/${me.maxHp}`, 140, 51);
  ctx.fillText(`${Math.ceil(me.hp)}/${me.maxHp}`, 140, 51);
  for (let i = 0; i < 9; i++) {
    const bx = 66 + i * 14;
    ctx.fillStyle = '#160f1c';
    ctx.fillRect(bx - 1, 59, 10, 10);
    ctx.fillStyle = i < g.biju ? '#ff8a3c' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx, 60, 8, 8);
    if (i < g.biju) {
      ctx.fillStyle = '#ffd9a0';
      ctx.fillRect(bx, 60, 3, 3);
    }
  }
  if (me.pillTime > 0) {
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.strokeText(`Píldora ${Math.ceil(me.pillTime)} s`, 214, 74);
    ctx.fillStyle = '#e5534b';
    ctx.fillText(`Píldora ${Math.ceil(me.pillTime)} s`, 214, 74);
  }
  let panelBottom = 80;
  if (me.formName) {
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.strokeText(me.formName, 14, 92);
    ctx.fillStyle = me.aura!;
    ctx.fillText(me.formName, 14, 92);
    panelBottom = 96;
  }
  // Teammates
  g.heroes.forEach((h, i) => {
    if (i === g.localIndex) return;
    const y = panelBottom + 6;
    panelBottom += 16;
    pixelPanel(ctx, 12, y, 150, 13);
    ctx.fillStyle = h.downed ? '#777' : '#4fb3ff';
    ctx.fillRect(14, y + 10, 146 * Math.max(0, h.hp / h.maxHp), 2);
    ctx.font = `bold 9px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = h.downed ? '#ff8a8a' : '#e6edf5';
    ctx.fillText(`${h.name} · ${h.charName}${h.downed ? ' (caído)' : ''}`, 14, y + 8);
  });

  // Timer + arc (pushed below the player panel on narrow portrait screens)
  const top = W < 560 ? panelBottom - 2 : 0;
  ctx.textAlign = 'center';
  ctx.font = `700 26px ${FONT}`;
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#160f1c';
  ctx.strokeText(formatTime(g.t), W / 2, 39 + top);
  ctx.fillStyle = g.t >= FINAL_TIME ? '#ff5a5a' : '#fff';
  ctx.fillText(formatTime(g.t), W / 2, 39 + top);
  ctx.font = `600 11px ${FONT}`;
  ctx.lineWidth = 3;
  ctx.strokeText(`${g.arcName} · ${g.kills} derrotados · ${g.ryo} ryō`, W / 2, 55 + top);
  ctx.fillStyle = '#c9d1d9';
  ctx.fillText(`${g.arcName} · ${g.kills} derrotados · ${g.ryo} ryō`, W / 2, 55 + top);

  drawBossBars(ctx, g, W, top);
  drawEdgeArrows(ctx, g, view);

  // Banner
  if (g.banner) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.max(0, Math.min(1, g.banner.life * 2));
    ctx.font = `700 26px ${FONT}`;
    const by = H * 0.3;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#160f1c';
    ctx.strokeText(g.banner.text, W / 2, by);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(g.banner.text, W / 2, by);
    if (g.banner.sub) {
      ctx.font = `600 13px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeText(g.banner.sub, W / 2, by + 22);
      ctx.fillStyle = '#fff';
      ctx.fillText(g.banner.sub, W / 2, by + 22);
    }
    ctx.globalAlpha = 1;
  }

  // Jutsu + passive slots
  const size = 40;
  const gap = 6;
  const drawRow = (items: SlotView[], y: number, sz: number) => {
    const total = items.length * sz + (items.length - 1) * gap;
    let x = W / 2 - total / 2;
    for (const it of items) {
      pixelPanel(ctx, x, y, sz, sz, it.evolved ? 'rgba(110,80,0,0.9)' : 'rgba(20,26,48,0.88)');
      ctx.fillStyle = it.color;
      ctx.fillRect(Math.round(x), Math.round(y), sz, 2);
      const icon = it.id ? jutsuIcon(it.id) : null;
      if (icon) {
        const px = Math.max(1, Math.floor((sz - 8) / 16));
        ctx.drawImage(icon, Math.round(x + sz / 2 - 8 * px), Math.round(y + sz / 2 - 8 * px - 2), 16 * px, 16 * px);
      } else {
        ctx.fillStyle = it.color;
        ctx.font = `700 ${Math.round(sz * 0.5)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(it.icon, x + sz / 2, y + sz * 0.6);
      }
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < it.level ? '#ffd23f' : 'rgba(255,255,255,0.18)';
        ctx.fillRect(Math.round(x + 4 + i * ((sz - 8) / 5)), Math.round(y + sz - 6), Math.floor((sz - 8) / 5) - 1, 3);
      }
      x += sz + gap;
    }
  };
  drawRow(me.slots, H - size - 12, size);
  if (me.passives.length) drawRow(me.passives, H - size - 12 - 34, 28);

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
