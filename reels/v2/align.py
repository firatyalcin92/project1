# Metni (hece sayısıyla) sesteki konuşma bölümlerine dinamik programlama ile hizalar.
import json, re, subprocess, sys
audio, script = sys.argv[1], sys.argv[2]
# Çapa: "kelime@saniye" → o kelime bu zamanda başlayan bölüme sabitlenir (ör. 7-8@18.15)
anchors = [(a.split('@')[0], float(a.split('@')[1])) for a in sys.argv[3:]]
log = subprocess.run(['ffmpeg', '-i', audio, '-af', 'silencedetect=noise=-30dB:d=0.12', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audio],
                           capture_output=True, text=True).stdout)
sil = list(zip(st, en))
segs, cur = [], 0.0
for s, e in sil:
    if s - cur > 0.15: segs.append((cur, s))
    cur = e
if dur - cur > 0.15: segs.append((cur, dur))

SPOKEN = {'7-8': 4, '10-15': 3, '9-10': 3, '15-20': 4, '11-12': 5, '20-30': 4, 'MOXO': 2, '3': 1}
words = open(script).read().split()
def syl(w):
    core = re.sub(r'[^\w-]', '', w)
    return SPOKEN.get(core) or max(1, len(re.findall(r'[aeıioöuüAEIİOÖUÜ]', w)))
sy = [syl(w) for w in words]
punct = [1.0 if re.search(r'[,.:?!”"]$', w) else 0.0 for w in words]
rate = sum(sy) / sum(e - s for s, e in segs)
def align(segs, words, sy, punct, pre_rate):
    rate = pre_rate
    N, M = len(segs), len(words)
    INF = 1e18
    dp = [[INF] * (M + 1) for _ in range(N + 1)]; bk = [[0] * (M + 1) for _ in range(N + 1)]
    dp[0][0] = 0
    pre = [0]
    for v in sy: pre.append(pre[-1] + v)
    for i in range(1, N + 1):
        d = segs[i - 1][1] - segs[i - 1][0]
        for j in range(1, M + 1):
            for k in range(max(0, j - 14), j):
                if dp[i - 1][k] >= INF: continue
                r = (pre[j] - pre[k]) / d
                c = ((r - rate) / rate) ** 2 * (d + 0.5) * 4 + (0 if punct[j - 1] or j == M else 0.6 * (0.4 if d < 1.0 else 1))
                if dp[i - 1][k] + c < dp[i][j]: dp[i][j] = dp[i - 1][k] + c; bk[i][j] = k
    out, j = [], M
    for i in range(N, 0, -1):
        k = bk[i][j]; s, e = segs[i - 1]; tot = pre[j] - pre[k]; acc = s
        seg_words = []
        for w in range(k, j):
            d = (e - s) * sy[w] / tot
            seg_words.append([round(acc, 2), round(acc + d, 2), words[w]]); acc += d
        out = seg_words + out; j = k
    return out

cuts = [0]; seg_cuts = [0]
for w, t in anchors:
    cuts.append(words.index(w)); seg_cuts.append(min(i for i, (a, b) in enumerate(segs) if a >= t - 0.05))
cuts.append(len(words)); seg_cuts.append(len(segs))
out = []
for i in range(len(cuts) - 1):
    a, b, c, d = cuts[i], cuts[i + 1], seg_cuts[i], seg_cuts[i + 1]
    out += align(segs[c:d], words[a:b], sy[a:b], punct[a:b], rate)
json.dump(out, open('words.json', 'w'), ensure_ascii=False)
for i, (s, e) in enumerate(segs): pass
line, last = [], None
for s, e, w in out:
    print(f'{s:6.2f} {w}')
