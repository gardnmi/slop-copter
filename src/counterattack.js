import { crossesRect } from './combat.js';

export const TERMINATOR_THRESHOLD = 8;
export const COUNTERATTACK_WAIT_TICKS = 150;
export const CINEMATIC_TICKS = 230;
export const GUN_INTERVAL = 5;
export const GUN_SPEED = 18;
export const GUN_X = .55;
export const GUN_Y = Math.sqrt(1 - GUN_X ** 2);

// The renderer and projectile simulation share this exact barrel geometry.
export function gunnerWeapon(game) {
  const { x, y } = game.hangingPosition, facing = game.counterattack.facing;
  const shoulder = { x: x + 14 + facing * 4, y: y + 15 };
  return { shoulder, x: shoulder.x + facing * GUN_X * 18, y: shoulder.y + GUN_Y * 18,
    vx: facing * GUN_X * GUN_SPEED, vy: GUN_Y * GUN_SPEED };
}

export class Counterattack {
  constructor() {
    this.phase = 'dormant';
    this.created = this.waitTicks = this.cinemaTick = this.kills = 0;
    this.cooldown = this.flash = 0;
    this.protectionTicks = 0;
    this.facing = 1;
    this.bullets = [];
    this.wrecks = [];
    this.sparks = [];
  }
  get armed() { return this.phase === 'active' || this.phase === 'cleared'; }
  registerTerminator(game) {
    this.created++;
    if (this.created !== TERMINATOR_THRESHOLD || this.phase !== 'dormant') return;
    this.phase = 'waiting';
    this.waitTicks = COUNTERATTACK_WAIT_TICKS;
    game.message = 'Eight of them. The man on the skid has gone very quiet.';
  }
  // Runs before the world tick. The cutscene advances on simulation time while
  // every world entity, projectile, and damage timer stays frozen.
  beforeWorldTick(game) {
    if (!game.canFly) return false;
    if (this.phase === 'waiting' && --this.waitTicks === 0) {
      this.phase = 'cinematic';
      game.releaseControls();
      game.message = 'Enough. His turn.';
      return true;
    }
    if (this.phase !== 'cinematic') return false;
    if (++this.cinemaTick >= CINEMATIC_TICKS) {
      this.phase = 'active';
      this.protectionTicks = 50;
      game.message = 'YOUR TURN. Auto-fire is on. Fly over the machines and sweep the ground.';
    }
    return true;
  }
  tick(game) {
    this.protectionTicks = Math.max(0, this.protectionTicks - 1);
    this.flash = Math.max(0, this.flash - 1);
    for (const wreck of this.wrecks) wreck.age++;
    for (const spark of this.sparks) {
      spark.x += spark.vx; spark.y += spark.vy; spark.vy += .14; spark.age++;
    }
    this.sparks = this.sparks.filter(spark => spark.age < 24);
    if (!this.armed || !game.canFly) return;
    if (game.controlX) this.facing = Math.sign(game.controlX);
    else if (Math.abs(game.dh) > .2) this.facing = Math.sign(game.dh);
    if (this.phase === 'active' && --this.cooldown <= 0) {
      const { x, y, vx, vy } = gunnerWeapon(game);
      this.bullets.push({ x, y, vx, vy, age: 0 });
      this.cooldown = GUN_INTERVAL; this.flash = 2;
    }
    const remaining = [];
    for (const bullet of this.bullets) {
      const oldX = bullet.x, oldY = bullet.y;
      bullet.x += bullet.vx; bullet.y += bullet.vy; bullet.age++;
      const victim = game.combat.shooters.find(s => crossesRect(oldX, oldY, bullet.x, bullet.y,
        [s.x - 10, game.deck + 12, 20, 32]));
      if (victim) {
        this.hit(game, victim, bullet);
        continue;
      }
      if (bullet.age < 160 && bullet.y < game.deck + 44 && bullet.x > -16 && bullet.x < game.width + 16) remaining.push(bullet);
    }
    this.bullets = remaining;
    if (this.phase === 'active' && this.kills >= TERMINATOR_THRESHOLD && !game.combat.shooters.length) {
      this.phase = 'cleared';
      game.combat.bullets = [];
      game.boss.begin(game);
    }
  }
  hit(game, victim, bullet) {
    victim.health = (victim.health ?? 2) - 1;
    victim.hitFlash = 5;
    const dead = victim.health <= 0;
    for (let i = 0; i < (dead ? 12 : 5); i++) {
      const angle = i * 2.39996, speed = dead ? 1.5 + i % 4 : 1.2;
      this.sparks.push({ x: victim.x, y: game.deck + 26, vx: Math.cos(angle) * speed + bullet.vx * .05,
        vy: Math.sin(angle) * speed - 1.6, age: 0 });
    }
    if (!dead) return;
    game.combat.shooters.splice(game.combat.shooters.indexOf(victim), 1);
    this.wrecks.push({ x: victim.x, age: 0, facing: this.facing });
    this.kills++;
    game.score += 250; game.best = Math.max(game.best, game.score);
  }
  resize(sx, sy, deckChange) {
    for (const bullet of this.bullets) { bullet.x *= sx; bullet.y *= sy; }
    for (const item of [...this.wrecks, ...this.sparks]) {
      item.x *= sx;
      if ('y' in item) item.y += deckChange;
    }
  }
}
