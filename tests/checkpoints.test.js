import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HZ } from '../src/game.js';
import { COUNTERATTACK_WAIT_TICKS, CINEMATIC_TICKS } from '../src/counterattack.js';
import { LIQUID_TIMINGS } from '../src/liquid-boss.js';

const ticks = (g, count = 1) => { for (let i = 0; i < count; i++) g.step(1 / HZ); };
function matrix() {
  const g = new Game({ seed: 5 }); g.cloudEnabled = false;
  for (let i = 0; i < 6; i++) {
    g.copterX = g.cartX + 220; g.copterY = g.deck - 72; g.drop(); ticks(g, 13);
  }
  return g;
}
function armed() {
  const g = matrix(); g.retaliation = true;
  for (let i = 0; i < 8; i++) g.combat.miss(g, 50 + i * 110);
  for (const s of g.combat.shooters) s.cooldown = 10000;
  ticks(g, COUNTERATTACK_WAIT_TICKS + CINEMATIC_TICKS);
  return g;
}
function crash(g) {
  g.retaliation = true; g.combat.hits = 2; g.combat.hurtTicks = 0; g.counterattack.protectionTicks = 0;
  assert.equal(g.combat.hit(g), true); ticks(g, 156);
  assert.equal(g.state, 'game_over');
}

test('the sixth completed miss saves the Matrix chapter; Continue repairs the copter without replaying classic flight', () => {
  const g = matrix();
  assert.equal(g.checkpoint.segment, 1); assert.equal(g.checkpoint.snapshot.jumper, null);
  const entry = JSON.stringify(g.checkpoint);
  ticks(g, 30); crash(g);
  const continued = g.continueSegment();
  assert.equal(continued.state, 'ready'); assert.equal(continued.shiftCount, 6);
  assert.equal(continued.counterattack.created, 0); assert.equal(continued.autoDeploy, true);
  assert.equal(continued.combat.hits, 0); assert.equal(continued.jumper, null);
  assert.equal(continued.paused, false); assert.ok(continued.combat.hurtTicks > 0);
  const drops = continued.drops; ticks(continued, 25); assert.equal(continued.drops, drops + 1);
  assert.equal(JSON.stringify(continued.checkpoint), entry, 'retry cannot mutate its saved entry');
});

test('counterattack Continue restores all eight enemies and the armed gunner without repeating the cutscene', () => {
  const g = armed(); assert.equal(g.checkpoint.segment, 2);
  const victim = g.combat.shooters[0];
  g.counterattack.hit(g, victim, { vx: 10 }); g.counterattack.hit(g, victim, { vx: 10 });
  assert.equal(g.score, 250); crash(g);
  const continued = g.continueSegment();
  assert.equal(continued.counterattack.phase, 'active'); assert.equal(continued.inCinematic, false);
  assert.equal(continued.counterattack.kills, 0); assert.equal(continued.combat.shooters.length, 8);
  assert.ok(continued.combat.shooters.every(s => s.health === 2));
  assert.equal(continued.score, 0); assert.equal(continued.best, 250);
  assert.equal(continued.drop(), false); ticks(continued);
  assert.ok(continued.counterattack.bullets.length > 0);
});

test('hunter Continue keeps earlier points, restores five-hit fight and preserves settings across a resized screen', () => {
  const g = armed();
  for (const victim of [...g.combat.shooters]) {
    g.counterattack.hit(g, victim, { vx: 10 }); g.counterattack.hit(g, victim, { vx: 10 });
  }
  ticks(g); ticks(g, LIQUID_TIMINGS.victory + LIQUID_TIMINGS.melt + LIQUID_TIMINGS.flow + LIQUID_TIMINGS.engulf + LIQUID_TIMINGS.reveal);
  assert.equal(g.checkpoint.segment, 3); assert.equal(g.boss.phase, 'hunt');
  g.boss.hits = 3; g.boss.reload = 20; crash(g);
  g.setAccelerationTime(1.3); g.resize(640, 1200); g.best = 4000; g.runner.best = 123;
  const continued = g.continueSegment();
  assert.deepEqual([continued.width, continued.height, continued.accelerationTime], [640, 1200, 1.3]);
  assert.equal(continued.boss.phase, 'hunt'); assert.equal(continued.boss.hits, 0);
  assert.equal(continued.boss.reload, 0); assert.equal(continued.score, 2000);
  assert.equal(continued.best, 4000); assert.equal(continued.runner.best, 123);
  assert.equal(continued.counterattack.kills, 8); assert.equal(continued.combat.shooters.length, 0);
  assert.deepEqual(continued.boss.rockets, []); assert.equal(continued.combat.hit(continued), false);
  assert.equal(continued.drop(), true); assert.equal(continued.boss.grenades.length, 1);
  const fresh = continued.reset();
  assert.equal(fresh.checkpoint.segment, 0); assert.equal(fresh.shiftCount, 0);
  assert.equal(fresh.score, 0); assert.equal(fresh.best, 4000);
});

test('checkpoints preserve the burned hay and carriage takeover as earlier progress', () => {
  const g = new Game(); g.carriage.killDriver(g); ticks(g, 80);
  g.carriage.hayBurning = true; g.shiftCount = 6; ticks(g);
  assert.equal(g.checkpoint.segment, 1); crash(g);
  const continued = g.continueSegment();
  assert.equal(continued.carriage.phase, 'motor'); assert.equal(continued.carriage.driverAlive, false);
  assert.equal(continued.carriage.hayBurning, true);
  assert.equal(continued.carriage.deadDriver.x, g.checkpoint.snapshot.carriage.deadDriver.x);
  const x = continued.cartX; ticks(continued); assert.ok(continued.cartX > x);
});
