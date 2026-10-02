#!/usr/bin/env python3
"""Build a 60-second gameplay trailer from the user's original capture.

Requires FFmpeg/FFprobe (libx264 and drawtext) and fontconfig. No Python packages.
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


def font(family):
    return subprocess.check_output(['fc-match', '-f', '%{file}', family], text=True)


def draw(text, font_path, size, y, color='0xf6f2df', x='(w-tw)/2', extra=''):
    return f"drawtext=fontfile='{font_path}':text='{text}':fontsize={size}:fontcolor={color}:x={x}:y={y}{extra}"


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
    assert abs(duration - 60) < .001, duration
    bold, mono = font('Nimbus Sans Narrow:style=Bold'), font('DejaVu Sans Mono:style=Bold')
    base = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-threads', '4']

    def render(pair):
        index, clip = pair
        target = work / f'clip-{index:02d}.mp4'
        filters = [f"crop={clip.get('crop', '2560:1380:0:36')}",
                   'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos',
                   'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
                   'setsar=1', 'fps=60', 'setpts=PTS-STARTPTS']
        if clip.get('card'):
            filters += ['drawbox=x=0:y=0:w=iw:h=ih:color=black@0.88:t=fill',
                        'drawbox=x=150:y=120:w=1620:h=3:color=0x78ffa0:t=fill',
                        draw('SLOP', bold, 210, 190, '0xf6f2df'),
                        draw('COPTER', bold, 250, 390, '0x78ffa0'),
                        draw('ONE GAME. SEVERAL IDENTITY CRISES.', mono, 34, 680),
                        draw('A GENRE-SHIFTING SLOPCADE', mono, 26, 758, '0x78ffa0'),
                        'drawbox=x=770:y=828:w=380:h=2:color=0x78ffa0:t=fill',
                        draw('PLAY FREE IN YOUR BROWSER', mono, 25, 868),
                        draw('slop-copter.pages.dev', mono, 36, 918),
                        'fade=t=in:st=0:d=0.18', 'fade=t=out:st=5.8:d=0.7']
        elif clip.get('caption'):
            color, bg = ('0x111915', 'white@0.88') if clip.get('light') else ('0x94ffb2', 'black@0.82')
            if not clip.get('light'):
                filters += [f'drawbox=x=92:y=94:w=1050:h=162:color={bg}:t=fill']
            filters += [draw(clip['caption'], bold, 66, 115, color, '128')]
            if clip.get('subcaption'):
                filters += [draw(clip['subcaption'], mono, 24, 201, color, '132')]
            else:
                filters += [draw('SLOP COPTER', mono, 24, 201, '0xf6f2df', '132')]
        if index == 0:
            filters += ['fade=t=in:st=0:d=0.2:color=white']
        fade_out = clip['duration'] - .035
        af = f"aresample=48000,asetpts=PTS-STARTPTS,volume={clip['audio']},afade=t=in:st=0:d=0.012,afade=t=out:st={fade_out}:d=0.035"
        run(base + ['-ss', str(clip['start']), '-i', str(source), '-t', str(clip['duration']),
                    '-vf', ','.join(filters), '-af', af, '-map', '0:v:0', '-map', '0:a:0',
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '4',
                    '-pix_fmt', 'yuv420p', '-video_track_timescale', '60000',
                    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', str(target)])
        print(f"Rendered {index + 1:02d}/{len(plan['clips'])}: {clip['name']}", flush=True)
        return target

    with ThreadPoolExecutor(max_workers=2) as pool:
        parts = list(pool.map(render, enumerate(plan['clips'])))
    concat = work / 'cuts.ffconcat'
    concat.write_text('ffconcat version 1.0\n' + ''.join(f"file '{p.name}'\n" for p in parts))
    picture = work / 'picture.mp4'
    run(base + ['-f', 'concat', '-safe', '0', '-i', str(concat), '-c', 'copy', '-t', str(duration), str(picture)])
    mixed = work / 'mix.wav'
    graph = (
        "[1:a]aresample=48000,atrim=duration=60,asetpts=PTS-STARTPTS,"
        "volume='if(lt(t,4),0.12,if(lt(t,5),0.12+(t-4)*0.63,0.75))':eval=frame,"
        "afade=t=in:st=0:d=0.5,afade=t=out:st=56.8:d=3.2[music];"
        "[0:a][music]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.92:level=0[mix]"
    )
    run(base + ['-i', str(picture), '-ss', str(plan['music_start']), '-i', str(ROOT / plan['music']),
                '-filter_complex', graph, '-map', '[mix]', '-c:a', 'pcm_s16le', '-t', '60', str(mixed)])
    # Two-pass loudness normalization keeps the opening quieter while controlling peaks.
    measured = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(mixed), '-af',
        'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, check=True).stderr
    stats = json.loads(measured[measured.rfind('{'):measured.rfind('}') + 1])
    loudness = f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}:linear=true"
    run(base + ['-i', str(picture), '-i', str(mixed), '-map', '0:v:0', '-map', '1:a:0',
                '-c:v', 'copy', '-af', loudness, '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
                '-t', '60', '-movflags', '+faststart', '-metadata', 'title=Slop Copter — Gameplay Trailer',
                '-metadata', 'comment=Captured gameplay. Play at https://slop-copter.pages.dev/', str(output)])
    (work / 'audio-measurements.json').write_text(json.dumps(stats, indent=2) + '\n')
    print(f'Finished: {output}', flush=True)


if __name__ == '__main__':
    main()
