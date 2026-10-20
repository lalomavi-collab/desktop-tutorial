#!/usr/bin/env bash
# Prepares the live action plates of the home film: every clip becomes a numbered frame sequence at 48 fps
# (motion interpolated, so the slow motion playback in the film stays smooth), one folder per plate.
#   scripts/home-film-live-prep.sh office=clip1.mp4 team=clip2.mp4 walk=clip3.mp4 d4=still.jpg
# A video clip becomes the plate as is; a still image (jpg, png, webp) becomes a slow push in until a real clip replaces it.
# Plates the film knows: office (scene 1), team (scene 2), d1 to d5 (the five stations of scene 3), e1 and e2 (scene 4),
# f1 (scene 5), walk (closing shot), b1 and b2 (short connecting shots over the camera sweeps into scenes 3 and 5).
# A missing plate is simply left out: the film never draws cartoon people any more.
# Output: LIVE (default /tmp/hf-live)/<plate>/0001.jpg ... The clips are AI generated people and are labelled as such in the film.
set -euo pipefail
LIVE=${LIVE:-/tmp/hf-live}
for pair in "$@"; do
  name=${pair%%=*}; file=${pair#*=}
  rm -rf "$LIVE/$name"; mkdir -p "$LIVE/$name"
  case "${file,,}" in
    *.jpg|*.jpeg|*.png|*.webp)
      # a still becomes a slow camera move (push in, with a slight drift), 300 frames at 48 fps, graded a touch toward green
      ffmpeg -v error -y -framerate 48 -loop 1 -i "$file" -t 6.25 -vf "scale=2688:1512:force_original_aspect_ratio=increase,crop=2688:1512,zoompan=z='1+0.12*on/300':x='iw/2-(iw/zoom/2)+(on-150)*0.35':y='ih/2-(ih/zoom/2)':d=1:s=1344x768:fps=48,colorbalance=gs=0.05:gm=0.03:rm=-0.02,eq=saturation=0.92" -q:v 3 "$LIVE/$name/%04d.jpg" ;;
    *)
      ffmpeg -v error -y -i "$file" -an -vf "minterpolate=fps=48:mi_mode=mci:mc_mode=aobmc:vsbmc=1,scale=1344:768" -q:v 3 "$LIVE/$name/%04d.jpg" ;;
  esac
  echo "$name: $(ls "$LIVE/$name" | wc -l) frames"
done
