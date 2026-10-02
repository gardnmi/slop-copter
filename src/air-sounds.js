export const AIR_SAMPLE_RATE = 22050;
export const AIR_SAMPLES = {
  cannon: 'shot_regular', 'light-air': 'destroy_s_air', 'heavy-air': 'destroy_b_air',
  'light-ground': 'destroy_s_tank', 'heavy-ground': 'destroy_b_tank',
  'airship-down': 'destroy_boss', powerup: 'powerup', 'power-max': 'powerup_max', dead: 'player_explosion',
};

// The rotor and extra contact/launch sounds are original synthesis. Imported
// Raiden effects replace the procedural fallback as soon as they decode.
export function airSamples(kind) {
  const rotor = kind === 'rotor';
  const duration = rotor ? 2 : kind === 'missile' ? .25 : kind === 'impact' ? .055 : .1;
  const samples = new Float32Array(Math.round(duration * AIR_SAMPLE_RATE));
  let seed = 0x48454c49, low = 0, air = 0, phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / AIR_SAMPLE_RATE, p = t / duration;
    seed = Math.imul(seed, 1664525) + 1013904223 | 0;
    const noise = (seed >>> 0) / 0x80000000 - 1;
    low += (noise - low) * .035; air += (noise - air) * .22;
    if (rotor) {
      // Soft blade wash and engine body, without the old repeated alarm note.
      const blade = (.5 + .5 * Math.sin(Math.PI * 2 * 18 * t)) ** 3;
      samples[i] = low * (1.4 + blade * 1.8) + Math.sin(Math.PI * 2 * 72 * t) * .1 * (.3 + blade * .7);
    } else {
      phase += Math.PI * 2 * (kind === 'impact' ? 1800 - p * 600 : kind === 'missile' ? 140 - 70 * p : 150 - 90 * p) / AIR_SAMPLE_RATE;
      const body = Math.sin(phase) * (kind === 'impact' ? .12 : .2);
      const texture = kind === 'impact' ? (noise - air) * .4 : kind === 'missile' ? air * 1.3 : air * .8;
      samples[i] = Math.tanh((body + texture) * 1.8) * Math.min(1, t / .002) * (1 - p) ** 2;
    }
  }
  if (rotor) {
    const crossfade = Math.round(AIR_SAMPLE_RATE / 9), end = samples.length - crossfade;
    for (let i = 0; i < crossfade; i++) {
      const p = i / (crossfade - 1); samples[end + i] = samples[end + i] * (1 - p) + samples[i] * p;
    }
    return samples.slice(crossfade);
  }
  return samples;
}
