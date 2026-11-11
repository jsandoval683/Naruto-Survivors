import type { Game } from './game';
import type { MinionKind } from './enemies';

export const MAX_ENEMIES = 450;
const SWARM_EVERY = 60;

export class Spawner {
  private acc = 0;
  private nextSwarm = SWARM_EVERY * 2;

  update(g: Game, dt: number): void {
    const t = g.t;
    // Enemies per second: gentle first minutes, then accelerating after minute 4.
    const late = t > 240 ? Math.pow((t - 240) / 60, 1.5) * 1.5 : 0;
    const rate = 0.6 + t / 30 + late;
    this.acc += rate * dt;
    let guard = 0;
    while (this.acc >= 1 && guard++ < 60) {
      this.acc -= 1;
      if (g.enemies.length >= MAX_ENEMIES) {
        this.acc = 0;
        break;
      }
      const a = Math.random() * Math.PI * 2;
      const r = g.spawnRadius;
      g.spawnEnemy(this.pickKind(g), g.player.x + Math.cos(a) * r, g.player.y + Math.sin(a) * r);
    }

    // Every minute a ring of fast minions closes in around the player.
    if (t >= this.nextSwarm) {
      this.nextSwarm += SWARM_EVERY;
      const n = Math.min(60, 12 + Math.floor(t / 15), MAX_ENEMIES + 60 - g.enemies.length);
      const r = g.spawnRadius * 0.8;
      const kind: MinionKind = g.scene === 'uchiha' ? 'crow' : g.scene === 'guerra' ? 'zetsu' : 'puppet';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.spawnEnemy(kind, g.player.x + Math.cos(a) * r, g.player.y + Math.sin(a) * r);
      }
      if (!g.banner) g.announce('¡Te están rodeando!');
    }
  }

  private pickKind(g: Game): MinionKind {
    const weights = g.director.arc.minions.filter((m) => !m.from || g.t >= m.from);
    let total = 0;
    for (const m of weights) total += m.w;
    let roll = Math.random() * total;
    for (const m of weights) {
      roll -= m.w;
      if (roll <= 0) return m.kind;
    }
    return 'grunt';
  }
}
