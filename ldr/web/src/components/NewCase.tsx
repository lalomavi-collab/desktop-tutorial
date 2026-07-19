import { useMemo, useState } from "react";
import {
  supabase, DOMAIN_LABELS, EXPOSURE_LABELS, RISK_FACTOR_LABELS,
  type LegalDomain, type Profile,
} from "../lib/supabase";
import { redactEntities, bucketExposure, detectRiskFactors, residualPii } from "../lib/anonymizer";
import { computeRisk, riskBand } from "../lib/riskEngine";

const DOMAINS = Object.keys(DOMAIN_LABELS) as LegalDomain[];

export default function NewCase({
  profile, onDone, notify,
}: { profile: Profile; onDone: () => void; notify: (m: string) => void }) {
  const [domain, setDomain] = useState<LegalDomain>("Real_Estate_TAMA38");
  const [value, setValue] = useState("");
  const [narrative, setNarrative] = useState("");
  const [visibility, setVisibility] = useState<"community" | "firm" | "private">("community");
  const [busy, setBusy] = useState(false);

  const cleaned = useMemo(() => redactEntities(narrative), [narrative]);
  const exposure = useMemo(() => bucketExposure(value ? Number(value) : undefined), [value]);
  const factors = useMemo(() => detectRiskFactors(cleaned), [cleaned]);
  const risk = useMemo(() => computeRisk(exposure, factors), [exposure, factors]);
  const band = riskBand(risk.score);
  const pii = useMemo(() => residualPii(cleaned), [cleaned]);

  async function submit() {
    if (!narrative.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("ldr_cases").insert({
      owner_id: profile.id,
      firm_id: visibility === "firm" ? profile.firm_id : null,
      legal_domain: domain,
      economic_exposure: exposure,
      risk_factors: factors,
      proposed_strategy: cleaned, // already anonymized client-side
      ai_risk_score: risk.score,
      ai_confidence: risk.confidence,
      ai_mode: "suggester",
      ai_recommendations: risk.recommendations,
      visibility,
    });
    setBusy(false);
    if (error) { notify("שגיאה: " + error.message); return; }
    notify("התיק שותף בהצלחה — תרומתך נרשמה 🏆");
    onDone();
  }

  return (
    <div className="container" style={{ paddingTop: 26 }}>
      <h2>הגשת תיק לחדר ההחלטות</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        כל מה שתקלידו עובר השחרה (אנונימיזציה) <b>במכשיר שלכם</b> — לפני שליחה. הענן לעולם לא רואה טקסט גולמי.
      </p>

      <div className="grid cols-2">
        <div className="card pad">
          <label>תחום משפטי</label>
          <select value={domain} onChange={(e) => setDomain(e.target.value as LegalDomain)}>
            {DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_LABELS[d]}</option>)}
          </select>

          <label>שווי כלכלי (₪) — לא נשמר; מומר לטווח בלבד</label>
          <input dir="ltr" inputMode="numeric" value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="לדוגמה 12000000" />
          <span className="tag" style={{ marginTop: 8 }}>טווח שיישמר: {EXPOSURE_LABELS[exposure]}</span>

          <label>תיאור המקרה והמתווה הטקטי</label>
          <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)}
            placeholder="תארו את העסקה/הסכסוך והאסטרטגיה. שמות, ת.ז, גוש/חלקה, טלפונים וסכומים יושחרו אוטומטית." />

          <label>נראות</label>
          <div className="chip-select">
            {([["community","קהילה אנונימית"],["firm","המשרד שלי"],["private","פרטי"]] as const).map(([v,l]) => (
              <span key={v}
                className={"chip " + (visibility === v ? "on" : "")}
                onClick={() => setVisibility(v)}
                title={v === "firm" && !profile.firm_id ? "אין לך משרד מוגדר עדיין" : ""}>
                {l}
              </span>
            ))}
          </div>

          <button className="btn btn-gold" style={{ width: "100%", marginTop: 20 }}
            disabled={busy || !narrative.trim()} onClick={submit}>
            {busy ? <span className="spinner" /> : "אנונימיזציה ושיתוף לחדר"}
          </button>
        </div>

        <div className="card pad">
          <div className="risk-meter">
            <div className={"risk-dial " + band.cls} style={{ ["--val" as any]: risk.score }}>
              <span className="num">{Math.round(risk.score)}</span>
            </div>
            <div>
              <div className={band.cls} style={{ fontFamily: "Frank Ruhl Libre, serif", fontSize: 22, fontWeight: 900 }}>
                {band.label}
              </div>
              <div className="muted" style={{ fontSize: 13 }}>Risk Score (תצוגה מקדימה חיה)</div>
            </div>
          </div>

          <div className="divider" />
          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>גורמי סיכון שזוהו</div>
          <div className="chip-select">
            {factors.length ? factors.map((f) => (
              <span key={f} className="chip on">{RISK_FACTOR_LABELS[f] ?? f}</span>
            )) : <span className="muted">— יזוהו תוך כדי הקלדה —</span>}
          </div>

          {risk.recommendations.length > 0 && (
            <>
              <div className="divider" />
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>המלצות AI</div>
              <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8 }}>
                {risk.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </>
          )}

          <div className="divider" />
          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>תצוגה מקדימה — מה ייצא מהמכשיר</div>
          <div className="card" style={{ background: "var(--obsidian-3)", padding: 12, fontSize: 13, lineHeight: 1.7, maxHeight: 160, overflow: "auto" }}>
            {cleaned || <span className="muted">…</span>}
          </div>
          {pii.length > 0 && (
            <div className="banner" style={{ marginTop: 10, borderColor: "var(--burgundy-soft)" }}>
              ⚠️ זוהו מזהים גולמיים שיושחרו: {pii.join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
