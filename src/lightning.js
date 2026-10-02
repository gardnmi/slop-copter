import { CLOUD_SPANS } from './cloud-spans.js';

export const LIGHTNING_WARNING_TICKS = 8;
export const LIGHTNING_STRIKE_TICKS = 12;

export class CloudLightning {
  constructor(random) {
    // Separate randomness keeps this effect from changing cloud drift or falls.
    this.random = random;
    this.delay = 240 + Math.floor(random() * 210);
    this.phase = 'idle';
    this.age = 0;
    this.strikes = 0;
    this.source = null;
    this.reach = { x: 0, y: 0 };
    this.spine = [];
    this.forks = [];
  }

  resetStrike() {
    this.phase = 'idle'; this.age = 0; this.source = null;
    this.spine = []; this.forks = [];
  }

  start(game) {
    // Pick a visible pixel on the cloud's lower silhouette, not its rectangle.
    const rows = CLOUD_SPANS[game.cloudIndex];
    const bottom = rows.findLastIndex(spans => spans.length);
    if (game.cloudY + bottom * 2 >= game.deck + 24) return false;
    const [left, right] = rows[bottom].at(-1);
    const min = Math.max(left * 2, 16 - game.cloudX);
    const max = Math.min(right * 2, game.width - 16 - game.cloudX);
    if (max <= min) return false;
    this.source = { index: game.cloudIndex, x: min + this.random() * (max - min), y: bottom * 2 };
    // A tiny discharge beneath the cloud, measured relative to its own sprite.
    // Viewport height must never turn this into a cloud-to-ground strike.
    this.reach = { x: (this.random() - .5) * 24,
      y: Math.min(24 + this.random() * 18, game.deck + 40 - game.cloudY - this.source.y) };
    const count = 4;
    this.spine = Array.from({ length: count + 1 }, (_, i) => ({
      t: i / count, offset: i === 0 || i === count ? 0 : (this.random() - .5) * 8,
    }));
    this.forks = this.random() < .4 ? [{ index: 2,
      dx: (this.random() < .5 ? -1 : 1) * (6 + this.random() * 6),
      dy: 6 + this.random() * 6, bend: (this.random() - .5) * 4,
    }] : [];
    this.phase = 'warning'; this.age = 0;
    return true;
  }

  paths(game) {
    if (!this.source) return [];
    const x = game.cloudX + this.source.x, y = game.cloudY + this.source.y;
    const endY = Math.min(y + this.reach.y, game.deck + 40);
    const main = this.spine.map(({ t, offset }) => [
      Math.round((x + this.reach.x * t + offset) / 2) * 2,
      Math.round((y + (endY - y) * t) / 2) * 2,
    ]);
    return [main, ...this.forks.map(fork => {
      const [fx, fy] = main[fork.index];
      return [[fx, fy], [fx + fork.dx * .5 + fork.bend, Math.min(endY, fy + fork.dy * .5)],
        [fx + fork.dx, Math.min(endY, fy + fork.dy)]];
    })];
  }

  tick(game) {
    if (!game.cloudEnabled || !game.isThemed('cloud') || !game.canFly) {
      this.resetStrike(); return;
    }
    if (this.source && (game.cloudIndex !== this.source.index || game.cloudX + this.source.x < 0)) {
      this.resetStrike(); this.delay = 240 + Math.floor(this.random() * 210);
    }
    if (this.phase === 'idle') {
      if (--this.delay <= 0 && !this.start(game)) this.delay = 25;
      return;
    }
    this.age++;
    if (this.phase === 'warning' && this.age >= LIGHTNING_WARNING_TICKS) {
      this.phase = 'strike'; this.age = 0; this.strikes++;
    } else if (this.phase === 'strike' && this.age >= LIGHTNING_STRIKE_TICKS) {
      this.resetStrike(); this.delay = 350 + Math.floor(this.random() * 300);
    }
  }
}
