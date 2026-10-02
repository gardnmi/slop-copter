# Celeste terrain reference assets

These are third-party Celeste sprites used in this private prototype, not original
Slop Copter artwork. Celeste and its artwork belong to their original creators
(Maddy Makes Games / Extremely OK Games; pixel art by Pedro Medeiros).

Source: https://github.com/aczw/CelesteWFC
Source revision: b0ca457f251b63e156a2d9f695a88c6d30067408
Original paths under `CelesteWFC/Assets/Sprites/Forsaken City/`:

- `blue_rock.png` → `blue-rock.png`
- `grey_bricks.png` → `grey-bricks.png`
- `ibeams.png` → `ibeams.png`

Files are copied without modification. The reference exports each native pixel
at 4x; the renderer samples 32×32 source cells as 8×8 world tiles. No game engine
code from this repository is included. Its README identifies the tiles as Celeste
sprites, imported via a community tileset. The public repository does not grant
an independent license for the original game's artwork; these files are not
covered by the MIT license on the separately credited Celeste controller.

Runtime: `src/below-scenery.js` uses the sheets on collision-aligned surfaces,
with neighbor-aware edges and varied infill. Ship scenery, the commando and
helicopter are original code-native artwork. Footage is used for reference only.
