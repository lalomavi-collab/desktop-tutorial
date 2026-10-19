# Synthesizes the three interviewer questions of the interview scene (docs/legal-ai-layer/youtube-essay-interview.en.md)
# with Kokoro, in a voice distinct from the narrator. Writes WORK/q-1..3.wav and WORK/interviewer.json (durations).
# Synthetic voice, disclosed in the credits. Needs the same model files as youtube-essay-voice.py in WORK.
import json, os
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

WORK = os.environ.get("WORK", "/tmp/tts")
os.chdir(WORK)
QUESTIONS = [
    "When the tool gets it wrong, who signs?",
    "What does your own check look like before something leaves the office?",
    "What do you never hand to the tool?",
]
k = Kokoro("kokoro.onnx", "voices.bin")
meta = []
for i, q in enumerate(QUESTIONS, 1):
    a, sr = k.create(q, voice="af_nicole", speed=0.97, lang="en-us")
    nz = np.where(np.abs(a) > 0.003)[0]
    a = a[nz[0]:nz[-1] + 1] if len(nz) else a
    sf.write(f"q-{i}.wav", a, sr)
    meta.append({"text": q, "dur": round(len(a) / sr, 3)})
json.dump(meta, open("interviewer.json", "w"), indent=1)
print(meta)
