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

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage blocked (private mode): progress just won't persist.
  }
}
