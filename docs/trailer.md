# Gameplay trailer

A 60-second trailer cut from `screenrecording-2026-10-02_12-22-38.mp4`.
The source recording and output MP4 stay in the user's Videos folder, outside
the repository and the deployed site.

The edit moves from the classic stunt game through the Matrix conversion,
bandana reveal, counterattack, chrome horse, self-destruct escape, rooftop run,
rescue, air assault, carrier recovery, deck combat, Cloudfall and a Slop Eater
tease. It leaves the final boss defeat and ending loop unrevealed. An animated
Matrix background supports the final Slop Copter title and play URL.

Picture is captured gameplay with captions and framing adjustments. Thin browser
game toolbar/status margins are cropped. The bandana cinematic gets a closer
crop. No speed changes are used. Audio combines the recorded gameplay with the
game's **Metallic Tension** track, short edit fades and loudness normalization.

## Rebuild

Requires FFmpeg with libx264/drawtext, Python 3 and fontconfig. No Python packages.

```sh
python3 tools/build-trailer.py \
  /path/to/screenrecording-2026-10-02_12-22-38.mp4 \
  /path/to/slop-copter-trailer.mp4
```

[trailer-edit.json](trailer-edit.json) contains the complete source in-points,
durations and audio levels. The optional `--work` argument selects a working
directory for rendered clips, edit files and audio measurements. The master is
1920×1080, 60 fps, H.264 video with 48 kHz stereo AAC audio and fast-start metadata.
Audio targets −16 LUFS with peaks below −1.5 dBTP. The original capture is untouched.
