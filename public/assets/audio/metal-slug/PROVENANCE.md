# Metal Slug deck sound effects

These are sampled Metal Slug effects and voices, replacing the deck chapter's
placeholder synthesized tones. Original game audio belongs to SNK/Nazca and is
used in this personal prototype at the user's request; it is not represented as
original Slop Copter audio or freely licensed game artwork.

Retrieved 2026-10-02. Exact source paths, pinned commits, source/output SHA-256,
trim bounds and normalization gains are recorded in [manifest.json](manifest.json).
The 21 runtime Ogg files total **162,292 bytes**. Original downloads and archives
were kept outside the project; the game bundles only the selected short effects.

## Primary reference repository

[alejru08/Metal-Slug](https://github.com/alejru08/Metal-Slug/tree/b2fb33d0033b8cc740491674c94621a79bdce425/audio),
commit `b2fb33d0033b8cc740491674c94621a79bdce425`, is also the source of this
chapter's imported sprites. Its README identifies the individual sounds, and
`src/Rossi.js`, `src/Enemies.js` and `src/Objects.js` confirm their gameplay uses.
The repository credits SNK game recordings distributed through Zedge and
Lyndione's sound collection.

| Runtime file | Source recording | Use |
| --- | --- | --- |
| `pistol.ogg` | `rossi_shot.mp3` | Player pistol and quieter enemy rifle fire |
| `explosion.ogg` | `explosion.mp3` | Destructibles, armor and smaller boss blasts |
| `rebel-death.ogg` | `rebel_scream.mp3` | Infantry deaths, including burning enemies |
| `player-death.ogg` | `Marco_Rossi_Death.mp3` | Fatal player damage |
| `pickup-heavy.ogg` | `metal_slug_HM.mp3` | Heavy Machine Gun announcement |
| `pickup.ogg` | `metal_slug_ok.mp3` | Health pickup |
| `boss-wake.ogg` | `allen_come_on.mp3` | Boss introduction taunt |
| `boss-laugh.ogg` | `allen_laugh.mp3` | Warden introduction |
| `boss-death.ogg` | `allen_die.mp3` | One villain death voice at the final defeat |

## Supplemental recreation repositories

[nathancy/Metal-Slug](https://github.com/nathancy/Metal-Slug/tree/c45df5f7bd184eeb776e3d7d36a756a6e0c4e802/Metal_Slug/Sounds),
commit `c45df5f7bd184eeb776e3d7d36a756a6e0c4e802`:

| Runtime file | Source recording | Use |
| --- | --- | --- |
| `heavy.ogg` | `Machinegun.wav` | 80 ms HMG shot, triggered once per actual round |
| `hit.ogg` | `Gettinghit.wav` | Nonfatal player hit |
| `grenade-launch.ogg` | `Shoot1.wav` | Grenade throw (also used for grenades in `Projectile.java`) |

The primary repository's HMG recording is a complete long burst. This short
recording lets the weapon's real four-tick cadence drive the audio without
stacking long bursts or continuing to fire after release.

[giacoballoccu/MetalSlugClone](https://github.com/giacoballoccu/MetalSlugClone/tree/541c189ec7db03bbc588144926904a8ba3b81bae/Assets/Audio),
commit `541c189ec7db03bbc588144926904a8ba3b81bae`:

| Runtime file | Source recording | Use |
| --- | --- | --- |
| `pickup-flame.ogg` | `Voices/mslug3-036-flame-shot.wav` | Flame Shot announcement |
| `mission-start.ogg` | `Voices/mslug3-048-mission-1-start.wav` | Landing-to-deck handoff |
| `impact.ogg` | `Effects/mslug3-108d-shot-hit.mp3` | Bullet contacts |
| `knife.ogg` | `Effects/mslug3-89-melee-hit-1.mp3` | Close-range knife strike |
| `equip.ogg` | `Effects/mslug3-91-weapon-equip.mp3` | Gear/mechanical contact cues |
| `missile.ogg` | `Effects/mslug3-1062-missile-out.mp3` | Boss and armored weapon launches |
| `heavy-explosion.ogg` | `Effects/metal-slug-59-destroy2.mp3` | Boss rupture and heavy impacts |
| `grenade-explosion.ogg` | `Effects/mslu3-grenade-hit.mp3` | Grenade detonation |

## Flame firing effect

The checked recreation repositories contain the Flame Shot announcement, but
not the firing effect. `flame.ogg` uses `B4_FLAME.mp3` from **wyz_2015's Metal
Slug Defense audio extraction**, hosted by
[6th Division's Den](https://6th-divisions-den.com/audio_material.html) in its
[MSD audio archive](https://www.mediafire.com/file/p1wy0x7smp4625v/MSD-audio-materials.zip/file).
This is a recorded SNK-series effect, not a synthesized approximation or a claim
that the recording was supplied by the primary recreation repository.
The same original `B4_FLAME.ogg` resource is named in the
[public Defense resource manifest](https://gist.github.com/Hipnosis183/383194ad41386a02a5549b8045bcf7bb).

## Processing

Each selected recording was decoded to 24 kHz mono, leading/trailing silence
trimmed using a 5 ms RMS window with 10 ms leading and 30 ms trailing padding,
peak-normalized to 0.78, and given a 1 ms attack/5 ms tail to prevent clicks.
The resulting PCM was encoded as 48 kbps VBR mono Opus. Pitch and playback speed
are unchanged; no tones, new voices, or synthesized replacements were added.
Runtime mixing uses restrained per-effect gain, short overlapping voices and a
soft compressor to keep simultaneous gunfire and boss blasts under control.
