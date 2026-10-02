import { MAC_SAMPLE_RATE, rotorSamples, splatSamples, fanfareSamples, isClassicFlight } from './classic-sounds.js';

export class ClassicAudio {
  constructor() {
    this.enabled = true;
    this.startupPlayed = false;
    this.startupEnds = 0;
    this.buffers = new Map();
    this.rotor = this.effect = this.startupVoice = null;
    this.previous = null;
  }

  prepare() {
    // A missing optional sound must never block the play button or game assets.
    return this.loading ??= fetch(`${import.meta.env.BASE_URL}assets/audio/mac-startup.wav`)
      .then(response => { if (!response.ok) throw new Error('Startup sound unavailable'); return response.arrayBuffer(); })
      .then(bytes => { this.startupBytes = bytes; })
      .catch(() => { this.startupUnavailable = true; });
  }

  attach(context, destination = context.destination) {
    if (this.context === context) return;
    this.context = context;
    this.destination = destination;
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass'; highpass.frequency.value = 65;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass'; lowpass.frequency.value = 4200;
    highpass.connect(lowpass); lowpass.connect(destination);
    this.output = highpass;
  }

  async startup({ replay = false } = {}) {
    if (this.startupPlayed && !replay || this.starting) return;
    this.starting = true;
    try {
      await this.prepare();
      if (this.startupUnavailable || !this.context) return;
      this.startupBuffer ??= await this.context.decodeAudioData(this.startupBytes.slice(0));
      if (!this.enabled || this.context.state !== 'running' || this.startupPlayed && !replay) return;
      this.startupPlayed = true;
      this.dispose(this.startupVoice);
      this.startupVoice = this.play(this.startupBuffer, .55, false, this.destination);
      this.startupEnds = this.context.currentTime + this.startupBuffer.duration;
      this.startupVoice.source.onended = () => {
        this.dispose(this.startupVoice); this.startupVoice = null;
      };
      if (this.rotor) this.rotor.gain.gain.setTargetAtTime(.025, this.context.currentTime, .025);
    } catch { this.startupUnavailable = true; }
    finally { this.starting = false; }
  }

  buffer(name, samples) {
    if (!this.buffers.has(name)) {
      const data = samples();
      const buffer = this.context.createBuffer(1, data.length, MAC_SAMPLE_RATE);
      buffer.copyToChannel(data, 0); this.buffers.set(name, buffer);
    }
    return this.buffers.get(name);
  }

  play(buffer, volume, loop = false, destination = this.output) {
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer; source.loop = loop; gain.gain.value = volume;
    source.connect(gain); gain.connect(destination); source.start();
    return { source, gain };
  }

  dispose(voice) {
    if (!voice) return;
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* Already finished. */ }
    voice.source.disconnect(); voice.gain.disconnect();
  }

  stopFlight() {
    this.dispose(this.rotor); this.dispose(this.effect);
    this.rotor = this.effect = null;
  }

  reset() { this.stopFlight(); this.previous = null; }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopFlight(); this.dispose(this.startupVoice); this.startupVoice = null;
      // Muting before activation also dismisses the opening chime.
      this.startupPlayed = true;
    }
  }

  update(game, { started, enabled, mix = 1 }) {
    const before = this.previous;
    const sameRun = before?.game === game && before.loops === game.completedLoops && before.frame <= game.frame;
    const caught = sameRun && game.catches > before.catches;
    const missed = sameRun && game.misses > before.misses;
    const returnScene = game.orbit?.phase === 'return' ? game.orbit.returnScene : null;
    const loopLanding = sameRun && returnScene && before.returnScene === returnScene && returnScene.catches > before.returnCatches;
    this.previous = { game, loops: game.completedLoops, frame: game.frame, catches: game.catches, misses: game.misses,
      returnScene, returnCatches: returnScene?.catches ?? 0 };
    // The closing hay landing gets the opening chord once, before control returns.
    // Consume muted landings too, so unmuting cannot replay an old event.
    if (loopLanding && started && enabled && !game.paused && this.context?.state === 'running') this.startup({ replay: true });
    const active = started && isClassicFlight(game);
    if (!active || !enabled) { this.stopFlight(); return; }
    // Pausing suspends the shared AudioContext, preserving an in-flight fanfare.
    if (game.paused || !this.context || this.context.state !== 'running') return;
    if (caught || missed) {
      this.stopFlight();
      const name = caught ? `catch-${Math.min(5, game.level)}` : 'splat';
      const buffer = this.buffer(name, () => caught ? fanfareSamples(game.level) : splatSamples());
      const voice = this.play(buffer, caught ? .24 : .3);
      this.effect = voice;
      voice.source.onended = () => {
        this.dispose(voice);
        if (this.effect === voice) this.effect = null;
      };
    }
    if (!this.effect && !this.rotor) {
      this.rotor = this.play(this.buffer('rotor', rotorSamples), 0, true);
    }
    if (this.rotor) {
      const volume = (this.context.currentTime < this.startupEnds ? .025 : .14) * mix;
      this.rotor.gain.gain.setTargetAtTime(volume, this.context.currentTime, .035);
    }
  }
}
