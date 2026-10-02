# Original StuntCopter resources

Author: **Duane Blehm / HomeTown Software**, 1986–1987.

Source archive: https://github.com/gamache/blehm
Pinned commit: `32f10d0d8a3d6309aca7be40f9aa29c755f4dd10`.

The graphics are decoded from the AppleDouble resource fork:

`__MACOSX/Duane Blehm's Code/StuntCopter ƒ/._StuntCopter:Rsrc`

| File | Original resource | Native dimensions |
| --- | --- | --- |
| copter-wagon.png | PICT 128: copters, wagons, somersaults | 224 × 143 |
| man-numbers.png | PICT 129: man, thumbs, digits, yoke, collision patches | 120 × 143 |
| dashboard.png | PICT 130 | 387 × 51 |
| cloud-1.png | PICT 356 | 119 × 44 |
| cloud-2.png | PICT 357 | 210 × 45 |
| cloud-3.png | PICT 358 | 140 × 73 |

`../../legacy/desktop/sprites_data.py` contains cloud collision regions decoded
from RGN 356–358; `../../src/cloud-spans.js` exports the same masks for the browser.
`../../legacy/desktop/extract_assets.py` reproduces these files from a local archive checkout,
using a minimal PackBits/PICT and QuickDraw-region decoder. PNG encoding changes
the container only: the one-bit pixels, dimensions and frames are preserved.

The archive's README documents the source's recovery and publication. It does
not include a separate license file. Blehm's games and source are historically
reported as released into the public domain by his parents after his death:

- https://mace.home.blog/files/ (Stunt Copter distribution notes)
- https://en.wikipedia.org/wiki/Stunt_Copter (Legacy and referenced archive)

The historical Pascal file retains its original 1986/1987 copyright header.
Credit and this provenance are retained rather than attributing the artwork to
this POC or representing it as newly drawn MIT-licensed artwork.

## First-level sound

The rotor, landing fanfare and splat are synthesized from Duane Blehm's original
`CreateSound` and `InitialSoundRates` routines in the same pinned archive above.
The implementation and playback adaptations are documented in
[first-level audio](../../docs/classic-audio.md).
Original synthesized electronic cues accompany the six Matrix conversions.
The self-destruct warning and blast rumble are also original synthesis.
The opening Macintosh chord and user-supplied, compressed Cybernetic Pursuit
and Metallic Tension tracks are separately credited in
[audio provenance](audio/PROVENANCE.md).

## Digital theme

The checker fields, particles, and dashboard drawing originated as code-native
effects in the prototype's `theme.py`, guided by the user's September 29, 2026
site recording. They are ported to `../../src/render.js` for the browser game.
The browser game uses its own title with a dark, green digital palette. All six
sprite-sheet PNGs listed above are unchanged copies of the original resources.

The ground attackers' chrome endoskeletons, red eyes, recovery poses, and compact
articulated weapons are new code-drawn pixel graphics in `../../src/crew.js`,
inspired by the user's Terminator reference. They do not modify the original
StuntCopter sprite sheets. The detailed metal palette and finer pixel grid keep
the previous character height while adding a 16-bit visual treatment.

The fallen horse uses the original PICT 129 collision patch at (81, 94),
29 × 22 pixels. The driver's hat/profile is copied from PICT 128 at (38, 26),
4 × 3 pixels. His coat, pulling gait, and fall are new code-drawn animation in
`../../src/driver.js`; the cart retains the original wagon pixels. The engine,
exhaust, and code-rain title are new Canvas drawings in `../../src/render.js`
and `../../src/sky-title.js`.

Cloud lightning paths and their short, bright arc rendering are new code-native
effects in `../../src/lightning.js` and `../../src/render.js`.

The bandana-wearing gunner and cinematic artwork in `gunner-atlas.png` and
`counterattack-cinema.png` were generated with the built-in OpenAI image_gen tool.
The user's Omacontra `dhh-body-canonical.png` and `journey-cinema-canonical.png`
provided the references for shaded arcade sprites and illustrated horizontal
panels. These are newly generated Rambo-style assets, not copies of Omacontra's
characters. Exact prompts, source filenames, and the follow-up edit removing
baked-in cloth tails are recorded in `counterattack-prompts.json`.

Original alpha is preserved in the gunner atlas. `../../src/action-assets.js`
records crop coordinates and anchors; `../../src/action-art.js` animates separate
body, gun and ribbon layers. Both cloth tails move in the cutscene and gameplay.
No external path is required at runtime. The six original StuntCopter PNGs above
remain unchanged. No Ninja Gaiden or Rambo source images/audio/video are bundled.

`liquid-hunter-atlas.png` was generated with the built-in OpenAI image_gen tool.
The user's Omacontra `quattro-enemies.png` supplied detailed arcade metal shading;
`gunner-atlas.png` supplied skin and glove reference for the grenade-hand poses.
This atlas contains a mercury puddle and held/released grenade hand accessories.
Its four quadruped frames have been superseded and are no longer used.
Exact prompt and source path are in `liquid-hunter-prompts.json`. Transparent
alpha is preserved. `../../src/liquid-assets.js` records runtime crops/anchors,
and `../../src/liquid-art.js` animates the melt and silhouette-masked coating.
No Terminator film frames, recordings or audio are bundled. Victory, melting and
reveal cues are synthesized locally in `../../src/boss-audio.js`. This replaces
the earlier spider-carriage artwork and encounter.

`chrome-carriage-atlas.png` replaces the quadruped with four frames of a chrome
horse pulling an armored buggy. It was generated with the built-in OpenAI
image_gen tool. `copter-wagon.png` provided the original horse-and-buggy
silhouette and the user's Omacontra `quattro-enemies.png` provided arcade metal
shading. The two spoked wheels, arched load and drawbars preserve the carriage's
identity; the horse has a red eye, piston joints and hooves. The launcher sits
on the buggy. Exact prompt, reference paths and generated source are recorded in
`chrome-carriage-prompts.json`. The generated PNG's alpha is preserved. Runtime
crops, common ground anchors, muzzle positions and collision bounds are in
`../../src/liquid-assets.js`. The existing liquid effects and grenade poses stay
in their original atlas.

`rooftop-runner-atlas.png` was generated using the built-in OpenAI image_gen
tool. The existing `gunner-atlas.png` supplied the protagonist's identity;
Finji's official Canabalt screenshot supplied the gray palette. A follow-up edit
used the original Contra running poses as a reference and gave every pose a
two-handed machine-gun hold. Exact prompts and reference URLs are recorded in
`rooftop-runner-prompts.json`. The PNG's transparency is preserved. Runtime
cropping and palette resolution produce a small 20-pixel character with eight
run frames and four action poses. The red bandana remains the color accent.
No original Canabalt or Contra sprites or audio are shipped. The gray city,
rooftops, glass, birds, distant craft and the explosion front are new procedural Canvas drawings in
`../../src/runner-art.js`; optional escape audio is synthesized locally.

`rescue-copter.png` is a new original Apache-inspired side-view helicopter,
generated with the built-in OpenAI image_gen tool from the user's supplied
helicopter photograph. The source image is a structural reference; it is not
bundled. `rescue-copter-prompts.json` preserves the exact prompt and source paths.
The generated alpha is preserved. Runtime resolution is 192 world pixels wide;
main and tail rotor blades, the boarding light and rotor wash animate separately
in `../../src/rescue-art.js`.

`rescue-commando-atlas.png` contains four original reach, hang, swing and pull-up
poses generated using `rooftop-runner-atlas.png` as the character reference. The
rifle is slung behind his back while both hands grip the rail. Exact prompt and
source are in `rescue-commando-prompts.json`. The transparent sheet is sampled
to the existing small character scale; shared hand anchors keep the grab aligned
with the aircraft during lift-off. No helicopter photography or film frames
are used as runtime art.

## Carrier assault

The following five assets were generated using the built-in OpenAI image_gen
tool. Exact prompts, source filenames and references are recorded in
`carrier-assault-prompts.json`; original PNG alpha is retained.

- `assault-helicopter.png`: overhead view of the existing `rescue-copter.png`
  aircraft, which supplied the identity reference. Rotors animate separately.
- `assault-enemies.png`: eight original overhead sprites: tank, gun emplacement,
  missile truck, radar truck, gunboat, enemy helicopter, drone and armored train.
- `carrier-top.png`: original overhead naval carrier with defensive mounts,
  a clear forward equipment bay and an aft helicopter pad.
- `carrier-side.png`: broadside rendering of that same vessel, using
  `carrier-top.png` as the structural reference.
- `spaceplane-atlas.png`: original top and side views of a compact orbital craft.
  It remains parked on the friendly forward deck during recovery and the on-foot mission.

`../../src/air-art.js` records atlas slicing and runtime sprite resolution.
`../../src/landing-art.js` projects the deck and animates the cinematic.
The user's local September 30, 16:41:13 Top Gun recording informed the cockpit
approach / exterior touchdown structure; no video frames or original game art
or audio are included. Water, deck lights, UI and cockpit framing are original
code-native drawings. The city background is now the original generated map below. The existing optional synthesizer supplies audio.

## City revision, flying boss and carrier deck

Created with the built-in OpenAI image_gen tool. Source originals remain in
`~/.codex/generated_images/01a0effb-d360-7273-9191-2b9f3e4b026f/`.

| Runtime asset | Prompt record | Description |
| --- | --- | --- |
| `burning-city-map.png` | `burning-city-prompts.json` | Unique ruined-city map, with different districts and rubble; runtime fire/smoke overlays |
| `iron-vulture.png` | `airship-prompt.json` | Original giant enemy flying fortress, transparent background; inspired by the scale and function of the supplied Raiden reference, not copied geometry |
| `carrier-deck-panorama.png` | `carrier-deck-prompt.json` | Original sunset flight deck and weathered carrier island for the run-and-gun |
| `deck-infantry-atlas.png` | `deck-infantry-prompt.json` | Four original olive-uniform infantry poses on transparent background |

The deck originally reused `rooftop-runner-atlas.png` and the generated infantry
atlas. It now uses the third-party Metal Slug sheets documented below; the older
generated assets remain archived. The rooftop runner still uses its original
atlas. The hanging rescue sprite correction changes only source rectangles/hand
anchors in code; the original atlas is intact.

## Arcade sprite revision

The private prototype now imports Metal Slug character, armor, pickup and explosion
sheets, plus Raiden explosion/crater effects, from community reference repositories.
[Exact files, source commits, ownership and runtime use](reference/README.md) are
recorded separately. These are third-party game sprites, not original generated
assets. No reference engine code, ROMs, footage or music were imported. Short
Raiden effects now accompany the overhead assault; see
[their audio provenance](audio/raiden/PROVENANCE.md).
Aircraft, the Iron Vulture, carrier panorama and city artwork remain original.
The deck commando retains the reference animation but is restyled at runtime with
dark hair, a red headband, olive vest and charcoal equipment. Animated bandana
tails reuse the original generated `gunner-atlas.png`. The spacecraft boss reuses
the original `spaceplane-atlas.png`; its mounted gun uses the credited armor
sheet, and its explosion sequences use `metal-slug-big-explosion.png`.


## Overhead rooftop atlas

`overhead-rooftops.png` is an original sixteen-cell rooftop atlas generated with the
built-in image_gen tool on 2026-09-30. The exact prompt is in
`overhead-rooftops-prompt.json`. No reference image or third-party game art was
provided. Transparent footprints are cropped and scaled by the renderer onto a
shared top-down street map. Animated damage effects are drawn in code. This atlas
replaces the oblique `burning-city-map.png` in gameplay; that earlier image remains
archived here.

## Carrier scenery kit

`carrier-scenery-atlas.png` is an original transparent industrial sprite atlas
created with the built-in OpenAI image_gen tool. The existing original
`carrier-deck-panorama.png` supplied the material and palette reference. The exact
prompt, mode and retained source path are in `carrier-scenery-prompt.json`.

`../../src/deck-scenery.js` crops the bulkheads, catwalks, beams, railings, cargo,
fuel drums, lamps and pickups to world-pixel sizes once and caches them. A shared
color quantization and opaque pixel edge treatment bring those assets, the
panorama and the deck aircraft onto the character renderer's pixel grid.
Recessed walls use darker shading; walkable lips retain a bright one-pixel edge.
The atlas replaces the previous flat procedural scenery in the carrier chapter.
Collision geometry and the source character sheets are unchanged.
