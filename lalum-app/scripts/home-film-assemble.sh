#!/usr/bin/env bash
# Assembles the home page film: rendered parts + the mix from home-film-audio.py.
# Order: python3 scripts/home-film-audio.py, then node scripts/home-film-visuals.mjs (RANGE="a-b" in parallel), then this script.
# Writes OUT/home-film.mp4 (720p, H.264 and AAC, about 12 MB, no burned in subtitles) and OUT/home-film.jpg (poster).
set -euo pipefail
OUT=${OUT:-/tmp/lalum-home-film}; WORK=${WORK:-/tmp/tts-home}
for f in $(ls "$OUT"/part-*.mp4 | sort); do echo "file '$f'"; done > "$WORK/v.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$WORK/v.txt" -i "$WORK/mix.wav" -map 0:v -map 1:a -vf scale=1280:-2 \
  -c:v libx264 -preset slow -crf 25 -maxrate 2500k -bufsize 5M -pix_fmt yuv420p -c:a aac -b:a 128k -shortest -movflags +faststart "$OUT/home-film.mp4"
ffmpeg -v error -y -ss 16 -i "$OUT/home-film.mp4" -frames:v 1 -update 1 "$OUT/home-film.jpg"
ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$OUT/home-film.mp4"
