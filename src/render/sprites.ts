import type { Look } from '../game/looks';
import { NATURE_COLOR, type Nature } from '../game/natures';
import type { EnemyKind } from '../game/types';

// Vector drawing is too slow for hundreds of entities, so each look is drawn
// once into an offscreen canvas (plus a white "hit" variant) and stamped with drawImage.
const SCALE = 3;
const cache = new Map<string, HTMLCanvasElement>();

function makeSprite(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, c: number) => void): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.ceil(size * SCALE);
  c.height = Math.ceil(size * SCALE);
  const ctx = c.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  draw(ctx, size / 2);
  cache.set(key, c);
  return c;
}

function whiteVariant(key: string, src: HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, 0, c.width, c.height);
  cache.set(key, c);
  return c;
}

export function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- characters & bosses ----------------

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#c0141b';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = s * 0.15;
  ctx.beginPath();
  ctx.ellipse(x - s * 0.35, y, s * 0.45, s * 0.32, 0, 0, Math.PI * 2);
  ctx.ellipse(x + s * 0.3, y - s * 0.05, s * 0.5, s * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();
}

function drawLookShape(ctx: CanvasRenderingContext2D, L: Look, r: number, cx: number, cy: number): void {
  shadow(ctx, cx, cy, r);
  ctx.save();
  ctx.translate(cx, cy);
  const headY = -r * 0.62;
  const headR = r * 0.6;

  // things behind the body
  if (L.extra === 'gourd') {
    ctx.fillStyle = '#c9a26b';
    ctx.beginPath();
    ctx.ellipse(-r * 0.55, -r * 0.05, r * 0.45, r * 0.6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  if (L.hairStyle === 'long') {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, headY);
    ctx.lineTo(-r * 0.95, r * 0.7);
    ctx.lineTo(-r * 0.3, r * 0.45);
    ctx.lineTo(0, r * 0.75);
    ctx.lineTo(r * 0.3, r * 0.45);
    ctx.lineTo(r * 0.95, r * 0.7);
    ctx.lineTo(r * 0.75, headY);
    ctx.closePath();
    ctx.fill();
  }
  if (L.hairStyle === 'ponytail') {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.ellipse(-r * 0.6, -r * 0.1, r * 0.22, r * 0.6, 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // legs
  ctx.fillStyle = L.bottom;
  ctx.fillRect(-r * 0.55, r * 0.55, r * 0.4, r * 0.45);
  ctx.fillRect(r * 0.15, r * 0.55, r * 0.4, r * 0.45);
  if (L.id === 'lee') {
    ctx.fillStyle = '#f39c32';
    ctx.fillRect(-r * 0.55, r * 0.75, r * 0.4, r * 0.2);
    ctx.fillRect(r * 0.15, r * 0.75, r * 0.4, r * 0.2);
  }

  // body
  if (L.cloak) {
    ctx.fillStyle = '#121216';
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, r * 0.95);
    ctx.lineTo(-r * 0.7, -r * 0.25);
    ctx.lineTo(r * 0.7, -r * 0.25);
    ctx.lineTo(r * 0.8, r * 0.95);
    ctx.closePath();
    ctx.fill();
    drawCloud(ctx, -r * 0.3, r * 0.15, r * 0.45);
    drawCloud(ctx, r * 0.35, r * 0.6, r * 0.38);
    // high collar
    ctx.fillStyle = '#121216';
    ctx.fillRect(-r * 0.55, -r * 0.45, r * 1.1, r * 0.3);
  } else {
    ctx.fillStyle = L.top;
    ctx.beginPath();
    ctx.roundRect(-r * 0.75, -r * 0.2, r * 1.5, r * 0.95, r * 0.3);
    ctx.fill();
    if (L.id === 'naruto') {
      ctx.fillStyle = '#222';
      ctx.fillRect(-r * 0.75, -r * 0.2, r * 1.5, r * 0.25);
    }
    if (L.id === 'kakashi') {
      ctx.fillStyle = '#3d5530';
      ctx.fillRect(-r * 0.55, -r * 0.05, r * 0.35, r * 0.4);
      ctx.fillRect(r * 0.2, -r * 0.05, r * 0.35, r * 0.4);
    }
    if (L.id === 'sasuke') {
      ctx.fillStyle = '#6b3fa0';
      ctx.fillRect(-r * 0.75, r * 0.35, r * 1.5, r * 0.15);
    }
    if (L.id === 'madara') {
      ctx.fillStyle = '#5a1010';
      for (let i = 0; i < 3; i++) ctx.fillRect(-r * 0.75, -r * 0.05 + i * r * 0.25, r * 1.5, r * 0.08);
    }
  }

  // head
  if (L.hairStyle === 'hood') {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.arc(0, headY, headR * 1.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = L.skin;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // hair
  ctx.fillStyle = L.hair;
  switch (L.hairStyle) {
    case 'spiky':
    case 'long': {
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.6);
      const spikes = 6;
      for (let i = 0; i <= spikes; i++) {
        const a = Math.PI + (i / spikes) * Math.PI;
        const len = i % 2 === 0 ? r * 1.05 : r * 0.7;
        ctx.lineTo(Math.cos(a) * len, -r * 0.75 + Math.sin(a) * len * 0.8);
      }
      ctx.lineTo(r * 0.7, -r * 0.6);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'tall': {
      ctx.beginPath();
      ctx.moveTo(-r * 0.65, -r * 0.6);
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(-r * 0.5 + i * r * 0.3 - r * 0.35, -r * 1.75 + i * r * 0.12);
        ctx.lineTo(-r * 0.5 + i * r * 0.3, -r * 1.05);
      }
      ctx.lineTo(r * 0.65, -r * 0.6);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'bob':
      ctx.beginPath();
      ctx.arc(0, headY - r * 0.05, headR * 1.08, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-headR * 1.08, headY - r * 0.05, headR * 0.35, headR * 1.1);
      ctx.fillRect(headR * 0.73, headY - r * 0.05, headR * 0.35, headR * 1.1);
      break;
    case 'bowl':
      ctx.beginPath();
      ctx.arc(0, headY - r * 0.02, headR * 1.08, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-headR * 1.08, headY - r * 0.05, headR * 2.16, headR * 0.35);
      ctx.fillRect(-headR * 1.08, headY - r * 0.05, headR * 0.3, headR * 0.9);
      break;
    case 'ponytail':
    case 'slick':
    case 'bun':
      ctx.beginPath();
      ctx.ellipse(-r * 0.05, headY - r * 0.12, headR * 1.05, headR * 0.75, 0, Math.PI, 0);
      ctx.fill();
      if (L.hairStyle === 'bun') {
        ctx.beginPath();
        ctx.arc(0, headY - headR * 1.05, headR * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      if (L.id === 'deidara') {
        // long bang over one eye
        ctx.fillRect(r * 0.05, headY - r * 0.3, r * 0.45, r * 0.65);
      }
      break;
  }

  // headband
  if (L.band) {
    ctx.fillStyle = L.band;
    ctx.fillRect(-r * 0.62, -r * 0.88, r * 1.24, r * 0.22);
    ctx.fillStyle = '#c9d1d9';
    ctx.fillRect(-r * 0.05, -r * 0.9, r * 0.5, r * 0.26);
    if (L.id === 'kakashi') {
      ctx.fillStyle = L.band;
      ctx.fillRect(r * 0.15, -r * 0.72, r * 0.35, r * 0.18);
    }
  }

  // eye
  ctx.fillStyle = L.eye;
  ctx.fillRect(r * 0.25, -r * 0.6, r * 0.13, r * 0.15);
  if (L.id !== 'deidara' && L.id !== 'kakashi') ctx.fillRect(-r * 0.12, -r * 0.6, r * 0.13, r * 0.15);

  if (L.extra === 'brows') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-r * 0.2, -r * 0.72, r * 0.25, r * 0.1);
    ctx.fillRect(r * 0.2, -r * 0.72, r * 0.25, r * 0.1);
  }
  if (L.mask) {
    ctx.fillStyle = L.mask;
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0.15, Math.PI - 0.15);
    ctx.fill();
  }
  if (L.extra === 'whiskers') {
    ctx.strokeStyle = '#8a5a3a';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(r * 0.2, -r * 0.38 + i * r * 0.08);
      ctx.lineTo(r * 0.48, -r * 0.4 + i * r * 0.1);
    }
    ctx.stroke();
  }
  if (L.extra === 'piercings') {
    ctx.fillStyle = '#888';
    for (const [px, py] of [[0.05, -0.38], [0.3, -0.35], [0.4, -0.45], [-0.1, -0.35]]) {
      ctx.beginPath();
      ctx.arc(r * px, r * py, r * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (L.extra === 'cracks') {
    ctx.strokeStyle = 'rgba(60,40,30,0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.9);
    ctx.lineTo(-r * 0.25, -r * 0.6);
    ctx.lineTo(-r * 0.35, -r * 0.35);
    ctx.moveTo(r * 0.45, -r * 0.5);
    ctx.lineTo(r * 0.3, -r * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

export function lookSprite(L: Look, r: number, white = false): HTMLCanvasElement {
  const size = r * 2 + r * 1.6;
  const base = makeSprite(`look:${L.id}:${r}`, size, (ctx, c) => drawLookShape(ctx, L, r, c, c + r * 0.15));
  return white ? whiteVariant(`look:${L.id}:${r}:w`, base) : base;
}

/** Stamp a character sprite centred on (x, y). */
export function drawLook(ctx: CanvasRenderingContext2D, L: Look, x: number, y: number, r: number, faceLeft: boolean, bob = 0, alpha = 1, white = false): void {
  const img = lookSprite(L, r, white);
  const size = r * 2 + r * 1.6;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + bob - r * 0.15);
  if (faceLeft) ctx.scale(-1, 1);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** Unscaled one-off drawing (menu portraits). */
export function drawLookDirect(ctx: CanvasRenderingContext2D, L: Look, x: number, y: number, r: number): void {
  drawLookShape(ctx, L, r, x, y);
}

// ---------------- minions ----------------

function drawMinionShape(ctx: CanvasRenderingContext2D, kind: EnemyKind, nature: Nature, r: number, x: number, y: number): void {
  shadow(ctx, x, y, r * 0.85);
  ctx.save();
  ctx.translate(x, y - 1);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#1a1a1a';
  const plate = NATURE_COLOR[nature];
  if (kind === 'puppet') {
    ctx.fillStyle = '#8b5e3c';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#4a2f1c';
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.stroke();
    ctx.fillStyle = plate;
    ctx.fillRect(-r * 0.5, -r * 0.45, r * 0.25, r * 0.25);
    ctx.fillRect(r * 0.25, -r * 0.45, r * 0.25, r * 0.25);
  } else if (kind === 'crow') {
    ctx.fillStyle = '#16161c';
    ctx.beginPath();
    ctx.moveTo(-r * 1.5, -r * 0.3);
    ctx.lineTo(0, r * 0.2);
    ctx.lineTo(r * 1.5, -r * 0.3);
    ctx.lineTo(0, -r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.6, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e01b1b';
    ctx.fillRect(r * 0.1, -r * 0.4, r * 0.25, r * 0.2);
  } else if (kind === 'zetsu') {
    ctx.fillStyle = '#ecebe4';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#b8b5a8';
    ctx.beginPath();
    ctx.arc(-r * 0.1, -r * 0.25, r * 0.35, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(-r * 0.4, -r * 0.1, r * 0.2, r * 0.2);
    ctx.fillRect(r * 0.2, -r * 0.1, r * 0.2, r * 0.2);
    ctx.fillStyle = plate;
    ctx.fillRect(-r * 0.15, r * 0.35, r * 0.3, r * 0.15);
  } else {
    ctx.fillStyle = kind === 'brute' ? '#6b4a3a' : '#5b6170';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // slashed headband = renegade; plate colour = nature
    ctx.fillStyle = '#2c2c34';
    ctx.fillRect(-r * 0.9, -r * 0.55, r * 1.8, r * 0.32);
    ctx.fillStyle = plate;
    ctx.fillRect(-r * 0.3, -r * 0.6, r * 0.6, r * 0.42);
    ctx.strokeStyle = '#2c2c34';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.2);
    ctx.lineTo(r * 0.3, -r * 0.6);
    ctx.stroke();
    ctx.fillStyle = '#ffe66b';
    ctx.fillRect(-r * 0.4, -r * 0.05, r * 0.2, r * 0.15);
    ctx.fillRect(r * 0.2, -r * 0.05, r * 0.2, r * 0.15);
  }
  ctx.restore();
}

export function minionSprite(kind: EnemyKind, nature: Nature, r: number, white: boolean): HTMLCanvasElement {
  const base = makeSprite(`m:${kind}:${nature}:${r}`, r * 2 + 8, (ctx, c) => drawMinionShape(ctx, kind, nature, r, c, c));
  return white ? whiteVariant(`m:${kind}:${nature}:${r}:w`, base) : base;
}
