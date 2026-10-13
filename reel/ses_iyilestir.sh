#!/bin/bash
# Voice cleanup: rumble cut, RNNoise denoise, de-mud/presence EQ, de-ess, gentle compression, 2-pass loudness to -14 LUFS.
set -e
cd "$(dirname "$0")"
IN=${1:-ses.m4a}; OUT=${2:-ses_iyilestirilmis.m4a}
CHAIN="highpass=f=80:p=2,arnndn=m=veri/std.rnnn:mix=0.9,\
equalizer=f=220:t=q:w=1.0:g=-2.5,equalizer=f=3200:t=q:w=1.2:g=2.5,highshelf=f=9000:g=1.5,\
deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=-21dB:ratio=3:attack=6:release=90:makeup=2"
M=$(ffmpeg -hide_banner -i "$IN" -af "$CHAIN,loudnorm=I=-14:TP=-1.0:LRA=7:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$M" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -hide_banner -loglevel error -y -i "$IN" -af "$CHAIN,loudnorm=I=-14:TP=-1.0:LRA=7:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" \
  -c:a aac -b:a 192k "$OUT"
