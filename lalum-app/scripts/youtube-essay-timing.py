# Lays the narration paragraphs on a timeline and writes what the visuals need:
#   WORK/vo-1..6.wav   one narration track per scene (silence between paragraphs)
#   WORK/narration.json  per scene: duration, paragraphs {text, a, b, words[{t,a,b}]}, env[] (voice level per frame)
# Input: WORK/clips.json and WORK/p-<scene>-<para>.wav (one file per paragraph, from the Kokoro run).
# Word times inside a paragraph are spread by letter count with a pause weight after punctuation,
# which is close enough for highlighted captions and for cueing graphics to a phrase.
import json, os, re, sys
import numpy as np
import soundfile as sf

WORK = os.environ.get("WORK", "/tmp/tts")
FPS = int(os.environ.get("FPS", "24"))
SR = 24000
LEAD = {"1": 0.8, "2": 3.6, "3": 2.8, "4": 2.8, "5": 2.8, "6": 2.8}
TAIL = {"1": 2.4, "2": 1.6, "3": 1.8, "4": 1.8, "5": 2.0, "6": 27.0}
BPM = 84
BAR = 4 * 60.0 / BPM
GAP = 1.3
GAPS = {  # extra room after a paragraph, where the picture needs to land
    "1": {1: 1.0, 3: 0.0},
    "2": {1: 2.4, 5: 0.0},
    "3": {0: 1.0, 2: 1.8, 4: 1.6},
    "4": {0: 1.0, 3: 1.6},
    "5": {0: 1.0, 3: 2.0},
    "6": {0: 1.0, 2: 2.0},
}

clips = json.load(open(os.path.join(WORK, "clips.json")))
out = {}
for n, paras in clips.items():
    t = LEAD[n]
    segs = []
    audio = []
    for i, p in enumerate(paras):
        a, sr = sf.read(os.path.join(WORK, f"p-{n}-{i}.wav"))
        assert sr == SR
        dur = len(a) / sr
        words = p["text"].split()
        wts = []
        for w in words:
            wt = len(re.sub(r"\W", "", w)) + 1
            if re.search(r"[.?!]$", w):
                wt += 5
            elif re.search(r"[,:;]$", w):
                wt += 2.5
            wts.append(wt)
        tot = sum(wts)
        cur = t
        ww = []
        for w, wt in zip(words, wts):
            d = dur * wt / tot
            ww.append({"t": w, "a": round(cur, 3), "b": round(cur + d, 3)})
            cur += d
        segs.append({"text": p["text"], "a": round(t, 3), "b": round(t + dur, 3), "words": ww})
        audio.append((t, a))
        t += dur + GAP + GAPS.get(n, {}).get(i, 0.0)
    total = t - GAP - GAPS.get(n, {}).get(len(paras) - 1, 0.0) + TAIL[n]
    total = float(np.ceil(total / BAR - 1e-9) * BAR)  # every scene starts on a downbeat of the music
    wav = np.zeros(int(total * SR) + 1, dtype=np.float32)
    for st, a in audio:
        i = int(st * SR)
        wav[i:i + len(a)] = a
    sf.write(os.path.join(WORK, f"vo-{n}.wav"), wav, SR)
    hop = SR // FPS
    env = np.array([np.sqrt(np.mean(wav[i:i + hop] ** 2)) for i in range(0, len(wav) - hop, hop)])
    env = env / (np.percentile(env, 98) + 1e-9)
    env = np.clip(env, 0, 1)
    sm = np.convolve(env, np.ones(3) / 3, mode="same")
    out[n] = {"dur": round(total, 2), "paras": segs, "env": [round(float(x), 3) for x in sm]}
    print("scene", n, round(total, 1), "s")
json.dump(out, open(os.path.join(WORK, "narration.json"), "w"))
print("total", round(sum(v["dur"] for v in out.values()), 1), "s")
