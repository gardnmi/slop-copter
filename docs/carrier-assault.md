# Air assault, Iron Vulture and carrier recovery

The rescue gunship banks into an overhead arcade shooter. The route lasts 62
seconds before the boss, with authored encounters replacing sparse random singles.
The enemy flying fortress is the boss. The seagoing carrier is the friendly destination.

| Section | Duration | Encounters |
| --- | --- | --- |
| Burning city | 18 seconds | Fighter formations, tanks, turrets, armored convoy |
| Freeway | 16 seconds | Crossing gunships, radar-guided missiles, armored train |
| Shipyards | 16 seconds | Boats and shore batteries underneath aircraft waves |
| Carrier approach | 12 seconds | Final boats and fighter sweeps over open water |
| Iron Vulture | Until defeated | Huge flying dreadnought: two wing weapons, then reactor |
| Friendly carrier arrival | 3.8 seconds | Weapons safe, automatic alignment |
| Landing | Player-paced | Catch the moving carrier, manage fuel, land gently |
| Carrier deck | Player-paced | Run-and-gun from aft pad to forward spacecraft |

## Arcade feel

The opening of the [supplied Raiden gameplay](https://www.youtube.com/watch?v=wvq34wWo0Bo)
was downloaded and inspected. The useful patterns are frequent arranged aircraft
formations, simultaneous ground attacks, recognizable hostile projectiles and
weapon upgrades. Original encounter timelines reproduce those principles here.
The [Ninja Dolphin Raiden recreation](https://github.com/t3m1X/Project-I-Ninja-Dolphin)
also informed enemy paths and fire patterns. Its Raiden explosion/crater sheet is
used for effects; aircraft and environment art remain original. Its short Raiden
sound effects now accompany cannon fire, enemy destruction, pickups and player
destruction. [Asset credits and exact sources](../public/assets/reference/README.md).

Arrows/WASD/touch arrows steer with acceleration. The cannon fires automatically
at just over eight volleys per second. P pickups increase twin fire to four and six
streams; W adds up to two wingmen; + repairs armor. Supplies are capped at three,
deduplicated by type and only drop when useful. Each district repairs two hull
points. There is no bomb action, bomb inventory, bomb pickup or flight action
button. Defeat automatically retries the current checkpoint.

Supplies use compact beveled badges: gold **POWER**, blue **WINGMAN**, and green
**REPAIR**, with fixed readable symbols. They bob, catch a moving shine and shed
small sparkles and corner pulses. Smoke draws underneath them and enemy bullets
remain above them. Reduced motion keeps the bright badges static; collection
range and movement are unchanged.

The player helicopter is 32 logical pixels wide, down from 44, with proportionate
weapon origins and escort spacing. Collision follows the cockpit, fuselage, tail
boom and weapon pods, including the visible bank, instead of an eight-pixel center
circle. Rotor sweeps remain decorative. Swept collision considers both the
projectile and helicopter's movement, so fast rounds cannot pass through the body.

Aircraft enter in V formations, diagonal sweeps and timed banking dives, with
followers staggered along the same path. Gunships fire three pairs of wing-gun
shots before peeling away. Tanks fire three staggered rounds at a committed aim;
turrets alternate wide spreads into the gaps left by their previous volley.
Ground weapons visibly track the
player, charge at the muzzle and commit their aim before firing. A short dotted
cue marks that direction; close targets cannot fire without room to dodge.
Missiles turn briefly, then coast and expire. Enemy rounds have pink edges and
white centers; player rounds are thin cyan streaks. Aircraft have bright silhouette
edges and compact rotor sweeps. Destroyed aircraft break into transient debris;
ground vehicles leave scorched, broken pieces instead of intact dark duplicates.

Successful hits briefly swap the enemy sprite to a pale palette. A short dark gap
keeps sustained fire readable; reduced motion softens the flash. Enemy health bars
are removed. Player hull and route information remain in the HUD.

All four districts use one forward world coordinate, one scroll speed and the
same top-down projection. Roads widen continuously into the freeway, then separate
around the harbor as the coastline opens into the sea. No horizontal scene wipe
or background switch occurs at a checkpoint. Moving ground units use the same
lane functions as the scenery; turrets and wreckage stay attached to the terrain.

Original overhead rooftop sprites provide sixteen varied damaged footprints,
with exposed beams, courtyards, skylights, factory roofs and rubble. Animated fire,
embers and smoke attach to damaged parts of those structures. Static terrain is
cached in bounded chunks. Pause freezes the scene, reduced motion holds fire and
smoke poses, and hostile projectiles render above effects. The older oblique city
image is retained as an unused asset; the game loads `overhead-rooftops.png`.

## Boss and objective

The Iron Vulture is an original, broad flying fortress with four engine housings,
armored wings and a turquoise reactor. Two wing weapon groups are vulnerable
first; destroying both exposes the reactor. Attacks mix warned fans and briefly
guided rockets. The automatic cannon defeats the wing weapons, then the exposed
reactor. Destruction clears attacks, then reveals the intact friendly carrier.
The boss has its own Continue checkpoint.

Destroyed wing weapons expose irregular crater artwork, cracks and restrained
smoke clipped to the hull silhouette. Hit flashes stay localized to the struck
component. There are no rectangular damage backings or triangular flame markers.

The carrier has no health, damage targets or hostile weapons. After the overhead
arrival, a 4.2-second letterboxed **BRING HER HOME** scene shows the helicopter
closing on the stern and leveling out. The camera eases into the gameplay view;
the same position and velocity carry into manual control, with a full fuel tank.
Retrying a crash skips this cinematic. **Carrier landing** is a playable
side-view recovery challenge using the
existing sunset, carrier and rescue-helicopter artwork. The carrier moves forward
at a 25% faster base pace, with overlapping surges and slowdowns between
24 and 36 world pixels per second. It changes pace and bobs up and down every few
seconds, within 13 pixels of the nominal deck height. Drift, sink and touchdown
checks use the ship's current horizontal and vertical velocity. Landed wheels
follow the deck, and the same motion repeats on retry. The helicopter keeps
momentum, falls under gravity and has a
limited fuel tank. **Up / W / Space powers lift; Left / Right or A / D tilts.** Release lift
to descend, pulse it to slow the fall, and tilt back to brake relative to the ship.
Touch arrows and the gamepad yoke use the same controls.

The aft pad has lights and green alignment feedback. Fuel, relative drift and
sink speed stay visible. Powered lift lights an **↑ LIFT ON** readout and thrust
segments beside the fuel meter. Animated native rotor cells, a spinning tail
rotor, a short textured turbine flare and shaded vapor give the aircraft its
powered animation. The wash drifts in world space, then fans out into dust near
the deck or spray near the water. Releasing lift shows **COAST** and cuts the hot
exhaust immediately while the rotor wash dissipates. Cosmetic particles are
bounded and use the paused simulation clock. Reduced motion retains steady plumes.
A safe touchdown requires the wheels inside the lit pad,
a nearly level helicopter, lateral drift at most 6 displayed units and sink speed
at most 8. Excess speed, a tipped landing, colliding with the carrier or ditching
causes a local failure. Running out of fuel cuts lift, but a gentle coast onto the
pad still counts. After 1.2 seconds, a crash automatically restores the landing checkpoint with full fuel.
There is no timed auto-completion. Pause and viewport changes preserve physics.

After touchdown the wheels stay attached to the moving ship, the pilot disembarks,
and control passes to the [deck run-and-gun](deck-raid.md) after two seconds. The
forward spacecraft remains visible as the destination.

## Implementation and checks

- `src/air-waves.js`: authored encounter timing.
- `src/air-world.js`: shared terrain coordinates, district boundaries and vehicle lanes.
- `src/city-art.js`: cached top-down districts and attached fires.
- `src/air-assault.js`: fixed 50 Hz flight, weapons, checkpoints and recovery.
- `src/airship.js`: flying boss components and attack timing.
- `src/air-art.js`, `src/city-art.js`: aircraft, terrain, fire/smoke and HUD.
- `src/air-pickup-art.js`: animated supply badges and labels.
- `src/carrier-lineup.js`: carrier alignment cinematic and continuous manual handoff.
- `src/carrier-landing.js`: moving-deck physics, fuel, contact and landing checkpoint.
- `src/landing-art.js`: side-view recovery, carrier wake, pad lights and flight instruments.
- `src/landing-flight-fx.js`, `src/landing-flight-art.js`: rotor, turbine and surface wash animation.
- `src/deck-raid.js`, `src/deck-art.js`: on-foot mission and rendering.

Tests cover bounded entities, attack warnings, power upgrades, swept collisions,
ordinary-weapon boss completion, friendly arrival, landing handoff, checkpoints,
pause/resize, frame-rate independence, and real keyboard/touch controls. The
Levels button unlocks after completing the game and contains entries for the
airship, arrival, landing and deck raid. There is no level-menu shortcut.

## Sound

`src/air-audio.js` decodes nine compact Raiden effects from the credited reference
repository. Cannon sound follows the actual six-tick volley, with distinct small
and large aircraft/ground explosions, a longer boss explosion, pickup tones and
player destruction. Short original contact and missile effects cover nonlethal
hits and enemy volleys. **Metallic Tension** continues through overhead combat,
then crossfades into the supplied **Top Gun (NES) Main Theme** at friendly carrier
arrival. That 1:52 loop continues through lunar landing and touchdown, resumes
its position on a local retry and fades out at the on-foot chapter. Direct
carrier/landing shortcuts use the same music. Pause and mute stop its clock.

A single original rotor loop supplies soft blade wash and engine body beneath
the music. Maximum gain is 0.055 (under -40 dBFS RMS for the generated waveform),
with a small speed/volume lift during movement or landing thrust. It stops on
death and when the deck chapter takes over. It does not multiply with wingmen.

Recovery also adds a quiet turbine layer that swells and rises in pitch with
Up / W / Space, easing back when released. A restrained double caution sounds
below 20% fuel every 3.2 seconds, accelerating to 1.6 seconds below 8%; it stops
on touchdown or empty fuel. Fuel exhaustion gives an engine sputter, safe
touchdown has a damped wheel/deck contact, and ditching has a water splash in
place of the aircraft explosion. These original sounds are synthesized in
`src/landing-sounds.js`; no additional audio downloads are required.

Combat records a bounded 48-event history so a shot, kill and pickup in the same
frame do not erase one another. Playback coalesces simultaneous effects, limits
voices to 14, drops old events, and observes mute/pause/retry. Failed asset loads
use quiet procedural fallbacks; gameplay never waits for audio. Browser tests
exercise sample decoding, real hits/pickups/death, one quiet rotor, Space thrust,
mute and pause, missing optional files, and chapter cleanup.
