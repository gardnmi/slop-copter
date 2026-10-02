// Arcade flight with Raiden-inspired encounter beats and a friendly carrier objective.
// All combat, warnings and cinematics advance on the shared deterministic 50 Hz clock.
import { AIR_WAVES } from './air-waves.js';
import { beginCarrierLanding, tickCarrierLanding } from './carrier-landing.js';
import { beginCarrierLineup, tickCarrierLineup } from './carrier-lineup.js';
import { tickLandingFlightFX } from './landing-flight-fx.js';
import { markHit, tickHit } from './hit-flash.js';
import { AIR_PLAYER_GUN_X, AIR_PLAYER_GUN_Y, AIR_WINGMAN_OFFSET, AIR_WINGMAN_Y, hitsAirPlayer } from './air-player.js';
import { AIR_SCROLL_SPEED, DISTRICT_STARTS, DISTRICT_BLEND, groundLane } from './air-world.js';
export { AIR_SCROLL_SPEED } from './air-world.js';
import { beginAirship, tickAirship, damageAirship, exposedAirshipParts, positionAirship, AIRSHIP_FALL_TICKS } from './airship.js';
export const AIR_ROUTE = [
  { name: 'BURNING CITY', seconds: 18, hint: 'Break through the city. Collect P to widen your cannon. Watch the weapons charge, then dodge.' },
  { name: 'FREEWAY', seconds: 16, hint: 'Missile convoy ahead. Hit the radar, then sweep the fighter formations.' },
  { name: 'SHIPYARDS', seconds: 16, hint: 'Harbor crossfire. Keep moving between the boats and incoming gunships.' },
  { name: 'CARRIER APPROACH', seconds: 12, hint: 'Your carrier is ahead. Break through the last wave and come home.' },
];
export const AIR_TURN_TICKS = 150;
export const CARRIER_ARRIVAL_TICKS = 190;
const DT = 1 / 50;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const ENEMIES = {
  tank: { hp: 5, radius: 15, speed: 45, fire: 64 }, turret: { hp: 6, radius: 15, speed: 78, fire: 78 },
  missile: { hp: 6, radius: 16, speed: 48, fire: 105 }, radar: { hp: 5, radius: 16, speed: 48, fire: 300 },
  boat: { hp: 7, radius: 18, speed: 56, fire: 84 }, gunship: { hp: 7, radius: 17, speed: 85, fire: 72 },
  drone: { hp: 2, radius: 13, speed: 118, fire: 90 }, train: { hp: 28, radius: 22, speed: 44, fire: 62 },
};
export function assaultView(game) {
  const aspect = game.width / game.height, width = clamp(aspect * 400, 300, 760);
  return { width, height: width / aspect };
}
export function sweptHit(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = clamp(((cx - x1) * dx + (cy - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return (x1 + t * dx - cx) ** 2 + (y1 + t * dy - cy) ** 2 <= radius * radius;
}
export class AirAssault {
  constructor(seed = 1) {
    this.seed = this.randomState = seed >>> 0; this.phase = 'dormant'; this.age = this.time = 0;
    this.width = 760; this.height = 400; this.x = this.y = this.vx = this.vy = 0;
    this.route = this.routeAge = this.wave = this.scroll = this.kills = 0;
    this.health = 6; this.wingmen = 0; this.power = 1; this.hurt = 0;
    this.enemies = []; this.bullets = []; this.shots = []; this.particles = []; this.pickups = []; this.wrecks = [];
    this.explosions = []; this.carrier = null; this.airship = null; this.recovery = null; this.checkpoint = null; this.shake = 0;
    this.cue = { id: 0, name: '' }; this.reason = ''; this.shotClock = 0;
    this.audioSerial = 0; this.audioEvents = [];
  }
  get active() { return this.phase !== 'dormant'; }
  get playing() { return this.phase === 'flight' || this.phase === 'airship' || this.phase === 'landing' && this.recovery?.status === 'flying'; }
  get dead() { return this.phase === 'dead'; }
  get sectionName() { return this.recovery ? 'CARRIER LANDING' : this.carrier ? 'CARRIER ARRIVAL' : this.airship ? 'IRON VULTURE' : AIR_ROUTE[this.route].name; }
  random() { this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0; return this.randomState / 4294967296; }
  emitAudio(kind, x = this.x) {
    this.audioEvents.push({ id: ++this.audioSerial, kind, x, time: this.time });
    if (this.audioEvents.length > 48) this.audioEvents.shift();
  }
  sound(name, x = this.x, effect = name) {
    this.cue = { id: this.cue.id + 1, name }; this.emitAudio(effect, x);
  }
  enter(phase, game) {
    this.phase = phase; this.age = 0; this.sound(phase); game.releaseControls();
    if (phase === 'landing') beginCarrierLanding(this, game);
    if (phase === 'lineup') beginCarrierLineup(this, game);
  }
  begin(game) {
    if (this.active) return;
    Object.assign(this, assaultView(game)); this.x = this.width * .5; this.y = this.height * .78;
    this.enter('turn', game); game.message = 'New heading. Offshore carrier. Take the controls.';
  }
  startSection(game, route = 0) {
    // Normal progress keeps the same world scrolling through the district line.
    // Direct level selection starts inside the selected district.
    const continuing = this.phase === 'flight' && route === this.route + 1;
    if (!continuing) this.scroll = route ? DISTRICT_STARTS[route] + this.height + DISTRICT_BLEND : 0;
    this.route = route; this.routeAge = this.wave = 0;
    this.health = Math.min(6, this.health + 2);
    this.hurt = 100;
    if (!continuing) { this.enemies = []; this.bullets = []; this.shots = []; this.pickups = []; }
    this.enter('flight', game); game.message = AIR_ROUTE[route].hint;
    this.saveCheckpoint(game);
  }
  saveCheckpoint(game) {
    const data = JSON.parse(JSON.stringify(this, (key, value) => key === 'checkpoint' ? undefined : value));
    this.checkpoint = { data, score: game.score, label: this.sectionName };
  }
  retry(game) {
    if (!this.dead || this.age < 30 || !this.checkpoint) return false;
    const checkpoint = this.checkpoint, next = new AirAssault(this.seed);
    Object.assign(next, JSON.parse(JSON.stringify(checkpoint.data)));
    next.checkpoint = checkpoint; next.health = 6; next.hurt = 150;
    next.bullets = []; next.shots = []; next.explosions = []; next.particles = [];
    next.vx = next.vy = 0;
    game.assault = next; next.resize(game); game.score = checkpoint.score; game.releaseControls();
    game.message = next.recovery ? 'CATCH THE CARRIER. Full tank. Up / W / Space: lift. Left / Right: tilt. Land gently on the lit pad.'
      : `${checkpoint.label}. Fresh armor. Arrows fly. Cannon fires automatically.`;
    next.sound('continue'); return true;
  }
  addScore(game, value) { game.score += value; game.best = Math.max(game.best, game.score); }
  burst(x, y, count = 12, kind = 'fire') {
    this.explosions.push({ x, y, age: 0, radius: 10 + count * .3, seed: Math.floor(this.random() * 10000) });
    this.explosions = this.explosions.slice(-24);
    for (let i = 0; i < count; i++) this.particles.push({ x, y, vx: (this.random() - .5) * 160,
      vy: (this.random() - .5) * 160, age: 0, life: 15 + this.random() * 28, size: 1 + this.random() * 2, kind });
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  }
  spawn(type, lane = this.random()) {
    const spec = ENEMIES[type];
    const airborne = type === 'gunship' || type === 'drone';
    let x = this.width * (.12 + lane * .76);
    if (!airborne) x = groundLane(this.width, this.scroll + 24, type, lane);
    const enemy = { ...spec, airborne, lane, maxHp: spec.hp, type, x, y: -24, oldX: x, oldY: -24, originX: x, vx: 0, age: 0,
      path: 'straight', cooldown: 32 + Math.floor(this.random() * 18), warning: false, seed: this.random(), hit: 0, flash: 0, aim: null,
      salvo: 0, salvoClock: 0, salvoIndex: 0, attack: 0 };
    this.enemies.push(enemy); return enemy;
  }
  spawnWave(pattern, type) {
    const direction = this.wave % 2 ? -1 : 1;
    if (pattern === 'pair' || pattern === 'radar' || pattern === 'anchor') {
      for (const [i, lane] of [.12, .88].entries()) {
        const e = this.spawn(pattern === 'radar' && i === 0 ? 'radar' : pattern === 'anchor' ? 'turret' : type, lane);
        e.y = -20 - i * 26; e.cooldown += i * 15;
        e.x = e.originX = groundLane(this.width, this.scroll - e.y, e.type, e.lane);
      }
      if (pattern === 'anchor') { const e = this.spawn(type, .8); e.y = -55; e.x = e.originX = groundLane(this.width, this.scroll - e.y, type, .8); }
      return;
    }
    const count = ['cross', 'pincer'].includes(pattern) ? 2 : this.width < 460 ? 3 : pattern === 'vee' ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const lane = ['cross', 'pincer'].includes(pattern) ? (i ? .85 : .15) : pattern === 'vee' ? .5 + (i - (count - 1) / 2) * .14
        : direction > 0 ? .1 + i * .09 : .9 - i * .09;
      const e = this.spawn(type, lane); e.originX = e.x;
      e.y = pattern === 'vee' ? -22 - Math.abs(i - (count - 1) / 2) * 24 : -22 - i * 26;
      e.path = type === 'gunship' ? 'hover' : pattern === 'dive' ? 'dive' : pattern === 'vee' ? 'sway' : 'diagonal';
      e.side = i % 2 ? -1 : 1;
      e.pathDelay = i * 10;
      e.vx = ['cross', 'pincer'].includes(pattern) ? (i ? -1 : 1) * 46 : pattern === 'sweep' ? direction * 42 : 0;
      e.cooldown = 30 + i * 9;
    }
  }
  enemyShot(x, y, angle, speed = 110, homing = 0) {
    if (this.bullets.length >= 180) return;
    this.bullets.push({ x, y, oldX: x, oldY: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      age: 0, life: homing ? 170 : 260, homing, radius: homing ? 3.5 : 2.5 });
  }
  shootEnemy(enemy) {
    const angle = enemy.aim ?? Math.atan2(this.y - enemy.y, this.x - enemy.x), type = enemy.type;
    if (type === 'radar') return;
    enemy.attack++;
    enemy.salvoAim = angle; enemy.salvoIndex = 0;
    enemy.salvo = type === 'tank' || type === 'gunship' ? 2 : type === 'train' ? 1 : 0;
    enemy.salvoClock = type === 'gunship' ? 9 : 6;
    this.fireVolley(enemy);
  }
  fireVolley(enemy) {
    const angle = enemy.salvoAim, type = enemy.type;
    enemy.flash = 7;
    this.emitAudio(type === 'missile' ? 'missile' : 'enemy-fire', enemy.x);
    if (type === 'missile') {
      const guided = this.enemies.some(e => e.type === 'radar' && e.hp > 0);
      for (const offset of [-.1, .1]) this.enemyShot(enemy.x, enemy.y + 10, angle + offset, 130, guided ? 75 : 30);
    } else if (type === 'gunship') {
      // Parallel wing guns, three brief salvos, then a visible reload/retreat.
      const dx = Math.sin(angle) * 9, dy = -Math.cos(angle) * 9;
      for (const side of [-1, 1]) this.enemyShot(enemy.x + dx * side, enemy.y + dy * side, angle, 145 + this.route * 6);
    } else if (['turret', 'boat', 'train'].includes(type)) {
      const fan = type === 'train' ? [-.54, -.36, -.18, 0, .18, .36, .54] : type === 'boat' ? [-.22, 0, .22]
        : enemy.attack % 2 ? [-.42, -.21, 0, .21, .42] : [-.315, -.105, .105, .315];
      for (const offset of fan) this.enemyShot(enemy.x, enemy.y + 9, angle + offset, 132 + this.route * 7);
    } else {
      // Fast aimed needles create a different dodge from the slower wide fans.
      this.enemyShot(enemy.x, enemy.y + 9, angle, 166 + this.route * 7);
    }
    enemy.salvoIndex++;
  }
  hurtPlayer(game) {
    if (this.hurt || !this.playing) return;
    this.health--; this.hurt = 100; this.shake = .22; this.sound('hit'); this.burst(this.x, this.y, 13);
    if (this.health <= 0) {
      this.reason = 'The gunship went down.'; this.enter('dead', game); this.burst(this.x, this.y, 45);
      game.message = `${this.reason} Space / tap retries ${this.checkpoint.label}.`;
    }
  }
  killEnemy(game, enemy) {
    if (enemy.dead) return;
    enemy.hp = 0; enemy.dead = true; this.kills++; this.addScore(game, enemy.type === 'train' ? 800 : 150);
    this.burst(enemy.x, enemy.y, enemy.type === 'train' ? 30 : 13);
    if (!enemy.airborne) this.wrecks.push({ x: enemy.x, y: enemy.y, type: enemy.type, age: 0, seed: enemy.seed });
    this.sound('destroy', enemy.x, enemy.type === 'train' ? 'heavy-ground'
      : enemy.type === 'gunship' ? 'heavy-air' : enemy.airborne ? 'light-air' : 'light-ground');
    if (this.kills % 9 === 0) this.supply(enemy.x, enemy.y);
  }
  supply(x, y, preferred = null) {
    const type = preferred ?? (this.power < 3 ? 'power' : this.health <= 4 ? 'repair' : null);
    if (!type || type === 'power' && this.power >= 3 || type === 'repair' && this.health >= 6 || type === 'wingman' && this.wingmen >= 2) return;
    if (this.pickups.some(item => item.type === type) || this.pickups.length >= 3) return;
    this.pickups.push({ x, y, type, age: 0 });
  }
  beginAirship(game) { beginAirship(this, game); }
  beginCarrier(game) {
    if (this.carrier) return;
    this.enemies = []; this.bullets = []; this.shots = []; this.pickups = [];
    this.explosions = []; this.particles = []; this.wrecks = [];
    this.airship = null;
    this.carrier = { top: -this.height * 1.5 };
    this.enter('carrier', game);
    game.message = 'CARRIER REACHED. Friendly deck. Weapons safe. You are cleared to land.';
  }
  carrierRect() {
    const height = this.height * 1.6, width = Math.min(this.width * .72, height * .42);
    return { x: this.width / 2 - width / 2, y: this.carrier.top, width, height };
  }
  tickCarrier(game) {
    this.scroll += AIR_SCROLL_SPEED * DT;
    this.carrier.top += (-this.height * .6 - this.carrier.top) * .025;
    this.x += (this.width * .5 - this.x) * .035; this.y += (this.height * .85 - this.y) * .035;
    this.vx *= .9; this.vy *= .9;
    if (this.age >= CARRIER_ARRIVAL_TICKS) this.enter('lineup', game);
  }
  tick(game) {
    this.age++; this.time += DT; this.shake = Math.max(0, this.shake - DT);
    this.hurt = Math.max(0, this.hurt - 1);
    for (const p of this.particles) { p.age++; p.x += p.vx * DT; p.y += p.vy * DT; p.vx *= .97; p.vy *= .97; }
    this.particles = this.particles.filter(p => p.age < p.life);
    this.explosions.forEach(b => b.age++); this.explosions = this.explosions.filter(b => b.age < 34);
    if (this.phase === 'turn') { if (this.age >= AIR_TURN_TICKS) this.startSection(game); return; }
    if (this.phase === 'carrier') { this.tickCarrier(game); return; }
    if (this.phase === 'lineup') { tickCarrierLineup(this, game); tickLandingFlightFX(this.recovery); return; }
    if (this.phase === 'airship-down') {
      if (this.age % 12 === 0) this.burst(this.airship.x + (this.random() - .5) * this.airship.width, this.airship.y + (this.random() - .5) * 100, 18);
      if (this.age >= AIRSHIP_FALL_TICKS) this.beginCarrier(game);
      return;
    }
    if (this.phase === 'landing') {
      tickCarrierLanding(this, game);
      tickLandingFlightFX(this.recovery);
      return;
    }
    if (this.dead && this.recovery) tickLandingFlightFX(this.recovery);
    if (!this.playing) return;
    const previousX = this.x, previousY = this.y;
    const axis = (v, input, max) => {
      const target = input * max, step = (input ? 820 / Math.max(.6, game.accelerationTime * 2) : 1100) * DT;
      return v + clamp(target - v, -step, step);
    };
    this.vx = axis(this.vx, game.controlX / 4, 190);
    this.vy = axis(this.vy, game.controlY / (game.controlY < 0 ? 3 : 4), 170);
    this.x = clamp(this.x + this.vx * DT, 24, this.width - 24);
    this.y = clamp(this.y + this.vy * DT, 82, this.height - 40);
    if (this.x <= 24 || this.x >= this.width - 24) this.vx = 0;
    if (this.y <= 82 || this.y >= this.height - 40) this.vy = 0;
    this.scroll += AIR_SCROLL_SPEED * DT;
    if (--this.shotClock <= 0) {
      this.shotClock = 6;
      this.emitAudio('cannon');
      for (const offset of [-AIR_PLAYER_GUN_X, AIR_PLAYER_GUN_X]) this.shots.push({ x: this.x + offset, y: this.y + AIR_PLAYER_GUN_Y, oldY: this.y + AIR_PLAYER_GUN_Y, vx: 0, vy: -510, age: 0 });
      for (let level = 2; level <= this.power; level++) for (const side of [-1, 1]) {
        this.shots.push({ x: this.x + side * (6 + level), y: this.y - 13, oldY: this.y - 13, vx: side * (level - 1) * 95, vy: -490, age: 0 });
      }
      for (let i = 0; i < this.wingmen; i++) this.shots.push({ x: this.x + (i ? 1 : -1) * AIR_WINGMAN_OFFSET, y: this.y + AIR_WINGMAN_Y - 12, oldY: this.y + AIR_WINGMAN_Y - 12, vx: (i ? 1 : -1) * 14, vy: -480, age: 0 });
    }
    if (this.phase === 'flight') {
      this.routeAge++;
      const beat = AIR_WAVES[this.route][this.wave];
      if (beat && this.routeAge >= beat[0] * 50) {
        this.spawnWave(beat[1], beat[2]);
        this.wave++;
      }
      if (this.routeAge === 150) this.supply(this.x, Math.max(65, this.y - 110));
      if (this.routeAge === 450 && this.route < 2) this.supply(this.width * .5, 70, 'wingman');
      if (this.routeAge >= AIR_ROUTE[this.route].seconds * 50) {
        if (this.route === AIR_ROUTE.length - 1) { this.addScore(game, 1500); this.beginAirship(game); }
        else this.startSection(game, this.route + 1);
      }
    }
    if (!this.playing) return;
    if (this.phase === 'airship') tickAirship(this);
    for (const enemy of this.enemies) {
      enemy.age++; tickHit(enemy); enemy.flash = Math.max(0, enemy.flash - 1); enemy.oldX = enemy.x; enemy.oldY = enemy.y;
      enemy.y += enemy.speed * DT;
      if (!enemy.airborne) {
        const oldDistance = this.scroll - AIR_SCROLL_SPEED * DT - enemy.oldY;
        const distance = this.scroll - enemy.y;
        enemy.x += groundLane(this.width, distance, enemy.type, enemy.lane) - groundLane(this.width, oldDistance, enemy.type, enemy.lane);
      } else if (enemy.path === 'hover') {
        // Gunships brake into a firing position, strafe, then peel away.
        if (enemy.age > 65 && enemy.age < 175) enemy.y = enemy.oldY + 5 * DT;
        if (enemy.age >= 175) { enemy.y = enemy.oldY - 70 * DT; enemy.vx += enemy.side * 1.4; }
        enemy.x += enemy.vx * DT * (enemy.age < 175 ? .35 : 1);
      } else if (enemy.path === 'dive') {
        const t = Math.max(0, enemy.age - enemy.pathDelay);
        // A leader/follower hook: descend, bank across the screen, then peel
        // back upward. Later craft trace the same turn with staggered timing.
        enemy.vx = enemy.side * (t < 35 ? 30 : t < 90 ? 95 : 70);
        enemy.x += enemy.vx * DT;
        if (t > 90) enemy.y = enemy.oldY - (t > 120 ? 120 : 40) * DT;
      } else if (enemy.path === 'sway') enemy.x = enemy.originX + Math.sin(enemy.age * .04) * Math.min(20, this.width * .04);
      else enemy.x += enemy.vx * DT;
      enemy.warning = false;
      if (enemy.salvo > 0 && --enemy.salvoClock <= 0) {
        if (enemy.y > 18 && enemy.y < this.height * .8 && enemy.x > 8 && enemy.x < this.width - 8 && Math.hypot(this.x - enemy.x, this.y - enemy.y) >= 75) {
          this.fireVolley(enemy); enemy.salvo--; enemy.salvoClock = enemy.type === 'gunship' ? 9 : 6;
        } else enemy.salvo = 0;
      }
      if (enemy.y > 22 && enemy.y < this.height * .77 && enemy.x > 8 && enemy.x < this.width - 8) {
        if (Math.hypot(this.x - enemy.x, this.y - enemy.y) < 75) { enemy.cooldown = Math.max(32, enemy.cooldown); enemy.aim = null; }
        else {
          enemy.cooldown--; enemy.warning = enemy.cooldown < 30 && enemy.type !== 'radar';
          if (enemy.cooldown <= 30 && enemy.aim === null) enemy.aim = Math.atan2(this.y - enemy.y, this.x - enemy.x);
          if (enemy.cooldown <= 0) { this.shootEnemy(enemy); enemy.cooldown = enemy.fire; enemy.aim = null; }
        }
      }
      if (enemy.airborne && hitsAirPlayer(this, enemy.oldX, enemy.oldY, enemy.x, enemy.y, enemy.radius, previousX, previousY)) this.hurtPlayer(game);
    }
    for (const shot of this.shots) {
      shot.oldX = shot.x; shot.oldY = shot.y; shot.x += shot.vx * DT; shot.y += shot.vy * DT; shot.age++;
      const enemy = this.enemies.find(e => !e.dead && sweptHit(shot.oldX, shot.oldY, shot.x, shot.y, e.x, e.y, e.radius));
      if (enemy) {
        enemy.hp--; markHit(enemy); shot.dead = true;
        if (enemy.hp <= 0) this.killEnemy(game, enemy); else this.emitAudio('impact', enemy.x);
      }
      if (!shot.dead && this.phase === 'airship') {
        const part = exposedAirshipParts(this).find(p => sweptHit(shot.oldX, shot.oldY, shot.x, shot.y, p.x, p.y, p.radius));
        if (part) { damageAirship(this, game, part, 1); shot.dead = true; }
      }
    }
    this.shots = this.shots.filter(s => !s.dead && s.y > -20 && s.age < 100);
    this.enemies = this.enemies.filter(e => !e.dead && e.age < 550 && e.y > -150 && e.y < this.height + 75 && e.x > -100 && e.x < this.width + 100);
    for (const bullet of this.bullets) {
      bullet.oldX = bullet.x; bullet.oldY = bullet.y; bullet.age++;
      if (bullet.homing && bullet.age < bullet.homing) {
        const old = Math.atan2(bullet.vy, bullet.vx), aim = Math.atan2(this.y - bullet.y, this.x - bullet.x);
        const difference = Math.atan2(Math.sin(aim - old), Math.cos(aim - old));
        const angle = old + clamp(difference, -.018, .018), speed = Math.hypot(bullet.vx, bullet.vy);
        bullet.vx = Math.cos(angle) * speed; bullet.vy = Math.sin(angle) * speed;
      }
      bullet.x += bullet.vx * DT; bullet.y += bullet.vy * DT;
      if (hitsAirPlayer(this, bullet.oldX, bullet.oldY, bullet.x, bullet.y, bullet.radius, previousX, previousY)) {
        bullet.dead = true; this.hurtPlayer(game);
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead && b.age < b.life && b.x > -30 && b.x < this.width + 30 && b.y > -30 && b.y < this.height + 30);
    for (const item of this.pickups) {
      item.age++; item.y += 42 * DT;
      if (Math.hypot(item.x - this.x, item.y - this.y) < 29) {
        item.dead = true; this.sound('pickup', item.x, item.type === 'power' && this.power >= 2 ? 'power-max' : 'powerup');
        if (item.type === 'repair') this.health = Math.min(6, this.health + 2);
        else if (item.type === 'wingman') this.wingmen = Math.min(2, this.wingmen + 1);
        else if (item.type === 'power') { this.power = Math.min(3, this.power + 1); game.message = `CANNON LEVEL ${this.power}. Wider fire. Keep pushing toward the carrier!`; }
      }
    }
    this.pickups = this.pickups.filter(p => !p.dead && p.y < this.height + 20);
    for (const wreck of this.wrecks) { wreck.age++; wreck.y += AIR_SCROLL_SPEED * DT; }
    this.wrecks = this.wrecks.filter(w => w.y < this.height + 60 && w.age < 350);
  }
  resize(game) {
    const view = assaultView(game), sx = view.width / this.width, sy = view.height / this.height;
    this.x *= sx; this.y *= sy;
    for (const list of [this.enemies, this.shots, this.bullets, this.pickups, this.wrecks, this.particles, this.explosions]) for (const item of list) {
      item.x *= sx; item.y *= sy;
      if (item.oldX !== undefined) item.oldX *= sx;
      if (item.oldY !== undefined) item.oldY *= sy;
      if (item.originX !== undefined) item.originX *= sx;
      if (item.aim !== undefined && item.aim !== null) item.aim = Math.atan2(Math.sin(item.aim) * sy, Math.cos(item.aim) * sx);
    }
    if (this.carrier) this.carrier.top *= sy;
    Object.assign(this, view);
    if (this.airship) positionAirship(this);
  }
}
