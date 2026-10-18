# Synthesises the subtle transition / UI sound effects and mixes them under the narration.
# usage: python3 sfx.py cues.json voice.m4a out.m4a
#   cues.json: [[time_s, "whoosh"|"pop"|"tick"|"ding"|"chime"|"tap"|"rise"|"type", gain_db?], ...]
import json, subprocess, sys
import numpy as np

SR = 48000
rng = np.random.default_rng(7)

def env(n, a, d):  # attack / exponential decay envelope (seconds)
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)

def onepole(x, cut):  # time-varying one-pole low-pass, cut in Hz (array or scalar)
    cut = np.broadcast_to(cut, x.shape)
    a = np.exp(-2 * np.pi * cut / SR)
    y = np.empty_like(x); z = 0.0
    for i in range(len(x)):
        z = (1 - a[i]) * x[i] + a[i] * z; y[i] = z
    return y

def whoosh(dur=.5):
    n = int(SR * dur); t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    cut = 300 + 3200 * np.sin(np.pi * t) ** 2
    lo = onepole(noise, cut); band = lo - onepole(lo, 180)
    shape = np.sin(np.pi * t) ** 1.6
    return band * shape * .9

def pop():
    n = int(SR * .12); t = np.arange(n) / SR
    f = 320 + 650 * np.exp(-t / .018)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .002, .03) * .8

def tick():
    n = int(SR * .03); x = rng.standard_normal(n)
    x = x - onepole(x, 2500)
    return x * env(n, .0005, .006) * .7

def tap():
    n = int(SR * .09); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (140 + 90 * np.exp(-t / .02)) * t) * env(n, .001, .03)
    return (body + .5 * np.pad(tick(), (0, n - len(tick())))) * .8

def bell(freqs, dur, dec):
    n = int(SR * dur); t = np.arange(n) / SR; y = np.zeros(n)
    for f, a in freqs:
        y += a * (np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / (dec * .3)))
    return y * env(n, .004, dec)

def ding():
    a = bell([(1318.5, .5)], .7, .22); b = bell([(1760, .45)], .7, .3)
    out = np.zeros(int(SR * .85)); out[:len(a)] += a; s = int(SR * .09); out[s:s + len(b)] += b
    return out * .55

def chime():
    out = np.zeros(int(SR * 2.2))
    for k, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
        b = bell([(f, .4)], 1.8, .7); s = int(SR * .11 * k); out[s:s + len(b)] += b
    return out * .45

def rise():
    n = int(SR * .35); t = np.arange(n) / SR
    f = 500 * 2 ** (t / .35 * 1.2)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / .35) * .35

def typing(dur=1.0):
    out = np.zeros(int(SR * dur)); t = 0.0
    while t < dur - .05:
        x = tick() * rng.uniform(.5, 1); s = int(t * SR); out[s:s + len(x)] += x; t += rng.uniform(.07, .16)
    return out * .8

GEN = {'whoosh': whoosh, 'pop': pop, 'tick': tick, 'tap': tap, 'ding': ding, 'chime': chime, 'rise': rise, 'type': typing}
LEVEL = {'whoosh': -24, 'pop': -27, 'tick': -30, 'tap': -26, 'ding': -26, 'chime': -24, 'rise': -30, 'type': -32}

def main(cues_path, voice, out):
    cues = json.load(open(cues_path))
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', voice, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    v = np.frombuffer(raw, np.float32).copy()
    fx = np.zeros(len(v) + SR * 3, np.float32)
    cache = {}
    for c in cues:
        t, kind = c[0], c[1]; g = c[2] if len(c) > 2 else 0
        if kind not in cache: x = GEN[kind](); cache[kind] = x / (np.sqrt(np.mean(x ** 2)) + 1e-9)
        x = cache[kind] * 10 ** ((LEVEL[kind] + g) / 20)
        s = int(t * SR); fx[s:s + len(x)] += x[:max(0, len(fx) - s)]
    mix = v + fx[:len(v)]
    peak = np.max(np.abs(mix))
    if peak > .98: mix *= .98 / peak
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-af', 'alimiter=limit=0.89:level=false', '-c:a', 'aac', '-b:a', '192k', out], input=mix.astype(np.float32).tobytes(), check=True)

if __name__ == '__main__':
    main(*sys.argv[1:4])
