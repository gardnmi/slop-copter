// Original self-destruct audio. The noise seed is separate from game physics.
export const ESCAPE_SAMPLE_RATE = 24000;
const TAU = Math.PI * 2;

export function escapeSamples(kind) {
  const duration = { warning: .28, urgent: .14, detonation: 5.4, breakup: 1.3, rumble: 4 }[kind];
  if (!duration) throw new RangeError(`Unknown escape sound: ${kind}`);
  const rate = ESCAPE_SAMPLE_RATE, length = Math.round(duration * rate);
  const channels = [new Float32Array(length), new Float32Array(length)];
  for (let channel = 0; channel < 2; channel++) {
    let seed = 0x455343 + channel * 193, low = 0, air = 0, bassPhase = 0, sirenPhase = 0, modPhase = 0;
    const samples = channels[channel];
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      seed = Math.imul(seed, 1664525) + 1013904223 | 0;
      const noise = (seed >>> 0) / 0x80000000 - 1;
      low += (noise - low) * .026; air += (noise - air) * .16;
      if (kind === 'warning' || kind === 'urgent') {
        const p = t / duration;
        const urgent = kind === 'urgent';
        // Wrist-bomb reference: a hard, inharmonic electrical rasp with fast
        // flutter and a dry cutoff. Keep the pitch stable within each blip;
        // per-beat tuning supplies the escalating, uneven pitch steps.
        const flutter = Math.sin(TAU * (urgent ? 39 : 27) * t);
        sirenPhase += TAU * 810 * (1 + .026 * flutter) / rate;
        modPhase += TAU * 527 * (1 + .008 * Math.sin(TAU * 61 * t)) / rate;
        const metal = Math.sin(sirenPhase + Math.sin(modPhase) * (urgent ? 2.5 : 1.9));
        const body = Math.sin(sirenPhase * .497) * .14;
        const chatter = .79 + .21 * flutter;
        const contact = air * .3 * Math.exp(-t * 70);
        const envelope = Math.min(1, t / .003) * Math.min(1, (duration - t) / .012) * (1 - .18 * p);
        samples[i] = Math.tanh((metal * .43 * chatter + body + contact) * 1.5) * .65 * envelope;
      } else if (kind === 'rumble') {
        // Slow, diffuse pressure with enough mid-bass for laptop speakers.
        const swell = .75 + .18 * Math.sin(TAU * t / duration + channel * .7);
        samples[i] = (low * 2.4 + air * .22 + Math.sin(TAU * 57 * t) * .045) * swell;
      } else {
        const distant = kind === 'detonation';
        bassPhase += TAU * (distant ? 33 + 62 * Math.exp(-t * 9) : 48 + 110 * Math.exp(-t * 14)) / rate;
        const pressure = Math.sin(bassPhase) * Math.exp(-t * (distant ? 1.7 : 6)) * .42;
        const crack = air * Math.exp(-t * (distant ? 4.5 : 7)) * (distant ? .65 : 1.5);
        const rolling = low * (distant ? 2.7 : 1.7) * Math.exp(-t * (distant ? .66 : 3));
        const echoes = distant ? low * (.8 * Math.exp(-(((t - .55) / .22) ** 2)) +
          .6 * Math.exp(-(((t - 1.15) / .35) ** 2)) + .4 * Math.exp(-(((t - 2.2) / .6) ** 2))) : 0;
        const envelope = Math.min(1, t / (distant ? .012 : .003)) * Math.min(1, (duration - t) / .35);
        samples[i] = Math.tanh((pressure + crack + rolling + echoes) * .9) * envelope;
      }
    }
    if (kind === 'rumble') {
      // Wrap into the beginning smoothly without a rhythmic volume dip.
      const blend = Math.round(rate * .2), end = length - blend;
      for (let i = 0; i < blend; i++) {
        const p = i / (blend - 1);
        samples[end + i] = samples[end + i] * (1 - p) + samples[i] * p;
      }
      channels[channel] = samples.slice(blend);
    }
  }
  return channels;
}

export function escapeCountdown(game) {
  if (game.assault.active || game.boarding.active || game.orbit.active) return 0;
  if (game.runner.active) return game.runner.flying ? game.runner.detonationTicks : 0;
  return ['dying', 'won'].includes(game.boss.phase) ? game.boss.selfDestructTicks : 0;
}

export function warningBeat(ticks) {
  if (ticks <= 0) return null;
  const interval = ticks > 200 ? 50 : ticks > 100 ? 25 : 10;
  return `${interval}:${Math.ceil(ticks / interval)}`;
}

// Derive pitch from the same timer buckets as the pulse scheduler. Rendering,
// mute and checkpoints cannot randomize it or detune repeated observations.
export function warningPitch(ticks) {
  const remaining = Math.max(1, Math.min(600, ticks));
  const index = remaining > 200 ? 12 - Math.ceil(remaining / 50)
    : remaining > 100 ? 16 - Math.ceil(remaining / 25) : 22 - Math.ceil(remaining / 10);
  const offsets = [-14, 13, -10, 17, -7, 9, -12, 6];
  return 2 ** ((-160 + index * 43 + offsets[index % offsets.length]) / 1200);
}

export function wantsEscapeMusic(game) {
  if (game.boarding.active || game.orbit.active) return false;
  // Recovery has its own track, including when a landing retry is pending.
  if (game.assault.active && (game.assault.phase === 'carrier' || game.assault.recovery)) return false;
  // Keep the same transport across extraction and overhead combat.
  return escapeCountdown(game) > 0 || game.runner.active || game.assault.active;
}
