import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { damageAirship } from '../src/airship.js';
import { markHit, tickHit } from '../src/hit-flash.js';
import { gamepadControls } from '../src/gamepad.js';

const ticks = (game, count) => { for (let i = 0; i < count; i++) game.step(.02); };

test('continuous hits retain a dark interval instead of keeping an enemy permanently white', () => {
  const target = {}, visible = [];
  for (let i = 0; i < 12; i++) { tickHit(target); markHit(target); visible.push(target.hit > 0); }
  assert.deepEqual(visible, [true, true, true, false, false, false, true, true, true, false, false, false]);
});

test('only vulnerable airship parts flash; the damage pulse ends while the component survives', () => {
  const game = createLevel('airship'), a = game.assault; a.shotClock = 1000; ticks(game, 150);
  const [wing, , core] = a.airship.parts;
  damageAirship(a, game, core, 1); assert.equal(core.hit, 0); assert.equal(core.hp, 150);
  damageAirship(a, game, wing, 1); assert.ok(wing.hit > 0); assert.equal(wing.hp, 57);
  ticks(game, 3); assert.equal(wing.hit, 0); assert.equal(wing.hp, 57);
  damageAirship(a, game, wing, 100); assert.equal(wing.hp, 0); assert.equal(wing.destroyedAt, a.time);
});

test('tank bursts commit their aim, stagger three rounds, and cancel if the player moves too close', () => {
  const game = createLevel('burning-city'), a = game.assault;
  a.wave = 999; a.x = a.width - 30; a.shotClock = 1000;
  const enemy = a.spawn('tank'); enemy.x = 45; enemy.y = 80; enemy.speed = 0; enemy.cooldown = 1000; enemy.aim = .8;
  a.shootEnemy(enemy); assert.equal(a.bullets.length, 1);
  a.x -= 70; ticks(game, 12); assert.equal(a.bullets.length, 3);
  for (const bullet of a.bullets) assert.ok(Math.abs(Math.atan2(bullet.vy, bullet.vx) - .8) < 1e-8);
  a.shootEnemy(enemy); a.x = enemy.x; a.y = enemy.y + 45; ticks(game, 7);
  assert.equal(enemy.salvo, 0);
});

test('deck weapons require input, stop on release, and grenades consume stock and damage armor', () => {
  const game = createLevel('deck-raid'), d = game.boarding;
  d.enemies = []; d.props = []; ticks(game, 20); assert.equal(d.shots.length, 0);
  d.setFire(true); ticks(game, 10); assert.ok(d.shots.length >= 2);
  d.setFire(false); d.shots = []; ticks(game, 20); assert.equal(d.shots.length, 0);
  const tank = { x: 290, y: 260, type: 'turret', hp: 24, maxHp: 24, state: 'patrol', clock: 999, age: 0, facing: -1 };
  d.enemies = [tank];
  assert.equal(d.throwGrenade(), true); assert.equal(d.grenades, 9); assert.equal(d.throwGrenade(), false);
  ticks(game, 55); assert.ok(tank.hp < 24); assert.equal(d.thrown.length, 0);
  d.grenades = 0; assert.equal(d.throwGrenade(), false);
  d.queueShot(); game.releaseControls(); ticks(game, 8); assert.equal(d.shots.length, 0);
});

test('cargo provides cover from rifle rounds and grenade stock survives checkpoint retry', () => {
  const game = createLevel('deck-raid'), d = game.boarding;
  d.enemies = []; d.x = 620; d.y = 216; d.hurt = 0;
  d.bullets.push({ x: 645, y: 200, vx: 300, vy: 0, age: 0 });
  ticks(game, 4); assert.equal(d.bullets.length, 0); assert.equal(d.health, 5);
  d.x = 1202; d.y = 260; d.grenades = 4; ticks(game, 1); d.grenades = 0; d.health = 1; d.hurt = 0;
  d.hurtPlayer(game); ticks(game, 30); d.retry(game);
  assert.equal(game.boarding.grenades, 4); assert.equal(game.boarding.fireHeld, false); assert.equal(game.boarding.thrown.length, 0);
});

test('standard gamepads map stick, d-pad and face buttons with a drift deadzone', () => {
  const pad = { connected: true, axes: [.12, -.18], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
  assert.deepEqual(gamepadControls(pad), { x: 0, y: 0, shoot: false, jump: false, grenade: false, pause: false });
  pad.buttons[2].pressed = pad.buttons[0].pressed = pad.buttons[1].pressed = pad.buttons[14].pressed = true;
  assert.deepEqual(gamepadControls(pad), { x: -1, y: 0, shoot: true, jump: true, grenade: true, pause: false });
  pad.connected = false; assert.deepEqual(gamepadControls(pad), gamepadControls(null));
});
