# ASR word timestamps -> corrected words, caption chunks (captions.js) and an SRT file.
import json, re, sys
FIX = {  # ASR token index-free corrections: (start_time, wrong) -> right ; None drops the token
 (7.66,'Piscani'):'psikanalist', (8.28,'list'):'Erich', (8.62,'Eikfromm'):"Fromm'un", (9.08,"'un"):None,
 (13.94,'CMS'):'Sevme', (14.30,'Anadolu'):'Sanatı', (19.26,'halde'):'hâlde',
 (37.92,'Froma'):"Fromm'a", (40.88,'adaklanıyor.'):'odaklanıyor.', (43.36,'olurum?'):'olurum?',
 (64.38,'istememe'):'istememek', (64.70,'bekliyorsunuz.'):'diyorsunuz.',
 (77.72,'sevgilinin'):'sevginin', (81.48,'Proma'):"Fromm'a", (83.86,'unsuru'):'unsur',
 (85.36,'İlki'):'İlgi,', (97.98,'bireyi'):'birey', (113.96,'aşağlanmayı'):'aşağılanmayı',
 (113.16,'Şiddeti'):'Şiddeti,', (118.52,'da'):None,
 (123.12,'Hiç'):'Bir', (127.10,'acaba'):'“Acaba', (129.16,'mu'):'mu?”', (133.26,'Beni'):'“Beni',
 (136.26,'partnerim,'):'—partnerim,', (136.74,'eşim.'):'eşim—', (142.68,'muyum?'):'muyum?”',
 (146.84,'aşk'):'aşk', (147.16,'değil'):'değil,', (148.68,'biçim'):'biçimimizdir.', (149.02,'midir?'):None,
 (156.28,'becereme'):'beceri mi?', (157.34,'yorumlarınızı'):'Yorumlarınızı',
 (6.70,'Fakat,'):'Fakat', (46.56,'sorular?'):'sorular.',
 (94.16,'seviyorum'):'seviyorum”', (93.92,'seni'):'“Seni', (128.44,'gerçekten'):'gerçekten',
}
words = []
for line in open('veri/asr_kelimeler.txt', encoding='utf8'):
    m = re.match(r'([\d.]+)-([\d.]+)\s+(.*)', line.strip())
    if not m: continue
    a, b, w = float(m[1]), float(m[2]), m[3].strip()
    key = (a, w)
    if key in FIX:
        if FIX[key] is None:
            words[-1]['e'] = b; continue   # merge time into previous word
        w = FIX[key]
    words.append({'w': w, 's': a, 'e': b})
# hand-fixed casing / spoken line not in ASR
for x in words:
    if x['w'] == 'kitabına' and x['s'] == 14.80: pass

chunks, cur = [], []
def flush():
    global cur
    if cur: chunks.append(cur); cur = []
for i, x in enumerate(words):
    if cur:
        gap = x['s'] - cur[-1]['e']
        text = ' '.join(y['w'] for y in cur + [x])
        if gap > 0.32 or len(text) > 24 or len(cur) >= 4 or re.search(r'[.?!,;:”]$', cur[-1]['w']):
            flush()
    cur.append(x)
flush()
caps = []
for i, c in enumerate(chunks):
    start = c[0]['s'] - 0.08
    end = c[-1]['e'] + 0.45
    if i + 1 < len(chunks): end = min(end, chunks[i + 1][0]['s'] - 0.08)
    caps.append({'s': round(start, 2), 'e': round(end, 2), 'w': [[y['w'], y['s']] for y in c]})
open('veri/captions.js', 'w', encoding='utf8').write('window.CAPTIONS = ' + json.dumps(caps, ensure_ascii=False) + ';\n')
open('veri/kelimeler.json', 'w', encoding='utf8').write(json.dumps(words, ensure_ascii=False, indent=0))
def ts(t):
    ms = int(round(t * 1000)); return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
with open('altyazi.srt', 'w', encoding='utf8') as f:
    for i, c in enumerate(caps, 1):
        f.write(f"{i}\n{ts(max(c['s'],0))} --> {ts(c['e'])}\n{' '.join(w for w,_ in c['w'])}\n\n")
print(len(words), 'words,', len(caps), 'chunks')
for c in caps: print(c['s'], c['e'], ' '.join(w for w,_ in c['w']))
