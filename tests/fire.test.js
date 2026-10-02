import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HZ, FIRE_DEATH_TICKS } from '../src/game.js';

const ticks = (g, count = 1) => { for (let i = 0; i < count; i++) g.step(1 / HZ); };
function cloudDrop(themed = true) {
  const g = new Game({ seed: 7 });
  g.shiftCount = themed ? 1 : 0;
  g.copterX = 400; g.copterY = 20;
  g.cloudX = 300; g.cloudY = 130; g.cloudIndex = 2;
  g.cartX = 164;
  g.drop();
  return g;
}
function finishFall(g) {
  for (let i = 0; g.state === 'falling' && i < 500; i++) ticks(g);
  assert.equal(g.state, 'result');
}

test('only the transformed cloud ignites a real falling stuntman, without changing his drift', () => {
  const classic = cloudDrop(false), burning = cloudDrop();
  ticks(classic, 11); ticks(burning, 11);
  assert.equal(classic.jumper.inCloud, true);
  assert.equal(classic.jumper.burning, false);
  assert.equal(burning.jumper.burning, true);
  ticks(classic, 70); ticks(burning, 70);
  assert.equal(burning.jumper.inCloud, false);
  assert.equal(burning.jumper.burning, true, 'fire survives leaving the cloud');
  assert.deepEqual([classic.jumper.x, classic.jumper.y], [burning.jumper.x, burning.jumper.y]);
  assert.equal(classic.random(), burning.random(), 'flames do not disturb gameplay randomness');
  for (const enabled of [true, false]) {
    const g = cloudDrop(); g.cloudEnabled = enabled;
    if (enabled) { g.jumper.x = g.cloudX + 2; g.jumper.y = g.cloudY; }
    ticks(g, enabled ? 1 : 30);
    assert.equal(g.jumper.burning, false, 'empty corners and disabled clouds are harmless');
  }
});

test('a burning landing ignites the hay; a later unburned stuntman dies and earns no catch or points', () => {
  const g = cloudDrop(); finishFall(g);
  assert.equal(g.outcome, 'hay'); assert.equal(g.carriage.hayBurning, true);
  assert.equal(g.catches, 1); const score = g.score;
  ticks(g, 45);
  g.cloudEnabled = false; g.copterX = g.cartX + 32; g.copterY = g.deck - 72;
  assert.equal(g.drop(), true); assert.equal(g.jumper.burning, false);
  ticks(g);
  assert.equal(g.outcome, 'fire'); assert.equal(g.jumper.burning, true);
  assert.equal(g.catches, 1); assert.equal(g.score, score);
  assert.equal(g.misses, 1); assert.equal(g.landingStreak, 0);
  assert.deepEqual(g.history, [true, false]);
  ticks(g, FIRE_DEATH_TICKS - 1);
  assert.equal(g.state, 'result'); assert.equal(g.shiftCount, 1);
  ticks(g); assert.equal(g.state, 'ready'); assert.equal(g.shiftCount, 2);
  assert.equal(g.carriage.hayBurning, true);
});

test('burning misses on the ground, horse or driver do not remotely ignite hay', () => {
  for (const [offset, outcome] of [[250, 'ground'], [110, 'horse'], [78, 'driver']]) {
    const g = new Game(); g.shiftCount = 1;
    g.copterX = g.cartX + offset; g.copterY = g.deck - 72;
    g.drop(); g.jumper.burning = true; ticks(g);
    assert.equal(g.outcome, outcome); assert.equal(g.carriage.hayBurning, false);
  }
});

test('hay keeps burning through carriage forms, wrap, pause and resize; liquid metal and reset extinguish it', () => {
  for (const phase of ['horse', 'pulling', 'starting', 'motor']) {
    const g = cloudDrop(); finishFall(g); ticks(g, 45);
    g.carriage.phase = phase; g.carriage.driverAlive = !g.carriage.motorized;
    g.paused = true; const frozen = JSON.stringify(g); ticks(g, 100);
    assert.equal(JSON.stringify(g), frozen);
    g.resize(640, 1100); assert.equal(g.carriage.hayBurning, true);
    g.paused = false; ticks(g, 80); g.cartX = g.width - .1; ticks(g);
    assert.ok(g.cartX < 0); assert.equal(g.carriage.hayBurning, true);
    assert.equal(g.reset().carriage.hayBurning, false);
    g.boss.enter('engulf', g); assert.equal(g.carriage.hayBurning, false);
  }
});

test('a fatal hay landing in the Matrix world joins the Terminator progression', () => {
  const g = new Game(); g.shiftCount = 6; g.carriage.hayBurning = true;
  g.copterX = g.cartX + 32; g.copterY = g.deck - 72; g.drop(); ticks(g);
  assert.equal(g.outcome, 'fire'); ticks(g, FIRE_DEATH_TICKS);
  assert.equal(g.retaliation, true); assert.equal(g.counterattack.created, 1);
  assert.equal(g.combat.shooters.length, 1);
  assert.equal(g.combat.shooters[0].x, g.cartX + 44);
});
