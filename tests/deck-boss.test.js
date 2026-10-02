import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { DECK_FLOOR, DECK_LENGTH } from '../src/deck-raid.js';
import { SPACECRAFT_HEALTH, damageSpacecraft, hitsSpacecraft, spacecraftHull } from '../src/deck-boss.js';
import { spacecraftInput } from './helpers/deck-playthrough.js';
import { spacecraftCannon } from '../src/spacecraft-motion.js';
const tick = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(.02); };

test('reaching the escape craft starts a separately supplied checkpoint; Continue restores its defenses and score', () => {
  const g = createLevel('deck-raid'), d = g.boarding;
  d.x = 3462; d.health = 1; d.ammo = 0; d.grenades = 0; g.score = 900;
  tick(g); assert.equal(d.phase, 'raid'); assert.equal(d.boss.state, 'wake');
  assert.equal(d.boss.hp, SPACECRAFT_HEALTH); assert.equal(d.health, 5); assert.equal(d.ammo, 0); assert.equal(d.grenades, 8);
  assert.equal(d.checkpoint.label, 'HOSTILE SPACECRAFT');
  tick(g, 90); damageSpacecraft(d, g, 40, d.boss.x - 100, d.boss.y); g.score = 1300;
  d.health = 1; d.hurt = 0; d.hurtPlayer(g); tick(g, 30); g.continueSegment();
  assert.equal(g.boarding.boss.state, 'wake'); assert.equal(g.boarding.boss.hp, SPACECRAFT_HEALTH);
  assert.equal(g.boarding.x, 3462); assert.equal(g.boarding.grenades, 8); assert.equal(g.score, 900);
});

test('mortars warn before launch and hit the marked surface, including upper catwalks that intercept their arcs', () => {
  const g = createLevel('spaceship'), d = g.boarding;
  d.x = 3600; tick(g, 70); assert.equal(d.boss.state, 'mortar'); assert.equal(d.bullets.length, 0);
  const marks = d.boss.marks.map(({ x, y }) => [x, y]);
  assert.ok(marks.some(([, y]) => y < 260));
  const landings = [], burst = d.burst.bind(d);
  d.burst = (x, y, size) => { landings.push([x, y + 6]); burst(x, y, size); };
  g.setYoke(1, 0); tick(g, 47); assert.equal(d.bullets.length, 0);
  tick(g); assert.equal(d.bullets[0].kind, 'mortar');
  assert.deepEqual(d.boss.marks.map(({ x, y }) => [x, y]), marks);
  tick(g, 85); assert.equal(landings.length, 3);
  landings.forEach(([x, y], i) => { assert.ok(Math.abs(x - marks[i][0]) < 1); assert.equal(y, marks[i][1]); });
  assert.equal(d.health, 5);
});

test('the spacecraft crosses overhead, changes sides, and exposes an upward target rather than blocking the player ahead of its nose', () => {
  const g = createLevel('spaceship'), d = g.boarding;
  tick(g, 70); d.x = d.boss.x; d.setFire(true); tick(g, 10);
  assert.equal(d.boss.hp, SPACECRAFT_HEALTH); // Horizontal fire passes below the lifted hull.
  g.setYoke(0, -1); tick(g, 20); assert.ok(d.boss.hp < SPACECRAFT_HEALTH);
  d.setFire(false); g.setYoke(0, 0);
  for (let i = 0; i < 400 && d.boss.state !== 'sweep'; i++) tick(g);
  assert.equal(d.boss.state, 'sweep');
  g.setYoke(-1, 0); tick(g, d.boss.warning); const x = d.boss.x; tick(g, 151);
  assert.ok(d.boss.x < x - 280); assert.equal(d.boss.facing, 1); assert.ok(d.boss.y < 110);
  assert.ok(d.x < d.boss.x); // Can pass under it and attack from the other side.
});

test('horizontal rounds can be ducked and ground pulses hit a standing player but clear a catwalk', () => {
  const g = createLevel('spaceship'), d = g.boarding;
  d.boss.state = 'recover'; d.boss.age = -1000; d.x = 3688; d.hurt = 0;
  const round = y => ({ x: d.x + 14, y, vx: -230, vy: 0, age: 0, kind: 'cannon' });
  g.setYoke(0, 1); d.bullets = [round(235)]; tick(g, 7); assert.equal(d.health, 5);
  g.setYoke(0, 0); d.bullets = [round(235)]; tick(g, 7); assert.equal(d.health, 4);
  d.hurt = 0; d.x = 3520; d.y = 208; d.bullets = [round(251)]; tick(g, 7); assert.equal(d.health, 4);
  d.x = 3688; d.y = 260; d.bullets = [round(251)]; tick(g, 7); assert.equal(d.health, 3);
});

test('normal movement, upward fire, grenades and catwalk jumps beat flight, elevator descent and the overhead Warden without boarding', () => {
  const g = createLevel('spaceship'), d = g.boarding, states = new Set();
  assert.equal(hitsSpacecraft(d.boss, 3700, 235, 3900, 235), false);
  let endingScore;
  for (let i = 0; i < 3500 && d.playing; i++) {
    spacecraftInput(g); tick(g); states.add(d.boss.state);
    if (d.boss.form === 'ship' && !['wake', 'descent'].includes(d.boss.state)) {
      const hull = spacecraftHull(d.boss);
      for (const platform of d.platforms.filter(p => p.arena)) assert.ok(hull.right < platform.x || hull.left > platform.x + platform.w || hull.bottom < platform.y);
    }
    if (d.boss.state === 'warden-dying' && endingScore === undefined) {
      endingScore = g.score; assert.equal(d.bullets.length, 0); assert.equal(d.phase, 'raid');
      assert.equal(damageSpacecraft(d, g, 1000, d.boss.x, d.boss.y), false);
    }
  }
  for (const state of ['mortar', 'sweep', 'descent', 'warden-wake', 'warden-crossfire', 'warden-dying', 'wreck']) assert.ok(states.has(state), state);
  assert.ok(d.health > 0); assert.equal(d.phase, 'cleared'); assert.equal(g.score, endingScore + 3000);
  const score = g.score; tick(g, 220); assert.equal(g.score, score); assert.equal(d.boss.state, 'wreck');
});

test('boss state and attacks freeze on pause and survive a narrow resize with the whole arena visible', () => {
  const g = createLevel('spaceship'), d = g.boarding;
  tick(g, 120); const state = JSON.stringify(d); g.paused = true; tick(g, 100);
  assert.equal(JSON.stringify(d), state);
  const boss = JSON.stringify(d.boss); g.resize(390, 844);
  assert.equal(JSON.stringify(d.boss), boss); assert.ok(d.width >= 600);
  assert.ok(d.boss.x + 130 <= d.cameraX + d.width); assert.ok(d.x > d.cameraX);
});

test('the boss retracts gear, opens the active weapon bay, recoils and launches cannon rounds from its visible muzzle', () => {
  const g = createLevel('spaceship'), d = g.boarding;
  assert.equal(d.boss.motion.gear, 1); tick(g, 100);
  assert.ok(d.boss.motion.gear < .01); assert.ok(d.boss.motion.mortar > .95);
  const b = d.boss; b.state = 'cannon'; b.age = 0; b.warning = 48; b.aimX = d.x; b.aimY = d.y - 20;
  tick(g, 47); assert.ok(b.motion.bay > .95); assert.ok(b.motion.mortar < .01);
  tick(g); const muzzle = b.vents.at(-1), shot = d.bullets.find(s => s.kind === 'cannon');
  assert.ok(muzzle); assert.ok(shot); assert.ok(b.motion.recoil > 0);
  assert.ok(Math.abs(shot.x - shot.vx * .02 - muzzle.x) < .001);
  assert.ok(Math.abs(shot.y - shot.vy * .02 - muzzle.y) < .001);
  const aim = b.cannonAngle; d.x += 150; tick(g, 10); assert.equal(b.cannonAngle, aim);
  assert.equal(spacecraftCannon(b).angle, aim);
});
