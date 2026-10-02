# Shaft collapse → Downwell-style descent → Slop Eater → Full circle

Current target: the user's twelve-second recording,
`/home/gardnmi/Videos/screenrecording-2026-10-01_15-37-36.mp4`.
Reviewed its complete sequence with half-second frame samples, plus a full-size
still for scale, terrain, meter proportions and impact effects. This supersedes
the earlier Matrix clouds and Earth-globe presentation. The requested character
variation is a **red headband and a handheld downward-firing gun**.

## Presentation

- Pure black, white and red (`#000000`, `#ffffff`, `#ff0000`).
- Narrow 320-world-pixel shaft, a minimum 560-world-pixel view, black action area,
  quiet red/white side scenery, outlined health bar and tall angled ammo gauge.
- Reference-game player animation and rock autotiles instead of improvised stick
  figures and randomly dotted rectangles. Native 16px terrain frames render at
  2× world size; exposed edges curve and taper into the cave walls.
- A short red bandana follows the player. Both hands meet the gun receiver; its
  barrel points below the player. Muzzle flashes and a single projectile share
  the same physical socket in `orbit-pose.js`, including facing and recoil.
- Reference enemy frames and smoke/splinter impact frames; brief hit pauses and
  shake. Reload uses a small flash above the character, not an enemy explosion.
- Downward rounds have a chunky animated red wake and a rounded white leading
  tip; Gem High makes them larger. A narrow muzzle flash comes from the gun.
  Terrain contacts spark at the collision point and surviving enemies flash white.
- Red copies of the actual player pose follow previous world positions, fading
  over 7 simulation ticks (12 during Gem High). History is bounded, freezes when
  paused, clears on chapter transitions and is hidden with reduced motion enabled.
- Compact HUD lettering, spinning gem frames and stacked combo rewards keep the
  smaller feedback readable. Shot/trail details were compared against 12fps
  frame sequences from the supplied recording and the three annotated screenshots.
- Braced crates break when shot; connected shelves provide reload stops. Gem
  pockets require opening their shell. Empty sections have narrow solid walls;
  there is no hidden tile-width barrier inside the visible passage.

The three PNG reference sheets are used for this **private prototype**, with
source and rights provenance in
[public/assets/downwell/README.md](../public/assets/downwell/README.md).
They are not claimed as original Slop Copter artwork or freely licensed assets.
Runtime crops are cached and converted to the chapter's three inks.

## Audio

`OrbitAudio` uses ten compressed reference recordings for gunfire, stomps,
reload/empty fire, damage/death and rock impacts. Gem, reward and jump accents
are original short PCM cues. Hay-boss reveal, exposed-eye hits, warning, phase
rupture and death blasts use adapted recorded effects. Source recordings total
723 KB; the bundled Opus files total 28.5 KB. See
[audio provenance](../public/assets/audio/downwell/PROVENANCE.md).

A bounded 64-event history keeps simultaneous shots, gems and hits audible.
Repeated impacts are coalesced; at most 16 sample voices run at once. Events
come from simulation actions, never render calls. An empty trigger clicks on
press, not on every held frame; standing still does not repeat landing sounds.
Shared pause/mute controls apply. Retry, chapter exit and return-to-classic
stop old voices; missed effects do not replay. Audio preloads during the final
elevator encounter, and failed optional loads never block input.

## Play

Keyboard and standard controllers work. Left/Right, A/D, left stick or D-pad move.
J or Space jumps from a ledge; on a controller use A / Cross, X / Square or RT / R2
for the same jump/fire action. Release and press again in the air to fire.
Hold to keep firing. Recoil brakes
the fall. Landing or stomping a white enemy reloads the eight-shot gun. Red
armored enemies require shooting. P pauses; R restarts. Levels unlocks in the
toolbar after completing the full loop and has no keyboard shortcut.

The seeded route selects five different authored chambers per band from eleven
10×10-cell layouts. They contain connected cave shelves, small floating islands,
short breakable bridges and recessed caches. Layouts and enemies are authored
together, then shuffled and mirrored. The fifteen rooms add three encounters
over the previous twelve-room route. Continue reconstructs the same seed.

| Mechanic | Current tuning |
| --- | --- |
| Horizontal movement | Immediate 240 world px/s |
| Gravity / fall cap | 1,440 world px/s² / 480 world px/s |
| Jump | 552 world px/s upward, shortened on release |
| Shooting | One downward round every 0.12s, eight charges, 1,050 world px/s projectile speed |
| Recoil | Vertical speed resets to −24 world px/s |
| Stomp | Bounce at −408 world px/s, refill ammo, retain combo |
| Camera | Upper-third anchor; follows descent, leaves bounce/recoil motion visible |
| Gem High | 60 gem value triggers three seconds; refresh on gems, stronger/wider shots every 0.08s |
| Combo banking | Land after 8 kills for 100 gems; 15 also adds charge; 25 also restores health |
| Checkpoints | Three 2,120px bands, plus a checkpoint before Slop Eater |

Movement/jump/stomp values convert the GBA recreation’s per-frame constants
to our 2× sprite scale and 50Hz simulation. These are adaptation values, not a claim to reproduce the original proprietary
engine exactly. White enemies can be stomped from above; taking damage loses the
current chain. Bullets hit the nearest terrain/enemy before body collision. Solid
terrain blocks sides and undersides, and gems cannot magnetize through it.

## Slop Eater

The bottom triggers a 4.6-second horizontal cinematic: **REMEMBER THE HAY?**,
a close-up of eyes parting the straw, then **SLOP EATER / THE HAY BITES BACK**.
The boss is the opening cart's hay, grown into a living heap. Its original
140px runtime sprite keeps the three-ink style. Authored overlapping bundles,
broad highlights, dithered shadow faces and broken stalks give it solid volume.
The fuller silhouette has one sagging twine tie, which snaps in phase two.
Angled straw brows surround white eyes with red irises and tiny catchlights.
Three attached fans rustle independently; the mound breathes and swells before
crushing rock, and the pupils track the player. The eyes straddle the existing
50px weak point and stay aligned while the body deforms. Covered eyes cannot
be damaged. Reduced motion holds the poses steady.
The cinematic uses the same cached art. Pause freezes its shutter and reveal.

The supplied **机械终焉** track starts as the shaft collapse hands over to playable
descent and loops continuously through the boss introduction, both phases and the
death sequence. Its full 3:09.6 stereo recording is compressed
from 4.57 MB to 1.97 MB as 80 kbps VBR Opus. Music ducks for the introduction and
final explosions, preserves its place on pause/mute/checkpoint retry, then fades
out into the classic ending. The Mac startup chord replays once when the returning
stuntman lands in the hay; muted landings do not queue a delayed chord.
Source and encoding details are in [audio provenance](../public/assets/audio/PROVENANCE.md).

The entrance automatically equips a **45-round machine gun** with a visible
magazine, vented receiver and longer barrel. Hold J or Space for a round every 60ms
(40ms during Gem High), versus the descent gun's 120ms. Rounds are narrower;
the muzzle stays registered to the handheld barrel. Landing and stomping refill
the magazine, and Continue restores this upgrade. Ordinary descent still starts
with eight shots. The boss has **60 total health**, down from 80, split evenly
between its two phases.

The creature retreats down the shaft as the player falls. Ordinary jump, recoil,
stomp and ammo rules apply. White minions and rock shelves provide reloads. Falling
past a ledge extends the shaft instead of hitting an invisible arena boundary.
Shoot the white eyes peeking through the hay; covered eyes and outer straw produce impact sparks.
After absorbing a volley the straw covers the eyes until the next opening. Progress is
shown through a whole-body white flash on successful damage,
without a health bar. The flash follows the sprite's lit pixels, preserving black
cavities and transparent padding. Machine-gun hits flash for two ticks (40ms),
leaving red frames between rounds; other impacts use three ticks (60ms).
Armor hits never trigger it.

Six seeded, mirrored cave fragments replace the repeated paired ledges: broken
stairs, cracked crossings, floating islands, overhangs, loose balconies and
opposing rock jaws. Chunk spacing varies between 192 and 288 world pixels.
Crates open real paths when shot. Red-cracked shelves give 1.1 seconds after
landing to reload and jump before they break into falling debris. A telegraphed
hay surge tears away marked rock on that side, leaving the opposite route.
The old side claws and their collision boxes have been removed.
Enemy roles rotate between drifting stomp targets, pursuing ghosts, wall divers,
ledge hoppers and second-phase armored threats. Spawns leave reaction space,
avoid solid terrain, and are capped at five live enemies. Minions reaching the
hay are consumed rather than visibly passing through its body. Terrain, debris,
projectiles and room history are pruned as the camera descends.

The upward spread-shot attack is removed in both phases. Its turns are now rest
windows; rock-crushing chomps retain their existing cadence and lock their side
during the warning. At half health the hay tears apart; the second phase
pulses faster and infects rock with red seams. Aim and reloads affect the fight's
duration.

The phase break announces **HAY TORN OPEN / PHASE 2**. Loose straw, ragged
white-and-red tears and bleeding eyes persist for the entire second phase.
Wounds periodically spurt blood and successful hits add small sprays. These
effects are cosmetic; the removed spread attack stays removed.

The boss entrance restores health and ammo and saves score, gems and charge.
Continue returns directly to a fresh boss fight without replaying the reveal.

## Campaign transitions

The defeated Warden burns, tears its hoists loose and accelerates into the lift.
The actual collision floor is removed on impact, with twelve textured lift pieces
and broken armor falling separately. The 3,000-point award occurs once at impact.
`deck-collapse.js` simulates the falling commando and debris; `orbit-entry.js`
keeps the same fall displacement and velocity in well coordinates.

Over 220 ticks (4.4 seconds), `orbit-entry-art.js` pulls the camera back around the
same feet anchor, reduces the ship textures to three inks, and dissolves the shaft
into the narrow well. The red bandana stays visible as the actor becomes the well
sprite. The well terrain already exists and its hazards remain below the entrance;
control begins at y=164 with downward velocity 480, without rebuilding the level,
repositioning the actor or requiring a jump prompt. Keyboard J or Space immediately
fires in the air. The first-band retry returns here directly.

The recorded collapse/explosion effects continue with the falling debris. Arcade
March begins fading halfway through the visual transition. Pause freezes both
worlds and their effects; viewport changes only reframe the scene. The rocket
simulation and renderer are removed. The `shaft-collapse` shortcut starts just
after the Warden's fatal hit.

The death sequence follows the complete 6.2-second reference recording
`/home/gardnmi/Videos/screenrecording-2026-10-01_17-38-54.mp4`, inspected at
eight frames per second plus full-size stills. The new hay body collapses into
a flattened, shredded pile with flying straw. Repeated white ignition discs, red dithered
explosion lobes, blood gushes, chunks and dripping wall splats erupt as the ruined
body sinks. Blood particles are capped at 160, wall stains at 32 and overlapping
explosion bursts at nine. Steering and
machine-gun fire remain available during the chain reaction; hazards are cleared
and the magazine refills for the finishing barrage. After four seconds the shaft
washes white, with the complete sequence lasting 4.8 seconds. The white column
persists into freefall, and the character switches to dark ink to stay readable.

The ending continues from that white shaft high above the classic playfield,
with a downward camera pan. The scenery whites out and the character morphs
into the original stuntman. He falls at eight game pixels per tick, slows to two
pixels with the original sideways wobble while hidden inside a tall cloud,
then speeds up again before landing in the moving hay cart. The descent takes
about four seconds on a typical desktop viewport. The normal
45-tick hay animation leads directly into classic play using that same moving
scene. The landing counts as the first catch of the new loop; chapter state
resets while records and acceleration preferences survive. The handoff preserves
any unconsumed fixed-step time.

## Code references

- [DownwellGBA](https://github.com/MGPAlpha/DownwellGBA/tree/480a5b1f7a82f8b647422f2086e2d74edfca1082):
  inspected `player.cpp`, `levelgen.cpp`, `leveldata.cpp`, `enemy.cpp`, sprite
  indexing and terrain neighbor masks. Source of the attributed reference sheets.
- [Clonewell](https://github.com/samfalberg/Clonewell/tree/7779f9b48d6320ac438305aee230c2e30439f0c5):
  inspected `Player.gd`, `Character.gd`, `Cat_Enemy.gd`, scene and project settings
  for jumping, repeat fire, recoil, stomps and camera relationships.
- [lucasdprx/DownWell](https://github.com/lucasdprx/DownWell/tree/132a4586a81221e1c7d7bb97825c4a25ec40e667):
  inspected input/shooting, camera, procedural generation, combos and flying
  enemies. Its Unity constants differ from the other recreations.
- [Complete reference recording](https://www.youtube.com/watch?v=y72QilmCRus&t=473s):
  downloaded for local study; sampled progression, opening and 7:53–8:53 movement.
  Not a claim to have watched every second in real time.

The repositories are community recreations, not the original engine source.

## Testing

Levels → The descent offers the Warden crash, initial descent, the two later
checkpoints, Slop Eater introduction/fight and the full-circle ending. URLs: `?level=shaft-collapse`,
`?level=downwell`, `?level=downwell-storm`, `?level=downwell-core`,
`?level=slop-eater`, `?level=slop-eater-fight`, `?level=full-circle`.

Unit checks cover input/recoil, the handheld muzzle, ammo, collisions, reload,
combos, seed/spawn safety and complete three-band traversal. The traversal helper
only issues normal horizontal/Space inputs; it does not edit health or position.
Its lookahead extends when standing on a broad shelf so it can plan to its edge.
Browser checks exercise real keyboard input, palette, crash/collapse continuity, Continue,
pause, portrait resizing, full descent and the seamless classic-game handoff.
Feedback checks cover white-tipped projectiles, red silhouettes without opaque
backgrounds, bounded trail history through turns, reduced motion and reward order.
Boss checks cover armor/core collisions, attack warnings, reload routes, both
phases, held input across the shell break, retry snapshots, bounded entities and
a complete normal-input run through the longer descent, boss and ending. Additional
checks cover deterministic varied terrain/enemy roles, timed collapse, side-specific
rock destruction, and a rendered whole-body white flash without rectangular spill.
Machine-gun checks cover cadence, charge, muzzle position, combo capacity and
retry/reset behavior. Death checks cover bounded bursts, continued controls,
pause, reduced motion, appendage removal, and the white freefall handoff.
