import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { LANDING, landingReadout } from '../src/carrier-landing.js';
import { pilotCarrier } from './helpers/carrier-pilot.js';
const ticks = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(.02); };
function contact(overrides = {}) {
  const g = createLevel('landing'), r = g.assault.recovery;
  Object.assign(r, { x: r.shipX + LANDING.padOffset, y: r.deckY - .1,
    vx: r.shipSpeed, vy: r.shipVY + 10, angle: 0, ...overrides });
  return g;
}

test('landing is controllable: gravity, thrust, inertia and a moving deck replace automatic guidance', () => {
  const g = createLevel('landing'), r = g.assault.recovery;
  assert.equal(g.inCinematic, false); assert.equal(g.assault.playing, true);
  const start = { ...r }; ticks(g, 20);
  assert.ok(r.y > start.y); assert.ok(r.shipX > start.shipX); assert.equal(r.fuel, 100);
  g.setYoke(1, -1); ticks(g, 50);
  assert.ok(r.angle > .3); assert.ok(r.vx > start.vx); assert.ok(r.vy < 0); assert.ok(r.fuel < 94);
  const fuel = r.fuel, speed = r.vx; g.releaseControls(); ticks(g, 10);
  assert.equal(r.fuel, fuel); assert.ok(r.vx > speed * .97, 'release coasts, rather than hovering');
  assert.equal(g.assault.shots.length, 0); assert.equal(g.assault.bullets.length, 0);
});

test('fuel exhaustion cuts lift, but an already gentle unpowered landing is still possible', () => {
  const g = createLevel('landing'), r = g.assault.recovery;
  r.fuel = .03; g.setYoke(0, -1); ticks(g, 2);
  assert.equal(r.fuel, 0); assert.equal(r.thrust, 0);
  const vy = r.vy; ticks(g, 10); assert.ok(r.vy > vy);
  const gliding = contact({ fuel: 0 }); gliding.setYoke(0, -1); ticks(gliding);
  assert.equal(gliding.assault.recovery.status, 'landed');
});

test('a soft touchdown follows the moving pad before handing off to the aft deck', () => {
  const g = contact(); ticks(g);
  const r = g.assault.recovery, offset = r.deckOffset;
  assert.equal(r.status, 'landed'); assert.equal(g.boarding.active, false);
  assert.equal(g.inCinematic, true); assert.equal(landingReadout(r).sink, 0);
  g.setYoke(1, -1); ticks(g, LANDING.settleTicks - 1);
  assert.equal(r.x - r.shipX, offset); assert.equal(g.boarding.active, false);
  assert.equal(landingReadout(r).drift, 0, 'parked helicopter follows the changing deck speed');
  assert.equal(r.y, r.deckY, 'wheels follow the deck through the heave');
  assert.equal(landingReadout(r).sink, 0);
  ticks(g); assert.equal(g.assault.phase, 'secured'); assert.equal(g.boarding.phase, 'raid');
  assert.equal(g.boarding.checkpoint.label, 'AFT DECK');
});

test('hard, sideways, tilted and off-pad touchdowns each explain the failure', () => {
  for (const [overrides, message] of [
    [{ vy: 180 }, /Hard landing/], [{ vx: 100 }, /sideways speed/],
    [{ angle: .34 }, /tipped/], [{ x: 550 }, /Missed the lit/],
  ]) {
    const g = contact(overrides); ticks(g);
    assert.equal(g.assault.dead, true, JSON.stringify(overrides));
    assert.match(g.assault.reason, message); assert.equal(g.boarding.active, false);
  }
});

test('idle pilots ditch instead of skipping the challenge; Continue restores only the landing', () => {
  const g = createLevel('landing'); g.score = 1234; g.assault.saveCheckpoint(g);
  for (let n = 0; n < 750 && !g.assault.dead; n++) ticks(g);
  ticks(g, 30); assert.equal(g.assault.dead, true); assert.equal(g.boarding.active, false);
  assert.match(g.assault.reason, /sea/); g.continueSegment();
  assert.equal(g.assault.phase, 'landing'); assert.equal(g.assault.recovery.fuel, 100);
  assert.equal(g.assault.recovery.x, 130); assert.equal(g.assault.recovery.shipX, 290);
  assert.equal(g.score, 1234); assert.equal(g.inCinematic, false);
});

test('the default approach can be flown and landed with ordinary inputs and fuel to spare', () => {
  const g = createLevel('landing');
  let elapsed = 0, minSpeed = Infinity, maxSpeed = 0, totalSpeed = 0;
  let minDeck = Infinity, maxDeck = 0, speedTurns = 0, heaveTurns = 0, lastAcceleration = 0, lastHeave = 0;
  while (!g.boarding.active && !g.assault.dead && elapsed++ < 1800) {
    const before = g.assault.recovery.shipSpeed;
    pilotCarrier(g); ticks(g);
    const speed = g.assault.recovery.shipSpeed;
    const r = g.assault.recovery, acceleration = Math.sign(speed - before), heave = Math.sign(r.shipVY);
    if (lastAcceleration && acceleration && lastAcceleration !== acceleration) speedTurns++;
    if (lastHeave && heave && lastHeave !== heave) heaveTurns++;
    lastAcceleration = acceleration; lastHeave = heave;
    minDeck = Math.min(minDeck, r.deckY); maxDeck = Math.max(maxDeck, r.deckY);
    minSpeed = Math.min(minSpeed, speed); maxSpeed = Math.max(maxSpeed, speed); totalSpeed += speed;
    assert.ok(Math.abs(speed - before) < .25, 'carrier accelerates smoothly instead of jumping speed');
  }
  assert.equal(g.boarding.phase, 'raid', g.assault.reason);
  assert.ok(elapsed > 500 && elapsed < 1500);
  assert.ok(g.assault.recovery.fuel > 15 && g.assault.recovery.fuel < 90);
  assert.ok(totalSpeed / elapsed > 28, 'carrier travels faster than the former 24 px/s pace');
  assert.ok(maxSpeed - minSpeed > 5, 'approach includes a noticeable change of pace');
  assert.ok(minSpeed >= 24 && maxSpeed <= 36, 'speed changes remain within a catchable range');
  assert.ok(maxDeck - minDeck > 18, 'carrier visibly rises and falls');
  assert.ok(speedTurns >= 7 && heaveTurns >= 7, 'speed and heave change direction every few seconds');
});

test('touchdown judges descent against a rising deck, not the old fixed sea height', () => {
  for (const gentle of [true, false]) {
    const g = createLevel('landing');
    g.setYoke(0, -1); ticks(g, 100); g.releaseControls();
    const deck = g.assault.recovery;
    assert.ok(deck.shipVY < 0);
    Object.assign(deck, { x: deck.shipX + LANDING.padOffset, y: deck.deckY - .1,
      vx: deck.shipSpeed, vy: gentle ? deck.shipVY + 10 : 30, angle: 0 });
    ticks(g); assert.equal(deck.status, gentle ? 'landed' : 'crashed');
    if (gentle) assert.equal(deck.y, deck.deckY);
    else assert.match(g.assault.reason, /Hard landing/);
  }
});

test('pause, resize and render rate preserve landing physics and fuel', () => {
  const states = [];
  for (const fps of [30, 50, 60, 144]) {
    const g = createLevel('landing'); g.setYoke(.5, -1);
    for (let i = 0; i < fps * 2; i++) g.step(1 / fps);
    states.push(JSON.stringify(g.assault.recovery));
  }
  states.slice(1).forEach(s => assert.equal(s, states[0]));
  const g = createLevel('landing'); g.setYoke(1, -1); ticks(g, 40); g.paused = true;
  const before = JSON.stringify(g.assault.recovery); ticks(g, 200);
  g.resize(390, 844); assert.equal(JSON.stringify(g.assault.recovery), before);
});
