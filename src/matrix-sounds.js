// Original procedural transformation cues: data chatter, a spectral sweep,
// an electrical impact and a short stereo echo. No film audio is sampled.
export const MATRIX_SAMPLE_RATE = 32000;
const LENGTHS = [.72, .82, .92, .96, 1.06, 1.65];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function transformationSamples(stage) {
  stage = clamp(Math.trunc(stage), 1, 6);
  const duration = LENGTHS[stage - 1], rate = MATRIX_SAMPLE_RATE;
  const left = new Float32Array(Math.ceil(duration * rate)), right = new Float32Array(left.length);
  let seed = 0x4d415458 + stage, low = 0, sweep = 0, bass = 0, chip = 0;
  for (let i = 0; i < left.length; i++) {
    const t = i / rate, p = t / duration;
    seed = Math.imul(seed, 1664525) + 1013904223 | 0;
    const noise = (seed >>> 0) / 0x80000000 - 1;
    low += (noise - low) * (.035 + .15 * Math.sin(p * Math.PI));
    const impact = Math.max(0, t - .13);
    const envelope = Math.min(1, t / .008) * (1 - p) ** 1.4;
    const pulse = Math.floor(t * (24 + stage * 3));
    const packet = pulse % 7 !== 2 && pulse % 7 !== 5 ? 1 : 0;
    const chatterGate = Math.max(0, 1 - (t * (24 + stage * 3) % 1) * 2.7) * packet;
    sweep += Math.PI * 2 * (120 + (1450 + stage * 180) * Math.exp(-t * 5)) / rate;
    chip += Math.PI * 2 * (1100 + (pulse * 787 + stage * 163) % 2800) / rate;
    bass += Math.PI * 2 * (43 + 115 * Math.exp(-impact * 15)) / rate;
    const rise = t < .13 ? (t / .13) ** 2 : Math.exp(-impact * 7);
    const air = low * rise * (stage === 1 ? 2.1 : 1.5);
    const electric = Math.sin(sweep + Math.sin(sweep * 1.47) * 1.4) * .16 * Math.exp(-t * 2.5);
    const data = Math.sin(chip) * chatterGate * .14;
    const thud = t < .13 ? 0 : Math.sin(bass) * Math.exp(-impact * (stage === 6 ? 4.2 : 8)) * (.14 + stage * .024);
    const pan = Math.sin(t * 9 + stage) * .5;
    left[i] = (air + electric + thud + data * (1 - pan)) * envelope;
    right[i] = (air + electric + thud + data * (1 + pan)) * envelope;
  }
  // Feed-forward echo preserves a finite tail and requires no live delay nodes.
  const delay = Math.round(rate * .073);
  for (let i = left.length - 1; i >= delay; i--) {
    const tail = (1 - i / left.length) ** .5;
    left[i] += right[i - delay] * .28 * tail;
    right[i] += left[i - delay] * .28 * tail;
  }
  return [left, right];
}

export function inMatrixChapter(game) {
  return !game.runner.active && !game.assault.active && !game.boarding.active && !game.orbit.active;
}

export function wantsMatrixMusic(game) {
  return game.fullyThemed && inMatrixChapter(game) && !['dying', 'won'].includes(game.boss.phase);
}
