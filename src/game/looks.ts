/** Appearance of a character, boss or minion; the pixel-art generator builds its sprite from this. */
export interface Look {
  id: string;
  skin: string;
  hair: string;
  hairStyle: 'spiky' | 'bob' | 'bowl' | 'long' | 'ponytail' | 'slick' | 'tall' | 'hood' | 'bun' | 'none';
  top: string;
  bottom: string;
  eye: string;
  band?: string;
  mask?: string;
  cloak?: boolean;
  extra?: 'whiskers' | 'gourd' | 'brows' | 'piercings' | 'cracks' | 'gills' | 'glasses' | 'facepaint' | 'horns';
  /** Wider body (heavy enemies). */
  bulky?: boolean;
}

export const LOOKS: Record<string, Look> = {
  naruto: { id: 'naruto', skin: '#f2c99a', hair: '#ffd23f', hairStyle: 'spiky', top: '#f5822a', bottom: '#e8701f', eye: '#1b3a6b', band: '#2a4b8d', extra: 'whiskers' },
  sakura: { id: 'sakura', skin: '#f5d0b0', hair: '#f7a8c8', hairStyle: 'bob', top: '#c0392b', bottom: '#3a3f47', eye: '#2e8b57', band: '#c0392b' },
  kakashi: { id: 'kakashi', skin: '#f2c99a', hair: '#d0d4d8', hairStyle: 'tall', top: '#4f6b3a', bottom: '#2c3e50', eye: '#222', band: '#2c3e50', mask: '#2c3e50' },
  gaara: { id: 'gaara', skin: '#f0d5b8', hair: '#c0392b', hairStyle: 'spiky', top: '#8b2e2e', bottom: '#5a1f1f', eye: '#3fb59b', extra: 'gourd' },
  lee: { id: 'lee', skin: '#f2c99a', hair: '#151515', hairStyle: 'bowl', top: '#3d9b3d', bottom: '#f39c32', eye: '#151515', extra: 'brows' },
  sasuke: { id: 'sasuke', skin: '#f2d8c0', hair: '#1d2233', hairStyle: 'spiky', top: '#e8e8f0', bottom: '#4a4a6a', eye: '#151515' },

  // Skins (lucky scrolls)
  naruto_hokage: { id: 'naruto_hokage', skin: '#f2c99a', hair: '#ffd23f', hairStyle: 'spiky', top: '#f4f1ea', bottom: '#e8701f', eye: '#1b3a6b', band: '#2a4b8d', extra: 'whiskers' },
  sakura_adulta: { id: 'sakura_adulta', skin: '#f5d0b0', hair: '#f7a8c8', hairStyle: 'long', top: '#7a2a5a', bottom: '#2c2c3a', eye: '#2e8b57', band: '#7a2a5a' },
  kakashi_anbu: { id: 'kakashi_anbu', skin: '#f2c99a', hair: '#d0d4d8', hairStyle: 'tall', top: '#8a9098', bottom: '#2a2a2a', eye: '#222', mask: '#efefef' },
  gaara_kazekage: { id: 'gaara_kazekage', skin: '#f0d5b8', hair: '#c0392b', hairStyle: 'spiky', top: '#eef0f2', bottom: '#3a6aa0', eye: '#3fb59b', extra: 'gourd' },
  lee_puertas: { id: 'lee_puertas', skin: '#e8907a', hair: '#151515', hairStyle: 'bowl', top: '#2f8a2f', bottom: '#f39c32', eye: '#fff', extra: 'brows' },
  sasuke_akatsuki: { id: 'sasuke_akatsuki', skin: '#f2d8c0', hair: '#1d2233', hairStyle: 'spiky', top: '#111', bottom: '#111', eye: '#e01b1b', cloak: true },

  // Minions (headband plate / chest mark take the enemy's nature colour)
  renegade: { id: 'renegade', skin: '#d9b08c', hair: '#2a2a30', hairStyle: 'spiky', top: '#4a4f5a', bottom: '#33363d', eye: '#ffe66b', band: '#2c2c34', mask: '#2c2c34' },
  brute: { id: 'brute', skin: '#c99a74', hair: '#2a2a30', hairStyle: 'none', top: '#5a3e30', bottom: '#3a2a22', eye: '#ffe66b', band: '#2c2c34', bulky: true },
  zetsu: { id: 'zetsu', skin: '#ecebe4', hair: '#ecebe4', hairStyle: 'none', top: '#e2e0d6', bottom: '#cfccc0', eye: '#2a2a2a' },
  puppet: { id: 'puppet', skin: '#c08a58', hair: '#4a2f1c', hairStyle: 'bob', top: '#7a5232', bottom: '#5a3a22', eye: '#c0392b', extra: 'cracks' },

  // Playable (added later)
  shikamaru: { id: 'shikamaru', skin: '#f2c99a', hair: '#26232b', hairStyle: 'bun', top: '#4f6b3a', bottom: '#2c3e50', eye: '#222', band: '#2c3e50' },
  neji: { id: 'neji', skin: '#f2d8c0', hair: '#3a2a20', hairStyle: 'long', top: '#e8e2d6', bottom: '#4a4a5a', eye: '#d8d4e8', band: '#2a4b8d' },
  hinata: { id: 'hinata', skin: '#f5dcc8', hair: '#2d2a5a', hairStyle: 'long', top: '#d8cce8', bottom: '#2a2a4a', eye: '#d8d4e8', band: '#2a4b8d' },
  jiraiya: { id: 'jiraiya', skin: '#f0c898', hair: '#eeeeee', hairStyle: 'long', top: '#2f6a3a', bottom: '#2f6a3a', eye: '#222', band: '#8b5e3c', extra: 'facepaint' },
  minato: { id: 'minato', skin: '#f2c99a', hair: '#ffd23f', hairStyle: 'spiky', top: '#f4f1ea', bottom: '#2c3e50', eye: '#1b5a9a', band: '#2a4b8d' },

  // Enemies (added later)
  sound: { id: 'sound', skin: '#d9b08c', hair: '#8a8e96', hairStyle: 'slick', top: '#b8a98a', bottom: '#5a4a3a', eye: '#222', band: '#4a3a6a' },
  sharkman: { id: 'sharkman', skin: '#6a9ac0', hair: '#2d4a6b', hairStyle: 'spiky', top: '#4a5a6a', bottom: '#2c3440', eye: '#f4f6f8', band: '#2c3440', extra: 'gills' },
  orochimaru: { id: 'orochimaru', skin: '#e8e4f0', hair: '#141414', hairStyle: 'long', top: '#d8d0c0', bottom: '#5a3a7a', eye: '#e8c020', extra: 'facepaint' },
  kisame: { id: 'kisame', skin: '#6a9ac0', hair: '#2d4a6b', hairStyle: 'spiky', top: '#111', bottom: '#111', eye: '#f4f6f8', cloak: true, extra: 'gills' },
  konan: { id: 'konan', skin: '#f2d8c0', hair: '#6a5ab8', hairStyle: 'bun', top: '#111', bottom: '#111', eye: '#c9a0e0', cloak: true, extra: 'piercings' },
  kabuto: { id: 'kabuto', skin: '#f0d8c0', hair: '#c9ccd2', hairStyle: 'ponytail', top: '#6a3a8a', bottom: '#3a2a4a', eye: '#1a1a1a', extra: 'glasses' },

  obito: { id: 'obito', skin: '#f0d8c0', hair: '#eeeeee', hairStyle: 'spiky', top: '#f4f1ea', bottom: '#1a1a1a', eye: '#e01b1b', extra: 'cracks' },
  madara_rikudo: { id: 'madara_rikudo', skin: '#f0d8c0', hair: '#e8e8e8', hairStyle: 'long', top: '#f4f1ea', bottom: '#1a1a1a', eye: '#b49cff' },
  kaguya: { id: 'kaguya', skin: '#f4f1ea', hair: '#f4f6f8', hairStyle: 'long', top: '#f4f1ea', bottom: '#c9b8e0', eye: '#b49cff', extra: 'horns' },
  zetsu_negro: { id: 'zetsu_negro', skin: '#141414', hair: '#141414', hairStyle: 'none', top: '#141414', bottom: '#0a0a0a', eye: '#ffe14d' },

  deidara: { id: 'deidara', skin: '#f2c99a', hair: '#ffe066', hairStyle: 'ponytail', top: '#111', bottom: '#111', eye: '#4fa8ff', cloak: true },
  sasori: { id: 'sasori', skin: '#f0d5b8', hair: '#b03030', hairStyle: 'bob', top: '#111', bottom: '#111', eye: '#7a5a3a', cloak: true },
  hidan: { id: 'hidan', skin: '#e8dccf', hair: '#d8dde3', hairStyle: 'slick', top: '#111', bottom: '#111', eye: '#a35ad6', cloak: true },
  kakuzu: { id: 'kakuzu', skin: '#a07850', hair: '#2b3a2b', hairStyle: 'hood', top: '#111', bottom: '#111', eye: '#2ecc71', cloak: true, mask: '#2b3a2b' },
  itachi: { id: 'itachi', skin: '#f2d8c0', hair: '#141414', hairStyle: 'ponytail', top: '#111', bottom: '#111', eye: '#e01b1b', cloak: true },
  path: { id: 'path', skin: '#e8d6c0', hair: '#e8701f', hairStyle: 'spiky', top: '#111', bottom: '#111', eye: '#9b7fd6', cloak: true, extra: 'piercings' },
  pain: { id: 'pain', skin: '#e8d6c0', hair: '#ff8a3c', hairStyle: 'spiky', top: '#111', bottom: '#111', eye: '#b49cff', cloak: true, extra: 'piercings' },
  raikage: { id: 'raikage', skin: '#b08a6a', hair: '#f0f0f0', hairStyle: 'slick', top: '#d8d8d8', bottom: '#555', eye: '#ffd23f', extra: 'cracks' },
  tsuchikage: { id: 'tsuchikage', skin: '#c9b9a5', hair: '#9aa0a8', hairStyle: 'bun', top: '#5a7a4a', bottom: '#444', eye: '#ffd23f', extra: 'cracks' },
  mizukage: { id: 'mizukage', skin: '#c9b9a5', hair: '#2d4a6b', hairStyle: 'spiky', top: '#3a6a9a', bottom: '#333', eye: '#ffd23f', extra: 'cracks' },
  madara: { id: 'madara', skin: '#f0d8c0', hair: '#141414', hairStyle: 'long', top: '#8b1e1e', bottom: '#4a1010', eye: '#b49cff' },
};
