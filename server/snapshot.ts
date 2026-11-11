import type { Game } from '../src/game/game';
import { heroView } from '../src/game/view';
import type { Effect, FloatText } from '../src/game/types';
import { ENEMY_KINDS, FIELD_STYLES, NATURES, PICKUP_KINDS, PROJ_KINDS, type Snapshot } from '../src/net/protocol';

const BASE_SPEED = 135;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Encodes the shared world; effects and texts are sent once (only the new ones). */
export class SnapshotEncoder {
  private sentFx = new WeakSet<Effect>();
  private sentTx = new WeakSet<FloatText>();

  encode(g: Game): Snapshot {
    const e: number[] = [];
    const b: Snapshot['b'] = [];
    for (const en of g.enemies) {
      if (en.dead) continue;
      if (en.boss) {
        b.push({
          id: en.id,
          x: Math.round(en.x),
          y: Math.round(en.y),
          r: en.r,
          hp: Math.round(en.hp),
          maxHp: Math.round(en.maxHp),
          dmgTaken: en.dmgTaken,
          nature: en.nature,
          name: en.boss.name,
          lookId: en.boss.lookId,
          hearts: en.boss.hearts,
          flash: en.flash > 0 ? 1 : 0,
        });
      } else {
        e.push(en.id, ENEMY_KINDS.indexOf(en.kind), NATURES.indexOf(en.nature), Math.round(en.x), Math.round(en.y), en.r, en.flash > 0 ? 1 : 0, Math.round((en.hp / en.maxHp) * 100));
      }
    }
    const p: number[] = [];
    for (const pr of g.projectiles) {
      if (pr.dead) continue;
      p.push(PROJ_KINDS.indexOf(pr.kind), Math.round(pr.x), Math.round(pr.y), r1(pr.r), Math.round(pr.angle * 100), pr.big ? 1 : 0);
    }
    const f: number[] = [];
    for (const fd of g.fields) f.push(Math.round(fd.x), Math.round(fd.y), Math.round(fd.r), Math.round(fd.life * 10), FIELD_STYLES.indexOf(fd.style));
    const pk: number[] = [];
    for (const k of g.pickups) {
      if (k.dead) continue;
      pk.push(PICKUP_KINDS.indexOf(k.kind), Math.round(k.x), Math.round(k.y), k.value);
    }
    const fx = g.effects.filter((x) => !this.sentFx.has(x));
    fx.forEach((x) => this.sentFx.add(x));
    const tx = g.texts.filter((x) => !this.sentTx.has(x));
    tx.forEach((x) => this.sentTx.add(x));

    return {
      t: r1(g.t),
      sc: g.scene,
      arc: g.arcName,
      k: g.kills,
      ryo: g.ryo,
      lv: g.level,
      xp: Math.round(g.xp),
      xpn: g.xpNext,
      biju: g.biju,
      nb: g.director.nextBoss(g.t),
      bn: g.banner,
      tn: g.tint,
      choosing: g.heroes.filter((h) => h.hasPrompt).map((h) => h.name),
      h: g.heroes.map((h) => {
        const v = heroView(h);
        const round = (o: { x: number; y: number }) => {
          o.x = Math.round(o.x);
          o.y = Math.round(o.y);
        };
        round(v);
        v.clones.forEach(round);
        v.tags.forEach(round);
        v.orbs.forEach(round);
        v.hp = Math.round(v.hp);
        return { ...v, spd: BASE_SPEED * h.stats.speed * (h.body.slow > 0 ? 0.5 : 1) };
      }),
      e,
      b,
      p,
      hz: g.hazards.filter((h) => !h.dead).map((h) => ({ kind: h.kind, x: Math.round(h.x), y: Math.round(h.y), r: h.r, color: h.color, dmg: h.dmg, life: r1(h.life), delay: h.delay, maxDelay: h.maxDelay, linger: h.linger })),
      f,
      pk,
      fx,
      tx,
    };
  }
}
