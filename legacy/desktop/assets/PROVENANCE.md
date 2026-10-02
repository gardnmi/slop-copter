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

`../sprites_data.py` contains cloud collision regions decoded from RGN 356–358.
`../extract_assets.py` reproduces these files from a local archive checkout,
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

## Omarchy wordmark

`omarchy-wordmark.png` is an unchanged copy of the existing repository asset
`experiments/platform-lab/assets/omarchy.png`, originally rendered from the
installed `/usr/share/omarchy/logo.svg`. It belongs to the Omarchy project and
is separate from Duane Blehm's game assets. As already recorded in this repo's
`docs/ASSETS.md`, upstream redistribution terms still need confirmation.
The game applies its mint shading and shimmer at runtime; the PNG is unchanged.

The new checker fields, particles, and dashboard drawing are code-native effects
in `theme.py`, guided by the user's September 29, 2026 site recording.
