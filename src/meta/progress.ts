import type { SaveData } from '../core/save';
import { CHARACTERS, CHARACTER_ORDER, type CharacterDef } from '../game/characters';
import { checkAchievements, type AchievementDef } from './achievements';
import { applyDaily, type MissionDef } from './missions';
import type { RunSummary } from './summary';
import { runBonuses } from './upgrades';

export interface RunRewards {
  ryo: number;
  tickets: number;
  missions: MissionDef[];
  dailyBonus: boolean;
  achievements: AchievementDef[];
  unlocked: CharacterDef[];
}

export function isUnlockedByProgress(c: CharacterDef, s: SaveData): boolean {
  const u = c.unlock;
  switch (u.kind) {
    case 'start':
      return true;
    case 'shop':
      return false;
    case 'boss':
      return s.bossesDefeated.includes(u.boss);
    case 'survive':
      return s.bestTime >= u.seconds;
    case 'kills':
      return s.kills >= u.total;
  }
}

/** Unlocks ninjas whose condition is now met; returns the new ones. */
export function refreshUnlocks(save: SaveData): CharacterDef[] {
  const fresh: CharacterDef[] = [];
  for (const id of CHARACTER_ORDER) {
    const c = CHARACTERS[id];
    if (!save.unlocked.includes(id) && isUnlockedByProgress(c, save)) {
      save.unlocked.push(id);
      fresh.push(c);
    }
  }
  return fresh;
}

/** Folds a finished run into the save: currency, records, missions, achievements, unlocks. */
export function applyRun(save: SaveData, s: RunSummary): RunRewards {
  const bonus = runBonuses(save, s.char);
  const base = s.ryo + Math.floor(s.kills / 25) + Math.floor(s.time / 30) + s.bosses.length * 20;
  const ryo = Math.round(base * bonus.ryoMult * (s.win ? 1.5 : 1));
  const tickets = Math.floor(s.bosses.length / 2) + (s.win ? 3 : 0);
  save.ryo += ryo;
  save.tickets += tickets;
  save.runs++;
  save.kills += s.kills;
  if (s.win) {
    save.wins++;
    save.winsBy[s.char] = (save.winsBy[s.char] ?? 0) + 1;
  }
  save.bestTime = Math.max(save.bestTime, Math.floor(s.time));
  save.bestLevel = Math.max(save.bestLevel, s.level);
  for (const b of s.bosses) if (!save.bossesDefeated.includes(b)) save.bossesDefeated.push(b);
  for (const e of s.evolutions) if (!save.evolutions.includes(e)) save.evolutions.push(e);
  if (s.finalForm && !save.finalForms.includes(s.char)) save.finalForms.push(s.char);
  if (s.wish) save.wishes++;
  save.bijuBest = Math.max(save.bijuBest, s.biju);

  const daily = applyDaily(save, s);
  const unlocked = refreshUnlocks(save);
  const achievements = checkAchievements(save);
  return { ryo, tickets, missions: daily.done, dailyBonus: daily.bonus, achievements, unlocked };
}
