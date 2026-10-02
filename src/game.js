import { CLOUD_SPANS } from './cloud-spans.js';
import { Combat } from './combat.js';
import { Carriage } from './carriage.js';
import { CloudLightning } from './lightning.js';
import { Counterattack, TERMINATOR_THRESHOLD } from './counterattack.js';
import { LiquidBoss } from './liquid-boss.js';
import { RooftopRun, ESCAPE_TIMINGS } from './runner.js';
import { AirAssault } from './air-assault.js';
import { DeckRaid } from './deck-raid.js';
import { OrbitDrop } from './orbit-drop.js';

export const WIDTH = 1024;
export const HEIGHT = 672;
export const SCALE = 2;
// The Pascal loop was CPU-dependent. The supplied recording averages about
// 50 source-pixel wagon steps/second; rendering remains display-rate independent.
export const HZ = 50;
// Velocity units are source pixels per simulation step. Keyboard input needs a
// perceptible ramp: 0.5 s to full horizontal speed and 0.4 s to coast to rest.
export const DEFAULT_ACCELERATION_TIME = 0.5;
export const FLIGHT_BRAKING = 10;
export const AUTO_DROP_TICKS = 22;
export const AUTO_RETRY_TICKS = 60;
export const FIRE_DEATH_TICKS = 36;
export const SEGMENTS = ['Stunt flight', 'Matrix uprising', 'Counterattack', 'Chrome carriage', 'Escape from the blast'];
export const CLOUD_SIZES = [[119, 44], [210, 45], [140, 73]];
// The sixth miss finishes the world. Only a SUBSEQUENT miss starts combat.
export const TRANSFORM_ORDER = ['cloud', 'carriage', 'copter', 'stuntman', 'instruments', 'world'];
const TRANSFORM_MESSAGES = [
  'Something is different about that cloud.',
  'The carriage has changed. Keep flying.',
  'That is definitely not the same helicopter.',
  'Even the stuntman looks different now.',
  'The instruments are picking up a new signal.',
  'The simulation is awake. Try not to miss again.',
];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function randomGenerator(seed) {
  let state = seed >>> 0;
  const random = () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  random.getState = () => state;
  random.setState = value => { state = value; };
  return random;
}

export class Game {
  constructor({ seed = Date.now(), best = 0, bestRun = 0, width = WIDTH, height = HEIGHT, accelerationTime = DEFAULT_ACCELERATION_TIME } = {}) {
    this.seed = seed;
    this.width = WIDTH;
    this.height = HEIGHT;
    this.deck = 490;
    this.copterX = 490;
    this.copterY = 80;
    this.cartX = 100;
    this.carriage = new Carriage();
    this.landingStreak = 0;
    this.cloudIndex = 0;
    this.cloudX = 670;
    this.cloudY = 212;
    this.cloudEnabled = true;
    this.random = randomGenerator(seed);
    this.lightning = new CloudLightning(randomGenerator(seed ^ 0x4c495447));
    this.jumper = null;
    this.score = this.catches = this.drops = this.misses = 0;
    this.best = best;
    this.level = 1;
    this.completedLoops = 0;
    this.retryTicks = this.retrySerial = 0;
    this.history = [];
    this.state = 'ready';
    this.outcome = null;
    this.effectTick = this.frame = this.time = this.accumulator = 0;
    this.paused = false;
    this.message = 'Aim for the hay. The horse is not a landing pad.';
    this.dropHeight = 0;
    this.controlX = this.controlY = this.dh = this.dv = 0;
    this.copterPitch = 0;
    this.setAccelerationTime(accelerationTime);
    this.shiftCount = 0;
    this.lastShift = null;
    this.shiftTick = -1000;
    this.retaliation = false;
    this.autoDropTicks = AUTO_DROP_TICKS;
    this.combat = new Combat();
    this.counterattack = new Counterattack();
    this.boss = new LiquidBoss();
    this.runner = new RooftopRun(seed ^ 0x52554e, bestRun);
    this.assault = new AirAssault(seed ^ 0x414952);
    this.boarding = new DeckRaid();
    this.orbit = new OrbitDrop(seed ^ 0x4f5242);
    this.resize(width, height);
    this.saveCheckpoint(0);
  }

  get hudScale() { return Math.min(1, this.width / WIDTH); }
  get hudY() { return this.height - 122 * this.hudScale; }
  get fullyThemed() { return this.shiftCount === TRANSFORM_ORDER.length; }
  get canFly() { return !['crashing', 'exploding', 'game_over'].includes(this.state); }
  get awaitingRetry() {
    return this.state === 'game_over' || (this.orbit.active ? this.orbit.dead : this.boarding.active ? this.boarding.dead
      : this.assault.active ? this.assault.dead : this.runner.active && this.runner.dead);
  }
  get inCinematic() { return this.orbit.active ? this.orbit.cinematic : this.boarding.active ? !this.boarding.playing && !this.boarding.dead : this.assault.active ? !this.assault.playing && !this.assault.dead : this.counterattack.phase === 'cinematic' || this.runner.active && !this.runner.flying && !this.runner.running && !this.runner.dead; }
  get canDrop() { return !this.paused && this.state === 'ready' && (this.orbit.active ? this.orbit.canAct : this.boarding.active ? this.boarding.playing : this.assault.active ? false : this.runner.active ? this.runner.running : this.counterattack.phase === 'dormant' || this.boss.canGrenade); }
  get autoDeploy() { return this.fullyThemed && this.counterattack.phase === 'dormant' && this.counterattack.created < TERMINATOR_THRESHOLD && !this.boss.ownsCart && !this.runner.active; }
  get flightAcceleration() { return 4 / this.accelerationTime; }
  get hangingPosition() {
    const angle = this.isThemed('copter') ? this.copterPitch : 0;
    return { x: this.copterX - 20 * Math.sin(angle), y: this.copterY + 26 + 20 * Math.cos(angle) };
  }
  get heightOfDrop() { return Math.max(0, Math.trunc((this.deck + 44 - this.copterY - 52) / SCALE)); }
  get wagonStep() { return Math.min(3, this.level); }
  get wagonLabel() { return this.boss.label ?? this.carriage.label(this); }
  get gravity() { return Math.max(1, 4 - Math.max(0, this.level - 3)); }
  get cloudRect() {
    const [w, h] = CLOUD_SIZES[this.cloudIndex];
    return [this.cloudX, this.cloudY, w * SCALE, h * SCALE];
  }
  isThemed(asset) {
    const index = TRANSFORM_ORDER.indexOf(asset);
    return index >= 0 && index < this.shiftCount;
  }
  reset() { return new Game({ best: this.best, bestRun: this.runner.best, width: this.width, height: this.height, accelerationTime: this.accelerationTime }); }
  completeLoop(next=this.reset()) {
    const remainingTime=this.accumulator;
    next.completedLoops=this.completedLoops+1;
    next.message='Here we go again. Aim for the hay.';
    // This reset happens inside step()'s fixed-tick loop. Keep the unconsumed
    // part of the current display frame; discarding it causes a handoff stall.
    Object.assign(this,next);this.accumulator=remainingTime;this.saveCheckpoint(0);
  }

  saveCheckpoint(segment) {
    // These snapshots contain simulation data only. Class instances are restored
    // onto fresh instances; functions and the previous checkpoint stay outside.
    const snapshot = JSON.parse(JSON.stringify(this, (key, value) =>
      ['checkpoint', 'runner', 'lightning', 'assault', 'boarding', 'orbit'].includes(key) ? undefined : value));
    this.checkpoint = { segment, label: SEGMENTS[segment], randomState: this.random.getState(), snapshot };
  }
  rememberSegment() {
    if (!this.canFly || this.runner.active) return;
    const segment = this.boss.fighting ? 3 : this.counterattack.armed ? 2 : this.fullyThemed ? 1 : 0;
    if (segment > this.checkpoint.segment) this.saveCheckpoint(segment);
  }
  continueSegment() {
    if (this.orbit.dead) { this.orbit.retry(this); return this; }
    if (this.boarding.dead) { this.boarding.retry(this); return this; }
    if (this.assault.dead) { this.assault.retry(this); return this; }
    if (this.runner.dead) { this.runner.retry(this); return this; }
    const resumed = new Game({ seed: this.seed, bestRun: this.runner.best });
    const snapshot = structuredClone(this.checkpoint.snapshot);
    for (const [key, value] of Object.entries(snapshot)) {
      if (['carriage', 'combat', 'counterattack', 'boss'].includes(key)) Object.assign(resumed[key], value);
      else resumed[key] = value;
    }
    resumed.checkpoint = this.checkpoint;
    resumed.random.setState(this.checkpoint.randomState);
    resumed.best = this.best;
    resumed.completedLoops = this.completedLoops; resumed.retrySerial = this.retrySerial; resumed.retryTicks = 0;
    resumed.setAccelerationTime(this.accelerationTime);
    resumed.paused = false; resumed.accumulator = 0;
    resumed.releaseControls();
    Object.assign(resumed.combat, { hits: 0, hurtTicks: 100, crashTick: 0, explosionTick: 0, angle: 0, bullets: [], smoke: [] });
    for (const shooter of resumed.combat.shooters) shooter.cooldown = Math.max(60, shooter.cooldown);
    resumed.counterattack.protectionTicks = 100;
    resumed.counterattack.bullets = [];
    resumed.boss.rockets = []; resumed.boss.grenades = [];
    resumed.resize(this.width, this.height);
    resumed.copterX = clamp(resumed.copterX, 72, resumed.width - 76);
    resumed.message = `${this.checkpoint.label}. Back in action. ${resumed.boss.fighting ? 'SPACE drops grenades. Five hits!' : resumed.counterattack.armed ? 'Auto-fire is on. Keep moving!' : resumed.autoDeploy ? 'They will keep jumping. Keep flying!' : 'Aim for the hay.'}`;
    if (this.checkpoint.segment === 4) resumed.message = 'SELF DESTRUCT. Hold RIGHT to escape to the rooftops!';
    return resumed;
  }

  setAccelerationTime(seconds) {
    this.accelerationTime = clamp(Number.isFinite(seconds) ? seconds : DEFAULT_ACCELERATION_TIME, 0.2, 1.5);
  }

  resize(width, height) {
    if (width === this.width && height === this.height) return;
    const oldWidth = this.width, oldDeck = this.deck;
    this.width = width; this.height = height;
    this.deck = this.hudY - 60;
    const sx = width / oldWidth, sy = this.deck / oldDeck;
    this.copterX *= sx;
    this.copterY = this.canFly ? clamp(this.copterY * sy, -8, this.deck - 72) : this.copterY * sy;
    const cartSpan = this.carriage.span;
    this.cartX = (this.cartX + cartSpan) / (oldWidth + cartSpan) * (width + cartSpan) - cartSpan;
    if (this.carriage.deadHorse) this.carriage.deadHorse.x *= sx;
    if (this.carriage.deadDriver) {
      this.carriage.deadDriver.x *= sx;
      this.carriage.deadDriver.feet += this.deck - oldDeck;
    }
    if (this.carriage.looseHorse) this.carriage.looseHorse.x *= sx;
    for (const puff of this.carriage.exhaust) { puff.x *= sx; puff.y += this.deck - oldDeck; }
    this.cloudX *= sx; this.cloudY *= sy;
    if (this.jumper) {
      this.jumper.x *= sx;
      this.jumper.y = this.state === 'result' ? this.deck + (this.outcome === 'ground' ? 12 : -14) : this.jumper.y * sy;
    }
    for (const shooter of this.combat.shooters) shooter.x = clamp(shooter.x * sx, 16, width - 16);
    for (const item of [...this.combat.bullets, ...this.combat.smoke]) { item.x *= sx; item.y *= sy; }
    for (const bullet of this.combat.bullets) {
      const speed = Math.hypot(bullet.vx, bullet.vy);
      const length = Math.hypot(bullet.vx * sx, bullet.vy * sy);
      bullet.vx *= sx * speed / length; bullet.vy *= sy * speed / length;
    }
    this.combat.crashStart = [this.combat.crashStart[0] * sx, this.combat.crashStart[1] * sy];
    this.counterattack.resize(sx, sy, this.deck - oldDeck);
    this.boss.resize(this, sx, sy, this.deck - oldDeck);
    this.runner.resize(this);
    this.orbit.resizeReturn(width,height);
    this.assault.resize(this);
    this.boarding.resize(this);
  }

  releaseControls() { this.controlX = this.controlY = this.dh = this.dv = 0; this.runner?.clearInput(); this.boarding?.clearInput(); this.orbit?.clearInput(); }
  setFlightCommand(horizontal, vertical) {
    if (!this.canFly || this.paused || this.inCinematic) return this.releaseControls();
    this.controlX = clamp(Math.trunc(horizontal), -4, 4);
    this.controlY = clamp(Math.trunc(vertical), -3, 4);
  }
  setYoke(x, y) {
    this.setFlightCommand(Math.round(x * 4), Math.round(y * (y < 0 ? 3 : 4)));
  }
  moveCopter(x, y) {
    if (!this.canFly || this.paused || this.inCinematic) return;
    this.copterX = clamp(x, 72, this.width - 76);
    this.copterY = clamp(y, -8, this.deck - 72);
    this.dh = this.dv = 0;
  }
  drop() {
    if (!this.canDrop) return false;
    if (this.orbit.active) return this.orbit.pressAction();
    if (this.boarding.active) return this.boarding.pressJump();
    if (this.assault.active) return false;
    if (this.runner.active) return this.runner.pressJump();
    if (this.counterattack.armed) return this.boss.dropGrenade(this);
    this.jumper = { ...this.hangingPosition, inCloud: false, burning: false };
    this.autoDropTicks = AUTO_DROP_TICKS;
    this.dropHeight = this.heightOfDrop;
    this.drops++;
    this.state = 'falling';
    this.carriage.beginDrop(this);
    if (this.carriage.dodging) this.message = 'The driver has other plans.';
    return true;
  }
  step(dt) {
    if (this.paused) return;
    this.accumulator += clamp(dt, 0, 0.1);
    while (this.accumulator + 1e-9 >= 1 / HZ) {
      this.accumulator -= 1 / HZ;
      this.tick();
      this.stepAutoRetry();
    }
  }
  stepAutoRetry() {
    if (!this.awaitingRetry) { this.retryTicks = 0; return; }
    this.releaseControls();
    if (++this.retryTicks < AUTO_RETRY_TICKS) return;
    const accumulator = this.accumulator, serial = this.retrySerial + 1;
    const resumed = this.continueSegment();
    if (resumed !== this) Object.assign(this, resumed);
    // Preserve unconsumed simulation time when a checkpoint replaces the world.
    this.accumulator = accumulator; this.retrySerial = serial; this.retryTicks = 0;
    this.releaseControls();
  }
  tick() {
    if (this.state === 'game_over') return;
    if (!this.orbit.active && this.boarding.phase === 'cleared' && this.boarding.collapse) this.orbit.begin(this);
    if (this.orbit.active) { this.frame++; this.time = this.frame / HZ; this.orbit.tick(this); return; }
    if (this.boarding.active) { this.frame++; this.time = this.frame / HZ; this.boarding.tick(this); return; }
    if (!this.assault.active && this.runner.phase === 'escaped' && this.runner.age >= 20) this.assault.begin(this);
    if (this.assault.active) { this.frame++; this.time = this.frame / HZ; this.assault.tick(this); return; }
    if (!this.runner.active && this.boss.phase === 'won' && this.boss.age >= ESCAPE_TIMINGS.aftermath) {
      if (this.checkpoint.segment < 4) this.saveCheckpoint(4);
      this.runner.begin(this);
    }
    if (this.runner.active) { this.frame++; this.time = this.frame / HZ; this.runner.tick(this); return; }
    if (this.counterattack.beforeWorldTick(this)) { this.rememberSegment(); return; }
    this.frame++;
    this.time = this.frame / HZ;
    if (['crashing', 'exploding'].includes(this.state)) {
      this.lightning.tick(this);
      this.counterattack.tick(this);
      this.combat.tick(this);
      return;
    }
    const previousDh = this.dh;
    const accelerate = (velocity, target) => {
      const step = (target === 0 ? FLIGHT_BRAKING : this.flightAcceleration) / HZ;
      const difference = target - velocity;
      return Math.abs(difference) <= step + 1e-9 ? target : velocity + Math.sign(difference) * step;
    };
    this.dh = accelerate(this.dh, this.controlX);
    this.dv = accelerate(this.dv, this.controlY);
    if (this.isThemed('copter')) {
      const acceleration = (this.dh - previousDh) * HZ / this.flightAcceleration;
      const climb = this.dv / (this.dv < 0 ? 3 : 4);
      const pitch = clamp(acceleration * 0.20 + climb * 0.09, -0.30, 0.30);
      this.copterPitch += (pitch - this.copterPitch) * (1 - Math.exp(-1 / (HZ * 0.12)));
      if (Math.abs(this.copterPitch) < 1e-5) this.copterPitch = 0;
    } else this.copterPitch = 0;
    this.copterX += this.dh * SCALE;
    this.copterY = clamp(this.copterY + this.dv * SCALE, -8, this.deck - 72);
    // Pascal uses the 74×26 copter rectangle, with its left edge at x - 36.
    if (['dying', 'won'].includes(this.boss.phase)) this.copterX = clamp(this.copterX, 72, this.width - 76);
    else if (this.copterX - 72 > this.width - 4) this.copterX = -76;
    else if (this.copterX - 72 < -152) this.copterX = this.width + 68;
    this.carriage.tick(this);
    if (this.frame % 3 === 0) {
      this.cloudX -= SCALE;
      if (this.cloudX + this.cloudRect[2] < 0) {
        this.cloudIndex = (this.cloudIndex + 1) % 3;
        this.cloudX = this.width;
        this.cloudY = Math.floor(this.random() * Math.min(256, this.deck - 150));
      }
    }
    if (this.state === 'falling') {
      const j = this.jumper;
      if (j.y + 32 > this.deck) this.land();
      else {
        j.inCloud = this.cloudEnabled && this.inCloud(j.x, j.y);
        if (j.inCloud && this.isThemed('cloud') && !j.burning) {
          j.burning = true;
          this.message = 'That cloud is NOT a safety feature.';
        }
        if (j.inCloud) {
          j.x += Math.trunc((Math.floor(this.random() * 65536) - 32768) / 10924) * SCALE;
          j.y += SCALE;
        } else j.y += this.gravity * SCALE;
      }
    } else if (this.state === 'result') {
      this.effectTick++;
      if (this.effectTick >= (this.outcome === 'hay' ? 45 : this.outcome === 'fire' ? FIRE_DEATH_TICKS : 12)) this.nextAttempt();
    }
    if (this.autoDeploy && this.canDrop && --this.autoDropTicks <= 0) this.drop();
    this.boss.tick(this);
    this.counterattack.tick(this);
    if (this.retaliation) this.combat.tick(this);
    this.lightning.tick(this);
    this.rememberSegment();
  }
  inCloud(x, y) {
    if (x < this.cloudX || y < this.cloudY) return false;
    const lx = Math.trunc((x - this.cloudX) / SCALE);
    const ly = Math.trunc((y - this.cloudY) / SCALE);
    return (CLOUD_SPANS[this.cloudIndex][ly] ?? []).some(([left, right]) => left <= lx && lx <= right);
  }
  land() {
    this.outcome = this.carriage.collisionAt(this, this.jumper.x);
    const ignitesHay = this.outcome === 'hay' && !this.carriage.hayBurning && this.jumper.burning;
    if (this.outcome === 'hay' && this.carriage.hayBurning) {
      this.outcome = 'fire';
      this.jumper.burning = true;
      this.jumper.cartOffset = clamp(this.jumper.x - this.cartX, 0, 40);
    } else if (ignitesHay) this.carriage.hayBurning = true;
    const success = this.outcome === 'hay';
    const dodged = this.carriage.dodging;
    this.landingStreak = success ? this.landingStreak + 1 : 0;
    this.carriage.finishDrop();
    this.history.push(success);
    this.effectTick = 0;
    this.state = 'result';
    if (success) {
      const points = this.level * this.dropHeight;
      this.score += points;
      this.best = Math.max(this.best, this.score);
      this.catches++;
      this.message = `Safe landing! ${this.dropHeight} × level ${this.level} = ${points} points.`;
      if (ignitesHay) this.message = 'Safe landing. Unsafe hay. The next guy is going to hate this.';
      else if (this.landingStreak === 2 && !this.retaliation) this.message += ' The driver is watching you.';
    } else {
      this.misses++;
      if (this.outcome === 'fire') {
        this.message = 'Congratulations. You invented the human barbecue.';
      } else if (this.outcome === 'horse') {
        this.carriage.killHorse(this);
        this.message = 'You hit the horse! The driver is taking over.';
      } else if (this.outcome === 'driver') {
        this.carriage.killDriver(this);
        this.message = 'The driver is down. Wait… that cart has an engine?';
      } else this.message = dodged ? 'The carriage dodged him!' : this.fullyThemed ? 'He has had enough.' : 'That did not go as planned…';
    }
    this.jumper.y = this.deck + (this.outcome === 'ground' ? 12 : -14);
  }
  nextAttempt() {
    if (this.outcome !== 'hay') {
      // Resolve after the splat so the current death retains its current art.
      if (!this.fullyThemed) {
        this.lastShift = TRANSFORM_ORDER[this.shiftCount];
        this.message = TRANSFORM_MESSAGES[this.shiftCount];
        this.shiftCount++;
        this.shiftTick = this.frame;
        if (this.fullyThemed) this.message = 'The simulation is awake. They are jumping on their own. Keep flying!';
      } else {
        this.retaliation = true;
        this.message = 'He is getting back up. Keep moving!';
        this.combat.miss(this, this.outcome === 'fire' ? this.cartX + this.jumper.cartOffset : this.jumper.x);
      }
    }
    this.jumper = null;
    if (this.history.length === 5) {
      if (this.history.every(Boolean)) {
        this.level++;
        this.message = `Five perfect landings. Welcome to level ${this.level}!`;
      }
      // Failed rounds repeat, preserving transformation and all attackers.
      this.history = [];
    }
    this.state = 'ready';
    this.autoDropTicks = AUTO_DROP_TICKS;
  }
}
