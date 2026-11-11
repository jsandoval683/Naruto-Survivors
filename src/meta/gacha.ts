import type { SaveData } from '../core/save';
import { CHARACTERS, CHARACTER_ORDER } from '../game/characters';
import { SKINS } from './skins';

export type Rarity = 'comun' | 'raro' | 'epico' | 'legendario';

export const RARITY: Record<Rarity, { name: string; chance: number; color: string }> = {
  comun: { name: 'Común', chance: 0.7, color: '#b8bec6' },
  raro: { name: 'Raro', chance: 0.24, color: '#4fb3ff' },
  epico: { name: 'Épico', chance: 0.05, color: '#b48cff' },
  legendario: { name: 'Legendario', chance: 0.01, color: '#ffd23f' },
};

export const PITY = 80;
export const TICKET_PRICE = 250;

export interface Prize {
  rarity: Rarity;
  text: string;
}

function rollRarity(save: SaveData, forceRare: boolean): Rarity {
  if (save.pity + 1 >= PITY) return 'legendario';
  const r = Math.random();
  if (r < RARITY.legendario.chance) return 'legendario';
  if (r < RARITY.legendario.chance + RARITY.epico.chance) return 'epico';
  if (forceRare || r < RARITY.legendario.chance + RARITY.epico.chance + RARITY.raro.chance) return 'raro';
  return 'comun';
}

function grantRyo(save: SaveData, amount: number, rarity: Rarity, note = ''): Prize {
  save.ryo += amount;
  return { rarity, text: `${amount} ryō${note}` };
}

function pullOne(save: SaveData, forceRare: boolean): Prize {
  const rarity = rollRarity(save, forceRare);
  save.pulls++;
  save.pity = rarity === 'legendario' ? 0 : save.pity + 1;
  const freeSkins = SKINS.filter((s) => !save.skins.includes(s.id));
  switch (rarity) {
    case 'comun':
      return grantRyo(save, 60 + Math.floor(Math.random() * 91), rarity);
    case 'raro':
      return grantRyo(save, 300 + Math.floor(Math.random() * 201), rarity);
    case 'epico': {
      if (!freeSkins.length) return grantRyo(save, 1500, rarity, ' (ya tienes todas las apariencias)');
      const s = freeSkins[Math.floor(Math.random() * freeSkins.length)];
      save.skins.push(s.id);
      return { rarity, text: `Apariencia: ${s.name}` };
    }
    case 'legendario': {
      const locked = CHARACTER_ORDER.filter((id) => !save.unlocked.includes(id));
      if (locked.length) {
        const id = locked[Math.floor(Math.random() * locked.length)];
        save.unlocked.push(id);
        return { rarity, text: `¡Ninja: ${CHARACTERS[id].name}!` };
      }
      if (freeSkins.length) {
        const s = freeSkins[Math.floor(Math.random() * freeSkins.length)];
        save.skins.push(s.id);
        return { rarity, text: `Apariencia: ${s.name}` };
      }
      return grantRyo(save, 5000, rarity);
    }
  }
}

/** Spends tickets; a ×10 pull guarantees at least one Raro or better. */
export function pull(save: SaveData, count: 1 | 10): Prize[] | null {
  if (save.tickets < count) return null;
  save.tickets -= count;
  const prizes: Prize[] = [];
  for (let i = 0; i < count; i++) {
    const last = i === count - 1;
    const needRare = count === 10 && last && prizes.every((p) => p.rarity === 'comun');
    prizes.push(pullOne(save, needRare));
  }
  return prizes;
}
