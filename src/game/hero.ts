import { CHARACTERS, type CharacterDef, type CharacterId, type StatMods, type Transform } from './characters';
import { JUTSUS, type JutsuId, type Weapon } from './jutsus';
import type { Choice } from './levelup';
import { computeStats, type PassiveId } from './passives';
import type { Player, Stats } from './types';

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
    this.addJutsu(this.char.start);
    if (opts.extraJutsu) {
      const others = this.char.pool.filter((j) => j !== this.char.start);
      this.addJutsu(others[Math.floor(Math.random() * others.length)]);
    }
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
