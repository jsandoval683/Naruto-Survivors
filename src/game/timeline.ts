import type { BossId } from './bosses';
import type { MinionKind } from './enemies';
import type { Game } from './game';
import type { Nature } from './natures';

export type SceneId = 'desierto' | 'bosque' | 'uchiha' | 'konoha' | 'crater' | 'guerra' | 'dim_lava' | 'dim_hielo' | 'dim_gravedad' | 'dim_arena';

export interface MinionWeight {
  kind: MinionKind;
  w: number;
  /** Only spawns after this many seconds of the run. */
  from?: number;
}

export interface Arc {
  start: number;
  name: string;
  scene: SceneId;
  minions: MinionWeight[];
  natures: Nature[];
  bosses: { t: number; ids: BossId[] }[];
}

export const ARCS: Arc[] = [
  {
    start: 0,
    name: 'Rescate del Kazekage',
    scene: 'desierto',
    minions: [
      { kind: 'grunt', w: 1 },
      { kind: 'puppet', w: 0.6, from: 30 },
      { kind: 'brute', w: 0.15, from: 75 },
      { kind: 'sound', w: 0.2, from: 150 },
      { kind: 'snake', w: 0.5, from: 375 },
    ],
    natures: ['viento', 'tierra'],
    bosses: [
      { t: 150, ids: ['deidara'] },
      { t: 300, ids: ['sasori'] },
      { t: 375, ids: ['orochimaru'] },
    ],
  },
  {
    start: 450,
    name: 'Los inmortales: Hidan y Kakuzu',
    scene: 'bosque',
    minions: [
      { kind: 'grunt', w: 1 },
      { kind: 'brute', w: 0.25 },
      { kind: 'puppet', w: 0.3 },
      { kind: 'sound', w: 0.35 },
      { kind: 'snake', w: 0.25 },
    ],
    natures: ['fuego', 'agua', 'neutral'],
    bosses: [{ t: 450, ids: ['hidan', 'kakuzu'] }],
  },
  {
    start: 600,
    name: 'Persecución de Itachi',
    scene: 'uchiha',
    minions: [
      { kind: 'grunt', w: 1 },
      { kind: 'crow', w: 0.8 },
      { kind: 'brute', w: 0.25 },
      { kind: 'shark', w: 0.35 },
    ],
    natures: ['fuego', 'rayo', 'agua'],
    bosses: [{ t: 600, ids: ['itachi', 'kisame'] }],
  },
  {
    start: 750,
    name: 'Invasión de Pain',
    scene: 'konoha',
    minions: [
      { kind: 'grunt', w: 1 },
      { kind: 'brute', w: 0.3 },
      { kind: 'puppet', w: 0.4 },
      { kind: 'sound', w: 0.3 },
    ],
    natures: ['rayo', 'viento', 'agua'],
    bosses: [{ t: 750, ids: ['path0', 'path1', 'path2', 'path3', 'path4', 'path5'] }],
  },
  {
    start: 900,
    name: 'Konoha arrasada',
    scene: 'crater',
    minions: [
      { kind: 'grunt', w: 1 },
      { kind: 'brute', w: 0.35 },
    ],
    natures: ['rayo', 'tierra', 'agua'],
    bosses: [{ t: 900, ids: ['pain', 'konan'] }],
  },
  {
    start: 1050,
    name: 'Cuarta Gran Guerra Ninja',
    scene: 'guerra',
    minions: [
      { kind: 'zetsu', w: 1.2 },
      { kind: 'grunt', w: 0.5 },
      { kind: 'brute', w: 0.3 },
      { kind: 'snake', w: 0.3 },
      { kind: 'sound', w: 0.2 },
    ],
    natures: ['tierra', 'agua', 'rayo', 'fuego', 'viento'],
    bosses: [
      { t: 1050, ids: ['raikage', 'tsuchikage', 'mizukage'] },
      { t: 1125, ids: ['kabuto'] },
      { t: 1200, ids: ['madara'] },
    ],
  },
  {
    start: 1350,
    name: 'El Juubi despierta',
    scene: 'crater',
    minions: [
      { kind: 'zetsu', w: 1.2 },
      { kind: 'brute', w: 0.4 },
      { kind: 'shark', w: 0.3 },
      { kind: 'sound', w: 0.3 },
    ],
    natures: ['fuego', 'viento', 'rayo', 'tierra', 'agua'],
    bosses: [
      { t: 1350, ids: ['obito'] },
      { t: 1500, ids: ['madara_rikudo'] },
    ],
  },
  {
    // Final event: no minions, only Kaguya, Black Zetsu and the echoes she summons.
    start: 1800,
    name: 'Kaguya Ōtsutsuki',
    scene: 'dim_lava',
    minions: [],
    natures: ['neutral'],
    bosses: [{ t: 1800, ids: ['kaguya', 'zetsu_negro'] }],
  },
];

/** Fires arc changes and boss arrivals as the run clock advances. */
export class Director {
  arcIndex = -1;
  private fired = new Set<string>();

  get arc(): Arc {
    return ARCS[Math.max(0, this.arcIndex)];
  }

  update(g: Game): void {
    while (this.arcIndex + 1 < ARCS.length && g.t >= ARCS[this.arcIndex + 1].start) {
      this.arcIndex++;
      g.enterArc(ARCS[this.arcIndex], this.arcIndex > 0);
    }
    for (const arc of ARCS) {
      for (const ev of arc.bosses) {
        const key = `${ev.t}:${ev.ids.join(',')}`;
        if (g.t >= ev.t && !this.fired.has(key)) {
          this.fired.add(key);
          ev.ids.forEach((id, i) => g.spawnBoss(id, i, ev.ids.length));
        }
      }
    }
  }

  /** Next boss event still to come (for the HUD countdown). */
  nextBoss(t: number): { t: number; ids: BossId[] } | null {
    for (const arc of ARCS) for (const ev of arc.bosses) if (ev.t > t) return ev;
    return null;
  }
}
