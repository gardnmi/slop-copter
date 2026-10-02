# Stunt Copter — desktop adaptation

The original StuntCopter bitmap sprites and dashboard, playing over your desktop.
Every normal start opens in Classic. The first missed jumper plays the original
splat animation, then the game transforms into Omarchy: he gets back up and
starts shooting at your helicopter.
The copter, horse-and-wagon, and cloud each have a small white desktop panel.
The falling man crosses the transparent space between them.

```sh
python experiments/stunt-copter/main.py
```

Requires the repo's Python, Cairo, GTK4 and gtk4-layer-shell setup, running in an
active Omarchy/Wayland desktop session.

## Controls

- **Click the copter** to activate keyboard control: **arrow keys** steer with
  acceleration, and **Space** drops the man. Clicking another app releases the
  game keys immediately. The first activation click does not drop a man.
- **Drag the copter window** to position it directly. Further clicks while the
  game has keyboard control also drop the man.
- Or **drag the dashboard yoke** to steer with the original acceleration and
  inertia. Release to return the command to neutral. **Right-click the yoke**
  to release the man while steering.
- **Right-click the copter** or use **PAUSE/PLAY** in the dashboard to pause.
- **RESET** restarts in Classic, clears attackers and damage, and retains the
  session high score. **BEGIN** does the same after game over. **QUIT** exits.
  Ctrl+C also exits from the launching terminal.
- While the copter has focus: **P/Esc** pauses, **R** resets, **T** changes theme.
- **THEME** in the dashboard switches between the original monochrome **Classic**
  art and **Omarchy**, styled after the site's mint-on-black pixel graphics:
  a large shaded wordmark, animated checkerboard fields, rotor glints, cloud
  vortices, wheel spokes, dust, falling trails, and landing bursts. The dashboard
  has block score digits, five attempt lights, and a yoke beside the flight
  indicator. Manual theme changes preserve the game; combat is suspended while
  Classic is selected. A fatal spin/explosion finishes before themes can change.
  Reset always returns to Classic and re-arms the first-miss transformation.

To skip the Classic opening and start directly in Omarchy:

```sh
python experiments/stunt-copter/main.py --theme omarchy
```

Only the copter and dashboard receive pointer input. The wagon, cloud, falling
man and unused desktop are click-through. Keyboard controls work only after
clicking the copter and stop when you return to Zoom or another app. No audio,
desktop configuration changes, or global shortcuts.

## Opening and retaliation

The wagon walks entirely off the right edge and re-enters from the left. Its
white panel moves within a stationary transparent native strip, preventing the
window manager from animating a return trip across the screen.
The man falls at a fixed rate. Inside
the cloud silhouette, he drops at one quarter of initial speed and jitters
sideways randomly; normal descent resumes immediately on exit.
The original three cloud shapes cycle after leaving the screen. Each uses its
own original silhouette for collision, with the same slowing/jitter rules.

Landing in hay scores **release height × level** and plays the original
somersault celebration. There are **five jumps per round**. All five must land
safely to advance. Later levels increase wagon speed from WALK to TROT to GALLOP,
then reduce the falling speed.

The first failed landing (ground, horse, or driver) finishes its original
monochrome splat, then switches to Omarchy. That same man stands up and fires.
Every subsequent miss leaves another angry stuntman on the ground. Missed rounds
repeat at the same level, so the retaliation can continue.

Shots aim at the copter's position when fired and travel in a straight line:
keep moving to dodge. A short grace period prevents overlapping shots from
dealing all three hits at once. The first hit starts engine smoke; the second
makes it heavier. **The third hit disables flight and dropping**, spins the
copter into the ground, and plays a pixel explosion before game over. The HITS
display tracks damage, which persists across rounds until reset. Everything,
including shots, getting up, smoke, and the crash, pauses with the game.

The Classic dashboard uses the original yoke, man/hand icons, six-digit striped
numbers, and background. Height and wagon/gravity status update live. Scores last for
the current process; resetting preserves that process's high score.

## Reference and implementation

See [REFERENCE.md](REFERENCE.md) for the video study, source routines, exact
rules, and deliberate desktop adaptations. [Asset provenance](assets/PROVENANCE.md)
credits Duane Blehm and identifies the original resource archive. These are the
actual bitmap resources, replacing the POC's earlier redrawn approximations.

Sprites display at 2× with nearest-neighbour sampling. Physics uses fixed
60 Hz original-style animation steps. The travel area follows the selected
monitor. The game remains above apps across workspaces on that monitor.
Relaunch after unplugging the monitor.

```sh
python -m unittest discover -s experiments/stunt-copter -p 'test_*.py'
python experiments/stunt-copter/main.py --smoke-test
python experiments/stunt-copter/main.py --combat-smoke-test
python experiments/stunt-copter/main.py --preview /tmp/stunt-copter.png
```

`model.py` contains the state machine and physics; `sprites.py` draws the original
assets; `art.py` positions desktop pieces; `dashboard.py` draws the instruments;
`main.py` manages four native surfaces and mouse/keyboard input; `theme.py` adds
the color palette and effects; `combat.py` handles attackers, swept projectile
collisions and the death sequence; `combat_art.py` draws those effects.
`rendering.py` rasterizes complex clips
and blends before handing a simple image to GTK, avoiding the recording replay
path involved in the observed Cairo native abort. The experiment stays
outside the cartridge catalog so it can be moved to its own project later.

The Omarchy treatment follows the supplied nine-second site recording
(`screenrecording-2026-09-29_17-13-15.mp4`): stepped mint highlights, a near-black
background, dense checker edges dissolving into scattered pixels, and a shaded
wordmark. The visual effects are click-through outside the normal controls,
pause with gameplay, and never consume the physics random-number generator.
The 12-second combat smoke check opens real desktop pieces, deliberately misses
one jump, and verifies the Classic-to-Omarchy transition through the final crash.
