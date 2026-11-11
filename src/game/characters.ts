import type { JutsuId } from './jutsus';
import type { Nature } from './natures';

/** Multipliers (dmg, cd, speed, area, magnet) and additions (maxHp, regen, crit, armor). */
export interface StatMods {
  dmg?: number;
  cd?: number;
  speed?: number;
  area?: number;
  magnet?: number;
  maxHp?: number;
  regen?: number;
  crit?: number;
  armor?: number;
}

export interface Transform {
  level: number;
  name: string;
  desc: string;
  aura: string;
  mods: StatMods;
}

export type CharacterId = 'naruto' | 'sakura' | 'kakashi' | 'gaara' | 'lee' | 'sasuke' | 'shikamaru' | 'neji' | 'hinata' | 'jiraiya' | 'itachi' | 'minato';

export type Unlock =
  | { kind: 'start' }
  | { kind: 'shop' }
  | { kind: 'boss'; boss: string }
  | { kind: 'survive'; seconds: number }
  | { kind: 'kills'; total: number };

export interface CharacterDef {
  id: CharacterId;
  name: string;
  nature: Nature;
  trait: string;
  start: JutsuId;
  /** Jutsus this ninja can learn in a run (the start one included). */
  pool: JutsuId[];
  mods: StatMods;
  transforms: Transform[];
  unlock: Unlock;
  unlockText: string;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  naruto: {
    id: 'naruto',
    name: 'Naruto',
    nature: 'viento',
    trait: 'Chakra enorme: +20 de vida y regeneración.',
    start: 'rasengan',
    pool: ['rasengan', 'clones', 'kunai', 'sellos'],
    mods: { maxHp: 20, regen: 0.3 },
    transforms: [
      { level: 12, name: 'Modo Sabio', desc: '+25% de daño y +20% de área', aura: '#f39c32', mods: { dmg: 1.25, area: 1.2 } },
      { level: 24, name: 'Modo Chakra Kyūbi', desc: '+30% de daño, +15% de velocidad y -15% de recarga', aura: '#ffd23f', mods: { dmg: 1.3, speed: 1.15, cd: 0.85 } },
    ],
    unlock: { kind: 'start' },
    unlockText: 'Desde el principio',
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura',
    nature: 'tierra',
    trait: 'Control de chakra: +30% de daño, -15 de vida.',
    start: 'puno',
    pool: ['puno', 'kunai', 'sellos', 'clones'],
    mods: { dmg: 1.3, maxHp: -15 },
    transforms: [
      { level: 12, name: 'Sello Byakugō', desc: '+2 vida/s, +30 de vida y +20% de daño', aura: '#b48cff', mods: { regen: 2, maxHp: 30, dmg: 1.2 } },
    ],
    unlock: { kind: 'boss', boss: 'sasori' },
    unlockText: 'Derrota a Sasori',
  },
  kakashi: {
    id: 'kakashi',
    name: 'Kakashi',
    nature: 'rayo',
    trait: 'Ninja copia: -10% de recarga.',
    start: 'raikiri',
    pool: ['raikiri', 'kunai', 'clones', 'katon', 'sellos'],
    mods: { cd: 0.9 },
    transforms: [
      { level: 12, name: 'Sharingan', desc: '+10% de crítico y +15% de daño', aura: '#e01b1b', mods: { crit: 0.1, dmg: 1.15 } },
      { level: 24, name: 'Mangekyō Sharingan', desc: '+25% de daño y -20% de recarga', aura: '#7a0d0d', mods: { dmg: 1.25, cd: 0.8 } },
    ],
    unlock: { kind: 'boss', boss: 'deidara' },
    unlockText: 'Derrota a Deidara',
  },
  gaara: {
    id: 'gaara',
    name: 'Gaara',
    nature: 'tierra',
    trait: 'Armadura de arena: -15% de daño recibido, -8% de velocidad.',
    start: 'arena',
    pool: ['arena', 'kunai', 'sellos', 'clones'],
    mods: { armor: 0.15, speed: 0.92 },
    transforms: [
      { level: 12, name: 'Escudo de arena absoluto', desc: '-20% de daño recibido y +25% de área', aura: '#d8b26a', mods: { armor: 0.2, area: 1.25 } },
    ],
    unlock: { kind: 'survive', seconds: 480 },
    unlockText: 'Sobrevive 8 minutos',
  },
  lee: {
    id: 'lee',
    name: 'Rock Lee',
    nature: 'neutral',
    trait: 'Sin ninjutsu, puro taijutsu: +15% de velocidad.',
    start: 'huracan',
    pool: ['huracan', 'puno', 'kunai', 'sellos'],
    mods: { speed: 1.15 },
    transforms: [
      { level: 12, name: 'Puertas internas', desc: '+20% de daño y +15% de velocidad', aura: '#5cc96b', mods: { dmg: 1.2, speed: 1.15 } },
      { level: 24, name: 'Octava puerta', desc: '+40% de daño y -20% de recarga', aura: '#ff3b1f', mods: { dmg: 1.4, cd: 0.8 } },
    ],
    unlock: { kind: 'kills', total: 2000 },
    unlockText: 'Derrota a 2.000 enemigos en total',
  },
  sasuke: {
    id: 'sasuke',
    name: 'Sasuke',
    nature: 'rayo',
    trait: 'Prodigio Uchiha: +6% de crítico.',
    start: 'chidori',
    pool: ['chidori', 'katon', 'kunai', 'sellos'],
    mods: { crit: 0.06 },
    transforms: [
      { level: 12, name: 'Sello maldito', desc: '+25% de daño, -10 de vida', aura: '#6b3fa0', mods: { dmg: 1.25, maxHp: -10 } },
      { level: 24, name: 'Susanoo', desc: '-25% de daño recibido y +25% de daño', aura: '#9b59ff', mods: { armor: 0.25, dmg: 1.25 } },
    ],
    unlock: { kind: 'boss', boss: 'itachi' },
    unlockText: 'Derrota a Itachi',
  },
  shikamaru: {
    id: 'shikamaru',
    name: 'Shikamaru',
    nature: 'tierra',
    trait: 'Estratega: -10% de recarga y +10% de área.',
    start: 'sombra',
    pool: ['sombra', 'kunai', 'sellos', 'katon'],
    mods: { cd: 0.9, area: 1.1 },
    transforms: [
      { level: 12, name: 'Plan maestro', desc: '+25% de área y -15% de recarga', aura: '#6b5a8a', mods: { area: 1.25, cd: 0.85 } },
      { level: 24, name: 'Sombra de la Hoja', desc: '+30% de daño y +15% de recarga', aura: '#3a2a5a', mods: { dmg: 1.3, cd: 0.85 } },
    ],
    unlock: { kind: 'boss', boss: 'hidan' },
    unlockText: 'Derrota a Hidan',
  },
  neji: {
    id: 'neji',
    name: 'Neji',
    nature: 'neutral',
    trait: 'Byakugan: +8% de crítico y +10% de daño.',
    start: 'kaiten',
    pool: ['kaiten', 'kunai', 'sellos', 'huracan'],
    mods: { crit: 0.08, dmg: 1.1 },
    transforms: [
      { level: 12, name: 'Byakugan', desc: '+10% de crítico y +20% de daño', aura: '#e8e4f0', mods: { crit: 0.1, dmg: 1.2 } },
      { level: 24, name: 'Ocho trigramas', desc: '+30% de daño y -15% de recarga', aura: '#bfe8ff', mods: { dmg: 1.3, cd: 0.85 } },
    ],
    unlock: { kind: 'survive', seconds: 720 },
    unlockText: 'Sobrevive 12 minutos',
  },
  hinata: {
    id: 'hinata',
    name: 'Hinata',
    nature: 'fuego',
    trait: 'Corazón amable: +0,6 vida/s y +10 de vida.',
    start: 'leones',
    pool: ['leones', 'kaiten', 'kunai', 'sellos'],
    mods: { regen: 0.6, maxHp: 10 },
    transforms: [
      { level: 12, name: 'Byakugan', desc: '+20% de daño y +1 vida/s', aura: '#e8e4f0', mods: { dmg: 1.2, regen: 1 } },
      { level: 24, name: 'Chakra de león gemelo', desc: '+30% de daño y +15% de área', aura: '#b48cff', mods: { dmg: 1.3, area: 1.15 } },
    ],
    unlock: { kind: 'boss', boss: 'pain' },
    unlockText: 'Derrota a Pain',
  },
  jiraiya: {
    id: 'jiraiya',
    name: 'Jiraiya',
    nature: 'fuego',
    trait: 'Sannin legendario: +30 de vida, -5% de velocidad.',
    start: 'sapo',
    pool: ['sapo', 'rasengan', 'katon', 'sellos', 'kunai'],
    mods: { maxHp: 30, speed: 0.95 },
    transforms: [
      { level: 12, name: 'Modo Sabio', desc: '+25% de daño y +20% de área', aura: '#f39c32', mods: { dmg: 1.25, area: 1.2 } },
      { level: 24, name: 'Sabio de los sapos', desc: '+30% de daño y -15% de recarga', aura: '#e8701f', mods: { dmg: 1.3, cd: 0.85 } },
    ],
    unlock: { kind: 'kills', total: 10000 },
    unlockText: 'Derrota a 10.000 enemigos en total',
  },
  itachi: {
    id: 'itachi',
    name: 'Itachi',
    nature: 'fuego',
    trait: 'Genio Uchiha: +8% de crítico, -10 de vida.',
    start: 'cuervos',
    pool: ['cuervos', 'katon', 'kunai', 'clones', 'sellos'],
    mods: { crit: 0.08, maxHp: -10 },
    transforms: [
      { level: 12, name: 'Mangekyō Sharingan', desc: '+25% de daño y +5% de crítico', aura: '#e01b1b', mods: { dmg: 1.25, crit: 0.05 } },
      { level: 24, name: 'Susanoo', desc: '-25% de daño recibido y +20% de daño', aura: '#e05a3a', mods: { armor: 0.25, dmg: 1.2 } },
    ],
    unlock: { kind: 'boss', boss: 'madara' },
    unlockText: 'Derrota a Madara',
  },
  minato: {
    id: 'minato',
    name: 'Minato',
    nature: 'viento',
    trait: 'Destello amarillo: +20% de velocidad.',
    start: 'hiraishin',
    pool: ['hiraishin', 'rasengan', 'kunai', 'sellos'],
    mods: { speed: 1.2 },
    transforms: [
      { level: 12, name: 'Modo Sabio', desc: '+25% de daño y +15% de área', aura: '#f39c32', mods: { dmg: 1.25, area: 1.15 } },
      { level: 24, name: 'Modo Chakra Kyūbi', desc: '+30% de daño y -20% de recarga', aura: '#ffd23f', mods: { dmg: 1.3, cd: 0.8 } },
    ],
    unlock: { kind: 'shop' },
    unlockText: 'Solo en la Tienda o en los pergaminos',
  },
};

export const CHARACTER_ORDER: CharacterId[] = ['naruto', 'sakura', 'kakashi', 'gaara', 'lee', 'sasuke', 'shikamaru', 'neji', 'hinata', 'jiraiya', 'itachi', 'minato'];
