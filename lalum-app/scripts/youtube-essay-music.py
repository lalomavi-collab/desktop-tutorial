# Writes WORK/music.wav: an ambient bed and sound design for the YouTube essay, synthesized from
# nothing (no third party music, no licence to track). Pads on a slow progression that opens up
# as the argument builds, sparse bell plucks, a soft pulse in the "layer" and "who signs"
# sections, a riser into every scene and a low hit on every title card.
# The timing comes from WORK/narration.json (scripts/youtube-essay-timing.py).
import json, os
import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter

WORK = os.environ.get("WORK", "/tmp/tts")
SR = 48000
rng = np.random.default_rng(7)
narr = json.load(open(os.path.join(WORK, "narration.json")))
order = ["1", "2", "3", "4", "5", "6"]
off, acc = {}, 0.0
for n in order:
    off[n] = acc
    acc += narr[n]["dur"]
TOTAL = acc
N = int(TOTAL * SR)


def lp(x, f, o=2):
    b, a = butter(o, f / (SR / 2), "low")
    return lfilter(b, a, x)


def hp(x, f, o=2):
    b, a = butter(o, f / (SR / 2), "high")
    return lfilter(b, a, x)


def tone(freq, dur, kind="pad"):
    t = np.arange(int(dur * SR)) / SR
    if kind == "pad":
        y = sum(a * np.sin(2 * np.pi * freq * m * t + p) for m, a, p in ((1, 1, 0), (2, .35, 1.1), (3, .12, 2.3), (0.5, .5, .4)))
        y += 0.25 * np.sin(2 * np.pi * freq * 1.003 * t)  # slight detune for width
        env = np.minimum(1, t / (dur * .35)) * np.minimum(1, (dur - t) / (dur * .35))
        return y * env
    if kind == "bell":
        y = np.sin(2 * np.pi * freq * t) + .4 * np.sin(2 * np.pi * freq * 2.76 * t) + .15 * np.sin(2 * np.pi * freq * 5.4 * t)
        return y * np.exp(-t * 2.6) * np.minimum(1, t / .005)
    raise ValueError(kind)


def add(buf, sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= buf.shape[1] or i + len(sig) <= 0:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    j = min(buf.shape[1], i + len(sig))
    s = sig[: j - i] * gain
    buf[0, i:j] += s * (1 - max(0, pan))
    buf[1, i:j] += s * (1 + min(0, pan))


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# progression: Am9, Fmaj7, Cadd9, G6, each 16 s; brighter as the film goes on
chords = [[45, 57, 60, 64, 67], [41, 53, 57, 60, 64], [48, 60, 64, 67, 74], [43, 55, 59, 62, 69]]
buf = np.zeros((2, N), dtype=np.float64)
t = 0.0
k = 0
while t < TOTAL:
    ch = chords[k % 4]
    openness = min(1.0, t / (TOTAL * .7))
    for m in ch:
        add(buf, tone(hz(m), 20.0, "pad"), t - 2, .05 * (0.55 + .45 * openness), pan=rng.uniform(-.4, .4))
    # sparse bell plucks on chord tones
    for j in range(int(5 + 5 * openness)):
        m = ch[rng.integers(1, len(ch))] + 12 * rng.integers(1, 3)
        add(buf, tone(hz(m), 3.5, "bell"), t + rng.uniform(1, 14), .018 + .012 * openness, pan=rng.uniform(-.6, .6))
    t += 16.0
    k += 1

# soft pulse (a felt kick) in scene 3 and in the closing scene
def pulse(a, b, bpm=54):
    beat = 60.0 / bpm
    x = a
    while x < b:
        tt = np.arange(int(.5 * SR)) / SR
        kick = np.sin(2 * np.pi * (48 + 40 * np.exp(-tt * 18)) * tt) * np.exp(-tt * 7)
        add(buf, kick, x, .16)
        x += beat

pulse(off["3"] + narr["3"]["paras"][4]["a"], off["3"] + narr["3"]["paras"][6]["b"])
pulse(off["6"] + narr["6"]["paras"][2]["a"], off["6"] + narr["6"]["dur"] - 3)

# riser into each scene (ends at the scene start) and a low hit on the title card
for n in order[1:]:
    st = off[n]
    d = 1.8
    nz = rng.standard_normal(int(d * SR))
    sw = lp(nz, 700) * np.linspace(0, 1, len(nz)) ** 2
    sw = hp(sw, 120)
    add(buf, sw, st - d + .15, .10)
    tt = np.arange(int(2.2 * SR)) / SR
    hit = np.sin(2 * np.pi * 52 * tt) * np.exp(-tt * 2.2) + .5 * lp(rng.standard_normal(len(tt)), 400) * np.exp(-tt * 9)
    add(buf, hit, st + .2, .38)
# opening: a single low swell under the date
tt = np.arange(int(4 * SR)) / SR
add(buf, np.sin(2 * np.pi * 55 * tt) * np.minimum(1, tt / 2) * np.exp(-tt * .35), .1, .3)

buf = np.stack([lp(buf[0], 9000, 3), lp(buf[1], 9000, 3)])
# gentle reverb: three feedback-free echoes
for d, g in ((0.11, .35), (0.23, .22), (0.41, .12)):
    s = int(d * SR)
    wet = np.zeros_like(buf)
    wet[:, s:] = buf[:, :-s] * g
    buf = buf + wet
buf = buf / (np.abs(buf).max() + 1e-9) * .85
# fade in and out of the whole bed
f = int(3 * SR)
buf[:, :f] *= np.linspace(0, 1, f)
buf[:, -f * 2:] *= np.linspace(1, 0, f * 2)
sf.write(os.path.join(WORK, "music.wav"), buf.T.astype(np.float32), SR)
print("music", round(TOTAL, 1), "s")
