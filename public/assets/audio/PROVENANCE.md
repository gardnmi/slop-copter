# Audio provenance

## Downwell descent effects

Ten compressed reference recordings cover gunfire, stomps, reloads, empty fire,
enemy/player damage and terrain destruction. Original jump/pickup accents and
adapted hay-boss cues complete the mix. Sources and processing are documented in
[Downwell sound provenance](downwell/PROVENANCE.md).

## Metal Slug deck effects

The deck chapter uses 21 sampled effects and voices from the credited Metal Slug
recreation repositories, plus the recorded flame firing effect from the Defense
soundbank. Sources, pinned revisions, hashes and processing are recorded in
[Metal Slug sound provenance](metal-slug/PROVENANCE.md).

## Classic Macintosh startup sound

`mac-startup.wav` is an unchanged copy of `StartupMacQuadra.wav` from
[David Schaub's Apple Sounds archive](https://froods.ca/~dschaub/sound.html).
The archive identifies the sound as **Macintosh Quadra**, sourced from a
**Macintosh LC 475**.

- Download: https://froods.ca/~dschaub/AppleSounds/Startup/StartupMacQuadra.wav
- Retrieved: 2026-10-01
- SHA-256: `90a431fcd1ef43928b6976ae14c84512dd36d0e51ca08ca53ff6d57f1d92e2a5`
- Format: PCM WAV, mono, 22,254 Hz, approximately 1.376 seconds; 61,308 bytes.
- Original sound: Apple. Archive/extraction: David Schaub.

This is a third-party historical sound used in this personal prototype, not
original Slop Copter audio or represented as freely licensed artwork. The
runtime reduces playback gain; the file itself has not been edited. The same
recording replays on the final hay landing to complete the game's loop.

The game effects are generated from the credited StuntCopter source routines
in `src/classic-sounds.js`; there are no downloaded gameplay recordings.
See [first-level audio notes](../../../docs/classic-audio.md).

## Cybernetic Pursuit

`cybernetic-pursuit.ogg` is compressed from the track supplied by the user on
2026-10-01: `/home/gardnmi/Downloads/cybernetic-pursuit [usesuno.com].mp3`.
The original local file is untouched and is not bundled in the game.

- Input: MP3, 192 kbps, 48 kHz stereo, 224.400 seconds; 5,406,598 bytes.
- Input SHA-256: `2ef04908ca690545ef9ca013b91c36661d0a38983a999ca3bff445ea95408664`
- Output: Ogg Opus, target 80 kbps VBR, 48 kHz stereo; 2,332,091 bytes.
- Output SHA-256: `68821cfcf272c37fb33108e1b205d238f409aef574e6edbad7fa34f24749f67a`
- Size reduction: 56.87%. Full audio length retained; embedded cover art and
  metadata removed. The Ogg container duration includes 6.5 ms of codec pre-skip.

Encoding command:

```sh
ffmpeg -hide_banner -y \
  -i '/home/gardnmi/Downloads/cybernetic-pursuit [usesuno.com].mp3' \
  -map 0:a:0 -vn -map_metadata -1 \
  -c:a libopus -b:a 80k -vbr on -compression_level 10 -application audio \
  public/assets/audio/cybernetic-pursuit.ogg
```

## Transformation effects

The Matrix-style conversion cues are original procedural audio in
`src/matrix-sounds.js`. They use synthesized tones and deterministic noise,
with no sampled film soundtrack or sound effects.

## Metallic Tension

`metallic-tension.ogg` is compressed from the track supplied by the user on
2026-10-01: `/home/gardnmi/Downloads/metallic-tension [usesuno.com].mp3`.
The original local file is untouched and is not bundled in the game.

- Input: MP3, 192 kbps, 48 kHz stereo, 210.432 seconds; 5,064,822 bytes.
- Input SHA-256: `2ce8364ce931fd7efaa5bbe9fd9e4760ce07dbddbc221f01c97fff974808d8d1`
- Output: Ogg Opus, target 80 kbps VBR, 48 kHz stereo; 2,153,390 bytes.
- Output SHA-256: `4c3e3390feaa26ee1fa61ece816ed1ca197f121167806f5651dbf5c3148c8105`
- Size reduction: approximately 57.5%. Full audio length retained; embedded
  cover art and metadata removed. Container duration includes codec pre-skip.

Encoding command:

```sh
ffmpeg -hide_banner -y \
  -i '/home/gardnmi/Downloads/metallic-tension [usesuno.com].mp3' \
  -map 0:a:0 -vn -map_metadata -1 \
  -c:a libopus -b:a 80k -vbr on -compression_level 10 -application audio \
  public/assets/audio/metallic-tension.ogg
```

## Self-destruct effects

The countdown warning, distant detonation, helicopter breakup and pursuing
rumble are original synthesis in `src/escape-sounds.js`, using tones and
deterministic filtered noise. They contain no sampled recordings.
The warning's metallic pulse texture references the Predator wrist-bomb,
including [Syndrome Studio's countdown promo](https://syndromestudio.com/predator/).
The reference recording was inspected separately and is not included in the game.
Every pulse's pitch is derived from the remaining countdown, with unequal rising
steps and faster repetition as detonation approaches.

## Raiden assault effects

The nine short effects under `raiden/` come from the pinned Ninja Dolphin Raiden
recreation also credited for the game's reference sprites. Source files, hashes,
trimming and compressed output are recorded in
[Raiden audio provenance](raiden/PROVENANCE.md).
The quiet helicopter bed, nonlethal hit contacts and enemy launches are original
synthesis in `src/air-sounds.js`.

## Lunar landing effects

The throttle-responsive turbine, low-fuel cockpit caution, engine sputter,
wheel/deck contact and sea splash are original deterministic synthesis in
`src/landing-sounds.js`. They use filtered noise and damped tones, with no
third-party recordings. The imported Raiden player explosion remains the
effect for a carrier collision; water crashes use the synthesized splash.

## Carrier recovery music — Top Gun (NES) Main Theme

`carrier-recovery.ogg` is edited and compressed from the track supplied by the
user on 2026-10-02:
`/home/gardnmi/Downloads/Y2Mate.is - Top Gun NES OST _ Main Theme.mp3`.
The source metadata identifies the title as **Top Gun (NES) OST | Main Theme**
and the uploader/artist field as **VideoGameMusicTube**. This is third-party
game music supplied for the personal prototype, not original Slop Copter music.
The original file is untouched and is not bundled.

- Input: MP3 VBR, 44.1 kHz stereo, 180.697687 seconds; 1,816,328 bytes.
- Input SHA-256: `28e8b2995033c3c1a01f865777da45f4bc7df12ce35a6a7cc4de7b3a402d5db9`
- Edit: source 8.000–120.000 seconds, exactly 112 seconds decoded. The final
  80 ms crossfade into source 7.920–8.000 seconds, so the repeat joins the
  original signal at 8.000 without a hard waveform cut or added silence.
- Encoding: 48 kbps VBR Ogg Opus, 48 kHz mono. The source channels are effectively
  identical (correlation 0.99999999 at 8 kHz), averaged at equal 0.5 weights with
  0.9 gain for headroom; decoded peak is 0.924. Cover art and metadata removed.
- Output: 808,207 bytes, 55.50% smaller than the supplied MP3. The Ogg duration
  is 112.0065 seconds including codec pre-skip.
- Output SHA-256: `724a7a485ad245bef109d9aba45bd44a2fc770e0debd1d27567dff8aa5a027bb`

Encoding command:

```sh
ffmpeg -hide_banner -y \
  -i '/home/gardnmi/Downloads/Y2Mate.is - Top Gun NES OST _ Main Theme.mp3' \
  -filter_complex '[0:a:0]aresample=48000,pan=mono|c0=0.5*c0+0.5*c1,volume=0.9,asplit=2[main][lead];[main]atrim=start=8:end=120,asetpts=PTS-STARTPTS[m];[lead]atrim=start=7.92:end=8,asetpts=PTS-STARTPTS[l];[m][l]acrossfade=d=0.08:c1=tri:c2=tri[out]' \
  -map '[out]' -vn -map_metadata -1 \
  -c:a libopus -b:a 48k -vbr on -compression_level 10 -application audio \
  public/assets/audio/carrier-recovery.ogg
```

## Arcade March

`arcade-march.ogg` is compressed from the track supplied by the user on
2026-10-02: `/home/gardnmi/Downloads/arcade-march [usesuno.com].mp3`.
The original local file is untouched and is not bundled in the game.

- Input: MP3, 192 kbps, 48 kHz stereo, 157.992 seconds; 3,805,415 bytes.
- Input SHA-256: `fb87b459e557e5f773ac2a88b2c64a97ab7885e866edacb52fe1ac4ccf04dce2`
- Output: Ogg Opus, target 80 kbps VBR, 48 kHz stereo; 1,568,894 bytes.
- Output SHA-256: `d2c5637d7329db7bc1bbe485986ec9fd5eb1bb3b9cc9f8bad0dc544898d969aa`
- Size reduction: 58.77%. Full stereo audio retained; embedded cover art and
  source metadata removed. Container duration is 157.9985 seconds including
  codec pre-skip. Decoded peak: -2.0 dBFS.

Encoding command:

```sh
ffmpeg -hide_banner -y \
  -i '/home/gardnmi/Downloads/arcade-march [usesuno.com].mp3' \
  -map 0:a:0 -vn -map_metadata -1 \
  -c:a libopus -b:a 80k -vbr on -compression_level 10 -application audio \
  public/assets/audio/arcade-march.ogg
```

## Downwell descent and Slop Eater — 机械终焉

`slop-eater-theme.ogg` is compressed from the user-supplied track:
`/home/gardnmi/Downloads/机械终焉 [usesuno.com].mp3` (2026-10-02).
The original file is untouched and is not bundled.

- Input: MP3, 48 kHz stereo, 189.600 seconds, 4,569,483 bytes.
- Input SHA-256: `4085ef146f96d686c4f090a3b8f15c40b1f4152eb0134993db9d5d98679c792e`.
- Output: Ogg Opus, target 80 kbps VBR, 48 kHz stereo, 1,967,985 bytes.
- Output SHA-256: `f2381be43b8eabf7c3bf06d3160df370e164b94de3cc90c280dc278c1971e9a4`.
- Reduction: 56.93%. Full stereo track retained; embedded artwork and source
  metadata removed. Container duration is 189.6065 seconds including pre-skip.
- The theme starts with the playable Downwell descent and continues through
  Slop Eater's reveal, both phases and the death sequence. Mix gain drops for the
  reveal and final blasts, then fades to silence for the classic ending.
  Pause, mute and descent/boss checkpoint retries preserve position;
  New Game resets it. A failed optional download cannot stop gameplay.

```sh
ffmpeg -hide_banner -y \
  -i '/home/gardnmi/Downloads/机械终焉 [usesuno.com].mp3' \
  -map 0:a:0 -vn -map_metadata -1 \
  -c:a libopus -b:a 80k -vbr on -compression_level 10 -application audio \
  public/assets/audio/slop-eater-theme.ogg
```
