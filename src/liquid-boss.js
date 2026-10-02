import { crossesRect } from './combat.js';
import { hunterMuzzle, HUNTER_LAUNCH_ANGLE, HUNTER_HITBOXES } from './liquid-assets.js';

export const LIQUID_TIMINGS = { victory: 180, melt: 80, flow: 115, engulf: 90, reveal: 50, dying: 85 };
export const GRENADE_HITS = 5;
export const SELF_DESTRUCT_TICKS = 600;
export const GRENADE_RELOAD = 55;
export const ROCKET_INTERVAL = 110;
export const ROCKET_WARNING = 35;
export const ROCKET_TURN = .028;
export const ROCKET_FUEL = 130;
export const ROCKET_LIFE = 175;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = p => p * p * (3 - 2 * p);
const mix = (a, b, p) => a + (b - a) * p;
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class LiquidBoss {
  constructor() {
    this.phase = 'dormant'; this.age = this.time = 0;
    this.x = this.oldX = 0; this.hostX = 0;
    this.hostStartX = this.hostTargetX = 0;
    this.hostHorse = true; this.hostMotor = false;
    this.parts = []; this.grenades = []; this.rockets = []; this.blasts = [];
    this.hits = this.reload = this.throwTick = this.hitFlash = this.distance = 0;
    this.rocketCooldown = 75; this.launchFlash = 0; this.awarded = false;
    this.escapeDriver = null;
    this.selfDestructTicks = 0;
  }
  get intro() { return ['victory', 'melt', 'flow', 'engulf', 'reveal'].includes(this.phase); }
  get ownsCart() { return this.phase !== 'dormant'; }
  get replacesCart() { return ['reveal', 'hunt', 'dying', 'won'].includes(this.phase); }
  get fighting() { return this.phase === 'hunt'; }
  get grenadier() { return this.phase !== 'dormant' && this.phase !== 'victory'; }
  get canGrenade() { return this.fighting && this.reload === 0; }
  get health() { return GRENADE_HITS - this.hits; }
  get label() { return this.phase === 'won' ? 'SCRAP' : this.replacesCart ? 'HUNTER' : null; }
  speed(game) { return Math.min(4, game.wagonStep * 2 + .4 + this.hits * .2); }
  launcher(game) { return hunterMuzzle(this, game.deck); }
  enter(phase, game) {
    this.phase = phase; this.age = 0;
    const lines = {
      victory: 'VICTORY. All eight machines destroyed. Mission complete.',
      melt: 'Wait. That is not scrap.',
      flow: 'The metal is moving toward the carriage.',
      engulf: 'It is covering the carriage. All of it.',
      reveal: 'The same horse. The same buggy. All chrome.',
      hunt: 'HOMING ROCKETS. Arrows to dodge. SPACE drops grenades. Five hits!',
      dying: 'SELF DESTRUCT ARMED. Follow the arrow. Fly RIGHT!',
      won: 'SELF DESTRUCT. The carriage is a bomb. Fly RIGHT!',
    };
    if (lines[phase]) game.message = lines[phase];
    if (phase === 'dying') this.selfDestructTicks = SELF_DESTRUCT_TICKS;
    // The liquid coating smothers any hay fire before the chrome reveal.
    if (phase === 'engulf') game.carriage.hayBurning = false;
    if (phase === 'melt') {
      this.parts = game.counterattack.wrecks.map((w, i) => ({ fromX: w.x, x: w.x, delay: i * 5, facing: w.facing }));
      game.counterattack.wrecks = [];
      if (game.carriage.driverAlive) this.escapeDriver = { x: game.carriage.driverPosition(game).x, age: 0 };
    }
    if (phase === 'reveal') { game.carriage.phase = 'possessed'; this.parts = []; }
    if (phase === 'hunt') { game.counterattack.protectionTicks = 50; this.rocketCooldown = 75; }
  }
  begin(game) {
    if (this.phase !== 'dormant') return;
    this.hostHorse = game.carriage.horseAlive; this.hostMotor = game.carriage.motorized;
    // Keep the old carriage in view; ease an edge-bound cart into the scene
    // instead of relocating it behind a fullscreen victory card.
    const offset = this.hostHorse ? 73 : 44;
    this.x = this.hostStartX = game.cartX + offset;
    this.hostTargetX = clamp(this.x, 115, game.width - 115);
    this.hostX = this.x - offset; game.cartX = this.hostX; this.oldX = this.x;
    game.carriage.motion = 0; game.carriage.finishDrop();
    game.counterattack.bullets = []; game.counterattack.flash = 0; game.counterattack.sparks = [];
    game.combat.bullets = [];
    this.enter('victory', game);
  }
  tickIntro(game) {
    this.age++; this.time++;
    if (this.phase === 'victory') {
      this.x = mix(this.hostStartX, this.hostTargetX, ease(clamp(this.age / 90, 0, 1)));
      this.hostX = this.x - (this.hostHorse ? 73 : 44); game.cartX = this.hostX;
    }
    if (this.escapeDriver) {
      this.escapeDriver.x += 5; this.escapeDriver.age++;
      if (this.escapeDriver.x > game.width + 50) this.escapeDriver = null;
    }
    if (this.phase === 'flow') {
      for (const part of this.parts) {
        const p = clamp((this.age - part.delay) / (LIQUID_TIMINGS.flow - part.delay), 0, 1);
        part.x = mix(part.fromX, this.x, ease(p));
      }
    }
    if (this.age >= LIQUID_TIMINGS[this.phase]) {
      const sequence = ['victory', 'melt', 'flow', 'engulf', 'reveal', 'hunt'];
      this.enter(sequence[sequence.indexOf(this.phase) + 1], game);
    }
  }
  tick(game) {
    if (this.phase === 'dormant' || !game.canFly) return;
    if (this.selfDestructTicks > 0) this.selfDestructTicks--;
    if (this.intro) { this.tickIntro(game); return; }
    this.age++; this.time++;
    this.reload = Math.max(0, this.reload - 1); this.throwTick = Math.max(0, this.throwTick - 1);
    this.hitFlash = Math.max(0, this.hitFlash - 1); this.launchFlash = Math.max(0, this.launchFlash - 1);
    this.blasts = this.blasts.filter(b => ++b.age < 25);
    if (this.phase === 'dying') {
      if (this.age % 12 === 1) this.blasts.push({ x: this.x + Math.sin(this.age) * 55, y: game.deck + 15, age: 0, metal: true });
      if (this.age >= LIQUID_TIMINGS.dying) this.enter('won', game);
      return;
    }
    if (!this.fighting) return;
    this.oldX = this.x;
    const speed = this.speed(game); this.x += speed; this.distance += speed;
    if (this.x > game.width + 96) { this.x = -96; this.oldX = this.x; }
    game.cartX = this.x - 44;
    this.tickGrenades(game);
    if (!this.fighting) return;
    this.rocketCooldown = Math.max(0, this.rocketCooldown - 1);
    if (!this.rocketCooldown && this.x > 75 && this.x < game.width - 75) this.launch(game);
    this.tickRockets(game);
    if (HUNTER_HITBOXES.some(([x, y, w, h]) => game.copterX - 10 < this.x + x + w && game.copterX + 68 > this.x + x
      && game.copterY + 10 < game.deck + 44 + y + h && game.copterY + 48 > game.deck + 44 + y)) game.combat.hit(game);
  }
  launch(game) {
    this.rockets.push({ ...this.launcher(game), angle: HUNTER_LAUNCH_ANGLE, age: 0, trail: [] });
    this.rocketCooldown = ROCKET_INTERVAL; this.launchFlash = 7;
  }
  tickRockets(game) {
    const remaining = [];
    for (const r of this.rockets) {
      const oldX = r.x, oldY = r.y; r.age++;
      if (r.age > 12 && r.age <= ROCKET_FUEL) {
        const wanted = Math.atan2(game.copterY + 25 - r.y, game.copterX + 20 - r.x);
        r.angle += clamp(angleDifference(wanted, r.angle), -ROCKET_TURN, ROCKET_TURN);
      }
      const speed = 4.4 + Math.min(1, r.age / 45) * 2;
      r.x += Math.cos(r.angle) * speed; r.y += Math.sin(r.angle) * speed;
      if (r.age % 3 === 0) { r.trail.push({ x: oldX, y: oldY }); if (r.trail.length > 12) r.trail.shift(); }
      const hit = [[game.copterX - 10, game.copterY + 10, 78, 38], [game.copterX - 64, game.copterY + 14, 60, 20]]
        .some(rect => crossesRect(oldX, oldY, r.x, r.y, rect));
      const spent = r.age >= ROCKET_LIFE || r.y >= game.deck + 43 || r.x < -80 || r.x > game.width + 80 || r.y < -100;
      if (hit || spent) {
        this.blasts.push({ x: r.x, y: Math.min(r.y, game.deck + 42), age: 0 });
        if (hit) game.combat.hit(game);
      } else remaining.push(r);
      if (!game.canFly) { this.rockets = []; this.grenades = []; return; }
    }
    this.rockets = remaining;
  }
  dropGrenade(game) {
    if (!this.canGrenade || !game.canFly || game.paused || game.inCinematic) return false;
    const h = game.hangingPosition;
    this.grenades.push({ x: h.x + 14 + game.counterattack.facing * 12, y: h.y + 26, vy: 1.5, age: 0 });
    this.reload = GRENADE_RELOAD; this.throwTick = 18;
    return true;
  }
  tickGrenades(game) {
    const remaining = [];
    for (const grenade of this.grenades) {
      const oldY = grenade.y;
      grenade.vy = Math.min(11, grenade.vy + .34); grenade.y += grenade.vy; grenade.age++;
      // Sweep against the visible horse, buggy and launcher, without treating
      // the carriage's wrap to the other edge as travel across the screen.
      const hit = HUNTER_HITBOXES.some(([x, y, w, h]) =>
        crossesRect(grenade.x - this.oldX, oldY, grenade.x - this.x, grenade.y, [x, game.deck + 44 + y, w, h]));
      if (hit || grenade.y >= game.deck + 42) {
        this.blasts.push({ x: grenade.x, y: Math.min(grenade.y, game.deck + 42), age: 0 });
        if (hit) this.grenadeHit(game);
      } else if (grenade.age < 260) remaining.push(grenade);
      if (!this.fighting) break;
    }
    this.grenades = this.fighting ? remaining : [];
  }
  grenadeHit(game) {
    if (!this.fighting) return false;
    this.hits++; this.hitFlash = 12;
    game.message = `GRENADE HIT ${this.hits}/${GRENADE_HITS}. ${GRENADE_HITS - this.hits} to go. Keep dodging!`;
    if (this.hits < GRENADE_HITS) return true;
    this.enter('dying', game); this.rockets = []; this.grenades = [];
    if (!this.awarded) { this.awarded = true; game.score += 3000; game.best = Math.max(game.best, game.score); }
    return true;
  }
  resize(game, sx, sy, deckChange = 0) {
    this.x *= sx; this.oldX = this.x; this.hostX *= sx;
    this.hostStartX *= sx; this.hostTargetX = clamp(this.hostTargetX * sx, 115, game.width - 115);
    if (this.escapeDriver) this.escapeDriver.x *= sx;
    for (const part of this.parts) { part.x *= sx; part.fromX *= sx; }
    for (const grenade of this.grenades) { grenade.x *= sx; grenade.y *= sy; }
    for (const rocket of this.rockets) {
      rocket.x *= sx; rocket.y *= sy;
      rocket.angle = Math.atan2(Math.sin(rocket.angle) * sy, Math.cos(rocket.angle) * sx);
      for (const p of rocket.trail) { p.x *= sx; p.y *= sy; }
    }
    for (const blast of this.blasts) { blast.x *= sx; blast.y += deckChange; }
    if (this.intro) {
      const offset = this.hostHorse ? 73 : 44;
      this.hostX = this.x - offset; game.cartX = this.hostX;
    }
  }
}
