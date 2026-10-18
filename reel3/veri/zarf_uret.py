# Loudness envelope of the narration, one value per video frame (0..1), drives the voice-scene bars.
import subprocess, numpy as np, json
FPS = 30
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', 'ses_pad.m4a', '-ac', '1', '-ar', '48000', '-f', 's16le', '-'],
                     capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
n = 48000 // FPS
rms = np.sqrt(np.mean(x[: len(x) // n * n].reshape(-1, n) ** 2, axis=1) + 1e-10)
db = 20 * np.log10(rms)
e = np.clip((db + 48) / 34, 0, 1)
e = np.convolve(e, [.25, .5, .25], 'same')          # light smoothing
open('veri/zarf.js', 'w').write(f'window.ZARF_FPS = {FPS};\nwindow.ZARF = {json.dumps([round(float(v), 3) for v in e])};\n')
print(len(e), 'frames')
