import { CHARACTERS, type CharacterDef, type CharacterId, type StatMods, type Transform } from './characters';
import { JUTSUS, type JutsuId, type Weapon } from './jutsus';
import type { Choice } from './levelup';
import { computeStats, type PassiveId } from './passives';
import type { Player, Stats } from './types';

export const MASTERY: Record<string, { name: string; desc: string; icon: string; color: string; cap: number }> = {
  poder: { name: 'Poder interior', desc: '+4% de daño.', icon: '力', color: '#e5534b', cap: 40 },
  vida: { name: 'Cuerpo de acero', desc: '+10 de vida máxima y te cura 10.', icon: '体', color: '#5cc96b', cap: 40 },
  recarga: { name: 'Flujo de chakra', desc: '-3% de recarga.', icon: '気', color: '#4fb3ff', cap: 10 },
  area: { name: 'Expansión', desc: '+5% de área.', icon: '仙', color: '#f39c32', cap: 10 },
  critico: { name: 'Ojo afilado', desc: '+2% de crítico.', icon: '写', color: '#e01b1b', cap: 10 },
  coraza: { name: 'Piel de piedra', desc: '+2% de reducción de daño.', icon: '盾', color: '#c9d1d9', cap: 8 },
};

function masteryMods(m: Record<string, number>): StatMods {
  const n = (id: string) => m[id] ?? 0;
  return {
    dmg: 1 + 0.04 * n('poder'),
    maxHp: 10 * n('vida'),
    cd: 1 - 0.03 * n('recarga'),
    area: 1 + 0.05 * n('area'),
    crit: 0.02 * n('critico'),
    armor: 0.02 * n('coraza'),
  };
}

/** Anything that can steer a hero: the keyboard, a network client or the dev bot. */
export interface Controller {
  axis(): { x: number; y: number };
}

/** Bonuses brought in from outside the run (permanent upgrades, skin). */
export interface RunOptions {
  mods?: StatMods;
  xpMult?: number;
  rerolls?: number;
  extraJutsu?: boolean;
  lookId?: string;
}

/** A modal choice that isn't a level-up (Tenten's shop, the Juubi's wish). */
export interface SpecialPrompt {
  title: string;
  sub: string;
  choices: Choice[];
}

export const PILL_MODS: StatMods = { dmg: 1.3, speed: 1.2 };

/** One player in the run: body, build and pending choices. Level and XP are shared by the team. */
export class Hero {
  body: Player = { x: 0, y: 0, r: 13, hp: 100, facingX: 1, facingY: 0, invuln: 0, moving: false, anim: 0, slow: 0, kbx: 0, kby: 0 };
  char: CharacterDef;
  lookId: string;
  /** Index of the last transformation reached (-1 = none). */
  form = -1;
  weapons: Weapon[] = [];
  passives = new Map<PassiveId, number>();
  stats: Stats;
  extraMods: StatMods[] = [];
  /** Endless "mastery" upgrades taken once the build is complete (id → times taken). */
  mastery: Record<string, number> = {};
  pillTime = 0;
  pendingLevelUps = 0;
  specials: SpecialPrompt[] = [];
  rerolls: number;
  dmgBy: Record<string, number> = {};
  hurtFlash = 0;
  /** Down at 0 HP; a teammate standing close revives them. */
  downed = false;
  revive = 0;
  lastHitBy = '';
  xpMult: number;

  constructor(
    public id: number,
    public name: string,
    charId: CharacterId,
    public input: Controller,
    public opts: RunOptions = {},
  ) {
    this.char = CHARACTERS[charId];
    this.lookId = opts.lookId ?? charId;
    this.xpMult = opts.xpMult ?? 1;
    this.rerolls = opts.rerolls ?? 2;
    this.stats = this.computeStats();
    this.body.hp = this.stats.maxHp;
    // Everyone starts with the Kunai; the signature jutsu is guaranteed at the first level-up
    // (or from the start with the "Repertorio" permanent upgrade).
    this.addJutsu('kunai');
    if (opts.extraJutsu && this.char.start !== 'kunai') this.addJutsu(this.char.start);
  }

  get transform(): Transform | null {
    return this.form >= 0 ? this.char.transforms[this.form] : null;
  }

  get alive(): boolean {
    return !this.downed;
  }

  get hasPrompt(): boolean {
    return this.specials.length > 0 || this.pendingLevelUps > 0;
  }

  computeStats(): Stats {
    const mods: StatMods[] = [this.char.mods];
    if (this.opts.mods) mods.push(this.opts.mods);
    for (let i = 0; i <= this.form; i++) mods.push(this.char.transforms[i].mods);
    mods.push(...this.extraMods);
    mods.push(masteryMods(this.mastery));
    if (this.pillTime > 0) mods.push(PILL_MODS);
    const s = computeStats(this.passives, mods);
    s.xp *= this.xpMult;
    return s;
  }

  refreshStats(): void {
    const oldMax = this.stats.maxHp;
    this.stats = this.computeStats();
    if (this.stats.maxHp > oldMax && !this.downed) this.body.hp += this.stats.maxHp - oldMax;
    this.body.hp = Math.min(this.body.hp, this.stats.maxHp);
  }

  addJutsu(id: JutsuId): void {
    const existing = this.weapons.find((w) => w.id === id);
    if (existing) existing.level++;
    else this.weapons.push(JUTSUS[id].create());
  }
}
