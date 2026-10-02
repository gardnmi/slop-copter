import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HZ } from '../src/game.js';
import { DRIVER_EXIT_TICKS, DRIVER_PULL_OFFSET, ENGINE_START_TICKS } from '../src/carriage.js';

function ticks(game, count = 1) { for (let i = 0; i < count; i++) game.step(1 / HZ); }
function lowDrop(game, offset = 32) {
  game.cloudEnabled = false;
  game.copterPitch = 0;
  game.copterX = game.cartX + offset;
  game.copterY = game.deck - 72;
  assert.equal(game.drop(), true);
  ticks(game);
  assert.equal(game.state, 'result');
  const outcome = game.outcome;
  ticks(game, outcome === 'hay' ? 45 : 12);
  return outcome;
}
function twoCatches(game) {
  assert.equal(lowDrop(game), 'hay');
  assert.equal(lowDrop(game), 'hay');
  assert.equal(game.landingStreak, 2);
}
function finishFall(game) {
  for (let i = 0; game.state === 'falling' && i < 800; i++) ticks(game);
  assert.equal(game.state, 'result');
}

test('two real catches cause a last-second bolt and a third miss, then reset the streak', () => {
  const g = new Game(); twoCatches(g);
  const score = g.score, cartX = g.cartX;
  assert.equal(lowDrop(g), 'ground');
  assert.ok(g.cartX > cartX + 40);
  assert.equal(g.catches, 2); assert.equal(g.misses, 1); assert.equal(g.score, score);
  assert.equal(g.landingStreak, 0); assert.equal(g.shiftCount, 1);
  assert.equal(g.carriage.dodging, false);
  assert.equal(lowDrop(g), 'hay');
});

test('the third attempt brakes when stopping leaves the jumper beyond the hay', () => {
  const g = new Game(); twoCatches(g);
  g.cartX = 100; g.copterX = 228; g.copterY = -8;
  // At normal speed this is a safe high drop; holding at x=100 spoils it.
  const normal = new Game(); normal.cloudEnabled = false;
  normal.cartX = 100; normal.copterX = 228; normal.copterY = -8;
  normal.drop(); finishFall(normal); assert.equal(normal.outcome, 'hay');
  g.drop(); ticks(g);
  assert.equal(g.carriage.trick, 'brake'); assert.equal(g.cartX, 100);
  finishFall(g); assert.notEqual(g.outcome, 'hay');
  assert.equal(g.catches, 2); assert.equal(g.landingStreak, 0);
});

test('the streak spans five-jump rounds and any miss breaks it', () => {
  const g = new Game();
  for (const offset of [200, 32, 200, 32, 32]) lowDrop(g, offset);
  assert.deepEqual(g.history, []); assert.equal(g.landingStreak, 2);
  assert.notEqual(lowDrop(g), 'hay');
  assert.equal(g.landingStreak, 0);
});

test('carriage tricks remain active in the fully digital world and stop when retaliation starts', () => {
  const g = new Game(); g.shiftCount = 6; twoCatches(g);
  assert.notEqual(lowDrop(g), 'hay');
  assert.equal(g.retaliation, true); assert.equal(g.combat.shooters.length, 1);
  // Finish enough perfect attempts to advance a level while the crew prepares.
  for (let i = 0; i < 3; i++) assert.equal(lowDrop(g), 'hay');
  assert.equal(g.carriage.dodging, false); assert.equal(g.carriage.trick, null);
});

test('evasion follows cloud drift and works across screen sizes, edges, and drop heights', () => {
  for (const width of [640, 1024, 1800]) for (const y of [-8, 180, 418]) for (const x of [-70, 160, width - 4, width + 40]) {
    const g = new Game({ seed: 41, width }); twoCatches(g);
    g.cartX = Math.max(-140, Math.min(width - 2, x - 40));
    g.cloudEnabled = true; g.cloudX = x - 80; g.cloudY = 100;
    g.copterX = x; g.copterY = Math.min(y, g.deck - 72);
    g.drop(); finishFall(g);
    assert.notEqual(g.outcome, 'hay', `width=${width}, x=${x}, y=${y}`);
  }
});

test('pause and resize preserve an active trick without allowing the third catch', () => {
  const g = new Game(); twoCatches(g);
  g.copterY = 100; g.drop(); ticks(g, 3);
  g.paused = true;
  const frozen = JSON.stringify(g); ticks(g, 50); assert.equal(JSON.stringify(g), frozen);
  g.resize(640, 1100);
  assert.equal(g.carriage.dodging, true);
  g.paused = false; finishFall(g); assert.notEqual(g.outcome, 'hay');
});

test('hitting the horse leaves it down while the driver hops out and pulls the cart', () => {
  const g = new Game();
  assert.equal(lowDrop(g, 110), 'horse');
  assert.equal(g.carriage.horseAlive, false); assert.equal(g.carriage.phase, 'dismount');
  assert.equal(g.wagonLabel, 'STOP');
  const x = g.cartX, deadX = g.carriage.deadHorse.x;
  const first = g.carriage.driverPosition(g);
  ticks(g, 18);
  const jumping = g.carriage.driverPosition(g);
  assert.equal(g.cartX, x); assert.ok(jumping.x > first.x); assert.ok(jumping.feet < first.feet);
  ticks(g, DRIVER_EXIT_TICKS - g.carriage.transitionTick);
  assert.equal(g.carriage.phase, 'pulling'); assert.equal(g.wagonLabel, 'PULL');
  assert.ok(g.carriage.driverPosition(g).x - 10 > deadX + 58, 'both feet clear the fallen horse');
  assert.equal(g.carriage.pullDistance, 0, 'the first step starts on landing');
  ticks(g, 20);
  assert.ok(g.cartX > x); assert.equal(g.carriage.deadHorse.x, deadX);
  assert.ok(Math.abs(g.carriage.pullDistance - (g.cartX - x)) < 1e-9);
  assert.equal(g.carriage.collisionAt(g, g.cartX + 138), 'ground');
  assert.equal(lowDrop(g), 'hay');
  const fresh = g.reset();
  assert.equal(fresh.carriage.horseAlive, true); assert.equal(fresh.carriage.deadHorse, null);
  assert.equal(fresh.landingStreak, 0);
});

test('horse death and driver takeover survive pause, resize, and the digital transformation', () => {
  const g = new Game(); g.shiftCount = 1; lowDrop(g, 110);
  assert.equal(g.shiftCount, 2);
  const deadX = g.carriage.deadHorse.x;
  g.paused = true; const tick = g.carriage.transitionTick;
  ticks(g, 100); assert.equal(g.carriage.transitionTick, tick);
  g.resize(640, 1100);
  assert.equal(g.carriage.deadHorse.x, deadX * 640 / 1024);
  g.paused = false; ticks(g, DRIVER_EXIT_TICKS);
  assert.equal(g.carriage.phase, 'pulling');
  g.carriage.deadHorse.x = 60; g.cartX = g.width - 1;
  ticks(g); assert.ok(g.cartX < 0); assert.equal(g.carriage.deadHorse.x, 60);
  assert.ok(g.carriage.driverPosition(g).x + 16 < 0, 'the whole pulling team wraps offscreen');
});

test('hitting the pulling driver starts the engine, leaves both bodies behind, and accelerates the buggy', () => {
  const g = new Game(); lowDrop(g, 110); ticks(g, DRIVER_EXIT_TICKS);
  assert.equal(lowDrop(g, DRIVER_PULL_OFFSET), 'driver');
  const cart = g.carriage, x = g.cartX, corpse = cart.deadDriver.x;
  assert.equal(cart.driverAlive, false); assert.equal(cart.phase, 'starting');
  assert.equal(g.wagonLabel, 'IGNITION'); assert.ok(cart.deadHorse); assert.equal(cart.looseHorse, null);
  ticks(g, 8); assert.equal(g.cartX, x); assert.ok(cart.exhaust.length >= 5);
  const puff = cart.exhaust[0], puffX = puff.x; ticks(g, 5); assert.ok(puff.x < puffX);
  ticks(g, ENGINE_START_TICKS - cart.engineTick);
  assert.equal(cart.phase, 'motor'); assert.equal(g.wagonLabel, 'DRIVE');
  ticks(g); const firstSpeed = cart.motion;
  ticks(g, 40); assert.ok(cart.motion > firstSpeed); assert.equal(cart.motion, 4.4);
  assert.ok(g.cartX > x); assert.equal(cart.deadDriver.x, corpse);
  assert.ok(cart.exhaust.some(puff => !puff.burst));
  assert.equal(cart.collisionAt(g, g.cartX + 76), 'ground');
  assert.equal(cart.collisionAt(g, g.cartX + DRIVER_PULL_OFFSET), 'ground');
  assert.equal(lowDrop(g), 'hay');
  const fresh = g.reset().carriage;
  assert.equal(fresh.driverAlive, true); assert.equal(fresh.deadDriver, null);
  assert.equal(fresh.motorized, false); assert.deepEqual(fresh.exhaust, []);
});

test('a hit on the seated driver lets the living horse run free and starts the same engine sequence', () => {
  const g = new Game(); assert.equal(lowDrop(g, 78), 'driver');
  const cart = g.carriage;
  assert.equal(cart.driverAlive, false); assert.equal(cart.phase, 'starting');
  assert.equal(cart.deadHorse, null); assert.ok(cart.looseHorse);
  const horseX = cart.looseHorse.x, x = g.cartX;
  ticks(g, 8); assert.ok(cart.looseHorse.x > horseX); assert.equal(g.cartX, x);
  ticks(g, 150); assert.equal(cart.looseHorse, null); assert.equal(cart.phase, 'motor');
  assert.equal(cart.collisionAt(g, g.cartX + 110), 'ground');
});

test('pause and resize preserve ignition, grounded bodies, and exhaust; wrapping leaves them behind', () => {
  const g = new Game(); lowDrop(g, 78); ticks(g, 10);
  const cart = g.carriage, deadX = cart.deadDriver.x, puff = cart.exhaust[0];
  const puffX = puff.x, fromGround = puff.y - g.deck;
  g.paused = true; const frozen = JSON.stringify(g); ticks(g, 100); assert.equal(JSON.stringify(g), frozen);
  g.resize(640, 1100);
  assert.equal(cart.deadDriver.x, deadX * 640 / 1024);
  assert.equal(puff.x, puffX * 640 / 1024); assert.equal(puff.y - g.deck, fromGround);
  g.paused = false; ticks(g, ENGINE_START_TICKS);
  const corpse = cart.deadDriver.x; g.cartX = g.width - 1;
  ticks(g); assert.ok(g.cartX < 0); assert.equal(cart.deadDriver.x, corpse);
});

test('the motorized cart still dodges the third catch until retaliation begins', () => {
  const g = new Game(); lowDrop(g, 78); ticks(g, ENGINE_START_TICKS);
  twoCatches(g); assert.notEqual(lowDrop(g), 'hay');
  assert.equal(g.carriage.phase, 'motor');
  g.retaliation = true;
  for (let i = 0; i < 3; i++) assert.equal(lowDrop(g), 'hay');
});
