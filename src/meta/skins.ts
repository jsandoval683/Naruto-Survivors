import type { CharacterId } from '../game/characters';

export interface SkinDef {
  id: string;
  char: CharacterId;
  name: string;
  /** Key into LOOKS. */
  lookId: string;
}

export const SKINS: SkinDef[] = [
  { id: 'naruto_hokage', char: 'naruto', name: 'Naruto Hokage', lookId: 'naruto_hokage' },
  { id: 'sakura_adulta', char: 'sakura', name: 'Sakura adulta', lookId: 'sakura_adulta' },
  { id: 'kakashi_anbu', char: 'kakashi', name: 'Kakashi ANBU', lookId: 'kakashi_anbu' },
  { id: 'gaara_kazekage', char: 'gaara', name: 'Gaara Kazekage', lookId: 'gaara_kazekage' },
  { id: 'lee_puertas', char: 'lee', name: 'Lee de las Puertas', lookId: 'lee_puertas' },
  { id: 'sasuke_akatsuki', char: 'sasuke', name: 'Sasuke de Akatsuki', lookId: 'sasuke_akatsuki' },
];

export function skinFor(charId: string, skinSel: Record<string, string>): SkinDef | null {
  const id = skinSel[charId];
  return SKINS.find((s) => s.id === id && s.char === charId) ?? null;
}
