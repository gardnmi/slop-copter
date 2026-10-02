#!/usr/bin/env python3
"""Build the wordless 13-second fall / gameplay flashes / hay-cart teaser.

Requires FFmpeg/FFprobe with libx264 and Python 3. No Python packages.
The recording and rendered video remain outside the repository.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def run(args):
    subprocess.run(args, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--work', type=Path)
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    work = (args.work or output.parent / (output.stem + '-work')).resolve()
    work.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    plan = json.loads((ROOT / 'docs/trailer-edit.json').read_text())
    duration = sum(c['duration'] for c in plan['clips'])
    assert abs(duration - plan['duration']) < .001, duration
    assert 10 <= duration <= 15
    base = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-threads', '4']

    def render(pair):
        index, clip = pair
        # PCM audio avoids padding at every AAC cut; encode AAC only at export.
        target = work / f'clip-{index:02d}.mov'
        filters = [f"crop={clip['crop']}",
                   'scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos',
                   'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
                   'setsar=1', f"fps={plan['fps']}", 'setpts=PTS-STARTPTS']
        af = (f"aresample=48000,asetpts=PTS-STARTPTS,volume={clip['audio']},"
              f"afade=t=in:st=0:d=0.008,afade=t=out:st={clip['duration'] - .012}:d=0.012")
        run(base + ['-ss', str(clip['start']), '-i', str(source), '-t', str(clip['duration']),
                    '-vf', ','.join(filters), '-af', af, '-map', '0:v:0', '-map', '0:a:0',
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '4',
                    '-pix_fmt', 'yuv420p', '-video_track_timescale', '60000',
                    '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', str(target)])
        print(f"Rendered {index + 1:02d}/{len(plan['clips'])}: {clip['name']}", flush=True)
        return target

    with ThreadPoolExecutor(max_workers=2) as pool:
        parts = list(pool.map(render, enumerate(plan['clips'])))
    concat = work / 'cuts.ffconcat'
    concat.write_text('ffconcat version 1.0\n' + ''.join(f"file '{p.name}'\n" for p in parts))
    picture = work / 'picture.mov'
    run(base + ['-f', 'concat', '-safe', '0', '-i', str(concat), '-c', 'copy', '-t', str(duration), str(picture)])
    mixed = work / 'mix.wav'
    montage_length = plan['montage_end'] - plan['montage_start']
    # Music stops when the original fall and landing audio return.
    graph = (
        f"[1:a]aresample=48000,atrim=duration={montage_length},asetpts=PTS-STARTPTS,"
        f"volume=0.8,afade=t=in:st=0:d=0.04,afade=t=out:st={montage_length - .08}:d=0.08,"
        f"adelay={round(plan['montage_start'] * 1000)}:all=1[music];"
        "[0:a][music]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.92:level=0[mix]"
    )
    run(base + ['-i', str(picture), '-ss', str(plan['music_start']), '-i', str(ROOT / plan['music']),
                '-filter_complex', graph, '-map', '[mix]', '-c:a', 'pcm_s16le', '-t', str(duration), str(mixed)])
    measured = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(mixed), '-af',
        'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, check=True).stderr
    stats = json.loads(measured[measured.rfind('{'):measured.rfind('}') + 1])
    loudness = f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}:linear=true"
    run(base + ['-i', str(picture), '-i', str(mixed), '-map', '0:v:0', '-map', '1:a:0',
                '-c:v', 'copy', '-af', loudness, '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
                '-t', str(duration), '-movflags', '+faststart', '-map_metadata', '-1', str(output)])
    (work / 'audio-measurements.json').write_text(json.dumps(stats, indent=2) + '\n')
    print(f'Finished: {output}', flush=True)


if __name__ == '__main__':
    main()
