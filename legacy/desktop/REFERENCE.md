# Reference study and fidelity decisions

Gameplay reference: https://www.youtube.com/watch?v=aPAKfqRYWoI

The 104-second video shows **StuntCopter 1.2 (Clouds)**. The available source
archive is **StuntCopter 1.5**, whose source header identifies window dragging
and speed selection as the version changes. I compared sampled sequences around
the initial round, successful landings, cloud crossings, and the level transition
with the source routines below. This is a desktop adaptation, not an emulator.

Source: https://github.com/gamache/blehm/tree/32f10d0d8a3d6309aca7be40f9aa29c755f4dd10

## What the earlier prototype got wrong

The initial version substituted vector drawings for the original sprites,
reversed the wagon at screen edges, used ballistic acceleration, invented
persistent cloud wind, awarded fixed points and streak bonuses, and offered
unlimited attempts. Its dashboard was an approximation. Those choices have
been replaced with the rules and original bitmap resources below.

| Observed/source behavior | Current implementation |
| --- | --- |
| Three alternating helicopter frames; three wagon/horse frames | Original PICT 128 frames, at integer 2× scale |
| Man hangs beneath the skids; five falling poses | Original PICT 129, original sprite offsets |
| Wagon always travels right and reappears on the left | Rightward wrapping, including partially clipped native windows |
| Cloud travels slowly left; three different cloud shapes | Original PICT 356–358, one source pixel every third simulation tick |
| Helicopter follows a velocity command with inertia | Dashboard yoke, ±4 horizontal steps, −3…+4 vertical steps; acceleration one unit per tick |
| Drop uses a fixed vertical step | Four source pixels per tick at initial HEAVY setting |
| Cloud changes descent only inside its silhouette | Original QuickDraw RGN masks; one pixel down plus random sideways displacement −3…+2 source pixels |
| Leaving cloud restores normal descent without horizontal momentum | No retained wind velocity |
| Height is wagon bottom minus helicopter bottom | Same source-pixel height readout and captured release height |
| Score is release height × current level | No bullseye/streak bonus |
| Five men per round with up/down thumbs | Original dashboard/man/hand resources, five result slots |
| Five good jumps advance the level; any miss prevents advancement | Five-attempt rounds; the requested Omarchy phase repeats failed rounds |
| Driver or horse collision ends the game early | Separate source collision intervals; now triggers retaliation in the desktop game |
| Success shows a man in the hay and somersaults at both dashboard sides | Original landing patch and 14 flip frames, 45 simulation ticks |
| Failure plays a splat before the next attempt/end | Original six splat frames, 12 simulation ticks |
| Level 1/2/3 use WALK/TROT/GALLOP | 1/2/3 wagon pixels per tick |
| Later levels reduce gravity | Four, then three, two, one pixel per tick from level 4 onward |
| Six-digit score and high score with striped numerals | Original numeral bitmaps, original dashboard placement |

Relevant Pascal routines: `CreateOffScreenRects`, `InitialCopterStuff`,
`StartNewCloud`, `AnimateOneLoop`, and `ResetManHanging`.

## Deliberate desktop adaptations

- White-backed copter, wagon, and cloud use separate native layers;
  the falling man crosses the actual desktop. The wagon moves within a fixed
  transparent strip so compositor window animations cannot interpolate its wrap.
  The full white game field is gone.
- Directly dragging the copter remains available as requested. The yoke provides
  the original acceleration-based steering. Releasing the yoke returns its
  command to neutral so you can immediately return to the meeting.
- Click the copter to activate arrow-key steering and Space to drop. Further
  clicks also drop; right-click the yoke to drop while steering. Held keys and
  velocity clear when focus leaves the game. Copter right-click and dashboard
  pause are local controls, with no global bindings.
- Simulation is fixed at 60 ticks/second. The original was CPU-speed dependent;
  this preserves its per-loop relative speeds without claiming cycle-accurate
  Macintosh emulation.
- Art pixels are 2×; the available travel distance follows the monitor size.
  The first cloud starts visible so the mechanic is apparent immediately.
- The dashboard and moving sprites are the original bitmaps. Live height/status
  strings use a local sans-serif font; added pause/reset/quit controls occupy a
  narrow footer. The large score digits, labels, yoke and thumbs are original.
- Audio is omitted for meetings. High score lasts across resets in one session.
  Game over freezes the scene instead of returning to the original attract mode.
- A one-pixel white outline makes the falling figure legible over dark apps.
  The cloud's white window occludes figures behind it.
- The Omarchy phase follows the supplied site recording's mint/black
  palette, stepped wordmark shading, and animated checkerboard fields. It adds
  a new dashboard, particle halos, rotor glints, cloud vortices, falling trails,
  and landing bursts using simulation time; Classic retains the source pixels.
  The diagonal downwash fans were removed at the user's request. It does not
  change the installed desktop theme.
  It begins automatically after the first original splat; THEME, T while focused,
  and `--theme omarchy` remain available as manual overrides.
- The requested Omarchy retaliation is a new mechanic, separate from the source
  game: missed men recover, aim at the copter, and fire straight projectiles.
  Hits produce progressively heavier smoke. The third hit plays a spinning fall,
  pixel explosion, and wreck before game over. Failed five-jump rounds repeat
  rather than ending the game, and horse/driver misses also create attackers.
  Reset returns to the original graphics and rules with no damage or enemies.

## Validation

Tests cover exact 2× helicopter pixels, white piece backgrounds, transparent
unused desktop, wrapped-window clipping, cloud silhouette collision and effects,
height-based scoring, five-jump progression, driver/horse failures, yoke
acceleration, pause, frame-rate independence, keyboard release/repeat, all three
cloud shapes, theme transparency, continuous wagon wrapping, and raster/recording
replay. The native smoke check maps
three piece windows and the transparent input layer and checks focus mode and
click-through regions.

The observed native crash was a Cairo `get_clip_surface` assertion while GTK
replayed rendering operations. Frames now render into image surfaces first;
GTK receives a simple image paint. Native smoke/stress checks passed, but the
original intermittent abort was not reproduced deterministically.
