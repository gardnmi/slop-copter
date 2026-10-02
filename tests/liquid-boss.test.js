import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HZ } from '../src/game.js';
import { LIQUID_TIMINGS, GRENADE_RELOAD, ROCKET_TURN, ROCKET_FUEL, ROCKET_LIFE } from '../src/liquid-boss.js';
import { HUNTER_LAUNCH_ANGLE } from '../src/liquid-assets.js';

const ticks = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(1 / HZ); };
function cleared() {
  const g = new Game({ seed: 11 }); g.shiftCount = 6; g.retaliation = true;
  for (let i = 0; i < 8; i++) g.combat.miss(g, 60 + i * 120);
  g.counterattack.phase = 'active';
  for (const s of [...g.combat.shooters]) { g.counterattack.hit(g, s, { vx: 10 }); g.counterattack.hit(g, s, { vx: 10 }); }
  ticks(g); return g;
}
function hunting() {
  const g = new Game({ seed: 11 }); g.shiftCount = 6; g.retaliation = true;
  g.counterattack.phase = 'cleared'; g.boss.x = g.boss.oldX = 200;
  g.boss.enter('hunt', g); g.carriage.phase = 'possessed'; return g;
}

test('all eight kills celebrate in the live world before the bodies melt', () => {
  const g = cleared(); assert.equal(g.boss.phase, 'victory'); assert.equal(g.score, 2000);
  const before = [g.frame, g.copterX, g.copterY, g.cloudX];
  assert.equal(g.inCinematic, false); assert.equal(g.canDrop, false);
  g.setYoke(1, 1); ticks(g, 20);
  assert.ok(g.copterX > before[1]); assert.ok(g.copterY > before[2]);
  g.setYoke(0, 0); ticks(g, LIQUID_TIMINGS.victory - 21);
  assert.equal(g.boss.phase, 'victory'); assert.equal(g.frame, before[0] + LIQUID_TIMINGS.victory - 1);
  assert.notEqual(g.cloudX, before[3]);
  ticks(g); assert.equal(g.boss.phase, 'melt'); assert.equal(g.boss.parts.length, 8);
  assert.deepEqual(g.counterattack.wrecks, []); assert.deepEqual(g.counterattack.bullets, []);
  ticks(g, LIQUID_TIMINGS.melt); assert.equal(g.boss.phase, 'flow');
  const positions = g.boss.parts.map(p => p.x); ticks(g, 50);
  assert.notDeepEqual(g.boss.parts.map(p => p.x), positions);
  ticks(g, LIQUID_TIMINGS.flow - 50); assert.equal(g.boss.phase, 'engulf');
  assert.ok(g.boss.parts.every(p => Math.abs(p.x - g.boss.x) < .001));
  ticks(g, LIQUID_TIMINGS.engulf + LIQUID_TIMINGS.reveal);
  assert.equal(g.boss.phase, 'hunt'); assert.equal(g.inCinematic, false); assert.equal(g.canDrop, true);
  assert.equal(g.counterattack.protectionTicks, 49);
});

test('only a completed eight-machine wave triggers the false victory', () => {
  const g = hunting(); g.boss.phase = 'dormant'; g.counterattack.phase = 'active'; g.counterattack.kills = 7;
  ticks(g, 5); assert.equal(g.boss.phase, 'dormant');
});

test('the takeover works with horse, pulling driver, and motorized carriage without reviving anyone', () => {
  for (const state of ['horse', 'pulling', 'motor']) {
    const g = new Game({ seed: 2 });
    if (state !== 'horse') { g.carriage.killHorse(g); ticks(g, 56); }
    if (state === 'motor') { g.carriage.killDriver(g); ticks(g, 75); }
    const deadHorse = g.carriage.deadHorse, deadDriver = g.carriage.deadDriver;
    g.boss.begin(g); ticks(g, LIQUID_TIMINGS.victory);
    assert.equal(Boolean(g.boss.escapeDriver), state !== 'motor');
    ticks(g, 400);
    assert.equal(g.boss.phase, 'hunt'); assert.equal(g.carriage.phase, 'possessed');
    assert.equal(g.carriage.deadHorse, deadHorse); assert.equal(g.carriage.deadDriver, deadDriver);
    assert.equal(g.carriage.driverAlive, state !== 'motor');
  }
});

test('the hunter travels right along the ground and wraps like the carriage', () => {
  const g = hunting(); g.boss.rocketCooldown = 10000;
  const x = g.boss.x; ticks(g, 10); assert.ok(g.boss.x > x);
  g.boss.x = g.width + 95;
  // A grenade in the middle cannot hit the creature's teleport across the screen.
  g.boss.grenades.push({ x: g.width / 2, y: g.deck - 4, vy: 5, age: 0 });
  ticks(g); assert.equal(g.boss.x, -96); assert.equal(g.boss.hits, 0);
  assert.equal(g.boss.oldX, g.boss.x);
});

test('automatic gunfire stops at victory and stays off throughout the grenade encounter', () => {
  const g = cleared();
  ticks(g, Object.values(LIQUID_TIMINGS).reduce((a, b) => a + b, 0));
  assert.equal(g.boss.phase, 'hunt'); assert.deepEqual(g.counterattack.bullets, []);
  assert.equal(g.counterattack.flash, 0); assert.equal(g.boss.grenadier, true);
  g.setYoke(-1, 0); ticks(g, 40); assert.deepEqual(g.counterattack.bullets, []);
});

test('Space releases one falling grenade, retains the stuntman, and obeys reload and pause', () => {
  const g = hunting(); g.boss.rocketCooldown = 10000;
  g.copterX = 750; g.copterY = 80;
  assert.equal(g.drop(), true); assert.equal(g.drop(), false);
  assert.equal(g.jumper, null); assert.equal(g.drops, 0);
  const x = g.boss.grenades[0].x; g.setYoke(1, 0); ticks(g, 8);
  assert.equal(g.boss.grenades[0].x, x); assert.ok(g.boss.grenades[0].vy > 1.5);
  assert.equal(g.canDrop, false); ticks(g, GRENADE_RELOAD - 8); assert.equal(g.canDrop, true);
  assert.equal(g.boss.hits, 0); g.paused = true; assert.equal(g.drop(), false);
});

test('each grenade counts once, four hits leave it alive, and the fifth clears rockets and scores once', () => {
  const g = hunting(); g.boss.rocketCooldown = 10000;
  for (let i = 1; i <= 5; i++) {
    g.boss.grenades.push({ x: g.boss.x - 65, y: g.deck - 9, vy: 11, age: 0 });
    ticks(g); assert.equal(g.boss.hits, i); assert.deepEqual(g.boss.grenades, []);
    if (i < 5) { assert.equal(g.boss.phase, 'hunt'); assert.equal(g.score, 0); }
  }
  assert.equal(g.boss.phase, 'dying'); assert.equal(g.boss.health, 0);
  assert.equal(g.score, 3000); assert.equal(g.best, 3000); assert.deepEqual(g.boss.rockets, []);
  assert.equal(g.boss.grenadeHit(g), false); ticks(g, 300); assert.equal(g.boss.phase, 'won'); assert.equal(g.score, 3000);
});

test('grenades fall through the air above the shorter horse before hitting its chrome body', () => {
  const g = hunting();
  g.boss.grenades.push({ x: g.boss.x + 25, y: g.deck - 48, vy: 1, age: 0 });
  for (let i = 0; i < 6; i++) g.boss.tickGrenades(g);
  assert.equal(g.boss.hits, 0); assert.equal(g.boss.grenades.length, 1);
  for (let i = 0; i < 20; i++) g.boss.tickGrenades(g);
  assert.equal(g.boss.hits, 1); assert.equal(g.boss.grenades.length, 0);
});

test('rockets visibly launch before steering, track with bounded turn speed, coast after fuel and expire', () => {
  const g = hunting(); g.counterattack.protectionTicks = 0; g.copterX = 850; g.copterY = 60;
  g.boss.launch(g); const r = g.boss.rockets[0], muzzle = g.boss.launcher(g);
  assert.equal(r.x, muzzle.x); assert.equal(r.y, muzzle.y);
  for (let i = 0; i < 12; i++) g.boss.tickRockets(g);
  assert.equal(r.angle, HUNTER_LAUNCH_ANGLE);
  const before = r.angle; g.boss.tickRockets(g);
  assert.ok(r.angle > before); assert.ok(r.angle - before <= ROCKET_TURN + 1e-10);
  r.age = ROCKET_FUEL; const exhaustedAngle = r.angle; g.boss.tickRockets(g); assert.equal(r.angle, exhaustedAngle);
  r.age = ROCKET_LIFE - 1; g.boss.tickRockets(g); assert.deepEqual(g.boss.rockets, []);
});

test('a pursuing rocket hits a hovering copter but can be dodged with arrow-key acceleration', () => {
  for (const dodge of [false, true]) {
    const g = hunting(); g.counterattack.protectionTicks = 0; g.boss.rocketCooldown = 10000;
    g.copterX = 500; g.copterY = 200;
    g.boss.rockets.push({ x: 520, y: 420, angle: -Math.PI / 2, age: 0, trail: [] });
    if (dodge) g.setYoke(1, 0);
    ticks(g, 180); assert.equal(g.combat.hits, dodge ? 0 : 1); assert.deepEqual(g.boss.rockets, []);
  }
});

test('pause and resize preserve the sequence, rockets, grenades, damage and reload; reset clears them', () => {
  const g = cleared(); ticks(g, 200); g.paused = true;
  const paused = JSON.stringify(g); ticks(g, 100); assert.equal(JSON.stringify(g), paused);
  g.resize(640, 1200); assert.equal(g.boss.age, 20); assert.equal(g.boss.parts.length, 8);
  assert.equal(g.cartX, g.boss.hostX); g.paused = false; ticks(g, 400);
  g.boss.rockets = []; g.boss.launch(g); g.drop(); g.boss.hits = 2; g.paused = true;
  const reload = g.boss.reload; g.resize(1400, 800);
  assert.equal(g.boss.hits, 2); assert.equal(g.boss.reload, reload);
  assert.equal(g.boss.rockets.length, 1); assert.equal(g.boss.grenades.length, 1);
  g.best = 5000; const fresh = g.reset();
  assert.equal(fresh.boss.phase, 'dormant'); assert.deepEqual(fresh.boss.rockets, []); assert.deepEqual(fresh.boss.grenades, []); assert.equal(fresh.best, 5000);
});

test('the live fight is winnable with just digital flight commands and five Space drops', () => {
  const g = hunting(); g.copterX = 270; g.copterY = g.deck - 235; let drops = 0;
  for (let t = 0; t < 1500 && g.canFly && g.boss.phase !== 'won'; t++) {
    const b = g.boss;
    const steer = (error, velocity) => Math.abs(error) < 4 && Math.abs(velocity) < .5 ? 0 : Math.sign(error - velocity * Math.abs(velocity) * 6.25);
    g.setYoke(steer(b.x + 45 - g.copterX, g.dh), steer(g.deck - 235 - g.copterY, g.dv));
    if (b.canGrenade && Math.abs(g.hangingPosition.x + 14 + g.counterattack.facing * 12 - b.x - 50) < 40 && g.drop()) drops++;
    ticks(g); assert.deepEqual(g.counterattack.bullets, []);
  }
  assert.equal(g.boss.phase, 'won'); assert.equal(g.canFly, true); assert.equal(drops, 5); assert.equal(g.score, 3000);
});
