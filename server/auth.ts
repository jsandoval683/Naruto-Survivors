import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, type UserRow } from './db';

const NAME_RE = /^[\p{L}\p{N}_-]{3,16}$/u;

function hash(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function newSession(userId: number): string {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created) VALUES (?, ?, ?)').run(token, userId, Date.now());
  return token;
}

export class AuthError extends Error {}

/** Version of the data policy users authorize when signing up (see public/legal.html, 4.10). */
export const POLICY_VERSION = 'v1-2026-11-12';

export function register(name: string, password: string, consent: unknown): { token: string; user: { id: number; name: string } } {
  name = String(name ?? '').trim();
  password = String(password ?? '');
  if (!NAME_RE.test(name)) throw new AuthError('El nombre debe tener de 3 a 16 letras, números, _ o -.');
  if (password.length < 6) throw new AuthError('La contraseña debe tener al menos 6 caracteres.');
  if (consent !== true) throw new AuthError('Para crear una cuenta debes autorizar el tratamiento de tus datos.');
  if (db.prepare('SELECT 1 FROM users WHERE name = ?').get(name)) throw new AuthError('Ese nombre ya está cogido.');
  const salt = randomBytes(16).toString('hex');
  const now = Date.now();
  const r = db
    .prepare('INSERT INTO users (name, pass_hash, salt, created, consent_at, consent_version) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, hash(password, salt), salt, now, now, POLICY_VERSION);
  const id = Number(r.lastInsertRowid);
  return { token: newSession(id), user: { id, name } };
}

export function login(name: string, password: string): { token: string; user: { id: number; name: string } } {
  const row = db.prepare('SELECT id, name, pass_hash, salt FROM users WHERE name = ?').get(String(name ?? '').trim()) as UserRow | undefined;
  if (!row) throw new AuthError('Nombre o contraseña incorrectos.');
  const a = Buffer.from(hash(String(password ?? ''), row.salt), 'hex');
  const b = Buffer.from(row.pass_hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AuthError('Nombre o contraseña incorrectos.');
  return { token: newSession(row.id), user: { id: row.id, name: row.name } };
}

export function userFromToken(token: string | null | undefined): { id: number; name: string } | null {
  if (!token) return null;
  const row = db.prepare('SELECT u.id AS id, u.name AS name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token) as { id: number; name: string } | undefined;
  return row ?? null;
}

/** Right to erasure: removes the account and everything stored about it. */
export function deleteAccount(userId: number): void {
  db.exec('BEGIN');
  try {
    for (const table of ['runs', 'saves', 'sessions', 'season_claims']) db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function logout(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}
