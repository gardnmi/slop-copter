# Carrier deck run-and-gun

After the helicopter lands at the aft pad, the commando fights along the carrier
toward the spacecraft at the bow. Its defenses turn out to be the final boss: a flight phase followed by an aircraft-elevator descent and an overhead command rig. Winning destroys the escape ship. The carrier itself remains friendly; hostile
boarders, grenadiers and portable gun emplacements occupy the route.

## Reference code inspected

- [zzarcon/html5-slug, game/init_game.js](https://github.com/zzarcon/html5-slug/blob/master/game/init_game.js):
  immediate horizontal run/stop at 150 units/s, a short gravity-driven jump,
  camera following, directional fire and a 100 ms shot interval. The repository
  declares an MIT license. Used as a behavioral reference, not copied code.
- [alejru08/Metal-Slug, src/Rossi.js](https://github.com/alejru08/Metal-Slug/blob/master/src/Rossi.js):
  separate movement and shooting animation states, upward fire, a -350 jump
  impulse and a heavy machine gun upgrade.
- [alejru08/Metal-Slug, src/Enemies.js](https://github.com/alejru08/Metal-Slug/blob/master/src/Enemies.js):
  patrol/ranged/melee states, range-gated attacks, attack animation windups,
  short multi-shot bursts and reload pauses.
- [alejru08/Metal-Slug, src/Objects.js](https://github.com/alejru08/Metal-Slug/blob/master/src/Objects.js):
  collectible weapon upgrades and scoring objects.

- [alejru08/Metal-Slug, data/mapaMetalSlug.tmx](https://github.com/alejru08/Metal-Slug/blob/master/data/mapaMetalSlug.tmx):
  inspected the 80×30 collision map, stepping platforms, upper enemy placement,
  and the long rising exit. Its separate [boss map](https://github.com/alejru08/Metal-Slug/blob/master/data/boss_map.tmx)
  uses a locked arena rather than continuing the ordinary scrolling route.
- The supplied [Metal Slug speedrun](https://www.youtube.com/watch?v=P_G9rVxMUeY),
  particularly 0:35–1:10 and 15:51–16:55: scaffold combat gives way to a raised
  rock shelf; the later aircraft boss changes height, repositions, and attacks
  diagonally while the player uses upward fire. The carrier adapts those
  changes of elevation and attack direction to an original ship layout.

These are community recreations, not SNK's original engine. The new simulation is
original JavaScript and adapts the observed behavior to Slop Copter's controls.
The private prototype now uses Marco, Rebel, armor and effect sprite sheets from
the Metal Slug reference repository. [Asset credits and exact sources](../public/assets/reference/README.md)
record each import. No reference engine code is bundled. The sound effects now
use recorded game samples; see the sound section below.

## Controls and feel

Left/right (or A/D, touch arrows, gamepad stick/D-pad) move at 150 world pixels/s
with immediate response. K or the yellow Jump button launches a short -340 impulse under 800 gravity;
release early for a low hop. Small jump buffering and coyote time make cargo
edges forgiving. There is no helicopter inertia on foot.

Hold J or the red Shoot button to fire in the facing direction, including while
running or jumping. Up aims vertically. Down crouches and stops movement; chest-height rifle
shots pass above the smaller hitbox. Very close infantry trigger an automatic
melee strike. A fresh run starts with an unlimited pistol, firing once every
nine ticks. The early H pickup supplies 200 machine-gun rounds, fired every four
ticks with a shallow alternating spread. The midpoint F pickup supplies 30
piercing flame bursts, fired every twelve ticks. Each flame cloud damages a
target once; lethal flame hits engulf infantry before a burning collapse.
Empty ammunition returns to the pistol. These are the only three weapons.

Weapon placement is authored, with no random weapon drops:

| Supply | Position | Purpose |
| --- | --- | --- |
| H / 200 rounds | x=270, aft deck | First upgrade after the pistol opening |
| F / 30 bursts | x=1940, cargo exit | Midpoint close-range infantry encounters |
| H / 600 rounds | x=3145, hangar exit landing | Both final boss phases |

The last H sits after the long landing jump, where running players can collect
it. The two medkits remain; no extra weapon pickups appear in the elevator.
Pistol and heavy weapons have separate native hand-and-gun poses. Hands, grip,
recoil and bullet origins remain registered to the torso and belt. Animated
machine-gun tracers and flame balls use the original Weapon SFX sheet. Projectile
tails are clipped at the barrel until they have traveled clear of the gun.
Medkits restore two health. Weapon type and remaining ammo are checkpointed.

L or the green Bomb button throws a grenade. The player begins with ten; grenades
bounce, detonate on enemy contact or after their fuse, and damage enemies and
destructible cargo within a 76-pixel radius. Holding L does not throw repeatedly.

On a standard gamepad, X/Square shoots, A/Cross jumps, B/Circle throws and Start
pauses. Touch supports movement, shooting and jumping together. Space remains a
jump/Continue alias. L and Shift+L throw grenades; neither opens a menu.
Down+K (Down + yellow on touch) drops through a thin catwalk. Solid deck
floors do not allow dropping through. All current armor is hostile; there is no
player vehicle to exit.

## Mission

The 4020-pixel route has three authored sections, followed by the bow encounter:

- **Aft deck:** a raised service deck, destructible supplies, and an open crossing
  establish jump timing before combat becomes dense.
- **Cargo bay:** descend 64 pixels into the hold, or cross the elevated gantries
  for a weapon pickup and an advantage over infantry below. Grenadiers occupy
  the upper route; armor guards the exit back to deck level.
- **Hangar catwalks:** climb through 250, 206 and 160-pixel elevations, fight on
  the gantries, cross the open elevator shaft, then descend toward the bow.
  The lower hangar floor provides a recovery route back to the first gantry.

Full jumps rise about 69 pixels and travel about 125 pixels on level ground.
Ascending platform gaps are 30–32 pixels, with rises of 44–46 pixels and enough
landing area to fire before the next jump. Wider crossings descend to lower
landings. The camera follows floor elevation smoothly, rather than bobbing with
every jump. Miss an open shaft and Continue restores the section checkpoint.

Catwalks catch descending feet and allow jumping through from below. Solid deck
faces block movement and gunfire; grenades bounce on the actual surfaces.
Mortar warnings predict intervening catwalks, so their marked impacts match the
collision geometry. Infantry patrols stop at platform edges. Low crates are
destructible; cargo provides cover, and barrels explode in chains.

The original illustrated carrier panorama scrolls more slowly than the foreground
walkway. The landed helicopter remains behind, and the dormant spacecraft waits at the far end. Our Rambo-style commando stays approximately 42 pixels
tall. Native reference animation is restyled with dark long hair, a red headband,
olive vest and charcoal equipment. The two flowing cloth ends reuse the original
`gunner-atlas.png`, follow the head in each pose and mirror with the body. Separate
legs and torso preserve running while shooting; jumping, crouched shooting,
upward aim and knife poses retain the same identity. Rebels have running, attack and death animations.
Enemy armor uses a native chassis and cannon sprite. Successful hits briefly
swap the sprite palette to deep red shadows and gold highlights, with a normal-color gap between pulses; enemies
do not display health bars.

The foreground uses `carrier-scenery-atlas.png`: worn steel deck edges, lattice
catwalks, braced columns, safety rails, recessed machinery, wooden supplies and
fuel drums. `deck-scenery.js` prepares sprites at world-pixel sizes with shared
color steps and crisp alpha, then repeats panels without stretching them across
platforms. Background walls are darker than the walkable edges and actors.
The panorama and aircraft use the same pixel preparation; tall phone views get
a cached panorama size that covers the extra sky. Asset provenance and the exact
generation prompt are recorded under `public/assets/`.

Each section saves a checkpoint. Defeat automatically retries it after 1.2 seconds, restoring
health, grenade stock and checkpoint score without replaying the airship or landing.

## Parachuting reinforcements

Four finite ambushes bring two or three bazooka troops down over the aft deck,
cargo route, hangar gantries and bow approach. Their staggered heights and swaying
canopies follow the supplied October 1, 07:25:46 recording. Native character and
cloth animation comes from the credited bazooka sheet. The men remain the same
small scale as the other infantry.

Upward fire can kill them in flight: the canopy detaches and crumples while the
body falls. Survivors land on the first real deck, cargo top or catwalk below
them, release the canopy, settle briefly, and continue fighting with their
bazookas. Airborne shots have a 28-tick warning, commit their aim, travel slowly,
and only fire while the soldier is on screen and well above the player. Each
soldier fires at most two airborne rounds. Waves do not repeat when backtracking;
Continue restores the section's original ambush, and the boss arena stops drops.

## Animation and effects reference

The supplied [Metal Slug (1996) “ALL SECRETS” speedrun](https://www.youtube.com/watch?v=P_G9rVxMUeY)
was sampled across the run, with closer frame sequences around 0:11, 1:30 and 16:14.
The effects use a brief bright ignition, rounded orange fire, then darker smoke;
small directional impact sparks and spent brass remain separate from explosions.
The original medium and large explosion sheets provide those frames. Large
explosions add short camera recoil and small falling fragments, rather than
expanding square particles. Reduced motion skips the whitest opening frames and
holds decorative cloth/engine poses.

Upward aim has a separate unlit pose; muzzle flashes appear only on actual shots.
The settled crouch pose shares its head and foot placement with the shooting
frames, avoiding a sideways snap. Running animation stops when solid cargo or a deck wall blocks movement.
Every upper-body firing crop is registered at the pelvis; the source's wide
muzzle-flash cells have different transparent margins. The torso follows the hip
socket of each run and tucked-jump frame. Weapon origins share that same pose,
so projectiles and spent brass follow the gun as the body rises. The long hair,
red bandana and two cloth ends remain attached to the upper-body pose.
Resting torso crops also have individual belt anchors: the source cells lift the
body by different amounts, so a common crop origin left the waist visually open.
The belt now overlaps the trousers throughout the resting cycle. Headband
recoloring selects the forehead strip, preserving the face and nose highlights
that share its original white palette color.

## Spacecraft boss

Reaching the ship powers up its autonomous defenses. The same spaceplane lifts
off into a two-tier bow arena, leaving room to run beneath it and attack from
both sides. The camera gives the aircraft headroom and keeps both platform
stacks visible; narrow screens pull back while the HUD keeps its normal size.

- **Mortars:** three surface impacts are marked before launch. Each warning uses
  the shell's stored trajectory, including any upper gantry that intercepts it.
- **Overhead crossing:** the craft traverses the arena and changes facing. Three
  briefly indicated aiming lines commit before downward bursts; move underneath
  and use Up + J to shoot the hull.
- **Deck sweep:** warning lights on the two deck emitters precede opposing low
  plasma pulses. Jump or get onto the catwalks to keep firing safely.
- **Cannon lock:** a visible aiming line commits to the player's position before
  a diagonal burst. Leave that line or change platforms.

Recovery pauses bring the ship into the clear central lane and lower it for
horizontal fire and grenades from the platforms. Warnings and
recoveries shorten below half strength. Damage flashes the hull and produces
sparks; damaged plating appears later in the fight. There is no health bar.
Holding horizontal fire on the ground cannot hit the lifted hull: upward aim,
position changes, and the catwalks are useful throughout the encounter.

The flight phase has 240 health. Entry restores health and at least eight
grenades while preserving the held weapon and remaining ammunition. Its visible pilot is the Warden,
whose cockpit portrait also appears in the second boss. At zero health the hull
bursts apart and his control capsule ejects. The arena gantries lower onto the
aircraft elevator; the floor then accelerates downward into the carrier shaft.
The 320-tick descent keeps movement enabled. The player, moving surfaces and
camera share the lift's displacement, including if the player was on a catwalk
or airborne when the ship was destroyed. There is no teleport or scene cut.

Both outer edges of the flight arena's top catwalks can be walked off. The arena
bounds sit beyond the ledges, allowing a fall to the lower deck to evade attacks.
Down + K still drops through a catwalk.

## Elevator phase and ending

The Warden's suspended command rig has 360 health and a **separate Continue
checkpoint**. The room is centered on the lift at every aspect ratio. The boss
stays centered overhead; aim Up + J at its exposed underside. Both machine gun
and flame shot reach it from the floor. The pistol is also a viable unlimited fallback; there are no extra weapon pickups.
Open `?level=elevator` or **Elevator / The Warden** in level select. Old
`?level=mecha` bookmarks redirect to this replacement phase. Flight remains
available at `?level=spaceship`.

- Crossfire: two articulated gun pods lock their aim during a visible warning,
  then fire three committed bursts. Move away from the lines.
- Hydraulic press: a fixed stripe marks the impact lane before the drill
  extends and strikes for two health. Move aside or time a high jump.
- Core vent: belly shutters open before two spaced fans of projectiles. There
  are gaps between the rounds, followed by a recovery window.

Warnings shorten from 56 to 44 ticks below half health. The lift keeps descending
slowly during combat; wall panels, lamps and numbered floors move behind it.
Cable drums, individual gun recoil, sliding belly plates, suspension heave and
the press animate separately. Hit flashes preserve the armor detail, with no
boss health bar. Staged explosions sever the hoists, and the Warden crashes into
the lift. Its floor breaks into twelve falling sections; the commando falls with
the wreckage as the shaft gradually becomes [Cloudfall](cloudfall.md). The
3,000-point award is issued once on impact. Neither the ship nor a living pilot
remains. Test the crash directly with `?level=shaft-collapse`.

The original generated artwork and exact prompt are
`public/assets/elevator-warden-atlas.png` and `elevator-warden-prompt.json`.
`deck-elevator-art.js` registers silhouettes and reduces parts once to the
native world-pixel grid. The generated backdrop is excluded by silhouette
masks. Existing credited Metal Slug effects supply explosions. The superseded
humanoid mecha simulation and renderer have been removed.

[Compilation study and design decisions](elevator-boss-study.md).

## Boss animation and hit response

The October 1, 07:18:20 recording informed the short red/gold palette flash,
alternating normal-color interval, separate engine cycles, and layered damage
effects. `spacecraft-art.js` now uses the original `spacecraft-boss-v2-atlas.png`
and matching mechanical modules: worn ivory armor, dark panel lines, bronze
turbine rings and the Warden visible in the cockpit. `spacecraft-rig-art.js`
registers silhouettes before reducing them to the scenery's native pixel grid;
the atlas backdrop never appears in gameplay. The exact built-in imagegen prompt
is saved alongside the unchanged atlas in `spacecraft-boss-v2-prompt.json`.

Landing gear retracts behind the intact hull, armor panels slide open, a
three-tube mortar rack rises, and the belly cannon aims with telescoping barrel
recoil. Hover nozzles pivot against acceleration while the hull banks. Independently
phased, small warm exhaust plumes use the credited flame-shot frames; rear jets
lengthen during a crossing. Firing and heavy impacts excite a damped recoil
spring. The cannon's visible mount and simulated muzzle share a pose helper.

Hit flashes preserve the dark panel lines instead of flattening the boss into a
white silhouette. Armor impacts use a short ignition, fire, sparks and smoke.
Below half strength, scorched vents flicker and emit rising smoke; shutdown adds
staggered explosions as the pilot ejects and the aircraft lift releases. The
reduced-motion setting softens the hit palette and suppresses banking, hit jitter,
rapid exhaust changes and the brightest ignition frames. Attack warnings and
the four flight attack patterns retain their original timing.

## Testing

After completing the game, open Levels → Carrier deck run-and-gun. Direct
`?level=deck-raid` links remain available for testing. Levels has no shortcut.
The menu includes **Cargo bay / upper route** (`?level=deck-cargo`) and
**Hangar catwalk climb** (`?level=deck-catwalks`) for testing the new geometry.
Choose **Spacecraft boss** (`?level=spaceship`) to test the encounter directly.
Unit tests cover movement, variable jumps, cargo landing, warning/fire cycles,
crouch hitboxes, grenade arcs, pickups, chain explosions, retries and completion
using normal inputs at desktop and portrait sizes. The complete traversal uses
eleven jumps and exercises both lower and upper floors before the flight and overhead Warden attack patterns. Browser tests exercise keyboard/touch/gamepad input, a jump between
hangar tiers, dropping through a catwalk, pause, resize, continuous elevator descent, phase-two retry and the wreckage ending. Sprite
checks cover the full run/recoil cycle, both facings, tucked jumps and raised aim;
manual contact-sheet review checks the torso registration at enlarged scale.


## October 1 recording: HUD, weapons and R-Shobu

The 33-second `screenrecording-2026-10-01_10-11-55.mp4` was reviewed across its
full duration using frame contact sheets, with close inspections of the weapon
poses, HUD and burning deaths. Useful beats: pistol at 5–8s, HMG at 11–16s,
flame shot at 23–26s, burning infantry at 25–27s, and R-Shobu at 28–31s.

The transparent HUD now groups score, a blue checkerboard health meter and
1UP health count at the upper left, ARMS/BOMB beside it, and large gold time
numerals. It uses original arcade glyphs. TIME shows elapsed mission seconds;
it does not introduce a new time-limit failure. HI-SCORE uses the real record,
and the lower right reads CONTINUE ∞ instead of pretending the prototype has
coin credits or a second player. Neither the helicopter nor the final bosses
has a health bar.

R-Shobu enters after x=1050 on the aft-deck landing after the first broken-deck
crossing, before the cargo bay and flamethrower. The first H pickup supplies this
encounter; the nearby turret has been removed to leave room for bomb dodges.
The gunship holds over this landing and follows players who run ahead, without
adding an invisible arena wall. Later level-select shortcuts skip this encounter.
The original
three-quarter gunship sheet supplies seven body/tail frames, four main-rotor
frames and falling bombs. It hovers, commits to a lane, releases three bombs,
then traverses across the player. Bombs fall vertically and detonate on the
first deck surface. Moving sideways after the column starts is a reliable dodge.
There are 100 health points, short warm hit flashes, engine damage smoke and a
two-second chain explosion. The final spacecraft waits for this destruction to
finish. A flashing GO cue releases the route forward.

The encounter saves its own Continue checkpoint with the current ammunition;
`?level=deck-helicopter` / **R-Shobu helicopter miniboss** opens it directly with
140 machine-gun rounds, approximating the supply remaining from the first H
pickup. The regular flight and elevator shortcuts similarly
start with finite machine-gun stocks. Pause, portrait layout and reduced motion
are supported. The source sheets remain unchanged; see the asset credits.

## Recorded Metal Slug sound effects

`src/deck-audio.js` replaces the synthesized deck beeps with 21 compact sampled
effects and voices. The primary sprite-reference repository supplies the pistol,
explosion, infantry/player death and HMG pickup recordings. Two supplemental
Metal Slug codebases supply the short HMG round, Flame Shot announcement, hits,
knife, grenade and heavy explosion samples. A recorded flame firing effect comes
from the documented Defense soundbank because the recreations omit that effect.
[Exact sources, pinned revisions and processing](../public/assets/audio/metal-slug/PROVENANCE.md)
are recorded with per-file hashes. The runtime audio totals 162,292 bytes.

Pistol and HMG sounds fire when a real projectile is created, including the last
powered round before returning to the pistol. The HMG uses an 80 ms sample at
the actual four-tick firing rate, so releasing J stops new shots immediately.
H/F pickups announce their weapon once; health uses the recorded OK voice.
Infantry scream instead of exploding, while tanks, barrels, grenades and the
boss destruction sequences use their respective blast sounds. Armor contacts
have the original short hit sound; the player has separate hurt/death samples.
The final pilot's death voice occurs once, independently of the timed chain
explosions. Game mechanics are unchanged.

A bounded 64-event history preserves simultaneous gunshots, hits, deaths and
pickups, unlike the old single cue slot. Playback coalesces same-frame duplicates,
limits voices to 16, positions combat sounds across the stereo field and keeps
voice announcements centered. A soft compressor controls overlapping blasts.
Pause suspends playback; mute discards missed events; retry and chapter exit
release old voices. Missing optional audio never blocks shooting or movement.
Samples preload during carrier arrival/recovery. Browser checks cover real J/L
inputs, H/F pickups, empty-ammo fallback, Warden hits/death, mute, pause, retry,
chapter cleanup, missing samples and the prior landing music.

## Arcade March music

The supplied **Arcade March** starts when boarding begins, crossfading from the
carrier recovery theme. Its full 2:38 stereo recording loops throughout the deck,
R-Shobu encounter, spacecraft fight, elevator descent and Warden fight. It streams
through `MusicTrack` and preloads silently during carrier arrival and landing.
The 80 kbps VBR Opus file is 1,568,894 bytes, 58.8% smaller than the source MP3;
the original is untouched. [Encoding and hashes](../public/assets/audio/PROVENANCE.md#arcade-march).

Music sits below gunfire and ducks further during pickup announcements and boss
voices. Pause, mute and death hold its position; checkpoint retry resumes without
restarting the song. New Game, level select and a new game loop reset it. It fades
out halfway through the lift-collapse transition into Downwell. Browser checks cover real decoding and
looping, carrier handoff, the complete deck route and both boss phases, pause,
mute, retry, voice ducking, chapter exit and blocked/missing optional playback.
