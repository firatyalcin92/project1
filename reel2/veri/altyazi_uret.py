# ASR word timestamps -> corrected words, caption chunks (captions.js) and an SRT file.
import json, re, sys
FIX = {  # (start_time, asr_word) -> corrected ; None merges the token into the previous word
 (1.22,'Sen'):'Sende', (1.40,'de'):None, (4.22,'ses'):'sessizleştin', (4.44,'izleştin'):None,
 (4.80,'bir'):'birkaç', (5.04,'kaç'):None, (5.16,'gündür?'):'gündür.”', (17.04,'zarafa'):'tarafa',
 (28.18,'partileriniz'):'partneriniz', (39.30,'partileriniz'):'partneriniz', (125.94,'Partileriniz'):'Partneriniz',
 (37.26,'işinizi'):'eşinize', (43.20,'şey'):'şeyle', (43.42,'de'):None, (52.06,'kafasında'):'kafasının', (52.56,'doğru'):'dolu',
 (64.20,'neyi'):'neye', (64.46,'özüldüğünüzü,'):'üzüldüğünüzü,', (65.86,'Neyi'):'neye',
 (73.86,'arkar'):'arka', (74.12,'kayıserken'):'arkaya izlerken',
 (90.38,'Üniversitesi'):"Üniversitesi'nde", (90.90,"'nde"):None, (91.06,'psikolojik'):'psikoloji',
 (92.54,'Cangatman'):'John', (93.06,"'ın"):"Gottman'ın", (107.58,'gibi.'):'gibi…', (107.02,'göstermek'):'göstermek',
 (129.82,'anlamıya'):'anlamayabilir,', (130.18,'bilir,'):None, (131.18,'anlamlandıramıya'):'anlamlandıramayabilir.', (131.94,'bilir.'):None,
 (168.14,'anda'):'şu anda', (82.76,'önemsenmiyorum'):'“önemsenmiyorum”',
 (135.24,'Son'):'“Son', (137.34,'var.'):'var.”', (140.00,'birbirimizden'):'“Birbirimizden', (141.64,'sanki.'):'sanki.”',
 (165.28,'Bu'):'“Bu', (172.10,'mu?'):'mu?”', (172.84,'Gibi'):'gibi', (169.90,'Bitireyim'):'Bitireyim,',
 (1.22,'Sen'):'“Sende', (2.60,'aralar.'):'aralar.”', (3.92,'Sen'):'“Sen', (6.70,'Evde'):'“Evde', (10.58,'resmen.'):'resmen.”',
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
