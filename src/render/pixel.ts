/**
 * Original pixel art, generated at low resolution and scaled up without smoothing.
 *
 * Characters are composed on a 20×26 grid from hand-placed parts (hair styles,
 * headbands, cloaks…) coloured by a Look, then get edge shading and a dark outline.
 * Small objects (gems, coins, kunai…) are hand-drawn as text masks.
 */
import type { Look } from '../game/looks';

type Grid = (string | null)[][];

const OUTLINE = '#160f1c';
const CW = 20; // character grid
const CH = 26;

// ---------------- colour helpers ----------------

function parseHex(c: string): [number, number, number] {
  let h = c.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** f < 1 darkens, f > 1 lightens (towards white). */
export function shade(c: string, f: number): string {
  const [r, g, b] = parseHex(c);
  const m = (v: number) => (f <= 1 ? v * f : v + (255 - v) * (f - 1));
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(m(v)))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// ---------------- grid helpers ----------------

function grid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(null));
}

function set(g: Grid, x: number, y: number, c: string | null): void {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c;
}

function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x, y, c);
}

function disc(g: Grid, cx: number, cy: number, r: number, c: string, onlyAboveY = Infinity): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    if (y > onlyAboveY) continue;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6) set(g, x, y, c);
    }
  }
}

/** Darkens right/bottom edges and lightens top-left ones for a bit of volume. */
function shadeEdges(g: Grid): Grid {
  const h = g.length;
  const w = g[0].length;
  const out = g.map((row) => row.slice());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = g[y][x];
      if (!c) continue;
      const right = x + 1 >= w || g[y][x + 1] === null;
      const below = y + 1 >= h || g[y + 1][x] === null;
      const left = x === 0 || g[y][x - 1] === null;
      const above = y === 0 || g[y - 1][x] === null;
      if (right || below) out[y][x] = shade(c, 0.72);
      else if (left || above) out[y][x] = shade(c, 1.2);
    }
  }
  return out;
}

/** Adds a 1-pixel outline around everything (grid grows by 1 on each side). */
function outline(g: Grid, color = OUTLINE): Grid {
  const h = g.length + 2;
  const w = g[0].length + 2;
  const out = grid(w, h);
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) out[y + 1][x + 1] = g[y][x];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (out[y][x]) continue;
      const n = [out[y - 1]?.[x], out[y + 1]?.[x], out[y][x - 1], out[y][x + 1]];
      if (n.some((v) => v && v !== color)) out[y][x] = color;
    }
  }
  return out;
}

function toCanvas(g: Grid, white = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = g[0].length;
  c.height = g.length;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length; x++) {
      const v = g[y][x];
      if (!v) continue;
      ctx.fillStyle = white ? '#ffffff' : v;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** Builds a sprite from rows of characters; '.' or ' ' is transparent. */
export function fromRows(rows: string[], palette: Record<string, string>): HTMLCanvasElement {
  const g = grid(Math.max(...rows.map((r) => r.length)), rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => palette[ch] && set(g, x, y, palette[ch])));
  return toCanvas(g);
}

const cache = new Map<string, HTMLCanvasElement>();

export function cached(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = make();
    cache.set(key, c);
  }
  return c;
}

// ---------------- characters ----------------

/** 0 = standing, 1 = left step, 2 = right step. */
export type WalkFrame = 0 | 1 | 2;

export function walkFrame(moving: boolean, anim: number): WalkFrame {
  if (!moving) return 0;
  return ([1, 0, 2, 0] as const)[Math.floor(anim * 8) % 4];
}

function hairBack(g: Grid, L: Look): void {
  const h = L.hair;
  if (L.hairStyle === 'long') {
    rect(g, 5, 8, 15, 19, h);
    for (let x = 5; x <= 15; x += 2) set(g, x, 20, h);
  } else if (L.hairStyle === 'ponytail') {
    rect(g, 3, 8, 5, 15, h);
    rect(g, 2, 12, 3, 17, h);
    set(g, 5, 8, shade(h, 0.7));
  } else if (L.hairStyle === 'hood') {
    disc(g, 10, 9, 6, h);
  }
}

function hairFront(g: Grid, L: Look): void {
  const h = L.hair;
  const dark = shade(h, 0.8);
  switch (L.hairStyle) {
    case 'spiky': {
      const tops = [7, 4, 5, 2, 4, 1, 3, 1, 3, 2, 4, 3, 6];
      tops.forEach((t, i) => rect(g, 4 + i, t, 4 + i, 7, h));
      set(g, 6, 8, h);
      set(g, 8, 8, h);
      set(g, 13, 8, h);
      rect(g, 5, 8, 5, 10, h);
      rect(g, 15, 8, 15, 9, h);
      set(g, 9, 3, dark);
      set(g, 12, 4, dark);
      break;
    }
    case 'tall': {
      const tops = [5, 3, 1, 0, 1, 0, 2, 1, 3, 2, 4, 5, 6];
      tops.forEach((t, i) => rect(g, 4 + i, t, 4 + i, 7, h));
      rect(g, 2, 4, 3, 5, h);
      rect(g, 5, 8, 5, 10, h);
      set(g, 7, 8, h);
      set(g, 6, 2, dark);
      set(g, 10, 3, dark);
      break;
    }
    case 'bob':
    case 'long':
      disc(g, 10, 8.5, 5.4, h, 7);
      rect(g, 5, 8, 6, 13, h);
      rect(g, 14, 8, 15, 13, h);
      rect(g, 7, 8, 9, 8, h);
      set(g, 9, 5, shade(h, 1.15));
      break;
    case 'bowl':
      disc(g, 10, 8.5, 5.4, h, 7);
      rect(g, 6, 7, 14, 8, h);
      rect(g, 5, 8, 6, 11, h);
      rect(g, 14, 8, 15, 11, h);
      set(g, 9, 4, shade(h, 1.4));
      break;
    case 'ponytail':
    case 'slick':
      disc(g, 10, 8.5, 5.2, h, 6);
      rect(g, 6, 7, 7, 7, h);
      rect(g, 14, 6, 15, 9, h);
      if (L.id === 'deidara') {
        rect(g, 11, 7, 14, 11, h);
        set(g, 14, 12, h);
      }
      break;
    case 'bun':
      disc(g, 10, 8.5, 5.2, h, 6);
      disc(g, 10, 2.5, 1.8, h);
      break;
    case 'hood':
      rect(g, 6, 4, 14, 6, h);
      break;
    case 'none':
      break;
  }
}

function drawCloud(g: Grid, x: number, y: number): void {
  // Red cloud with a white rim.
  rect(g, x - 1, y - 1, x + 3, y + 2, '#f4f1ea');
  rect(g, x, y, x + 2, y + 1, '#c0141b');
  set(g, x + 1, y - 1, '#c0141b');
  set(g, x - 1, y - 1, null);
  set(g, x + 3, y + 2, null);
}

function buildCharacter(L: Look, frame: WalkFrame, plate: string | null): Grid {
  const g = grid(CW, CH);
  const skin = L.skin;
  const top = L.cloak ? '#17151d' : L.top;
  const bx0 = L.bulky ? 5 : 6;
  const bx1 = L.bulky ? 14 : 13;

  // --- behind the body ---
  if (L.extra === 'gourd') {
    disc(g, 4, 16, 3, '#c9a26b');
    rect(g, 3, 11, 5, 13, '#c9a26b');
    set(g, 4, 10, '#8b5e3c');
  }
  hairBack(g, L);

  // --- legs (walk cycle: the stepping leg lifts and moves forward) ---
  const leg = (x0: number, lift: number, dx: number) => {
    const bottomY = 24 - lift;
    rect(g, x0 + dx, 21, x0 + dx + 2, bottomY, L.bottom);
    rect(g, x0 + dx, bottomY + 1, x0 + dx + 2, bottomY + 1, '#2a2230');
    if (L.id === 'lee' || L.id === 'lee_puertas') rect(g, x0 + dx, bottomY - 2, x0 + dx + 2, bottomY - 1, '#f39c32');
  };
  leg(7, frame === 1 ? 1 : 0, frame === 1 ? -1 : frame === 2 ? 1 : 0);
  leg(11, frame === 2 ? 1 : 0, frame === 2 ? 1 : frame === 1 ? -1 : 0);

  // --- torso ---
  if (L.cloak) {
    rect(g, 5, 13, 14, 23, top);
    for (let x = 5; x <= 14; x += 3) set(g, x, 24, top);
    drawCloud(g, 7, 16);
    drawCloud(g, 11, 20);
    rect(g, 6, 12, 13, 13, top);
  } else {
    rect(g, bx0, 14, bx1, 21, top);
    // Cel shading: the side away from the light and the hem are a tone darker.
    rect(g, bx1 - 1, 15, bx1, 21, shade(top, 0.82));
    rect(g, bx0, 21, bx1, 21, shade(top, 0.75));
    rect(g, 9, 13, 11, 13, skin);
  }

  // --- arms (swing opposite to the legs) ---
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const arm = (x0: number, dy: number) => {
    rect(g, x0, 15 + dy, x0 + 1, 19 + dy, top);
    rect(g, x0, 20 + dy, x0 + 1, 20 + dy, skin);
  };
  arm(bx0 - 2, swing);
  arm(bx1 + 1, -swing);

  // --- clothing details ---
  switch (L.id) {
    case 'naruto':
      rect(g, bx0, 14, bx1, 15, '#26262e');
      set(g, 10, 17, '#f4f1ea');
      set(g, 10, 18, '#f4f1ea');
      break;
    case 'naruto_hokage':
      rect(g, bx0, 20, bx1, 21, '#e5534b');
      for (let x = bx0; x <= bx1; x += 2) set(g, x, 19, '#e5534b');
      break;
    case 'kakashi':
    case 'shikamaru':
      rect(g, 7, 16, 8, 17, shade(top, 0.75));
      rect(g, 11, 16, 12, 17, shade(top, 0.75));
      break;
    case 'minato':
      // White coat with a flame hem over a jōnin vest.
      rect(g, 9, 14, 10, 20, '#4f6b3a');
      for (let x = bx0; x <= bx1; x++) set(g, x, 21, x % 2 ? '#e8701f' : '#e5534b');
      break;
    case 'jiraiya':
      rect(g, bx0, 14, bx0 + 1, 21, '#c0392b');
      rect(g, bx1 - 1, 14, bx1, 21, '#c0392b');
      break;
    case 'sound':
      set(g, 7, 16, shade(top, 0.75));
      set(g, 11, 18, shade(top, 0.75));
      set(g, 12, 15, shade(top, 0.75));
      break;
    case 'orochimaru':
    case 'kabuto':
      rect(g, bx0, 19, bx1, 19, '#6b3fa0');
      break;
    case 'sasuke':
      rect(g, bx0, 19, bx1, 19, '#6b3fa0');
      break;
    case 'gaara':
    case 'gaara_kazekage':
      for (let i = 0; i < 7; i++) set(g, 6 + i, 14 + i, '#c9a26b');
      break;
    case 'madara':
      rect(g, bx0, 16, bx1, 16, shade(top, 0.65));
      rect(g, bx0, 18, bx1, 18, shade(top, 0.65));
      break;
    case 'sakura':
    case 'sakura_adulta':
      rect(g, bx0, 20, bx1, 20, '#3a3f47');
      break;
  }
  // Minions show their nature as a mark on the chest when they have no headband.
  if (plate && !L.band) rect(g, 9, 16, 10, 17, plate);

  // --- head ---
  disc(g, 10, 9, 4.6, skin);
  if (L.extra === 'cracks') {
    const c = shade(skin, 0.7);
    set(g, 7, 8, c);
    set(g, 7, 9, c);
    set(g, 8, 10, c);
    set(g, 13, 11, c);
  }
  hairFront(g, L);

  // --- face ---
  const eyeL = 9;
  const eyeR = 12;
  // Eyes: white + pupil, looking towards the facing side; a cheek tone below.
  set(g, eyeL - 1, 10, '#f4f6f8');
  set(g, eyeL, 10, L.eye);
  set(g, eyeR - 1, 10, '#f4f6f8');
  set(g, eyeR, 10, L.eye);
  set(g, eyeL, 9, shade(L.hair, 0.6));
  set(g, eyeR, 9, shade(L.hair, 0.6));
  set(g, 13, 12, shade(skin, 0.86));
  if (L.mask) rect(g, 6, 11, 14, 13, L.mask);
  if (L.extra === 'whiskers') {
    const w = shade(skin, 0.7);
    set(g, 7, 11, w);
    set(g, 13, 11, w);
    set(g, 7, 12, w);
    set(g, 13, 12, w);
  }
  if (L.extra === 'brows') {
    rect(g, 8, 9, 9, 9, '#111');
    rect(g, 12, 9, 13, 9, '#111');
  }
  if (L.extra === 'gills') {
    const c = shade(skin, 0.6);
    set(g, 7, 11, c);
    set(g, 7, 12, c);
    set(g, 13, 11, c);
    set(g, 13, 12, c);
  }
  if (L.extra === 'facepaint') {
    const c = L.id === 'orochimaru' ? '#7a4aa0' : '#c0392b';
    rect(g, eyeL - 1, 11, eyeL - 1, 13, c);
    rect(g, eyeR, 11, eyeR, 13, c);
  }
  if (L.extra === 'piercings') {
    set(g, 10, 11, '#9aa0a8');
    set(g, 8, 12, '#9aa0a8');
    set(g, 12, 12, '#9aa0a8');
  }
  if (L.band) {
    rect(g, 6, 7, 14, 7, L.band);
    rect(g, 9, 6, 12, 8, plate ?? '#c9d1d9');
    set(g, 10, 7, shade(plate ?? '#c9d1d9', 0.6));
    if (L.id === 'renegade' || L.id === 'brute') {
      // Slashed headband: a renegade ninja.
      set(g, 9, 8, '#2c2c34');
      set(g, 11, 6, '#2c2c34');
    }
    if (L.id === 'kakashi') rect(g, 8, 8, 10, 10, L.band); // covers the Sharingan eye
  }
  if (L.id === 'deidara') rect(g, eyeR - 1, 9, eyeR, 10, L.hair); // fringe hides one eye
  if (L.extra === 'glasses') {
    const c = '#c9d1d9';
    rect(g, eyeL - 1, 9, eyeL, 9, c);
    rect(g, eyeR - 1, 9, eyeR, 9, c);
    set(g, eyeL + 1, 10, c);
  }
  return g;
}

export function characterSprite(L: Look, frame: WalkFrame, plate: string | null = null, white = false): HTMLCanvasElement {
  return cached(`ch:${L.id}:${frame}:${plate ?? ''}:${white ? 1 : 0}`, () => toCanvas(outline(shadeEdges(buildCharacter(L, frame, plate))), white));
}

/** Character sprite size in world units for a body radius `r`. */
export function characterSize(r: number): { w: number; h: number; px: number } {
  const h = r * 2.75;
  const px = h / (CH + 2);
  return { w: (CW + 2) * px, h, px };
}

// ---------------- minions that aren't people ----------------

const CROW_PAL = { a: '#121218', b: '#2a2a36', r: '#e01b1b', y: '#e8b923' };
export function crowSprite(frame: 0 | 1, white = false): HTMLCanvasElement {
  return cached(`crow:${frame}:${white}`, () => {
    const rows =
      frame === 0
        ? ['a..........a', 'ab........ba', '.abb.aa.bba.', '..abbbbbba..', '...abrbby...', '....abba....', '.....aa.....']
        : ['............', '....aaaa....', '...abrbby...', '.aabbbbbbaa.', 'abb.abba.bba', 'a....aa....a', '............'];
    const c = fromRows(rows, CROW_PAL);
    return white ? whiten(c) : c;
  });
}

export function whiten(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---------------- items ----------------

const GEM_COLORS: Record<string, [string, string, string]> = {
  blue: ['#1d4f9a', '#4fa8ff', '#bfe3ff'],
  green: ['#1f7a3a', '#5cdc7a', '#c8f7d2'],
  red: ['#8a1f1f', '#ff5a5a', '#ffd0d0'],
};

export function gemSprite(kind: 'blue' | 'green' | 'red'): HTMLCanvasElement {
  return cached(`gem:${kind}`, () => {
    const [a, b, c] = GEM_COLORS[kind];
    return fromRows(['...o...', '..oco..', '.ocbbo.', 'ocbwbao', 'obbbbao', '.obbao.', '..oao..', '...o...'], { o: OUTLINE, c, b, a, w: '#ffffff' });
  });
}

export const ITEM_SPRITES = {
  coin: () => cached('coin', () => fromRows(['..ooo..', '.oyyyo.', 'oyywyyo', 'oyhhhyo', 'oyyhyyo', '.oyyyo.', '..ooo..'], { o: '#5a3e00', y: '#f1c232', w: '#fff3b0', h: '#7a5a00' })),
  ramen: () =>
    cached('ramen', () =>
      fromRows(['..s..s...', '.s..s..s.', 'ooooooooo', 'oynynynyo', 'owwwwwwwo', 'orrrrrrro', '.owwwwwo.', '..ooooo..'], { o: OUTLINE, s: '#dfe6ee', y: '#f4c06a', n: '#e8a13a', w: '#f4f1ea', r: '#c0392b' }),
    ),
  scroll: () =>
    cached('scroll', () => fromRows(['oo.......oo', 'obooooooobo', 'obpppppppbo', 'obpkkkkkpbo', 'obpppppppbo', 'obooooooobo', 'oo.......oo'], { o: OUTLINE, b: '#8b5e3c', p: '#efe3c2', k: '#c0392b' })),
  chest: () =>
    cached('chest', () =>
      fromRows(
        ['.oooooooooooo.', 'oyyyyyyyyyyyyo', 'obbbbbbbbbbbbo', 'oyyyyyoyyyyyyo', 'oooooowwoooooo', 'obbbbbwwbbbbbo', 'obbbbbbbbbbbbo', 'oyyyyyyyyyyyyo', 'obbbbbbbbbbbbo', 'oooooooooooooo'],
        { o: '#3a2410', y: '#ffd23f', b: '#9b6a3c', w: '#fff3b0' },
      ),
    ),
  pill: () => cached('pill', () => fromRows(['.ooo.', 'orwro', 'orrro', 'orrro', '.ooo.'], { o: '#4a1010', r: '#e5534b', w: '#ffd0d0' })),
  tag: () => cached('tag', () => fromRows(['ooooo', 'opppo', 'oprpo', 'oprpo', 'orrro', 'oprpo', 'opppo', 'ooooo'], { o: '#5a4a30', p: '#efe3c2', r: '#c0392b' })),
  kunai: () => cached('kunai', () => fromRows(['.oo........', 'o.oooooo...', 'o.ohhhhsso.', 'o.oooooooww', '.oo.....oo.'], { o: '#20232a', h: '#3a3f47', s: '#c9d1d9', w: '#f4f6f8' })),
  stall: () =>
    cached('stall', () =>
      fromRows(
        [
          'oooooooooooooooo',
          'orwrwrwrwrwrwrwo',
          'orwrwrwrwrwrwrwo',
          'oooooooooooooooo',
          '.ob..........bo.',
          '.ob.s..k..s..bo.',
          '.ob.s.kk..s..bo.',
          '.ob.s..k..s..bo.',
          '.oooooooooooooo.',
          '.owwwwwwwwwwwwo.',
          '.owwwwwwwwwwwwo.',
          '.oooooooooooooo.',
        ],
        { o: OUTLINE, r: '#c0392b', w: '#9b6a3c', b: '#6a4a2a', s: '#c9d1d9', k: '#5cc96b' },
      ),
    ),
};

/** Orb of chakra for a bijū (n tails), with tails as little flames around it. */
export function bijuSprite(n: number): HTMLCanvasElement {
  return cached(`biju:${n}`, () => {
    const colors = ['#c9a26b', '#4fa8ff', '#7fd0c0', '#e5534b', '#f4f1ea', '#b8e0a0', '#7ad35a', '#b48cff', '#ff8a3c'];
    const col = colors[(n - 1) % colors.length];
    const g = grid(21, 21);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42;
      disc(g, 10 + Math.cos(a) * 7, 10 + Math.sin(a) * 7, 1.3, shade(col, 1.15));
    }
    disc(g, 10, 10, 5, col);
    disc(g, 9, 9, 2, shade(col, 1.35));
    return toCanvas(outline(shadeEdges(g)));
  });
}

// ---------------- projectiles ----------------

export function rasenganSprite(frame: number, big: boolean): HTMLCanvasElement {
  return cached(`rasen:${frame % 4}:${big}`, () => {
    const s = big ? 21 : 15;
    const c = (s - 1) / 2;
    const g = grid(s, s);
    disc(g, c, c, c - 0.5, '#2f7fe0');
    disc(g, c, c, c - 2, '#6fc1ff');
    disc(g, c, c, c - 4.2, '#cfeeff');
    // Swirl arms rotating with the frame.
    for (let arm = 0; arm < 3; arm++) {
      for (let t = 0; t < 1; t += 0.08) {
        const a = arm * ((Math.PI * 2) / 3) + (frame % 4) * (Math.PI / 6) + t * 2.4;
        const r = 1.5 + t * (c - 1.5);
        set(g, Math.round(c + Math.cos(a) * r), Math.round(c + Math.sin(a) * r), '#ffffff');
      }
    }
    if (big) {
      for (let k = 0; k < 4; k++) {
        const a = k * (Math.PI / 2) + (frame % 4) * 0.4;
        for (let t = c - 1; t <= c + 0.5; t += 0.5) set(g, Math.round(c + Math.cos(a) * t), Math.round(c + Math.sin(a) * t), '#e8f6ff');
      }
    }
    return toCanvas(g);
  });
}

export function fireballSprite(frame: number, dark: boolean): HTMLCanvasElement {
  return cached(`fire:${frame % 2}:${dark}`, () => {
    const g = grid(13, 13);
    const [a, b, c] = dark ? ['#1a0a24', '#3a1050', '#b48cff'] : ['#c0391b', '#ff7a2a', '#fff4c2'];
    disc(g, 6, 6, 5.2, a);
    disc(g, 6 + (frame % 2 ? 0.5 : -0.5), 6, 3.8, b);
    disc(g, 6, 6 + (frame % 2 ? -0.4 : 0.4), 2, c);
    set(g, 2, 2, frame % 2 ? b : null);
    set(g, 10, 3, frame % 2 ? null : b);
    return toCanvas(g);
  });
}

export function sandOrbSprite(): HTMLCanvasElement {
  return cached('sandorb', () => fromRows(['..ooo..', '.obbbo.', 'obwbbbo', 'obbbdbo', 'obbdbbo', '.obbbo.', '..ooo..'], { o: '#6a4a22', b: '#d8b26a', w: '#f4e2b0', d: '#b8904a' }));
}

// ---------------- effects ----------------

/** Chunky pixel ring/disc for explosions (radius in native pixels). */
export function blastSprite(color: string, rNative: number, ring: boolean): HTMLCanvasElement {
  const r = Math.max(2, Math.round(rNative));
  return cached(`blast:${color}:${r}:${ring}`, () => {
    const s = r * 2 + 3;
    const g = grid(s, s);
    disc(g, r + 1, r + 1, r, color);
    if (ring) disc(g, r + 1, r + 1, r - 2, '#00000000');
    else disc(g, r + 1, r + 1, r * 0.5, shade(color, 1.5));
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) if (g[y][x] === '#00000000') g[y][x] = null;
    return toCanvas(g);
  });
}

// ---------------- icons ----------------

function iconFromRows(rows: string[], palette: Record<string, string>): Grid {
  const g = grid(Math.max(...rows.map((r) => r.length)), rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => palette[ch] && set(g, x, y, palette[ch])));
  return g;
}

const BOLT = ['.......ooo..', '......owbo..', '.....owbo...', '....owbo....', '...owbbooo..', '..owbbbbbo..', '..oooobbo...', '....obbo....', '...obbo.....', '..obbo......', '..obo.......', '..oo........'];

const ICON_ROWS: Record<string, () => Grid> = {
  kunai: () =>
    iconFromRows(['.........oo.', '........owso', '.......owso.', '......owso..', '.....owso...', '....oswo....', '...ohoo.....', '..ohho......', '.ohho.......', 'orro........', 'oro.........', 'oo..........'], {
      o: '#20232a',
      w: '#f4f6f8',
      s: '#9aa4b1',
      h: '#3a3f47',
      r: '#c9d1d9',
    }),
  clones: () => {
    const g = iconFromRows(['..yy...yy...', '.yyyy.yyyy..', '.ykky.ykky..', '..kk...kk...', '.oooo.oooo..', 'oooooooooooo', '.oooo.oooo..', '.b..b.b..b..'], { y: '#ffd23f', k: '#f2c99a', o: '#f5822a', b: '#26262e' });
    return outline(g);
  },
  rasengan: () => {
    const g = grid(12, 12);
    disc(g, 5.5, 5.5, 5, '#2f7fe0');
    disc(g, 5.5, 5.5, 3.6, '#6fc1ff');
    disc(g, 5.5, 5.5, 1.8, '#ffffff');
    set(g, 2, 4, '#ffffff');
    set(g, 8, 8, '#ffffff');
    set(g, 7, 2, '#cfeeff');
    return g;
  },
  sellos: () => iconFromRows(['..oooooo..', '..oppppo..', '..oprrpo..', '..oprrpo..', '..oprrpo..', '..orrrro..', '..oprrpo..', '..oppppo..', '..oooooo..', '...y..y...', '..y....y..'], { o: '#5a4a30', p: '#efe3c2', r: '#c0392b', y: '#ffb347' }),
  puno: () =>
    iconFromRows(['...oooooo...', '..okkokkoo..', '.okkokkokko.', '.okkokkokko.', '.okkkkkkkko.', 'okkkkkkkkko.', 'okddkkkkkko.', '.okkkkkkko..', '..okkkkkko..', '..oppppppo..', '...oooooo...'], {
      o: '#3a2018',
      k: '#f5d0b0',
      d: '#d9a882',
      p: '#f7a8c8',
    }),
  raikiri: () => iconFromRows(BOLT, { o: '#1d4f9a', w: '#ffffff', b: '#7fd0ff' }),
  chidori: () => {
    const g = iconFromRows(BOLT, { o: '#2f7fe0', w: '#ffffff', b: '#e8f6ff' });
    set(g, 9, 8, '#bfe8ff');
    set(g, 10, 10, '#bfe8ff');
    set(g, 1, 5, '#bfe8ff');
    return g;
  },
  katon: () => {
    const g = grid(12, 12);
    disc(g, 5.5, 6.5, 5, '#c0391b');
    disc(g, 5.5, 6.5, 3.4, '#ff7a2a');
    disc(g, 5.5, 7, 1.6, '#fff4c2');
    set(g, 5, 0, '#ff7a2a');
    set(g, 8, 1, '#c0391b');
    set(g, 2, 1, '#c0391b');
    return g;
  },
  arena: () => {
    const g = grid(12, 12);
    for (const [x, y] of [[3, 3], [8.5, 4.5], [4.5, 8.5]]) {
      disc(g, x, y, 2.4, '#b8904a');
      disc(g, x - 0.5, y - 0.5, 1.2, '#f4e2b0');
    }
    return g;
  },
  huracan: () => iconFromRows(['....gggg....', '..gg....gg..', '.g..ggg...g.', 'g..g...g..g.', 'g.g..g..g.g.', 'g.g.ggg.g.g.', 'g.g..gg.g.g.', 'g..g...g..g.', '.g..ggg..g..', '..gg....g...', '....gggg....'], { g: '#8fe3a8' }),
};

/** 16×16 pixel icon for a jutsu (HUD slots and level-up cards). */
export function jutsuIcon(id: string): HTMLCanvasElement | null {
  const make = ICON_ROWS[id];
  if (!make) return null;
  return cached(`icon:${id}`, () => {
    const src = toCanvas(shadeEdges(make()));
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    c.getContext('2d')!.drawImage(src, Math.floor((16 - src.width) / 2), Math.floor((16 - src.height) / 2));
    return c;
  });
}

const iconUrls = new Map<string, string>();
export function jutsuIconURL(id: string): string | null {
  if (!iconUrls.has(id)) {
    const c = jutsuIcon(id);
    if (!c) return null;
    iconUrls.set(id, c.toDataURL());
  }
  return iconUrls.get(id)!;
}

/** Head and shoulders of a character, for the HUD portrait. */
export function headSprite(L: Look): HTMLCanvasElement {
  return cached(`head:${L.id}`, () => {
    const full = characterSprite(L, 0);
    const c = document.createElement('canvas');
    c.width = full.width;
    c.height = 17;
    c.getContext('2d')!.drawImage(full, 0, 0);
    return c;
  });
}

// ---------------- added: snakes, lions, toad ----------------

export function snakeSprite(frame: 0 | 1, white = false): HTMLCanvasElement {
  return cached(`snake:${frame}:${white}`, () => {
    const rows =
      frame === 0
        ? ['.........oo.', '........ogyo', '.oo....oggo.', 'oggo..oggo..', 'ogggoogggo..', '.oggggggo...', '..oooooo....']
        : ['.........oo.', '.oo.....ogyo', 'oggo...oggo.', 'ogggo.oggo..', '.ogggggggo..', '..oggggoo...', '...oooo.....'];
    const c = fromRows(rows, { o: OUTLINE, g: '#7a6ab0', y: '#ffe14d' });
    return white ? whiten(c) : c;
  });
}

export function lionSprite(frame: number): HTMLCanvasElement {
  return cached(`lion:${frame % 2}`, () => {
    const g = grid(15, 13);
    disc(g, 7, 7, 5.5, '#6a4ab8');
    disc(g, 7, 7, 4, '#b48cff');
    disc(g, 8, 6, 2, '#e8dcff');
    // Ears and mane flicker.
    set(g, 3, 1, '#b48cff');
    set(g, 4, 2, '#b48cff');
    set(g, 11, 1, '#b48cff');
    set(g, 10, 2, '#b48cff');
    set(g, frame % 2 ? 0 : 1, 7, '#b48cff');
    set(g, frame % 2 ? 14 : 13, 7, '#b48cff');
    set(g, 6, 7, '#2d2a5a');
    set(g, 9, 7, '#2d2a5a');
    return toCanvas(outline(g, '#2d1a5a'));
  });
}

export function toadSprite(): HTMLCanvasElement {
  return cached('toad', () =>
    toCanvas(
      outline(
        shadeEdges(
          iconFromRows(
            [
              '...ww.......ww...',
              '..wkkw.....wkkw..',
              '..wkkw.....wkkw..',
              '.ooooooooooooooo.',
              'oooooooooooooooo.',
              'ooyyyyyyyyyyyyooo',
              'ooooooooooooooooo',
              'oorrrrrrrrrrrrroo',
              'ooooooooooooooooo',
              '.ooooodooodoooo..',
              '..oooo.....oooo..',
              '.hhhh.......hhhh.',
            ],
            { w: '#f4f1ea', k: '#1a1a1a', o: '#d9601e', y: '#f4c06a', r: '#7a1f1f', d: '#a8481a', h: '#a8481a' },
          ),
        ),
      ),
    ),
  );
}

Object.assign(ICON_ROWS, {
  sombra: () =>
    iconFromRows(['.....oo.....', '....oddo....', '....oddo....', '...oddddo...', '...oddddo...', '..odddddo...', '..odddddddo.', '.odddddddddo', 'oddddd.dddo.', '.ooddd..oo..', '...odo......', '....o.......'], { o: '#0e0a14', d: '#4a3a6a' }),
  kaiten: () => {
    const g = grid(12, 12);
    disc(g, 5.5, 5.5, 5.4, '#cfeeff');
    disc(g, 5.5, 5.5, 4, '#7fd0ff');
    disc(g, 5.5, 5.5, 2.4, '#e8f6ff');
    for (let i = 0; i < 6; i++) set(g, Math.round(5.5 + Math.cos(i) * 4.6), Math.round(5.5 + Math.sin(i) * 4.6), '#ffffff');
    return g;
  },
  leones: () =>
    iconFromRows(['.o......o...', 'obo....obo..', 'obbooooobbo.', 'obbbbbbbbbo.', 'obkbbbbkbbo.', 'obbbbbbbbbo.', '.obbwwbbbo..', '.obbbbbbbo..', '..obbbbbo...', '...ooooo....'], { o: '#2d1a5a', b: '#b48cff', k: '#2d2a5a', w: '#e8dcff' }),
  sapo: () =>
    iconFromRows(['.ww....ww...', 'wkkw..wkkw..', 'wkkw..wkkw..', 'oooooooooooo', 'ooyyyyyyyyoo', 'oooooooooooo', 'oorrrrrrrroo', '.oooooooooo.', '.hh......hh.'], { w: '#f4f1ea', k: '#1a1a1a', o: '#d9601e', y: '#f4c06a', r: '#7a1f1f', h: '#a8481a' }),
  cuervos: () =>
    iconFromRows(['a..........a', 'ab........ba', '.abb.aa.bba.', '..abbbbbba..', '...abrbby...', '....abba....', '.....aa.....'], { a: '#121218', b: '#2a2a36', r: '#e01b1b', y: '#e8b923' }),
  hiraishin: () =>
    iconFromRows(['..........yy', '.........yky', '........yky.', '...y...yky..', '..yky.yky...', '.ykkykkky...', '..yky.yy....', '.ohho.......', 'ohhho.......', 'oho.........', 'oo..........'], { y: '#ffe14d', k: '#ffffff', o: '#20232a', h: '#3a3f47' }),
});
