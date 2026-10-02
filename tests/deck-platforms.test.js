import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
const tick = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(.02); };

test('a gap is a real fall, and Continue restores a safe section entrance', () => {
  const g = createLevel('deck-catwalks'), d = g.boarding;
  const cp = structuredClone(d.checkpoint); d.x = 2840; d.y = 270; d.grounded = false; d.vy = 200;
  tick(g, 45); assert.equal(d.dead, true); assert.ok(d.y > 500);
  tick(g, 30); g.continueSegment();
  assert.equal(g.boarding.x, cp.data.x); assert.equal(g.boarding.y, cp.data.y);
  assert.equal(g.boarding.section, 2); assert.equal(g.boarding.health, 5);
});

test('a catwalk is passable from below, catches descending feet, and Down + K drops through it', () => {
  const g = createLevel('deck-catwalks'), d = g.boarding;
  d.enemies = []; d.x = 2380; d.y = 308; d.grounded = true; d.pressJump();
  tick(g, 22); assert.ok(d.y < 250); // The underside does not stop an upward jump.
  tick(g, 15); assert.equal(d.grounded, true); assert.equal(d.y, 250);
  d.releaseJump(); g.setYoke(0, 1); tick(g); d.pressJump(); tick(g, 28);
  assert.equal(d.y, 308); assert.equal(d.grounded, true);
});

test('solid deck faces stop lateral movement, while elevated patrols cannot walk into a shaft', () => {
  const g = createLevel('deck-raid'), d = g.boarding; d.enemies = [];
  d.x = 550; g.setYoke(1, 0); tick(g, 25); assert.equal(d.x, 572); assert.equal(d.vx, 0);
  const h = createLevel('deck-catwalks'), e = h.boarding.enemies.find(e => e.originX === 2750);
  h.boarding.x = 2915; h.boarding.y = 160; h.boarding.grounded = true;
  e.clock = 9999; tick(h, 160); assert.ok(e.x <= 2811); assert.equal(e.y, 160);
});

test('grenades bounce off raised geometry and gunfire stops at solid deck walls', () => {
  const g = createLevel('deck-catwalks'), d = g.boarding; d.enemies = [];
  d.thrown = [{ x: 2530, y: 193, vx: 0, vy: 100, age: 0, bounced: false }];
  tick(g, 5); assert.equal(d.thrown[0].bounced, true); assert.ok(d.thrown[0].y <= 203);
  d.shots = [{ x: 3010, y: 275, vx: 500, vy: 0, age: 0, damage: 1 }];
  tick(g, 3); assert.equal(d.shots.length, 0);
});

test('the camera follows lower and upper floors smoothly and resize preserves the route', () => {
  const g = createLevel('deck-cargo'), d = g.boarding;
  d.enemies = []; d.x = 1430; d.y = 324; d.grounded = true; const old = d.cameraFloor;
  tick(g); assert.ok(d.cameraFloor > old && d.cameraFloor < 324);
  tick(g, 80); assert.ok(Math.abs(d.cameraFloor - 324) < 1);
  const position = [d.x, d.y], geometry = JSON.stringify(d.platforms);
  g.resize(390, 844); assert.deepEqual([d.x, d.y], position); assert.equal(JSON.stringify(d.platforms), geometry);
});
