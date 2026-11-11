export interface TouchStick {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

const STICK_RADIUS = 50;

/** Keyboard (WASD / arrows) + "joystick appears where you touch" for mobile and mouse. */
export class Input {
  keys = new Set<string>();
  touch: TouchStick | null = null;
  onKey?: (code: string) => void;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.onKey?.(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touch = null;
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (this.touch) return;
      this.touch = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.touch && e.pointerId === this.touch.id) {
        this.touch.x = e.clientX;
        this.touch.y = e.clientY;
      }
    });
    const end = (e: PointerEvent) => {
      if (this.touch && e.pointerId === this.touch.id) this.touch = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  /** Movement direction, length 0..1. */
  axis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (this.touch) {
      const dx = this.touch.x - this.touch.ox;
      const dy = this.touch.y - this.touch.oy;
      const len = Math.hypot(dx, dy);
      if (len > 6) {
        const m = Math.min(1, len / STICK_RADIUS);
        x = (dx / len) * m;
        y = (dy / len) * m;
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  static readonly STICK_RADIUS = STICK_RADIUS;
}
