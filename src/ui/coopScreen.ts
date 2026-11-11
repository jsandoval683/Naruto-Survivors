import { CHARACTERS } from '../game/characters';
import { LOOKS } from '../game/looks';
import type { RoomInfo, RoomListing } from '../net/protocol';
import { drawLookDirect } from '../render/sprites';
import { formatTime } from '../render/render';

export interface CoopActions {
  create(isPublic: boolean): void;
  quick(): void;
  join(code: string): void;
  refresh(): void;
  start(): void;
  leave(): void;
  back(): void;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Lobby (public rooms, create, join by code) and room (players, start) views. */
export class CoopScreen {
  private rooms: RoomListing[] = [];
  private error = '';

  constructor(private root: HTMLElement, private actions: CoopActions) {}

  setError(msg: string): void {
    this.error = msg;
    const el = this.root.querySelector('.coop-error');
    if (el) el.textContent = msg;
  }

  renderConnecting(): void {
    this.root.innerHTML = `<h2>Cooperativo</h2><p class="muted">Conectando con el servidor…</p>`;
  }

  renderLobby(rooms?: RoomListing[]): void {
    if (rooms) this.rooms = rooms;
    const list = this.rooms.length
      ? this.rooms
          .map(
            (r) => `<div class="room-row">
              <div><b>${esc(r.host)}</b><span class="muted">${r.count}/4 · ${r.started ? `Jugando · ${formatTime(r.elapsed)}` : 'En la sala'}</span></div>
              <button class="buy" data-join="${r.code}">Unirse</button>
            </div>`,
          )
          .join('')
      : '<p class="muted">No hay salas públicas abiertas. ¡Crea una!</p>';
    this.root.innerHTML = `
      <h2>Cooperativo</h2>
      <p class="muted small">Hasta 4 jugadores. La experiencia se comparte; si alguien cae, quédate 5 s a su lado para revivirle.</p>
      <div class="coop-actions">
        <button class="primary" data-act="quick">Partida rápida</button>
        <button class="secondary" data-act="public">Crear sala pública</button>
        <button class="secondary" data-act="private">Crear sala privada</button>
      </div>
      <div class="join-code">
        <input id="joinCode" maxlength="4" placeholder="CÓDIGO" autocomplete="off" />
        <button class="secondary" data-act="code">Unirse con código</button>
      </div>
      <p class="coop-error">${esc(this.error)}</p>
      <div class="room-head"><h4>Salas abiertas</h4><button class="tab" data-act="refresh">Actualizar</button></div>
      <div class="room-list">${list}</div>
      <button class="secondary meta-back" data-act="back">Volver</button>`;
    this.bind();
  }

  renderRoom(room: RoomInfo, meId: number): void {
    const me = room.players.find((p) => p.id === meId);
    const isHost = !!me?.host;
    const slots = room.players
      .map(
        (p) => `<div class="player-slot${p.connected ? '' : ' away'}">
          <canvas data-look="${esc(p.lookId)}" width="96" height="96"></canvas>
          <b>${esc(p.name)}${p.host ? ' ★' : ''}</b>
          <span class="muted">${CHARACTERS[p.charId]?.name ?? p.charId}${p.connected ? '' : ' (fuera)'}</span>
        </div>`,
      )
      .join('');
    const empty = Array.from({ length: Math.max(0, 4 - room.players.length) }, () => `<div class="player-slot empty"><span class="muted">Libre</span></div>`).join('');
    this.root.innerHTML = `
      <h2>Sala ${room.code} <span class="muted small">${room.isPublic ? 'pública' : 'privada'}</span></h2>
      <p class="muted small">Comparte el código <b>${room.code}</b> con tus amigos. Tu ninja es el que tengas elegido en el menú.</p>
      <div class="player-grid">${slots}${empty}</div>
      <p class="coop-error">${esc(this.error)}</p>
      <div class="row">
        ${isHost ? `<button class="primary" data-act="start">${room.started ? 'Partida en curso…' : '¡Empezar!'}</button>` : `<p class="muted">${room.started ? 'Partida en curso: entrarás en un momento.' : 'Esperando a que el anfitrión empiece…'}</p>`}
        <button class="secondary" data-act="leave">Salir de la sala</button>
      </div>`;
    this.root.querySelectorAll<HTMLCanvasElement>('canvas[data-look]').forEach((c) => {
      const look = LOOKS[c.dataset.look!] ?? LOOKS.naruto;
      drawLookDirect(c.getContext('2d')!, look, 48, 60, 32);
    });
    this.bind();
  }

  private bind(): void {
    const a = this.actions;
    this.root.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        this.error = '';
        switch (b.dataset.act) {
          case 'quick':
            return a.quick();
          case 'public':
            return a.create(true);
          case 'private':
            return a.create(false);
          case 'code': {
            const code = (this.root.querySelector('#joinCode') as HTMLInputElement).value.trim().toUpperCase();
            if (code.length === 4) a.join(code);
            else this.setError('El código tiene 4 letras.');
            return;
          }
          case 'refresh':
            return a.refresh();
          case 'start':
            return a.start();
          case 'leave':
            return a.leave();
          case 'back':
            return a.back();
        }
      }),
    );
    this.root.querySelectorAll<HTMLButtonElement>('[data-join]').forEach((b) => b.addEventListener('click', () => a.join(b.dataset.join!)));
  }
}
