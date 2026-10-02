// Original carrier run-and-gun. Reference findings are in docs/deck-raid.md.
// World coordinates stay fixed on resize; all action runs on the 50 Hz clock.
import { sweptHit } from './air-assault.js';
import { markHit, tickHit } from './hit-flash.js';
import { startSpacecraft, tickSpacecraft, hitsSpacecraft, damageSpacecraft, SPACECRAFT_TRIGGER, SPACECRAFT_ARENA } from './deck-boss.js';
import { createDeckPlatforms, landingSurface, surfaceBelow, insideSolid } from './deck-layout.js';
import { liftFloor, LIFT_CENTER } from './deck-elevator.js';
import { tickLiftCollapse } from './deck-collapse.js';
import { commandoPose, weaponMuzzle } from './deck-pose.js';
import { tickDeckHelicopter, hitsDeckHelicopter, damageDeckHelicopter } from './deck-helicopter.js';
import { deployParatroopers, tickParatrooper, releaseParachute, tickChutes } from './deck-paratroopers.js';
import { equipWeapon, fireDeckWeapon, tickDeckShots } from './deck-weapons.js';
export const DECK_LENGTH = 4020;
export const DECK_FLOOR = 260;
export const DECK_RUN_SPEED = 150;
export const DECK_JUMP_SPEED = 340;
const DT = 1 / 50;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const DECK_SECTIONS = ['AFT DECK', 'CARGO BAY', 'HANGAR CATWALKS'];
export class DeckRaid {
  constructor() {
    this.phase = 'dormant'; this.age = this.time = 0; this.x = 100; this.y = DECK_FLOOR;
    this.vx = this.vy = 0; this.facing = 1; this.grounded = true; this.crouching = false;
    this.aimUp = false; this.jumpHeld = this.fireHeld = false; this.fireBuffer = this.jumpBuffer = this.coyote = 0;
    this.health = 5; this.hurt = 80; this.weapon = 'pistol'; this.ammo = 0; this.shotClock = this.flash = this.slash = 0;
    this.width = 640; this.height = 320; this.cameraX = 0; this.section = 0; this.checkpoint = null;
    this.enemies = []; this.shots = []; this.bullets = []; this.particles = []; this.pickups = []; this.props = [];
    this.kills = this.stride = this.grenadeClock = this.throwFlash = 0;
    this.grenades = 10; this.thrown = []; this.explosions = []; this.impacts = []; this.shake = 0; this.boss = null;
    this.cue = { id: 0, name: '' };
    this.audioSerial = 0; this.audioEvents = [];
    this.platforms = createDeckPlatforms(); this.cameraFloor = DECK_FLOOR; this.dropThrough = 0;
    this.paraWaves = []; this.chutes = []; this.miniboss = null; this.missionTicks = 0;
  }
  get active() { return this.phase !== 'dormant'; }
  get playing() { return this.phase === 'raid'; }
  get dead() { return this.phase === 'dead'; }
  get label() { return this.phase === 'cleared' ? 'WARDEN DOWN' : this.boss?.form === 'elevator' ? 'THE WARDEN / PHASE 2' : this.lift ? 'AIRCRAFT ELEVATOR' : this.boss ? 'HOSTILE SPACECRAFT' : this.miniboss && !this.miniboss.dead ? 'R-SHOBU' : DECK_SECTIONS[this.section]; }
  get cameraY() { return this.cameraFloor - this.height * .73; }
  emitAudio(kind, x = this.x) {
    this.audioEvents.push({ id: ++this.audioSerial, kind, x, time: this.time });
    if (this.audioEvents.length > 64) this.audioEvents.shift();
  }
  sound(name, x = this.x, effect = name) {
    this.cue = { id: this.cue.id + 1, name };
    if (effect) this.emitAudio(effect, x);
  }
  begin(game) {
    if (this.active) return;
    this.phase = 'raid'; this.resize(game);
    this.props = [
      [390, 30, 28, 'crate'], [650, 90, 30, 'cargo'], [960, 18, 25, 'barrel'], [1030, 18, 25, 'barrel'],
      [1350, 30, 28, 'crate'], [1510, 90, 34, 'cargo'], [1840, 18, 25, 'barrel'], [1910, 18, 25, 'barrel'],
      [2540, 30, 28, 'crate'], [2880, 18, 25, 'barrel'], [3110, 18, 25, 'barrel'],
    ].map(([x, w, h, type]) => ({ x, y: surfaceBelow(this.platforms, x + w / 2).y - h, w, h, type, hp: type === 'cargo' ? Infinity : type === 'barrel' ? 2 : 4, dead: false }));
    this.enemies = [
      [450, 'soldier', 260], [770, 'grenadier', 216], [980, 'soldier', 260], [1030, 'soldier', 260],
      [1430, 'soldier', 324], [1550, 'soldier', 324], [1680, 'grenadier', 174], [1890, 'soldier', 174], [1990, 'turret', 278], [2230, 'soldier', 260],
      [2440, 'soldier', 308], [2600, 'grenadier', 206], [2750, 'soldier', 160], [2915, 'grenadier', 204],
    ].map(([x, type, y], i) => ({ x, originX: x, y, type, hp: type === 'turret' ? 24 : 3,
      maxHp: type === 'turret' ? 24 : 3, age: 0, hit: 0, state: 'patrol', clock: 8 + i % 3 * 7, facing: -1, flash: 0, aim: 0, dead: false }));
    // Three authored weapon beats. The early H stocks the helicopter; the
    // last crate supplies the two-phase finale; no random weapons or arena refill pickups.
    this.pickups = [[270, 260, 'heavy', 200], [1940, 278, 'flame', 30], [3145, 248, 'heavy', 600],
      [1230, 260, 'medkit'], [2360, 250, 'medkit']]
      .map(([x, y, type, ammo]) => ({ x, y: y - 17, type, ammo }));
    this.save(game); game.releaseControls(); this.sound('raid');
    game.message = 'BOARDING PARTY! Reach the spacecraft. ARROWS / WASD move · J shoot · K jump · L grenade · ↓ duck · ↑ aim up.';
  }
  resize(game) {
    const ratio = game.width / game.height;
    this.baseWidth = clamp(ratio * 320, 320, 800);
    this.width = this.boss ? Math.max(600, this.baseWidth, ratio * 320) : this.baseWidth; this.height = this.width / ratio;
    this.cameraX = this.boss ? LIFT_CENTER - this.width / 2 : clamp(this.x - this.width * .32, 0, DECK_LENGTH - this.width);
  }
  clearInput() { this.jumpHeld = this.fireHeld = false; this.fireBuffer = this.jumpBuffer = 0; this.crouching = false; this.aimUp = false; }
  setFire(held) { this.fireHeld = this.playing && Boolean(held); }
  queueShot() { if (this.playing) this.fireBuffer = 7; }
  throwGrenade() {
    if (!this.playing || !this.grenades || this.grenadeClock) return false;
    this.grenades--; this.grenadeClock = 18; this.throwFlash = 12;
    this.thrown.push({ x: this.x + this.facing * 15, y: this.y - (this.crouching ? 15 : 28),
      vx: this.facing * 210 + this.vx * .2, vy: this.crouching ? -135 : -240, age: 0, bounced: false });
    this.sound('grenade'); return true;
  }
  explodeGrenade(game, grenade) {
    if (grenade.dead) return;
    grenade.dead = true; this.burst(grenade.x, grenade.y - 8, 1.7, 'grenade-explosion');
    for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - grenade.x, e.y - 18 - grenade.y) < 76) this.hitEnemy(game, e, 12);
    for (const p of this.props) if (!p.dead && Math.hypot(p.x + p.w / 2 - grenade.x, p.y + p.h / 2 - grenade.y) < 76) this.hitProp(game, p, 12);
    if (hitsDeckHelicopter(this.miniboss, grenade.x, grenade.y, grenade.x, grenade.y, 60)) damageDeckHelicopter(this, game, 18, grenade.x, grenade.y);
    if (hitsSpacecraft(this.boss, grenade.x, grenade.y, grenade.x, grenade.y, 60)) damageSpacecraft(this, game, 18, grenade.x, grenade.y);
  }
  pressJump() {
    if (!this.playing || this.jumpHeld) return false;
    if (this.crouching && this.grounded && this.platforms.some(p => !p.solid && this.x > p.x && this.x < p.x + p.w && Math.abs(this.y - p.y) < 1)) {
      this.jumpHeld = true; this.jumpBuffer = this.coyote = 0; this.dropThrough = 10;
      this.y += 2; this.vy = 45; this.grounded = false; return true;
    }
    this.jumpHeld = true; this.jumpBuffer = 6; return true;
  }
  releaseJump() { this.jumpHeld = false; if (this.vy < -150) this.vy = -150; }
  save(game) {
    // Infinity on indestructible cargo is restored after JSON snapshots.
    const data = JSON.parse(JSON.stringify(this, (key, value) => key === 'checkpoint' ? undefined : value));
    this.checkpoint = { data, score: game.score, label: this.label };
  }
  retry(game) {
    if (!this.dead || this.age < 30) return false;
    const cp = this.checkpoint, next = new DeckRaid(); Object.assign(next, structuredClone(cp.data));
    next.checkpoint = cp; next.health = 5; next.hurt = 100; next.shots = []; next.bullets = []; next.particles = []; next.explosions = []; next.thrown = []; next.impacts = []; next.shake = 0;
    next.vx = next.vy = 0; next.clearInput();
    for (const p of next.props) if (p.type === 'cargo') p.hp = Infinity;
    game.boarding = next; next.resize(game); game.score = cp.score; game.releaseControls();
    game.message = next.boss?.form === 'elevator' ? 'THE WARDEN. Hold ↑ + J to shoot its belly; move out of the warnings.' : `${cp.label}. Get to the spacecraft!`;
    next.sound('continue'); return true;
  }
  score(game, amount) { game.score += amount; game.best = Math.max(game.best, game.score); }
  beginBoss(game) { startSpacecraft(this, game); }
  impact(x, y, facing = 1, kind = 'spark', size = .45) {
    this.impacts.push({ x, y, age: 0, facing, kind, size });
    if (this.impacts.length > 32) this.impacts.shift();
    this.emitAudio('impact', x);
  }
  burst(x, y, size = 1, sound = size >= 2.4 ? 'heavy-explosion' : 'explosion') {
    this.emitAudio(sound, x);
    this.explosions.push({ x, y, age: 0, size }); this.explosions = this.explosions.slice(-12);
    this.shake = Math.max(this.shake, Math.min(2.5, size));
    for (let i = 0; i < 8 * size; i++) this.particles.push({ x, y, vx: Math.sin(i * 7.3) * 55 * size,
      vy: -40 - (i % 7) * 15, age: 0, life: 24 + i % 17, size: 1 + i % 3, kind: 'debris', spin: i });
    if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
  }
  hurtPlayer(game, damage = 1) {
    if (this.hurt || !this.playing) return;
    this.health = Math.max(0, this.health - damage); this.hurt = 75;
    this.sound('hit', this.x, this.health ? 'hit' : 'player-death');
    if (this.health <= 0) { this.phase = 'dead'; this.age = 0; this.vx = this.flash = this.slash = 0; game.releaseControls(); game.message = 'MAN DOWN. Restarting this checkpoint…'; }
  }
  hitEnemy(game, enemy, damage, weapon) {
    if (enemy.dead) return;
    enemy.hp -= damage; markHit(enemy);
    if (enemy.hp > 0) return;
    enemy.dead = true; enemy.deathAge = 0; enemy.burning = weapon === 'flame' && enemy.type !== 'turret'; this.kills++;
    releaseParachute(this, enemy, true);
    this.score(game, enemy.type === 'turret' ? 500 : 100);
    this.sound('destroy', enemy.x, enemy.type === 'turret' ? null : 'rebel-death');
    if (enemy.type === 'turret') this.burst(enemy.x, enemy.y - 17, 1.4);
  }
  hitProp(game, prop, damage) {
    if (prop.dead || prop.type === 'cargo') return;
    prop.hp -= damage; if (prop.hp > 0) return;
    prop.dead = true; this.burst(prop.x + prop.w / 2, prop.y + 12, prop.type === 'barrel' ? 2 : 1);
    if (prop.type === 'barrel') {
      for (const e of this.enemies) if (Math.hypot(e.x - prop.x, e.y - prop.y - prop.h) < 100) this.hitEnemy(game, e, 12);
      for (const p of this.props) if (!p.dead && p.type === 'barrel' && Math.hypot(p.x - prop.x, p.y - prop.y) < 95) this.hitProp(game, p, 3);
    }
  }
  enemyFire(e) {
    const lob = e.type === 'grenadier', armor = e.type === 'turret';
    const speed = e.paratrooper ? 115 : 160;
    this.bullets.push({ x: e.x + e.facing * (armor ? 40 : 22), y: e.y - (armor ? 34 : 24), vx: lob ? clamp((this.x - e.x) * 1.05, -190, 190) : Math.cos(e.aim) * speed,
      vy: lob ? -250 : Math.sin(e.aim) * speed, age: 0, lob, dead: false, kind: e.paratrooper ? 'pararocket' : undefined });
    e.flash = 5;
    this.emitAudio(lob ? 'grenade' : e.paratrooper || armor ? 'boss-shot' : 'enemy-shot', e.x);
  }
  tick(game) {
    this.age++; this.time += DT;
    this.shake *= .82;
    tickChutes(this);
    for (const p of this.impacts) p.age++;
    this.impacts = this.impacts.filter(p => p.age < (p.kind === 'armor' ? 14 : 9));
    for (const p of this.particles) { p.age++; p.x += p.vx * DT; p.y += p.vy * DT; p.vy += 180 * DT; }
    this.particles = this.particles.filter(p => p.age < p.life);
    for (const e of this.explosions) e.age++;
    this.explosions = this.explosions.filter(e => e.age < 42);
    if (this.collapse) { tickLiftCollapse(this); return; }
    if (!this.playing) return;
    this.missionTicks++;
    tickDeckHelicopter(this, game);
    if (this.boss) {
      this.width += (Math.max(600, this.baseWidth, game.width / game.height * 320) - this.width) * .06;
      this.height = this.width * game.height / game.width;
      tickSpacecraft(this, game);
      if (!this.playing) return;
    }
    this.hurt = Math.max(0, this.hurt - 1); this.flash = Math.max(0, this.flash - 1); this.slash = Math.max(0, this.slash - 1);
    this.grenadeClock = Math.max(0, this.grenadeClock - 1); this.throwFlash = Math.max(0, this.throwFlash - 1);
    this.crouching = this.grounded && game.controlY > 0; this.aimUp = game.controlY < 0;
    const input = Math.sign(game.controlX); if (input) this.facing = input;
    // Immediate run/stop like the reference platformer; no helicopter inertia.
    this.vx = this.crouching ? 0 : input * DECK_RUN_SPEED;
    const oldX = this.x, oldY = this.y;
    const arena = this.boss;
    this.x = clamp(this.x + this.vx * DT, arena ? 3424 : 20, arena ? DECK_LENGTH - 16 : DECK_LENGTH - 70);
    this.coyote = this.grounded ? 5 : Math.max(0, this.coyote - 1);
    if (this.jumpBuffer && this.coyote) { this.vy = -DECK_JUMP_SPEED; this.grounded = false; this.coyote = this.jumpBuffer = 0; this.sound('jump'); }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - 1);
    this.vy += 800 * DT; this.y += this.vy * DT; this.grounded = false;
    this.dropThrough = Math.max(0, this.dropThrough - 1);
    const surfaces = [...this.platforms, ...this.props.filter(p => !p.dead && p.type !== 'barrel').map(p => ({ ...p, solid: true }))];
    for (const p of surfaces) {
      if (!p.solid && this.dropThrough) continue;
      if (this.x + 8 > p.x && this.x - 8 < p.x + p.w && oldY <= p.y + 1 && this.y >= p.y && this.vy >= 0) {
        this.y = p.y; this.vy = 0; this.grounded = true;
      } else if (p.solid && this.y > p.y + 2 && this.y - (this.crouching ? 22 : 40) < p.y + p.h && this.x + 8 > p.x && this.x - 8 < p.x + p.w) {
        if (oldX + 8 <= p.x) this.x = p.x - 8;
        else if (oldX - 8 >= p.x + p.w) this.x = p.x + p.w + 8;
        else if (oldY - 40 >= p.y + p.h && this.vy < 0) { this.y = p.y + p.h + 40; this.vy = 0; }
      }
    }
    if (this.y > liftFloor(this) + 240) { this.health = 1; this.hurt = 0; this.hurtPlayer(game); return; }
    // A blocked foot must not continue a running cycle against cargo or the boss.
    if (this.x === oldX) this.vx = 0;
    this.stride += Math.abs(this.x - oldX);
    const [hipX, hipY] = this.crouching ? [0, 0] : commandoPose(this).hip;
    const muzzle = weaponMuzzle(this);
    this.shotClock = Math.max(0, this.shotClock - 1);
    if ((this.fireHeld || this.fireBuffer) && this.shotClock === 0) {
      this.fireBuffer = 0;
      const close = this.enemies.find(e => !e.dead && (e.x - this.x) * this.facing > 0 && Math.abs(e.x - this.x) < 34 && Math.abs(e.y - this.y) < 20);
      if (close && close.type !== 'turret') { this.hitEnemy(game, close, 4); this.emitAudio('knife', close.x); this.slash = 9; this.shotClock = 10; }
      else {
        const angle = this.aimUp ? -Math.PI / 2 : this.facing < 0 ? Math.PI : 0;
        fireDeckWeapon(this, muzzle.x, muzzle.y, angle);
        this.particles.push({ x: this.x + this.facing * (7 + hipX), y: this.y + hipY - (this.crouching ? 17 : 29),
          vx: -this.facing * (35 + this.age % 19), vy: -50 - this.age % 23, age: 0, life: 22, size: 1, kind: 'casing' });
      }
    }
    this.fireBuffer = Math.max(0, this.fireBuffer - 1);
    deployParatroopers(this);
    for (const e of this.enemies) {
      e.age++; tickHit(e); e.flash = Math.max(0, e.flash - 1);
      e.walking = false;
      if (e.dead && e.burning) {
        e.deathAge++;
        if (e.airDeath) { e.vy = (e.vy || 0) + 16; const old = e.y; e.y += e.vy * DT; const floor = landingSurface(surfaces, e.x, old, e.y, 8); if (floor) { e.y = floor.y; e.airDeath = false; } }
        continue;
      }
      if (tickParatrooper(this, e)) continue;
      if (e.dead) { e.deathAge++; continue; }
      const distance = Math.abs(e.x - this.x);
      if (e.x < this.cameraX - 25 || e.x > this.cameraX + this.width - 20 || distance > 330) continue;
      e.facing = this.x < e.x ? -1 : 1;
      if (e.state === 'patrol') {
        if (e.type === 'soldier' && distance > 125) {
          const nextX = e.x + e.facing * 50 * DT;
          const foot = surfaceBelow(surfaces, nextX + e.facing * 9, e.y - 1);
          if (foot && Math.abs(foot.y - e.y) < 2 && !surfaces.some(p => p.solid && nextX + 9 > p.x && nextX - 9 < p.x + p.w && e.y > p.y + 2 && e.y - 35 < p.y + p.h)) { e.x = nextX; e.walking = true; }
        }
        if (--e.clock <= 0) { e.state = 'aim'; e.clock = 22; }
      } else if (e.state === 'aim') {
        if (--e.clock <= 0) {
          // Ordinary rifle rounds stay chest-high: ducking is a reliable dodge.
          e.aim = e.facing < 0 ? Math.PI : 0;
          if (e.type === 'turret') e.aim = Math.atan2(this.y - 21 - (e.y - 34), this.x - e.x);
          this.enemyFire(e); e.state = 'burst'; e.clock = 12; e.rounds = e.type === 'turret' ? 2 : 1;
        }
      } else if (--e.clock <= 0) {
        if (e.rounds > 0 && e.type !== 'grenadier') { this.enemyFire(e); e.rounds--; e.clock = 12; }
        else { e.state = 'patrol'; e.clock = e.type === 'grenadier' ? 90 : 50; }
      }
      if (distance < 15 && Math.abs(e.y - this.y) < 20) this.hurtPlayer(game);
    }
    tickDeckShots(this, game);
    for (const b of this.bullets) {
      const x = b.x, y = b.y; b.age++; if (b.lob) b.vy += 650 * DT;
      b.x += b.vx * DT; b.y += b.vy * DT;
      const landing = b.lob && b.vy >= 0 && landingSurface(surfaces, b.x, y + 3, b.y + 3, 2);
      if (landing) {
        b.dead = true; this.burst(b.x, landing.y - 6, 2);
        if (Math.hypot(b.x - this.x, landing.y - this.y) < 40) this.hurtPlayer(game);
      } else if (insideSolid(this.platforms, b.x, b.y) || this.props.some(p => !p.dead && b.x >= p.x && b.x <= p.x + p.w && b.y >= p.y && b.y <= p.y + p.h)) {
        b.dead = true;
      } else if (sweptHit(x, y, b.x, b.y, this.x, this.y - (this.crouching ? 10 : 21), this.crouching ? 7 : 12)) {
        b.dead = true; this.hurtPlayer(game);
      }
    }
    for (const grenade of this.thrown) {
      const oldX = grenade.x, oldY = grenade.y;
      grenade.age++; grenade.vy += 650 * DT; grenade.x += grenade.vx * DT; grenade.y += grenade.vy * DT;
      let surface = Infinity;
      for (const p of surfaces) if (grenade.x >= p.x - 3 && grenade.x <= p.x + p.w + 3) {
        if (oldY <= p.y && grenade.vy > 0) surface = Math.min(surface, p.y - 3);
        else if (p.solid && grenade.y > p.y && grenade.y < p.y + p.h && (oldX < p.x || oldX > p.x + p.w)) {
          grenade.x = oldX; grenade.vx *= -.45;
        }
      }
      if (grenade.y >= surface) {
        grenade.y = surface; grenade.vy = grenade.bounced ? 0 : -Math.abs(grenade.vy) * .35;
        grenade.vx *= .65; grenade.bounced = true;
      }
      const contact = this.enemies.some(e => !e.dead && sweptHit(oldX, oldY, grenade.x, grenade.y, e.x, e.y - 19, e.type === 'turret' ? 24 : 15)) || hitsSpacecraft(this.boss, oldX, oldY, grenade.x, grenade.y, 3);
      if (contact || grenade.age >= 50) this.explodeGrenade(game, grenade);
    }
    this.thrown = this.thrown.filter(g => !g.dead);
    this.bullets = this.bullets.filter(b => !b.dead && b.age < 160 && b.y < liftFloor(this) + 250 && Math.abs(b.x - this.x) < this.width + 50);
    for (const item of this.pickups) if (!item.dead && Math.hypot(item.x - this.x, item.y - (this.y - 12)) < 23) {
      item.dead = true;
      if (equipWeapon(this, item.type, game)) { if (item.ammo) this.ammo = item.ammo; }
      else { this.health = Math.min(5, this.health + 2); this.sound('pickup'); }
    }
    const next = this.x >= 2330 ? 2 : this.x >= 1200 ? 1 : 0;
    if (this.playing && next > this.section && this.grounded) {
      this.section = next; this.bullets = []; this.health = Math.min(5, this.health + 1); this.hurt = 70; this.save(game);
      game.message = `${this.label}. Checkpoint reached. The spacecraft is ahead.`;
    }
    if (!this.boss && (!this.miniboss || this.miniboss.state === 'wreck') && this.x >= SPACECRAFT_TRIGGER && this.grounded) this.beginBoss(game);
    this.cameraX += ((this.boss ? LIFT_CENTER - this.width / 2 : clamp(this.x - this.width * .32, 0, DECK_LENGTH - this.width)) - this.cameraX) * .15;
    const cameraTarget = this.lift ? liftFloor(this) - 20 : this.boss ? 200 : this.grounded || this.y > this.cameraFloor + 48 ? clamp(this.y, 174, 324) : this.cameraFloor;
    this.cameraFloor += (cameraTarget - this.cameraFloor) * .07;

  }
}
