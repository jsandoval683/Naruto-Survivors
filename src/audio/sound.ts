/**
 * All sound is synthesised with Web Audio (no audio files): short effects and a small
 * procedural music sequencer using a Japanese pentatonic scale with taiko drums.
 */
import type { SceneView } from '../game/view';

const SETTINGS_KEY = 'ns_audio';

export interface AudioSettings {
  music: number;
  sfx: number;
  muted: boolean;
}

function loadSettings(): AudioSettings {
  try {
    return { music: 0.35, sfx: 0.7, muted: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return { music: 0.35, sfx: 0.7, muted: false };
  }
}

export type Sfx =
  | 'hit' | 'crit' | 'kill' | 'xp' | 'coin' | 'levelup' | 'explosion' | 'throw' | 'lightning'
  | 'boss' | 'hurt' | 'transform' | 'chest' | 'banner' | 'thump' | 'whoosh' | 'click' | 'dimension' | 'heal';

/** Minimum seconds between two plays of the same effect (avoids walls of noise). */
const MIN_GAP: Partial<Record<Sfx, number>> = {
  hit: 0.035, crit: 0.05, kill: 0.03, xp: 0.04, coin: 0.06, explosion: 0.07, throw: 0.06, lightning: 0.08,
  hurt: 0.25, whoosh: 0.12, thump: 0.15, heal: 0.3, banner: 0.6, boss: 1, transform: 0.5, dimension: 1,
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface Theme {
  root: number;
  bpm: number;
  /** Seed for the melody. */
  seed: number;
  leadOctave: number;
  wave: OscillatorType;
}

const THEMES: Record<string, Theme> = {
  menu: { root: 52, bpm: 84, seed: 3, leadOctave: 24, wave: 'triangle' },
  desierto: { root: 50, bpm: 120, seed: 11, leadOctave: 24, wave: 'square' },
  bosque: { root: 47, bpm: 126, seed: 17, leadOctave: 24, wave: 'square' },
  uchiha: { root: 45, bpm: 112, seed: 23, leadOctave: 24, wave: 'triangle' },
  konoha: { root: 52, bpm: 132, seed: 29, leadOctave: 24, wave: 'square' },
  crater: { root: 43, bpm: 118, seed: 31, leadOctave: 24, wave: 'sawtooth' },
  guerra: { root: 45, bpm: 140, seed: 37, leadOctave: 24, wave: 'square' },
  kaguya: { root: 41, bpm: 96, seed: 41, leadOctave: 24, wave: 'sawtooth' },
};

/** Miyako-bushi ("In") scale intervals. */
const SCALE = [0, 1, 5, 7, 8];

export class Sound {
  settings = loadSettings();
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private last = new Map<Sfx, number>();
  private theme: string | null = null;
  private wantTheme = 'menu';
  private step = 0;
  private nextNote = 0;
  private timer: number | undefined;

  constructor() {
    // Browsers only allow audio after a user gesture.
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  private unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    const comp = this.ctx.createDynamicsCompressor();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applySettings();
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  applySettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : 1, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.settings.music * 0.5, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx, t, 0.02);
  }

  setTheme(name: string): void {
    this.wantTheme = THEMES[name] ? name : 'guerra';
  }

  // ---------------- synth primitives ----------------

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0, bus: GainNode = this.sfxBus): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(filter: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, when = 0, q = 1, bus: GainNode = this.sfxBus): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bf = ctx.createBiquadFilter();
    bf.type = filter;
    bf.Q.value = q;
    bf.frequency.setValueAtTime(f0, t);
    bf.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bf);
    bf.connect(g);
    g.connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ---------------- effects ----------------

  play(name: Sfx, intensity = 1): void {
    if (!this.ctx || this.settings.muted || this.settings.sfx <= 0) return;
    const now = this.ctx.currentTime;
    const gap = MIN_GAP[name] ?? 0.02;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    this.last.set(name, now);
    const v = Math.min(1.5, intensity);
    const jitter = 1 + (Math.random() - 0.5) * 0.1;
    switch (name) {
      case 'hit':
        this.noiseBurst('bandpass', 2200 * jitter, 900, 0.05, 0.12);
        this.tone('square', 240 * jitter, 120, 0.04, 0.03);
        break;
      case 'crit':
        this.tone('square', 900, 450, 0.07, 0.07);
        this.noiseBurst('highpass', 3000, 1500, 0.06, 0.1);
        break;
      case 'kill':
        this.noiseBurst('lowpass', 1100 * jitter, 180, 0.1, 0.14);
        break;
      case 'xp':
        this.tone('sine', 880 * jitter, 1320 * jitter, 0.05, 0.05);
        break;
      case 'coin':
        this.tone('square', 988, 988, 0.05, 0.045);
        this.tone('square', 1319, 1319, 0.08, 0.045, 0.05);
        break;
      case 'levelup':
        [72, 76, 79, 84].forEach((n, i) => this.tone('triangle', midi(n), midi(n), 0.14, 0.13, i * 0.07));
        break;
      case 'explosion':
        this.noiseBurst('lowpass', 1400, 80, 0.45 * v, 0.28 * v);
        this.tone('sine', 95, 38, 0.35 * v, 0.25 * v);
        break;
      case 'throw':
        this.noiseBurst('bandpass', 2600, 1100, 0.08, 0.05, 0, 2);
        break;
      case 'lightning':
        this.noiseBurst('highpass', 2500, 1200, 0.2, 0.16);
        this.tone('square', 70, 50, 0.12, 0.05);
        break;
      case 'boss':
        this.tone('sawtooth', 110, 98, 1.1, 0.12);
        this.tone('sawtooth', 165, 147, 1.1, 0.07);
        [0, 0.28, 0.56].forEach((w) => this.tone('sine', 70, 40, 0.3, 0.3, w));
        break;
      case 'hurt':
        this.tone('square', 320, 110, 0.16, 0.1);
        break;
      case 'transform':
        [57, 61, 64, 69].forEach((n) => this.tone('sawtooth', midi(n), midi(n + 12), 0.7, 0.05));
        this.noiseBurst('bandpass', 400, 3000, 0.6, 0.08, 0, 1.5);
        break;
      case 'chest':
        [84, 88, 91, 96].forEach((n, i) => this.tone('sine', midi(n), midi(n), 0.12, 0.07, i * 0.06));
        break;
      case 'banner':
        this.tone('sine', 196, 194, 1.2, 0.1);
        this.tone('sine', 293, 290, 1.0, 0.06);
        break;
      case 'thump':
        this.tone('sine', 130, 38, 0.4, 0.35);
        this.noiseBurst('lowpass', 500, 80, 0.3, 0.18);
        break;
      case 'whoosh':
        this.noiseBurst('bandpass', 500, 2000, 0.25, 0.08, 0, 1.2);
        break;
      case 'click':
        this.tone('square', 660, 660, 0.03, 0.04);
        break;
      case 'dimension':
        this.tone('sawtooth', 70, 420, 1.0, 0.09);
        this.tone('sine', 98, 96, 1.6, 0.12, 0.2);
        this.noiseBurst('bandpass', 200, 4000, 1.0, 0.07, 0, 0.8);
        break;
      case 'heal':
        this.tone('sine', 523, 784, 0.2, 0.06);
        break;
    }
  }

  // ---------------- music ----------------

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.theme !== this.wantTheme) {
      this.theme = this.wantTheme;
      this.step = 0;
      this.nextNote = ctx.currentTime + 0.1;
    }
    if (this.settings.muted || this.settings.music <= 0) {
      this.nextNote = ctx.currentTime + 0.1;
      return;
    }
    const th = THEMES[this.theme];
    const stepDur = 60 / th.bpm / 4; // 16th notes
    while (this.nextNote < ctx.currentTime + 0.12) {
      this.playStep(th, this.step, this.nextNote - ctx.currentTime);
      this.step = (this.step + 1) % 64;
      this.nextNote += stepDur;
    }
  }

  /** One 16th-note step of a 4-bar loop: taiko, shaker, bass and a seeded melody. */
  private playStep(th: Theme, step: number, when: number): void {
    const bar = Math.floor(step / 16);
    const beat = step % 16;
    const rnd = (n: number) => {
      const x = Math.sin((th.seed * 97 + n) * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    const note = (degree: number, octave: number) => th.root + octave + SCALE[((degree % 5) + 5) % 5] + 12 * Math.floor(degree / 5);
    const bus = this.musicBus;
    // Taiko on beats 1 and 3 (+ an occasional fill).
    if (beat === 0 || beat === 8 || (beat === 14 && bar === 3)) this.tone('sine', 110, 42, 0.28, 0.5, when, bus);
    if (beat === 4 || beat === 12) this.noiseBurst('lowpass', 900, 200, 0.12, 0.18, when, 1, bus);
    // Shaker on 8ths.
    if (beat % 2 === 0) this.noiseBurst('highpass', 7000, 5000, 0.03, 0.05, when, 1, bus);
    // Bass: root / fifth pattern.
    if (beat % 4 === 0) {
      const deg = [0, 0, 3, 2][bar] + (beat === 8 ? 3 : 0);
      this.tone('triangle', midi(note(deg, -12)), midi(note(deg, -12)), 0.22, 0.22, when, bus);
    }
    // Melody: seeded walk on the scale, more notes on strong beats.
    const r = rnd(step + bar * 7);
    if (beat % 2 === 0 && r < (beat % 4 === 0 ? 0.75 : 0.35)) {
      const deg = Math.floor(rnd(step * 3 + 1) * 8);
      const f = midi(note(deg, th.leadOctave - 12));
      this.tone(th.wave, f, f, beat % 4 === 0 ? 0.24 : 0.12, th.wave === 'square' ? 0.035 : 0.05, when, bus);
    }
  }
}

/**
 * Turns what happens on screen into sounds by diffing successive scene views, so it works
 * the same for solo (local Game) and co-op (server snapshots).
 */
export class AudioDirector {
  private seenFx = new WeakSet<object>();
  private seenTx = new WeakSet<object>();
  private lastLevel = -1;
  private lastXp = 0;
  private lastBanner = '';
  private lastBosses = 0;
  private lastProjectiles = 0;

  constructor(private sound: Sound) {}

  reset(): void {
    this.lastLevel = -1;
    this.lastBanner = '';
    this.lastBosses = 0;
    this.lastProjectiles = 0;
  }

  observe(v: SceneView): void {
    const s = this.sound;
    const me = v.heroes[v.localIndex];
    for (const fx of v.effects) {
      if (this.seenFx.has(fx)) continue;
      this.seenFx.add(fx);
      switch (fx.kind) {
        case 'boom':
          s.play('explosion', fx.r / 90);
          break;
        case 'bolt':
          s.play('lightning');
          break;
        case 'puff':
          s.play('kill');
          break;
        case 'ring':
        case 'shadow':
          s.play('whoosh');
          break;
        case 'toad':
          s.play('thump');
          break;
        case 'flash':
          s.play('transform');
          break;
      }
    }
    for (const tx of v.texts) {
      if (this.seenTx.has(tx)) continue;
      this.seenTx.add(tx);
      // Only react to things near the local hero (co-op partners are elsewhere).
      if (me && Math.abs(tx.x - me.x) > 500) continue;
      if (tx.color === '#ff5a5a') s.play('hurt');
      else if (tx.color === '#5cc96b') s.play('heal');
      else if (tx.text.includes('ryō')) s.play('coin');
      else if (tx.text.endsWith('!')) s.play('crit');
      else s.play('hit');
    }
    if (this.lastLevel >= 0 && v.level > this.lastLevel) s.play('levelup');
    else if (v.xp > this.lastXp && v.level === this.lastLevel) s.play('xp');
    this.lastLevel = v.level;
    this.lastXp = v.xp;
    const bosses = v.enemies.reduce((n, e) => n + (e.boss ? 1 : 0), 0);
    if (bosses > this.lastBosses) s.play('boss');
    this.lastBosses = bosses;
    const text = v.banner?.text ?? '';
    if (text && text !== this.lastBanner) {
      if (text.startsWith('Dimensión')) s.play('dimension');
      else if (text.includes('Cofre')) s.play('chest');
      else s.play('banner');
    }
    this.lastBanner = text;
    if (v.projectiles.length > this.lastProjectiles) s.play('throw');
    this.lastProjectiles = v.projectiles.length;
    s.setTheme(v.dimension ? 'kaguya' : v.scene.startsWith('dim_') ? 'kaguya' : v.scene);
  }
}
