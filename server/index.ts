import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { WebSocketServer } from 'ws';
import { AuthError, deleteAccount, login, logout, register, userFromToken } from './auth';
import { db } from './db';
import { claimSeasonReward, lastRunAge, leaderboard, recordRun, seasonEnds, seasonOf, type Board } from './ranking';
import { handleClose, handleMessage, type Conn } from './rooms';
import type { ClientMsg } from '../src/net/protocol';

const PORT = Number(process.env.PORT ?? 8787);
/** Interface to listen on. Behind a reverse proxy use 127.0.0.1 so the port isn't reachable from outside. */
const HOST = process.env.HOST ?? '0.0.0.0';
/** Set to 1 when behind a proxy (Caddy) that sets X-Forwarded-For. */
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? 'dist');
const MAX_BODY = 512 * 1024;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'Petición demasiado grande.');
    chunks.push(c as Buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'JSON no válido.');
  }
}

function clientIp(req: IncomingMessage): string {
  if (TRUST_PROXY) {
    const xff = String(req.headers['x-forwarded-for'] ?? '').split(',').pop()?.trim();
    if (xff) return xff;
  }
  return req.socket.remoteAddress ?? '?';
}

/** Brute-force guard for login/register: at most AUTH_MAX attempts per IP every AUTH_WINDOW ms. */
const AUTH_MAX = 15;
const AUTH_WINDOW = 10 * 60 * 1000;
const authHits = new Map<string, { n: number; reset: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of authHits) if (h.reset < now) authHits.delete(ip);
}, 60 * 1000).unref();

function limitAuth(req: IncomingMessage): void {
  const ip = clientIp(req);
  const now = Date.now();
  let h = authHits.get(ip);
  if (!h || h.reset < now) authHits.set(ip, (h = { n: 0, reset: now + AUTH_WINDOW }));
  if (++h.n > AUTH_MAX) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
}

function bearer(req: IncomingMessage): string | null {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function requireUser(req: IncomingMessage): { id: number; name: string } {
  const u = userFromToken(bearer(req));
  if (!u) throw new HttpError(401, 'Tienes que iniciar sesión.');
  return u;
}

async function api(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const route = `${req.method} ${url.pathname}`;
  switch (route) {
    case 'POST /api/register': {
      limitAuth(req);
      const b = await readBody(req);
      return json(res, 200, register(b.name, b.password, b.consent));
    }
    case 'POST /api/login': {
      limitAuth(req);
      const b = await readBody(req);
      return json(res, 200, login(b.name, b.password));
    }
    case 'POST /api/logout': {
      const t = bearer(req);
      if (t) logout(t);
      return json(res, 200, { ok: true });
    }
    case 'DELETE /api/account': {
      const u = requireUser(req);
      deleteAccount(u.id);
      return json(res, 200, { ok: true });
    }
    case 'GET /api/me': {
      const u = requireUser(req);
      const season = seasonOf();
      return json(res, 200, { user: u, season, seasonEnds: seasonEnds(season), reward: claimSeasonReward(u.id) });
    }
    case 'GET /api/save': {
      const u = requireUser(req);
      const row = db.prepare('SELECT data, rev FROM saves WHERE user_id = ?').get(u.id) as { data: string; rev: number } | undefined;
      return json(res, 200, row ? { data: JSON.parse(row.data), rev: row.rev } : { data: null, rev: 0 });
    }
    case 'PUT /api/save': {
      const u = requireUser(req);
      const b = await readBody(req);
      if (!b.data || typeof b.data !== 'object') throw new HttpError(400, 'Falta la partida.');
      const row = db.prepare('SELECT data, rev FROM saves WHERE user_id = ?').get(u.id) as { data: string; rev: number } | undefined;
      const current = row?.rev ?? 0;
      // Optimistic concurrency: another device saved in between → hand back the newer copy.
      if (Number(b.rev) !== current) return json(res, 409, { data: row ? JSON.parse(row.data) : null, rev: current });
      const rev = current + 1;
      db.prepare('INSERT INTO saves (user_id, data, rev, updated) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, rev = excluded.rev, updated = excluded.updated').run(
        u.id,
        JSON.stringify(b.data),
        rev,
        Date.now(),
      );
      return json(res, 200, { rev });
    }
    case 'POST /api/runs': {
      const u = requireUser(req);
      const b = await readBody(req);
      if (lastRunAge(u.id) < 20) throw new HttpError(429, 'Demasiadas partidas seguidas.');
      recordRun(u.id, { char: b.char, time: b.time, kills: b.kills, bosses: b.bosses, level: b.level, win: !!b.win, coop: false });
      return json(res, 200, { ok: true });
    }
    case 'GET /api/ranking': {
      const u = userFromToken(bearer(req));
      const board = (['kills', 'survival', 'bosses'].includes(url.searchParams.get('board') ?? '') ? url.searchParams.get('board') : 'kills') as Board;
      const season = Number(url.searchParams.get('season')) || seasonOf();
      return json(res, 200, { board, season, seasonEnds: seasonEnds(season), ...leaderboard(board, season, u?.id ?? null) });
    }
  }
  throw new HttpError(404, 'No encontrado.');
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function serveStatic(res: ServerResponse, pathname: string): void {
  if (!existsSync(STATIC_DIR)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Servidor de la API en marcha. En desarrollo abre el juego con "npm run dev".');
    return;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Ruta no válida.');
    return;
  }
  let file = normalize(join(STATIC_DIR, decoded));
  if (!file.startsWith(STATIC_DIR + sep) || !existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, 'index.html');
  // Vite's hashed bundles never change; everything else must be revalidated so updates reach players.
  const cache = file.startsWith(join(STATIC_DIR, 'assets') + sep) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': cache });
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(res, url.pathname);
  try {
    await api(req, res, url);
  } catch (err) {
    if (err instanceof AuthError) return json(res, 400, { error: err.message });
    if (err instanceof HttpError) return json(res, err.status, { error: err.message });
    console.error(err);
    json(res, 500, { error: 'Error del servidor.' });
  }
});

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: true, maxPayload: 64 * 1024 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname !== '/ws') return socket.destroy();
  const user = userFromToken(url.searchParams.get('token'));
  if (!user) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const conn: Conn = { ws, user, room: null };
    ws.send(JSON.stringify({ type: 'hello', userId: user.id, name: user.name }));
    ws.on('message', (data) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      try {
        handleMessage(conn, msg);
      } catch (err) {
        console.error('ws message error', err);
      }
    });
    ws.on('close', () => handleClose(conn));
  });
});

server.listen(PORT, HOST, () => console.log(`Shinobi Survivors server on http://${HOST}:${PORT}`));

// systemd stops the service with SIGTERM: close cleanly so SQLite checkpoints its WAL.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    for (const ws of wss.clients) ws.close(1001, 'Servidor reiniciándose');
    server.close();
    db.close();
    process.exit(0);
  });
}
