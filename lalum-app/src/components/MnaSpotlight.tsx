import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// A prominent, standalone spotlight for M&A, so mergers and acquisitions read as
// a headline practice, not just one card in the grid. It reuses the approved
// M&A practice-area copy (title, blurb, points) so nothing new needs review.
const CTA = {
  he: "לשיחה על עסקה או מיזוג",
  en: "Talk to us about a deal or M&A",
  es: "Hable con nosotros sobre una operación o fusión",
  fr: "Parlez-nous d'une opération ou d'une fusion",
  ar: "تحدث معنا بشأن صفقة أو اندماج",
} as const;

export function MnaSpotlight() {
  const { t, lang } = useLang();
  const mna = t.practice.areas.find((a) => a.icon === "compass");
  if (!mna) return null;

  return (
    <section id="mna" style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <div className="wrap section mna-spotlight">
        <div className="mna-copy">
          <p className="eyebrow" style={{ color: "var(--clay-soft)" }}>{mna.tag}</p>
          <h2 className="h2" style={{ color: "var(--paper)", margin: "12px 0 0" }}>{mna.title}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "#CDC7BB", margin: "16px 0 0", maxWidth: "48ch" }}>{mna.blurb}</p>
          <Link to="/book" className="btn btn-clay" style={{ marginTop: 26 }}>{CTA[lang]}</Link>
        </div>
        <ul className="mna-points">
          {mna.points.map((p, i) => (
            <li key={i}>
              <span className="mna-check"><Icon name="check" size={15} /></span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
