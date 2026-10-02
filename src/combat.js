import { crewShoulder, crewMuzzle, CREW_STAND_TICKS } from './crew.js';

export const GET_UP_TICKS = CREW_STAND_TICKS;
export const FIRST_SHOT_TICKS = 78;
export const SHOT_INTERVAL = 96;
export const HIT_GRACE_TICKS = 45;
export const CRASH_TICKS = 90;
export const EXPLOSION_TICKS = 66;
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));

export function crossesRect(x0, y0, x1, y1, [left, top, width, height]) {
  let enter = 0, leave = 1;
  for (const [origin, delta, low, high] of [[x0, x1 - x0, left, left + width], [y0, y1 - y0, top, top + height]]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < low || origin > high) return false;
    } else {
      const a = (low - origin) / delta, b = (high - origin) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return false;
    }
  }
  return true;
}

export class Combat {
  constructor() {
    this.shooters = [];
    this.bullets = [];
    this.smoke = [];
    this.hits = this.hurtTicks = this.crashTick = this.explosionTick = 0;
    this.crashStart = [0, 0];
    this.spinDirection = 1;
    this.angle = 0;
  }
  miss(game, x) {
    this.shooters.push({ x: clamp(x + 14, 16, game.width - 16), age: 12, cooldown: 0, flash: 0, aimX: 0, aimY: -1, facing: 1, health: 2, hitFlash: 0 });
    game.counterattack.registerTerminator(game);
  }
  hit(game) {
    if (!game.retaliation || this.hurtTicks || !game.canFly || game.inCinematic || game.counterattack.protectionTicks) return false;
    this.hits++;
    this.hurtTicks = HIT_GRACE_TICKS;
    game.message = `Hit ${this.hits}/3! Keep moving!`;
    if (this.hits === 3) {
      this.crashStart = [game.copterX, game.copterY];
      this.spinDirection = game.dh < 0 ? -1 : 1;
      game.releaseControls();
      game.jumper = null;
      this.bullets = [];
      game.counterattack.bullets = [];
      game.counterattack.flash = 0;
      game.boss.rockets = []; game.boss.grenades = [];
      game.state = 'crashing';
      game.message = 'MAYDAY. MAYDAY. Going down!';
    }
    return true;
  }
  tick(game) {
    if (!game.retaliation || game.state === 'game_over') return;
    this.hurtTicks = Math.max(0, this.hurtTicks - 1);
    if (game.state === 'crashing') {
      this.crashTick++;
      const p = Math.min(1, this.crashTick / CRASH_TICKS);
      const [x, y] = this.crashStart;
      const drift = this.spinDirection * (85 * Math.sin(p * Math.PI / 2) + 10 * p * Math.sin(p * Math.PI * 4));
      game.copterX = clamp(x + drift, 85, game.width - 85);
      game.copterY = y + (game.deck + 18 - y) * p ** 1.6;
      this.angle = this.spinDirection * (p * p * Math.PI * 6 + p * Math.PI);
      if (this.crashTick >= CRASH_TICKS) {
        game.state = 'exploding';
        game.message = 'Copter down.';
      }
    } else if (game.state === 'exploding') {
      this.explosionTick++;
      if (this.explosionTick >= EXPLOSION_TICKS) {
        game.state = 'game_over';
        game.message = 'The stuntmen win this round.';
      }
    } else {
      this.tickShooters(game);
      this.tickBullets(game);
    }
    this.tickSmoke(game);
  }
  tickShooters(game) {
    for (const s of this.shooters) {
      s.age++;
      s.hitFlash = Math.max(0, (s.hitFlash ?? 0) - 1);
      s.flash = Math.max(0, s.flash - 1);
      s.cooldown = Math.max(0, s.cooldown - 1);
      s.facing = game.copterX + 24 >= s.x ? 1 : -1;
      const shoulder = crewShoulder(s, game.deck + 44);
      const dx = game.copterX + 24 - shoulder.x, dy = game.copterY + 28 - shoulder.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      s.aimX = dx / distance;
      s.aimY = dy / distance;
      if (s.age >= FIRST_SHOT_TICKS && s.cooldown === 0) {
        this.bullets.push({ ...crewMuzzle(s, game.deck + 44), vx: s.aimX * 8, vy: s.aimY * 8, age: 0 });
        s.cooldown = SHOT_INTERVAL;
        s.flash = 6;
      }
    }
  }
  tickBullets(game) {
    const remaining = [];
    const targets = [[game.copterX - 10, game.copterY + 10, 78, 38], [game.copterX - 64, game.copterY + 14, 60, 20]];
    for (const bullet of this.bullets) {
      const oldX = bullet.x, oldY = bullet.y;
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      bullet.age++;
      if (targets.some(rect => crossesRect(oldX, oldY, bullet.x, bullet.y, rect))) {
        this.hit(game);
        if (game.state === 'crashing') return;
        continue;
      }
      if (bullet.age < 360 && bullet.x > -16 && bullet.x < game.width + 16 && bullet.y > -16 && bullet.y < game.height + 16) remaining.push(bullet);
    }
    this.bullets = remaining;
  }
  tickSmoke(game) {
    for (const puff of this.smoke) {
      puff.age++;
      puff.x += puff.drift;
      puff.y -= 0.7 + puff.age * 0.01;
    }
    this.smoke = this.smoke.filter(p => p.age < 75);
    if (this.hits && !['exploding', 'game_over'].includes(game.state) && game.frame % (this.hits === 1 ? 6 : 3) === 0) {
      this.smoke.push({ x: game.copterX + 10, y: game.copterY + 13, age: 0, drift: Math.sin(game.frame * 1.7) * 0.35 });
    }
  }
}
