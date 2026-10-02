export const DRIVER_EXIT_TICKS = 56;
export const DRIVER_PULL_OFFSET = 160;
export const ENGINE_START_TICKS = 75;
const CART_SPAN = 146;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export class Carriage {
  constructor() {
    this.phase = 'horse';
    this.hayBurning = false;
    this.transitionTick = 0;
    this.deadHorse = null;
    this.driverAlive = true;
    this.deadDriver = null;
    this.looseHorse = null;
    this.engineTick = 0;
    this.exhaust = [];
    this.exhaustCount = 0;
    this.dodging = false;
    this.trick = null;
    this.motion = 2;
    this.distance = 0;
    this.pullDistance = 0;
  }

  get horseAlive() { return this.phase === 'horse'; }
  get motorized() { return this.phase === 'starting' || this.phase === 'motor'; }
  get span() { return this.phase === 'pulling' || this.phase === 'dismount' ? DRIVER_PULL_OFFSET + 20 : CART_SPAN; }
  get driverProgress() { return this.phase === 'pulling' ? 1 : clamp((this.transitionTick - 12) / (DRIVER_EXIT_TICKS - 12), 0, 1); }

  label(game) {
    if (this.phase === 'dismount') return 'STOP';
    if (this.phase === 'starting') return 'IGNITION';
    if (this.trick === 'brake') return 'BRAKE';
    if (this.trick === 'dash') return 'BOLT';
    return this.phase === 'motor' ? 'DRIVE' : this.phase === 'pulling' ? 'PULL' : ['WALK', 'TROT', 'GALLOP'][game.wagonStep - 1];
  }

  beginDrop(game) {
    this.dodging = !game.retaliation && game.landingStreak >= 2;
    this.trick = null;
  }

  finishDrop() { this.dodging = false; this.trick = null; }

  killHorse(game) {
    if (!this.horseAlive) return;
    this.deadHorse = { x: game.cartX + 88 };
    this.phase = 'dismount';
    this.transitionTick = 0;
    this.motion = 0;
  }

  killDriver(game) {
    if (!this.driverAlive) return;
    const position = this.driverPosition(game);
    this.deadDriver = { x: position.x, feet: position.feet, age: 0 };
    // A living horse breaks free; it is not killed by a hit on the driver.
    if (this.horseAlive) this.looseHorse = { x: game.cartX + 88, distance: 0 };
    this.driverAlive = false;
    this.phase = 'starting';
    this.engineTick = 0;
    this.motion = 0;
    this.finishDrop();
  }

  driverPosition(game) {
    const p = this.driverProgress;
    const travel = p * p * (3 - 2 * p);
    // Land beyond the fallen horse, rather than merging the driver's legs with
    // its silhouette. Ease out of the seat and into the first planted step.
    return { x: game.cartX + 76 + (DRIVER_PULL_OFFSET - 76) * travel,
      feet: game.deck + 32 + 12 * p - Math.sin(p * Math.PI) * 16 };
  }

  collisionAt(game, x) {
    const where = (x - game.cartX) / 2;
    if (where >= -6 && where < 34) return 'hay';
    if (!this.driverAlive) return 'ground';
    if (this.horseAlive) return where >= 34 && where < 45 ? 'driver' : where >= 45 && where <= 70 ? 'horse' : 'ground';
    const driver = this.driverPosition(game);
    return x >= driver.x - 16 && x <= driver.x + 8 ? 'driver' : 'ground';
  }

  evade(game) {
    const jumper = game.jumper;
    const offset = jumper.x - game.cartX;
    // Stop short of an incoming jumper, or hold the cart ahead of one already
    // behind it. Keep checking because clouds can change the landing position.
    if (offset < -20 || offset > 80) {
      this.trick = 'brake';
      return 0;
    }
    this.trick = 'dash';
    const ticksLeft = Math.max(1, Math.floor((game.deck - jumper.y - 32) / (game.gravity * 2)) + 2);
    // Move completely ahead of the falling man. At the right edge, clear the
    // screen and wrap instead. Very low drops need a sharper last-second bolt.
    const destination = jumper.x + 24;
    const distance = destination < game.width ? destination - game.cartX : game.width - game.cartX + 2;
    return Math.max(14, distance / ticksLeft);
  }

  tick(game) {
    if (game.retaliation) this.finishDrop();
    if (this.deadDriver) this.deadDriver.age++;
    if (this.looseHorse) {
      this.looseHorse.x += 9;
      this.looseHorse.distance += 9;
      if (this.looseHorse.x > game.width + 60) this.looseHorse = null;
    }
    this.exhaust = this.exhaust.filter(puff => ++puff.age < puff.life);
    for (const puff of this.exhaust) { puff.x -= puff.drift; puff.y -= .3; }
    if (game.boss.ownsCart) { this.motion = 0; return; }
    if (this.motorized) {
      this.engineTick++;
      const starting = this.phase === 'starting';
      const burst = starting && [18, 38, 60].includes(this.engineTick);
      if (burst || (!starting && this.engineTick % 8 === 0)) {
        const count = burst ? 5 : 1;
        for (let i = 0; i < count; i++) this.exhaust.push({
          x: game.cartX - 6 - i * 3, y: game.deck + 31 - i % 3 * 2,
          age: 0, life: burst ? 65 : 45, burst,
          drift: .6 + i * .2 + this.motion * .12, seed: this.exhaustCount++,
        });
      }
      if (starting) {
        this.motion = 0;
        if (this.engineTick >= ENGINE_START_TICKS) this.phase = 'motor';
        return;
      }
    }
    if (this.phase === 'dismount') {
      this.motion = 0;
      if (++this.transitionTick >= DRIVER_EXIT_TICKS) { this.phase = 'pulling'; this.pullDistance = 0; }
      return;
    }
    const normalSpeed = this.phase === 'motor' ? Math.min(4.4 + Math.min(2, game.level - 1) * .6, this.motion + .12)
      : this.horseAlive ? game.wagonStep * 2 : 1.2 + Math.min(2, game.level - 1) * .4;
    this.motion = this.dodging && game.state === 'falling' && game.jumper ? this.evade(game) : normalSpeed;
    game.cartX += this.motion;
    if (game.cartX >= game.width) game.cartX -= game.width + this.span;
    this.distance += this.motion;
    if (this.phase === 'pulling') this.pullDistance += this.motion;
  }
}
