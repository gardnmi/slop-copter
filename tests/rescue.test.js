import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HZ } from '../src/game.js';
import { RESCUE_AFTER_TICKS, RESCUE_APPROACH_TICKS, RESCUE_WINDOW_TICKS, runnerView } from '../src/runner.js';

const ticks = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(1 / HZ); };
function flat(speed = 300) {
  const g = new Game({ seed: 4 }), r = g.runner;
  g.score = 5000; r.phase = 'running'; r.x = r.runOrigin = 100; r.y = 220; r.speed = speed;
  r.roofs = [r.roof(-100, 220, 20000, 'roof')]; r.grounded = true; r.roofId = r.roofs[0].id;
  r.cameraX = r.x - r.viewWidth * .23; r.cameraY = r.y - r.viewHeight * .68;
  return g;
}
function pickup(speed = 300) {
  const g = flat(speed), r = g.runner; r.runTicks = RESCUE_AFTER_TICKS - 1;
  ticks(g, RESCUE_APPROACH_TICKS + 1);
  assert.equal(r.rescue.stage, 'boarding'); return g;
}
function autoJump(r) {
  if (!r.running) return;
  if (r.grounded) {
    r.releaseJump();
    const roof = r.roofs.find(roof => roof.id === r.roofId);
    const obstacle = roof.items.find(item => !item.hit && item.kind !== 'glass' && item.x > r.x);
    const edge = roof.x + roof.width - r.x < r.speed * .10 + 9;
    if (r.rescue?.stage === 'boarding' || edge || obstacle && obstacle.x - r.x < r.speed * .12 + 10) {
      r.testHop = !edge && r.rescue?.stage !== 'boarding'; r.pressJump();
    }
  }
  if (r.testHop && r.jumpAge >= .06) r.releaseJump();
}

test('pickup starts after twenty seconds of surviving running; pause does not count and zoom eases out', () => {
  const g = flat(), r = g.runner, width = runnerView(g).width;
  ticks(g, RESCUE_AFTER_TICKS - 1); assert.equal(r.rescue, null);
  g.paused = true; ticks(g, 500); assert.equal(r.runTicks, RESCUE_AFTER_TICKS - 1);
  g.paused = false; ticks(g); assert.equal(r.phase, 'rescue'); assert.equal(r.zoom, 1);
  ticks(g, 50); assert.ok(r.zoom < 1 && r.zoom > .82);
  ticks(g, 50); assert.ok(Math.abs(r.zoom - .82) < 1e-10); assert.ok(runnerView(g).width > width * 1.2);
  assert.equal(r.rescueCheckpoint.runTicks, RESCUE_AFTER_TICKS);
});

test('an ordinary jump grabs the rail at slow and fast speeds; standing below never auto-boards', () => {
  for (const speed of [100, 300, 650]) {
    const g = pickup(speed), r = g.runner;
    ticks(g, 30); assert.equal(r.phase, 'rescue'); assert.equal(r.grounded, true);
    assert.equal(g.drop(), true);
    for (let n = 0; n < 25 && r.phase === 'rescue'; n++) ticks(g);
    assert.equal(r.phase, 'lifting', `jump at speed ${speed}`);
    assert.equal(r.jumpHeld, false); assert.equal(g.canDrop, false);
    assert.equal(r.y, r.rescue.y + 22);
    const offset = r.x - r.rescue.x, score = g.score, distance = r.distance;
    ticks(g, 225); assert.equal(r.phase, 'escaped'); assert.ok(Math.abs(r.x - r.rescue.x - offset) < 1e-8);
    assert.equal(r.distance, distance); assert.equal(g.score, score);
    ticks(g, 500); assert.equal(r.phase, 'escaped'); assert.equal(r.distance, distance);
  }
});

test('missing the five-second window loses the helicopter and continues the blast chase', () => {
  const g = pickup(), r = g.runner;
  r.blastX = r.x - 180; r.blastSpeed = r.speed;
  ticks(g, RESCUE_WINDOW_TICKS - 1); assert.equal(r.phase, 'rescue'); assert.equal(r.rescue.stage, 'boarding');
  ticks(g); assert.equal(r.rescue.stage, 'gone'); assert.equal(r.phase, 'rescue');
  const x = r.rescue.x;
  for (let n = 0; n < 150 && !r.dead; n++) ticks(g);
  assert.equal(r.dead, true); assert.match(r.reason, /blast/); assert.ok(r.rescue.x > x);
});

test('a pickup retry keeps the earned distance and score and gives a fresh, playable approach', () => {
  const g = flat(), r = g.runner; ticks(g, RESCUE_AFTER_TICKS + RESCUE_APPROACH_TICKS);
  const saved = r.rescueCheckpoint, checkpointDistance = saved.distance;
  ticks(g, 80); r.die(g, 'Missed the pickup.'); ticks(g, 25);
  assert.equal(r.retry(g), true);
  const next = g.runner;
  assert.equal(next.phase, 'rescue'); assert.equal(next.distance, checkpointDistance);
  assert.equal(next.rescue.stage, 'approach'); assert.equal(next.age, 0); assert.equal(next.zoom, 1);
  assert.equal(g.score, 5000); assert.equal(next.grounded, true); assert.equal(next.x - next.blastX, 190);
  ticks(g, RESCUE_APPROACH_TICKS); assert.equal(next.rescue.window, RESCUE_WINDOW_TICKS);
  g.drop(); ticks(g, 10); assert.equal(next.phase, 'lifting');
  assert.equal(saved.rescue.stage, 'approach', 'the checkpoint is not mutated by play');
  assert.equal(g.reset().runner.rescue, null);
});

test('pause and viewport changes preserve the pickup position, rail and jump, including while attached', () => {
  const g = pickup(), r = g.runner; g.drop(); ticks(g, 2);
  g.paused = true; const frozen = JSON.stringify(r); ticks(g, 100); assert.equal(JSON.stringify(r), frozen);
  const geometry = [r.x, r.y, r.vy, r.rescue.x, r.rescue.y, JSON.stringify(r.roofs)];
  g.resize(390, 844); assert.deepEqual([r.x, r.y, r.vy, r.rescue.x, r.rescue.y, JSON.stringify(r.roofs)], geometry);
  g.paused = false; g.drop(); ticks(g, 10); assert.equal(r.phase, 'lifting');
  const grip = r.x - r.rescue.x;
  g.resize(1280, 720); ticks(g, 30); assert.equal(r.x - r.rescue.x, grip);
});

test('the full natural run reaches extraction using jump alone, across multiple generated cities', () => {
  for (const seed of [1, 4, 17, 41, 89]) {
    const g = new Game({ seed }); g.shiftCount = 6; g.retaliation = true; g.counterattack.phase = 'cleared';
    g.boss.x = 250; g.boss.enter('hunt', g); g.carriage.phase = 'possessed';
    for (let i = 0; i < 5; i++) g.boss.grenadeHit(g);
    let visible = null;
    for (let n = 0; n < 3500 && !g.runner.dead && g.runner.phase !== 'escaped'; n++) {
      const r = g.runner;
      if (r.flying) g.setYoke(1, 0);
      autoJump(r);
      if (r.runTicks === RESCUE_AFTER_TICKS - 1) visible = r.roofs.filter(roof => roof.x < r.cameraX + r.viewWidth).map(roof => [roof.id, roof.x, roof.width]);
      ticks(g);
      if (visible && r.phase === 'rescue' && r.age === 0) for (const [id, x, width] of visible) {
        const same = r.roofs.find(roof => roof.id === id);
        if (same) assert.deepEqual([same.x, same.width], [x, width], 'the reveal preserves visible roofs');
      }
    }
    assert.equal(g.runner.phase, 'escaped', `seed ${seed}: ${g.runner.reason}`);
    assert.equal(g.runner.runTicks, RESCUE_AFTER_TICKS); assert.ok(g.runner.distance > 400);
    assert.equal(g.score, 3000);
  }
});
