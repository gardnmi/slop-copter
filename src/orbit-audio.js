// Recorded reference effects, with small original pickup/jump accents.
// Exact sources and adaptations: assets/audio/downwell/PROVENANCE.md.
import { MusicTrack } from './music-track.js';
export const ORBIT_SAMPLES = ['shot', 'stomp', 'player-hit', 'player-death', 'reload',
  'empty', 'enemy-hit', 'enemy-death', 'rock-hit', 'rock-break'];
const CUES = {
  gun: ['shot', .3], machine: ['shot', .21, 1.08], stomp: ['stomp', .37],
  'player-hit': ['player-hit', .42], dead: ['player-death', .48],
  reload: ['reload', .16], empty: ['empty', .12], hit: ['enemy-death', .26],
  'enemy-hit': ['enemy-hit', .22], 'rock-hit': ['rock-hit', .1], 'rock-break': ['rock-break', .23],
  land: ['rock-hit', .085, .85], jump: ['jump', .2], gem: ['gem', .19],
  pickup: ['pickup', .24], combo: ['pickup', .3, .9],
  'eater-wake': ['stomp', .32, .5], 'eater-scrape': ['rock-break', .32, .6],
  'eater-roar': ['stomp', .4, .6], 'eater-title': ['player-death', .36, .7],
  'eater-warning': ['player-hit', .32, .8], 'eater-hit': ['enemy-hit', .31, .85],
  'eater-break': ['rock-break', .48, .55], 'eater-down': ['player-death', .48, .55],
  'eater-burst': ['rock-break', .29, .72], explosion: ['rock-break', .42, .5],
};
const IMPORTANT = new Set(['player-hit', 'player-death', 'pickup']);

function accent(context, kind) {
  const duration = kind === 'pickup' ? .3 : kind === 'jump' ? .085 : .065;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0); let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / context.sampleRate, p = t / duration;
    const hz = kind === 'pickup' ? [784, 988, 1318][Math.min(2, Math.floor(p * 3))]
      : kind === 'jump' ? 160 + 450 * p : 1500 - 550 * p;
    phase += hz / context.sampleRate;
    const wave = 1 - 4 * Math.abs((phase % 1) - .5);
    data[i] = wave * .7 * Math.min(1, t / .002) * (1 - p) ** 1.5;
  }
  return buffer;
}

export class OrbitAudio {
  constructor() {
    this.buffers = new Map(); this.voices = new Set(); this.lastPlayed = new Map();
    this.previous = null; this.enabled = true;
    this.music = new MusicTrack('slop-eater-theme.ogg');
  }
  attach(context, { effects = context.destination, music = context.destination } = {}) {
    if (this.context === context) return;
    this.context = context;
    this.music.attach(context, music);
    this.bus = context.createDynamicsCompressor();
    this.bus.threshold.value = -10; this.bus.knee.value = 12; this.bus.ratio.value = 5;
    this.bus.attack.value = .003; this.bus.release.value = .12; this.bus.connect(effects);
    for (const name of ['gem', 'pickup', 'jump']) this.buffers.set(name, accent(context, name));
  }
  unlock() { this.music.unlock(); }
  prepare() {
    if (this.ready || !this.context) return this.ready;
    this.ready = Promise.all(ORBIT_SAMPLES.map(async name => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/audio/downwell/${name}.ogg`);
        if (response.ok) this.buffers.set(name, await this.context.decodeAudioData(await response.arrayBuffer()));
      } catch { /* Audio is optional; a failed download cannot stop a fall. */ }
    }));
    return this.ready;
  }
  play(name, volume, pan = 0, rate = 1) {
    const buffer = this.buffers.get(name);
    if (!buffer || !this.enabled || this.context?.state !== 'running') return;
    const same = [...this.voices].filter(v => v.kind === name);
    if (same.length >= (name === 'shot' ? 3 : 2)) this.stop(same[0]);
    if (this.voices.size >= 16) this.stop([...this.voices].find(v => !IMPORTANT.has(v.kind)) ?? [...this.voices][0]);
    const source = this.context.createBufferSource(), gain = this.context.createGain(), panner = this.context.createStereoPanner();
    source.buffer = buffer; source.playbackRate.value = rate; gain.gain.value = volume; panner.pan.value = pan;
    source.connect(gain); gain.connect(panner); panner.connect(this.bus);
    const voice = { source, gain, panner, kind: name }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); this.voices.delete(voice); };
    source.start(); return voice;
  }
  stop(voice) {
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* The buffer already ended. */ }
    voice.source.disconnect(); voice.gain.disconnect(); voice.panner.disconnect(); this.voices.delete(voice);
  }
  silence() { for (const voice of this.voices) this.stop(voice); }
  reset({keepMusic=false}={}) {
    this.silence(); this.previous = null; this.lastPlayed.clear();
    if(!keepMusic)this.music.reset();
  }
  setEnabled(enabled) { this.enabled = enabled; this.music.setEnabled(enabled); if (!enabled) this.silence(); }
  update(game, { started, enabled }) {
    const o = game.orbit; let before = this.previous;
    if (before && (before.game !== game || before.orbit !== o || before.generation !== o.audioGeneration || before.time > o.time)) {
      this.reset({keepMusic:before.game===game&&before.orbit===o&&before.dead&&!!o.checkpoint}); before = null;
    }
    const serial = before?.serial ?? o.audioSerial;
    this.previous = { game, orbit: o, generation: o.audioGeneration, serial: o.audioSerial, time: o.time, dead: o.dead };
    // Fetch during the lift collapse, so the first playable round is ready.
    if (started && enabled && (o.active || game.boarding.boss?.form === 'elevator')) this.prepare();
    if(started&&enabled&&(o.active||game.boarding.boss?.form==='elevator'))this.music.prepare();
    const descentChapter=o.active&&!['breach','return'].includes(o.phase);
    this.music.update({
      active:started&&descentChapter,
      paused:!started||!enabled||game.paused||game.state==='game_over'||o.dead,
      // Give the name reveal and the final chain reaction space in the mix.
      volume:o.phase==='eater-intro'?.28:o.phase==='eater-death'?.24:.4,
    });
    if (!started || !enabled || !o.active || ['breach', 'return'].includes(o.phase) || game.state === 'game_over') {
      this.silence(); return;
    }
    if (game.paused || this.context?.state !== 'running') return;
    if (before && !before.dead && o.dead) this.silence();
    // Coalesce dense gem/terrain bursts, but never replace another kind of cue.
    const pending = new Map();
    for (const event of o.audioEvents) {
      if (event.id <= serial || o.time - event.time > .18 || (o.dead && event.kind !== 'dead')) continue;
      const cue = CUES[event.kind]; if (!cue) continue;
      const [name, volume, rate = 1] = cue;
      if (!pending.has(name) || pending.get(name).volume < volume) pending.set(name, { ...event, name, volume, rate });
    }
    for (const event of pending.values()) {
      const { name, volume, rate, x } = event;
      const minimum = name === 'gem' ? .07 : name === 'rock-hit' ? .08 : name === 'rock-break' ? .1 : name === 'empty' ? .2 : .025;
      if (o.time - (this.lastPlayed.get(name) ?? -Infinity) < minimum - .00001) continue;
      this.lastPlayed.set(name, o.time);
      const pitch = name === 'gem' ? 1 + Math.min(12, o.combo) * .018 : rate;
      this.play(name, volume, Math.max(-.4, Math.min(.4, (x - 160) / 400)), pitch);
    }
  }
}
