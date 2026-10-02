# Rooftop escape

The fifth grenade still destroys the chrome horse and buggy and awards 3,000
points, but also arms the carriage's 12-second self-destruct. The Matrix title
re-forms into a code-filled right arrow and a countdown. Holding right moves
the helicopter into the city: forward distance gradually reveals a lighter
gray skyline and rooftops. Hovering does not advance that transition.
The bomb detonates behind the player and its expanding pressure front catches
the helicopter's tail. The tail breaks away first; the body then explodes as the
armed stuntman leaps forward onto an already-visible ledge, tucks, rolls, and
starts running from the spreading destruction. No menu interrupts the handoff.
The rifle remains in his hands during running, jumping and the roll.

After 20 seconds of surviving the rooftop run, the camera smoothly pulls back
to 82% scale. A detailed Apache-inspired rescue helicopter enters from ahead,
matches the runner's pace and lowers its boarding rail over a clear rooftop.
The amber rail and a small prompt signal a five-second pickup window. Space,
up arrow or touch still jumps; crossing the rail with the character's hands
grabs it automatically. Staying on the ground does not trigger extraction.
The rifle moves to his back as he reaches, hangs and pulls himself up; the
helicopter accelerates upward out of the blast in the same continuous scene.
An in-scene EXTRACTED title marks the escape without opening a dialog.

The timer counts live running ticks only, including jumps, and pauses with the
game. The pickup roof replaces only terrain beyond the visible horizon. The
reveal retains the current jump, momentum and visible geometry. A missed window
lets the helicopter pull away and the blast close in. Continue retries the pickup
with a fresh approach, safe roof and blast lead, preserving the distance reached
at the checkpoint and the earlier fight score. R starts the full game again.

## Research

The design was checked against the original game's official port and artwork:

- [Canabalt by Finji](https://finji.co/games/canabalt/) and its
  [official screenshot](https://finji.co/assets/images/canabalt2.jpg): cool gray
  palette, light roof edges, simple windows, a small contrasting runner and a
  minimal distance display.
- [Official source-port announcement](https://ninjamuffin99.newgrounds.com/news/post/1421207):
  Cameron Taylor describes porting Adam Saltsman's original ActionScript code.
- [Player.hx](https://github.com/ninjamuffin99/canabalt-hf/blob/main/source/Player.hx):
  automatic acceleration with diminishing gains at higher speeds; a short held
  jump interval; landing, running and stumbling poses. The jump button controls
  airtime rather than horizontal direction.
- [Sequence.hx](https://github.com/ninjamuffin99/canabalt-hf/blob/main/source/Sequence.hx):
  variable-width rooftops and gaps related to speed, different roof heights,
  pigeons, breakable windows, cranes, collapsing buildings and falling hazards.
- [Obstacle.hx](https://github.com/ninjamuffin99/canabalt-hf/blob/main/source/Obstacle.hx):
  small obstacles cause a stumble and reduce speed to 70 percent.
- [PlayState.hx](https://github.com/ninjamuffin99/canabalt-hf/blob/main/source/PlayState.hx):
  city parallax, camera lead, distance scoring and a quick retry.
- [Konami's Contra overview](https://www.konami.com/crossmedia/us/en/products/contra/)
  and [original NES animation reference](https://nesmaps.com/maps/Contra/sprites/ContraSprites.html)
  ([run cycle](https://nesmaps.com/maps/Contra/sprites/BillWalkingR.gif)):
  the latest character direction uses a compact armed commando stance, stable
  two-handed machine-gun hold, high knees and alternating extended boot strides.

This game keeps its own stuntman and world. The runner implementation and city
drawing are new JavaScript/Canvas code. Canabalt/Contra source, sprites and music
are not bundled. The source references informed the feel; this is not an exact
physics port or a claim of frame-for-frame equivalence.

## Controls and pacing

- During escape, arrows accelerate the helicopter. Rightward progress drives
  the camera and gray transition; a timer alone cannot take the player there.
  The countdown continues while flying. Reaching the city allows the tail-hit
  and leap sequence; getting caught before reaching it offers Continue at the
  escape checkpoint, preserving the defeated horse and its score.
- On the roof, running is automatic. Space, ↑, W, clicking the playfield or the
  touch jump button all start a jump. Hold for a longer leap, release for a hop.
  A held button does not trigger another jump on landing.
- Crates and vents slow the runner. Windows shatter without stopping him. Gaps
  and building sides are fatal. Later roofs add cranes and sinking structures.
  The falling-machine obstacle has been removed. The first roofs provide room
  to learn the new control.
  The destruction front follows at the left of the screen; losing too much
  ground lets it catch the runner.
- Death stays in the city view. Space or touch retries at the rooftop checkpoint;
  the horse fight score and best running distance remain. R / New game restarts
  the original flight. Best rooftop distance is stored separately from score.
- Pause, focus loss, help, fullscreen and resizing preserve progress. Resizing
  changes the camera, not the existing roof positions or jump physics. Canceled
  touch input and window blur release the held jump.
- Reduced motion removes camera shake, flying speed lines and roll rotation,
  holds a stable run pose, and preserves the actual jump, scrolling and hazards.
  Optional synthesized countdown cues, impacts, footsteps and a restrained bass
  pulse use the existing sound preference.

## Implementation

`src/runner.js` owns the sequence and deterministic 50 Hz simulation. It takes
over after `LiquidBoss` reaches `won`; earlier flight/fight state stops ticking.
An independent random stream generates reachable gaps from the actual full-jump
envelope, with extra margin for timing. World coordinates survive viewport
changes. A small jump buffer and ledge grace support readable controls.

`src/runner-art.js` draws a low-resolution surface scaled to fill the playfield:
three city layers, roof edges, facade tiles, antennas, water tanks, fire escapes,
birds, glass, wreckage and the advancing destruction front. It replaces the flight dashboard
with a distance display. `src/runner-assets.js` records sprite crops and shared
ground anchors.

The built-in OpenAI image_gen tool created `public/assets/rooftop-runner-atlas.png`
using the existing gunner's identity, Canabalt's palette and the Contra pose
reference. `public/assets/rooftop-runner-prompts.json` records both prompts and
source paths. Runtime sprites are 20 world pixels tall, resolved to a compact
gray palette with opaque pixel edges and a red bandana. Eight running frames
and four action poses all retain the machine gun. The gun is carried; this
chapter's playable action is jumping.

The helicopter landing and rooftop retries now start at 340 world pixels/s
(instead of 100); the leap carries at least that pace through the roll and into
running. This intentional adaptation preserves the helicopter momentum. The
landing roof includes room for the faster roll and a reaction window. Otherwise
the movement retains the supplied source tuning: 800 maximum, acceleration tiers of 30/20/10/4, gravity 1200, and a 300 fall-speed
cap. Jump lift begins at 195 and increases to 300 after 0.08 seconds of holding;
the hold window is speed/2000, capped at 0.35 seconds. Release stops applying lift
without discarding existing upward momentum. The full-screen camera uses a
tighter view, fixed world-anchored skyline details, and faster foreground layers
to make acceleration visible. Roof spacing still includes an intentional margin
for this game's smaller variable-size display and its controls.

Verification covers the complete handoff, variable jumps, obstacle penalties,
glass, fatal gaps, reachable early runs across multiple seeds, frame-rate
independence, pause/resize, keyboard and real browser touch events, retry and
persistent records.

`src/rescue-art.js` draws the newly generated rescue helicopter and four commando
action poses. The helicopter body is resolved to 192 world pixels wide and the
commando stays about the same size as the running sprite. Main/tail rotors animate
independently; subtle wash scatters roof dust. The art and swept hand collision
share the boarding-rail anchor. Built-in image_gen prompts and reference paths
are recorded next to the new assets. Rescue tests cover the 20-second trigger,
slow/fast jump grabs, timeout, checkpoint, pause/resize, full generated runs,
keyboard/touch controls and completion without a modal.

## Pigeons and rescue crop correction

The [Dove implementation](https://github.com/ninjamuffin99/canabalt-hf/blob/main/source/Dove.hx)
and [Sequence placement](https://github.com/ninjamuffin99/canabalt-hf/blob/main/source/Sequence.hx)
were inspected directly. Flocks now appear on roughly 35% of suitable roofs,
scattered across the roof rather than lined up. Each pigeon has an independent
trigger, facing, initial upward velocity, horizontal/vertical acceleration and
three-frame wing phase. They scatter in both directions. Seeded variation uses
a separate stream so extra bird detail does not change roof geometry. The small
gray pigeon drawings are original. Reduced motion holds the wing pose.

The hanging commando's old crop rectangles came from a scaled preview, while
the actual atlas is 2172 × 724. All four rectangles now include the complete
alpha bounds and use corrected hand anchors; boots, elbows and cloth tails remain
visible. A browser regression checks that no opaque source pixels are clipped.


### Continuous helicopter departure

The jump starts at the hanging character's rendered foot position, including the
helicopter's scale and bank. The runner grows smoothly to its gameplay sprite size
during the first sixteen falling ticks. Camera velocity carries through falling,
rolling and running with a bounded acceleration controller; entering the running
phase never assigns a new camera position. The near skyline layer is already
visible before departure. Roof extensions may only alter an edge beyond the
visible horizon. The unused floating machine silhouette has been removed.
