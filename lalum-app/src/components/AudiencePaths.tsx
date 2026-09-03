import { Link } from "./AppLink";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// The routes into the practice, as keywords.
//
// Three versions failed before this one, each for a reason worth keeping:
//
//   1. Four cards, three of which pointed at the same hub. The page asked who
//      you were and sent everyone to one place.
//   2. Tabs behind the question "which one are you?". The question reads like a
//      form asking the reader to file themselves, and the tabs hid fifteen of
//      the sixteen entries behind a click nobody owes us.
//   3. Four columns of headline and description. Nothing hidden, but a wall of
//      prose on the page a reader is trying to leave.
//
// So: keywords. Each route is a heading and a row of buttons, and a button is
// the shortest true name of where it goes. The sentence behind each keyword is
// still in the data, where it does two jobs: the title attribute for a reader
// who hovers, and the prerendered document a crawler reads.
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
            <div key={a.label} className="audience-route">
              <h3 className="audience-route-name">
                <span className="audience-route-icon" aria-hidden="true"><Icon name={a.icon} size={17} /></span>
                {a.label}
              </h3>
              <div className="audience-keys">
                {a.rubrics.map((r) => (
                  <Link key={r.label} to={r.to} className="audience-key" title={r.body}>
                    {r.label}
                  </Link>
                ))}
                <Link to={a.to} className="audience-key audience-key-cta">
                  {a.cta} <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
