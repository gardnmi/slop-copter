import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { WELL_ENTRY_TICKS, wellEntryView } from '../src/orbit-entry.js';
import { ORBIT_TERMINAL } from '../src/orbit-drop.js';
const tick = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(.02); };

test('the defeated Warden falls into the lift, breaks its collision and carries one continuous fall into the well', () => {
  for (const x of [3435, 3714, 4000]) {
    const g = createLevel('shaft-collapse'), d = g.boarding, b = d.boss;
    d.x = x; let previous = b.y;
    while (!d.collapse) {
      tick(g); assert.ok(b.y >= previous); previous = b.y;
      assert.ok(d.age < 150, 'the machine must actually hit the platform');
    }
    assert.equal(b.y + 63, d.collapse.floor);
    assert.equal(d.x, x); assert.equal(d.phase, 'cleared'); assert.equal(d.grounded, false);
    assert.ok(d.platforms.every(p => !p.lift && !p.arena));
    assert.equal(d.collapse.pieces.length, 12); assert.equal(g.score, 3000);
    const startY = d.y; tick(g);
    const o = g.orbit, enemies = o.enemies, platforms = o.platforms;
    assert.equal(o.phase, 'breach'); assert.equal(o.canAct, false);
    let lastY = d.y, lastOrbit = o.y;
    while (o.phase === 'breach') {
      tick(g);
      assert.ok(d.y > lastY); assert.ok(o.y > lastOrbit);
      assert.ok(Math.abs((d.y - lastY) - (o.y - lastOrbit)) < 1e-8);
      lastY = d.y; lastOrbit = o.y;
      assert.equal(o.enemies, enemies); assert.equal(o.platforms, platforms);
      assert.equal(o.health, 4); assert.equal(o.ammo, 8);
    }
    assert.equal(o.phase, 'falling'); assert.equal(o.vy, ORBIT_TERMINAL);
    assert.ok(Math.abs(o.y - 164) < 1e-7); assert.ok(Math.abs(o.cameraY) < 1e-7);
    assert.ok(d.y - startY > 1800); assert.equal(g.score, 3000);
    const y = o.y; tick(g); assert.ok(Math.abs(o.y - y - 9.6) < 1e-7);
    g.drop(); tick(g); assert.equal(o.ammo, 7); assert.ok(o.shots.length);
  }
});

test('collapse pause and resizing preserve the fall, with matching feet at both camera handoffs', () => {
  for (const [width, height] of [[1280, 800], [390, 844], [2560, 720]]) {
    const g = createLevel('shaft-collapse', { width, height });
    while (!g.orbit.active) tick(g);
    const o = g.orbit, d = g.boarding;
    const h = Math.max(560, 320 / (width / height)), w = Math.max(320, 560 * width / height);
    const originalAge = o.age; o.age = 0;
    const opening = wellEntryView(o, d, w, h);
    assert.ok(Math.abs(opening.x - (d.x - d.cameraX) * h / d.height) < .01);
    assert.ok(Math.abs(opening.screenY - o.entry.startScreenY * h) < .01);
    o.age = WELL_ENTRY_TICKS;
    const ending = wellEntryView(o, d, w, h);
    assert.ok(Math.abs(ending.x - ((w - 320) / 2 + o.x)) < .01);
    assert.equal(ending.screenY, 164); assert.equal(ending.blend, 1); assert.equal(ending.morph, 1);
    o.age = originalAge; tick(g, 80);
    g.paused = true; const before = JSON.stringify(o), debris = JSON.stringify(d.collapse);
    tick(g, 50); g.resize(height, width);
    assert.equal(JSON.stringify(o), before); assert.equal(JSON.stringify(d.collapse), debris);
    g.paused = false; tick(g, WELL_ENTRY_TICKS - o.age);
    assert.equal(o.phase, 'falling'); assert.equal(o.health, 4);
  }
});
