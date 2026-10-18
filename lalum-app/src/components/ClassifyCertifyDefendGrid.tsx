import { useLang } from "../context/LangContext";
import { Icon } from "./Icon";

// The three steps of the practice, each with the copy the site already carries
// (t.data.frameworks, five languages) beside a small code-drawn artifact of
// what the step produces. The artifacts are illustrations: they hold no
// measured number and name no client, and each says so in its own tag.

const TIERS = ["PROHIBITED", "HIGH-RISK", "LIMITED", "MINIMAL"];
const ACTIVE_TIER = 1;
const CERT_ROWS = ["TIER ASSIGNED", "OBLIGATIONS MAPPED", "OPINION SIGNED", "SOURCE AND DATE LOGGED"];
const TRAIL = ["DECISION", "REASONING LOGGED", "OUTPUT REPRODUCIBLE", "READY FOR REVIEW"];

function Classify() {
  return (
    <ul className="ccd-art ccd-tiers" aria-hidden="true">
      {TIERS.map((tier, i) => (
        <li key={tier} data-on={i === ACTIVE_TIER}>
          <span className="mono">{tier}</span>
          <i>{[0, 1, 2, 3].map((n) => <b key={n} data-fill={n >= i} />)}</i>
        </li>
      ))}
    </ul>
  );
}

function Certify() {
  return (
    <ul className="ccd-art ccd-cert" aria-hidden="true">
      {CERT_ROWS.map((r) => (
        <li key={r}>
          <span className="mono">{r}</span>
          <Icon name="check" size={14} />
        </li>
      ))}
    </ul>
  );
}

function Defend() {
  return (
    <ol className="ccd-art ccd-trail" aria-hidden="true">
      {TRAIL.map((s, i) => (
        <li key={s} data-last={i === TRAIL.length - 1}>
          <span className="mono">{s}</span>
        </li>
      ))}
    </ol>
  );
}

const ART = { CLASSIFY: Classify, CERTIFY: Certify, DEFEND: Defend } as const;
const TAG: Record<string, string> = { CLASSIFY: "EU AI ACT", CERTIFY: "SIGNED OPINION", DEFEND: "AUDIT TRAIL" };

export function ClassifyCertifyDefendGrid() {
  const { t } = useLang();
  return (
    <div className="bento ccd-grid">
      {t.data.frameworks.map((f, i) => {
        const Art = ART[f.code as keyof typeof ART];
        return (
          <article key={f.code} className="bento-cell ccd-cell">
            <div>
              <div dir="ltr" className="ccd-head mono">
                <span>[{String(i + 1).padStart(2, "0")} // {f.code}]</span>
                <span>{TAG[f.code] ?? ""}</span>
              </div>
              <h3 className="h3 ccd-title">{f.title}</h3>
              <p className="ccd-body">{f.body}</p>
            </div>
            {Art ? <Art /> : null}
          </article>
        );
      })}
    </div>
  );
}
