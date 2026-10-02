import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { deployParatroopers, tickParatrooper } from '../src/deck-paratroopers.js';

const tick = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(.02); };
test('paratrooper waves are finite, and direct section selection skips earlier ambushes', () => {
  const g = createLevel('deck-cargo'), d = g.boarding; d.enemies = [];
  tick(g); assert.deepEqual(d.paraWaves, [0, 1]); assert.equal(d.enemies.length, 2);
  tick(g, 40); assert.equal(d.enemies.length, 2);
  assert.ok(d.enemies.every(e => e.parachuting && e.paratrooper));
  const state = JSON.stringify(d); g.paused = true; tick(g, 100); assert.equal(JSON.stringify(d), state);
  const coords = d.enemies.map(e => [e.x, e.y]); g.resize(390, 844); assert.deepEqual(d.enemies.map(e => [e.x, e.y]), coords);
});
test('descending troops land on the first catwalk or cargo top and release their canopy before walking', () => {
  const g = createLevel('deck-catwalks'), d = g.boarding; d.enemies = [];
  deployParatroopers(d); const e = d.enemies[1];
  e.x = e.laneX = 2580; e.y = 201; e.age = 0;
  for (let i = 0; i < 15 && e.parachuting; i++) { e.age++; tickParatrooper(d, e); }
  assert.equal(e.y, 206); assert.equal(e.parachuting, false); assert.equal(e.landingAge, 22);
  assert.equal(e.state, 'patrol'); assert.equal(d.chutes.length, 1);
  const x = e.x; tickParatrooper(d, e); assert.equal(e.x, x); assert.equal(e.landingAge, 21);
});
test('upward fire can kill a descending soldier; its canopy separates and its body falls', () => {
  const g = createLevel('deck-cargo'), d = g.boarding; d.enemies = []; d.props = [];
  deployParatroopers(d); const e = d.enemies[0]; d.enemies = [e];
  d.x = e.x; d.y = 260; e.y = 190; e.hp = 2;
  g.setYoke(0, -1); d.setFire(true); const score = g.score;
  tick(g, 16); assert.equal(e.dead, true); assert.equal(e.parachuting, false); assert.ok(d.chutes.some(c => c.killed));
  const y = e.y; tick(g, 6); assert.ok(e.y > y); assert.equal(g.score, score + 100);
});
test('airborne volleys have a visible windup, commit their aim and stop while offscreen', () => {
  const g = createLevel('deck-cargo'), d = g.boarding; d.enemies = []; deployParatroopers(d);
  const e = d.enemies[0]; e.y = 145; e.clock = 1;
  tickParatrooper(d, e); assert.equal(e.state, 'air-aim'); assert.equal(d.bullets.length, 0);
  const aim = e.aim; d.x -= 80;
  for (let i = 0; i < 27; i++) tickParatrooper(d, e);
  assert.equal(d.bullets.length, 0); tickParatrooper(d, e);
  assert.equal(d.bullets[0].kind, 'pararocket');
  assert.ok(Math.abs(Math.atan2(d.bullets[0].vy, d.bullets[0].vx) - aim) < .0001);
  e.laneX = d.cameraX - 200; e.y = 100; e.clock = 1;
  for (let i = 0; i < 30; i++) tickParatrooper(d, e);
  assert.equal(d.bullets.length, 1);
});
test('Continue restores the ambush once, and no new paratroopers enter the spacecraft fight', () => {
  const g = createLevel('deck-cargo'), d = g.boarding; d.enemies = [];
  tick(g); assert.equal(d.enemies.filter(e => e.paratrooper).length, 2);
  d.health = 1; d.hurt = 0; d.hurtPlayer(g); tick(g, 30); g.continueSegment();
  tick(g); assert.equal(g.boarding.enemies.filter(e => e.paratrooper).length, 2);
  const boss = createLevel('spaceship'); tick(boss, 200); assert.equal(boss.boarding.enemies.filter(e => e.paratrooper).length, 0);
});
