import type { Game } from './game';
import { JUTSUS, JUTSU_MAX_LEVEL } from './jutsus';
import { PASSIVES } from './passives';

export const MAX_JUTSUS = 5;
export const MAX_PASSIVES = 5;

export interface Choice {
  key: string;
  title: string;
  tag: string;
  isNew: boolean;
  desc: string;
  icon: string;
  color: string;
  weight: number;
  apply(g: Game): void;
}

function allChoices(g: Game): Choice[] {
  const out: Choice[] = [];

  for (const id of g.char.pool) {
    const def = JUTSUS[id];
    const w = g.weapons.find((x) => x.id === id);
    const lvl = w?.level ?? 0;
    if (!w && g.weapons.length < MAX_JUTSUS) {
      out.push({
        key: `j:${id}`,
        title: def.name,
        tag: 'Nuevo jutsu',
        isNew: true,
        desc: def.desc,
        icon: def.icon,
        color: def.color,
        weight: 1.2,
        apply: (game) => game.addJutsu(id),
      });
    } else if (w && lvl < JUTSU_MAX_LEVEL) {
      out.push({
        key: `j:${id}`,
        title: def.name,
        tag: `Nivel ${lvl + 1}`,
        isNew: false,
        desc: def.upgrades[lvl - 1],
        icon: def.icon,
        color: def.color,
        weight: 1,
        apply: (game) => game.addJutsu(id),
      });
    } else if (w && !w.evolved && (g.passives.get(def.evolution.passive) ?? 0) > 0) {
      out.push({
        key: `e:${id}`,
        title: def.evolution.name,
        tag: 'Evolución',
        isNew: true,
        desc: def.evolution.desc,
        icon: def.icon,
        color: '#ffd23f',
        weight: 4,
        apply: (game) => game.evolve(id),
      });
    }
  }

  for (const def of Object.values(PASSIVES)) {
    const lvl = g.passives.get(def.id) ?? 0;
    const canAdd = lvl > 0 || g.passives.size < MAX_PASSIVES;
    if (canAdd && lvl < def.max) {
      // Hint which passive evolves something you already carry.
      const evolves = g.weapons.find((w) => JUTSUS[w.id].evolution.passive === def.id && !w.evolved);
      out.push({
        key: `p:${def.id}`,
        title: def.name,
        tag: lvl === 0 ? 'Nueva pasiva' : `Pasiva · Nivel ${lvl + 1}`,
        isNew: lvl === 0,
        desc: evolves && lvl === 0 ? `${def.desc} Evoluciona ${JUTSUS[evolves.id].name}.` : def.desc,
        icon: def.icon,
        color: def.color,
        weight: 0.8,
        apply: (game) => game.addPassive(def.id),
      });
    }
  }
  return out;
}

const FALLBACKS: Choice[] = [
  {
    key: 'f:ramen',
    title: 'Ramen Ichiraku',
    tag: 'Curación',
    isNew: false,
    desc: 'Recupera el 40% de la vida.',
    icon: '麺',
    color: '#ffb347',
    weight: 1,
    apply: (g) => g.heal(g.stats.maxHp * 0.4),
  },
  {
    key: 'f:ryo',
    title: 'Bolsa de ryō',
    tag: 'Dinero',
    isNew: false,
    desc: '+25 ryō al terminar la partida.',
    icon: '両',
    color: '#ffd23f',
    weight: 1,
    apply: (g) => {
      g.ryo += 25;
    },
  },
];

/** Picks up to 3 distinct weighted options; falls back to heal/ryō when everything is maxed. */
export function rollChoices(g: Game): Choice[] {
  const pool = allChoices(g);
  const picked: Choice[] = [];
  while (picked.length < 3 && pool.length) {
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let roll = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      roll -= pool[idx].weight;
      if (roll <= 0) break;
    }
    picked.push(pool.splice(idx, 1)[0]);
  }
  for (const f of FALLBACKS) if (picked.length < 3) picked.push(f);
  return picked;
}
