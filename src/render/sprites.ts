import type { Look } from '../game/looks';
import { LOOKS } from '../game/looks';
import { NATURE_COLOR } from '../game/natures';
import type { EnemyView } from '../game/view';
import { characterSize, characterSprite, crowSprite, type WalkFrame } from './pixel';

export function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.95, r * 0.85, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Stamps a pixel-art character standing at (x, y) with body radius r. */
export function drawLook(
  ctx: CanvasRenderingContext2D,
  L: Look,
  x: number,
  y: number,
  r: number,
  faceLeft: boolean,
  walk: WalkFrame = 0,
  alpha = 1,
  white = false,
  plate: string | null = null,
): void {
  const { w, h } = characterSize(r);
  const img = characterSprite(L, walk, plate, white);
  ctx.save();
  ctx.globalAlpha = alpha;
  shadow(ctx, x, y, r);
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y + r * 0.95 - h);
  if (faceLeft) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, 0, w, h);
  ctx.restore();
}

/** Portrait drawing (menus): integer pixel scale so the art stays crisp. */
export function drawLookDirect(ctx: CanvasRenderingContext2D, L: Look, x: number, y: number, r: number): void {
  const img = characterSprite(L, 0);
  const px = Math.max(1, Math.floor((r * 2.75) / img.height));
  const w = img.width * px;
  const h = img.height * px;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(x - w / 2), Math.round(y + r * 0.95 - h), w, h);
}

const MINION_LOOK: Record<string, string> = { grunt: 'renegade', brute: 'brute', zetsu: 'zetsu', puppet: 'puppet' };

/** Minions: little pixel ninjas (headband plate in their nature colour), puppets, Zetsu and crows. */
export function drawMinion(ctx: CanvasRenderingContext2D, e: EnemyView, t: number, faceLeft: boolean): void {
  const white = e.flash > 0;
  if (e.kind === 'crow') {
    const img = crowSprite(Math.floor(t * 10 + e.id) % 2 === 0 ? 0 : 1, white);
    const px = (e.r * 2.6) / img.width;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.r * 1.4, e.r * 0.7, e.r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(e.x, e.y - 3 + Math.sin(t * 8 + e.id) * 2);
    if (faceLeft) ctx.scale(-1, 1);
    ctx.drawImage(img, (-img.width * px) / 2, (-img.height * px) / 2, img.width * px, img.height * px);
    ctx.restore();
    return;
  }
  const look = LOOKS[MINION_LOOK[e.kind] ?? 'renegade'];
  const frame = ([1, 0, 2, 0] as const)[Math.floor(t * 7 + e.id * 0.37) % 4];
  drawLook(ctx, look, e.x, e.y, e.r, faceLeft, frame, 1, white, NATURE_COLOR[e.nature]);
}
