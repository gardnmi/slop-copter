// Original recovery sounds: turbine load, cockpit caution, wheel contact and
// water impact. No downloaded samples or extra audio files are needed.
export const LANDING_SAMPLE_RATE = 22050;
export const LANDING_SOUNDS = ['turbine', 'fuel-low', 'fuel-empty', 'touchdown', 'splash'];

export function wantsCarrierMusic(game) {
  const a = game.assault;
  return a.active && !game.boarding.active && !game.orbit.active &&
    (a.phase === 'carrier' || Boolean(a.recovery));
}

export function landingSamples(kind) {
  const duration = { turbine: 3, 'fuel-low': .48, 'fuel-empty': .8, touchdown: .65, splash: 1.8 }[kind];
  const samples = new Float32Array(Math.round(duration * LANDING_SAMPLE_RATE));
  let seed = 0x4c414e44, low = 0, air = 0, phase = 0;
  const tau = Math.PI * 2;
  for (let i = 0; i < samples.length; i++) {
    const t = i / LANDING_SAMPLE_RATE, p = t / duration;
    seed = Math.imul(seed, 1664525) + 1013904223 | 0;
    const noise = (seed >>> 0) / 0x80000000 - 1;
    low += (noise - low) * .024; air += (noise - air) * .13;
    let v;
    if (kind === 'turbine') {
      // Rounded turbine whirr over warm air wash; throttle gain and pitch are
      // smoothed by the controller, so tapping lift cannot create clicks.
      v = air * .95 + low * .7 + Math.sin(tau * 196 * t) * .06 + Math.sin(tau * 392 * t) * .022;
    } else if (kind === 'fuel-low') {
      const local = t % .24;
      const envelope = Math.max(0, Math.min(1, local / .012, (.15 - local) / .035));
      v = (Math.sin(tau * 740 * t) * .5 + Math.sin(tau * 1480 * t) * .055) * envelope;
    } else if (kind === 'fuel-empty') {
      phase += tau * (145 - 90 * p) / LANDING_SAMPLE_RATE;
      const sputter = (.5 + .5 * Math.sin(tau * 23 * t)) ** 2;
      v = (Math.sin(phase) * .23 + air * 1.4) * (.25 + sputter) * (1 - p) ** 2;
    } else if (kind === 'touchdown') {
      const knock = Math.sin(tau * 74 * t) * .62 * Math.exp(-t * 23);
      const rattle = (Math.sin(tau * 410 * t) + Math.sin(tau * 687 * t)) * .07 * Math.exp(-t * 12);
      const rubber = (noise - air) * .16 * Math.exp(-(((t - .075) / .04) ** 2));
      v = knock + rattle + rubber + low * .55 * Math.exp(-t * 7);
    } else {
      const impact = Math.sin(tau * 48 * t) * .48 * Math.exp(-t * 11);
      const spray = air * 2.3 * Math.exp(-t * 2.8) * Math.min(1, t / .025);
      v = impact + spray + low * 1.8 * Math.exp(-t * 2);
    }
    const edge = kind === 'turbine' ? 1 : Math.min(1, t / .004, (duration - t) / .025);
    samples[i] = Math.tanh(v) * edge;
  }
  if (kind === 'turbine') {
    const overlap = Math.round(LANDING_SAMPLE_RATE * .2), end = samples.length - overlap;
    for (let i = 0; i < overlap; i++) {
      const p = i / (overlap - 1);
      samples[end + i] = samples[end + i] * (1 - p) + samples[i] * p;
    }
    return samples.slice(overlap);
  }
  return samples;
}

export function landingFuelBeat(air) {
  const r = air.recovery;
  if (air.phase !== 'landing' || r?.status !== 'flying' || r.fuel <= 0 || r.fuel > 20) return null;
  const critical = r.fuel <= 8;
  return `${critical ? 'critical' : 'low'}:${Math.floor(air.time / (critical ? 1.6 : 3.2))}`;
}
