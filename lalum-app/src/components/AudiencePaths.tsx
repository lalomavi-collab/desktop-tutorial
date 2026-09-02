import { Link } from "./AppLink";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// The four routes into the practice, laid out and readable at once.
//
// Two earlier versions failed for the same underlying reason. First it was four
// cards, three of which pointed at the same hub: the page asked who you were
// and then sent everyone to one place. Then it was tabs behind the question
// "which one are you?", which reads like a form asking the reader to file
// themselves, and hid fifteen of the sixteen entries behind a click nobody owes
// us.
//
// So: no question, no click. Four routes, each with the four points that reader
// actually meets, all of it on the page. The heading states the principle
// instead of interrogating the visitor.
export function AudiencePaths() {
  const { t } = useLang();
  const h = t.home;
  return (
    <section className="audience-band" aria-labelledby="audience-title">
      <div className="wrap section">
        <div className="audience-head">
          <p className="eyebrow">{h.audienceEyebrow}</p>
          <h2 className="h2" id="audience-title">{h.audienceTitle}</h2>
          <p className="audience-lede">{h.audienceLede}</p>
        </div>

        <div className="audience-grid">
          {h.audiences.map((a) => (
            <article key={a.label} className="audience-route">
              <header className="audience-route-head">
                <span className="audience-route-icon" aria-hidden="true"><Icon name={a.icon} size={20} /></span>
                <h3 className="audience-route-name">{a.label}</h3>
                <p className="audience-route-body">{a.body}</p>
              </header>
              <ul className="audience-rubrics">
                {a.rubrics.map((r) => (
                  <li key={r.label}>
                    <Link to={r.to} className="audience-rubric">
                      <span className="audience-rubric-label">{r.label}</span>
                      <span className="audience-rubric-body">{r.body}</span>
                      <span className="audience-rubric-go" aria-hidden="true">&rarr;</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link to={a.to} className="audience-route-cta">
                {a.cta} <span aria-hidden="true">&rarr;</span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
