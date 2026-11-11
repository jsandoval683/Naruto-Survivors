import { db } from './db';

/** Seasons last 14 days, counted from this date (UTC). */
const SEASON_START = Date.UTC(2026, 10, 1);
const SEASON_MS = 14 * 24 * 3600 * 1000;

export type Board = 'kills' | 'survival' | 'bosses';

export const BOARD_SQL: Record<Board, string> = {
  kills: 'SUM(kills)',
  survival: 'MAX(time)',
  bosses: 'SUM(bosses)',
};

export function seasonOf(ts = Date.now()): number {
  return Math.max(1, Math.floor((ts - SEASON_START) / SEASON_MS) + 1);
}

export function seasonEnds(season: number): number {
  return SEASON_START + season * SEASON_MS;
}

export interface RunRecord {
  char: string;
  time: number;
  kills: number;
  bosses: number;
  level: number;
  win: boolean;
  coop: boolean;
}

const clamp = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

export function recordRun(userId: number, r: RunRecord): void {
  db.prepare('INSERT INTO runs (user_id, season, char, time, kills, bosses, level, win, coop, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    userId,
    seasonOf(),
    String(r.char).slice(0, 16),
    clamp(r.time, 3600),
    clamp(r.kills, 200000),
    clamp(r.bosses, 16),
    clamp(r.level, 300),
    r.win ? 1 : 0,
    r.coop ? 1 : 0,
    Date.now(),
  );
}

/** Seconds since the user's last solo run submission (simple flood guard). */
export function lastRunAge(userId: number): number {
  const row = db.prepare('SELECT MAX(created) AS t FROM runs WHERE user_id = ? AND coop = 0').get(userId) as { t: number | null };
  return row.t ? (Date.now() - row.t) / 1000 : Infinity;
}

export interface BoardRow {
  rank: number;
  name: string;
  score: number;
  me?: boolean;
}

export function leaderboard(board: Board, season: number, userId: number | null, limit = 50): { top: BoardRow[]; me: BoardRow | null } {
  const agg = BOARD_SQL[board];
  const rows = db
    .prepare(
      `SELECT u.id AS id, u.name AS name, ${agg} AS score FROM runs r JOIN users u ON u.id = r.user_id
       WHERE r.season = ? GROUP BY r.user_id HAVING score > 0 ORDER BY score DESC, MIN(r.created) ASC`,
    )
    .all(season) as { id: number; name: string; score: number }[];
  const ranked = rows.map((r, i) => ({ rank: i + 1, name: r.name, score: r.score, me: r.id === userId, id: r.id }));
  const me = ranked.find((r) => r.id === userId) ?? null;
  const strip = ({ rank, name, score, me }: (typeof ranked)[number]) => ({ rank, name, score, me });
  return { top: ranked.slice(0, limit).map(strip), me: me ? strip(me) : null };
}

/** Tickets for the previous season's best placement, granted once. */
export function claimSeasonReward(userId: number): { season: number; rank: number; tickets: number } | null {
  const prev = seasonOf() - 1;
  if (prev < 1) return null;
  if (db.prepare('SELECT 1 FROM season_claims WHERE user_id = ? AND season = ?').get(userId, prev)) return null;
  let best = Infinity;
  for (const b of Object.keys(BOARD_SQL) as Board[]) {
    const me = leaderboard(b, prev, userId, 0).me;
    if (me) best = Math.min(best, me.rank);
  }
  db.prepare('INSERT INTO season_claims (user_id, season) VALUES (?, ?)').run(userId, prev);
  if (best > 100) return null;
  const tickets = best === 1 ? 10 : best <= 10 ? 5 : 2;
  return { season: prev, rank: best, tickets };
}
