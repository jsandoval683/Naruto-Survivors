import type { CharacterId } from '../game/characters';

/** What a finished run reports to missions, achievements and the save. */
export interface RunSummary {
  char: CharacterId;
  win: boolean;
  time: number;
  level: number;
  kills: number;
  bosses: string[];
  /** Index of the last transformation reached (-1 none). */
  form: number;
  finalForm: boolean;
  evolutions: string[];
  biju: number;
  wish: boolean;
  ryo: number;
}
