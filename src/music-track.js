// One streamed chapter track. Playback failures stay optional, and an input
// retries autoplay rejection without asking play() on every rendering frame.
export class MusicTrack {
  constructor(file) {
    this.file = file; this.enabled = true; this.desired = false;
    this.token = 0; this.blocked = false;
  }
  attach(context, destination = context.destination) { this.context = context; this.destination = destination; }
  prepare() {
    if (this.media || !this.context) return;
    this.media = new Audio(`${import.meta.env.BASE_URL}assets/audio/${this.file}`);
    this.media.loop = true; this.media.preload = 'auto';
    this.media.addEventListener('error', () => { this.failed = true; this.pause(); });
    this.source = this.context.createMediaElementSource(this.media);
    this.gain = this.context.createGain(); this.gain.gain.value = 0;
    this.source.connect(this.gain); this.gain.connect(this.destination);
    this.media.load();
  }
  play() {
    if (!this.desired || !this.enabled || !this.media || this.failed || this.blocked || this.pending ||
      this.context.state !== 'running' || !this.media.paused) return;
    const token = ++this.token; this.pending = true;
    this.media.play().catch(error => {
      if (token !== this.token) return;
      if (error.name === 'NotAllowedError') this.blocked = true;
      else if (error.name !== 'AbortError') this.failed = true;
    }).finally(() => { if (token === this.token) this.pending = false; });
  }
  unlock() { this.blocked = false; this.play(); }
  pause() { this.token++; this.pending = false; this.media?.pause(); }
  reset() {
    clearTimeout(this.fadeTimer); this.fadeTimer = null;
    this.desired = false; this.blocked = false; this.pause();
    if (this.media) this.media.currentTime = 0;
    if (this.gain) {
      this.gain.gain.cancelScheduledValues(this.context.currentTime);
      this.gain.gain.setValueAtTime(0, this.context.currentTime);
    }
  }
  setEnabled(enabled) { this.enabled = enabled; if (!enabled) this.pause(); }
  update({ active, paused, volume }) {
    this.desired = active && !paused && this.enabled;
    if (paused || !this.enabled) { this.pause(); return; }
    if (this.context?.state !== 'running') return;
    if (active) {
      clearTimeout(this.fadeTimer); this.fadeTimer = null;
      this.prepare(); this.play();
      this.gain.gain.setTargetAtTime(volume, this.context.currentTime, .18);
    } else if (this.media && !this.media.paused && !this.fadeTimer) {
      this.gain.gain.setTargetAtTime(0, this.context.currentTime, .22);
      this.fadeTimer = setTimeout(() => this.reset(), 1200);
    }
  }
}
