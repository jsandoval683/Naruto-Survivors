import { writeSave, type SaveData } from '../core/save';
import { CHARACTERS, CHARACTER_ORDER, type CharacterId } from '../game/characters';
import { LOOKS } from '../game/looks';
import { ACHIEVEMENTS, checkAchievements, rewardText } from '../meta/achievements';
import { pull, PITY, RARITY, TICKET_PRICE, type Prize } from '../meta/gacha';
import { DAILY_BONUS_TICKETS, dailyMissions, ensureDaily, timeToReset } from '../meta/missions';
import { SKINS } from '../meta/skins';
import { buyUpgrade, upgradeCost, upgradeLevel, UPGRADES } from '../meta/upgrades';
import { drawLookDirect } from '../render/sprites';

export type MetaTab = 'mejoras' | 'tienda' | 'pergaminos' | 'misiones' | 'logros';

export const TAB_NAMES: Record<MetaTab, string> = {
  mejoras: 'Mejoras',
  tienda: 'Tienda',
  pergaminos: 'Pergaminos',
  misiones: 'Misiones',
  logros: 'Logros',
};

/** Ryō price to buy a ninja outright instead of meeting its unlock condition. */
export const NINJA_PRICES: Partial<Record<CharacterId, number>> = {
  sakura: 1500,
  kakashi: 1500,
  gaara: 2500,
  lee: 2500,
  sasuke: 4000,
};

function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function portrait(lookId: string, size = 56): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size * 2;
  c.height = size * 2;
  c.className = 'portrait';
  drawLookDirect(c.getContext('2d')!, LOOKS[lookId], size, size * 1.15, size * 0.55);
  return c;
}

export class MetaScreen {
  tab: MetaTab = 'mejoras';
  upgradeChar: CharacterId = 'naruto';
  lastPrizes: Prize[] = [];

  constructor(
    private save: SaveData,
    private root: HTMLElement,
    /** Called after anything that changes the save (to refresh the menu). */
    private onChange: () => void,
  ) {}

  open(tab: MetaTab): void {
    this.tab = tab;
    this.upgradeChar = this.save.selected as CharacterId;
    this.lastPrizes = [];
    this.render();
  }

  private commit(): void {
    checkAchievements(this.save);
    writeSave(this.save);
    this.onChange();
    this.render();
  }

  render(): void {
    const s = this.save;
    const tabs = (Object.keys(TAB_NAMES) as MetaTab[])
      .map((t) => `<button class="tab${t === this.tab ? ' active' : ''}" data-tab="${t}">${TAB_NAMES[t]}</button>`)
      .join('');
    this.root.innerHTML = `
      <div class="meta-head">
        <div class="tabs">${tabs}</div>
        <div class="wallet"><span>両 <b>${s.ryo}</b></span><span>巻 <b>${s.tickets}</b></span></div>
      </div>
      <div class="meta-body"></div>`;
    this.root.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as MetaTab;
        this.render();
      }),
    );
    const body = this.root.querySelector('.meta-body') as HTMLElement;
    switch (this.tab) {
      case 'mejoras':
        this.renderUpgrades(body);
        break;
      case 'tienda':
        this.renderShop(body);
        break;
      case 'pergaminos':
        this.renderGacha(body);
        break;
      case 'misiones':
        this.renderMissions(body);
        break;
      case 'logros':
        this.renderAchievements(body);
        break;
    }
  }

  private renderUpgrades(body: HTMLElement): void {
    const s = this.save;
    const pick = el(`<div class="char-pick"></div>`);
    for (const id of CHARACTER_ORDER) {
      if (!s.unlocked.includes(id)) continue;
      const b = el(`<button class="mini-char${id === this.upgradeChar ? ' selected' : ''}" title="${CHARACTERS[id].name}"></button>`);
      b.appendChild(portrait(id, 24));
      b.addEventListener('click', () => {
        this.upgradeChar = id;
        this.render();
      });
      pick.appendChild(b);
    }
    body.appendChild(el(`<p class="muted">Cada ninja tiene sus propias mejoras: solo cuentan cuando juegas con él. Ahora: <b>${CHARACTERS[this.upgradeChar].name}</b></p>`));
    body.appendChild(pick);
    const grid = el(`<div class="up-grid"></div>`);
    for (const u of UPGRADES) {
      const lvl = upgradeLevel(s, this.upgradeChar, u.id);
      const maxed = lvl >= u.max;
      const cost = upgradeCost(u, lvl);
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      const card = el(`
        <div class="up">
          <div class="up-icon">${u.icon}</div>
          <div class="up-text"><b>${u.name}</b><span>${u.desc}</span><div class="pips">${pips}</div></div>
          <button class="buy" ${maxed || s.ryo < cost ? 'disabled' : ''}>${maxed ? 'Máx.' : `両 ${cost}`}</button>
        </div>`);
      card.querySelector('button')!.addEventListener('click', () => {
        if (buyUpgrade(s, this.upgradeChar, u)) this.commit();
      });
      grid.appendChild(card);
    }
    body.appendChild(grid);
  }

  private renderShop(body: HTMLElement): void {
    const s = this.save;
    body.appendChild(el(`<h4>Ninjas</h4>`));
    const ninjas = el(`<div class="shop-grid"></div>`);
    for (const id of CHARACTER_ORDER) {
      const price = NINJA_PRICES[id];
      if (!price) continue;
      const owned = s.unlocked.includes(id);
      const card = el(`
        <div class="shop-item">
          <div class="pic"></div>
          <div><b>${CHARACTERS[id].name}</b><span class="muted">${owned ? 'Ya es tuyo' : CHARACTERS[id].unlockText}</span></div>
          <button class="buy" ${owned || s.ryo < price ? 'disabled' : ''}>${owned ? '✓' : `両 ${price}`}</button>
        </div>`);
      card.querySelector('.pic')!.appendChild(portrait(id, 22));
      card.querySelector('button')!.addEventListener('click', () => {
        if (owned || s.ryo < price) return;
        s.ryo -= price;
        s.unlocked.push(id);
        this.commit();
      });
      ninjas.appendChild(card);
    }
    body.appendChild(ninjas);

    body.appendChild(el(`<h4>Pergaminos de la suerte</h4>`));
    const tickets = el(`<div class="shop-grid"></div>`);
    for (const n of [1, 10]) {
      const price = n === 1 ? TICKET_PRICE : TICKET_PRICE * 9;
      const card = el(`
        <div class="shop-item">
          <div class="pic big-icon">巻</div>
          <div><b>${n} ${n === 1 ? 'pergamino' : 'pergaminos'}</b><span class="muted">${n === 10 ? '¡Uno gratis!' : 'Para tirar en Pergaminos'}</span></div>
          <button class="buy" ${s.ryo < price ? 'disabled' : ''}>両 ${price}</button>
        </div>`);
      card.querySelector('button')!.addEventListener('click', () => {
        if (s.ryo < price) return;
        s.ryo -= price;
        s.tickets += n;
        this.commit();
      });
      tickets.appendChild(card);
    }
    body.appendChild(tickets);

    body.appendChild(el(`<h4>Apariencias</h4>`));
    const owned = SKINS.filter((k) => s.skins.includes(k.id));
    if (!owned.length) {
      body.appendChild(el(`<p class="muted">Aún no tienes apariencias. Salen como premio Épico o Legendario en los pergaminos.</p>`));
      return;
    }
    const skins = el(`<div class="shop-grid"></div>`);
    for (const k of owned) {
      const on = s.skinSel[k.char] === k.id;
      const card = el(`
        <div class="shop-item">
          <div class="pic"></div>
          <div><b>${k.name}</b><span class="muted">${CHARACTERS[k.char].name}</span></div>
          <button class="buy">${on ? 'Quitar' : 'Equipar'}</button>
        </div>`);
      card.querySelector('.pic')!.appendChild(portrait(k.lookId, 22));
      card.querySelector('button')!.addEventListener('click', () => {
        if (on) delete s.skinSel[k.char];
        else s.skinSel[k.char] = k.id;
        this.commit();
      });
      skins.appendChild(card);
    }
    body.appendChild(skins);
  }

  private renderGacha(body: HTMLElement): void {
    const s = this.save;
    const odds = (Object.keys(RARITY) as (keyof typeof RARITY)[])
      .map((r) => `<tr><td style="color:${RARITY[r].color}">${RARITY[r].name}</td><td>${(RARITY[r].chance * 100).toFixed(0)}%</td></tr>`)
      .join('');
    body.appendChild(
      el(`
      <div class="gacha">
        <div>
          <p>Abre pergaminos para conseguir <b>ryō</b>, <b>apariencias</b> (Épico) y <b>ninjas</b> (Legendario).</p>
          <table class="odds">${odds}</table>
          <p class="muted small">Un ×10 asegura al menos un Raro. Legendario asegurado a las ${PITY} tiradas (llevas ${s.pity}).<br>Los pergaminos se ganan venciendo jefes, con las misiones diarias y los logros, o comprándolos en la Tienda.</p>
        </div>
        <div class="gacha-actions">
          <button class="primary" id="pull1" ${s.tickets < 1 ? 'disabled' : ''}>Abrir ×1 · 巻 1</button>
          <button class="primary" id="pull10" ${s.tickets < 10 ? 'disabled' : ''}>Abrir ×10 · 巻 10</button>
        </div>
      </div>`),
    );
    if (this.lastPrizes.length) {
      const list = el(`<div class="prizes"></div>`);
      for (const p of this.lastPrizes) {
        list.appendChild(el(`<div class="prize" style="border-color:${RARITY[p.rarity].color}"><span style="color:${RARITY[p.rarity].color}">${RARITY[p.rarity].name}</span>${p.text}</div>`));
      }
      body.appendChild(list);
    }
    const doPull = (n: 1 | 10) => {
      const prizes = pull(s, n);
      if (!prizes) return;
      this.lastPrizes = prizes;
      this.commit();
    };
    body.querySelector('#pull1')!.addEventListener('click', () => doPull(1));
    body.querySelector('#pull10')!.addEventListener('click', () => doPull(10));
  }

  private renderMissions(body: HTMLElement): void {
    const daily = ensureDaily(this.save);
    const missions = dailyMissions(daily.date);
    body.appendChild(el(`<p class="muted">Se renuevan en ${timeToReset()}. Completa las 3 y ganas además ${DAILY_BONUS_TICKETS} pergaminos.</p>`));
    const list = el(`<div class="mission-list"></div>`);
    for (const m of missions) {
      const done = daily.done.includes(m.id);
      const prog = Math.min(m.target, Math.floor(daily.progress[m.id] ?? 0));
      const shown = m.id.startsWith('t') && m.target >= 60 ? `${Math.floor(prog / 60)}/${m.target / 60} min` : `${prog}/${m.target}`;
      list.appendChild(
        el(`
        <div class="mission${done ? ' done' : ''}">
          <div><b>${m.text}</b><span class="muted">${done ? '¡Completada!' : shown}</span>
            <div class="bar"><i style="width:${(prog / m.target) * 100}%"></i></div></div>
          <span class="reward">+${m.reward} 両</span>
        </div>`),
      );
    }
    list.appendChild(el(`<div class="mission${daily.bonus ? ' done' : ''}"><div><b>Completa las 3 misiones</b><span class="muted">${daily.done.length}/3</span></div><span class="reward">+${DAILY_BONUS_TICKETS} 巻</span></div>`));
    body.appendChild(list);
  }

  private renderAchievements(body: HTMLElement): void {
    const s = this.save;
    body.appendChild(el(`<p class="muted">${s.achievements.length} de ${ACHIEVEMENTS.length} logros. Las recompensas se cobran solas.</p>`));
    const list = el(`<div class="ach-list"></div>`);
    const sorted = [...ACHIEVEMENTS].sort((a, b) => +s.achievements.includes(b.id) - +s.achievements.includes(a.id));
    for (const a of sorted) {
      const got = s.achievements.includes(a.id);
      list.appendChild(el(`<div class="ach${got ? ' done' : ''}"><span class="medal">${got ? '★' : '☆'}</span><div><b>${a.name}</b><span class="muted">${a.desc}</span></div><span class="reward">${rewardText(a)}</span></div>`));
    }
    body.appendChild(list);
  }
}
