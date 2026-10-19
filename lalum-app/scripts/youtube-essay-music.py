# Writes WORK/music.wav: the score and sound design of the YouTube essay, synthesized from nothing
# (no third party music). 84 BPM, every scene starts on a downbeat, the arrangement builds by scene:
#   1 hook        low breath, a felt pulse enters with the third paragraph
#   2 agents      pulse, bass line, pad
#   3 the layer   full: kick, claps, hats, bass, bell arpeggios, a deep hit on "Trojan horse"
#   4 the hour    tension: pad, heartbeat
#   5 who answers minimal: sparse bells and a slow heartbeat
#   6 questions   builds back up, resolves for the credits
# A riser leads into each scene (two bars) and a low hit lands on its downbeat.
# The timing comes from WORK/narration.json (scripts/youtube-essay-timing.py).
import json, os
import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter

WORK = os.environ.get("WORK", "/tmp/tts")
SR = 48000
BPM = 84
BEAT = 60.0 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)
narr = json.load(open(os.path.join(WORK, "narration.json")))
order = ["1", "2", "3", "4", "5", "6"]
off, acc = {}, 0.0
for n in order:
    off[n] = acc
    acc += narr[n]["dur"]
TOTAL = acc
N = int(TOTAL * SR) + SR
buf = np.zeros((2, N))


def lp(x, f, o=2):
    b, a = butter(o, min(f, SR / 2 - 100) / (SR / 2), "low")
    return lfilter(b, a, x)


def hp(x, f, o=2):
    b, a = butter(o, f / (SR / 2), "high")
    return lfilter(b, a, x)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N or i + len(sig) <= 0:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    j = min(N, i + len(sig))
    s = sig[: j - i] * gain
    buf[0, i:j] += s * (1 - max(0, pan))
    buf[1, i:j] += s * (1 + min(0, pan))


def pad(freq, dur):
    t = np.arange(int(dur * SR)) / SR
    y = sum(a * np.sin(2 * np.pi * freq * m * t + p) for m, a, p in ((1, 1, 0), (2, .3, 1.1), (3, .1, 2.3), (.5, .5, .4)))
    y += .25 * np.sin(2 * np.pi * freq * 1.003 * t)
    return y * np.minimum(1, t / (dur * .3)) * np.minimum(1, (dur - t) / (dur * .3))


def bell(freq, dur=2.8):
    t = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * freq * t) + .4 * np.sin(2 * np.pi * freq * 2.76 * t) + .12 * np.sin(2 * np.pi * freq * 5.4 * t)) * np.exp(-t * 2.8) * np.minimum(1, t / .004)


def kick(vol=1.0):
    t = np.arange(int(.5 * SR)) / SR
    return np.sin(2 * np.pi * (46 + 44 * np.exp(-t * 20)) * t) * np.exp(-t * 7.5) * vol


def hat():
    t = np.arange(int(.07 * SR)) / SR
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 60)


def clap():
    t = np.arange(int(.22 * SR)) / SR
    x = hp(lp(rng.standard_normal(len(t)), 3800), 900) * (np.exp(-t * 28) + .6 * np.exp(-np.maximum(t - .018, 0) * 30) * (t > .018))
    return x


def bass(freq, dur):
    t = np.arange(int(dur * SR)) / SR
    y = np.sin(2 * np.pi * freq * t) + .3 * np.sin(2 * np.pi * freq * 2 * t)
    return y * np.exp(-t * 2.2) * np.minimum(1, t / .01)


def level(T):
    for n in order:
        if off[n] <= T < off[n] + narr[n]["dur"] + 1e-6:
            lt = T - off[n]
            ps = narr[n]["paras"]
            if n == "1":
                return .5 if lt < ps[2]["a"] else 1.0
            if n == "2":
                return 2.0
            if n == "3":
                return 3.0
            if n == "4":
                return 1.2
            if n == "5":
                return .6
            if n == "6":
                tc = ps[4]["b"] + 3.4
                return 2.0 if lt < ps[1]["a"] else (3.0 if lt < tc else 2.0)
    return 1.0


chords = [[45, 57, 60, 64, 67], [41, 53, 57, 60, 64], [48, 60, 64, 67, 74], [43, 55, 59, 62, 69]]
roots = [45, 41, 48, 43]
nbar = int(TOTAL / BAR) + 1
for b in range(nbar):
    T = b * BAR
    L = level(T)
    ch = (b // 4) % 4
    # pad: one chord per four bars, brighter with the level
    if b % 4 == 0:
        for m in chords[ch]:
            add(pad(hz(m), 4 * BAR + 3), T - 1.5, .05 * (.6 + .15 * L), pan=rng.uniform(-.4, .4))
    # pulse
    if L >= 1.0:
        for k in range(4):
            add(kick(.9 if L >= 3 else .65), T + k * BEAT, .16)
    elif L >= .5:
        add(kick(.55), T, .12)
        if L < .9:
            add(kick(.4), T + BEAT * 1.0 * .75, .08)   # the second thump of a heartbeat
    # bass
    if L >= 1.5:
        for k in (0, 2):
            add(bass(hz(roots[ch]), BEAT * 1.9), T + k * BEAT, .22)
    # hats on the off beats, claps on two and four
    if L >= 2:
        for k in range(8):
            add(hat(), T + k * BEAT / 2 + (BEAT / 2 if k % 2 else 0) * 0, .05 if k % 2 == 0 else .09, pan=.3)
    if L >= 3:
        for k in (1, 3):
            add(clap(), T + k * BEAT, .1)
    # bell arpeggio
    if L >= 2:
        pat = [0, 2, 1, 3, 2, 1, 3, 4]
        for k, q in enumerate(pat):
            m = chords[ch][q % len(chords[ch])] + 12
            add(bell(hz(m)), T + k * BEAT / 2, .02 + .01 * (L - 2), pan=(-.5 + .14 * k))
    elif L < 1.0 and b % 2 == 0:
        m = chords[ch][rng.integers(1, len(chords[ch]))] + 12
        add(bell(hz(m), 3.5), T + rng.uniform(0, BAR), .02, pan=rng.uniform(-.5, .5))

# a riser into every scene and a low hit on its downbeat
for n in order[1:]:
    st = off[n]
    d = 2 * BAR
    nz = rng.standard_normal(int(d * SR))
    sw = hp(lp(nz, 900), 150) * np.linspace(0, 1, len(nz)) ** 2
    add(sw, st - d, .13)
    t = np.arange(int(2.4 * SR)) / SR
    hit = np.sin(2 * np.pi * 50 * t) * np.exp(-t * 2.0) + .5 * lp(rng.standard_normal(len(t)), 420) * np.exp(-t * 9)
    add(hit, st, .42)
# the "Trojan horse" beat in scene 3
ps3 = narr["3"]["paras"][4]
t = np.arange(int(2.0 * SR)) / SR
add(np.sin(2 * np.pi * 44 * t) * np.exp(-t * 1.6), off["3"] + ps3["a"] + 1.2, .5)
# a low swell under the date
t = np.arange(int(5 * SR)) / SR
add(np.sin(2 * np.pi * 55 * t) * np.minimum(1, t / 2.5) * np.exp(-t * .3), .1, .32)

out = np.stack([lp(buf[0], 9500, 3), lp(buf[1], 9500, 3)])
for d, g in ((0.11, .33), (0.23, .2), (0.41, .12)):
    s = int(d * SR)
    wet = np.zeros_like(out)
    wet[:, s:] = out[:, :-s] * g
    out = out + wet
out = out[:, : int(TOTAL * SR)]
out = out / (np.abs(out).max() + 1e-9) * .85
f = int(3 * SR)
out[:, :f] *= np.linspace(0, 1, f)
out[:, -f * 2:] *= np.linspace(1, 0, f * 2)
sf.write(os.path.join(WORK, "music.wav"), out.T.astype(np.float32), SR)
print("music", round(TOTAL, 1), "s,", nbar, "bars at", BPM, "bpm")
