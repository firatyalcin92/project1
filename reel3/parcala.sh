#!/bin/bash
# Renders the reel as two Instagram parts: Part 1 (+"Devamı Part 2'de" card) and Part 2 (intro card + rest).
set -e
cd "$(dirname "$0")"
T=cikti/tmp; mkdir -p $T
node render.mjs $T/p1.mp4 --from 0 --to 152.6
node render.mjs $T/p2.mp4 --from 152.6 --to 262
node render.mjs $T/k1.mp4 --page kart1.html --audio kart1_ses.m4a
node render.mjs $T/k2.mp4 --page kart2.html --audio kart2_ses.m4a
join() { ffmpeg -loglevel error -y -i "$1" -i "$2" -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$3"; }
join $T/p1.mp4 $T/k1.mp4 cikti/reel_part1.mp4
join $T/k2.mp4 $T/p2.mp4 cikti/reel_part2.mp4
rm -rf $T
