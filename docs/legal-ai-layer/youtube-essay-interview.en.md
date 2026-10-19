# YouTube video essay: interview scene and founder cameo

**Status:** DRAFT for owner review. Nothing here is published. The owner's answers are not written here: the questions and prompts are, the words are his.
**Film:** "Google Just Built an AI Lawyer's Assistant. Who Signs?" Placement: between scene 5 (the liability question) and scene 6 (the three questions). Runtime 60 to 75 seconds.

## 1. Format

* Interviewee: Dr. Avraham Lalum, Adv. (the owner). Interviewer: a synthetic voice, disclosed in the credits ("Interviewer voice: synthetic"). No real third party appears, so no third party consent is needed.
* Look: the same dark world as the film. The interviewer is an audio waveform on the left. The owner is a framed portrait panel on the right, with a lower third (name in the canonical English form, no title beyond it). English subtitles under both.
* Sound: the owner's own recording, mixed over the score at the same loudness as the narration. The score thins to the heartbeat bed used in scene 5.
* Audio source for the owner: a fresh English recording (preferred), see section 5. Fallback: the existing site clip, see section 4.

## 2. The three questions (interviewer, synthetic voice)

Short, plain, no claim of fact inside them.

1. "When the tool gets it wrong, who signs?"
2. "What does your own check look like before something leaves the office?"
3. "What do you never hand to the tool?"

**Prompts for the owner (points to cover in his own words, about 20 seconds each):**

1. The signature is the lawyer's. The tool changes who types, not who answers. Tie to the Israeli Supreme Court text already in scene 5 (HCJ 38379-12-24, paras 26 and 15), which the film quotes on screen.
2. His actual practice: what he opens at the source, what a second reader sees, what is logged. Only what he really does. No figures on time or cost.
3. His red lines: judgment on strategy, client confidences, anything he cannot trace to a source.

Do not read this as a script. A rehearsed answer reads as a pitch. Record in two or three takes and keep the one that sounds like him.

## 3. Court decision slot (optional beat, 10 to 12 seconds, between questions 1 and 2)

The interviewer adds one sentence of context, with the case card on screen.

**Decision chosen (owner, 19 Oct 2026):** Israeli Supreme Court, בר״ם 37942-05-25, Ehrlich v. the Israel National Academy of Sciences and the Attorney General. Corpus record: `lalum-app/src/data/rulings.json`, id `bram-37942-05-25`. It replaces Mata v. Avianca, which could not be verified from this environment.

**Verification status, 19 Oct 2026:**
* Source 1, the decision itself, READ IN FULL (3 pages, PDF copy hosted at websitedc.s3.amazonaws.com, the link in the corpus record). Confirmed from the text: Supreme Court; Deputy President Noam Sohlberg sitting alone; applicant Avraham Ehrlich (unrepresented) against the Academy and the Attorney General; leave to appeal against the Jerusalem District Court (administrative matters) decision of 12.5.2025 in עת״מ 19546-05-25 (Judge A. Sela); decision dated 18 May 2025 (כ׳ אייר תשפ״ה); the application was dismissed, on the merits first (restraint in reviewing academic and professional decisions, including who speaks at a conference) and also on the AI point; costs of NIS 500 to the State Treasury, "on the low side", in view of the applicant being unrepresented. The quote in the corpus matches the text word for word (the decision uses dashes around "שאינם עניין טכני" and "אכן קיימים"; on screen use commas or parentheses, never dashes).
* Source 2, an independent one: NOT FOUND. The corpus lists law.co.il, which the egress proxy blocks here. Web searches did not surface a second report of this decision. The PDF is a copy hosted by a third party, not the court's own site, so it counts as one instrument, not two sources.
* Not to be confused with the other 2025 Israeli decision a law firm summary describes with a NIS 5,000 order against an unrepresented litigant. A different matter, not verified here.

**Rule applied:** the project requires two independent sources. One is read in full; the second is missing, so the beat stays out of the film until the owner or a session with access opens the law.co.il entry or the court's own publication and the two agree on docket, court, date, bench and outcome. What may be said once that is done: the three facts above, the NIS 500 order, and the quote. Not to be said: that disclosing AI use cures the defect (the decision says the opposite), and nothing about the lower court beyond its docket number.

**If the second source is not obtained:** the beat is cut. The interview stands without it; the Israeli decision already in scene 5 (HCJ 38379-12-24, which this decision itself cites at paras 12 to 13 and 26) carries the legal weight.

## 4. Cameo from the site clip (fallback audio, and the scene 6 call to action)

Asset: `lalum-app/public/media/lalum-intro.mp4`. A real portrait video of the owner, 540x960, 25 fps, 15 seconds, Hebrew, with the transcript in `lalum-intro.he.vtt`. It is about contract exposure and the readiness quiz, not about AI accountability, so it fits the closing call to action (`/risk`), not the interview.

Use: a vertical panel inside the 16:9 frame, original audio kept low under the score, English subtitles below. Proposed subtitles (translation is mine, **owner to approve**):

1. "Most organizations do not know where they are exposed."
2. "Usually it is not the complicated clause in the contract."
3. "It is the simple thing nobody documented."
4. "Eight questions, two minutes, and then we talk."

The 46 second voice note on the site (`lalum-voice.m4a`) has no transcript in the repository. It is not used until the owner supplies the text.

## 5. Recording spec for the owner

* Language: English.
* Frame: horizontal 1920x1080, camera at eye height, soft window light from the side, plain background. The site clip is the reference for look.
* Audio: the best microphone available, a quiet room, 48 kHz WAV or the phone's original file. No noise filter on the phone.
* Deliver: the three answers as separate takes, plus 10 seconds of room tone.
* The interviewer questions play to the owner during recording only as a guide. The film uses its own synthetic interviewer track, so the owner does not need to wait between questions.

## 6. Production steps once the recording arrives

1. Add the interviewer lines to the voice run (Kokoro, same voice family as the narration, a distinct voice from it).
2. Add an interview scene to `youtube-essay-visuals.mjs` as scene `5b`: waveform panel, portrait panel, lower third, subtitles. The bar grid stays (84 BPM, the scene starts on a downbeat).
3. Add the cameo panel to scene 6 at its call to action.
4. Re-time the film (`youtube-essay-timing.py`), re-render, re-assemble, re-check, then PR and merge.
5. Credits: add "Interviewer voice: synthetic" beside the existing narration disclosure. Subtitle translation of the cameo is noted as "English subtitles by LALUM".

## 7. Open items

* Owner: approve the cameo subtitle translation.
* Owner: record the three answers (section 5).
* Verification: second independent source for בר״ם 37942-05-25 (law.co.il entry or the court's own publication). Section 3.
* Not done here: any change to the renderer. The scene is specified, not built, because it depends on the recording.
