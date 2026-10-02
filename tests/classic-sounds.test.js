import test from 'node:test';
import assert from 'node:assert/strict';
import { MAC_SAMPLE_RATE, rotorSamples, splatSamples, fanfareSamples, isClassicFlight } from '../src/classic-sounds.js';
import { createLevel } from '../src/level-select.js';

test('original freeform sounds have audible, bounded waveforms and historical playback durations', () => {
  const rotor = rotorSamples(), splat = splatSamples();
  assert.ok(rotor.length / MAC_SAMPLE_RATE > 2 && rotor.length / MAC_SAMPLE_RATE < 2.03);
  assert.ok(splat.length / MAC_SAMPLE_RATE > .13 && splat.length / MAC_SAMPLE_RATE < .14);
  for (const samples of [rotor, splat, fanfareSamples()]) {
    assert.ok(samples.every(s => Number.isFinite(s) && s >= -1 && s <= 1));
    const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
    assert.ok(rms > .1 && rms < .8, 'non-silent, unclipped mono samples');
  }
  assert.deepEqual(rotorSamples(), rotor, 'restarting uses the same rotor texture');
});

test('the original landing fanfare rises by octaves with difficulty without changing its rhythm', () => {
  const first = fanfareSamples(1), second = fanfareSamples(2);
  const crossings = samples => samples.slice(1, 3700).reduce((n, s, i) => n + (s > 0 && samples[i] < 0), 0);
  assert.equal(first.length, second.length);
  assert.ok(first.length / MAC_SAMPLE_RATE > .7 && first.length / MAC_SAMPLE_RATE < .73);
  assert.ok(Math.abs(crossings(second) - 2 * crossings(first)) <= 1);
  assert.deepEqual(fanfareSamples(5), fanfareSamples(99), 'the original caps pitch increases after level five');
});

test('classic flight sounds stop before later chapters and return with the normal opening', () => {
  for (const level of ['classic', 'matrix']) assert.equal(isClassicFlight(createLevel(level)), true);
  for (const level of ['bandana', 'counterattack', 'chrome-carriage', 'rooftops', 'landing', 'deck-raid', 'rocket-ride', 'downwell']) {
    assert.equal(isClassicFlight(createLevel(level)), false, level);
  }
  const g = createLevel('classic'); g.state = 'game_over';
  assert.equal(isClassicFlight(g), false);
  assert.equal(isClassicFlight(g.reset()), true);
});
