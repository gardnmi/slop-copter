# Elevator boss reference study — October 1, 2026

Reference: [All Bosses in Metal Slug History](https://www.youtube.com/watch?v=rklAx3YoI80).

## Review coverage

Reviewed a ten-second visual sampling across the entire 87:06 compilation
(523 sampled frames across all sixteen game chapters), then denser motion
sequences for Aeshi Nero, Dr. Amadeus and Cabrakan. This was a sampled visual
review, not continuous real-time viewing or a frame-by-frame timing measurement
of every fight. Timing below is our game's tuning, not measured SNK timing.

The following compact notes record the visual themes observed in each chapter.

| Chapter | Visual/combat observations |
| --- | --- |
| 0:00 — SV-001 | Riveted machinery; distinct turrets; aircraft recoil. |
| 3:58 — Metal Slug 2 | Overhead guns, vertical arenas, large weak regions. |
| 9:31 — X | Layered tank armor and contrasting damage flashes. |
| 10:00 — 3 | Exaggerated silhouettes; organic and mechanical stages. |
| 15:50 — 4 | Visible operators; machinery opens before attacking. |
| 21:57 — 5 | Attached cannons, drills, articulated shells. |
| 28:27 — 6 | Segmented mechanisms; strongly colored projectiles. |
| 34:40 — 7/XX | Detached parts; changing silhouettes between phases. |
| 40:26 — Advance | Industrial platforms; overhead target and vertical shots. |
| 44:46 — Triumph | Big silhouettes, compact glowing projectiles. |
| 48:09 — Fierce Battle | High-contrast weapons and beam directions. |
| 50:23 — 1st Mission | Elevator framing; readable small machinery. |
| 54:41 — 2nd Mission | Generator targets, layered platforms, exposed reactors. |
| 1:00:48 — Awakening | Large windups and expansive attack effects. |
| 1:10:27 — 3D | Arena scale and visible attack origins. |
| 1:16:57 — Attack | Mechanical articulation and dense effects. |

Closer sequences: Aeshi Nero around 4:45–5:10 uses vertical staging (the machine
is below the player). Dr. Amadeus around 20:00–21:48 preserves the operator
across changing machinery. Cabrakan around 43:30–44:24 provides the closest
composition: a large overhead industrial boss, platforms and upward fire.

## What this prototype takes from the study

The replacement is an original suspended command rig, rather than the old
humanoid robot. Its wide hull, readable operator and underslung reactor make
its role clear before firing begins. Cropped sprite components share the
same native pixel density as the player and carrier scenery.

The Warden appears inside the flight-stage cockpit, ejects during the ship's
destruction, and returns in the suspended rig. The player's aircraft elevator
is the continuous visual link: the old deck rises out of view while shaft
panels scroll upward, and the player keeps control throughout.

Our three attacks each teach a different response: move away from an aimed
line, vacate a marked impact area, and thread a fan of separated shots. Windup,
attack and recovery are separate states. The pilot stays horizontally centered,
so difficulty comes from positioning and timing while shooting up. Bullet
origins use the same pod pivots and angles as their artwork. The hydraulic
press shares its extension curve with the simulated strike.

The machine gun is unlimited. Flame shot is shorter-ranged and pierces, with
70 bursts per pickup. Both can hit the overhead belly from the lift; neither
requires an unavailable aim angle. Hands and weapon are a single native sprite
pose, avoiding the previous floating weapon attachment.

## Verification

Unit and browser tests cover continuous lift travel, riders on both gantries,
stepping off both outer catwalk edges, both guns reaching the overhead weak
region, aim commitment, warnings, pause, phone resize, a separate Continue
checkpoint, full normal-input playthroughs and the final wreckage. Every frame
of the destruction/descent/reveal/final defeat is rendered in the browser
regression test, so a simulation-only success cannot hide a rendering freeze.

The browser screenshots are review artifacts under `test-results/`. Source
sampling frames are local research artifacts under `/tmp/slop-elevator-review/`;
they are not shipped with the game.
