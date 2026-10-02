# Arcade reference assets

This private prototype uses the following third-party sprite sheets alongside its
original aircraft, carrier and environment art. Metal Slug artwork belongs to
SNK/Nazca; Raiden artwork belongs to Seibu Kaihatsu. The community repositories
below supplied the sheets and behavioral references; these assets are not
original Slop Copter art or represented as freely licensed.

## Metal Slug

Recorded combat effects and pickup voices from these reference codebases are
also used on deck. See [sound sources and processing](../audio/metal-slug/PROVENANCE.md).

Source: [alejru08/Metal-Slug](https://github.com/alejru08/Metal-Slug/tree/b2fb33d0033b8cc740491674c94621a79bdce425),
commit `b2fb33d0033b8cc740491674c94621a79bdce425`. Upstream credits sprite rips
from The Spriters Resource.

| Local file | Upstream file | Use |
| --- | --- | --- |
| `metal-slug-rossi.png` | `images/ROSSI.png` | Separate Marco torso and running legs, jump and shooting poses |
| `metal-slug-marco.png` | `images/Recursos originales/marco_rossi.png` | Crouched machine gun, knife and death poses |
| `metal-slug-rebel.png` | `images/rifle_soldier.png` | Rebel running, aiming, shooting, throwing and death |
| `metal-slug-armor.png` | `images/Recursos originales/Neo Geo NGCD - Metal Slug - Type 04 Girida-O.png` | Enemy armored emplacement |
| `metal-slug-explosion.png` | `images/medium_explosion.png` | Deck explosion animation |
| `metal-slug-big-explosion.png` | `images/big_explosion.png` | Grenade and spacecraft defense explosions |
| `metal-slug-heavy.png` | `images/H.png` | Heavy machine gun pickup |
| `metal-slug-paratrooper.png` | `images/Recursos originales/Neo Geo NGCD - Metal Slug - Rebel Soldier Bazooka.png` | Bazooka paratrooper poses, animated parachute and canopy collapse; sheet credits Gussprint's touch-up work |

Source PNGs are preserved unchanged. `src/metal-slug-art.js` crops animation frames
at native pixel size and removes the armor sheet's cyan background at load time.
The player frames are palette-swapped and given longer hair in
`src/deck-commando.js` to retain our Rambo-style character. His two animated red
cloth ends come from the project's original `gunner-atlas.png`. Upward idle aim
crops out the firing effect; kneeling uses the settled animation pose.
The carrier landing also reuses R-Shobu rotor cells and shaded CLOUD vapor and
flame cells from the weapon-effects sheet for powered rotors, exhaust and wash.
The upstream frame maps and `src/Rossi.js`, `src/Enemies.js` and `src/Objects.js`
informed animation selection and behavior. Our deck simulation remains original
JavaScript, with controls adapted to this game's keyboard, touch and gamepad input.

## Raiden

Source: [t3m1X/Project-I-Ninja-Dolphin](https://github.com/t3m1X/Project-I-Ninja-Dolphin/tree/49451ea884c35f002a9861ce893fc8c87391b608),
commit `49451ea884c35f002a9861ce893fc8c87391b608` on `develop`.

`raiden-effects.png` is the unchanged
`Game/spritesheets/ui/spritesheet_explosionsshotsandpropellers.png` sheet.
`src/arcade-effects.js` uses nine explosion frames and one damaged-metal crater.
Boss crater overlays are clipped to the original boss sprite's alpha mask.

The recreation's `Enemy_LightAirship.cpp`, `Enemy_MoonAirship.cpp`,
`Enemy_LightTank.cpp`, `Enemy_Turret.cpp`, `Enemy_RotatoryTank.cpp` and
`ModuleParticles.cpp` informed formation paths, paired aircraft guns, aimed
ground salvos, alternating spread patterns and damage effects. These behaviors
were implemented in the existing JavaScript simulation. Aircraft, city art and
the Iron Vulture boss remain original Slop Copter assets.

These repositories are community recreations, not the original arcade engines.
No reference engine code, ROMs or music were imported. Short Raiden effects from
the same pinned repository now supply the overhead cannon, explosions and
pickups; [audio sources and processing](../audio/raiden/PROVENANCE.md) are recorded
separately.

The October 1 parachute revision uses the unchanged bazooka sheet from that same
Metal Slug repository and commit. `src/paratrooper-art.js` removes its white and
green background keys separately while cropping, preserving the original canopy
animation, hanging poses, landing equipment and cloth-collapse frames.
`src/spacecraft-art.js` uses the original built-in-generated hull and separate
mechanical modules in `../spacecraft-boss-v2-atlas.png`; the exact prompt and
design references are in `../spacecraft-boss-v2-prompt.json`. The original atlas
is unchanged. `src/spacecraft-rig-art.js` excludes its presentation backdrop with
silhouette masks and reduces the parts to the carrier's native pixel grid.
Small, warm thruster plumes animate the credited flame-shot frames below;
smoke and impact ignition use the existing explosion sheets.
No frames from the user's gameplay recordings are bundled as assets.

The recording-based weapon revision adds these unchanged sheets from the same
pinned repository:

| Local file | Upstream file | Use / sheet credits |
| --- | --- | --- |
| `metal-slug-r-shobu.png` | `images/Recursos originales/Neo Geo NGCD - Metal Slug - R-Shobu.png` | Original R-Shobu, rotors and bombs; rip by The Mad Soldier |
| `metal-slug-weapon-sfx.png` | `images/Recursos originales/Neo Geo NGCD - Metal Slug - Weapon SFX.png` | Animated HMG rounds and flame shot; Gussprint |
| `metal-slug-rebel-original.png` | `images/Recursos originales/Neo Geo NGCD - Metal Slug - Rebel Soldier.png` | Engulfed and collapsing soldier death frames; source sheet credits retained |
| `metal-slug-hud.png` | `images/Recursos originales/Neo Geo NGCD - Metal Slug - HUD & Interface.png` | Arcade glyphs and large time digits; Gussprint / The Spriters Resource |

`src/deck-reference-art.js` removes the sheets' exact green/cyan keys at runtime.
`src/deck-hud.js` removes exterior white around glyphs and recolors them silver
or gold. The existing Marco sheets also provide the pistol poses, with the
project's Rambo palette and headband applied to the head only. All reference
sprite copyright remains with SNK/Nazca; no ownership or open licensing is claimed.

The Warden, his cockpit portrait and modular overhead boss are original
built-in-generated artwork. The source atlas and exact prompt are recorded in
`../elevator-warden-atlas.png` and `../elevator-warden-prompt.json`. Runtime
silhouette masks exclude the generated backdrop before native-pixel reduction.
The superseded humanoid art is retained under `legacy/artwork/`, outside the
served public assets.


The orbital escape uses original `../escape-rocket.png` artwork made with the
built-in imagegen tool; its exact prompt and style reference are recorded in
`../escape-rocket-prompt.json`. Cloudfall reuses the already-credited commando,
headband, flame and explosion frames. Its drones, gunboots and Earth are original
code-rendered graphics. Downwell and the community controller repositories were
study references only; no assets or code from them are included. See
`docs/cloudfall.md` for links, pinned commits and the implementation differences.
