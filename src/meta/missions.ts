import type { DailyState, SaveData } from '../core/save';
import type { RunSummary } from './summary';

export interface MissionDef {
  id: string;
  text: string;
  target: number;
  reward: number;
  /** Cumulative missions add up across runs; the rest take the best single run. */
  cumulative?: boolean;
  metric(s: RunSummary): number;
}

export const MISSION_POOL: MissionDef[] = [
  { id: 'k300', text: 'Derrota a 300 enemigos', target: 300, reward: 150, cumulative: true, metric: (s) => s.kills },
  { id: 'k1500', text: 'Derrota a 1.500 enemigos', target: 1500, reward: 300, cumulative: true, metric: (s) => s.kills },
  { id: 't5', text: 'Sobrevive 5 minutos en una partida', target: 300, reward: 150, metric: (s) => s.time },
  { id: 't10', text: 'Sobrevive 10 minutos en una partida', target: 600, reward: 300, metric: (s) => s.time },
  { id: 'deidara', text: 'Derrota a Deidara', target: 1, reward: 200, metric: (s) => +s.bosses.includes('deidara') },
  { id: 'kakuzu', text: 'Derrota a Kakuzu', target: 1, reward: 300, metric: (s) => +s.bosses.includes('kakuzu') },
  { id: 'itachi', text: 'Derrota a Itachi', target: 1, reward: 350, metric: (s) => +s.bosses.includes('itachi') },
  { id: 'transform', text: 'Transfórmate una vez', target: 1, reward: 150, metric: (s) => +(s.form >= 0) },
  { id: 'evolve', text: 'Evoluciona un jutsu', target: 1, reward: 200, metric: (s) => s.evolutions.length },
  { id: 'biju3', text: 'Reúne 3 bijū en una partida', target: 3, reward: 200, metric: (s) => s.biju },
  { id: 'lv20', text: 'Llega al nivel 20', target: 20, reward: 200, metric: (s) => s.level },
  { id: 'runs3', text: 'Juega 3 partidas', target: 3, reward: 150, cumulative: true, metric: () => 1 },
];

export const DAILY_BONUS_TICKETS = 2;

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** The 3 missions of a given day (same for everyone on that date). */
export function dailyMissions(date: string): MissionDef[] {
  const rnd = seeded(date);
  const pool = [...MISSION_POOL];
  const out: MissionDef[] = [];
  while (out.length < 3) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}

export function ensureDaily(save: SaveData): DailyState {
  const date = todayKey();
  if (!save.daily || save.daily.date !== date) save.daily = { date, progress: {}, done: [], bonus: false };
  return save.daily;
}

/** Applies a run to today's missions; grants rewards and returns what was completed. */
export function applyDaily(save: SaveData, s: RunSummary): { done: MissionDef[]; bonus: boolean } {
  const daily = ensureDaily(save);
  const done: MissionDef[] = [];
  const missions = dailyMissions(daily.date);
  for (const m of missions) {
    if (daily.done.includes(m.id)) continue;
    const v = m.metric(s);
    const prev = daily.progress[m.id] ?? 0;
    daily.progress[m.id] = m.cumulative ? prev + v : Math.max(prev, v);
    if (daily.progress[m.id] >= m.target) {
      daily.done.push(m.id);
      save.ryo += m.reward;
      done.push(m);
    }
  }
  let bonus = false;
  if (!daily.bonus && missions.every((m) => daily.done.includes(m.id))) {
    daily.bonus = true;
    save.tickets += DAILY_BONUS_TICKETS;
    bonus = true;
  }
  return { done, bonus };
}

export function timeToReset(now = new Date()): string {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const mins = Math.ceil((next.getTime() - now.getTime()) / 60000);
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}
