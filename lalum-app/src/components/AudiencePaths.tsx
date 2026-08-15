import { Link } from "react-router-dom";
import { useLang } from "../context/LangContext";

// "Which one are you?" audience paths. Each audience (homeowner in renewal,
// technology company, board, public sector) gets a clear route to where it is
// served, so a visitor self-selects instead of parsing the whole practice list.
export function AudiencePaths() {
  const { t } = useLang();
  const h = t.home;
  return (
    <section className="wrap section" aria-label={h.audienceTitle}>
      <div style={{ maxWidth: "56ch", margin: "0 0 28px" }}>
        <p className="eyebrow">{h.audienceEyebrow}</p>
        <h2 className="h2">{h.audienceTitle}</h2>
      </div>
      <div className="audience-grid">
        {h.audiences.map((a) => (
          <Link key={a.label} to={a.to} className="card audience-card">
            <span className="audience-label">{a.label}</span>
            <span className="audience-body">{a.body}</span>
            <span className="audience-cta">{a.cta} <span aria-hidden="true">←</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
