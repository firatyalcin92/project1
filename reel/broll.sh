#!/bin/bash
# Renders each B-roll block as its own caption-free clip (with matching audio) into cikti/broll/
set -e
cd "$(dirname "$0")"
i=1
for r in "13.2 31.55 kitap_alinti_resim_muzik" "37.5 47.65 yanlis_sorular" "54.7 74.4 telefon_mesaj_terazi" \
         "85.05 91.4 dort_unsur" "95.75 105.5 iki_daire_sinirlar" "112.9 120.2 sevginin_bedeli_degil" \
         "131.1 150.7 iki_soru_ve_kapanis_cumlesi"; do
  set -- $r
  node render.mjs "cikti/broll/$(printf %02d $i)_$3.mp4" --nocap --from $1 --to $2
  i=$((i+1))
done
