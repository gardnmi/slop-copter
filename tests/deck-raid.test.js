import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { DECK_FLOOR, DECK_LENGTH, DECK_RUN_SPEED } from '../src/deck-raid.js';
import { deckRouteInput, spacecraftInput } from './helpers/deck-playthrough.js';
const ticks = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(.02); };
const start = (options = {}) => createLevel('deck-raid', { seed: 19, ...options });

test('deck controls run and stop immediately, fire while moving, crouch, and jump without repeated hops', () => {
  const g = start(), d = g.boarding;
  d.setFire(true);
  g.setYoke(1, 0); ticks(g); assert.equal(d.vx, DECK_RUN_SPEED); assert.equal(d.x, 103); assert.ok(d.shots.length);
  g.setYoke(0, 0); ticks(g); assert.equal(d.x, 103); assert.equal(d.vx, 0);
  g.setYoke(-1, 1); ticks(g); assert.equal(d.facing, -1); assert.equal(d.crouching, true); assert.equal(d.vx, 0);
  g.setYoke(0, 0); assert.equal(g.drop(), true); ticks(g, 10); assert.ok(d.y < DECK_FLOOR - 35);
  ticks(g, 80); assert.equal(d.grounded, true); assert.equal(d.y, DECK_FLOOR); assert.equal(g.drop(), false);
  d.releaseJump(); assert.equal(g.drop(), true);
});

test('short and held jumps differ; cargo can be landed on from above without falling through', () => {
  const tops = [];
  for (const hold of [false, true]) {
    const g = start(), d = g.boarding; g.drop(); ticks(g); if (!hold) d.releaseJump();
    let top = d.y; for (let i = 0; i < 60; i++) { ticks(g); top = Math.min(top, d.y); } tops.push(top);
  }
  assert.ok(tops[1] < tops[0] - 30);
  const g = start(), d = g.boarding, cargo = d.props.find(p => p.type === 'cargo');
  d.x = cargo.x + 30; d.y = cargo.y - 2; d.vy = 170; d.grounded = false; ticks(g);
  assert.equal(d.y, cargo.y); assert.equal(d.grounded, true); assert.equal(d.vy, 0);
});

test('rifle bursts are warned, crouching avoids chest-height bullets, grenades have an airborne arc', () => {
  const g = start(), d = g.boarding; d.x = 350; d.hurt = 0; d.shotClock = 999;
  const e = d.enemies[0]; e.x = 460; e.clock = 1;
  ticks(g); assert.equal(e.state, 'aim'); assert.equal(d.bullets.length, 0);
  ticks(g, 22); assert.equal(e.state, 'burst'); assert.ok(d.bullets.length > 0);
  d.enemies = []; d.bullets = [{ x: d.x - 20, y: d.y - 23, vx: 300, vy: 0, age: 0 }];
  g.setYoke(0, 1); ticks(g, 6); assert.equal(d.health, 5);
  g.setYoke(0, 0); d.bullets = [{ x: d.x - 20, y: d.y - 23, vx: 300, vy: 0, age: 0 }];
  ticks(g, 6); assert.equal(d.health, 4);
  d.enemyFire({ x: d.x + 100, y: DECK_FLOOR, facing: -1, type: 'grenadier' });
  const grenade = d.bullets.at(-1); assert.ok(grenade.vy < 0); ticks(g, 25); assert.ok(grenade.vy > 0);
});

test('machine gun pickups switch weapons and exploding barrels chain through nearby targets', () => {
  const g = start(), d = g.boarding; d.x = 270; ticks(g); assert.equal(d.ammo, 200);
  d.setFire(true);
  d.shotClock = 0; ticks(g); assert.equal(d.shots.at(-1).damage, 2); assert.equal(d.ammo, 199);
  const barrel = d.props.find(p => p.type === 'barrel');
  d.hitProp(g, barrel, 2); assert.equal(barrel.dead, true);
  assert.ok(d.props.filter(p => p.type === 'barrel' && p.x < 1000).every(p => p.dead));
  assert.ok(d.enemies.filter(e => e.originX >= 825 && e.originX <= 940).every(e => e.dead));
});

test('deck death retries its own checkpoint and score; pause and resize retain the world and snapshot', () => {
  const g = start(), d = g.boarding; g.score = 500; d.x = 1202; ticks(g); assert.equal(d.section, 1);
  const snapshot = JSON.stringify(d.checkpoint), x = d.x; g.paused = true; ticks(g, 100); assert.equal(d.x, x);
  g.resize(390, 844); assert.equal(d.x, x); g.paused = false;
  g.score = 900; d.health = 1; d.hurt = 0; d.hurtPlayer(g); assert.equal(d.dead, true); ticks(g, 30); g.continueSegment();
  assert.equal(g.boarding.phase, 'raid'); assert.equal(g.boarding.health, 5); assert.equal(g.score, 500);
  assert.equal(JSON.stringify(g.boarding.checkpoint), snapshot); assert.equal(g.boarding.section, 1);
});

test('ordinary running, shooting and jumps defeat both spacecraft phases on desktop and portrait', () => {
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    const g = start({ width, height }), d = g.boarding;
    const route = { jump: 0 }, levels = new Set();
    for (let n = 0; n < 5000 && d.playing; n++) {
      if (d.boss) spacecraftInput(g); else deckRouteInput(g, route);
      if (d.grounded) levels.add(d.y);
      ticks(g); assert.ok(d.shots.length < 30 && d.bullets.length < 100 && d.particles.length <= 180);
    }
    assert.equal(route.jump, 11); assert.ok(levels.has(324) && levels.has(160));
    assert.equal(d.phase, 'cleared'); assert.equal(d.boss.state, 'wreck'); assert.equal(d.boss.hp, 0);
    assert.ok(d.health > 0);
    const score = g.score; ticks(g, 200); assert.equal(g.score, score);
    assert.equal(g.orbit.active, true);
    assert.equal(g.orbit.phase, 'breach');
  }
});

test('deck simulation is independent of display frame rate', () => {
  const states = [];
  for (const fps of [30, 50, 60, 144]) {
    const g = start(); g.setYoke(1, 0); g.boarding.setFire(true);
    for (let i = 0; i < fps * 2; i++) g.step(1 / fps);
    states.push(JSON.stringify(g.boarding));
  }
  for (const state of states) assert.equal(state, states[0]);
});
