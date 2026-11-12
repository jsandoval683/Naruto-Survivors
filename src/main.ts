import { AudioDirector, Sound } from './audio/sound';
import { Input } from './core/input';
import { loadSave, onSaveWritten, writeSave } from './core/save';
import { CHARACTERS, CHARACTER_ORDER, type CharacterDef, type CharacterId } from './game/characters';
import { Game } from './game/game';
import { JUTSUS } from './game/jutsus';
import { rollChoices, type Choice } from './game/levelup';
import { LOOKS } from './game/looks';
import { NATURE_COLOR, NATURE_NAME } from './game/natures';
import { PASSIVES } from './game/passives';
import { gameView } from './game/view';
import { rewardText } from './meta/achievements';
import { dailyMissions, ensureDaily } from './meta/missions';
import { applyRun, refreshUnlocks, type RunRewards } from './meta/progress';
import { SKINS, skinFor } from './meta/skins';
import type { RunSummary } from './meta/summary';
import { runBonuses } from './meta/upgrades';
import { Online } from './net/api';
import { CoopClient, NetGame } from './net/coop';
import type { ChoiceSnap, PromptMsg } from './net/protocol';
import { drawGround, formatTime, render, type View } from './render/render';
import { drawLook, drawLookDirect } from './render/sprites';
import { jutsuIconURL, walkFrame } from './render/pixel';
import { CoopScreen } from './ui/coopScreen';
import { MetaScreen, type MetaTab } from './ui/meta';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const input = new Input(canvas);
const view: View = { w: 0, h: 0, dpr: 1, zoom: 1 };
const save = loadSave();

const screens = {
  menu: $('menu'),
  auth: $('auth'),
  coop: $('coop'),
  meta: $('meta'),
  levelup: $('levelup'),
  pause: $('pause'),
  gameover: $('gameover'),
};
const pauseBtn = $('pauseBtn');

// ---------------- sound ----------------

const sound = new Sound();
const audio = new AudioDirector(sound);
if (import.meta.env.DEV) (window as unknown as { __sound: Sound }).__sound = sound;
const soundBtn = $('soundBtn');
function renderSoundBtn(): void {
  soundBtn.textContent = sound.settings.muted ? '✕' : '♪';
  soundBtn.title = sound.settings.muted ? 'Activar sonido' : 'Silenciar';
  soundBtn.classList.toggle('muted', sound.settings.muted);
}
soundBtn.addEventListener('click', () => {
  sound.settings.muted = !sound.settings.muted;
  sound.applySettings();
  renderSoundBtn();
});
renderSoundBtn();
const volMusic = $<HTMLInputElement>('volMusic');
const volSfx = $<HTMLInputElement>('volSfx');
volMusic.value = String(sound.settings.music);
volSfx.value = String(sound.settings.sfx);
volMusic.addEventListener('input', () => {
  sound.settings.music = Number(volMusic.value);
  sound.applySettings();
});
volSfx.addEventListener('input', () => {
  sound.settings.sfx = Number(volSfx.value);
  sound.applySettings();
  sound.play('coin');
});
// Every button gives a little click.
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('button')) sound.play('click');
});
const waitNote = $('waitNote');

/** Solo run (simulated here) … */
let game: Game | null = null;
/** … or co-op run (simulated on the server, drawn from snapshots). */
let net: NetGame | null = null;
let choices: Choice[] = [];

function show(name: keyof typeof screens | null): void {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
  pauseBtn.classList.toggle('hidden', !((game && game.state === 'play') || (net && !net.over && name === null)));
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// ---------------- sizing ----------------

function resize(): void {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
  // Show about the area of 720×450 world units whatever the aspect ratio (portrait phones
  // included), never zooming out so far that the pixel art gets tiny.
  view.zoom = Math.max(0.9, Math.min(2.2, Math.sqrt((view.w * view.h) / (720 * 450))));
  game?.setView(view.w / view.zoom, view.h / view.zoom);
}
window.addEventListener('resize', resize);
resize();

// ---------------- online: account + cloud save ----------------

const online = new Online(save, () => {
  if (!game && !net && !screens.menu.classList.contains('hidden')) renderMenuParts();
  else if (!game && !net) renderAccountLine();
});
onSaveWritten(() => online.schedulePush());

let authCreate = false;
let afterLogin: (() => void) | null = null;

function openAuth(note?: string, then?: () => void): void {
  afterLogin = then ?? null;
  $('authError').textContent = '';
  $('authNote').textContent = note ?? 'Con una cuenta tu progreso se guarda en la nube, apareces en el ranking y puedes jugar en cooperativo.';
  setAuthMode(false);
  show('auth');
  $<HTMLInputElement>('authName').focus();
}

function setAuthMode(create: boolean): void {
  authCreate = create;
  $('authTitle').textContent = create ? 'Crear cuenta' : 'Entrar';
  $('authSubmit').textContent = create ? 'Crear cuenta' : 'Entrar';
  $('authSwitch').textContent = create ? '¿Ya tienes cuenta? Entra' : '¿No tienes cuenta? Créala';
  $<HTMLInputElement>('authPass').autocomplete = create ? 'new-password' : 'current-password';
}

$('authSwitch').addEventListener('click', (e) => {
  e.preventDefault();
  setAuthMode(!authCreate);
});
$('authBack').addEventListener('click', () => renderMenu());
$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $<HTMLInputElement>('authName').value;
  const pass = $<HTMLInputElement>('authPass').value;
  $('authError').textContent = '';
  $('authSubmit').setAttribute('disabled', '');
  try {
    await online.login(name, pass, authCreate);
    $<HTMLInputElement>('authPass').value = '';
    const next = afterLogin;
    afterLogin = null;
    if (next) next();
    else renderMenu();
  } catch (err) {
    $('authError').textContent = (err as Error).message;
  } finally {
    $('authSubmit').removeAttribute('disabled');
  }
});

function renderAccountLine(): void {
  const el = $('accountLine');
  if (online.account) {
    el.innerHTML = `<span>Conectado como <b>${esc(online.account.name)}</b> · progreso en la nube</span><button id="logoutBtn">Salir</button>`;
    $('logoutBtn').addEventListener('click', async () => {
      coop.close();
      await online.logout();
      renderMenu();
    });
  } else {
    el.innerHTML = `<span>Invitado · el progreso se guarda solo en este navegador</span><button id="loginBtn">Entrar</button>`;
    $('loginBtn').addEventListener('click', () => openAuth());
  }
  $('notices').innerHTML = online.notices.map((n) => `<p>${esc(n)}</p>`).join('');
}

// ---------------- meta screens ----------------

const meta = new MetaScreen(save, $('metaRoot'), () => renderMenuParts(), online);

function openMeta(tab: MetaTab): void {
  meta.open(tab);
  show('meta');
}

$('metaBack').addEventListener('click', () => renderMenu());
$('menuNav')
  .querySelectorAll<HTMLButtonElement>('button')
  .forEach((b) => b.addEventListener('click', () => openMeta(b.dataset.tab as MetaTab)));

// ---------------- menu ----------------

function selectChar(id: CharacterId): void {
  if (!save.unlocked.includes(id)) return;
  save.selected = id;
  writeSave(save);
  renderMenu();
}

function renderMenu(): void {
  renderMenuParts();
  show('menu');
}

/** Everything on the menu that depends on the save (also refreshed after shop purchases). */
function renderMenuParts(): void {
  refreshUnlocks(save);
  if (!save.unlocked.includes(save.selected)) save.selected = 'naruto';
  const grid = $('charGrid');
  grid.innerHTML = '';
  for (const id of CHARACTER_ORDER) {
    const c = CHARACTERS[id];
    const unlocked = save.unlocked.includes(id);
    const b = document.createElement('button');
    b.className = `char${unlocked ? '' : ' locked'}${save.selected === id ? ' selected' : ''}`;
    b.title = unlocked ? c.name : `${c.name}: ${c.unlockText}`;
    const cv = document.createElement('canvas');
    cv.width = 96;
    cv.height = 96;
    drawLookDirect(cv.getContext('2d')!, LOOKS[skinFor(id, save.skinSel)?.lookId ?? id], 48, 60, 32);
    b.appendChild(cv);
    if (!unlocked) {
      const lock = document.createElement('span');
      lock.className = 'lock';
      lock.textContent = '🔒';
      b.appendChild(lock);
    }
    b.addEventListener('click', () => (unlocked ? selectChar(id) : showLocked(c)));
    grid.appendChild(b);
  }
  showCharInfo(CHARACTERS[save.selected as CharacterId]);

  renderAccountLine();
  $('menuWallet').innerHTML = `<span>両 Ryō <b>${save.ryo}</b></span><span>巻 Pergaminos <b>${save.tickets}</b></span>`;
  $('menuStats').innerHTML = `
    <span>Partidas <b>${save.runs}</b></span>
    <span>Victorias <b>${save.wins}</b></span>
    <span>Mejor tiempo <b>${formatTime(save.bestTime)}</b></span>
    <span>Logros <b>${save.achievements.length}</b></span>`;

  // Badge: daily missions still open.
  const daily = ensureDaily(save);
  const open = dailyMissions(daily.date).filter((m) => !daily.done.includes(m.id)).length;
  const missionsBtn = $('menuNav').querySelector('[data-tab="misiones"]')!;
  missionsBtn.innerHTML = `Misiones${open ? `<span class="badge">${open}</span>` : ''}`;
}

function showCharInfo(c: CharacterDef): void {
  const forms = c.transforms.map((t) => `<li>Nv. ${t.level}: <b>${t.name}</b> (${t.desc})</li>`).join('');
  const owned = SKINS.filter((k) => k.char === c.id && save.skins.includes(k.id));
  const cur = save.skinSel[c.id];
  const skins = owned.length
    ? `<div class="skin-row"><button data-skin="" class="${!cur ? 'on' : ''}">Normal</button>${owned
        .map((k) => `<button data-skin="${k.id}" class="${cur === k.id ? 'on' : ''}">${k.name}</button>`)
        .join('')}</div>`
    : '';
  $('charInfo').innerHTML = `
    <h3>${c.name} <span class="nat" style="color:${NATURE_COLOR[c.nature]}">${NATURE_NAME[c.nature]}</span></h3>
    <p>Empieza con <b>Kunai</b> · Jutsu propio: <b>${JUTSUS[c.start].name}</b> (en el primer nivel)</p>
    <p class="muted">${c.trait}</p>
    <ul>${forms}</ul>${skins}`;
  $('charInfo')
    .querySelectorAll<HTMLButtonElement>('[data-skin]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.skin) save.skinSel[c.id] = b.dataset.skin;
        else delete save.skinSel[c.id];
        writeSave(save);
        renderMenu();
      }),
    );
}

function showLocked(c: CharacterDef): void {
  $('charInfo').innerHTML = `
    <h3>${c.name} 🔒</h3>
    <p>Para desbloquearlo: <b>${c.unlockText}</b>.</p>
    <p class="muted">Jutsu propio: ${JUTSUS[c.start].name}</p>`;
}

// ---------------- solo run ----------------

function startRun(): void {
  net = null;
  const charId = save.selected as CharacterId;
  const bonus = runBonuses(save, charId);
  game = new Game({ onLevelUp: openLevelUp, onGameOver: endRun }, [
    {
      name: online.account?.name ?? 'Tú',
      charId,
      input,
      opts: {
        mods: bonus.mods,
        xpMult: bonus.xpMult,
        rerolls: bonus.rerolls,
        extraJutsu: bonus.extraJutsu,
        lookId: skinFor(charId, save.skinSel)?.lookId,
      },
    },
  ]);
  game.setView(view.w / view.zoom, view.h / view.zoom);
  audio.reset();
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
  show(null);
}

// ---------------- level-up cards (solo and co-op) ----------------

/** Jutsu cards get their pixel icon; passives and items keep their kanji. */
function cardIcon(c: ChoiceSnap): string {
  const m = /^[je]:(.+)$/.exec(c.key);
  const url = m ? jutsuIconURL(m[1]) : null;
  return url ? `<img class="pix-icon" src="${url}" alt="">` : c.icon;
}

function showCards(title: string, sub: string, cards: ChoiceSnap[], reroll: { left: number; can: boolean } | null): void {
  $('levelTitle').textContent = title;
  $('levelSub').textContent = `${sub} · 1 2 3`;
  const root = $('cards');
  root.innerHTML = '';
  cards.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    if (c.tag === 'Evolución') b.style.borderColor = '#ffd23f';
    b.innerHTML = `
      <span class="num">${i + 1}</span>
      <div class="head">
        <div class="icon" style="color:${c.color}">${cardIcon(c)}</div>
        <div><div class="title">${c.title}</div><div class="tag ${c.isNew ? 'new' : ''}">${c.tag}</div></div>
      </div>
      <div class="desc">${c.desc}</div>`;
    b.addEventListener('click', () => pick(i));
    root.appendChild(b);
  });
  const btn = $<HTMLButtonElement>('rerollBtn');
  btn.classList.toggle('hidden', !reroll);
  if (reroll) {
    btn.textContent = `Volver a elegir (${reroll.left}) · R`;
    btn.disabled = !reroll.can;
  }
  show('levelup');
}

function openLevelUp(): void {
  if (!game) return;
  const special = game.currentSpecial;
  choices = special ? special.choices : rollChoices(game);
  showCards(
    special ? special.title : `¡Nivel ${game.level - game.pendingLevelUps + 1}!`,
    special ? special.sub : 'Elige una mejora',
    choices,
    special ? null : { left: game.rerolls, can: game.rerolls > 0 },
  );
}

function openNetPrompt(p: PromptMsg): void {
  showCards(p.title, `${p.sub} · se elige sola en ${p.seconds} s`, p.choices, { left: p.rerolls, can: p.canReroll });
}

function pick(i: number): void {
  if (net) {
    if (!net.prompt) return;
    coop.send({ type: 'pick', index: i });
    net.prompt = null;
    show(null);
    return;
  }
  if (!game || game.state !== 'levelup' || !choices[i]) return;
  choices[i].apply(game);
  choices = [];
  game.finishLevelUp();
  // With more prompts queued, finishLevelUp already reopened the cards.
  if (!game.hasPrompt) show(null);
}

function reroll(): void {
  if (net) {
    if (net.prompt?.canReroll) coop.send({ type: 'reroll' });
    return;
  }
  if (!game || game.state !== 'levelup' || game.rerolls <= 0 || game.currentSpecial) return;
  game.rerolls--;
  openLevelUp();
}

$('rerollBtn').addEventListener('click', reroll);

// ---------------- pause ----------------

function openPause(): void {
  if (net && !net.over) {
    // Co-op never pauses the world; this is just a menu.
    $('pauseInfo').innerHTML = `<p class="muted">La partida sigue en marcha para tus compañeros.</p>`;
    $('quitBtn').textContent = 'Salir de la partida';
    show('pause');
    return;
  }
  if (!game || game.state !== 'play') return;
  game.state = 'paused';
  const g = game;
  const s = g.stats;
  const rows = g.weapons
    .map((w) => {
      const name = w.evolved ? JUTSUS[w.id].evolution.name : `${JUTSUS[w.id].name} Nv.${w.level}`;
      return `<tr><td>${name}</td><td>${g.dmgBy[w.id] ?? 0} daño</td></tr>`;
    })
    .join('');
  const pas = [...g.passives.entries()].map(([id, l]) => `<tr><td>${PASSIVES[id].name}</td><td>Nv.${l}</td></tr>`).join('');
  $('quitBtn').textContent = 'Abandonar';
  $('pauseInfo').innerHTML = `
    <p class="muted">${g.arcName}${g.transform ? ` · <b style="color:${g.transform.aura}">${g.transform.name}</b>` : ''}</p>
    <h4>Jutsus</h4><table>${rows}</table>
    ${pas ? `<h4>Pasivas</h4><table>${pas}</table>` : ''}
    <h4>Estadísticas</h4>
    <table>
      <tr><td>Vida</td><td>${Math.ceil(g.player.hp)} / ${s.maxHp}</td></tr>
      <tr><td>Daño</td><td>×${s.dmg.toFixed(2)}</td></tr>
      <tr><td>Recarga</td><td>×${s.cd.toFixed(2)}</td></tr>
      <tr><td>Velocidad</td><td>×${s.speed.toFixed(2)}</td></tr>
      <tr><td>Área</td><td>×${s.area.toFixed(2)}</td></tr>
      <tr><td>Crítico</td><td>${Math.round(s.crit * 100)}%</td></tr>
      <tr><td>Reducción de daño</td><td>${Math.round(s.armor * 100)}%</td></tr>
      <tr><td>Regeneración</td><td>${s.regen.toFixed(1)} /s</td></tr>
    </table>
    <p class="muted small">Naturalezas: Fuego › Viento › Rayo › Tierra › Agua › Fuego (×1,5 contra la que vence)</p>`;
  show('pause');
}

function resume(): void {
  if (net) {
    if (net.prompt) openNetPrompt(net.prompt);
    else show(null);
    return;
  }
  if (!game || game.state !== 'paused') return;
  game.state = 'play';
  show(null);
}

pauseBtn.addEventListener('click', openPause);
$('resumeBtn').addEventListener('click', resume);
$('quitBtn').addEventListener('click', () => {
  if (net) {
    leaveCoopRun();
    return;
  }
  if (!game) return;
  game.state = 'over';
  endRun(false);
});

// ---------------- game over ----------------

function showResults(title: string, s: RunSummary, r: RunRewards, coopRun: boolean): void {
  $('overTitle').textContent = title;
  const notes = [
    ...r.missions.map((m) => `<p>✔ Misión: ${m.text} <b>+${m.reward} 両</b></p>`),
    r.dailyBonus ? `<p>✔ ¡Misiones del día completas! <b>+2 巻</b></p>` : '',
    ...r.achievements.map((a) => `<p>★ Logro: ${a.name} <b>${rewardText(a)}</b></p>`),
  ].join('');
  $('overInfo').innerHTML = `
    <span>Tiempo <b>${formatTime(s.time)}</b></span>
    <span>Nivel <b>${s.level}</b></span>
    <span>Derrotados <b>${s.kills}</b></span>
    ${s.bosses.length ? `<span>Jefes derrotados <b>${s.bosses.length}</b></span>` : ''}
    <span>Bijū <b>${s.biju}/9</b></span>
    <span>Ryō ganados <b>+${r.ryo}</b></span>
    <span>Pergaminos <b>+${r.tickets}</b></span>
    <span>Ryō totales <b>${save.ryo}</b></span>
    ${notes ? `<div class="over-notes">${notes}</div>` : ''}
    ${r.unlocked.map((c) => `<p class="unlock-note" style="grid-column:1/-1">¡Nuevo ninja desbloqueado: ${c.name}!</p>`).join('')}
    ${!online.account ? '<p class="muted small" style="grid-column:1/-1">Entra con una cuenta para aparecer en el ranking.</p>' : ''}`;
  $('retryBtn').textContent = coopRun ? 'Volver a la sala' : 'Reintentar';
  show('gameover');
}

function endRun(win: boolean): void {
  if (!game) return;
  const s = game.summary(win);
  const r = applyRun(save, s);
  writeSave(save);
  void online.submitRun({ char: s.char, time: Math.floor(s.time), kills: s.kills, bosses: s.bosses.length, level: s.level, win });
  showResults(win ? '¡Has sellado a Kaguya!' : 'Has caído', s, r, false);
}

$('startBtn').addEventListener('click', startRun);
$('retryBtn').addEventListener('click', () => {
  if (net) {
    net = null;
    openCoop();
  } else startRun();
});
$('menuBtn').addEventListener('click', () => {
  game = null;
  if (net) leaveCoopRun();
  else renderMenu();
});

// ---------------- co-op ----------------

let currentRoomCode: string | null = null;

const coopScreen = new CoopScreen($('coopRoot'), {
  create: (isPublic) => coop.send({ type: 'create', isPublic }),
  quick: () => coop.send({ type: 'quick' }),
  join: (code) => coop.send({ type: 'join', code }),
  refresh: () => coop.send({ type: 'list' }),
  start: () => coop.send({ type: 'start' }),
  leave: () => coop.send({ type: 'leave' }),
  back: () => {
    coop.send({ type: 'leave' });
    renderMenu();
  },
});

const coop = new CoopClient({
  onRooms: (rooms) => {
    if (!coop.room) coopScreen.renderLobby(rooms);
  },
  onRoom: (room) => {
    // Send our ninja once per room we enter (the server echoes room updates back).
    if (room && room.code !== currentRoomCode) sendChar();
    currentRoomCode = room?.code ?? null;
    if (room) {
      if (!net) coopScreen.renderRoom(room, coop.userId);
    } else if (!net) coopScreen.renderLobby();
  },
  onError: (msg) => coopScreen.setError(msg),
  onStart: (you) => {
    game = null;
    net = new NetGame(you);
    audio.reset();
    show(null);
  },
  onSnap: (s) => net?.onSnap(s),
  onPrompt: (p) => {
    if (!net) return;
    net.prompt = p;
    if (p && screens.pause.classList.contains('hidden')) openNetPrompt(p);
    else if (!p && !screens.levelup.classList.contains('hidden')) show(null);
  },
  onOver: (win, summary) => {
    if (!net) return;
    net.over = true;
    const r = applyRun(save, summary);
    writeSave(save);
    showResults(win ? '¡Habéis sellado a Kaguya!' : 'Habéis caído', summary, r, true);
  },
  onClose: () => {
    if (net && !net.over) {
      net = null;
      online.notices.push('Se ha perdido la conexión con la partida cooperativa.');
      renderMenu();
    } else if (!screens.coop.classList.contains('hidden')) {
      coopScreen.setError('Se ha perdido la conexión con el servidor.');
    }
  },
});

/** Tells the room which ninja (and permanent upgrades) you bring. */
function sendChar(): void {
  const charId = save.selected as CharacterId;
  const b = runBonuses(save, charId);
  coop.send({
    type: 'char',
    charId,
    lookId: skinFor(charId, save.skinSel)?.lookId ?? charId,
    bonus: { mods: b.mods, xpMult: b.xpMult, rerolls: b.rerolls, extraJutsu: b.extraJutsu },
  });
}

async function openCoop(): Promise<void> {
  if (!online.account || !online.token) {
    openAuth('Necesitas una cuenta (gratis) para jugar en cooperativo.', () => void openCoop());
    return;
  }
  show('coop');
  if (coop.room) {
    coopScreen.renderRoom(coop.room, coop.userId);
    return;
  }
  coopScreen.renderConnecting();
  try {
    await coop.connect(online.token);
    coopScreen.renderLobby([]);
    coop.send({ type: 'list' });
  } catch (e) {
    coopScreen.renderLobby([]);
    coopScreen.setError((e as Error).message);
  }
}

function leaveCoopRun(): void {
  coop.send({ type: 'leave' });
  net = null;
  waitNote.classList.add('hidden');
  renderMenu();
}

$('coopBtn').addEventListener('click', () => void openCoop());

// Room list refresh while the lobby is open.
setInterval(() => {
  if (!screens.coop.classList.contains('hidden') && !coop.room && coop.connected) coop.send({ type: 'list' });
}, 4000);

let lastSent = { x: 0, y: 0, at: 0 };
function sendInput(now: number): void {
  const a = input.axis();
  const changed = Math.abs(a.x - lastSent.x) > 0.05 || Math.abs(a.y - lastSent.y) > 0.05;
  if (changed || now - lastSent.at > 250) {
    coop.send({ type: 'input', x: Math.round(a.x * 100) / 100, y: Math.round(a.y * 100) / 100 });
    lastSent = { x: a.x, y: a.y, at: now };
  }
}

// ---------------- keyboard routing ----------------

input.onKey = (code) => {
  const cardsOpen = !screens.levelup.classList.contains('hidden');
  if (cardsOpen) {
    if (code === 'Digit1' || code === 'Numpad1') pick(0);
    else if (code === 'Digit2' || code === 'Numpad2') pick(1);
    else if (code === 'Digit3' || code === 'Numpad3') pick(2);
    else if (code === 'KeyR') reroll();
    return;
  }
  if (net) {
    if (code === 'Escape' || code === 'KeyP') {
      if (screens.pause.classList.contains('hidden')) openPause();
      else resume();
    }
    return;
  }
  if (!game) {
    if (code === 'Enter' && !screens.menu.classList.contains('hidden')) startRun();
    return;
  }
  if (code === 'Escape' || code === 'KeyP') {
    if (game.state === 'play') openPause();
    else if (game.state === 'paused') resume();
    return;
  }
  if (game.state === 'over' && code === 'Enter') startRun();
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game) openPause();
});

// ---------------- main loop ----------------

const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
let menuT = 0;

function frame(now: number): void {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (net) {
    if (!net.over) sendInput(now);
    net.update(dt, input.axis());
    const v = net.view();
    if (v) {
      render(ctx, v, view, input);
      audio.observe(v);
    }
    const others = net.choosing.filter((n) => n !== online.account?.name);
    const waiting = others.length > 0 && !net.prompt && !net.over;
    waitNote.classList.toggle('hidden', !waiting);
    if (waiting) waitNote.textContent = `Esperando a que ${others.join(', ')} elija mejora…`;
  } else if (game) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      game.update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 5) acc = 0;
    const v = gameView(game);
    render(ctx, v, view, input);
    if (game.state === 'play') audio.observe(v);
  } else {
    // Slowly scrolling field behind the menu.
    sound.setTheme('menu');
    menuT += dt;
    const s = view.dpr * view.zoom;
    const cx = menuT * 18;
    const cy = menuT * 8;
    ctx.setTransform(s, 0, 0, s, canvas.width / 2 - cx * s, canvas.height / 2 - cy * s);
    const ww = view.w / view.zoom;
    const wh = view.h / view.zoom;
    drawGround(ctx, cx, cy, ww, wh, 'konoha');
    // Ninjas running along the bottom of the menu, a few renegades on their heels.
    const span = ww + 260;
    CHARACTER_ORDER.forEach((id, i) => {
      const x = cx - ww / 2 - 130 + ((menuT * 55 + i * 70) % span);
      const y = cy + wh / 2 - 46 - (i % 2) * 14;
      drawLook(ctx, LOOKS[skinFor(id, save.skinSel)?.lookId ?? id], x, y, 13, false, walkFrame(true, menuT + i * 0.3));
    });
    for (let i = 0; i < 3; i++) {
      const x = cx - ww / 2 - 130 + ((menuT * 55 - 120 - i * 40 + span * 4) % span);
      drawLook(ctx, LOOKS.renegade, x, cy + wh / 2 - 40 - i * 9, 11, false, walkFrame(true, menuT + i), 1, false, '#8fe3a8');
    }
  }
  requestAnimationFrame(frame);
}

renderMenu();
void online.resume();
requestAnimationFrame(frame);
