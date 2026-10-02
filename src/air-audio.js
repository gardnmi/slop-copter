import { AIR_SAMPLES, AIR_SAMPLE_RATE, airSamples } from './air-sounds.js';
import { LANDING_SOUNDS, LANDING_SAMPLE_RATE, landingSamples, landingFuelBeat, wantsCarrierMusic } from './landing-sounds.js';
import { MusicTrack } from './music-track.js';

const MIX = {
  cannon: .13, impact: .045, 'enemy-fire': .055, missile: .09,
  'light-air': .22, 'heavy-air': .25, 'light-ground': .23, 'heavy-ground': .26,
  'airship-down': .3, powerup: .26, 'power-max': .26, dead: .3, hit: .13,
  touchdown: .32, splash: .38,
};
const LIMITS = { cannon: 2, impact: 2, 'enemy-fire': 2, missile: 2 };

export class AirAudio {
  constructor() {
    this.buffers = new Map(); this.fallbacks = new Map(); this.voices = new Set(); this.lastPlayed = new Map();
    this.previous = null; this.enabled = true;
    this.music = new MusicTrack('carrier-recovery.ogg');
  }
  attach(context, { effects = context.destination, music = context.destination } = {}) {
    this.context = context; this.output = effects; this.music.attach(context, music);
  }
  unlock() { this.music.unlock(); }
  prepare() {
    if (this.ready || !this.context) return;
    this.ready = Promise.all(Object.entries(AIR_SAMPLES).map(async ([kind, file]) => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/audio/raiden/${file}.ogg`);
        if (!response.ok) return;
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(kind, buffer);
      } catch { /* A procedural fallback keeps audio optional. */ }
    }));
    return this.ready;
  }
  buffer(kind) {
    if (this.buffers.has(kind)) return this.buffers.get(kind);
    const landing = LANDING_SOUNDS.includes(kind);
    const fallback = landing || kind === 'rotor' || kind === 'missile' || kind === 'impact' ? kind : 'contact';
    if (!this.fallbacks.has(fallback)) {
      const samples = landing ? landingSamples(kind) : airSamples(fallback);
      const buffer = this.context.createBuffer(1, samples.length, landing ? LANDING_SAMPLE_RATE : AIR_SAMPLE_RATE);
      buffer.copyToChannel(samples, 0); this.fallbacks.set(fallback, buffer);
    }
    return this.fallbacks.get(fallback);
  }
  play(kind, volume, pan = 0, loop = false) {
    const same = [...this.voices].filter(v => v.kind === kind);
    if (same.length >= (LIMITS[kind] ?? 3)) this.stop(same[0]);
    if (this.voices.size >= 14) this.stop([...this.voices].find(v => !v.source.loop));
    const source = this.context.createBufferSource(), gain = this.context.createGain(), panner = this.context.createStereoPanner();
    source.buffer = this.buffer(kind); source.loop = loop; gain.gain.value = loop ? 0 : volume; panner.pan.value = pan;
    source.connect(gain); gain.connect(panner); panner.connect(this.output);
    const voice = { source, gain, panner, kind }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); this.voices.delete(voice); };
    source.start(); return voice;
  }
  stop(voice) {
    if (!voice) return;
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* Already stopped. */ }
    voice.source.disconnect(); voice.gain.disconnect(); voice.panner.disconnect(); this.voices.delete(voice);
  }
  silence() { for (const voice of this.voices) this.stop(voice); this.rotor = this.turbine = null; }
  reset({ keepMusic = false } = {}) {
    this.silence(); this.previous = null; this.lastPlayed.clear();
    if (!keepMusic) this.music.reset();
  }
  setEnabled(enabled) { this.enabled = enabled; this.music.setEnabled(enabled); if (!enabled) this.silence(); }
  update(game, { started, enabled }) {
    const a = game.assault;
    let before = this.previous;
    if (before && (before.air !== a || before.game !== game || before.loops !== game.completedLoops || before.time > a.time)) {
      // A recovery retry replaces the flight state, but resumes the same song.
      this.reset({ keepMusic: before.game === game && before.loops === game.completedLoops }); before = null;
    }
    const serial = before?.serial ?? a.audioSerial;
    const fuelBeat = landingFuelBeat(a);
    this.previous = { game, air: a, time: a.time, serial: a.audioSerial, loops: game.completedLoops,
      fuel: a.recovery?.fuel, fuelBeat };
    const active = a.active && !game.boarding.active && !game.orbit.active;
    if (started && enabled && a.phase === 'airship-down') this.music.prepare();
    this.music.update({ active: started && wantsCarrierMusic(game),
      paused: !started || !enabled || game.paused || game.state === 'game_over' || active && a.dead,
      volume: .48 });
    if (!started || !enabled || !active || game.state === 'game_over') { this.silence(); return; }
    this.prepare();
    if (game.paused || this.context?.state !== 'running') return;
    const now = this.context.currentTime;
    // Preserve simultaneous hits/kill/pickup events, but drop stale history
    // after mute, checkpoints, a blocked context or a long display frame.
    const events = a.audioEvents.filter(e => e.id > serial && a.time - e.time < .2);
    const seen = new Set();
    for (const event of events) {
      const kind = event.kind;
      // A water impact has its own splash instead of a second explosion.
      if (kind === 'dead' && events.some(e => e.kind === 'splash')) continue;
      if (!(kind in MIX) || seen.has(kind)) continue;
      seen.add(kind);
      const interval = kind === 'impact' ? .06 : kind === 'enemy-fire' ? .12 : kind === 'cannon' ? .075 : .045;
      if (now - (this.lastPlayed.get(kind) ?? -Infinity) < interval) continue;
      this.lastPlayed.set(kind, now);
      const pan = Math.max(-.6, Math.min(.6, (event.x / a.width - .5) * 1.2));
      this.play(kind, MIX[kind], pan);
    }
    const landing = a.phase === 'landing' && a.recovery?.status === 'flying';
    if (fuelBeat && fuelBeat !== before?.fuelBeat) this.play('fuel-low', .095);
    if (landing && before?.fuel > 0 && a.recovery.fuel === 0) this.play('fuel-empty', .19);
    if (landing && a.recovery.fuel > 0) {
      this.turbine ??= this.play('turbine', 0, 0, true);
      const thrust = a.recovery.thrust;
      this.turbine.gain.gain.setTargetAtTime(.014 + thrust * .10, now, thrust ? .12 : .35);
      this.turbine.source.playbackRate.setTargetAtTime(.8 + thrust * .38, now, thrust ? .2 : .4);
    } else if (this.turbine) { this.stop(this.turbine); this.turbine = null; }
    if (a.dead || a.phase === 'secured') {
      this.stop(this.rotor); this.rotor = null;
    } else {
      this.rotor ??= this.play('rotor', 0, 0, true);
      const thrust = a.recovery?.thrust ?? Math.min(1, Math.hypot(a.vx, a.vy) / 200);
      // Ambient bed only: roughly 20 dB beneath the gun and music, with a
      // small lift in engine speed while thrusting or maneuvering.
      this.rotor.gain.gain.setTargetAtTime(.04 + thrust * .015, now, .25);
      this.rotor.source.playbackRate.setTargetAtTime(.97 + thrust * .06, now, .3);
    }
  }
}
