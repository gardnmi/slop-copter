# Downwell reference artwork — private prototype

These unmodified PNG sheets come from
[MGPAlpha/DownwellGBA](https://github.com/MGPAlpha/DownwellGBA/tree/480a5b1f7a82f8b647422f2086e2d74edfca1082/src),
commit `480a5b1f7a82f8b647422f2086e2d74edfca1082`:

- `spritesheet.png` ← `src/art/spritesheet.png`
- `terraintiles.png` ← `src/art/terraintiles.png`
- `reference-atlas.png` ← `src/og-art/00000c0d.png`

Downwell artwork belongs to its original creators (Ojiro Fumoto / Moppin).
These are reference-game assets, not original Slop Copter artwork or assets
with a claimed redistribution license. Included for the user's explicitly
requested private prototype. Runtime code crops frames, maps the three inks,
and adds the requested red headband and handheld downward-firing gun.

Slop Eater's body and cinematic now use original runtime pixel art in
`src/hay-eater-art.js` and `src/hay-eater-sprite.js`: the opening cart's hay becomes
a living heap, with two eyes poking through layered straw bundles. Highlight
planes, dithered shadows, angled brows and a broken twine tie use the same three
inks. Cached frames animate attached loose straw and eye tracking. No reference
boss body, horns or corpse is used.
The red/white explosion lobes at `(1366,1066,55,55)` and `(1422,1066,55,55)`
still supply the chain-reaction effects. Sound provenance is separate:
[Downwell effects](../audio/downwell/PROVENANCE.md).
