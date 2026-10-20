#!/usr/bin/env bash
# Prepares the live action plates of the home film: every clip becomes a numbered frame sequence at 48 fps
# (motion interpolated, so the slow motion playback in the film stays smooth), one folder per plate.
#   scripts/home-film-live-prep.sh office=clip1.mp4 team=clip2.mp4 walk=clip3.mp4
# Plates the film knows: office (scene 1), team (scene 2), walk (closing shot of scene 5).
# Output: LIVE (default /tmp/hf-live)/<plate>/0001.jpg ... The clips are AI generated people and are labelled as such in the film.
set -euo pipefail
LIVE=${LIVE:-/tmp/hf-live}
for pair in "$@"; do
  name=${pair%%=*}; file=${pair#*=}
  rm -rf "$LIVE/$name"; mkdir -p "$LIVE/$name"
  ffmpeg -v error -y -i "$file" -an -vf "minterpolate=fps=48:mi_mode=mci:mc_mode=aobmc:vsbmc=1,scale=1344:768" -q:v 3 "$LIVE/$name/%04d.jpg"
  echo "$name: $(ls "$LIVE/$name" | wc -l) frames"
done
