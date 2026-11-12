import type { SaveData } from '../core/save';
import { CHARACTERS, CHARACTER_ORDER } from '../game/characters';
import { JUTSUS, type JutsuId } from '../game/jutsus';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  ryo?: number;
  tickets?: number;
  check(s: SaveData): boolean;
}

const beat = (...ids: string[]) => (s: SaveData) => ids.every((id) => s.bossesDefeated.includes(id));
const PATHS = ['path0', 'path1', 'path2', 'path3', 'path4', 'path5'];
const ALL_EVOLUTIONS = Object.keys(JUTSUS) as JutsuId[];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'k100', name: 'Primeros pasos', desc: 'Derrota a 100 enemigos en total', ryo: 100, check: (s) => s.kills >= 100 },
  { id: 'k1000', name: 'Ninja de rango C', desc: 'Derrota a 1.000 enemigos en total', ryo: 300, tickets: 1, check: (s) => s.kills >= 1000 },
  { id: 'k10000', name: 'Ninja de rango A', desc: 'Derrota a 10.000 enemigos en total', tickets: 3, check: (s) => s.kills >= 10000 },
  { id: 'k50000', name: 'Leyenda de la Hoja', desc: 'Derrota a 50.000 enemigos en total', tickets: 5, check: (s) => s.kills >= 50000 },

  { id: 'b_deidara', name: 'El arte es una explosión', desc: 'Derrota a Deidara', ryo: 200, check: beat('deidara') },
  { id: 'b_sasori', name: 'Marionetista', desc: 'Derrota a Sasori', ryo: 250, check: beat('sasori') },
  { id: 'b_inmortales', name: 'Ni tan inmortales', desc: 'Derrota a Hidan y a Kakuzu', ryo: 300, tickets: 1, check: beat('hidan', 'kakuzu') },
  { id: 'b_itachi', name: 'Más allá del Tsukuyomi', desc: 'Derrota a Itachi', ryo: 400, tickets: 1, check: beat('itachi') },
  { id: 'b_caminos', name: 'Seis Caminos', desc: 'Derrota a los Seis Caminos de Pain', ryo: 400, tickets: 1, check: beat(...PATHS) },
  { id: 'b_pain', name: 'Conocer el dolor', desc: 'Derrota a Pain', ryo: 500, tickets: 2, check: beat('pain') },
  { id: 'b_kages', name: 'Edo Tensei', desc: 'Derrota a los tres Kages reanimados', ryo: 500, tickets: 2, check: beat('raikage', 'tsuchikage', 'mizukage') },
  { id: 'b_madara', name: 'Fin de la guerra', desc: 'Derrota a Madara', tickets: 3, check: beat('madara') },
  { id: 'b_juubi', name: 'El Juubi cae', desc: 'Derrota a Óbito y a Madara de los Seis Caminos', tickets: 3, check: beat('obito', 'madara_rikudo') },
  { id: 'b_kaguya', name: 'Sello de los Seis Caminos', desc: 'Derrota a Kaguya', tickets: 8, check: beat('kaguya') },

  { id: 't5', name: 'Superviviente', desc: 'Aguanta 5 minutos', ryo: 150, check: (s) => s.bestTime >= 300 },
  { id: 't10', name: 'Veterano', desc: 'Aguanta 10 minutos', ryo: 300, check: (s) => s.bestTime >= 600 },
  { id: 't15', name: 'Inquebrantable', desc: 'Aguanta 15 minutos', ryo: 500, tickets: 1, check: (s) => s.bestTime >= 900 },
  { id: 'lv25', name: 'Chūnin', desc: 'Llega al nivel 25 en una partida', ryo: 200, check: (s) => s.bestLevel >= 25 },
  { id: 'lv50', name: 'Jōnin', desc: 'Llega al nivel 50 en una partida', ryo: 500, tickets: 1, check: (s) => s.bestLevel >= 50 },

  ...CHARACTER_ORDER.map((id) => ({
    id: `win_${id}`,
    name: `Victoria con ${CHARACTERS[id].name}`,
    desc: `Derrota a Kaguya con ${CHARACTERS[id].name}`,
    tickets: 2,
    check: (s: SaveData) => (s.winsBy[id] ?? 0) > 0,
  })),

  { id: 'final_form', name: 'Poder absoluto', desc: 'Alcanza la última transformación de un ninja', ryo: 300, check: (s) => s.finalForms.length > 0 },
  { id: 'evo1', name: 'Evolución', desc: 'Evoluciona un jutsu', ryo: 200, check: (s) => s.evolutions.length > 0 },
  { id: 'evo_all', name: 'Maestro de los jutsus', desc: 'Evoluciona los 10 jutsus', tickets: 5, check: (s) => ALL_EVOLUTIONS.every((j) => s.evolutions.includes(j)) },
  { id: 'wish', name: 'El deseo del Juubi', desc: 'Reúne a los 9 bijū en una partida', tickets: 2, check: (s) => s.wishes > 0 },
  { id: 'all_ninjas', name: 'Equipo completo', desc: 'Desbloquea a todos los ninjas', tickets: 3, check: (s) => CHARACTER_ORDER.every((id) => s.unlocked.includes(id)) },
  { id: 'pulls50', name: 'Coleccionista', desc: 'Abre 50 pergaminos de la suerte', ryo: 500, check: (s) => s.pulls >= 50 },
];

/** Grants every newly met achievement and returns them. */
export function checkAchievements(save: SaveData): AchievementDef[] {
  const fresh: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements.includes(a.id) || !a.check(save)) continue;
    save.achievements.push(a.id);
    save.ryo += a.ryo ?? 0;
    save.tickets += a.tickets ?? 0;
    fresh.push(a);
  }
  return fresh;
}

export function rewardText(a: { ryo?: number; tickets?: number }): string {
  return [a.ryo ? `${a.ryo} ryō` : '', a.tickets ? `${a.tickets} ${a.tickets === 1 ? 'pergamino' : 'pergaminos'}` : ''].filter(Boolean).join(' + ');
}
