import { MusicTrack } from './music-track.js';
import { WELL_ENTRY_MUSIC_FADE } from './orbit-entry.js';

// Imported Metal Slug recordings. Sources, edits and hashes live beside the
// assets; unavailable files stay silent rather than generating substitute tones.
export const DECK_SAMPLES = ['pistol', 'heavy', 'flame', 'explosion', 'heavy-explosion', 'grenade-explosion',
  'rebel-death', 'player-death', 'hit', 'pickup-heavy', 'pickup-flame', 'pickup',
  'boss-wake', 'boss-laugh', 'boss-death', 'grenade-launch', 'mission-start', 'impact', 'knife', 'equip', 'missile'];
const CUES = {
  'weapon-pistol': ['pistol', .26], 'weapon-heavy': ['heavy', .34],
  'weapon-flame': ['flame', .25],
  'enemy-shot': ['pistol', .075], 'boss-shot': ['missile', .17], grenade: ['grenade-launch', .17],
  explosion: ['explosion', .27], destroy: ['explosion', .27],
  'heavy-explosion': ['heavy-explosion', .3], 'grenade-explosion': ['grenade-explosion', .3],
  'boss-down': ['heavy-explosion', .3], stomp: ['heavy-explosion', .26],
  'rebel-death': ['rebel-death', .28], 'player-death': ['player-death', .42], hit: ['hit', .26],
  'pickup-heavy': ['pickup-heavy', .58], 'pickup-flame': ['pickup-flame', .58], pickup: ['pickup', .4],
  'boss-wake': ['boss-wake', .36], 'boss-laugh': ['boss-laugh', .36], 'boss-death': ['boss-death', .4],
  raid: ['mission-start', .45], continue: ['equip', .2], equip: ['equip', .2], lift: ['equip', .18],
  impact: ['impact', .095], knife: ['knife', .23],
};
const ANNOUNCER = new Set(['pickup-heavy', 'pickup-flame', 'pickup', 'mission-start']);
const DIALOGUE = new Set([...ANNOUNCER, 'boss-wake', 'boss-laugh', 'boss-death']);

export class DeckAudio {
  constructor() {
    this.buffers = new Map(); this.voices = new Set(); this.previous = null; this.enabled = true;
    this.lastPlayed = new Map(); this.music = new MusicTrack('arcade-march.ogg'); this.duckUntil = 0;
  }
  attach(context, { effects = context.destination, music = context.destination } = {}) {
    if (this.context === context) return;
    this.context = context;
    this.music.attach(context, music);
    this.bus = context.createDynamicsCompressor();
    this.bus.threshold.value = -9; this.bus.knee.value = 12; this.bus.ratio.value = 5;
    this.bus.attack.value = .004; this.bus.release.value = .16;
    this.bus.connect(effects);
  }
  unlock() { this.music.unlock(); }
  prepare() {
    if (this.ready || !this.context) return this.ready;
    this.ready = Promise.all(DECK_SAMPLES.map(async name => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/audio/metal-slug/${name}.ogg`);
        if (!response.ok) return;
        this.buffers.set(name, await this.context.decodeAudioData(await response.arrayBuffer()));
      } catch { /* Optional sound must never stall the chapter. */ }
    }));
    return this.ready;
  }
  play(name, volume, pan = 0) {
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    if (DIALOGUE.has(name)) this.duckUntil = this.context.currentTime + buffer.duration + .15;
    if (ANNOUNCER.has(name)) for (const voice of this.voices) if (ANNOUNCER.has(voice.kind)) this.stop(voice);
    const same = [...this.voices].filter(v => v.kind === name);
    const limit = ['pistol', 'heavy', 'impact'].includes(name) ? 3 : 2;
    if (same.length >= limit) this.stop(same[0]);
    if (this.voices.size >= 16) this.stop([...this.voices].find(v => !ANNOUNCER.has(v.kind)) ?? [...this.voices][0]);
    const source = this.context.createBufferSource(), gain = this.context.createGain(), panner = this.context.createStereoPanner();
    source.buffer = buffer; gain.gain.value = volume; panner.pan.value = ANNOUNCER.has(name) ? 0 : pan;
    source.connect(gain); gain.connect(panner); panner.connect(this.bus);
    const voice = { source, gain, panner, kind: name }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); this.voices.delete(voice); };
    source.start(); return voice;
  }
  stop(voice) {
    if (!voice) return;
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* Already finished. */ }
    voice.source.disconnect(); voice.gain.disconnect(); voice.panner.disconnect(); this.voices.delete(voice);
  }
  silence() { for (const voice of this.voices) this.stop(voice); }
  reset({ keepMusic = false } = {}) {
    this.silence(); this.previous = null; this.lastPlayed.clear(); this.duckUntil = 0;
    if (!keepMusic) this.music.reset();
  }
  setEnabled(enabled) { this.enabled = enabled; this.music.setEnabled(enabled); if (!enabled) this.silence(); }
  update(game, { started, enabled }) {
    const d = game.boarding;
    let before = this.previous;
    if (before && (before.deck !== d || before.game !== game || before.loops !== game.completedLoops || before.time > d.time)) {
      this.reset({ keepMusic: before.game === game && before.loops === game.completedLoops }); before = null;
    }
    // State is consumed even while muted/paused/loading: old gunshots never
    // burst out when sound returns, or when a checkpoint restores its history.
    const serial = before?.serial ?? d.audioSerial;
    this.previous = { game, deck: d, serial: d.audioSerial, time: d.time, loops: game.completedLoops, dead: d.dead };
    if (started && enabled && (d.active || game.assault.phase === 'carrier' || game.assault.phase === 'landing')) {
      this.prepare(); this.music.prepare();
    }
    const collapsing = game.orbit.phase === 'breach';
    const active = d.active && (!game.orbit.active || collapsing && game.orbit.age < WELL_ENTRY_MUSIC_FADE);
    this.music.update({
      active: started && active,
      paused: !started || !enabled || game.paused || game.state === 'game_over' || (active && d.dead),
      volume: this.context?.currentTime < this.duckUntil ? .22 : .42,
    });
    if (!started || !enabled || !d.active || game.orbit.active && !collapsing || game.state === 'game_over') { this.silence(); return; }
    if (game.paused || this.context?.state !== 'running') return;
    if (before && !before.dead && d.dead) this.silence();
    const events = d.audioEvents.filter(e => e.id > serial && d.time - e.time < .18);
    const pending = new Map();
    for (const event of events) {
      const cue = CUES[event.kind]; if (!cue) continue;
      const [name, volume] = cue;
      if (d.dead && name !== 'player-death') continue;
      // Offscreen destructibles should not drown the player's shots.
      const relative = (event.x - d.cameraX) / d.width;
      if (relative < -.2 || relative > 1.2) continue;
      if (!pending.has(name) || pending.get(name).volume < volume) pending.set(name, { name, volume, relative });
    }
    for (const { name, volume, relative } of pending.values()) {
      const minimum = name === 'impact' ? .065 : name === 'rebel-death' ? .1 : name.includes('explosion') ? .08 : .03;
      if (d.time - (this.lastPlayed.get(name) ?? -Infinity) < minimum) continue;
      this.lastPlayed.set(name, d.time);
      this.play(name, volume, Math.max(-.65, Math.min(.65, (relative - .5) * 1.3)));
    }
  }
}
