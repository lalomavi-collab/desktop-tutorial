#!/usr/bin/env bash
# Assembles the YouTube essay: scene clips + AI narration + music and sound design.
# Run in this order:
#   1. python3 scripts/youtube-essay-voice.py   (or the per paragraph Kokoro run) -> WORK/p-<scene>-<para>.wav, clips.json
#   2. python3 scripts/youtube-essay-timing.py  -> WORK/vo-1..6.wav, narration.json
#   3. python3 scripts/youtube-essay-music.py   -> WORK/music.wav (synthesized, no third party music)
#   4. node scripts/youtube-essay-visuals.mjs   -> OUT/part-<frame>.mp4 (RANGE="a-b" renders frames a..b-1, run several in parallel)
#   5. this script                              -> OUT/final.mp4
#   6. python3 scripts/youtube-essay-package.py, node scripts/youtube-essay-thumbnail.mjs -> captions, description, thumbnail
# The narration is synthetic (Kokoro, open model); the description says so.
set -euo pipefail
OUT=${OUT:-/tmp/lalum-youtube-essay}; WORK=${WORK:-/tmp/tts}; cd "$WORK"
for n in 1 2 3 4 5 6; do echo "file 'vo-$n.wav'"; done > vo.txt
ffmpeg -v error -y -f concat -safe 0 -i vo.txt -c copy vo.wav
for f in $(ls "$OUT"/part-*.mp4 | sort); do echo "file '$f'"; done > v.txt
# parts are near lossless (crf 20, grain is expensive); the final encode below brings the size to a YouTube friendly bitrate
# voice on top with a light room, music ducked under it, loudness normalised for YouTube (-14 LUFS class)
ffmpeg -v error -y -i vo.wav -i music.wav -filter_complex \
 "[0]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=70,acompressor=threshold=0.1:ratio=3,aecho=0.8:0.6:60:0.12,asplit=2[v][sc];[1]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.75[m];[m][sc]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=700[md];[v][md]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=9[o]" \
 -map "[o]" mix.wav
ffmpeg -v error -y -f concat -safe 0 -i v.txt -i mix.wav -map 0:v -map 1:a -c:v libx264 -preset medium -crf 23 -maxrate 12M -bufsize 24M -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT/final.mp4"
ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$OUT/final.mp4"
