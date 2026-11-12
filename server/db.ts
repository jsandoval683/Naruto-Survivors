import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = process.env.DB_PATH ?? 'data/naruto-survivors.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saves (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    data TEXT NOT NULL,
    rev INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    season INTEGER NOT NULL,
    char TEXT NOT NULL,
    time INTEGER NOT NULL,
    kills INTEGER NOT NULL,
    bosses INTEGER NOT NULL,
    level INTEGER NOT NULL,
    win INTEGER NOT NULL,
    coop INTEGER NOT NULL,
    created INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS runs_season ON runs(season, user_id);
  CREATE TABLE IF NOT EXISTS season_claims (
    user_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    PRIMARY KEY (user_id, season)
  );
`);

// Migration: proof of the data-processing authorization (Ley 1581 de 2012).
const userCols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
if (!userCols.includes('consent_at')) db.exec('ALTER TABLE users ADD COLUMN consent_at INTEGER');
if (!userCols.includes('consent_version')) db.exec('ALTER TABLE users ADD COLUMN consent_version TEXT');

export interface UserRow {
  id: number;
  name: string;
  pass_hash: string;
  salt: string;
}
