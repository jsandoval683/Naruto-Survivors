import { replaceSave, writeSave, type SaveData } from '../core/save';

const TOKEN_KEY = 'ns_token';
const REV_KEY = 'ns_cloud_rev';

export interface Account {
  id: number;
  name: string;
}

export interface BoardRow {
  rank: number;
  name: string;
  score: number;
  me?: boolean;
}

export interface Ranking {
  board: string;
  season: number;
  seasonEnds: number;
  top: BoardRow[];
  me: BoardRow | null;
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = storageGet(TOKEN_KEY);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'No se puede conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Error del servidor.', data);
  return data as T;
}

/** Account session, cloud save sync and online features. */
export class Online {
  account: Account | null = null;
  season = 0;
  seasonEnds = 0;
  /** Messages for the menu (season rewards, sync notes). */
  notices: string[] = [];
  private pushTimer: number | undefined;
  private pushing = false;

  constructor(private save: SaveData, private onChange: () => void) {}

  get token(): string | null {
    return storageGet(TOKEN_KEY);
  }

  /** Restores a previous session on page load. */
  async resume(): Promise<void> {
    if (!this.token) return;
    try {
      await this.loadMe();
      await this.pull(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) this.forget();
    }
    this.onChange();
  }

  async login(name: string, password: string, create: boolean): Promise<void> {
    const r = await call<{ token: string; user: Account }>('POST', create ? '/register' : '/login', { name, password });
    storageSet(TOKEN_KEY, r.token);
    storageSet(REV_KEY, null);
    await this.loadMe();
    await this.pull(true);
    this.onChange();
  }

  async logout(): Promise<void> {
    try {
      await call('POST', '/logout');
    } catch {
      // the token is dropped locally anyway
    }
    this.forget();
    this.onChange();
  }

  private forget(): void {
    storageSet(TOKEN_KEY, null);
    storageSet(REV_KEY, null);
    this.account = null;
  }

  private async loadMe(): Promise<void> {
    const me = await call<{ user: Account; season: number; seasonEnds: number; reward: { season: number; rank: number; tickets: number } | null }>('GET', '/me');
    this.account = me.user;
    this.season = me.season;
    this.seasonEnds = me.seasonEnds;
    if (me.reward) {
      this.save.tickets += me.reward.tickets;
      writeSave(this.save);
      this.notices.push(`Temporada ${me.reward.season}: quedaste en el puesto ${me.reward.rank}. +${me.reward.tickets} pergaminos`);
    }
  }

  /**
   * Gets the cloud copy. On a fresh login, if both this device and the cloud have
   * progress, asks which to keep; otherwise the cloud wins and an empty cloud gets ours.
   */
  private async pull(fresh: boolean): Promise<void> {
    const cloud = await call<{ data: SaveData | null; rev: number }>('GET', '/save');
    if (!cloud.data) {
      storageSet(REV_KEY, '0');
      await this.push();
      return;
    }
    const localRev = Number(storageGet(REV_KEY) ?? -1);
    if (!fresh && localRev === cloud.rev) return; // nothing new upstream
    let useCloud = true;
    if (fresh && this.save.runs > 0) {
      useCloud = window.confirm(
        `Tu cuenta ya tiene progreso en la nube (${cloud.data.runs ?? 0} partidas, ${cloud.data.ryo ?? 0} ryō).\n` +
          `Este dispositivo tiene ${this.save.runs} partidas y ${this.save.ryo} ryō.\n\n` +
          'Aceptar: usar el de la nube.  Cancelar: subir el de este dispositivo.',
      );
    }
    storageSet(REV_KEY, String(cloud.rev));
    if (useCloud) {
      replaceSave(this.save, cloud.data);
      writeSave(this.save, false);
    } else {
      await this.push();
    }
  }

  /** Debounced upload after local changes. */
  schedulePush(): void {
    if (!this.account) return;
    window.clearTimeout(this.pushTimer);
    this.pushTimer = window.setTimeout(() => void this.push(), 1500);
  }

  private async push(): Promise<void> {
    if (!this.token || this.pushing) return;
    this.pushing = true;
    try {
      const rev = Number(storageGet(REV_KEY) ?? 0);
      const r = await call<{ rev: number }>('PUT', '/save', { rev, data: this.save });
      storageSet(REV_KEY, String(r.rev));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.body?.data) {
        // Another device saved first: take the newer cloud copy.
        replaceSave(this.save, e.body.data);
        writeSave(this.save, false);
        storageSet(REV_KEY, String(e.body.rev));
        this.notices.push('Se ha cargado una versión más reciente de tu progreso desde otro dispositivo.');
        this.onChange();
      }
    } finally {
      this.pushing = false;
    }
  }

  async submitRun(run: { char: string; time: number; kills: number; bosses: number; level: number; win: boolean }): Promise<void> {
    if (!this.account) return;
    try {
      await call('POST', '/runs', run);
    } catch {
      // Ranking is best-effort; a failed submit never blocks the game.
    }
  }

  async ranking(board: string, season?: number): Promise<Ranking> {
    return call<Ranking>('GET', `/ranking?board=${encodeURIComponent(board)}${season ? `&season=${season}` : ''}`);
  }
}
