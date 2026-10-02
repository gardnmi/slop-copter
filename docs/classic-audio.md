# First-level audio

The opening uses the classic Macintosh Quadra startup chord. It plays once per
page load, immediately when autoplay is allowed or on the first click/keypress
otherwise. It plays again exactly once when the final falling stuntman lands in
the hay, completing the loop before classic controls resume. New Game and
Continue do not replay it. The rotor stays quiet under the chord, then returns
to its normal level. A muted ending landing is discarded rather than delayed.

The first flight chapter uses the three sounds defined by Duane Blehm's
StuntCopter 1.5: a looping rotor, a successful-landing fanfare, and a splat for
ground, horse, or driver collisions. The fanfare and splat interrupt the rotor;
the rotor resumes afterward. There was no separate drop or cloud sound in these
routines, so neither gets an invented cue in this pass.

`src/classic-sounds.js` adapts `CreateSound` and `InitialSoundRates` from the
[original source archive](https://github.com/gamache/blehm), pinned at
`32f10d0d8a3d6309aca7be40f9aa29c755f4dd10`:

- Rotor: 7,400-byte freeform buffer, its noise/quiet/pulse pattern, 1/6 sampling factor.
- Splat: 1,480-byte sawtooth buffer, 1/2 sampling factor.
- Landing: four square-wave voices, original phase offsets and fixed-point
  rates, added over 10/5/5/20 ticks. Pitch doubles with each level through five.

The freeform and four-tone sampling rules follow Apple's *Inside Macintosh*,
Volume II, Sound Driver, pages 227–230
([scanned manual](https://puyoman.net/documentation/Inside_Macintosh.pdf)).
The output runs at 22,255 Hz with a separate deterministic audio-noise seed,
one-tick restart gaps, DC filtering and a modest speaker low-pass. This recreates
the source synthesis rather than capturing an emulator or claiming an exact
match to every historical Macintosh speaker. It never consumes gameplay RNG.

`src/classic-audio.js` owns the buffers and playback lifecycle. It keeps one
rotor loop, suppresses repeated landing events, releases nodes after playback,
and stops flight audio at the counterattack/later chapters. Pause suspends the
audio clock. Mute discards current first-level effects, remembers the preference
across reloads, and does not replay missed effects when re-enabled. A missing
startup file or blocked audio context never blocks the game.

Browser activation behavior follows [MDN's autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).
Sound is controlled by **Options → Audio**.
Separate Music and Sound effects sliders adjust the entire game's mix from
0–100%, with a master audio toggle. Both volumes are saved independently.
The startup chord and rotor use the effects bus. Chapter fades and ducking
remain relative to the chosen music volume; volume changes never rewind a song.

The sound file's exact source and hash are in
[the audio credits](../public/assets/audio/PROVENANCE.md). Tests cover waveform
duration/pitch, real browser activation, event playback, pause, mute, reset,
chapter cleanup, and missing optional audio.

## Matrix transformation and music

`src/matrix-sounds.js` synthesizes six original stereo transformation cues:
filtered noise, descending electronic sweeps, gated data chatter, a low impact,
and a short stereo echo. Each conversion sounds once, with a longer, deeper cue
for the final background change. These contain no sampled film audio and use
their own deterministic noise rather than gameplay randomness.

`src/matrix-audio.js` preloads the user-supplied **Cybernetic Pursuit** after the
first conversion and starts it when the background becomes green. It loops
through the Matrix combat and chrome-horse fight, then fades into **Metallic
Tension** when self-destruct is armed. Level-select entry into a Matrix chapter starts the music without
replaying skipped transformation cues. The rotor is lowered during conversions
and music; the song ducks during the final conversion and combat introductions.

The complete stereo track is encoded as 80 kbps VBR Opus in an Ogg container:
**5,406,598 → 2,332,091 bytes**, about **57% smaller**, retaining its 3:44 length.
The supplied MP3 is untouched. A single media element streams the compressed
asset through a gain node instead of decoding the entire song into a large buffer.

Pause and mute pause the media element and preserve its position. New Game,
Continue, level selection, and the ending loop rewind it; reset also cancels any
pending fade. Blocked playback retries on user input, and a missing music file
leaves effects and gameplay working. Browser tests cover conversion timing,
streamed playback, chapter fade, pause/mute/reset, autoplay rejection, and missing
audio. The [audio credits](../public/assets/audio/PROVENANCE.md) record the source,
hashes, and encoding command.

## Self-destruct and rooftop escape

The fifth grenade hit arms the twelve-second timer and starts **Metallic
Tension**, preloaded during the horse fight. It continues without restarting
through the rightward flight, helicopter breakup, rooftop running, rescue
helicopter pickup and overhead assault. It loops if needed and fades into the
recovery track when the friendly carrier arrives. Pause, mute, and a rooftop
or air-assault death pause the song; retry resumes its position. New Game and
chapter selection rewind it. Direct air-assault shortcuts also
start the track.

The full 3:30 stereo track is compressed from **5,064,822 to 2,153,390 bytes**
(about **57.5% smaller**) as 80 kbps VBR Opus. The supplied MP3 is untouched.
`src/music-track.js` streams it through one media element, handles blocked or
missing audio, and releases old fade timers on reset.

`src/escape-sounds.js` generates the original alarm and explosion sounds. The
warning follows the same remaining ticks as the Matrix sky countdown: one pulse
per second initially, twice per second in the final four seconds, and five per
second in the final two. Each of the 22 blips has a distinct pitch, rising by
slightly uneven steps across the countdown. The timbre uses inharmonic frequency
modulation, rapid flutter, a short contact transient and an abrupt release,
replacing the smooth falling chirp with a dry, metallic wrist-bomb rasp.
The former victory jingle is omitted at this moment.

The sound-design reference is the Predator wrist-bomb countdown, including
[Syndrome Studio's Predator countdown spot](https://syndromestudio.com/predator/).
Its opening pulse texture was inspected as reference; the game generates its
own effect and does not bundle the reference recording.

At zero, a stereo detonation rolls away over 5.4 seconds. A continuous, low
rumble follows the advancing blast, growing louder as it approaches the player;
the helicopter breakup has a separate, sharper impact. Music lowers around
warnings and detonation. The old running rhythm remains a fallback if the song
cannot play. No external effects recordings or additional controls are required.

`src/escape-audio.js` observes game state without changing physics or consuming
gameplay randomness. Repeated renders cannot replay warnings; muted events are
discarded. Pause freezes the audio clock, and reset, death, or chapter exit
releases the effects. Tests cover the countdown handoff, urgency, one detonation,
unique escalating pitches, music continuity through retry, rescue and air
assault, the carrier handoff, pause/mute, and optional audio failure.

## Carrier arrival and lunar landing

The user-supplied **Top Gun (NES) Main Theme** takes over at friendly carrier
arrival and continues through the controllable recovery and touchdown sequence.
The music fades out when the pilot enters the deck run-and-gun. Direct carrier
and landing shortcuts also start it. Pause, mute and a landing crash pause the
track; a local retry resumes its position. New Game and chapter selection rewind
it. The existing `MusicTrack` transport streams one media element, loops it and
handles blocked/missing audio without interrupting play.

`carrier-recovery.ogg` starts at source **0:08** and ends at **2:00**, with the
last 80 ms crossfaded into the audio immediately before 0:08 for a continuous
sample boundary. The resulting loop is **1:52**. The source's two channels are
effectively identical, so mono 48 kbps VBR Opus preserves its sound while the
trim and compression reduce **1,816,328 to 808,207 bytes** (55.50% smaller).
The supplied MP3 is untouched. Encoding and hashes are in the audio provenance.

The helicopter has restrained rotor wash, a throttle-responsive turbine, a
low-fuel caution, empty-tank sputter, wheel contact and a water crash effect.
See [carrier sound notes](carrier-assault.md#sound). Browser checks cover the
actual compressed loop wrapping, continuous arrival/landing playback, local
retry, pause/mute, chapter cleanup and missing optional music.

## Deck chapter music

**Arcade March** replaces the carrier theme when the player boards. The entire
2:38 stereo song loops through the deck and all of its bosses, with a quieter mix
under weapon announcements and villain voices. Death/checkpoint retry preserves
the song's position; pause/mute also holds playback. It fades halfway through the lift-collapse
transition into Downwell. The user-supplied MP3 is compressed to a 1.57 MB Opus file (58.8% smaller).
See [deck audio behavior](deck-raid.md#arcade-march-music) and the
[source and encoding details](../public/assets/audio/PROVENANCE.md#arcade-march).
