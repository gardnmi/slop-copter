import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_RETRY_TICKS } from '../src/game.js';
import { createLevel } from '../src/level-select.js';
import { CARRIER_ARRIVAL_TICKS } from '../src/air-assault.js';
import { CARRIER_LINEUP_TICKS } from '../src/carrier-lineup.js';
const ticks = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(.02); };

for (const level of ['classic', 'matrix', 'counterattack', 'chrome-carriage', 'self-destruct', 'rooftops', 'rescue',
  'burning-city', 'airship', 'landing', 'deck-raid', 'deck-helicopter', 'spaceship', 'elevator', 'downwell', 'downwell-storm', 'slop-eater-fight']) {
  test(`${level} automatically retries its own checkpoint without losing earlier progress`, () => {
    const g = createLevel(level, { seed: 5, best: 9999, accelerationTime: .8 });
    const expected = { orbit: g.orbit.phase, band: g.orbit.band, deck: g.boarding.phase,
      air: g.assault.phase, route: g.assault.route, runner: g.runner.phase, segment: g.checkpoint.segment };
    g.completedLoops = 2;
    if (g.orbit.active) { g.orbit.health = 1; g.orbit.hurt = 0; g.orbit.hurtPlayer(g); }
    else if (g.boarding.active) { g.boarding.health = 1; g.boarding.hurt = 0; g.boarding.hurtPlayer(g); }
    else if (g.assault.active) { g.assault.health = 1; g.assault.hurt = 0; g.assault.hurtPlayer(g); }
    else if (g.runner.running || g.runner.rescue) g.runner.die(g, 'Test fall.');
    else g.state = 'game_over';
    assert.equal(g.awaitingRetry, true);
    ticks(g, AUTO_RETRY_TICKS - 1); assert.equal(g.awaitingRetry, true);
    g.paused = true; const frozen = JSON.stringify(g); ticks(g, 100);
    assert.equal(JSON.stringify(g), frozen); g.paused = false;
    ticks(g); assert.equal(g.awaitingRetry, false); assert.equal(g.retrySerial, 1);
    assert.equal(g.completedLoops, 2); assert.equal(g.best, 9999); assert.equal(g.accelerationTime, .8);
    assert.equal(g.checkpoint.segment, expected.segment);
    assert.equal(g.orbit.phase, expected.orbit); assert.equal(g.orbit.band, expected.band);
    assert.equal(g.boarding.phase, expected.deck); assert.equal(g.assault.phase, expected.air);
    assert.equal(g.assault.route, expected.route);
    assert.equal(g.controlX, 0); assert.equal(g.controlY, 0);
  });
}

test('automatic restart is independent of rendering cadence and consumes pending frame time', () => {
  const make = () => { const g = createLevel('counterattack'); g.state = 'game_over'; return g; };
  const a = make(), b = make();
  for (let n = 0; n < 13; n++) a.step(.1);
  ticks(b, 65);
  assert.equal(a.retrySerial, 1); assert.equal(a.frame, b.frame);
  assert.ok(Math.abs(a.accumulator - b.accumulator) < 1e-12); assert.equal(a.counterattack.phase, b.counterattack.phase);
});

test('carrier arrival restores the alignment cinematic, then hands its exact pose to playable landing', () => {
  const g = createLevel('carrier'), a = g.assault;
  ticks(g, CARRIER_ARRIVAL_TICKS); assert.equal(a.phase, 'lineup'); assert.equal(g.inCinematic, true);
  const r = a.recovery; g.setYoke(1, -1); ticks(g, 100);
  assert.equal(r.fuel, 100); assert.equal(r.status, 'approach');
  g.paused = true; const frozen = JSON.stringify(r); ticks(g, 150); assert.equal(JSON.stringify(r), frozen);
  g.resize(390, 844); assert.equal(JSON.stringify(r), frozen); g.paused = false;
  ticks(g, CARRIER_LINEUP_TICKS - 101);
  const before = { x: r.x, y: r.y, camera: r.camera, shipX: r.shipX };
  ticks(g); assert.equal(a.phase, 'landing'); assert.equal(a.recovery, r);
  for (const key of Object.keys(before)) assert.ok(Math.abs(r[key] - before[key]) < 2, key);
  assert.equal(r.fuel, 100); assert.equal(r.status, 'flying'); assert.equal(g.inCinematic, false);
  assert.equal(g.controlX, 0); assert.equal(g.controlY, 0);
  assert.equal(a.checkpoint.data.phase, 'landing');
  g.setYoke(0, -1); ticks(g, 5); assert.ok(r.fuel < 100);
});
