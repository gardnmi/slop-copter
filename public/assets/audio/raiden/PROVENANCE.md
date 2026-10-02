# Raiden sound effects

Source: [Ninja Dolphin Raiden recreation](https://github.com/t3m1X/Project-I-Ninja-Dolphin/tree/49451ea884c35f002a9861ce893fc8c87391b608/Game/sfx), commit `49451ea884c35f002a9861ce893fc8c87391b608`. Retrieved 2026-10-01.

These are third-party Raiden effects supplied by the community recreation. Raiden belongs to Seibu Kaihatsu; the samples are not original Slop Copter recordings. This is the same pinned reference project used for the explosion sprite sheet.

| Local Ogg / upstream WAV basename | Trim start | Duration | Use |
| --- | ---: | ---: | --- |
| `shot_regular` | 0.045 s | 0.100 s | Player cannon volley |
| `destroy_s_air` | 0.060 s | 0.120 s | Small aircraft destruction |
| `destroy_b_air` | 0.060 s | 1.090 s | Gunship / boss wing destruction |
| `destroy_s_tank` | 0.060 s | 0.890 s | Tank / turret / boat destruction |
| `destroy_b_tank` | 0.085 s | 1.330 s | Armored train destruction |
| `destroy_boss` | 0.060 s | 2.835 s | Iron Vulture reactor destruction |
| `powerup` | 0.045 s | 0.380 s | Power / repair / wingman pickup |
| `powerup_max` | 0.050 s | 0.620 s | Maximum cannon upgrade |
| `player_explosion` | 0.060 s | 1.930 s | Player helicopter destruction |

Leading and trailing silent padding was trimmed; effects were peak-normalized to approximately 0.78, with 2 ms attack and 8 ms release fades. Output is mono, 24 kHz, 48 kbps VBR Opus. The ordinary pickup also has a 90 Hz high-pass filter and a shortened tail to remove recorded DC offset. The nine compressed samples total **61,603 bytes**. Original padded WAVs and the reference game soundtrack are not bundled.

[The manifest](manifest.json) records input and output SHA-256 hashes, byte counts and exact trim ranges. Gain and restrained stereo placement are applied at runtime. Supplemental rotor, impact and missile effects are original synthesis in `src/air-sounds.js`.
