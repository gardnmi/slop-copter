# Below Deck — first playable pass

Defeating the elevator Warden now cracks the lift floor and drops the commando
into the lower hull. Eight handcrafted rooms lead left toward the stern and up
to the landed helicopter. The chapter stops at the helicopter, as requested.
The existing rocket, Downwell and ending chapters remain accessible in Levels.

## Controls and movement

Arrows / WASD move and aim the eight-way dash. K or Space jumps; holding it
extends the jump. J dashes. Hold L to grab a wall and Up / Down to climb. Wall
jumps push away. The single dash recharges on landing or touching a green cell.
Climbing drains stamina, shown beside the player; landing restores it. Touch
uses the same three action buttons; gamepad X / A / B map to dash / jump / grab.
Shift+L opens Levels. P pauses and R restarts the whole game.

The controller uses the original published Celeste tuning as a reference:
90 px/s running, 900 px/s² gravity, 105 px/s initial jump, 240 px/s dash for
0.15 seconds, 0.1-second ledge grace, variable jump height, gentler gravity at
the apex, buffered jumps and four-pixel corner correction. Our implementation
runs on the game's fixed 50 Hz clock. Dash onset has a brief pause and transient
afterimages. Moving platforms carry riders and contribute launch momentum.

## Rooms

1. The Bilge: safe jumps over equipment.
2. Severed Walkway: gaps and the first dash refill.
3. Cargo Transfer: a moving lift and optional upper salvage token.
4. Service Chimney: wall climbing and a high exit.
5. Pressure Line: steam vents with amber warnings and safe waiting spots.
6. Broken Gantries: crumbling platforms and an aerial refill.
7. Aft Engine: moving and crumbling platforms combined with a steam vent.
8. Home Stretch: climb to the flight deck and board the helicopter.

Each room is a checkpoint. Death respawns after 0.56 seconds and resets the room's
machinery, refill cells and movement resources. Optional tokens are collected
once. The simulation never changes on resize. The view fits a 320×180 canvas,
with integer scaling where possible and full-room framing on portrait screens.
The revised art uses Celeste terrain edges at their native 8px scale, with
dark original ship machinery and a small bandana-wearing commando. Six run
poses, climbing and dash poses, segmented trailing cloth and landing squash
keep the character animated. Room changes slide horizontally; reduced-motion
mode skips the camera slide. The large permanent HUD is removed.

## References actually inspected

- [Noel Berry's original Player.cs](https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs): movement constants, normal movement, climb, collision correction and dash routines.
- [Celeste & Forgiveness](https://www.mattmakesgames.com/articles/celeste_and_forgiveness/index.html): buffered actions, jump peak and corner correction.
- [Celeste & TowerFall Physics](https://www.mattmakesgames.com/articles/celeste_and_towerfall_physics/index.html): stepped actor movement and moving solids.
- [Mix and Jam](https://github.com/mixandjam/Celeste-Movement): Movement.cs and GhostTrail.cs for presentation and input comparisons.
- [Newleste city design](https://github.com/CelesteClassic/newleste.p8/blob/master/design/design_city.md) and Golden Ridge notes: introducing a mechanic before combining it with others.
- [Official screenshots](https://www.celestegame.com/): foreground contrast, compact sprites, layered scenery and dash silhouettes.

The revised terrain sheets are third-party Celeste artwork; exact provenance
is in `public/assets/celeste/README.md`. Original ship scenery and character
art remain code-native. The published controller's MIT notice is retained at
`public/assets/reference/celeste-controller-LICENSE.txt` and does not license
the terrain artwork.

## Testing

`?level=below-collapse` starts the transition. `?level=below-deck` starts room one;
`below-refill` tests the second airborne dash; `below-cargo`, `below-engine`,
and `below-helicopter` start later checkpoints.
Tests cover the boss handoff, input buffering, jump/dash resources, wall climbing,
moving platforms, steam, crumble timing, retries and deterministic simulation.
A recorded sequence of ordinary inputs clears all eight rooms without changing
position, health or resources. Browser checks exercise actual keys, pause,
level selection, touch, resizing and the complete rendered route.

## Reference revision — crystal chaining and presentation

Examined frame sequences from the user's [Celeste gameplay clip](https://www.youtube.com/watch?v=eFZZZoJZNfs)
at 2:00–3:40, 9:00–10:10 and 12:00–13:10. The last segment shows the crystal,
wall-climb and retry sequence. The meaningful visual references were compact
poses, trailing dash silhouettes, bright irregular terrain edges, quiet dark
infill and layered scenery. Also inspected [CelesteWFC's tiles](https://github.com/aczw/CelesteWFC)
and [Aran Ink's tile breakdown](https://aran.ink/posts/celeste-tilesets), which
was reviewed by the original pixel artist.

Reproduced the reported J-input bug: a crystal restored `dashes` but retained
the first dash's cooldown, so a quick second dash could be blocked or its buffer
could expire. Collection now clears that lockout, preserves a queued input
through the brief pickup freeze, emits a green burst/chime, and shows `+1 DASH`.
A fresh J press can immediately change dash direction while still airborne.
The crystal restores a dash, not a separate K/Space double jump. The headband
remains red; cloth tails go blue when the dash is spent and red on refill.
Both a simulation regression and an actual-key browser regression reproduce
the jump → J → crystal → Up+J sequence. All eight room routes are replayed with
ordinary inputs after the added overhead geometry and timing changes.
