# Gameplay teaser

A **13-second** edit of `screenrecording-2026-10-02_12-22-38.mp4`:

- **0–1.2s:** the original stuntman falls from high above the clouds.
- **1.2–9.8s:** fast cuts through the bandana reveal, chrome horse, rooftops,
  helicopter rescue, air assault, carrier approach, deck combat and well.
- **9.8–13s:** resume the same fall, pass through the cloud, land in the hay cart.

There are no added words, captions, titles, logos or end cards. Shot-specific
crops remove the game toolbar and most HUD elements, while keeping the action
visible. In-world signage remains part of the captured gameplay. No footage is
sped up. The opening and ending use consecutive portions of the same descent.

The game's **Metallic Tension** music runs only during the montage. Recorded
gameplay effects accompany the cuts; the original fall and landing audio return
for the ending. Audio uses short edit fades and two-pass loudness normalization.

## Rebuild

Requires FFmpeg with libx264 and Python 3. No Python packages.

```sh
python3 tools/build-trailer.py \
  /path/to/screenrecording-2026-10-02_12-22-38.mp4 \
  /path/to/slop-copter-teaser.mp4
```

[trailer-edit.json](trailer-edit.json) records all source in-points, crops,
durations and audio levels. `--work` optionally selects a working directory.
The output is 1920×1080 at 60 fps, H.264 with stereo AAC and fast-start metadata.
Audio targets −16 LUFS and −1.5 dBTP. PCM intermediates avoid AAC padding between
cuts. The source recording and rendered MP4 stay outside the repository and
deployment; the source is never modified.
