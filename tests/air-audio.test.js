import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { airSamples } from '../src/air-sounds.js';
import { LANDING_SOUNDS, landingSamples, landingFuelBeat } from '../src/landing-sounds.js';
import { damageAirship, AIRSHIP_INTRO_TICKS } from '../src/airship.js';

test('air combat records real cannon volleys, impacts, kills and simultaneous pickups', () => {
  const g = createLevel('burning-city'), a = g.assault;
  const start = a.audioSerial;
  const enemy = a.spawn('tank');
  Object.assign(enemy, { x: a.x - 7, y: a.y - 55, hp: 2, speed: 0, cooldown: 200 });
  a.supply(a.x, a.y, 'power');
  for (let i = 0; i < 12; i++) g.step(1 / 50);
  const kinds = a.audioEvents.filter(e => e.id > start).map(e => e.kind);
  assert.equal(kinds.filter(k => k === 'cannon').length, 2, 'one effect for the entire six-tick volley');
  for (const kind of ['impact', 'light-ground', 'powerup']) assert.ok(kinds.includes(kind), kind);
  assert.equal(enemy.dead, true); assert.equal(a.power, 2);
  const stopped = JSON.stringify(a.audioEvents); g.paused = true; g.step(.1);
  assert.equal(JSON.stringify(a.audioEvents), stopped);
  for (let i = 0; i < 200; i++) a.emitAudio('impact');
  assert.equal(a.audioEvents.length, 48, 'history stays bounded independently of rendering');
});

test('landing sounds have bounded output and caution repeats only below the fuel threshold', () => {
  for (const kind of LANDING_SOUNDS) {
    const s = landingSamples(kind);
    assert.ok(s.every(n => Number.isFinite(n) && Math.abs(n) < 1));
    assert.ok(s.some(n => Math.abs(n) > .1), kind);
    if (kind !== 'turbine') assert.ok(Math.abs(s[0]) < .001 && Math.abs(s.at(-1)) < .001);
  }
  const g = createLevel('landing'), a = g.assault;
  assert.equal(landingFuelBeat(a), null);
  a.recovery.fuel = 19; const low = landingFuelBeat(a);
  a.time += .1; assert.equal(landingFuelBeat(a), low);
  a.time += 3.2; assert.notEqual(landingFuelBeat(a), low);
  a.recovery.fuel = 7; const critical = landingFuelBeat(a);
  a.time += 1.6; assert.notEqual(landingFuelBeat(a), critical);
  a.recovery.fuel = 0; assert.equal(landingFuelBeat(a), null);
  a.recovery.fuel = 19; a.recovery.status = 'landed'; assert.equal(landingFuelBeat(a), null);
});

test('boss hits, weapon destruction and reactor death retain separate effects', () => {
  const g = createLevel('airship'), a = g.assault;
  a.airship.age = AIRSHIP_INTRO_TICKS;
  const [port, starboard, core] = a.airship.parts;
  damageAirship(a, g, port, 1); assert.equal(a.audioEvents.at(-1).kind, 'impact');
  damageAirship(a, g, port, 1000); assert.equal(a.audioEvents.at(-1).kind, 'heavy-air');
  damageAirship(a, g, starboard, 1000);
  damageAirship(a, g, core, 1000);
  assert.equal(a.audioEvents.at(-1).kind, 'airship-down');
  assert.equal(a.phase, 'airship-down');
  const landing = createLevel('landing');
  for (let i = 0; i < 50; i++) landing.step(1 / 50);
  assert.ok(landing.assault.audioEvents.every(e => e.kind !== 'cannon'));
});

test('the helicopter bed and fallback effects are bounded; the rotor is quiet at its maximum mix', () => {
  for (const kind of ['rotor', 'impact', 'missile', 'contact']) {
    const s = airSamples(kind);
    assert.ok(s.every(n => Number.isFinite(n) && Math.abs(n) < 1));
    const rms = Math.sqrt(s.reduce((sum, n) => sum + n * n, 0) / s.length);
    assert.ok(rms > .01);
    if (kind === 'rotor') assert.ok(rms * .055 < .01, 'ambient rotor stays below -40 dBFS RMS');
    else assert.ok(Math.abs(s[0]) < .001 && Math.abs(s.at(-1)) < .001);
  }
});
