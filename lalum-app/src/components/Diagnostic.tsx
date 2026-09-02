import { useState, type ReactNode } from "react";
import { Link } from "./AppLink";
import { Icon } from "./Icon";
import { SECTORS_UI, type AuditBand, type AuditQuestion } from "../lib/sectors";

// The shared diagnostic engine: a run of binary questions, an exposure score,
// and a map of the gaps with what each one needs.
//
// It exists as one component because the sector self-assessment and the tools
// on the AI pillar are the same instrument pointed at different subjects, and
// three copies of a scoring loop is three places for the scoring to drift.
// What differs per tool is its questions, its bands, and whatever it produces
// at the end (`output`), which is where the contract tool puts its draft
// clauses.
//
// Nothing leaves the browser. Answers live in component state, which is what
// lets these pages promise an executive that a self-assessment of their own
// exposure is not a lead form in disguise.

const POINTS_PER_GAP_OF = (n: number) => Math.round(100 / n);

function bandFor(bands: AuditBand[], score: number): AuditBand {
  return bands.find((b) => score <= b.upTo) ?? bands[bands.length - 1];
}

// An arc rather than a full circle: the reading is "how far along a scale".
// Drawn in the page's own clay rather than an alarm red, because the number is
// the message and colouring it like a siren invites the reader to discount it.
function Gauge({ score, label, band }: { score: number; label: string; band: AuditBand }) {
  const r = 62;
  const circumference = Math.PI * r;
  const tone = band.id === "high" ? "var(--clay)" : band.id === "medium" ? "var(--clay-bright)" : "var(--slate)";
  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 160 92" style={{ width: "100%", maxWidth: 240, height: "auto", display: "block", margin: "0 auto" }} role="img" aria-label={`${label}: ${score}%`}>
        <path d={`M 18 80 A ${r} ${r} 0 0 1 142 80`} fill="none" stroke="var(--line-strong)" strokeWidth="12" strokeLinecap="round" />
        <path
          d={`M 18 80 A ${r} ${r} 0 0 1 142 80`}
          fill="none"
          stroke={tone}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
        <text x="80" y="72" textAnchor="middle" style={{ fontSize: 30, fontWeight: 700, fill: "var(--ink)" }}>{score}%</text>
      </svg>
      <p className="eyebrow" style={{ color: "var(--clay)", margin: "10px 0 0" }}>{label}</p>
    </div>
  );
}

type Props = {
  questions: AuditQuestion[];
  bands: AuditBand[];
  /** Rendered under the gap map, given the questions answered "no". */
  output?: (gaps: AuditQuestion[]) => ReactNode;
  startLabel?: string;
};

export function Diagnostic({ questions, bands, output, startLabel }: Props) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  const done = started && step >= questions.length;
  const gaps = questions.filter((q) => answers[q.id] === false);
  const score = Math.min(100, gaps.length * POINTS_PER_GAP_OF(questions.length));
  const band = bandFor(bands, score);

  function answer(id: string, value: boolean) {
    setAnswers((a) => ({ ...a, [id]: value }));
    setStep((s) => s + 1);
  }

  if (!started) {
    return (
      <div className="card" style={{ padding: "28px 24px", textAlign: "center" }}>
        <button type="button" className="btn btn-clay" onClick={() => setStarted(true)}>
          <Icon name="compass" size={17} /> {startLabel ?? SECTORS_UI.auditStart}
        </button>
        <p style={{ fontSize: 13.5, color: "var(--slate)", margin: "16px 0 0" }}>{SECTORS_UI.auditPrivacy}</p>
      </div>
    );
  }

  if (!done) {
    const q = questions[step];
    return (
      <div className="card" style={{ padding: "26px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <span style={{ fontSize: 13, color: "var(--slate)", flexShrink: 0 }}>
            {step + 1} {SECTORS_UI.auditOf} {questions.length}
          </span>
          <span style={{ flex: 1, height: 4, background: "var(--line-strong)", borderRadius: 999, overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${(step / questions.length) * 100}%`, background: "var(--clay)", transition: "width 300ms ease" }} />
          </span>
        </div>

        <h3 className="h3" style={{ fontSize: 20, lineHeight: 1.4, margin: "0 0 20px" }}>{q.q}</h3>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-clay" onClick={() => answer(q.id, true)} style={{ minWidth: 120, justifyContent: "center" }}>
            {SECTORS_UI.auditYes}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => answer(q.id, false)} style={{ minWidth: 120, justifyContent: "center" }}>
            {SECTORS_UI.auditNo}
          </button>
        </div>

        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((sp) => sp - 1)}
            style={{ marginTop: 20, background: "none", border: "none", padding: 0, font: "inherit", fontSize: 14, color: "var(--slate)", cursor: "pointer", textDecoration: "underline" }}
          >
            {SECTORS_UI.auditBack}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "28px 24px" }}>
      <div className="grid grid-2" style={{ alignItems: "center", gap: 28 }}>
        <Gauge score={score} label={SECTORS_UI.auditScore} band={band} />
        <div>
          <h3 className="h3" style={{ fontSize: 22, margin: "0 0 10px" }}>{band.label}</h3>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--slate)", margin: 0 }}>{band.body}</p>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <p className="eyebrow">{gaps.length ? SECTORS_UI.auditGaps : SECTORS_UI.auditNoGaps}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
          {gaps.map((q) => (
            <div key={q.id} style={{ borderInlineStart: "3px solid var(--clay)", paddingInlineStart: 16 }}>
              <h4 style={{ fontSize: 16.5, fontWeight: 700, margin: "0 0 8px", color: "var(--ink)", lineHeight: 1.4 }}>{q.q}</h4>
              <p style={{ fontSize: 14.5, lineHeight: 1.68, color: "var(--slate)", margin: "0 0 8px" }}>
                <strong style={{ color: "var(--ink)" }}>{SECTORS_UI.auditWhy}: </strong>{q.why}
              </p>
              <p style={{ fontSize: 14.5, lineHeight: 1.68, color: "var(--slate)", margin: 0 }}>
                <strong style={{ color: "var(--ink)" }}>{SECTORS_UI.auditFix}: </strong>{q.fix}
              </p>
            </div>
          ))}
        </div>
      </div>

      {output ? <div style={{ marginTop: 28 }}>{output(gaps)}</div> : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
        <Link to="/book" className="btn btn-clay"><Icon name="calendar" size={17} /> {SECTORS_UI.book}</Link>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => { setAnswers({}); setStep(0); setStarted(false); }}
        >
          {SECTORS_UI.auditRestart}
        </button>
      </div>
    </div>
  );
}
