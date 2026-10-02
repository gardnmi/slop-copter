import test from 'node:test';
import assert from 'node:assert/strict';
import { transformationSamples, MATRIX_SAMPLE_RATE, wantsMatrixMusic } from '../src/matrix-sounds.js';
import { createLevel } from '../src/level-select.js';

test('transformation cues are distinct, finite stereo sounds with quiet boundaries and no clipping', () => {
  const lengths = new Set();
  for (let stage = 1; stage <= 6; stage++) {
    const [left, right] = transformationSamples(stage); lengths.add(left.length);
    assert.equal(left.length, right.length);
    assert.notDeepEqual(left, right);
    assert.ok(left.length / MATRIX_SAMPLE_RATE >= .7 && left.length / MATRIX_SAMPLE_RATE < 1.7);
    for (const channel of [left, right]) {
      assert.ok(channel.every(s => Number.isFinite(s) && Math.abs(s) <= 1));
      assert.ok(Math.abs(channel[0]) < .001 && Math.abs(channel.at(-1)) < .001);
      const rms = Math.sqrt(channel.reduce((sum, s) => sum + s * s, 0) / channel.length);
      assert.ok(rms > .04 && rms < .2);
    }
  }
  assert.equal(lengths.size, 6);
});

test('music begins only at the green world and belongs to the Matrix fights, not later chapters', () => {
  const game = createLevel('classic');
  for (let shift = 0; shift < 6; shift++) { game.shiftCount = shift; assert.equal(wantsMatrixMusic(game), false); }
  for (const id of ['matrix', 'bandana', 'counterattack', 'liquid-metal', 'chrome-carriage']) {
    assert.equal(wantsMatrixMusic(createLevel(id)), true, id);
  }
  for (const id of ['self-destruct', 'rooftops', 'rescue', 'burning-city', 'landing', 'deck-raid', 'rocket-ride', 'downwell', 'full-circle']) {
    assert.equal(wantsMatrixMusic(createLevel(id)), false, id);
  }
});
