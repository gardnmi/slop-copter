import { CARRIER_LINEUP_TICKS } from '../src/carrier-lineup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HZ } from '../src/game.js';
import { AIR_ROUTE, AIR_TURN_TICKS, CARRIER_ARRIVAL_TICKS, sweptHit } from '../src/air-assault.js';
import { AIR_SCROLL_SPEED, DISTRICT_STARTS, groundLane } from '../src/air-world.js';
import { AIRSHIP_FALL_TICKS, exposedAirshipParts, damageAirship } from '../src/airship.js';
import { pilotCarrier } from './helpers/carrier-pilot.js';
import { hitsAirPlayer, airPlayerBank } from '../src/air-player.js';

const ticks = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(1 / HZ); };
function flight(route = 0) {
  const g = new Game({ seed: 9 }); g.score = 4200; g.assault.begin(g); g.assault.startSection(g, route); return g;
}
function pilotAirship(g) {
  const a = g.assault;
  if (a.phase !== 'airship') return;
  const part = exposedAirshipParts(a)[0];
  if (part) g.setYoke(Math.max(-1, Math.min(1, (part.x - a.x) / 40)), (a.height * .8 - a.y) / 40);
}

test('the rooftop pickup hands control to the overhead assault once, without resetting prior progress', () => {
  const g = new Game(); g.score = 4500; g.runner.phase = 'escaped'; g.runner.age = 20; g.runner.distance = 620;
  ticks(g); assert.equal(g.assault.phase, 'turn'); assert.equal(g.inCinematic, true);
  ticks(g, AIR_TURN_TICKS); assert.equal(g.assault.phase, 'flight'); assert.equal(g.inCinematic, false);
  assert.equal(g.assault.checkpoint.label, 'BURNING CITY'); assert.equal(g.score, 4500); assert.equal(g.runner.distance, 620);
  const a = g.assault; ticks(g, 10); assert.equal(g.assault, a); assert.ok(a.shots.length > 0);
});

test('arrow commands accelerate and brake in two axes; automatic fire is independent of Space', () => {
  const g = flight(), a = g.assault, x = a.x, y = a.y;
  g.setYoke(1, -1); ticks(g); assert.ok(a.vx > 0 && a.vx < 190); assert.ok(a.vy < 0 && a.vy > -170);
  ticks(g, 10); assert.ok(a.x > x && a.y < y); assert.ok(a.shots.length > 1);
  g.setYoke(0, 0); ticks(g, 20); assert.equal(a.vx, 0); assert.equal(a.vy, 0);
  g.setYoke(1, 1); ticks(g, 150); assert.ok(a.x <= a.width - 24); assert.ok(a.y <= a.height - 40);
  g.setYoke(-1, -1); ticks(g, 300); assert.ok(a.x >= 24); assert.ok(a.y >= 82);
});

test('swept cannon and enemy bullet collisions cannot skip small targets at high speed', () => {
  assert.equal(sweptHit(10, 100, 10, 0, 10, 50, 4), true);
  assert.equal(sweptHit(10, 100, 10, 0, 30, 50, 4), false);
  const g = flight(), a = g.assault, enemy = a.spawn('tank');
  enemy.x = a.x - 7; enemy.y = a.y - 55; enemy.hp = 1;
  ticks(g, 4); assert.equal(enemy.dead, true); assert.equal(g.score, 4350);
  a.hurt = 0; a.enemyShot(a.x, a.y - 60, Math.PI / 2, 4000);
  ticks(g); assert.equal(a.health, 5); ticks(g, 5); assert.equal(a.health, 5, 'hit grace prevents stacked damage');
});

test('enemy rounds hit the cockpit, continuous tail boom and weapon pods beyond the old tiny center circle', () => {
  for (const y of [-23, -16, 10, 15, 21]) {
    const g = flight(), a = g.assault; a.hurt = 0;
    a.enemyShot(a.x - 60, a.y + y, 0, 6000);
    ticks(g); assert.equal(a.health, 5, `body height ${y} must take a hit`);
  }
  for (const side of [-1, 1]) {
    const g = flight(), a = g.assault; a.hurt = 0;
    a.enemyShot(a.x + side * 13, a.y - 60, Math.PI / 2, 6000);
    ticks(g); assert.equal(a.health, 5, 'weapon pod must take a hit');
  }
});

test('rotor-only grazes and rounds outside the silhouette remain safe; banking and relative motion carry the hull hitbox', () => {
  const g = flight(), a = g.assault; a.hurt = 0;
  for (const side of [-1, 1]) a.enemyShot(a.x + side * 20, a.y - 8, Math.PI / 2, 300);
  ticks(g); assert.equal(a.health, 6);
  a.vx = 190; const angle = airPlayerBank(a);
  const x = a.x - Math.sin(angle) * 23, y = a.y + Math.cos(angle) * 23;
  assert.equal(hitsAirPlayer(a, x, y, x, y, 1), true, 'tail collider banks with the sprite');
  assert.equal(hitsAirPlayer(a, a.x + 26, a.y, a.x + 26, a.y, 2.5), false);
  a.vx = 0;
  assert.equal(hitsAirPlayer(a, a.x - 15, a.y, a.x - 15, a.y, 1, a.x - 30, a.y), true,
    'moving across a round uses both previous and current player positions');
});

test('an enemy aircraft touching the cockpit damages the player while a ground unit beneath it does not', () => {
  for (const type of ['drone', 'tank']) {
    const g = flight(), a = g.assault; a.hurt = 0; a.shotClock = 100;
    const e = a.spawn(type); Object.assign(e, { x: a.x, y: a.y - 32, speed: 0, cooldown: 100 });
    ticks(g); assert.equal(a.health, type === 'drone' ? 5 : 6);
  }
});

test('Space has no air-assault weapon action, and the friendly carrier cannot be attacked', () => {
  const g = flight(), a = g.assault, enemy = a.spawn('tank'); enemy.y = 100;
  a.enemyShot(10, 100, 0); const before = JSON.stringify(a);
  assert.equal(g.drop(), false); assert.equal(g.canDrop, false);
  assert.equal(JSON.stringify(a), before, 'Space cannot clear fire or hurt enemies');
  assert.equal('bombs' in a, false);
  a.beginAirship(g); ticks(g, 150);
  const hp = a.airship.parts.map(p => p.hp); assert.equal(g.drop(), false);
  assert.deepEqual(a.airship.parts.map(p => p.hp), hp);
  a.beginCarrier(g); assert.equal(g.drop(), false); assert.equal(a.carrier.parts, undefined);
});

test('enemy warnings precede shots; missiles lose tracking and expire; ground vehicles have no body collision', () => {
  const g = flight(1), a = g.assault, e = a.spawn('missile'); e.x = a.x - 90; e.y = 90; e.cooldown = 32;
  ticks(g, 3); assert.equal(e.warning, true); assert.equal(a.bullets.length, 0);
  ticks(g, 29); const b = a.bullets[0]; assert.ok(b?.homing > 0);
  b.x = 20; b.y = 20; b.vx = 50; b.vy = 0; b.age = b.homing;
  ticks(g, 5); assert.equal(b.vx, 50); assert.equal(b.vy, 0);
  ticks(g, 170); assert.equal(a.bullets.includes(b), false);
  a.hurt = 0; const tank = a.spawn('tank'); tank.x = a.x; tank.y = a.y; const hp = a.health;
  ticks(g); assert.equal(a.health, hp);
});

test('the 62-second route advances to a separate airship boss with section checkpoints and bounded entities', () => {
  const g = flight(), a = g.assault, names = [a.checkpoint.label];
  for (let i = 0; i < AIR_ROUTE.reduce((n, r) => n + r.seconds * 50, 0) + 1; i++) {
    a.hurt = 5; ticks(g);
    if (names.at(-1) !== a.checkpoint.label) names.push(a.checkpoint.label);
    assert.ok(a.shots.length < 200); assert.ok(a.bullets.length < 200); assert.ok(a.enemies.length < 40); assert.ok(a.particles.length <= 220);
  }
  assert.equal(AIR_ROUTE.reduce((n, r) => n + r.seconds, 0), 62);
  assert.deepEqual(names, [...AIR_ROUTE.map(r => r.name), 'IRON VULTURE']); assert.equal(a.phase, 'airship');
  assert.equal(a.carrier, null);
});

test('death retries only the current section, restoring entry score and hull without mutating the snapshot', () => {
  const g = flight(2), a = g.assault, checkpoint = JSON.stringify(a.checkpoint);
  a.addScore(g, 900); a.health = 1; a.hurt = 0; a.hurtPlayer(g);
  assert.equal(a.dead, true); assert.equal(a.retry(g), false); ticks(g, 30);
  assert.equal(g.continueSegment(), g); const resumed = g.assault;
  assert.equal(resumed.phase, 'flight'); assert.equal(resumed.route, 2); assert.equal(resumed.routeAge, 0);
  assert.equal(g.score, 4200); assert.equal(resumed.health, 6);
  assert.equal(resumed.bullets.length, 0); assert.equal(JSON.stringify(resumed.checkpoint), checkpoint);
  assert.equal(g.reset().assault.phase, 'dormant');
});

test('ordinary weapons defeat the flying airship; a safe carrier arrival and landing hand control to the deck raid', () => {
  const g = flight(), a = g.assault; a.beginAirship(g);
  for (let n = 0; n < 3000 && a.phase === 'airship' && !a.dead; n++) { pilotAirship(g); ticks(g); }
  assert.equal(a.phase, 'airship-down'); assert.ok(a.airship.parts.every(p => !p.hp));
  assert.ok(a.health > 0); assert.equal(a.bullets.length, 0);
  ticks(g, AIRSHIP_FALL_TICKS); assert.equal(a.phase, 'carrier');
  ticks(g, CARRIER_ARRIVAL_TICKS); assert.equal(a.phase, 'lineup');
  assert.equal(g.inCinematic, true); ticks(g, CARRIER_LINEUP_TICKS); assert.equal(a.phase, 'landing');
  assert.equal(a.shots.length, 0); assert.equal(g.canDrop, false); assert.equal(g.inCinematic, false);
  const score = g.score;
  for (let i = 0; i < 1500 && !g.boarding.active && !a.dead; i++) { pilotCarrier(g); ticks(g); } assert.equal(a.phase, 'secured'); assert.equal(g.score, score);
  assert.equal(g.boarding.phase, 'raid'); assert.equal(g.inCinematic, false);
  assert.equal(g.canDrop, true); assert.equal(g.boarding.checkpoint.label, 'AFT DECK');
});

test('pause and resize preserve combat, boss damage and the landing clock; play is render-rate independent', () => {
  const states = [];
  for (const fps of [30, 50, 60, 144]) {
    const g = flight(); g.setYoke(.5, -.3);
    for (let i = 0; i < fps * 4; i++) g.step(1 / fps);
    states.push(JSON.stringify(g.assault));
  }
  states.slice(1).forEach(s => assert.equal(s, states[0]));
  const g = flight(), a = g.assault; a.beginAirship(g); ticks(g, 160); damageAirship(a, g, a.airship.parts[0], 3);
  const hp = a.airship.parts.map(p => p.hp), x = a.x / a.width;
  g.paused = true; const frozen = JSON.stringify(a); ticks(g, 500); assert.equal(JSON.stringify(a), frozen);
  g.resize(390, 844); assert.equal(a.x / a.width, x); assert.deepEqual(a.airship.parts.map(p => p.hp), hp);
  g.paused = false; a.beginCarrier(g); a.enter('landing', g); ticks(g, 70); g.paused = true; ticks(g, 300); assert.equal(a.age, 70);
});

test('opening encounters combine formations and ground fire; power pickups widen the gun', () => {
  const g = flight(), a = g.assault; a.x = 24; let fired = 0, air = false, ground = false;
  const shoot = a.enemyShot.bind(a); a.enemyShot = (...args) => { fired++; shoot(...args); };
  for (let n = 0; n < 200; n++) {
    ticks(g); air ||= a.enemies.some(e => e.type === 'drone'); ground ||= a.enemies.some(e => e.type === 'tank');
  }
  assert.ok(air && ground); assert.ok(fired >= 8, `opening only fired ${fired} shots`);
  a.pickups.push({ x: a.x, y: a.y, age: 0, type: 'power' }); ticks(g); assert.equal(a.power, 2);
  a.shotClock = 0; ticks(g); assert.ok(a.shots.some(s => s.vx < 0) && a.shots.some(s => s.vx > 0));
});

test('enemy aim is committed during the warning and close targets cannot fire without room to dodge', () => {
  const g = flight(), a = g.assault, e = a.spawn('tank'); e.x = 40; e.y = 80; e.speed = 0; e.cooldown = 32;
  ticks(g, 3); const aim = e.aim; a.x = a.width - 30; ticks(g, 6); assert.equal(e.aim, aim);
  e.x = a.x; e.y = a.y - 45; e.cooldown = 1; ticks(g);
  assert.ok(e.cooldown >= 32); assert.equal(e.aim, null);
});


test('stationary ground weapons and wreckage remain fixed to terrain at every viewport', () => {
  for (const [width, height] of [[2560, 1254], [390, 844]]) {
    const g = flight(), a = g.assault; g.resize(width, height); a.x = a.width / 2; a.hurt = 10000;
    const e = a.spawn('turret', .1), distance = a.scroll - e.y;
    ticks(g, 100);
    assert.ok(Math.abs(a.scroll - e.y - distance) < 1e-7);
    assert.ok(Math.abs(e.x - groundLane(a.width, distance, e.type, e.lane)) < 1e-7);
    a.killEnemy(g, e); const w = a.wrecks.at(-1), world = a.scroll - w.y;
    ticks(g, 35); assert.ok(Math.abs(a.scroll - w.y - world) < 1e-7);
  }
});

test('vehicles follow the rendered road curve and trains stay on the railway', () => {
  const g = flight(), a = g.assault; a.x = 24; a.hurt = 10000;
  const truck = a.spawn('missile', .9), train = a.spawn('train', .5);
  for (let i = 0; i < 180; i++) {
    ticks(g);
    for (const e of [truck, train]) assert.ok(Math.abs(e.x - groundLane(a.width, a.scroll - e.y, e.type, e.lane)) < 1e-6);
  }
});

test('district handoffs preserve scroll and checkpoints restore the same terrain', () => {
  const g = flight(), a = g.assault; a.hurt = 10000; ticks(g, 899);
  const scroll = a.scroll; ticks(g);
  assert.equal(a.route, 1); assert.ok(Math.abs(a.scroll - scroll - AIR_SCROLL_SPEED / 50) < 1e-7);
  assert.ok(Math.abs(a.scroll - DISTRICT_STARTS[1]) < 1e-6);
  const saved = a.checkpoint.data.scroll;
  a.health = 1; a.hurt = 0; a.hurtPlayer(g); ticks(g, 30); a.retry(g);
  assert.equal(g.assault.scroll, saved);
});

test('supplies are useful, capped and deduplicated; aircraft never leave intact ground wrecks', () => {
  const g = flight(), a = g.assault;
  for (let i = 0; i < 9; i++) a.supply(100, 100);
  assert.equal(a.pickups.length, 1); assert.equal(a.pickups[0].type, 'power');
  a.pickups = []; a.power = 3; a.health = 6; a.supply(100, 100); assert.equal(a.pickups.length, 0);
  a.health = 3; a.supply(100, 100); assert.equal(a.pickups[0].type, 'repair');
  const e = a.spawn('gunship'); a.killEnemy(g, e); assert.equal(a.wrecks.length, 0); assert.equal(a.explosions.length, 1);
});

test('gunships brake to fire then peel away; charge locks before the volley', () => {
  const g = flight(), a = g.assault; a.x = 24; a.hurt = 10000; a.spawnWave('pincer', 'gunship');
  const e = a.enemies[1]; ticks(g, 80); const y = e.y; ticks(g, 35);
  assert.ok(e.y - y < 5); assert.ok(a.bullets.length > 0);
  ticks(g, 85); const retreat = e.y; ticks(g, 20); assert.ok(e.y < retreat);
});
