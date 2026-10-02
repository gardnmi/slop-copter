import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { EscapeAudio } from '../src/escape-audio.js';
import { escapeSamples, ESCAPE_SAMPLE_RATE, escapeCountdown, warningBeat, warningPitch, wantsEscapeMusic } from '../src/escape-sounds.js';

test('escape sounds are finite, bounded, and the distant detonation has a long decaying tail', () => {
  for (const kind of ['warning', 'urgent', 'detonation', 'breakup', 'rumble']) {
    const channels = escapeSamples(kind);
    assert.equal(channels[0].length, channels[1].length);
    for (const samples of channels) {
      assert.ok(samples.every(n => Number.isFinite(n) && Math.abs(n) < 1));
      const energy = samples.reduce((sum, v) => sum + v * v, 0) / samples.length;
      assert.ok(energy > .001, `${kind} must be audible`);
      if (kind !== 'rumble') assert.ok(Math.abs(samples[0]) < .001 && Math.abs(samples.at(-1)) < .001);
    }
  }
  const [blast] = escapeSamples('detonation');
  const rms = samples => Math.sqrt(samples.reduce((sum, n) => sum + n * n, 0) / samples.length);
  const front = rms(blast.slice(0, ESCAPE_SAMPLE_RATE));
  const tail = rms(blast.slice(ESCAPE_SAMPLE_RATE * 3, ESCAPE_SAMPLE_RATE * 4));
  assert.ok(blast.length / ESCAPE_SAMPLE_RATE >= 5);
  assert.ok(tail > .006 && tail < front / 3, 'audible but receding rumble');
});

test('the warning follows the visible countdown continuously and accelerates at four and two seconds', () => {
  const g = createLevel('chrome-carriage');
  assert.equal(escapeCountdown(g), 0);
  for (let i = 0; i < 5; i++) g.boss.grenadeHit(g);
  assert.equal(escapeCountdown(g), 600);
  const beats = [], counts = [];
  let previous = null;
  for (let tick = 0; tick <= 620; tick++) {
    if (g.runner.flying) g.setYoke(1, 0);
    const remaining = escapeCountdown(g), beat = warningBeat(remaining);
    counts.push(remaining);
    if (beat && beat !== previous) beats.push([tick, remaining]);
    previous = beat;
    g.step(1 / 50);
  }
  assert.equal(beats.filter(([, n]) => n > 200).length, 8);
  assert.equal(beats.filter(([, n]) => n <= 200 && n > 100).length, 4);
  assert.equal(beats.filter(([, n]) => n <= 100).length, 10);
  assert.ok(counts.every((n, i) => !i || n === Math.max(0, counts[i - 1] - 1)));
  assert.equal(g.runner.detonationTicks, 0);
  assert.notEqual(g.runner.blastX, null);
  const pitches = beats.map(([, remaining]) => warningPitch(remaining));
  assert.equal(new Set(pitches).size, beats.length, 'every countdown blip has a distinct pitch');
  assert.ok(pitches.every((pitch, i) => !i || pitch > pitches[i - 1]), 'urgency builds through both rate changes');
  assert.ok(pitches.at(-1) > pitches[0] * 1.6 && pitches.at(-1) < pitches[0] * 2, 'rises without a cartoon octave jump');
  for (let remaining = 600; remaining > 1; remaining--) {
    if (warningBeat(remaining) === warningBeat(remaining - 1)) assert.equal(warningPitch(remaining), warningPitch(remaining - 1));
  }
});

test('audio observation never changes the escape simulation and never replays an alarm between ticks', () => {
  const heard = createLevel('self-destruct', { seed: 41 }), silent = createLevel('self-destruct', { seed: 41 });
  const audio = new EscapeAudio(), events = [];
  audio.music = { attach() {}, prepare() {}, update() {}, reset() {} };
  audio.attach({ state: 'running', currentTime: 0 });
  audio.play = (kind, gain, loop) => {
    events.push(kind);
    return { gain: { gain: { setTargetAtTime() {} } } };
  };
  audio.stop = () => {};
  for (let tick = 0; tick < 1200 && !heard.runner.running; tick++) {
    for (const g of [heard, silent]) { if (g.runner.flying) g.setYoke(1, 0); g.step(1 / 50); }
    audio.update(heard, { started: true, enabled: true });
    const count = events.length;
    audio.update(heard, { started: true, enabled: true });
    assert.equal(events.length, count);
  }
  assert.equal(JSON.stringify(heard), JSON.stringify(silent));
  assert.equal(events.filter(e => e === 'detonation').length, 1);
  assert.equal(events.filter(e => e === 'breakup').length, 1);
  assert.equal(events.filter(e => e === 'rumble').length, 1);
});

test('Metallic Tension spans self-destruct through rooftop rescue and air combat, then retires at recovery', () => {
  for (const id of ['self-destruct', 'rooftops', 'rescue', 'burning-city', 'freeway', 'shipyards', 'carrier-approach', 'airship']) {
    assert.equal(wantsEscapeMusic(createLevel(id)), true, id);
  }
  for (const id of ['classic', 'matrix', 'chrome-carriage', 'carrier', 'landing', 'deck-raid', 'downwell', 'full-circle']) {
    assert.equal(wantsEscapeMusic(createLevel(id)), false, id);
  }
  const game = createLevel('rescue');
  game.runner.phase = 'lifting'; assert.equal(wantsEscapeMusic(game), true);
  game.runner.phase = 'escaped'; assert.equal(wantsEscapeMusic(game), true);
  game.assault.begin(game); assert.equal(wantsEscapeMusic(game), true);
  game.boarding.begin(game); assert.equal(wantsEscapeMusic(game), false);
});
