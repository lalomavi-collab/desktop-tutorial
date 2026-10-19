#!/usr/bin/env bash
# Assembles the YouTube essay draft: scene clips + AI narration + ambient bed.
# Prerequisites: scripts/youtube-essay-visuals.mjs has written OUT/scene-1..6.mp4,
# and scripts/youtube-essay-voice.py has written vo-1..6.wav in WORK (see that file).
# The narration is synthetic (Kokoro, open model); say so in the video description.
set -euo pipefail
OUT=${OUT:-/tmp/lalum-youtube-essay}; WORK=${WORK:-/tmp/tts}; cd "$WORK"
for n in 1 2 3 4 5 6; do echo "file 'vo-$n.wav'"; done > vo.txt
ffmpeg -v error -y -f concat -safe 0 -i vo.txt -c copy vo.wav
for n in 1 2 3 4 5 6; do echo "file '$OUT/scene-$n.mp4'"; done > v.txt
ffmpeg -v error -y -f concat -safe 0 -i v.txt -c copy video.mp4
# placeholder ambient bed (synthesized, no third party music): replace with licensed music if wanted
ffmpeg -v error -y -f lavfi -i "sine=f=110:d=540" -f lavfi -i "sine=f=164.81:d=540" -f lavfi -i "sine=f=220:d=540" -f lavfi -i "sine=f=277.18:d=540" -f lavfi -i "anoisesrc=c=pink:a=0.02:d=540" \
  -filter_complex "[0]volume=0.5,tremolo=f=0.1:d=0.6[a];[1]volume=0.35,tremolo=f=0.15:d=0.7[b];[2]volume=0.25,tremolo=f=0.12:d=0.5[c];[3]volume=0.12,tremolo=f=0.2:d=0.8[d];[4]lowpass=f=600[e];[a][b][c][d][e]amix=inputs=5:normalize=0,lowpass=f=1200,aecho=0.6:0.5:900:0.35,afade=t=in:d=6,afade=t=out:st=530:d=10,volume=0.9,aformat=sample_rates=48000:channel_layouts=stereo[m]" -map "[m]" music.wav
ffmpeg -v error -y -i vo.wav -i music.wav -filter_complex "[0]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=70,acompressor=threshold=0.1:ratio=3,asplit=2[v][sc];[1]volume=0.55[m];[m][sc]sidechaincompress=threshold=0.02:ratio=8:attack=40:release=600[md];[v][md]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9[o]" -map "[o]" mix.wav
ffmpeg -v error -y -i video.mp4 -i mix.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT/final-draft.mp4"
