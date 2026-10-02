import { escapeSamples, ESCAPE_SAMPLE_RATE, escapeCountdown, warningBeat, warningPitch, wantsEscapeMusic } from './escape-sounds.js';
import { MusicTrack } from './music-track.js';

// Countdown follows simulation ticks, not wall timers. State observation keeps
// missed sounds from piling up after mute, a blocked context, or a slow frame.
export class EscapeAudio {
  constructor() {
    this.buffers = new Map(); this.voices = new Set(); this.previous = null;
    this.music = new MusicTrack('metallic-tension.ogg'); this.duckUntil = 0;
  }
  attach(context, { effects = context.destination, music = context.destination } = {}) {
    this.context = context; this.output = effects; this.music.attach(context, music);
  }
  unlock() { this.music.unlock(); }
  buffer(kind) {
    if (!this.buffers.has(kind)) {
      const samples = escapeSamples(kind);
      const buffer = this.context.createBuffer(2, samples[0].length, ESCAPE_SAMPLE_RATE);
      samples.forEach((channel, i) => buffer.copyToChannel(channel, i));
      this.buffers.set(kind, buffer);
    }
    return this.buffers.get(kind);
  }
  play(kind, volume, loop = false, pitch = 1) {
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = this.buffer(kind); source.loop = loop; gain.gain.value = loop ? 0 : volume;
    source.playbackRate.value = pitch;
    source.connect(gain); gain.connect(this.output);
    const voice = { source, gain, kind }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(); return voice;
  }
  stop(voice) {
    if (!voice) return;
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* Already finished. */ }
    voice.source.disconnect(); voice.gain.disconnect(); this.voices.delete(voice);
  }
  silence() {
    for (const voice of this.voices) this.stop(voice);
    this.rumble = null;
  }
  reset() { this.silence(); this.music.reset(); this.duckUntil = 0; this.previous = null; }
  setEnabled(enabled) { this.music.setEnabled(enabled); if (!enabled) this.silence(); }
  update(game, { started, enabled }) {
    let before = this.previous;
    const r = game.runner;
    if (before && (before.game !== game || before.loops !== game.completedLoops || before.frame > game.frame)) {
      this.reset(); before = null;
    } else if (before && before.runner !== r) {
      // A rooftop retry replaces the runner, but continues the same song.
      this.silence(); before = null;
    }
    const countdown = escapeCountdown(game), beat = warningBeat(countdown);
    const inChase = r.active && !game.assault.active && !game.boarding.active && !game.orbit.active;
    const blast = inChase && r.blastX !== null;
    const phase = inChase ? r.phase : 'dormant';
    this.previous = { game, runner: r, loops: game.completedLoops, frame: game.frame, countdown, beat, blast, phase };
    const stopped = !started || !enabled || game.state === 'game_over' ||
      (inChase && (r.dead || phase === 'caught')) || (game.assault.active && game.assault.dead);
    // Fetch while fighting the horse, so the next track is ready on the fifth hit.
    if (started && enabled && game.boss.fighting && !r.active) this.music.prepare();
    if (beat && beat !== before?.beat) this.duckUntil = (this.context?.currentTime ?? 0) + .32;
    const detonating = before && !before.blast && blast;
    if (detonating) this.duckUntil = (this.context?.currentTime ?? 0) + 2;
    this.music.update({ active: started && wantsEscapeMusic(game), paused: stopped || game.paused,
      volume: (this.context?.currentTime ?? 0) < this.duckUntil ? .2 : .5 });
    if (stopped) { this.silence(); return; }
    if (game.paused || this.context?.state !== 'running') return;
    if (beat && beat !== before?.beat) this.play(countdown > 100 ? 'warning' : 'urgent', .24, false, warningPitch(countdown));
    // Inspect the actual blast transition: the runner's single cue slot can be
    // overwritten by a tail strike in the same display frame.
    if (detonating) {
      for (const voice of this.voices) if (['warning', 'urgent'].includes(voice.kind)) this.stop(voice);
      this.play('detonation', .65);
    }
    if (before && before.phase === 'strike' && phase === 'fall') this.play('breakup', .4);
    const chasing = blast && ['pursuit', 'strike', 'fall', 'roll', 'running', 'rescue'].includes(phase);
    if (chasing) {
      this.rumble ??= this.play('rumble', 0, true);
      const distance = Math.max(0, (r.flying || phase === 'strike' ? r.airWorldX : r.x) - r.blastX);
      const proximity = Math.max(0, 1 - distance / r.viewWidth);
      this.rumble.gain.gain.setTargetAtTime(.11 + proximity * .15, this.context.currentTime, .4);
    } else if (this.rumble) { this.stop(this.rumble); this.rumble = null; }
    // Retiring the chapter must also retire any long explosion tail.
    if (!inChase && !countdown) this.silence();
  }
}
