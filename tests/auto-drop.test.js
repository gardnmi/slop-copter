import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HZ, AUTO_DROP_TICKS } from '../src/game.js';
import { COUNTERATTACK_WAIT_TICKS } from '../src/counterattack.js';

const ticks = (g, count = 1) => { for (let i = 0; i < count; i++) g.step(1 / HZ); };
function transform(g, count = 6) {
  g.cloudEnabled = false;
  for (let i = 0; i < count; i++) {
    g.copterX = g.cartX + 220; g.copterY = g.deck - 72;
    assert.equal(g.drop(), true); ticks(g, 13);
  }
}

test('the final transformation starts unattended drops and stops at exactly eight actual Terminators', () => {
  const g = new Game({ seed: 9 }); transform(g, 5);
  ticks(g, 100); assert.equal(g.drops, 5); assert.equal(g.autoDeploy, false);
  transform(g, 1); assert.equal(g.fullyThemed, true); assert.equal(g.autoDeploy, true);
  g.copterX = 750; g.copterY = 20;
  // Keep the test focused on deployment; the live player must dodge incoming shots.
  g.combat.hurtTicks = 100000;
  const dropCount = g.drops;
  ticks(g, AUTO_DROP_TICKS);
  assert.equal(g.state, 'falling'); assert.equal(g.drops, dropCount + 1);
  const jumper = g.jumper; g.drop(); assert.equal(g.jumper, jumper);
  for (let i = 0; i < 3000 && g.counterattack.phase === 'dormant'; i++) ticks(g);
  assert.equal(g.counterattack.created, 8); assert.equal(g.combat.shooters.length, 8);
  assert.equal(g.counterattack.phase, 'waiting'); assert.equal(g.autoDeploy, false);
  assert.equal(g.counterattack.waitTicks, COUNTERATTACK_WAIT_TICKS);
  const drops = g.drops;
  ticks(g, COUNTERATTACK_WAIT_TICKS - 1); assert.equal(g.drops, drops);
  assert.equal(g.counterattack.phase, 'waiting');
  ticks(g); assert.equal(g.counterattack.phase, 'cinematic'); assert.equal(g.jumper, null);
});

test('automatic safe catches do not count toward eight and another stuntman still follows', () => {
  const g = new Game(); g.shiftCount = 6; g.cloudEnabled = false;
  g.copterY = g.deck - 72; g.copterX = g.cartX + 2 * (AUTO_DROP_TICKS + 1) + 32;
  ticks(g, AUTO_DROP_TICKS + 1);
  assert.equal(g.outcome, 'hay'); assert.equal(g.catches, 1);
  assert.equal(g.counterattack.created, 0); assert.equal(g.autoDeploy, true);
  ticks(g, 45 + AUTO_DROP_TICKS - 1);
  assert.equal(g.state, 'falling'); assert.equal(g.drops, 2);
});

test('auto-drop leaves steering live, freezes with pause, survives resize and stops on a crash or reset', () => {
  const g = new Game(); g.shiftCount = 6;
  g.setFlightCommand(4, 0); const x = g.copterX;
  ticks(g, 8); assert.ok(g.copterX > x);
  const remaining = g.autoDropTicks;
  g.paused = true; const frozen = JSON.stringify(g); ticks(g, 100);
  assert.equal(JSON.stringify(g), frozen);
  g.resize(640, 1100); assert.equal(g.autoDropTicks, remaining);
  g.paused = false; ticks(g, remaining); assert.equal(g.drops, 1);
  g.retaliation = true; g.combat.hits = 2; g.combat.hit(g);
  ticks(g, 200); assert.equal(g.drops, 1); assert.equal(g.state, 'game_over');
  const fresh = g.reset(); ticks(fresh, 100);
  assert.equal(fresh.drops, 0); assert.equal(fresh.autoDeploy, false);
});
