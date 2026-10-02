import { ClassicAudio } from './classic-audio.js';
import { MatrixAudio } from './matrix-audio.js';
import { EscapeAudio } from './escape-audio.js';
import { AirAudio } from './air-audio.js';
import { DeckAudio } from './deck-audio.js';
import { OrbitAudio } from './orbit-audio.js';

// Original first-chapter synthesis plus the later chapters' synthesized cues.
// Audio is gesture-unlocked and optional; silence never blocks gameplay.
export class BossAudio {
  constructor() { this.enabled = true; this.volumes = { music: 1, effects: 1 }; this.played = new Set(); this.voices = []; this.paused = false; this.classic = new ClassicAudio(); this.matrix = new MatrixAudio(); this.escapeAudio = new EscapeAudio(); this.airAudio = new AirAudio(); this.deckAudio = new DeckAudio(); this.orbitAudio = new OrbitAudio(); }
  setVolume(channel, value) {
    if (!(channel in this.volumes) || !Number.isFinite(value)) return;
    this.volumes[channel] = Math.max(0, Math.min(1, value));
    this.outputs?.[channel].gain.setTargetAtTime(this.volumes[channel] ** 2, this.context.currentTime, .025);
  }
  open() { return this.classic.prepare().then(() => this.unlock()); }
  unlock() {
    if (!this.enabled || this.paused) return;
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.outputs = {};
        for (const channel of ['music', 'effects']) {
          const bus = this.context.createGain(); bus.gain.value = this.volumes[channel] ** 2;
          bus.connect(this.context.destination); this.outputs[channel] = bus;
        }
      }
      this.classic.attach(this.context, this.outputs.effects);
      for (const chapter of [this.matrix, this.escapeAudio, this.airAudio, this.deckAudio, this.orbitAudio]) chapter.attach(this.context, this.outputs);
      this.context.resume().then(() => { this.classic.startup(); this.matrix.unlock(); this.escapeAudio.unlock(); this.airAudio.unlock(); this.deckAudio.unlock(); this.orbitAudio.unlock(); }).catch(() => {});
    }
    catch { /* Silent browsers can still play. */ }
  }
  reset() {
    this.classic.reset();
    this.matrix.reset();
    this.escapeAudio.reset();
    this.airAudio.reset();
    this.deckAudio.reset();
    this.orbitAudio.reset();
    for (const voice of this.voices) { try { voice.stop(); } catch { /* Already ended. */ } }
    this.voices = []; this.played.clear();
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    this.classic.setEnabled(enabled);
    this.matrix.setEnabled(enabled);
    this.escapeAudio.setEnabled(enabled);
    this.airAudio.setEnabled(enabled);
    this.deckAudio.setEnabled(enabled);
    this.orbitAudio.setEnabled(enabled);
    if (enabled && !this.paused) this.unlock();
    else this.context?.suspend().catch(() => {});
  }
  update(game, { started = true } = {}) {
    const context = this.context;
    if (game.paused !== this.paused) {
      this.paused = game.paused;
      if (context && this.enabled) context[game.paused ? 'suspend' : 'resume']().catch(() => {});
      else if (!game.paused && this.enabled) this.unlock();
    }
    this.matrix.update(game, { started, enabled: this.enabled });
    this.escapeAudio.update(game, { started, enabled: this.enabled });
    this.airAudio.update(game, { started, enabled: this.enabled });
    this.deckAudio.update(game, { started, enabled: this.enabled });
    this.orbitAudio.update(game, { started, enabled: this.enabled });
    this.classic.update(game, { started, enabled: this.enabled, mix: this.matrix.flightMix });
    if (!started || !context || !this.enabled || this.paused) return;
    if (game.orbit.active) return;
    if (game.boarding.active) return;
    if (game.assault.active) return;
    if (game.runner.active) { this.escape(game.runner); return; }
    const phase = game.boss.phase;
    if (phase === 'dormant') { this.played.clear(); return; }
    if (this.played.has(phase) || !['victory', 'melt', 'hunt'].includes(phase)) return;
    this.played.add(phase);
    if (phase === 'victory') {
      [392, 494, 587, 784].forEach((hz, i) => this.tone('triangle', i * .13, .42, .045, [[0, hz]]));
    } else if (phase === 'melt') {
      this.tone('sine', 0, 1.1, .045, [[0, 510], [.4, 175], [1, 52]]);
      this.tone('triangle', .12, .7, .016, [[0, 490], [.6, 66]]);
    } else this.tone('sawtooth', 0, .65, .04, [[0, 150], [.13, 70], [.6, 32]]);
  }
  escape(run) {
    if (this.lastRunner !== run) { this.lastRunner = run; this.lastCue = -1; this.lastBeat = -1; }
    if (this.lastCue !== run.cue.id) {
      this.lastCue = run.cue.id;
      const cue = run.cue.name;
      if (cue === 'alarm') {
        this.tone('square', 0, .15, .012, [[0, 240], [.14, 380]]);
        this.tone('triangle', .18, .16, .014, [[0, 170], [.15, 260]]);
      } else if (cue === 'strike') this.tone('sawtooth', 0, .52, .025, [[0, 90], [.48, 750]]);
      else if (cue === 'roll' || cue === 'stumble') this.tone('triangle', 0, .20, .023, [[0, 85], [.18, 38]]);
      else if (cue === 'jump') this.tone('triangle', 0, .1, .012, [[0, 120], [.09, 190]]);
      else if (cue === 'land' || cue === 'step') this.tone('triangle', 0, .055, cue === 'land' ? .025 : .01, [[0, 92], [.05, 38]]);
      else if (cue === 'glass') [0, .03, .07].forEach((t, i) => this.tone('square', t, .07, .005, [[0, 1700 - i * 240], [.06, 750]]));
      else if (cue === 'dead') this.tone('sawtooth', 0, .48, .025, [[0, 120], [.45, 28]]);
      else if (cue === 'rescue' || cue === 'pickup') [0, .18].forEach(t => this.tone('triangle', t, .14, .025, [[0, 587], [.12, 784]]));
      else if (cue === 'lifting') this.tone('triangle', 0, .35, .026, [[0, 160], [.3, 320]]);
      else if (cue === 'escaped') [392, 494, 587, 784].forEach((hz, i) => this.tone('triangle', i * .14, .5, .035, [[0, hz]]));
    }
    // Keep the procedural rhythm as a fallback when chapter music is unavailable.
    const beat = Math.floor(run.time * 5.2);
    const musicPlaying = this.escapeAudio.music.media && !this.escapeAudio.music.media.paused;
    if (run.running && !musicPlaying && beat !== this.lastBeat) {
      this.lastBeat = beat;
      const note = [55, 55, 65.4, 55, 49, 49, 65.4, 73.4][beat % 8];
      this.tone('triangle', 0, .16, .010, [[0, note]], 'music');
      if (beat % 4 === 0) this.tone('sine', 0, .12, .016, [[0, 105], [.1, 40]], 'music');
    }
    const rotorBeat = Math.floor(run.time * 14);
    if (run.rescue && !run.dead && rotorBeat !== this.lastRotorBeat) {
      this.lastRotorBeat = rotorBeat;
      this.tone('triangle', 0, .055, .013, [[0, 65], [.05, 33]]);
    }
  }
  tone(type, delay, duration, volume, notes, channel = 'effects') {
    const context = this.context, time = context.currentTime;
    const oscillator = context.createOscillator(), gain = context.createGain(); oscillator.type = type;
    notes.forEach(([at, hz], i) => oscillator.frequency[i ? 'exponentialRampToValueAtTime' : 'setValueAtTime'](hz, time + delay + at));
    gain.gain.setValueAtTime(0, time + delay); gain.gain.linearRampToValueAtTime(volume, time + delay + .03);
    gain.gain.exponentialRampToValueAtTime(.0001, time + delay + duration);
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1200;
    oscillator.connect(filter); filter.connect(gain); gain.connect(this.outputs[channel]);
    oscillator.start(time + delay); oscillator.stop(time + delay + duration); this.voices.push(oscillator);
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); gain.disconnect(); this.voices = this.voices.filter(v => v !== oscillator); };
  }
}
