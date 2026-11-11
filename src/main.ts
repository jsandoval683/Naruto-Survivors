import { Input } from './core/input';
import { loadSave, writeSave } from './core/save';
import { CHARACTERS, CHARACTER_ORDER, type CharacterDef, type CharacterId } from './game/characters';
import { rewardText } from './meta/achievements';
import { dailyMissions, ensureDaily } from './meta/missions';
import { applyRun, refreshUnlocks } from './meta/progress';
import { SKINS, skinFor } from './meta/skins';
import { runBonuses } from './meta/upgrades';
import { MetaScreen, type MetaTab } from './ui/meta';
import { Game } from './game/game';
import { JUTSUS } from './game/jutsus';
import { LOOKS } from './game/looks';
import { NATURE_COLOR, NATURE_NAME } from './game/natures';
import { PASSIVES } from './game/passives';
import { rollChoices, type Choice } from './game/levelup';
import { drawGround, formatTime, render, type View } from './render/render';
import { drawLookDirect } from './render/sprites';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const input = new Input(canvas);
const view: View = { w: 0, h: 0, dpr: 1, zoom: 1 };
const save = loadSave();

const screens = {
  menu: $('menu'),
  meta: $('meta'),
  levelup: $('levelup'),
  pause: $('pause'),
  gameover: $('gameover'),
};
const pauseBtn = $('pauseBtn');

let game: Game | null = null;
let choices: Choice[] = [];

function show(name: keyof typeof screens | null): void {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
  pauseBtn.classList.toggle('hidden', !(game && game.state === 'play'));
}

// ---------------- sizing ----------------

function resize(): void {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
  // Show roughly 720×450 world units; never zoom out so far that sprites get tiny.
  view.zoom = Math.max(0.85, Math.min(2.2, Math.min(view.w / 720, view.h / 450)));
  game?.setView(view.w / view.zoom, view.h / view.zoom);
}
window.addEventListener('resize', resize);
resize();

// ---------------- meta screens ----------------

const meta = new MetaScreen(save, $('metaRoot'), () => renderMenuParts());

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
    drawLookDirect(cv.getContext('2d')!, LOOKS[skinFor(id, save.skinSel)?.lookId ?? id], 48, 56, 26);
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
    <p>Jutsu inicial: <b>${JUTSUS[c.start].name}</b></p>
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
    <p class="muted">Jutsu inicial: ${JUTSUS[c.start].name}</p>`;
}

function startRun(): void {
  const charId = save.selected as CharacterId;
  const bonus = runBonuses(save, charId);
  game = new Game(input, { onLevelUp: openLevelUp, onGameOver: endRun }, charId, {
    mods: bonus.mods,
    xpMult: bonus.xpMult,
    rerolls: bonus.rerolls,
    extraJutsu: bonus.extraJutsu,
    lookId: skinFor(charId, save.skinSel)?.lookId,
  });
  game.setView(view.w / view.zoom, view.h / view.zoom);
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
  show(null);
}

// ---------------- level up ----------------

function openLevelUp(): void {
  if (!game) return;
  const special = game.currentSpecial;
  choices = special ? special.choices : rollChoices(game);
  $('levelTitle').textContent = special ? special.title : `¡Nivel ${game.level - game.pendingLevelUps + 1}!`;
  $('levelSub').textContent = special ? `${special.sub} · 1 2 3` : 'Elige una mejora · 1 2 3';
  const cards = $('cards');
  cards.innerHTML = '';
  choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    if (c.tag === 'Evolución') b.style.borderColor = '#ffd23f';
    b.innerHTML = `
      <span class="num">${i + 1}</span>
      <div class="head">
        <div class="icon" style="color:${c.color}">${c.icon}</div>
        <div><div class="title">${c.title}</div><div class="tag ${c.isNew ? 'new' : ''}">${c.tag}</div></div>
      </div>
      <div class="desc">${c.desc}</div>`;
    b.addEventListener('click', () => pick(i));
    cards.appendChild(b);
  });
  const reroll = $<HTMLButtonElement>('rerollBtn');
  reroll.textContent = `Volver a elegir (${game.rerolls}) · R`;
  reroll.disabled = game.rerolls <= 0;
  reroll.classList.toggle('hidden', !!special);
  show('levelup');
}

function pick(i: number): void {
  if (!game || game.state !== 'levelup' || !choices[i]) return;
  choices[i].apply(game);
  choices = [];
  game.finishLevelUp();
  // With more prompts queued, finishLevelUp already reopened the cards.
  if (!game.hasPrompt) show(null);
}

function reroll(): void {
  if (!game || game.state !== 'levelup' || game.rerolls <= 0 || game.currentSpecial) return;
  game.rerolls--;
  openLevelUp();
}

$('rerollBtn').addEventListener('click', reroll);

// ---------------- pause ----------------

function openPause(): void {
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
  if (!game || game.state !== 'paused') return;
  game.state = 'play';
  show(null);
}

pauseBtn.addEventListener('click', openPause);
$('resumeBtn').addEventListener('click', resume);
$('quitBtn').addEventListener('click', () => {
  if (!game) return;
  game.state = 'over';
  endRun(false);
});

// ---------------- game over ----------------

function endRun(win: boolean): void {
  if (!game) return;
  const g = game;
  const r = applyRun(save, g.summary(win));
  writeSave(save);

  $('overTitle').textContent = win ? '¡Has derrotado a Madara!' : 'Has caído';
  const bosses = g.bossesDefeated.length ? `<span>Jefes derrotados <b>${g.bossesDefeated.length}</b></span>` : '';
  const notes = [
    ...r.missions.map((m) => `<p>✔ Misión: ${m.text} <b>+${m.reward} 両</b></p>`),
    r.dailyBonus ? `<p>✔ ¡Misiones del día completas! <b>+2 巻</b></p>` : '',
    ...r.achievements.map((a) => `<p>★ Logro: ${a.name} <b>${rewardText(a)}</b></p>`),
  ].join('');
  $('overInfo').innerHTML = `
    <span>Tiempo <b>${formatTime(g.t)}</b></span>
    <span>Nivel <b>${g.level}</b></span>
    <span>Derrotados <b>${g.kills}</b></span>
    ${bosses}
    <span>Bijū <b>${g.biju}/9</b></span>
    <span>Ryō ganados <b>+${r.ryo}</b></span>
    <span>Pergaminos <b>+${r.tickets}</b></span>
    <span>Ryō totales <b>${save.ryo}</b></span>
    ${notes ? `<div class="over-notes">${notes}</div>` : ''}
    ${r.unlocked.map((c) => `<p class="unlock-note" style="grid-column:1/-1">¡Nuevo ninja desbloqueado: ${c.name}!</p>`).join('')}`;
  show('gameover');
}

$('startBtn').addEventListener('click', startRun);
$('retryBtn').addEventListener('click', startRun);
$('menuBtn').addEventListener('click', () => {
  game = null;
  renderMenu();
});

// ---------------- keyboard routing ----------------

input.onKey = (code) => {
  if (!game) {
    if (code === 'Enter') startRun();
    return;
  }
  if (game.state === 'levelup') {
    if (code === 'Digit1' || code === 'Numpad1') pick(0);
    else if (code === 'Digit2' || code === 'Numpad2') pick(1);
    else if (code === 'Digit3' || code === 'Numpad3') pick(2);
    else if (code === 'KeyR') reroll();
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
  if (document.hidden) openPause();
});

// ---------------- main loop ----------------

const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
let menuT = 0;

function frame(now: number): void {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (game) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      game.update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 5) acc = 0;
    render(ctx, game, view, input);
  } else {
    // Slowly scrolling field behind the menu.
    menuT += dt;
    const s = view.dpr * view.zoom;
    const cx = menuT * 18;
    const cy = menuT * 8;
    ctx.setTransform(s, 0, 0, s, canvas.width / 2 - cx * s, canvas.height / 2 - cy * s);
    drawGround(ctx, cx, cy, view.w / view.zoom, view.h / view.zoom, 'konoha');
  }
  requestAnimationFrame(frame);
}

renderMenu();
requestAnimationFrame(frame);
