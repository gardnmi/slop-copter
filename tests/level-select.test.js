import { pilotCarrier } from './helpers/carrier-pilot.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, TEST_LEVELS } from '../src/level-select.js';
import { HZ } from '../src/game.js';

const tick = (g, count) => { for (let i = 0; i < count; i++) g.step(1 / HZ); };

test('level entrances are fresh, retain flight settings and can advance at desktop and portrait sizes', () => {
  for (const [width, height] of [[1280, 800], [480, 960]]) for (const level of TEST_LEVELS) {
    const g = createLevel(level.id, { seed: 41, width, height, best: 7200, bestRun: 950, accelerationTime: .8 });
    assert.equal(g.width, width, level.id); assert.equal(g.height, height, level.id);
    assert.equal(g.accelerationTime, .8); assert.equal(g.best, 7200); assert.equal(g.runner.best, 950);
    assert.equal(g.score, 0); assert.equal(g.paused, false); assert.equal(g.state, 'ready');
    tick(g, 10);
    assert.equal(g.canFly, true, level.id);
    assert.ok(Number.isFinite(g.copterX) && Number.isFinite(g.runner.x) && Number.isFinite(g.assault.x), level.id);
  }
  assert.throws(() => createLevel('missing-level'), RangeError);
});

test('selected counterattack progresses through false victory into a working grenade boss', () => {
  const g = createLevel('counterattack', { seed: 3 });
  assert.equal(g.combat.shooters.length, 8);
  for (const victim of [...g.combat.shooters]) {
    g.counterattack.hit(g, victim, { vx: 1 }); g.counterattack.hit(g, victim, { vx: 1 });
  }
  tick(g, 1);
  assert.equal(g.boss.phase, 'victory'); assert.equal(g.counterattack.wrecks.length, 8);
  tick(g, 515);
  assert.equal(g.boss.phase, 'hunt'); assert.equal(g.checkpoint.segment, 3);
  assert.equal(g.drop(), true); assert.equal(g.boss.grenades.length, 1);
});

test('boss selection continues the same fight with all five grenade hits still required', () => {
  const g = createLevel('chrome-carriage', { width: 1200, height: 780, accelerationTime: .9 });
  g.boss.grenadeHit(g); g.state = 'game_over';
  const next = g.continueSegment();
  assert.equal(next.boss.phase, 'hunt'); assert.equal(next.boss.hits, 0);
  assert.equal(next.boss.canGrenade, true); assert.equal(next.combat.hits, 0);
  assert.equal(next.width, 1200); assert.equal(next.accelerationTime, .9);
});

test('selected self-destruct can reach the rooftops, and a failed escape retries its countdown', () => {
  const g = createLevel('self-destruct', { seed: 5 });
  for (let n = 0; n < 1500 && !g.runner.running && g.canFly; n++) { g.setYoke(1, 0); tick(g, 1); }
  assert.equal(g.runner.phase, 'running'); assert.ok(g.runner.blastX !== null);
  const idle = createLevel('self-destruct', { seed: 5 });
  for (let n = 0; n < 1100 && idle.state !== 'game_over'; n++) tick(idle, 1);
  assert.equal(idle.state, 'game_over');
  const next = idle.continueSegment();
  assert.equal(next.boss.phase, 'dying'); assert.equal(next.boss.selfDestructTicks, 600);
  assert.equal(next.runner.active, false); assert.equal(next.canFly, true);
});

test('pickup selection can be jumped into and flows naturally into the overhead game', () => {
  for (const [width, height] of [[1280, 800], [480, 960]]) {
    const g = createLevel('rescue', { seed: 7, width, height });
    tick(g, 125); assert.equal(g.runner.rescue.stage, 'boarding');
    g.runner.pressJump(); tick(g, 8); g.runner.releaseJump();
    assert.equal(g.runner.phase, 'lifting');
    tick(g, 260); assert.equal(g.assault.phase, 'turn');
    tick(g, 150); assert.equal(g.assault.phase, 'flight');
  }
});

test('air sections and the hostile airship have correct retry checkpoints, full armor', () => {
  for (const id of ['burning-city', 'freeway', 'shipyards', 'carrier-approach', 'airship']) {
    const g = createLevel(id, { seed: 10 });
    const phase = g.assault.phase, route = g.assault.route;
    for (let i = 0; i < 6; i++) { g.assault.hurt = 0; g.assault.hurtPlayer(g); }
    tick(g, 30); assert.equal(g.assault.dead, true);
    g.continueSegment();
    assert.equal(g.assault.phase, phase, id); assert.equal(g.assault.route, route, id);
    assert.equal(g.assault.health, 6);
  }
});

test('selected landing starts a fresh playable deck raid with the spacecraft still ahead', () => {
  const g = createLevel('landing');
  assert.equal(g.assault.recovery.status, 'flying');
  for (let i = 0; i < 1500 && !g.boarding.active && !g.assault.dead; i++) { pilotCarrier(g); tick(g, 1); }
  assert.equal(g.assault.phase, 'secured');
  assert.equal(g.boarding.phase, 'raid'); assert.equal(g.boarding.health, 5); assert.equal(g.boarding.x, 100);
});
