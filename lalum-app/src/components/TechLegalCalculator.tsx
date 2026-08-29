import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import {
  TRACKS, QUESTIONS, MAX_SCORE, bandFor, resultFor, resultPath, shareText,
  type TrackId,
} from "../lib/riskScore";

// Tech-Legal readiness self-assessment.
//
// Styling uses the site's own tokens and classes (--clay, --ink, .btn, .card).
// The draft this replaces was written entirely in Tailwind, which this project
// does not install, so it would have rendered unstyled; several of its classes
// (bg-slate-850) are not real Tailwind values either.
//
// The share opens the prerendered result page rather than the site root. That
// page carries its own Open Graph tags and preview image, which is the only way
// LinkedIn shows a specific card: it reads the shared URL's raw HTML and
// ignores both page JavaScript and the long-deprecated `summary` parameter.

type Step = number | "result";

export function TechLegalCalculator() {
  const [track, setTrack] = useState<TrackId | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [step, setStep] = useState<Step>(-1);
  const [pending, setPending] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const total = QUESTIONS.length + 1;
  // step is -1 on the track picker and 0-based on the questions, so the
  // human-facing counter is step + 2. Using step + 1 showed "step 0 of 4".
  const index = step === "result" ? total : (step as number) + 2;
  const progress = Math.round((index / total) * 100);

  const score = answers.reduce((a, b) => a + b, 0);
  const band = bandFor(score);
  const result = track ? resultFor(track, band) : null;
  const url = track ? `https://lalumapp.com${resultPath(track, band)}/` : "";

  function next() {
    if (step === -1) { if (track) setStep(0); return; }
    if (pending === null) return;
    setAnswers([...answers, pending]);
    setPending(null);
    setStep((step as number) + 1 >= QUESTIONS.length ? "result" : (step as number) + 1);
  }

  function restart() {
    setTrack(null); setAnswers([]); setStep(-1); setPending(null);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  }

  const canAdvance = step === -1 ? track !== null : pending !== null;

  return (
    <div className="riskcalc" aria-label="מבדק מוכנות Tech-Legal">
      <div className="riskcalc-head">
        <p className="eyebrow" style={{ color: "var(--clay)" }}>מבדק מוכנות</p>
        <h3 className="riskcalc-title">כמה הארגון שלכם מוכן, באמת?</h3>
        <p className="riskcalc-sub">
          שלוש שאלות על התנהלות בפועל, לא על החוזה שלכם. שום מסמך לא נשלח ולא נשמר.
        </p>
      </div>

      {step !== "result" ? (
        <div>
          <div className="riskcalc-progress" aria-hidden="true">
            <span className="riskcalc-progress-fill" style={{ inlineSize: `${progress}%` }} />
          </div>
          <p className="riskcalc-step">שלב {index} מתוך {total}</p>

          {step === -1 ? (
            <>
              <h4 className="riskcalc-q">מהו תחום הפעילות המרכזי שלכם?</h4>
              <div className="riskcalc-choices" role="group" aria-label="תחום פעילות">
                {TRACKS.map((t) => (
                  <button key={t.id} type="button" aria-pressed={track === t.id}
                    className={"riskcalc-choice" + (track === t.id ? " on" : "")}
                    onClick={() => setTrack(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h4 className="riskcalc-q">{QUESTIONS[step as number].question}</h4>
              <div className="riskcalc-choices" role="group" aria-label={QUESTIONS[step as number].question}>
                {QUESTIONS[step as number].choices.map((c) => (
                  <button key={c.text} type="button" aria-pressed={pending === c.points}
                    className={"riskcalc-choice" + (pending === c.points ? " on" : "")}
                    onClick={() => setPending(c.points)}>
                    {c.text}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="riskcalc-foot">
            <button type="button" className="btn btn-clay" disabled={!canAdvance} onClick={next}>
              {step === QUESTIONS.length - 1 ? "לתוצאה" : "המשך"}
            </button>
          </div>
        </div>
      ) : (
        <div className="riskcalc-result" aria-live="polite">
          <p className="eyebrow" style={{ color: "var(--clay)" }}>התוצאה שלכם</p>
          <div className={"riskcalc-badge tone-" + result!.tone}>{result!.title}</div>
          <p className="riskcalc-score">{score} מתוך {MAX_SCORE} נקודות חשיפה</p>
          <p className="riskcalc-body">{result!.body}</p>
          <p className="riskcalc-next"><strong>הצעד הבא:</strong> {result!.next}</p>

          <div className="riskcalc-actions">
            <a className="btn btn-linkedin"
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
              target="_blank" rel="noopener noreferrer"
              onClick={() => { void copyLink(); }}>
              <Icon name="share" size={16} /> שיתוף התוצאה בלינקדאין
            </a>
            <Link to="/book" className="btn btn-clay">
              <Icon name="calendar" size={16} /> לתיאום פגישת אבחון
            </Link>
            <button type="button" className="btn btn-ghost" onClick={restart}>מבדק מחדש</button>
          </div>
          {/* LinkedIn composes its post from the shared page, so the wording is
              copied for the person to paste as their own comment. */}
          {copied && <p className="riskcalc-copied" role="status">הקישור הועתק. אפשר להוסיף בפוסט: {shareText(track!, band, score)}</p>}

          <p className="riskcalc-disclaimer">
            המבדק כללי ומבוסס על תיאור עצמי. הוא אינו ביקורת משפטית, אינו חוות דעת ואינו תחליף לבדיקה פרטנית.
          </p>
        </div>
      )}
    </div>
  );
}
