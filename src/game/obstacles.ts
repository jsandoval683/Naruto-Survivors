/**
 * Solid obstacles on the map (boulders, trees, pillars…). They are derived from the world
 * coordinates with a hash, so every client and the server agree without sending them.
 */
import type { SceneId } from './timeline';

export interface Obstacle {
  x: number;
  y: number;
  r: number;
  kind: ObstacleKind;
}

export type ObstacleKind = 'boulder' | 'tree' | 'pillar' | 'cactus' | 'crystal' | 'obsidian' | 'stump';

/** World units per obstacle cell (at most one obstacle per cell). */
const CELL = 230;
/** Chance (in %) that a cell has an obstacle. */
const DENSITY = 24;

const KINDS: Record<string, ObstacleKind[]> = {
  desierto: ['boulder', 'cactus', 'boulder'],
  bosque: ['tree', 'tree', 'boulder', 'stump'],
  uchiha: ['pillar', 'boulder', 'pillar'],
  konoha: ['tree', 'boulder', 'stump'],
  crater: ['boulder', 'boulder', 'pillar'],
  guerra: ['boulder', 'pillar', 'stump'],
  dim_lava: ['obsidian', 'obsidian', 'boulder'],
  dim_hielo: ['crystal', 'crystal', 'boulder'],
  dim_gravedad: ['boulder', 'pillar'],
  dim_arena: ['boulder', 'cactus'],
};

function hash(x: number, y: number): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function cellObstacle(cx: number, cy: number, scene: SceneId): Obstacle | null {
  // Keep the spawn area clear.
  if (Math.abs(cx) <= 1 && Math.abs(cy) <= 1) return null;
  const h = hash(cx, cy);
  if (h % 100 >= DENSITY) return null;
  const kinds = KINDS[scene] ?? KINDS.konoha;
  const kind = kinds[(h >>> 8) % kinds.length];
  const r = kind === 'tree' ? 24 : kind === 'pillar' || kind === 'crystal' ? 18 : kind === 'cactus' || kind === 'stump' ? 15 : 20 + ((h >>> 20) % 14);
  const margin = r + 20;
  const ox = margin + ((h >>> 12) % (CELL - margin * 2));
  const oy = margin + ((h >>> 22) % (CELL - margin * 2));
  return { x: cx * CELL + ox, y: cy * CELL + oy, r, kind };
}

/** Obstacles whose cell overlaps the box around (x, y) ± range. */
export function obstaclesNear(x: number, y: number, range: number, scene: SceneId, out: Obstacle[] = []): Obstacle[] {
  out.length = 0;
  const x0 = Math.floor((x - range) / CELL);
  const x1 = Math.floor((x + range) / CELL);
  const y0 = Math.floor((y - range) / CELL);
  const y1 = Math.floor((y + range) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const o = cellObstacle(cx, cy, scene);
      if (o) out.push(o);
    }
  }
  return out;
}

const scratch: Obstacle[] = [];

/** Dev switch (balance simulations): turn collisions off to compare. */
export const obstacleSettings = { enabled: true };

/** Pushes a circle out of any obstacle it overlaps. Returns true if it collided. */
export function collide(body: { x: number; y: number }, r: number, scene: SceneId): boolean {
  if (!obstacleSettings.enabled) return false;
  let hit = false;
  for (const o of obstaclesNear(body.x, body.y, r + 40, scene, scratch)) {
    const dx = body.x - o.x;
    const dy = body.y - o.y;
    const min = o.r + r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2) || 0.001;
    body.x = o.x + (dx / d) * min;
    body.y = o.y + (dy / d) * min;
    hit = true;
  }
  return hit;
}

/** True if a point is inside an obstacle (used to avoid placing items in rocks). */
export function insideObstacle(x: number, y: number, scene: SceneId, pad = 10): boolean {
  for (const o of obstaclesNear(x, y, 60, scene, scratch)) if ((x - o.x) ** 2 + (y - o.y) ** 2 < (o.r + pad) ** 2) return true;
  return false;
}
