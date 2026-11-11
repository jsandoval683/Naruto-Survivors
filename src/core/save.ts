const KEY = 'ns_save_v1';

export interface DailyState {
  date: string;
  progress: Record<string, number>;
  done: string[];
  bonus: boolean;
}

export interface SaveData {
  version: 1;
  ryo: number;
  tickets: number;
  bestTime: number;
  bestLevel: number;
  runs: number;
  kills: number;
  wins: number;
  winsBy: Record<string, number>;
  selected: string;
  unlocked: string[];
  bossesDefeated: string[];
  /** Permanent upgrades: character → upgrade id → level. */
  upgrades: Record<string, Record<string, number>>;
  skins: string[];
  skinSel: Record<string, string>;
  pulls: number;
  /** Pulls since the last legendary (guaranteed at 80). */
  pity: number;
  daily: DailyState | null;
  achievements: string[];
  /** Characters that reached their last transformation. */
  finalForms: string[];
  evolutions: string[];
  wishes: number;
  bijuBest: number;
}

const DEFAULT: SaveData = {
  version: 1,
  ryo: 0,
  tickets: 3,
  bestTime: 0,
  bestLevel: 0,
  runs: 0,
  kills: 0,
  wins: 0,
  winsBy: {},
  selected: 'naruto',
  unlocked: ['naruto'],
  bossesDefeated: [],
  upgrades: {},
  skins: [],
  skinSel: {},
  pulls: 0,
  pity: 0,
  daily: null,
  achievements: [],
  finalForms: [],
  evolutions: [],
  wishes: 0,
  bijuBest: 0,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    return { ...structuredClone(DEFAULT), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT);
  }
}

const listeners: ((data: SaveData) => void)[] = [];

/** Called after every local save (the cloud sync hooks in here). */
export function onSaveWritten(fn: (data: SaveData) => void): void {
  listeners.push(fn);
}

export function writeSave(data: SaveData, notify = true): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage blocked (private mode): progress just won't persist.
  }
  if (notify) for (const fn of listeners) fn(data);
}

/** Replaces the contents of `target` in place (other modules keep their reference). */
export function replaceSave(target: SaveData, source: Partial<SaveData>): void {
  const fresh = { ...structuredClone(DEFAULT), ...source };
  for (const k of Object.keys(target)) delete (target as unknown as Record<string, unknown>)[k];
  Object.assign(target, fresh);
}
