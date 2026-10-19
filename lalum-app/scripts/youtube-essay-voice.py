# Synthesizes the English narration of docs/legal-ai-layer/youtube-essay-script.en.md with Kokoro (open model, run locally, no cloned voice).
# Needs: pip install kokoro-onnx soundfile; model files kokoro.onnx and voices.bin (kokoro-onnx release model-files-v1.0) in the working folder; vo.json = {scene: [paragraphs]} taken from the VO blocks.
# Paragraphs are spread across each scene length; align them to the beats by hand in the edit.
import json,sys,soundfile as sf,numpy as np
from kokoro_onnx import Kokoro
k=Kokoro("kokoro.onnx","voices.bin")
vo=json.load(open("vo.json"))
DUR={"1":50,"2":100,"3":120,"4":120,"5":90,"6":60}
SR=24000
for n,paras in vo.items():
    clips=[]
    for p in paras:
        a,sr=k.create(p,voice="bm_george",speed=0.95,lang="en-gb")
        assert sr==SR
        clips.append(a)
    tot=sum(len(c) for c in clips)/SR
    d=DUR[n]; lead=1.5; tail=1.5
    gap=max(0.8,(d-lead-tail-tot)/max(1,len(clips)-1))
    if tot+lead+tail>d: print("scene",n,"VO too long",tot,d)
    out=np.zeros(int(d*SR),dtype=np.float32);pos=lead
    for c in clips:
        i=int(pos*SR);end=min(len(out),i+len(c));out[i:end]=c[:end-i]
        pos+=len(c)/SR+gap
    sf.write(f"vo-{n}.wav",out,SR)
    print("scene",n,"vo",round(tot,1),"s of",d,"gap",round(gap,1))
