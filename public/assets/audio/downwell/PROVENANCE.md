# Downwell chapter effects

Ten short recordings (28,469 bytes total) replace the chapter's synthetic combat
tones. Imported 2026-10-02 for the user's personal prototype. Exact source paths,
pinned commits, hashes, trims and gains are in [manifest.json](manifest.json).
These recordings are not represented as original Slop Copter work or freely
licensed assets. Downwell's game audio belongs to its original rights holders.

## DownwellGBA

[MGPAlpha/DownwellGBA](https://github.com/MGPAlpha/DownwellGBA/tree/480a5b1f7a82f8b647422f2086e2d74edfca1082/src),
commit `480a5b1f7a82f8b647422f2086e2d74edfca1082`, includes original recordings
in `src/og-sfx`. Its named `src/sfx` files and `src/player.cpp` identify these
four effects. We use the 44.1 kHz recordings instead of the reduced GBA PCM data.

| Runtime file | Original recording | Use |
| --- | --- | --- |
| `shot.ogg` | `00000c8a.wav` | Downward gunfire and boss machine gun |
| `stomp.ogg` | `00000c96.wav` | Enemy stomp and refill |
| `player-hit.ogg` | `00000d66.wav` | Nonfatal damage |
| `player-death.ogg` | `00000c50.wav` | Fatal damage |

## Clonewell

[samfalberg/Clonewell](https://github.com/samfalberg/Clonewell/tree/7779f9b48d6320ac438305aee230c2e30439f0c5/Sounds),
commit `7779f9b48d6320ac438305aee230c2e30439f0c5`, provides `reload.wav`,
`trigger_click.wav`, `enemy_hit.wav`, `enemy_death.wav`, `Cracked.wav` and
`Destroyed.wav`. Its player/enemy code identifies the relevant actions.
These are recreation-repository recordings, not a claim that all six are
original Downwell recordings.

## Adaptation and mixing

- Mono Opus, 48 kbps VBR from 24 kHz PCM. A 5 ms RMS scan removes padding,
  retaining 10 ms before and 30 ms after the audible section. Peak is normalized
  to 0.78 before encoding, with a 1 ms attack and 5 ms tail.
- Source files total 723,228 bytes; runtime samples total 28,469 bytes (96% smaller).
- Core shot/stomp/damage recordings retain their original pitch; machine gun
  rounds use a modest 1.08 rate. Slop Eater is our hay creature, so its rustles,
  warnings, phase rupture and death chain adapt the stomp/damage/destruction
  recordings at lower playback rates. They are not the original boss's cue map.
- Jump, gem and reward accents are short original PCM triangle-wave cues in
  `src/orbit-audio.js`; they are explicitly not sourced Downwell recordings.
- Actual simulation events drive effects, retaining simultaneous gem/shot/hit
  cues. Dense gem and impact bursts are coalesced, with 16 concurrent voices max.
- The separately supplied **机械终焉** descent and boss track is documented in
  [the main audio provenance](../PROVENANCE.md). Pause uses the shared audio context; mute, retry,
  return-to-classic and level changes stop voices and discard stale event history.
- Samples preload during the elevator encounter/collapse. Failed optional audio
  loads remain silent and never prevent gameplay.
