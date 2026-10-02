import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HZ, AUTO_RETRY_TICKS, TRANSFORM_ORDER } from '../src/game.js';
import { CLOUD_SPANS } from '../src/cloud-spans.js';
import { crossesRect, CRASH_TICKS, EXPLOSION_TICKS } from '../src/combat.js';
import { viewportSize, yokeRect } from '../src/layout.js';

function ticks(game, count = 1) { for (let i = 0; i < count; i++) game.step(1 / HZ); }
function land(game, offset = 100) {
  game.jumper = { x: game.cartX + offset * 2, y: game.deck - 31, inCloud: false };
  game.state = 'falling'; game.dropHeight = 131;
  ticks(game);
}
function miss(game, offset = 100) { land(game, offset); ticks(game, 12); }
function awaken() { const game = new Game({ seed: 7 }); for (let i = 0; i < 7; i++) miss(game); return game; }

test('new game is entirely classic and successful landings do not transform assets', () => {
  const g = new Game();
  assert.equal(g.shiftCount, 0);
  land(g, 15); ticks(g, 45);
  assert.equal(g.score, 131);
  assert.equal(g.shiftCount, 0);
  assert.ok(TRANSFORM_ORDER.every(asset => !g.isThemed(asset)));
  assert.equal(g.combat.shooters.length, 0);
});
test('exactly one asset changes after each completed splat; sixth miss does not retaliate', () => {
  const g = new Game();
  for (let count = 0; count < TRANSFORM_ORDER.length; count++) {
    land(g);
    assert.equal(g.shiftCount, count);
    ticks(g, 11);
    assert.equal(g.shiftCount, count);
    ticks(g);
    assert.equal(g.shiftCount, count + 1);
    assert.equal(g.lastShift, TRANSFORM_ORDER[count]);
    assert.deepEqual(TRANSFORM_ORDER.filter(asset => g.isThemed(asset)), TRANSFORM_ORDER.slice(0, count + 1));
    assert.equal(g.retaliation, false);
    assert.equal(g.combat.shooters.length, 0);
  }
  assert.equal(g.fullyThemed, true);
  assert.equal(g.state, 'ready');
});
test('seventh miss stands up only that stuntman; every later miss adds one', () => {
  const g = awaken();
  assert.equal(g.retaliation, true);
  assert.equal(g.combat.shooters.length, 1);
  assert.equal(g.combat.bullets.length, 0);
  miss(g);
  assert.equal(g.combat.shooters.length, 2);
  assert.equal(g.shiftCount, 6);
});
test('safe landings in the fully transformed world do not trigger combat', () => {
  const g = new Game();
  for (let i = 0; i < 6; i++) miss(g);
  land(g, 15); ticks(g, 45);
  assert.equal(g.retaliation, false);
  assert.equal(g.combat.shooters.length, 0);
});
test('horse and driver misses follow the same gradual sequence and permit the next attempt', () => {
  for (const [offset, outcome] of [[38, 'driver'], [55, 'horse']]) {
    const g = new Game();
    land(g, offset); assert.equal(g.outcome, outcome);
    ticks(g, 12);
    assert.equal(g.state, 'ready'); assert.equal(g.shiftCount, 1);
  }
});
test('pause freezes a pending transformation', () => {
  const g = new Game(); land(g); g.paused = true;
  ticks(g, 90); assert.equal(g.shiftCount, 0);
  assert.equal(g.effectTick, 0); assert.equal(g.drop(), false);
  g.paused = false; ticks(g, 12); assert.equal(g.shiftCount, 1);
});
test('five-jump boundaries retain transformation, attackers, and damage', () => {
  const g = awaken(); g.combat.hit(g);
  for (let i = 0; i < 3; i++) miss(g);
  assert.deepEqual(g.history, []);
  assert.equal(g.level, 1); assert.equal(g.shiftCount, 6);
  assert.equal(g.combat.hits, 1); assert.equal(g.combat.shooters.length, 4);
});
test('reset clears all transformation and combat state but retains the best score', () => {
  const old = awaken(); old.best = 987; old.combat.hit(old);
  const g = old.reset();
  assert.equal(g.best, 987); assert.equal(g.score, 0); assert.equal(g.shiftCount, 0);
  assert.equal(g.retaliation, false); assert.equal(g.combat.hits, 0);
  assert.deepEqual(g.combat.shooters, []); assert.equal(g.state, 'ready');
});
test('original hay, driver, horse, and ground collision intervals are retained', () => {
  for (const [offset, outcome] of [[-7, 'ground'], [-4, 'hay'], [33, 'hay'], [36, 'driver'], [47, 'horse'], [74, 'ground']]) {
    const g = new Game(); land(g, offset); assert.equal(g.outcome, outcome);
  }
});
test('release height times level scores and updates best', () => {
  const g = new Game(); g.level = 3; land(g, 15);
  assert.equal(g.score, 393); assert.equal(g.best, 393); assert.equal(g.catches, 1);
});
test('successful landing animation prevents repeat drops for 45 ticks', () => {
  const g = new Game(); land(g, 15);
  assert.equal(g.drop(), false); ticks(g, 44); assert.equal(g.drop(), false);
  ticks(g); assert.equal(g.drop(), true);
});
test('five perfect jumps during retaliation advance level, wagon speed, then reduce fall speed', () => {
  const g = new Game(); g.retaliation = true; g.shiftCount = 6;
  for (let level = 1; level <= 6; level++) {
    assert.equal(g.level, level);
    assert.equal(g.wagonStep, Math.min(3, level));
    assert.equal(g.gravity, Math.max(1, 4 - Math.max(0, level - 3)));
    for (let j = 0; j < 5; j++) { land(g, 15); ticks(g, 45); }
    assert.deepEqual(g.history, []);
  }
});
test('wagon wraps right to left without reversing at every speed', () => {
  for (let level = 1; level <= 3; level++) {
    const g = new Game(); g.level = level; g.cartX = g.width - 1;
    ticks(g); assert.equal(g.cartX, -147 + level * 2);
    const previous = g.cartX; ticks(g); assert.equal(g.cartX - previous, level * 2);
  }
});
test('fall is constant speed and steering after release does not move the stuntman', () => {
  const g = new Game(); g.cloudEnabled = false; g.drop();
  const { x, y } = g.jumper; g.moveCopter(100, 12); ticks(g, 5);
  assert.equal(g.jumper.x, x); assert.equal(g.jumper.y - y, 40);
});
test('all three original cloud masks slow descent only inside their silhouette', () => {
  const g = new Game({ seed: 1 });
  for (let index = 0; index < 3; index++) {
    assert.equal(g.cloudIndex, index); g.cloudX = g.cloudY = 100;
    assert.equal(g.inCloud(100, 100), false);
    const row = CLOUD_SPANS[index].findIndex((spans, y) => spans.length && y > 10);
    const [left, right] = CLOUD_SPANS[index][row][0];
    g.jumper = { x: 100 + Math.floor((left + right) / 2) * 2, y: 100 + row * 2 };
    g.state = 'falling'; g.frame = 0;
    const y = g.jumper.y; ticks(g);
    assert.equal(g.jumper.inCloud, true); assert.equal(g.jumper.y - y, 2);
    g.state = 'ready'; g.jumper = null; g.cloudX = -g.cloudRect[2]; g.frame = 2; ticks(g);
  }
  assert.equal(g.cloudIndex, 0);
});
test('leaving a cloud restores descent immediately without horizontal drift', () => {
  const g = new Game({ seed: 2 }); g.cloudX = 300; g.cloudY = 200;
  g.jumper = { x: 400, y: 240 }; g.state = 'falling';
  ticks(g, 5); assert.equal(g.jumper.y, 250);
  g.cloudEnabled = false; const x = g.jumper.x; ticks(g, 5);
  assert.equal(g.jumper.x, x); assert.equal(g.jumper.y, 290);
});
test('flight builds speed over half a second and brakes gradually on release', () => {
  const g = new Game(); g.setYoke(1, -1); ticks(g);
  assert.equal(g.dh, .16); assert.equal(g.dv, -.16);
  ticks(g, 4); assert.ok(Math.abs(g.dh - .8) < 1e-9); assert.ok(Math.abs(g.dv + .8) < 1e-9);
  ticks(g, 20); assert.equal(g.dh, 4); assert.equal(g.dv, -3);
  g.setYoke(0, 0); ticks(g, 5);
  assert.ok(Math.abs(g.dh - 3) < 1e-9); assert.ok(Math.abs(g.dv + 2) < 1e-9);
  ticks(g, 15); assert.equal(g.dh, 0); assert.equal(g.dv, 0);
  g.setYoke(-1, 0); ticks(g, 25); assert.equal(g.dh, -4);
  g.releaseControls(); assert.equal(g.dh, 0); assert.equal(g.controlX, 0);
});
test('acceleration tuning changes buildup but preserves top speed, braking, and reset preference', () => {
  const quick = new Game({ accelerationTime: .2 });
  const gentle = new Game({ accelerationTime: 1.5 });
  quick.setYoke(1, 0); gentle.setYoke(1, 0);
  ticks(quick, 10); ticks(gentle, 10);
  assert.equal(quick.dh, 4);
  assert.ok(gentle.dh > .5 && gentle.dh < .6);
  ticks(gentle, 65); assert.equal(gentle.dh, 4);
  quick.setYoke(0, 0); gentle.setYoke(0, 0);
  ticks(quick, 20); ticks(gentle, 20);
  assert.equal(quick.dh, 0); assert.equal(gentle.dh, 0);
  assert.equal(gentle.reset().accelerationTime, 1.5);
  for (const [input, expected] of [[NaN, .5], [Infinity, .5], [-1, .2], [100, 1.5]]) {
    assert.equal(new Game({ accelerationTime: input }).accelerationTime, expected);
  }
});
test('simulation is identical at 30, 60, 120, and 144 rendering frames per second', () => {
  const snapshots = [30, 60, 120, 144].map(hz => {
    const g = new Game({ seed: 5 }); g.cloudEnabled = false; g.drop();
    for (let i = 0; i < hz * 2; i++) g.step(1 / hz);
    return [g.frame, g.cartX, g.cloudX, g.state, g.score, g.history, g.shiftCount];
  });
  snapshots.forEach(snapshot => assert.deepEqual(snapshot, snapshots[0]));
});
test('pause freezes flight, projectiles, and recovering attackers', () => {
  const g = awaken(); ticks(g, 80); g.paused = true;
  const before = JSON.stringify(g); ticks(g, 200); assert.equal(JSON.stringify(g), before);
});
test('attacker waits to stand up, then shoots at the copter location at firing time', () => {
  const g = awaken();
  const s = g.combat.shooters[0]; assert.ok(s.age < 42);
  while (s.age < 77) ticks(g);
  assert.equal(g.combat.bullets.length, 0);
  ticks(g); assert.equal(g.combat.bullets.length, 1);
  const bullet = g.combat.bullets[0], vx = bullet.vx, vy = bullet.vy;
  g.moveCopter(100, 10); ticks(g);
  assert.equal(bullet.vx, vx); assert.equal(bullet.vy, vy);
});
test('crew shots leave the raised rifle barrel and the character faces its target', () => {
  const g = new Game(); g.shiftCount = 6; g.retaliation = true;
  g.combat.miss(g, 486);
  const shooter = g.combat.shooters[0]; // Center at x=500; right shoulder at x=506.
  shooter.age = 77;
  g.copterX = 482; g.copterY = 100; // Target center x=506, directly above the rifle.
  ticks(g);
  assert.equal(shooter.facing, 1);
  const bullet = g.combat.bullets[0];
  assert.equal(bullet.x, 506); assert.equal(bullet.vx, 0); assert.equal(bullet.vy, -8);
  assert.equal(bullet.y, g.deck + 44 - 20 - 14 - 8); // Shoulder, barrel, first motion step.
  g.copterX = 200; ticks(g);
  assert.equal(shooter.facing, -1); assert.ok(shooter.aimX < 0);
});
test('swept collision catches fast bullets and rejects misses', () => {
  assert.equal(crossesRect(0, 15, 100, 15, [40, 10, 10, 10]), true);
  assert.equal(crossesRect(0, 0, 100, 0, [40, 10, 10, 10]), false);
  assert.equal(crossesRect(45, 0, 45, 100, [40, 10, 10, 10]), true);
});
test('damage has a grace period; third hit disables flight and finishes crash before game over', () => {
  const g = awaken();
  assert.equal(g.combat.hit(g), true); assert.equal(g.combat.hit(g), false);
  assert.equal(g.combat.hits, 1);
  for (let i = 0; i < 2; i++) { g.combat.hurtTicks = 0; assert.equal(g.combat.hit(g), true); }
  assert.equal(g.state, 'crashing'); assert.equal(g.drop(), false);
  const x = g.copterX; g.moveCopter(100, 100); assert.equal(g.copterX, x);
  ticks(g, CRASH_TICKS - 1); assert.equal(g.state, 'crashing');
  ticks(g); assert.equal(g.state, 'exploding');
  ticks(g, EXPLOSION_TICKS); assert.equal(g.state, 'game_over');
  g.paused = true; const before = JSON.stringify(g); ticks(g, 60); assert.equal(JSON.stringify(g), before);
  g.paused = false; ticks(g, AUTO_RETRY_TICKS); assert.equal(g.state, 'ready'); assert.equal(g.combat.hits, 0); assert.equal(g.retrySerial, 1);
});
test('an undodged real bullet stream can cause all three hits and end the game', () => {
  const g = awaken(); ticks(g, 1000);
  assert.equal(g.combat.hits, 3); assert.equal(g.state, 'game_over');
});
test('pause freezes the fatal crash too', () => {
  const g = awaken(); g.combat.hits = 2; g.combat.hit(g); ticks(g, 20);
  g.paused = true; const before = JSON.stringify(g); ticks(g, 120);
  assert.equal(JSON.stringify(g), before);
  g.paused = false; ticks(g, CRASH_TICKS + EXPLOSION_TICKS);
  assert.equal(g.state, 'game_over');
});

test('reversal spends half a second braking before accelerating the other way', () => {
  const g = new Game(); g.setYoke(-1, 0); ticks(g, 25);
  g.setYoke(1, 0);
  const start = g.copterX;
  ticks(g, 10); assert.ok(g.dh < 0); assert.ok(g.copterX < start);
  ticks(g, 15); assert.ok(Math.abs(g.dh) < 1e-9);
  const turn = g.copterX;
  ticks(g, 25); assert.equal(g.dh, 4); assert.ok(g.copterX > turn);
  g.setYoke(0, 0);
  const x = g.copterX; ticks(g, 20);
  assert.equal(g.dh, 0); assert.ok(Math.abs(g.copterX - x - 76) < 1e-9);
});

test('only the digital helicopter banks with acceleration and pitches with climb or descent', () => {
  const classic = new Game(); classic.setYoke(1, -1); ticks(classic, 12);
  assert.equal(classic.copterPitch, 0);
  for (const [x, y, sign] of [[1, 0, 1], [-1, 0, -1], [0, -1, -1], [0, 1, 1]]) {
    const g = new Game(); g.shiftCount = 3; g.setYoke(x, y); ticks(g, 12);
    assert.ok(g.copterPitch * sign > .02, `Expected pitch direction for ${x},${y}`);
    assert.ok(Math.abs(g.copterPitch) <= .30);
    const hanging = g.hangingPosition;
    assert.equal(g.drop(), true);
    assert.equal(g.jumper.x, hanging.x); assert.equal(g.jumper.y, hanging.y);
    g.setYoke(0, 0); ticks(g, 120);
    assert.equal(g.copterPitch, 0);
  }
});

test('flight acceleration and pitch are identical across rendering frame rates', () => {
  const snapshots = [30, 60, 120, 144].map(hz => {
    const g = new Game({ seed: 5 }); g.shiftCount = 3; g.copterY = 200;
    for (const [x, y] of [[1, -1], [-1, 1], [0, 0]]) {
      g.setYoke(x, y);
      for (let i = 0; i < hz / 2; i++) g.step(1 / hz);
    }
    return [g.frame, g.copterX, g.copterY, g.dh, g.dv, g.copterPitch];
  });
  snapshots.forEach(snapshot => assert.deepEqual(snapshot, snapshots[0]));
});

test('Pascal ceiling, carriage clearance, and edge wrap use original sprite coordinates', () => {
  const g = new Game(); g.copterY = 0; g.setYoke(0, -1); ticks(g, 10);
  assert.equal(g.copterY, -8);
  g.releaseControls(); g.copterY = g.deck - 80; g.setYoke(0, 1); ticks(g, 10);
  assert.equal(g.copterY + 52, g.deck - 20);
  g.releaseControls(); g.copterX = g.width + 69; ticks(g);
  assert.equal(g.copterX, -76);
  g.copterX = -81; ticks(g); assert.equal(g.copterX, g.width + 68);
});

test('fullscreen resize preserves score, transformation, entities, and original flight speed', () => {
  const g = awaken(); g.best = 123; g.score = 123; g.paused = true;
  g.combat.bullets.push({ x: 200, y: 250, vx: 0, vy: -8, age: 3 });
  const original = { x: g.copterX, y: g.copterY, deck: g.deck, width: g.width };
  const size = viewportSize(390, 710);
  g.resize(size.width, size.height);
  assert.equal(g.width, 640); assert.equal(g.score, 123); assert.equal(g.shiftCount, 6);
  assert.equal(g.combat.shooters.length, 1); assert.equal(g.paused, true);
  assert.equal(g.copterX / g.width, original.x / original.width);
  assert.equal(g.copterY / g.deck, original.y / original.deck);
  assert.equal(Math.hypot(g.combat.bullets[0].vx, g.combat.bullets[0].vy), 8);
  for (const count of [0, 5]) {
    g.shiftCount = count;
    const [x, y, w, h] = yokeRect(g);
    assert.ok(x >= 0 && x + w <= g.width && y >= g.hudY && y + h <= g.height);
  }
  const fresh = g.reset(); assert.equal(fresh.width, g.width); assert.equal(fresh.height, g.height);
  assert.equal(fresh.best, 123);
});

test('resizing a paused splat or crash keeps it at the correct ground-relative height', () => {
  const g = new Game(); land(g); g.paused = true;
  g.resize(640, 1100);
  assert.equal(g.jumper.y, g.deck + 12);
  const crash = awaken(); crash.combat.hits = 2; crash.combat.hit(crash); ticks(crash, 80);
  crash.paused = true;
  const ratio = crash.copterY / crash.deck;
  crash.resize(640, 1100);
  assert.equal(crash.copterY / crash.deck, ratio);
  assert.equal(crash.state, 'crashing');
});
