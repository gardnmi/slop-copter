import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HZ } from '../src/game.js';
import { ESCAPE_TIMINGS, jumpFlightTime, helicopterDeparture } from '../src/runner.js';
const ticks = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(1 / HZ); };
function defeated(seed = 4) {
  const g = new Game({ seed }); g.shiftCount = 6; g.retaliation = true; g.counterattack.phase = 'cleared';
  g.boss.x = g.boss.oldX = 250; g.boss.enter('hunt', g); g.carriage.phase = 'possessed';
  for (let i = 0; i < 5; i++) g.boss.grenadeHit(g);
  return g;
}
function running(seed = 4) {
  const g = defeated(seed);
  for (let n = 0; n < 1000 && !g.runner.running; n++) { if (g.runner.flying) g.setYoke(1, 0); ticks(g); }
  assert.equal(g.runner.phase, 'running'); return g;
}
function flat(speed = 300) {
  const g = running(), r = g.runner;
  r.x = r.runOrigin = 100; r.y = 220; r.speed = speed; r.grounded = true; r.roofId = 0;
  r.roofs = [r.roof(-100, 220, 20000, 'roof')]; r.roofId = r.roofs[0].id; r.roofs[0].birds = 0;
  r.blastX = null; r.cameraX = r.x - r.viewWidth * .23; r.cameraVX = speed;
  return g;
}

test('five grenade hits lead through pursuit, helicopter breakup, fall, roll and automatic running exactly once', () => {
  const g = defeated(), phases = [];
  for (let n = 0; n < 1000 && !g.runner.running; n++) {
    if (g.runner.flying) g.setYoke(1, 0);
    ticks(g); if (phases.at(-1) !== g.runner.phase) phases.push(g.runner.phase);
  }
  assert.deepEqual(phases, ['dormant', 'pursuit', 'strike', 'fall', 'roll', 'running']);
  assert.equal(g.runner.grounded, true); assert.equal(g.score, 3000); assert.equal(g.combat.hits, 0);
  const x = g.runner.x; ticks(g, 30); assert.ok(g.runner.x > x); assert.equal(g.runner.phase, 'running');
  assert.equal(g.boss.rockets.length, 0); assert.equal(g.boss.grenades.length, 0); assert.equal(g.counterattack.bullets.length, 0);
});

test('pursuit responds to held arrow commands and is deterministic across render frame rates', () => {
  const states = [];
  for (const fps of [30, 50, 60, 144]) {
    const g = defeated(); ticks(g, 85 + ESCAPE_TIMINGS.aftermath + 1);
    g.setYoke(1, -1);
    for (let i = 0; i < fps * 3; i++) g.step(1 / fps);
    states.push([g.runner.phase, g.runner.age, g.runner.airX, g.runner.airY, g.runner.cameraX]);
    assert.ok(g.runner.airX > g.runner.viewWidth * .45); assert.ok(g.runner.cameraX > 300); assert.ok(g.runner.airY < g.runner.viewHeight * .23);
  }
  states.slice(1).forEach(state => assert.deepEqual(state, states[0]));
});

test('hovering cannot advance the city transition; the timed blast catches it and Continue retries the escape', () => {
  let g = defeated(); ticks(g, 151);
  ticks(g, 60);
  assert.equal(g.runner.chaseProgress, 0); assert.equal(g.runner.cameraX, 0);
  for (let n = 0; n < 600 && g.state !== 'game_over'; n++) ticks(g); assert.equal(g.state, 'game_over'); assert.equal(g.runner.phase, 'caught');
  assert.equal(g.checkpoint.segment, 4);
  g = g.continueSegment(); ticks(g);
  assert.equal(g.runner.phase, 'pursuit'); assert.equal(g.score, 3000);
  g.setYoke(1, 0); ticks(g, 160);
  assert.ok(g.runner.chaseProgress > .4 && g.runner.chaseProgress < .6);
  assert.equal(g.runner.phase, 'pursuit');
  const roofs = new Map(g.runner.roofs.map(roof => [roof.id, [roof.x, roof.width]]));
  while (g.runner.phase !== 'fall') ticks(g);
  const landing = g.runner.roofs.find(roof => roof.id === g.runner.landingRoofId);
  if (roofs.has(landing.id)) assert.deepEqual([landing.x, landing.width], roofs.get(landing.id));
  assert.ok(g.runner.vy < 0, 'the character actively leaps from the explosion');
});

test('running builds from 100 to 250 in five seconds, with lower acceleration afterward and momentum on release', () => {
  const g = flat(100), r = g.runner;
  ticks(g, 250); assert.ok(Math.abs(r.speed - 250) < .01);
  ticks(g, 125); assert.ok(Math.abs(r.speed - 300) < .21);
  g.drop(); ticks(g, 6); const vy = r.vy;
  r.releaseJump(); assert.equal(r.vy, vy);
  ticks(g); assert.equal(r.vy, vy + 24);
  for (let i = 0; i < 30 && !r.grounded; i++) { ticks(g); assert.ok(r.vy <= 300); }
});

test('the helicopter leap carries a fast pace through the roll, and rooftop retries start at speed', () => {
  const g = running(), r = g.runner;
  assert.ok(r.speed >= 340); const start = r.x; ticks(g, 25); assert.ok(r.x - start > 160);
  r.die(g, 'test'); ticks(g, 30); r.retry(g); assert.equal(g.runner.speed, 340);
});

test('pigeon flocks vary spacing, trigger, direction and acceleration with repeatable seeds', () => {
  const g = flat(), r = g.runner;
  const roofs = Array.from({ length: 30 }, (_, i) => r.roof(i * 600, 220, 500, 'roof'));
  assert.ok(roofs.some(roof => roof.birds === 0)); assert.ok(roofs.some(roof => roof.birds > 0));
  const flock = roofs.flatMap(roof => roof.flock);
  assert.ok(new Set(flock.map(b => b.facing)).size === 2);
  assert.ok(new Set(flock.map(b => b.trigger)).size > 10);
  r.roofs = [roofs.find(roof => roof.birds > 0)]; r.x = r.roofs[0].x + r.roofs[0].width * .6;
  r.y = 220; r.roofId = r.roofs[0].id; r.cameraX = r.x - r.viewWidth * .23; ticks(g);
  assert.ok(r.birds.length > 0); const b = r.birds[0], vy = b.vy; ticks(g); assert.ok(b.vy < vy);
});

test('holding jump goes higher and farther than tapping; holding through landing cannot auto-jump', () => {
  const arcs = [];
  for (const held of [false, true]) {
    const g = flat(), r = g.runner; g.drop(); ticks(g);
    if (!held) r.releaseJump();
    let top = r.y, flight = 1;
    while (!r.grounded && flight++ < 100) { ticks(g); top = Math.min(top, r.y); }
    arcs.push([top, flight]); assert.equal(r.jumps, 1);
    ticks(g, 50); assert.equal(r.jumps, 1); assert.equal(r.grounded, true);
  }
  assert.ok(arcs[1][0] < arcs[0][0] - 20); assert.ok(arcs[1][1] > arcs[0][1] + 8);
});

test('crates cost speed rather than killing, glass breaks, and walking off a roof is fatal', () => {
  const g = flat(), r = g.runner, roof = r.roofs[0];
  roof.items = [{ x: 116, kind: 'crate', hit: false }, { x: 165, kind: 'glass', hit: false }];
  ticks(g, 4); assert.ok(r.speed < 240); assert.ok(r.stumble > 0); assert.equal(r.dead, false);
  ticks(g, 15); assert.equal(r.brokenWindows, 1); assert.equal(r.phase, 'running');
  roof.width = r.x + 25 - roof.x;
  ticks(g, 100); assert.equal(r.phase, 'dead'); assert.match(r.reason, /missed|edge/);
});

test('roof jump envelope supports rising and falling roofs at slow and fast speeds', () => {
  for (const speed of [105, 180, 250, 400, 650]) {
    for (const height of [-20, 0, 20]) assert.ok(jumpFlightTime(speed, height) > 0);
  }
});

test('later rooftops never generate the removed falling-machine obstacle', () => {
  const kinds = new Set();
  for (const seed of [1, 17, 41, 89]) {
    const g = running(seed), r = g.runner;
    r.fillRoofs(r.x + 40000);
    for (const roof of r.roofs) { kinds.add(roof.kind); assert.equal('bombAge' in roof, false); }
  }
  assert.deepEqual([...kinds].sort(), ['collapse', 'crane', 'glass', 'roof']);
});

test('the expanding explosion keeps advancing through running and a roof retry restores a safe lead', () => {
  const g = running(), r = g.runner, oldFront = r.blastX;
  ticks(g, 20); assert.ok(r.blastX > oldFront);
  const front = r.blastX; g.paused = true; ticks(g, 80); assert.equal(r.blastX, front);
  g.paused = false; r.blastX = r.x - 9; r.blastSpeed = 600;
  ticks(g); assert.equal(r.dead, true); assert.match(r.reason, /blast/);
  ticks(g, 25); assert.equal(r.retry(g), true);
  assert.ok(g.runner.x - g.runner.blastX >= 150); assert.equal(g.score, 3000);
});

test('pause and portrait resize preserve the fall and running world; retry keeps the record and boss score', () => {
  const g = defeated();
  for (let n = 0; n < 1000 && g.runner.phase !== 'fall'; n++) { if (g.runner.flying) g.setYoke(1, 0); ticks(g); }
  ticks(g, 6);
  assert.equal(g.runner.phase, 'fall'); g.paused = true;
  const frozen = JSON.stringify(g); ticks(g, 100); assert.equal(JSON.stringify(g), frozen);
  const r = g.runner, body = [r.x, r.y, r.vy], roofs = JSON.stringify(r.roofs);
  g.resize(640, 1300); assert.deepEqual([r.x, r.y, r.vy], body); assert.equal(JSON.stringify(r.roofs), roofs);
  g.paused = false; while (!r.running) ticks(g);
  ticks(g, 30); r.die(g, 'Test fall.'); const best = r.distance;
  assert.equal(r.retry(g), false); ticks(g, 25); assert.equal(r.retry(g), true);
  assert.equal(g.runner.running, true); assert.equal(g.runner.distance, 0); assert.equal(g.runner.best, best); assert.equal(g.score, 3000);
  const fresh = g.reset(); assert.equal(fresh.runner.phase, 'dormant'); assert.equal(fresh.runner.best, best);
});

test('the first gaps are clearable using only press and release, with no horizontal steering', () => {
  for (const seed of [1, 17, 41, 89]) {
    const g = running(seed), r = g.runner; let hop = false;
    for (let n = 0; n < 1800 && !r.dead && r.landed < 7; n++) {
      if (r.grounded) {
        r.releaseJump();
        const roof = r.roofs.find(roof => roof.id === r.roofId);
        const nextObstacle = roof.items.find(item => !item.hit && item.kind !== 'glass' && item.x > r.x);
        const edge = roof.x + roof.width - r.x < r.speed * .10 + 9;
        if (edge || nextObstacle && nextObstacle.x - r.x < r.speed * .12 + 10) { hop = !edge; r.pressJump(); }
      }
      if (hop && r.jumpAge >= .06) r.releaseJump();
      ticks(g);
    }
    assert.equal(r.dead, false, `seed ${seed}, ${r.reason}, at ${r.distance}m`);
    assert.ok(r.landed >= 7); assert.ok(r.distance > 100); assert.ok(r.roofs.length < 12);
  }
});


test('helicopter departure uses the visible hanging feet and camera velocity stays continuous into running', () => {
  for (const [width, height] of [[2560, 1254], [1024, 672], [390, 844]]) {
    const g = defeated(); g.resize(width, height);
    let detached = false, enteredRun = false, runningTicks = 0;
    for (let n = 0; n < 1200 && runningTicks < 30; n++) {
      const r = g.runner;
      if (r.flying) g.setYoke(1, 0);
      const phase = r.phase, vx = r.cameraVX, camera = r.cameraX;
      ticks(g);
      if (phase === 'strike' && r.phase === 'fall') {
        const feet = helicopterDeparture(g);
        assert.ok(Math.abs(r.x - feet.x) < 1e-7); assert.ok(Math.abs(r.y - feet.y) < 1e-7);
        assert.equal(r.departureScale, feet.scale); detached = true;
      }
      if (['fall', 'roll', 'running'].includes(phase) && !r.dead) {
        assert.ok(Math.abs(r.cameraVX - vx) <= 12.00001, `${phase}: camera acceleration must stay bounded`);
        assert.ok(Math.abs(r.cameraX - camera - r.cameraVX / HZ) < 1e-7, `${phase}: camera must never snap`);
      }
      if (r.running) { enteredRun = true; runningTicks++; }
    }
    assert.ok(detached && enteredRun, `${width}x${height}: complete seamless handoff`);
  }
});
