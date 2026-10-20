# Writes the upload package next to the film: captions (SRT) and the YouTube description with
# chapters, from WORK/narration.json. No dashes as punctuation, sources and the AI narration
# disclosure included. Output folder: OUT (default /tmp/lalum-youtube-essay).
import json, os, re
WORK = os.environ.get("WORK", "/tmp/tts")
OUT = os.environ.get("OUT", "/tmp/lalum-youtube-essay")
narr = json.load(open(os.path.join(WORK, "narration.json")))
order = ["1", "2", "3", "4", "5", "6"]
off, acc = {}, 0.0
for n in order:
    off[n] = acc
    acc += narr[n]["dur"]


def ts(s, sep=","):
    ms = int(round(s * 1000))
    return "%02d:%02d:%02d%s%03d" % (ms // 3600000, ms // 60000 % 60, ms // 1000 % 60, sep, ms % 1000)


cues = []
for n in order:
    for p in narr[n]["paras"]:
        cur = []
        def flush():
            global cur
            if cur:
                cues.append((off[n] + cur[0]["a"], off[n] + cur[-1]["b"], " ".join(w["t"] for w in cur)))
                cur = []
        for w in p["words"]:
            cur.append(w)
            txt = " ".join(x["t"] for x in cur)
            if re.search(r"[.?!:]$", w["t"]) or len(cur) >= 9 or (re.search(r"[,;]$", w["t"]) and len(cur) >= 5) or len(txt) > 52:
                flush()
        flush()
with open(os.path.join(OUT, "captions.en.srt"), "w") as f:
    for i, (a, b, t) in enumerate(cues, 1):
        f.write("%d\n%s --> %s\n%s\n\n" % (i, ts(a), ts(b), t))

names = {"1": "The hook", "2": "Chatbot to agent", "3": "The layer", "4": "The billable hour", "5": "Who answers", "6": "Three questions"}
def mmss(s):
    return "%d:%02d" % (int(s) // 60, int(s) % 60)
chapters = "\n".join("%s %s" % (mmss(off[n]), names[n]) for n in order)
desc = f"""Google just built an AI lawyer's assistant. Who signs?

On 25 August 2026 Google Cloud announced Gemini Enterprise for Legal: agents that, in its words, "complete work rather than return suggestions". This video separates what Google announced from what we infer, and asks the question no product launch answers: who approves, on what basis, and who signs.

Chapters
{chapters}

What is fact and what is our reading
Every statement about the product is Google's own wording and is attributed to Google. Where we interpret, the screen says "Our analysis". We use no figures about time saved or revenue, because we could not trace any to a primary source.

Sources
Google Cloud press release, 25 August 2026: https://www.googlecloudpresscorner.com/2026-08-25-Google-Cloud-Launches-Gemini-Enterprise-for-Legal
Google Cloud blog, "Introducing Gemini Enterprise for Legal", 25 August 2026: https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-for-legal
Reuters, 25 August 2026: https://www.reuters.com/business/google-expands-gemini-ai-platform-law-firms-lawyers-2026-08-25/
Supreme Court of Israel, HCJ 38379-12-24, 23 February 2025 (paragraphs 15 and 26)

Disclosures
The narration of this video is synthetic (AI generated). The on-screen product windows are illustrative mockups, not screens of any real product. LALUM is not affiliated with Google. This video is general information, not legal advice.

LALUM, Dr. Avraham Lalum, Adv.
https://lalumapp.com
"""
open(os.path.join(OUT, "description.txt"), "w").write(desc)
print(len(cues), "caption cues;", mmss(acc), "total")


# Upload kit: metadata and a checklist, so the upload is a copy and paste job.
title = "Google Just Built an AI Lawyer's Assistant. Who Signs?"
tags = ["AI and law", "Gemini Enterprise for Legal", "AI agents", "billable hour", "legal technology", "AI governance",
        "lawyers and AI", "AI accountability", "Google Cloud", "law firm", "LALUM", "legal tech"]
meta = {"title": title, "language": "en", "category": "Education", "tags": tags, "visibility_first": "unlisted",
        "synthetic_content_disclosure": "yes (AI generated narration, synthesized music)", "made_for_kids": False,
        "captions": "captions.en.srt", "thumbnail": "thumbnail.png", "description_file": "description.txt",
        "chapters": {names[n]: mmss(off[n]) for n in order}, "end_screen_from": mmss(acc - 20),
        "pinned_comment": "Three questions that do not move to the machine: who approves, on what basis, and who signs. Does your firm answer them in writing? lalumapp.com"}
json.dump(meta, open(os.path.join(OUT, "upload-metadata.json"), "w"), indent=1)
check = f"""YouTube upload checklist
1. Upload final.mp4 (1080p, 24 fps, H.264 and AAC).
2. Title: {title}
3. Description: paste description.txt (the chapters start at 0:00 and are each longer than 10 seconds).
4. Thumbnail: thumbnail.png.
5. Language English. Captions: upload captions.en.srt.
6. Altered or synthetic content: answer YES (the narration is synthetic; the music is synthesized).
7. Audience: not made for kids. Category: Education. Tags: {", ".join(tags)}.
8. Visibility: Unlisted first, watch it once with sound, then set Public.
9. End screen: the last 20 seconds, from {mmss(acc - 20)} (YouTube allows 5 to 20 seconds; the credits roll).
10. Pin this comment after publishing: {meta["pinned_comment"]}
11. Do not post anywhere else before the owner approves (social posts follow the approval flow in CLAUDE.md).
"""
open(os.path.join(OUT, "UPLOAD-CHECKLIST.txt"), "w").write(check)
print("upload kit written")
