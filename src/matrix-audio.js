import { MATRIX_SAMPLE_RATE, transformationSamples, inMatrixChapter, wantsMatrixMusic } from './matrix-sounds.js';

export class MatrixAudio {
  constructor() {
    this.buffers = new Map(); this.voices = new Set();
    this.enabled = true; this.desired = false; this.previous = null;
    this.playToken = 0; this.duckUntil = 0; this.blocked = false;
  }

  attach(context, { effects = context.destination, music = context.destination } = {}) {
    this.context = context; this.output = effects; this.musicOutput = music;
  }

  prepareMusic() {
    if (this.music || !this.context) return;
    // Stream the compressed song rather than expanding several minutes into
    // a large AudioBuffer. Preload after the first change, play only at green.
    this.music = new Audio(`${import.meta.env.BASE_URL}assets/audio/cybernetic-pursuit.ogg`);
    this.music.preload = 'auto'; this.music.loop = true;
    this.music.addEventListener('error', () => { this.failed = true; this.pauseMusic(); });
    this.musicSource = this.context.createMediaElementSource(this.music);
    this.musicGain = this.context.createGain(); this.musicGain.gain.value = 0;
    this.musicSource.connect(this.musicGain); this.musicGain.connect(this.musicOutput);
    this.music.load();
  }

  playMusic() {
    if (!this.desired || !this.enabled || !this.music || this.failed || this.blocked ||
        this.context.state !== 'running' || this.pending || !this.music.paused) return;
    const token = ++this.playToken;
    this.pending = true;
    this.music.play().catch(error => {
      if (token !== this.playToken) return;
      // An input retries a policy rejection; missing audio never blocks play.
      if (error.name === 'NotAllowedError') this.blocked = true;
      else if (error.name !== 'AbortError') this.failed = true;
    }).finally(() => { if (token === this.playToken) this.pending = false; });
  }

  unlock() { this.blocked = false; this.playMusic(); }

  pauseMusic() {
    this.playToken++; this.pending = false;
    this.music?.pause();
  }

  rewindMusic() {
    clearTimeout(this.fadeTimer); this.fadeTimer = null;
    this.pauseMusic();
    if (this.music) this.music.currentTime = 0;
    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(this.context.currentTime);
      this.musicGain.gain.setValueAtTime(0, this.context.currentTime);
    }
  }

  clearCues() {
    for (const voice of this.voices) {
      voice.source.onended = null;
      try { voice.source.stop(); } catch { /* Already finished. */ }
      voice.source.disconnect(); voice.gain.disconnect();
    }
    this.voices.clear(); this.duckUntil = 0;
  }

  reset() {
    this.clearCues(); this.rewindMusic(); this.previous = null;
    this.desired = false; this.blocked = false;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) { this.clearCues(); this.pauseMusic(); }
  }

  cue(stage) {
    const context = this.context;
    if (!this.buffers.has(stage)) {
      const channels = transformationSamples(stage);
      const buffer = context.createBuffer(2, channels[0].length, MATRIX_SAMPLE_RATE);
      channels.forEach((samples, i) => buffer.copyToChannel(samples, i));
      this.buffers.set(stage, buffer);
    }
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = this.buffers.get(stage); gain.gain.value = stage === 6 ? .65 : .5;
    source.connect(gain); gain.connect(this.output);
    const voice = { source, gain }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(); this.duckUntil = context.currentTime + source.buffer.duration;
  }

  get flightMix() {
    if (this.context?.currentTime < this.duckUntil) return .35;
    return this.music && !this.music.paused ? .65 : 1;
  }

  update(game, { started, enabled }) {
    const before = this.previous;
    const sameRun = before?.game === game && before.loops === game.completedLoops && before.frame <= game.frame;
    if (before && !sameRun) this.reset();
    const changed = sameRun && game.shiftCount > before.shift;
    this.previous = { game, loops: game.completedLoops, frame: game.frame, shift: game.shiftCount };
    const chapter = inMatrixChapter(game);
    const wants = started && wantsMatrixMusic(game);
    this.desired = wants && enabled && !game.paused && game.state !== 'game_over';
    if (!enabled || !started) { this.pauseMusic(); return; }
    if (game.paused || game.state === 'game_over') { this.pauseMusic(); return; }
    if (!this.context || this.context.state !== 'running') return;
    if (chapter && game.shiftCount > 0) this.prepareMusic();
    if (chapter && changed) this.cue(game.shiftCount);
    if (wants) {
      clearTimeout(this.fadeTimer); this.fadeTimer = null;
      this.playMusic();
      if (this.musicGain) {
        const quiet = this.context.currentTime < this.duckUntil || game.counterattack.phase === 'cinematic' || game.boss.intro;
        this.musicGain.gain.setTargetAtTime(quiet ? .24 : .55, this.context.currentTime, .22);
      }
    } else if (this.music && !this.music.paused && !this.fadeTimer) {
      // Hand over to Metallic Tension when the self-destruct countdown begins.
      this.clearCues();
      this.musicGain.gain.setTargetAtTime(0, this.context.currentTime, .22);
      this.fadeTimer = setTimeout(() => this.rewindMusic(), 1200);
    }
  }
}
