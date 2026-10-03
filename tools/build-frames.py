#!/usr/bin/env python3
"""
Rebuild the scroll-film frame sequence for the Hilton Renewables site.

The hero/product chapter is a video scrubbed by scroll position: the page draws
one WebP still per scroll step onto a <canvas>. This script slices a source
video into that sequence.

This site has TWO sequences:

    # 01 hero film — Intro.mp4 (sun -> solar system -> earth -> farm -> cell)
    python3 tools/build-frames.py "Intro.mp4" --out frames \
        --fps 20 --width 1280 --quality 74 --max-frames 263 --poster film-poster.jpg

    # 02 product reveal — Solar Panel Video.mp4 (exploded module)
    python3 tools/build-frames.py "Solar Panel Video.mp4" --out frames2 \
        --fps 20 --width 1120 --quality 78 --max-frames 196 --pick 150 \
        --poster film2-poster.jpg

After changing a frame count, update CONFIG.films.a.count / .b.count in
assets/js/main.js.
Requires: ffmpeg on PATH, Pillow (pip install pillow).
"""
import argparse, glob, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))



def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("--out", default="frames", help="folder under assets/ to write into")
    ap.add_argument("--fps", type=int, default=20)
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--quality", type=int, default=74)
    ap.add_argument("--max-frames", type=int, default=0,
                    help="drop trailing frames (0 = keep all)")
    ap.add_argument("--pick", type=int, default=0,
                    help="evenly subsample down to this many frames (0 = keep all)")
    ap.add_argument("--poster", default="film-poster.jpg",
                    help="first-frame poster written to assets/img/")
    a = ap.parse_args()

    try:
        from PIL import Image
    except ImportError:
        sys.exit("Pillow is required:  pip install pillow")
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is required and was not found on PATH")

    tmp = tempfile.mkdtemp(prefix="hr-frames-")
    subprocess.run([
        "ffmpeg", "-v", "error", "-i", a.source,
        "-vf", f"fps={a.fps},scale={a.width}:-2", "-q:v", "2",
        os.path.join(tmp, "f%04d.png"), "-y"
    ], check=True)

    files = sorted(glob.glob(os.path.join(tmp, "*.png")))
    if a.max_frames:
        files = files[:a.max_frames]
    if a.pick and a.pick < len(files):
        files = [files[round(i * (len(files) - 1) / (a.pick - 1))] for i in range(a.pick)]
    if not files:
        sys.exit("ffmpeg produced no frames")

    OUT = os.path.join(ROOT, "assets", a.out)
    os.makedirs(OUT, exist_ok=True)
    for old in glob.glob(os.path.join(OUT, "*.webp")):
        os.remove(old)

    total = 0
    for i, f in enumerate(files, start=1):
        dst = os.path.join(OUT, f"f{i:04d}.webp")
        im = Image.open(f).convert("RGB")
        if im.width > a.width:
            im = im.resize((a.width, round(im.height * a.width / im.width)), Image.LANCZOS)
        im.save(dst, "WEBP", quality=a.quality, method=5)
        total += os.path.getsize(dst)

    # poster: first frame, painted before the canvas is ready
    Image.open(files[0]).convert("RGB").save(
        os.path.join(ROOT, "assets", "img", a.poster), quality=82)

    shutil.rmtree(tmp, ignore_errors=True)
    print(f"{len(files)} frames -> {OUT}  ({total/1048576:.2f} MB)")
    print(f"Set the matching CONFIG.films.*.count = {len(files)} in assets/js/main.js")


if __name__ == "__main__":
    main()
