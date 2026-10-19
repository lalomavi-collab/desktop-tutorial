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

**Candidate:** Mata v. Avianca (S.D.N.Y., 22 June 2023). Corpus record: `lalum-app/src/data/rulings.json`, id `mata-avianca`.

**Verification status: NOT VERIFIED. Does not go in the film yet.** The corpus record lists one source (Justia). The project rule requires the decision's own text and a second independent source, agreeing on docket, court, date, bench and outcome. On 19 Oct 2026 this could not be done from this environment (Firecrawl out of credits, Justia and CourtListener blocked by the egress proxy, Descrybe needs re-authentication). Until it is done, the fine amount and every other detail stay out.

**Fallback candidate:** Israeli Supreme Court, בר״ם 37942-05-25 (18 May 2025), id `bram-37942-05-25`. Also to be opened against its own text before use.

**If neither is verified:** the beat is cut. The interview stands without it; the Israeli decision already in scene 5 carries the legal weight.

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
* Verification: Mata v. Avianca against its own text and a second independent source, or choose the Israeli fallback and verify that instead.
* Not done here: any change to the renderer. The scene is specified, not built, because it depends on the recording.
