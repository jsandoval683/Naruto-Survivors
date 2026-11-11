/** Pixel-art ground for each arc: generated tiles plus scattered decorations. */
import type { SceneId } from '../game/timeline';
import { cached, fromRows, shade } from './pixel';

const TILE_PX = 32; // native pixels per tile
export const TILE = 64; // world units per tile (2 world units per pixel)
const PX = TILE / TILE_PX;
const VARIANTS = 4;

interface Palette {
  base: string;
  dither: [string, string];
  tuft: string | null;
  crack: string | null;
  ripple: string | null;
  decor: DecorId[];
}

type DecorId = 'tree' | 'pine' | 'bush' | 'rock' | 'flowers' | 'cactus' | 'drybush' | 'pillar' | 'rubble' | 'crater' | 'spear' | 'patch' | 'dune' | 'stump' | 'skull';

const SCENES: Record<SceneId, Palette> = {
  desierto: { base: '#d9b77a', dither: ['#e3c68e', '#c9a468'], tuft: null, crack: null, ripple: '#e8d09c', decor: ['dune', 'dune', 'rock', 'cactus', 'drybush', 'skull', 'rock'] },
  bosque: { base: '#2f5a2a', dither: ['#356530', '#284d24'], tuft: '#4a8a3c', crack: null, ripple: null, decor: ['pine', 'tree', 'bush', 'bush', 'rock', 'flowers', 'patch', 'stump'] },
  uchiha: { base: '#3a3540', dither: ['#433d4a', '#322e38'], tuft: null, crack: '#26232b', ripple: null, decor: ['pillar', 'rubble', 'rubble', 'rock', 'crater'] },
  konoha: { base: '#3d6b33', dither: ['#457a39', '#36602e'], tuft: '#5a9a48', crack: null, ripple: null, decor: ['tree', 'bush', 'flowers', 'flowers', 'rock', 'patch', 'stump'] },
  crater: { base: '#7a6048', dither: ['#86694e', '#6a5240'], tuft: null, crack: '#4a3a2c', ripple: null, decor: ['crater', 'rubble', 'rubble', 'rock', 'pillar'] },
  guerra: { base: '#9a8a6a', dither: ['#a89878', '#8a7a5a'], tuft: '#7a6a4a', crack: '#6a5a44', ripple: null, decor: ['spear', 'rubble', 'crater', 'rock', 'skull', 'spear'] },
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

function tileSprite(scene: SceneId, v: number): HTMLCanvasElement {
  return cached(`tile:${scene}:${v}`, () => {
    const P = SCENES[scene];
    const c = document.createElement('canvas');
    c.width = TILE_PX;
    c.height = TILE_PX;
    const ctx = c.getContext('2d')!;
    const r = rng(1000 + v * 77 + scene.length * 13);
    ctx.fillStyle = P.base;
    ctx.fillRect(0, 0, TILE_PX, TILE_PX);
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const n = r();
        if (n < 0.09) {
          ctx.fillStyle = P.dither[0];
          ctx.fillRect(x, y, 1, 1);
        } else if (n < 0.15) {
          ctx.fillStyle = P.dither[1];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    if (P.tuft) {
      for (let i = 0; i < 3; i++) {
        const x = 2 + Math.floor(r() * (TILE_PX - 6));
        const y = 3 + Math.floor(r() * (TILE_PX - 6));
        ctx.fillStyle = P.tuft;
        ctx.fillRect(x, y, 1, 2);
        ctx.fillRect(x + 2, y - 1, 1, 3);
        ctx.fillRect(x + 4, y, 1, 2);
        ctx.fillStyle = shade(P.tuft, 1.25);
        ctx.fillRect(x + 2, y - 1, 1, 1);
      }
    }
    if (P.ripple) {
      ctx.fillStyle = P.ripple;
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(r() * (TILE_PX - 8));
        const y = Math.floor(r() * TILE_PX);
        ctx.fillRect(x, y, 4 + Math.floor(r() * 4), 1);
      }
    }
    if (P.crack && v % 2 === 0) {
      ctx.fillStyle = P.crack;
      let x = Math.floor(r() * TILE_PX);
      let y = Math.floor(r() * TILE_PX);
      for (let i = 0; i < 14; i++) {
        ctx.fillRect(x, y, 1, 1);
        x += r() < 0.5 ? 1 : 0;
        y += r() < 0.6 ? 1 : -0;
      }
    }
    return c;
  });
}

const O = '#160f1c';

const DECOR: Record<DecorId, () => HTMLCanvasElement> = {
  tree: () =>
    cached('d:tree', () =>
      fromRows(
        [
          '......oooooo......',
          '....oollllllo.....',
          '...ollgggllllo....',
          '..olgggggggglo....',
          '.olgggggggggggo...',
          '.oggggdgggggggo...',
          'olgggdddggggggdo..',
          'oggggddggggdggdo..',
          'oggggggggggddgdo..',
          '.oggggggggggdddo..',
          '.odggggggggddddo..',
          '..oddggggddddddo..',
          '...odddddddddoo...',
          '....ooodbboooo....',
          '.......obbo.......',
          '.......obbo.......',
          '......obbbbo......',
          '.....oooooooo.....',
        ],
        { o: O, l: '#7fc65a', g: '#4f9a3a', d: '#336b28', b: '#6a4a2a' },
      ),
    ),
  pine: () =>
    cached('d:pine', () =>
      fromRows(
        ['.....oo.....', '....oggo....', '...oggggo...', '...ogdggo...', '..oggggggo..', '..ogggdggo..', '.oggggggggo.', '.oggdggggdo.', 'oggggggggggo', 'oooooggooooo', '.....obo....', '....oooo....'],
        { o: O, g: '#2f7a3a', d: '#1f5228', b: '#5a3a22' },
      ),
    ),
  bush: () => cached('d:bush', () => fromRows(['...oooo...', '.oollgoo..', 'olggggggo.', 'oggggdggo.', 'ogdgggggdo', '.oooooooo.'], { o: O, l: '#7fc65a', g: '#4f9a3a', d: '#336b28' })),
  rock: () => cached('d:rock', () => fromRows(['..oooo...', '.ollggo..', 'olgggggo.', 'ogggddgo.', '.oooooo..'], { o: O, l: '#b4b8be', g: '#8a8e96', d: '#6a6e76' })),
  flowers: () => cached('d:flowers', () => fromRows(['.p...y.', 'pwp.yoy', '.p.g.y.', '..g.g..'], { p: '#f7a8c8', w: '#fff3b0', y: '#f4e285', o: '#e8a13a', g: '#3d7a2e' })),
  cactus: () =>
    cached('d:cactus', () =>
      fromRows(['...oo...', '..oggo..', 'o.oggo..', 'googdo.o', 'ogogdoog', '.oggdogo', '..oggdo.', '..oggdo.', '..oggdo.', '..ogddo.', '..oooo..'], { o: O, g: '#5a9a48', d: '#3d7a2e' }),
    ),
  drybush: () => cached('d:drybush', () => fromRows(['.b..b..b', '..b.b.b.', 'b..bbb..', '.bbbbbbb', '..oooo..'], { b: '#9a7a4a', o: '#7a5a34' })),
  pillar: () =>
    cached('d:pillar', () =>
      fromRows(['.oo.oo..', 'ollglgo.', 'ogggggo.', 'oggdggo.', 'ogggggo.', 'oggdggo.', 'ogggggo.', 'ogggdgo.', 'ogggggo.', 'oooooooo', 'olllllgo', 'oooooooo'], { o: O, l: '#9a94a4', g: '#6e6878', d: '#55505e' }),
    ),
  rubble: () => cached('d:rubble', () => fromRows(['...oo.....', '..olgo.oo.', '.ogggoolgo', 'ogdgoogggo', '.ooo.oooo.'], { o: O, l: '#a8a0a0', g: '#7a7270', d: '#5a5250' })),
  crater: () =>
    cached('d:crater', () =>
      fromRows(['.....llllll.....', '...lldddddddl...', '..ldddkkkkdddl..', '.ldkkkkkkkkkkdl.', '.ldkkkkkkkkkkdl.', '..ldddkkkkdddl..', '...lldddddddl...', '.....llllll.....'], { l: '#a08a70', d: '#5a4a38', k: '#3a2e24' }),
    ),
  spear: () => cached('d:spear', () => fromRows(['..o..', '.oso.', '.oso.', '..o..', '..b..', '..b..', '..b..', '..b..', '.ooo.', 'ddddd'], { o: O, s: '#c9d1d9', b: '#6a4a2a', d: '#5a4a38' })),
  patch: () =>
    cached('d:patch', () => fromRows(['....gggggg....', '..gggggggggg..', '.gggggggggggggg', 'gggggggggggggg.', '.gggggggggggg..', '...gggggggg....'], { g: 'rgba(255,255,255,0.07)' })),
  dune: () => cached('d:dune', () => fromRows(['.....llllllll.....', '...llllllllllll...', '.llllllllllllllll.', 'ssssssssssssssssss'], { l: '#f0dbab', s: '#b8945a' })),
  stump: () => cached('d:stump', () => fromRows(['.oooo.', 'olrrlo', 'obbbbo', 'obbbbo', 'oooooo'], { o: O, l: '#b48a5a', r: '#8a6a40', b: '#6a4a2a' })),
  skull: () => cached('d:skull', () => fromRows(['.ooo.', 'owwwo', 'okwko', '.owo.'], { o: '#8a7a64', w: '#efe6d2', k: '#3a2e24' })),
};

/** Ground and decorations around (cx, cy); `w`×`h` is the visible world area. */
export function drawGround(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, scene: SceneId = 'konoha'): void {
  const P = SCENES[scene];
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  const tx0 = Math.floor((cx - w / 2) / TILE) - 1;
  const tx1 = Math.floor((cx + w / 2) / TILE) + 1;
  const ty0 = Math.floor((cy - h / 2) / TILE) - 1;
  const ty1 = Math.floor((cy + h / 2) / TILE) + 1;
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      // +0.5 overlap hides hairline seams between scaled tiles.
      ctx.drawImage(tileSprite(scene, hash(tx, ty) % VARIANTS), tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
    }
  }
  // Decorations: big flat ones first, then the rest.
  for (const flat of [true, false]) {
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        const hv = hash(tx * 7 + 3, ty * 13 + 5);
        if (hv % 100 >= 14) continue;
        const id = P.decor[(hv >>> 8) % P.decor.length];
        const isFlat = id === 'patch' || id === 'dune' || id === 'crater';
        if (isFlat !== flat) continue;
        const img = DECOR[id]();
        const ox = ((hv >>> 12) & 31) / 31;
        const oy = ((hv >>> 17) & 31) / 31;
        const dw = img.width * PX;
        const dh = img.height * PX;
        const dx = tx * TILE + ox * (TILE - dw * 0.5);
        const dy = ty * TILE + oy * (TILE - dh * 0.5);
        if (!flat) {
          // Soft contact shadow so props sit on the ground.
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath();
          ctx.ellipse(dx + dw / 2, dy + dh - PX, dw * 0.42, PX * 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.drawImage(img, dx, dy, dw, dh);
      }
    }
  }
  ctx.imageSmoothingEnabled = smoothing;
}
