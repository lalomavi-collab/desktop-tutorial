import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import {
  TRACKS, MAX_SCORE, QUESTIONS_PER_TRACK, bandFor, questionsFor, resultFor, resultPath, shareText, topGap,
  type TrackId,
} from "../lib/riskScore";

// Tech-Legal readiness self-assessment.
//
// Styling uses the site's own tokens and classes (--clay, --ink, .btn, .card).
// Choices advance on tap (no separate "continue" click), with a Back control so
// a mis-tap costs nothing. The result shows an exposure gauge (a live "danger
// meter" pointing at the visitor's own score) and a conversion block that opens
// the booking page pre-filled with what they just told us.
//
// The share opens the prerendered result page rather than the site root. That
// page carries its own Open Graph tags and preview image, which is the only way
// LinkedIn shows a specific card: it reads the shared URL's raw HTML and
// ignores both page JavaScript and the long-deprecated `summary` parameter.

type Step = number | "result";

// Semicircular exposure gauge. The needle points at the visitor's score on the
// 0 to MAX_SCORE scale, over three coloured bands (green, amber, red) whose
// widths match the scoring thresholds, so the picture matches the number.
function ExposureGauge({ score, title, tone }: { score: number; title: string; tone: "ok" | "warn" | "risk" }) {
  const cx = 100, cy = 100, r = 82;
  const pt = (theta: number) => {
    const a = (theta * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };
  // Top semicircle: score fraction 0 sits at 180 degrees (left), 1 at 0 (right).
  const arc = (thetaStart: number, thetaEnd: number) => {
    const [x1, y1] = pt(thetaStart);
    const [x2, y2] = pt(thetaEnd);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const thetaFor = (v: number) => 180 * (1 - v / MAX_SCORE);
  const lowEnd = 6, medEnd = 14; // mirror bandFor thresholds
  const needle = thetaFor(Math.max(0, Math.min(MAX_SCORE, score)));
  const [nx, ny] = pt(needle);
  const nInner = 0.2, ni = [cx + r * nInner * Math.cos((needle * Math.PI) / 180), cy - r * nInner * Math.sin((needle * Math.PI) / 180)];
  const needleColor = tone === "ok" ? "#2f6f4f" : tone === "warn" ? "#a9791f" : "#800020";
  return (
    <div className="riskcalc-gauge">
      <svg viewBox="0 0 200 118" width="100%" height="auto" role="img" aria-label={`רמת חשיפה: ${title}, ${score} מתוך ${MAX_SCORE}`}>
        <path d={arc(180, thetaFor(lowEnd))} fill="none" stroke="#3f9d5a" strokeWidth={15} strokeLinecap="round" />
        <path d={arc(thetaFor(lowEnd), thetaFor(medEnd))} fill="none" stroke="#d79a2b" strokeWidth={15} />
        <path d={arc(thetaFor(medEnd), 0)} fill="none" stroke="#c0503a" strokeWidth={15} strokeLinecap="round" />
        <line x1={ni[0].toFixed(2)} y1={ni[1].toFixed(2)} x2={nx.toFixed(2)} y2={ny.toFixed(2)} stroke={needleColor} strokeWidth={3.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill={needleColor} />
      </svg>
      <div className="riskcalc-gauge-read">
        <span className="riskcalc-gauge-score" style={{ color: needleColor }}>{score}<span className="riskcalc-gauge-max"> / {MAX_SCORE}</span></span>
        <span className="riskcalc-gauge-label">נקודות חשיפה</span>
      </div>
    </div>
  );
}

export function TechLegalCalculator() {
  const [track, setTrack] = useState<TrackId | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [step, setStep] = useState<Step>(-1);
  const [copied, setCopied] = useState(false);

  const questions = track ? questionsFor(track) : [];
  const total = QUESTIONS_PER_TRACK + 1;
  // step is -1 on the track picker and 0-based on the questions, so the
  // human-facing counter is step + 2. Using step + 1 showed "step 0 of 4".
  const index = step === "result" ? total : (step as number) + 2;
  const progress = Math.round((index / total) * 100);

  const answered = answers.filter((a): a is number => a !== null);
  const score = answered.reduce((a, b) => a + b, 0);
  const band = bandFor(score);
  const result = track ? resultFor(track, band) : null;
  const gap = track ? topGap(track, answered) : null;
  const url = track ? `https://lalumapp.com${resultPath(track, band)}/` : "";
  // The booking page reads these and opens with what the visitor already told
  // us, so the meeting does not start from a blank page.
  const bookHref = track ? `/book?from=risk&track=${track}&band=${band}&score=${score}` : "/book";

  function chooseTrack(id: TrackId) {
    setTrack(id);
    setAnswers(new Array(QUESTIONS_PER_TRACK).fill(null));
    window.setTimeout(() => setStep(0), 240);
  }

  function chooseAnswer(qIndex: number, points: number) {
    setAnswers((prev) => {
      const a = [...prev];
      a[qIndex] = points;
      return a;
    });
    // Brief highlight of the chosen card, then advance.
    window.setTimeout(() => {
      setStep(qIndex + 1 >= QUESTIONS_PER_TRACK ? "result" : qIndex + 1);
    }, 260);
  }

  function back() {
    if (step === "result") { setStep(QUESTIONS_PER_TRACK - 1); return; }
    const s = step as number;
    if (s <= 0) { setStep(-1); setTrack(null); setAnswers([]); return; }
    setStep(s - 1);
  }

  function restart() {
    setTrack(null); setAnswers([]); setStep(-1);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="riskcalc" aria-label="מבדק מוכנות Tech-Legal">
      <div className="riskcalc-head">
        <p className="eyebrow" style={{ color: "var(--clay)" }}>מבדק מוכנות</p>
        <h3 className="riskcalc-title">כמה הארגון שלכם מוכן, באמת?</h3>
        <p className="riskcalc-sub">
          שמונה שאלות על התנהלות בפועל, לא על החוזה שלכם. שש משותפות ושתיים לפי תחום הפעילות. שום מסמך לא נשלח ולא נשמר.
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
                {TRACKS.map((tk) => (
                  <button key={tk.id} type="button" aria-pressed={track === tk.id}
                    className={"riskcalc-choice" + (track === tk.id ? " on" : "")}
                    onClick={() => chooseTrack(tk.id)}>
                    <span className="riskcalc-choice-text">{tk.label}</span>
                    <span className="riskcalc-choice-mark" aria-hidden="true"><Icon name="chevron-l" size={16} /></span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h4 className="riskcalc-q">{questions[step as number].question}</h4>
              <div className="riskcalc-choices" role="group" aria-label={questions[step as number].question}>
                {questions[step as number].choices.map((c) => {
                  const on = answers[step as number] === c.points;
                  return (
                    <button key={c.text} type="button" aria-pressed={on}
                      className={"riskcalc-choice" + (on ? " on" : "")}
                      onClick={() => chooseAnswer(step as number, c.points)}>
                      <span className="riskcalc-choice-text">{c.text}</span>
                      <span className="riskcalc-choice-mark" aria-hidden="true"><Icon name="check" size={16} /></span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step !== -1 && (
            <div className="riskcalc-nav">
              <button type="button" className="btn btn-ghost btn-sm" onClick={back}>
                <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="chevron-l" size={15} /></span> חזרה
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="riskcalc-result" aria-live="polite">
          <p className="eyebrow" style={{ color: "var(--clay)" }}>התוצאה שלכם</p>
          <ExposureGauge score={score} title={result!.title} tone={result!.tone} />
          <div className={"riskcalc-badge tone-" + result!.tone}>{result!.title}</div>
          {gap && <p className="riskcalc-gap"><strong>הפער הגדול ביותר שסימנתם:</strong> {gap}</p>}
          <p className="riskcalc-body">{result!.body}</p>
          <p className="riskcalc-next"><strong>הצעד הבא:</strong> {result!.next}</p>

          {/* Premium conversion block: the value is a personal exposure map, the
              action is a no-obligation diagnostic call, pre-filled from the quiz. */}
          <div className="riskcalc-cta">
            <div className="riskcalc-cta-text">
              <p className="riskcalc-cta-title">קבלו את מפת החשיפה האישית שלכם</p>
              <p className="riskcalc-cta-sub">שיחת אבחון Tech-Legal קצרה וללא התחייבות, ממוקדת בפער שסימנתם, עם הצעד המעשי הבא.</p>
            </div>
            <Link to={bookHref} className="btn btn-clay riskcalc-cta-btn">
              <Icon name="calendar" size={16} /> לתיאום שיחת אבחון
            </Link>
          </div>

          <div className="riskcalc-actions">
            <a className="btn btn-linkedin"
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
              target="_blank" rel="noopener noreferrer"
              onClick={() => { void copyLink(); }}>
              <Icon name="share" size={16} /> שיתוף התוצאה בלינקדאין
            </a>
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
