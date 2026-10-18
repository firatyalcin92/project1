# ASR word timestamps -> corrected words, caption chunks (captions.js) and an SRT file.
import json, re, sys
FIX = {  # (start_time, asr_word) -> corrected ; None merges the token into the previous word
 (25.48,'Tanlık'):'Tanıdık', (31.62,'partileriniz'):'partneriniz', (40.52,'Partileriniz'):'Partneriniz',
 (35.34,'madem'):'“Madem', (38.66,'bekliyorum'):'bekliyorum”', (39.36,'dediniz?'):'dediniz.',
 (42.08,'ya'):'“Ya', (45.50,'yine?'):'yine?”', (51.36,'Benim'):'“Benim', (52.16,'umurumda'):'umurunda', (52.88,'değil'):'değil”',
 (60.22,'Sen'):'“Sen', (63.84,'umurumda'):'umurunda,', (65.06,'ya'):'ya!”', (65.36,'."'):None,
 (67.38,'İşiniz'):'Eşiniz', (71.38,'başladığı'):'başladı', (72.58,'ters'):'tersi', (72.90,'süslü'):'sustu,', (73.82,'telefonla'):'telefona', (74.26,'yönelde.'):'yöneldi,', (75.02,'Başka'):'başka',
 (79.12,'bak'):'“Bak,', (80.64,'gece'):'gecik', (80.84,'kem'):'hem', (82.00,'öyle'):'öyle”', (90.62,'kona'):'konu',
 (102.50,'Pertleniz'):'Partneriniz', (103.72,'yargılanlığını'):'yargılandığını', (111.70,'önemseme'):'önemsemediği', (112.12,'deşeklinde'):'şeklinde',
 (127.98,'Su'):'Sue', (128.08,'-Jansın'):'Johnson', (136.26,'geldi'):'kendi', (139.72,'Partilenizin'):'Partnerinizin',
 (146.38,'uyumlanmadığınızda'):'uyumlanamadığınızda', (157.36,'terapisine'):'terapisinde', (159.06,'o'):'“O', (160.22,'değişsin'):'değişsin”',
 (164.58,'keldi'):'kendi', (181.52,'sen'):'“Sen', (183.12,'isteme'):'istemediğini', (183.44,'deyini'):None, (186.12,'beni.'):'beni.”',
 (187.00,'Diyebilirsiniz.'):'diyebilirsiniz.', (191.50,'sesin'):'“Sesin', (192.44,'kendime'):'kendimi', (193.82,'yalgılanıyor'):'yargılanıyor',
 (197.80,'bırakasın'):'bırakasım', (198.34,'geliyor.'):'geliyor.”', (198.98,'Biyabilir.'):'diyebilir.',
 (208.94,'tarafında'):'tarafın da', (210.46,'derece'):'derecede', (210.80,'daha'):None, (210.96,'tâlı'):'hatalı',
 (229.72,'çifler,'):'çiftler', (232.50,'kes'):'kez',
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
# sentence-level chunks for the full-screen voice scenes (big centred text)
sents, cur = [], []
for x in words:
    if cur and (x['s'] - cur[-1]['e'] > 0.55 or re.search(r'[.?!]”?$', cur[-1]['w'])):
        sents.append(cur); cur = []
    cur.append(x)
sents.append(cur)
def split(c, limit=46):
    if len(' '.join(y['w'] for y in c)) <= limit or len(c) < 2: return [c]
    total = sum(len(y['w']) + 1 for y in c)
    best, bi, acc = None, 1, 0
    for k in range(1, len(c)):          # balanced cut, strongly preferring a comma
        acc += len(c[k - 1]['w']) + 1
        left = ' '.join(y['w'] for y in c[:k])
        score = abs(acc - total / 2) - (25 if c[k - 1]['w'].endswith(',') else 0)
        if left.count('“') > left.count('”') or c[k - 1]['w'] == 'Erich': score += 100   # don't cut inside a quote or a name
        if best is None or score < best: best, bi = score, k
    return split(c[:bi], limit) + split(c[bi:], limit)
big = [part for snt in sents for part in split(snt)]
bigcaps = []
for i, c in enumerate(big):
    end = c[-1]['e'] + 0.6
    if i + 1 < len(big): end = min(end, big[i + 1][0]['s'] - 0.25)
    bigcaps.append({'s': round(c[0]['s'] - 0.25, 2), 'e': round(end, 2), 'w': [[y['w'], y['s']] for y in c]})
open('veri/captions.js', 'w', encoding='utf8').write('window.CAPTIONS = ' + json.dumps(caps, ensure_ascii=False) + ';\n'
    + 'window.CAPTIONS_BIG = ' + json.dumps(bigcaps, ensure_ascii=False) + ';\n')
open('veri/kelimeler.json', 'w', encoding='utf8').write(json.dumps(words, ensure_ascii=False, indent=0))
def ts(t):
    ms = int(round(t * 1000)); return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
with open('altyazi.srt', 'w', encoding='utf8') as f:
    for i, c in enumerate(caps, 1):
        f.write(f"{i}\n{ts(max(c['s'],0))} --> {ts(c['e'])}\n{' '.join(w for w,_ in c['w'])}\n\n")
print(len(words), 'words,', len(caps), 'chunks')
for c in caps: print(c['s'], c['e'], ' '.join(w for w,_ in c['w']))
