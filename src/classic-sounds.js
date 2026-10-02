// Adapted from Duane Blehm's StuntCopter 1.5: CreateSound and
// InitialSoundRates. These are the original synthesis recipes, not recordings.
// Source and Macintosh Sound Driver timing: docs/classic-audio.md.
export const MAC_SAMPLE_RATE = 22255;
const TICK_SAMPLES = 370;
const FLIP_RATES = [29316, 78264, 98607, 117264];
const FLIP_PHASES = [64, 192, 128, 0];
const FLIP_TICKS = [10, 5, 5, 20];

function freeform(bytes, count, gap = 0) {
  const length = Math.ceil(bytes.length / count);
  const samples = new Float32Array(length + gap);
  for (let i = 0; i < length; i++) samples[i] = (bytes[Math.floor(i * count)] - 128) / 128;
  return samples;
}

export function rotorSamples() {
  const bytes = new Uint8Array(7400).fill(127);
  // Sound randomness is separate from the game's physics RNG. The historical
  // rotor buffer was filled once, then reused for the whole game.
  let seed = 1986;
  for (let j = 0; j < bytes.length;) {
    seed = Math.imul(seed, 1664525) + 1013904223 | 0;
    bytes[j] = Math.abs((seed >>> 16) - 32768) >>> 9;
    if (j % 370 === 100) { j += 200; bytes[j] = 255; j += 70; }
    else j++;
  }
  // FixRatio(1, 6), plus the original one-tick PBWrite restart gap.
  return freeform(bytes, Math.round(65536 / 6) / 65536, TICK_SAMPLES);
}

export function splatSamples() {
  const bytes = Uint8Array.from({ length: 1480 }, (_, i) => i & 255);
  return freeform(bytes, .5);
}

export function fanfareSamples(level = 1) {
  const octave = 2 ** Math.max(0, Math.min(4, Math.trunc(level) - 1));
  const samples = new Float32Array((40 + 3) * TICK_SAMPLES);
  let offset = 0;
  for (let stage = 0; stage < 4; stage++) {
    const length = FLIP_TICKS[stage] * TICK_SAMPLES;
    for (let i = 0; i < length; i++) {
      let value = 0;
      for (let voice = 0; voice <= stage; voice++) {
        const phase = FLIP_PHASES[voice] + i * FLIP_RATES[voice] / 65536 * octave;
        value += (Math.floor(phase) & 255) < 128 ? 1 : -1;
      }
      samples[offset + i] = value / 4;
    }
    offset += length + TICK_SAMPLES;
  }
  return samples;
}

export function isClassicFlight(game) {
  return !game.orbit.active && !game.boarding.active && !game.assault.active && !game.runner.active &&
    game.boss.phase === 'dormant' && ['dormant', 'waiting'].includes(game.counterattack.phase) &&
    !['crashing', 'exploding', 'game_over'].includes(game.state);
}
