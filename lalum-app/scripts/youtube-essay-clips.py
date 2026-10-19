# Cuts three vertical promo clips (1080x1920) out of the finished film. Same narration and music, nothing re-rendered.
# Layout: the 16:9 film in the middle over a blurred copy of itself, a title above, large burned in captions below,
# a fixed corner tag (AI voice, lalumapp.com) on every clip. lalumapp.com is the only address.
# Needs: OUT/final.mp4 and OUT/captions.en.srt (youtube-essay-assemble.sh and youtube-essay-package.py).
# Writes OUT/clips/clip-<name>.mp4. Draft: the owner approves before anything is published.
import os, re, subprocess

OUT = os.environ.get("OUT", "/tmp/lalum-youtube-essay")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
CLIPS = [  # name, start, end (seconds into the film), title
    ("billable-hour", 258.5, 292.8, "THE BILLABLE HOUR"),
    ("accountability", 363.3, 398.0, "THE DUTY STAYS WITH A PERSON"),
    ("who-signs", 424.4, 459.0, "WHO SIGNS?"),
]


def secs(t):
    h, m, s = t.replace(",", ".").split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def stamp(x):
    x = max(0.0, x)
    return "%02d:%02d:%02d,%03d" % (x // 3600, x % 3600 // 60, x % 60, round((x % 1) * 1000) % 1000)


def cues():
    txt = open(os.path.join(OUT, "captions.en.srt"), encoding="utf-8").read().strip()
    for blk in re.split(r"\n\s*\n", txt):
        lines = blk.split("\n")
        a, b = lines[1].split(" --> ")
        yield secs(a), secs(b), " ".join(lines[2:])


def esc(s):
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


os.makedirs(os.path.join(OUT, "clips"), exist_ok=True)
allc = list(cues())
for name, a, b, title in CLIPS:
    srt = os.path.join(OUT, "clips", f"clip-{name}.srt")
    with open(srt, "w", encoding="utf-8") as f:
        n = 0
        for s, e, t in allc:
            if e > a and s < b:
                n += 1
                f.write(f"{n}\n{stamp(max(s, a) - a)} --> {stamp(min(e, b) - a)}\n{t}\n\n")
    d = b - a
    style = "FontName=DejaVu Sans,Bold=1,FontSize=9,PrimaryColour=&H00F5F1E8,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=0,Alignment=2,MarginV=50,MarginL=12,MarginR=12"
    fc = (
        "[0:v]split=2[bg][fg];"
        "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40,eq=brightness=-0.08:saturation=1.3[bgb];"
        "[fg]crop=1920:1000:0:0,scale=1080:-2[fgs];"   # drops the film's own caption strip: one caption only, the large one below
        
        "[bgb][fgs]overlay=0:(H-h)/2-260[v1];"
        f"[v1]drawtext=fontfile={FONT}:text='{esc(title)}':fontcolor=0xe7c27a:fontsize=52:x=(w-text_w)/2:y=330,"
        f"drawtext=fontfile={FONT}:text='AI voice':fontcolor=0xf5f1e8@0.8:fontsize=30:x=60:y=1790,"
        f"drawtext=fontfile={FONT}:text='lalumapp.com':fontcolor=0xf5f1e8@0.8:fontsize=30:x=w-text_w-60:y=1790,"
        f"subtitles={srt}:force_style='{style}',"
        f"fade=t=in:st=0:d=0.5,fade=t=out:st={d-0.6:.2f}:d=0.6[v];"
        f"[0:a]afade=t=in:st=0:d=0.5,afade=t=out:st={d-0.8:.2f}:d=0.8[a]"
    )
    out = os.path.join(OUT, "clips", f"clip-{name}.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(a), "-t", str(d), "-i", os.path.join(OUT, "final.mp4"),
                    "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "23",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], check=True)
    print(name, round(d, 1), "s ->", out)
