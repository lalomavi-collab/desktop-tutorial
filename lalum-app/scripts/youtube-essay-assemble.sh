#!/usr/bin/env bash
# Assembles the YouTube essay: scene clips + AI narration + music and sound design.
# Run in this order:
#   1. python3 scripts/youtube-essay-voice.py   (or the per paragraph Kokoro run) -> WORK/p-<scene>-<para>.wav, clips.json
#   2. python3 scripts/youtube-essay-timing.py  -> WORK/vo-1..6.wav, narration.json
#   3. python3 scripts/youtube-essay-music.py   -> WORK/music.wav (synthesized, no third party music)
#   4. node scripts/youtube-essay-visuals.mjs   -> OUT/scene-1..6.mp4
#   5. this script                              -> OUT/final.mp4
#   6. python3 scripts/youtube-essay-package.py, node scripts/youtube-essay-thumbnail.mjs -> captions, description, thumbnail
# The narration is synthetic (Kokoro, open model); the description says so.
set -euo pipefail
OUT=${OUT:-/tmp/lalum-youtube-essay}; WORK=${WORK:-/tmp/tts}; cd "$WORK"
for n in 1 2 3 4 5 6; do echo "file 'vo-$n.wav'"; done > vo.txt
ffmpeg -v error -y -f concat -safe 0 -i vo.txt -c copy vo.wav
for n in 1 2 3 4 5 6; do echo "file '$OUT/scene-$n.mp4'"; done > v.txt
ffmpeg -v error -y -f concat -safe 0 -i v.txt -c copy video.mp4
# voice on top with a light room, music ducked under it, loudness normalised for YouTube (-14 LUFS class)
ffmpeg -v error -y -i vo.wav -i music.wav -filter_complex \
 "[0]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=70,acompressor=threshold=0.1:ratio=3,aecho=0.8:0.6:60:0.12,asplit=2[v][sc];[1]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.75[m];[m][sc]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=700[md];[v][md]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=9[o]" \
 -map "[o]" mix.wav
ffmpeg -v error -y -i video.mp4 -i mix.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT/final.mp4"
ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$OUT/final.mp4"
