import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HZ } from '../src/game.js';
import { COUNTERATTACK_WAIT_TICKS, CINEMATIC_TICKS, GUN_SPEED, gunnerWeapon } from '../src/counterattack.js';

const ticks = (g, count = 1) => { for (let i = 0; i < count; i++) g.step(1 / HZ); };
function army(count = 8) {
  const g = new Game({ seed: 15 });
  g.shiftCount = 6; g.retaliation = true;
  for (let i = 0; i < count; i++) g.combat.miss(g, 100 + i * 110);
  // Isolate the transition from incoming damage; combat remains live in-game.
  for (const s of g.combat.shooters) s.cooldown = 10000;
  return g;
}
function startCombat(g) { ticks(g, COUNTERATTACK_WAIT_TICKS + CINEMATIC_TICKS); }

test('the eighth actual missed stuntman starts exactly three seconds of simulation time', () => {
  const g = new Game({ seed: 4 });
  for (let i = 0; i < 14; i++) {
    g.combat.hurtTicks = 1000;
    g.jumper = { x: 800, y: g.deck - 31 }; g.state = 'falling'; g.cartX = 30;
    ticks(g, 13);
    assert.equal(g.counterattack.created, Math.max(0, i - 5));
    if (i < 13) assert.equal(g.counterattack.phase, 'dormant');
  }
  assert.equal(g.counterattack.waitTicks, 3 * HZ);
  assert.equal(g.combat.shooters.length, 8);
  assert.equal(g.drop(), false);
  ticks(g, 3 * HZ - 1); assert.equal(g.counterattack.phase, 'waiting');
  ticks(g); assert.equal(g.counterattack.phase, 'cinematic');
  assert.equal(g.counterattack.cinemaTick, 0);
});

test('seven attackers need another actual landing and a crash cannot trigger the interlude', () => {
  const g = army(7); ticks(g, 20);
  assert.equal(g.counterattack.phase, 'dormant');
  const crashed = army(); crashed.state = 'crashing';
  for (let n = 0; n < 300 && crashed.state !== 'game_over'; n++) ticks(crashed);
  assert.notEqual(crashed.counterattack.phase, 'cinematic');
  assert.equal(crashed.state, 'game_over');
});

test('pause freezes the wait and cutscene; the cutscene freezes world, bullets, and damage', () => {
  const g = army(); ticks(g, 100); g.paused = true;
  const paused = JSON.stringify(g); ticks(g, 500); assert.equal(JSON.stringify(g), paused);
  g.paused = false; ticks(g, COUNTERATTACK_WAIT_TICKS - 100);
  assert.equal(g.inCinematic, true);
  g.combat.bullets.push({ x: 200, y: 400, vx: 0, vy: -8, age: 0 });
  const world = () => JSON.stringify([g.frame, g.cartX, g.cloudX, g.copterX, g.copterY, g.combat, g.lightning]);
  const frozen = world();
  g.setFlightCommand(4, -3); assert.equal(g.controlX, 0);
  assert.equal(g.drop(), false); assert.equal(g.combat.hit(g), false);
  ticks(g, 80); assert.equal(world(), frozen);
  g.paused = true; ticks(g, 300); assert.equal(g.counterattack.cinemaTick, 80);
  g.paused = false; ticks(g, CINEMATIC_TICKS - 80);
  assert.equal(g.counterattack.phase, 'active');
  assert.equal(g.counterattack.protectionTicks, 50);
  assert.equal(g.combat.hit(g), false);
  ticks(g); assert.equal(g.counterattack.bullets.length, 1);
  assert.notEqual(world(), frozen);
});

test('automatic rounds start at the visible muzzle, point down, and turn with steering', () => {
  for (const facing of [-1, 1]) {
    const g = army(); startCombat(g);
    g.setFlightCommand(facing * 4, 0); ticks(g);
    assert.equal(g.counterattack.facing, facing);
    const muzzle = gunnerWeapon(g), bullet = g.counterattack.bullets[0];
    assert.ok(Math.abs(Math.hypot(bullet.vx, bullet.vy) - GUN_SPEED) < 1e-9);
    assert.equal(Math.sign(bullet.vx), facing); assert.ok(bullet.vy > 0);
    assert.equal(bullet.x - bullet.vx, muzzle.x); assert.equal(bullet.y - bullet.vy, muzzle.y);
    assert.equal(g.drop(), false);
  }
});

test('steering the firing line can destroy all eight machines, scores once, and ends the wave', () => {
  const g = army(); startCombat(g);
  for (const target of [...g.combat.shooters]) {
    const facing = target.x < g.width / 2 ? -1 : 1;
    g.counterattack.facing = facing;
    g.moveCopter(g.width / 2, g.deck - 160);
    let muzzle = gunnerWeapon(g);
    const dx = (g.deck + 28 - muzzle.y) * muzzle.vx / muzzle.vy;
    g.moveCopter(g.copterX + target.x - muzzle.x - dx, g.copterY);
    ticks(g, 28);
    assert.equal(g.combat.shooters.includes(target), false);
  }
  assert.equal(g.counterattack.kills, 8); assert.equal(g.counterattack.phase, 'cleared');
  assert.equal(g.score, 2000); assert.equal(g.best, 2000);
  assert.equal(g.counterattack.wrecks.length, 8);
  assert.deepEqual(g.combat.bullets, []);
  ticks(g, 300);
  assert.equal(g.score, 2000); assert.deepEqual(g.counterattack.bullets, []);
  assert.deepEqual(g.counterattack.sparks, []);
  assert.equal(g.counterattack.phase, 'cleared'); assert.equal(g.drop(), false);
});

test('a swept fast shot hits a machine once and a missed shot leaves the playfield', () => {
  const g = army(); g.counterattack.phase = 'active'; g.counterattack.cooldown = 1000;
  const victim = g.combat.shooters[0];
  g.counterattack.bullets.push({ x: victim.x - 80, y: g.deck + 28, vx: 160, vy: 0, age: 0 });
  ticks(g); assert.equal(victim.health, 1); assert.equal(g.counterattack.bullets.length, 0);
  ticks(g); assert.equal(victim.health, 1); assert.equal(g.score, 0);
  g.counterattack.bullets.push({ x: g.width - 1, y: 90, vx: 18, vy: 4, age: 0 });
  ticks(g); assert.equal(g.counterattack.bullets.length, 0);
});

test('resize preserves cutscene progress and reset clears the whole counterattack', () => {
  const g = army(); ticks(g, COUNTERATTACK_WAIT_TICKS + 30); g.paused = true;
  g.resize(640, 1200);
  assert.equal(g.counterattack.cinemaTick, 30); assert.equal(g.inCinematic, true);
  g.paused = false; ticks(g, CINEMATIC_TICKS - 30 + 1);
  const speed = Math.hypot(g.counterattack.bullets[0].vx, g.counterattack.bullets[0].vy);
  g.resize(1800, 700);
  assert.equal(Math.hypot(g.counterattack.bullets[0].vx, g.counterattack.bullets[0].vy), speed);
  g.best = 1250;
  const reset = g.reset();
  assert.equal(reset.best, 1250); assert.equal(reset.counterattack.phase, 'dormant');
  assert.equal(reset.counterattack.created, 0); assert.equal(reset.counterattack.kills, 0);
  assert.deepEqual(reset.counterattack.bullets, []); assert.deepEqual(reset.counterattack.wrecks, []);
});
