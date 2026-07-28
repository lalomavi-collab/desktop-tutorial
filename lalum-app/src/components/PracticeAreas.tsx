import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// The core legal practice areas, presented as scannable cards. Kept prominent
// and equal to the AI capabilities, never a side note.
export function PracticeAreas() {
  const { t } = useLang();
  const p = t.practice;
  return (
    <section id="practice-areas" className="wrap section">
      <div style={{ maxWidth: "60ch", margin: "0 0 44px" }}>
        <p className="eyebrow">{p.eyebrow}</p>
        <h2 className="h2">{p.h2}</h2>
        <p className="lede" style={{ marginTop: 16, maxWidth: "58ch" }}>{p.sub}</p>
      </div>
      <div className="grid grid-3">
        {p.areas.map((a) => (
          <article key={a.title} className="card practice-card">
            <span className="icon-badge"><Icon name={a.icon} size={22} /></span>
            <div className="practice-tag">{a.tag}</div>
            <h3 className="practice-title">{a.title}</h3>
            <p className="practice-blurb">{a.blurb}</p>
            <ul className="practice-points">
              {a.points.map((pt) => (
                <li key={pt}><Icon name="check" size={15} /><span>{pt}</span></li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
