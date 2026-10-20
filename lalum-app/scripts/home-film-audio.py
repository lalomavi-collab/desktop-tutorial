# Audio and timing of the home page film (docs/legal-ai-layer/home-film-storyboard.he.md), in one run:
#   1. narration with Kokoro (open model, run locally, synthetic voice, not a clone of anyone)
#   2. timing: paragraphs laid on a bar grid (84 BPM, every scene starts on a downbeat)
#   3. a synthesized score (no third party music) and the final mix, ducked under the voice
# Writes in WORK: narration.json (scene durations, paragraphs, word times, voice level per frame),
# vo.wav, music.wav, mix.wav. The words come from copy already published on the site.
# Needs kokoro.onnx and voices.bin in WORK, plus numpy, scipy, soundfile, kokoro-onnx, ffmpeg.
import json, os, re, subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter
from kokoro_onnx import Kokoro

WORK = os.environ.get("WORK", "/tmp/tts-home")
FPS = 24
SR = 24000
MSR = 48000
BPM = 84
BEAT = 60.0 / BPM
BAR = 4 * BEAT
os.makedirs(WORK, exist_ok=True)
os.chdir(WORK)

VO = {
    "1": ["AI you can defend.", "Because the work moves fast, and someone still has to answer for it."],
    "2": ["AI and law is the axis of the firm: advisory, ongoing accompaniment, and training for organizations adopting artificial intelligence.",
          "From usage policy, to audit, to documentation."],
    "3": ["The engine runs inside your practice.",
          "It audits exposure as the work happens, automates the routine, and keeps a documented trail on every decision.",
          "And it puts the sharp calls back where they belong: with the lawyer."],
    "4": ["That is the Clinic: advisory, ongoing accompaniment, and training.", "Real questions, answered by a person."],
    "5": ["Eight questions. Two minutes. Then we talk.", "Start at lalumapp.com."],
}
LEAD = {"1": 0.9, "2": 1.2, "3": 1.2, "4": 1.2, "5": 1.2}
TAIL = {"1": 1.0, "2": 1.0, "3": 1.2, "4": 1.0, "5": 3.0}
GAP = 0.9
order = list(VO)

# ---- 1. narration
k = Kokoro("kokoro.onnx", "voices.bin")
clips = {}
for n, paras in VO.items():
    clips[n] = []
    for i, p in enumerate(paras):
        a, sr = k.create(p, voice="bm_george", speed=0.95, lang="en-gb")
        assert sr == SR
        nz = np.where(np.abs(a) > 0.003)[0]
        a = a[nz[0]:nz[-1] + 1] if len(nz) else a
        clips[n].append((p, a))

# ---- 2. timing
narr, tracks = {}, {}
for n in order:
    t = LEAD[n]
    segs, audio = [], []
    for i, (text, a) in enumerate(clips[n]):
        dur = len(a) / SR
        words = text.split()
        wts = []
        for w in words:
            wt = len(re.sub(r"\W", "", w)) + 1
            wt += 5 if re.search(r"[.?!]$", w) else (2.5 if re.search(r"[,:;]$", w) else 0)
            wts.append(wt)
        cur, ww = t, []
        for w, wt in zip(words, wts):
            d = dur * wt / sum(wts)
            ww.append({"t": w, "a": round(cur, 3), "b": round(cur + d, 3)})
            cur += d
        segs.append({"text": text, "a": round(t, 3), "b": round(t + dur, 3), "words": ww})
        audio.append((t, a))
        t += dur + GAP
    total = float(np.ceil((t - GAP + TAIL[n]) / BAR - 1e-9) * BAR)
    wav = np.zeros(int(total * SR) + 1, dtype=np.float32)
    for st, a in audio:
        wav[int(st * SR):int(st * SR) + len(a)] = a
    tracks[n] = wav
    hop = SR // FPS
    env = np.array([np.sqrt(np.mean(wav[i:i + hop] ** 2)) for i in range(0, len(wav) - hop, hop)])
    env = np.clip(env / (np.percentile(env, 98) + 1e-9), 0, 1)
    sm = np.convolve(env, np.ones(3) / 3, mode="same")
    narr[n] = {"dur": round(total, 2), "paras": segs, "env": [round(float(x), 3) for x in sm]}
json.dump(narr, open("narration.json", "w"))
sf.write("vo.wav", np.concatenate([tracks[n][:int(narr[n]["dur"] * SR)] if len(tracks[n]) >= int(narr[n]["dur"] * SR)
                                   else np.pad(tracks[n], (0, int(narr[n]["dur"] * SR) - len(tracks[n]))) for n in order]), SR)
off, acc = {}, 0.0
for n in order:
    off[n] = acc
    acc += narr[n]["dur"]
TOTAL = acc
print("scenes", {n: narr[n]["dur"] for n in order}, "total", round(TOTAL, 1))

# ---- 3. score
rng = np.random.default_rng(7)
N = int(TOTAL * MSR) + MSR
buf = np.zeros((2, N))


def lp(x, f, o=2):
    b, a = butter(o, min(f, MSR / 2 - 100) / (MSR / 2), "low")
    return lfilter(b, a, x)


def hp(x, f, o=2):
    b, a = butter(o, f / (MSR / 2), "high")
    return lfilter(b, a, x)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * MSR)
    if i >= N or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(N, i + len(sig))
    s = sig[: j - i] * gain
    buf[0, i:j] += s * (1 - max(0, pan))
    buf[1, i:j] += s * (1 + min(0, pan))


def pad(freq, dur):
    t = np.arange(int(dur * MSR)) / MSR
    y = sum(a * np.sin(2 * np.pi * freq * m * t + p) for m, a, p in ((1, 1, 0), (2, .3, 1.1), (3, .1, 2.3), (.5, .5, .4)))
    return (y + .25 * np.sin(2 * np.pi * freq * 1.003 * t)) * np.minimum(1, t / (dur * .3)) * np.minimum(1, (dur - t) / (dur * .3))


def bell(freq, dur=2.8):
    t = np.arange(int(dur * MSR)) / MSR
    return (np.sin(2 * np.pi * freq * t) + .4 * np.sin(2 * np.pi * freq * 2.76 * t) + .12 * np.sin(2 * np.pi * freq * 5.4 * t)) * np.exp(-t * 2.8) * np.minimum(1, t / .004)


def kick(vol=1.0):
    t = np.arange(int(.5 * MSR)) / MSR
    return np.sin(2 * np.pi * (46 + 44 * np.exp(-t * 20)) * t) * np.exp(-t * 7.5) * vol


def hat():
    t = np.arange(int(.07 * MSR)) / MSR
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 60)


def bass(freq, dur):
    t = np.arange(int(dur * MSR)) / MSR
    return (np.sin(2 * np.pi * freq * t) + .3 * np.sin(2 * np.pi * freq * 2 * t)) * np.exp(-t * 2.2) * np.minimum(1, t / .01)


LEVEL = {"1": 1.0, "2": 2.0, "3": 3.0, "4": 2.0, "5": 1.5}
chords = [[45, 57, 60, 64, 67], [41, 53, 57, 60, 64], [48, 60, 64, 67, 74], [43, 55, 59, 62, 69]]
roots = [45, 41, 48, 43]
for b in range(int(TOTAL / BAR) + 1):
    T = b * BAR
    sc = max((n for n in order if off[n] <= T + 1e-6), key=lambda n: off[n], default="1")
    L = LEVEL[sc]
    ch = (b // 2) % 4
    if b % 2 == 0:
        for m in chords[ch]:
            add(pad(hz(m), 2 * BAR + 3), T - 1.5, .05 * (.6 + .15 * L), pan=rng.uniform(-.4, .4))
    for q in range(4):
        add(kick(.9 if L >= 3 else .6), T + q * BEAT, .15)
    if L >= 1.5:
        for q in (0, 2):
            add(bass(hz(roots[ch]), BEAT * 1.9), T + q * BEAT, .2)
        for q in range(8):
            add(hat(), T + q * BEAT / 2, .05 if q % 2 == 0 else .08, pan=.3)
        for q, p in enumerate([0, 2, 1, 3, 2, 1, 3, 4]):
            add(bell(hz(chords[ch][p % 5] + 12)), T + q * BEAT / 2, .02 + .01 * (L - 1.5), pan=(-.5 + .14 * q))
for n in order[1:]:
    t = np.arange(int(2.2 * MSR)) / MSR
    add(np.sin(2 * np.pi * 50 * t) * np.exp(-t * 2.0) + .5 * lp(rng.standard_normal(len(t)), 420) * np.exp(-t * 9), off[n], .4)
out = np.stack([lp(buf[0], 9500, 3), lp(buf[1], 9500, 3)])
for d, g in ((0.11, .33), (0.23, .2), (0.41, .12)):
    s = int(d * MSR)
    wet = np.zeros_like(out)
    wet[:, s:] = out[:, :-s] * g
    out = out + wet
out = out[:, : int(TOTAL * MSR)]
out = out / (np.abs(out).max() + 1e-9) * .85
f = int(1.5 * MSR)
out[:, :f] *= np.linspace(0, 1, f)
out[:, -f * 2:] *= np.linspace(1, 0, f * 2)
sf.write("music.wav", out.T.astype(np.float32), MSR)

# ---- mix: voice on top, music ducked under it, light loudness normalisation
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "vo.wav", "-i", "music.wav", "-filter_complex",
    "[0]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=70,acompressor=threshold=0.1:ratio=3,asplit=2[v][sc];"
    "[1]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.75[m];[m][sc]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=700[md];"
    "[v][md]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9[o]", "-map", "[o]", "mix.wav"], check=True)
print("mix written", os.path.join(WORK, "mix.wav"))
