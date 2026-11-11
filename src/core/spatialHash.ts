/** Uniform grid so collision checks stay cheap with hundreds of enemies. */
export class SpatialHash<T extends { x: number; y: number }> {
  private cells = new Map<number, T[]>();

  constructor(private size = 64) {}

  clear(): void {
    this.cells.clear();
  }

  private key(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  insert(o: T): void {
    const k = this.key(Math.floor(o.x / this.size), Math.floor(o.y / this.size));
    let cell = this.cells.get(k);
    if (!cell) {
      cell = [];
      this.cells.set(k, cell);
    }
    cell.push(o);
  }

  /** Appends every object in the cells overlapping the circle (caller does the exact test). */
  query(x: number, y: number, r: number, out: T[]): T[] {
    const s = this.size;
    const x0 = Math.floor((x - r) / s);
    const x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s);
    const y1 = Math.floor((y + r) / s);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (cell) for (const o of cell) out.push(o);
      }
    }
    return out;
  }
}
