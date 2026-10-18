import { useLang } from "../context/LangContext";

// The hero's right-hand panel: what a governance read-out looks like, as a
// four-row matrix. It is a SAMPLE and says so in its own header. Nothing here
// is measured from the visitor or from any real organization, so there is no
// percentage, no "live" claim and no verdict about a real client: a law firm's
// front page cannot present an invented score as a status. Labels follow the
// page language; the status codes are the product's own vocabulary and stay in
// Latin, left to right, like the rest of the mono chrome.
const STATUS = ["[VERIFIED // TIER-1]", "[COVERED // LOW EXPOSURE]", "[AUDIT TRAIL // LOGGED]", "[READY]"];

export function GovernanceMatrix() {
  const { t } = useLang();
  const rows = t.home.heroRows as string[];
  return (
    <div className="gov-card" role="group" aria-label="Risk and conformity telemetry, illustrative sample">
      <div className="gov-bar" dir="ltr">
        <span className="gov-title">[RISK &amp; CONFORMITY TELEMETRY]</span>
        <span className="gov-state"><i aria-hidden="true" />ILLUSTRATIVE SAMPLE</span>
      </div>
      <ol className="gov-rows">
        {rows.map((label, i) => (
          <li key={i} className="gov-row">
            <span className="gov-idx" dir="ltr">{String(i + 1).padStart(2, "0")} //</span>
            <span className="gov-label">{label}</span>
            <span className="gov-status" dir="ltr">{STATUS[i]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
