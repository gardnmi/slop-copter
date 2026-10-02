import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HZ } from '../src/game.js';
import { CLOUD_SPANS } from '../src/cloud-spans.js';
import { LIGHTNING_WARNING_TICKS, LIGHTNING_STRIKE_TICKS } from '../src/lightning.js';

function ticks(g, n = 1) { for (let i = 0; i < n; i++) g.step(1 / HZ); }
function charge(g) {
  g.shiftCount = 1; g.cloudX = 200; g.cloudY = 100;
  g.lightning.delay = 1; ticks(g);
  assert.equal(g.lightning.phase, 'warning');
}

test('lightning begins only after the cloud transforms, warns, strikes, and rests', () => {
  const g = new Game({ seed: 21 }); ticks(g, 700);
  assert.equal(g.lightning.strikes, 0); assert.equal(g.lightning.phase, 'idle');
  charge(g); ticks(g, LIGHTNING_WARNING_TICKS - 1);
  assert.equal(g.lightning.phase, 'warning');
  ticks(g); assert.equal(g.lightning.phase, 'strike'); assert.equal(g.lightning.strikes, 1);
  ticks(g, LIGHTNING_STRIKE_TICKS);
  assert.equal(g.lightning.phase, 'idle'); assert.ok(g.lightning.delay >= 350);
  assert.deepEqual(g.lightning.paths(g), []);
});

test('the lightning follows the cloud silhouette and remains a small local flicker', () => {
  for (let index = 0; index < 3; index++) {
    const g = new Game({ seed: index }); g.cloudIndex = index; charge(g);
    const storm = g.lightning, source = storm.source;
    assert.ok(CLOUD_SPANS[index][source.y / 2].some(([l, r]) => source.x >= l * 2 && source.x <= r * 2));
    const start = storm.paths(g)[0][0][0]; ticks(g, 6);
    assert.equal(storm.paths(g)[0][0][0], start - 4);
    const paths = storm.paths(g);
    assert.ok(paths.length >= 1 && paths.length <= 2);
    const [x, y] = paths[0][0];
    assert.ok(paths.flat().every(([px, py]) => Math.abs(px - x) < 28 && py - y <= 44));
    assert.ok(paths[0].at(-1)[1] < g.deck);
  }
});

test('strike delays and routes vary without consuming the gameplay random stream', () => {
  const a = new Game({ seed: 100 }), b = new Game({ seed: 100 });
  a.shiftCount = 1;
  ticks(a, 2400); ticks(b, 2400);
  assert.ok(a.lightning.strikes > 1);
  assert.equal(a.random(), b.random());
  assert.deepEqual([a.cloudIndex, a.cloudX, a.cloudY], [b.cloudIndex, b.cloudX, b.cloudY]);
  const delays = new Set(), ends = new Set();
  for (let seed = 1; seed <= 10; seed++) {
    const g = new Game({ seed }); delays.add(g.lightning.delay); charge(g); ends.add(g.lightning.reach.x);
  }
  assert.ok(delays.size > 5); assert.ok(ends.size > 5);
});

test('pause freezes lightning and resizing preserves its cloud attachment without enlarging it', () => {
  const g = new Game({ seed: 7 }); charge(g); ticks(g, 4);
  g.paused = true; const state = JSON.stringify(g); ticks(g, 100); assert.equal(JSON.stringify(g), state);
  const reach = { ...g.lightning.reach }; g.resize(640, 2000);
  assert.deepEqual(g.lightning.reach, reach);
  const path = g.lightning.paths(g)[0];
  assert.ok(Math.abs(path[0][0] - g.cloudX - g.lightning.source.x) <= 1);
  assert.ok(path.at(-1)[1] - path[0][1] <= 44);
  g.paused = false; ticks(g, LIGHTNING_WARNING_TICKS - 4); assert.equal(g.lightning.phase, 'strike');
});

test('hidden, offscreen, replaced, and very low clouds cannot leave stray bolts behind', () => {
  const g = new Game(); charge(g); g.cloudEnabled = false; ticks(g);
  assert.equal(g.lightning.phase, 'idle'); assert.deepEqual(g.lightning.paths(g), []);
  g.cloudEnabled = true; charge(g); g.cloudIndex = 2; ticks(g);
  assert.equal(g.lightning.phase, 'idle');
  g.lightning.delay = 1; g.cloudX = g.width + 20; ticks(g);
  assert.equal(g.lightning.phase, 'idle');
  g.cloudX = 100; g.cloudY = g.deck; g.lightning.delay = 1; ticks(g);
  assert.equal(g.lightning.phase, 'idle');
  charge(g); g.state = 'crashing'; ticks(g);
  assert.equal(g.lightning.phase, 'idle');
  const fresh = g.reset(); assert.equal(fresh.lightning.strikes, 0); assert.equal(fresh.lightning.phase, 'idle');
});
