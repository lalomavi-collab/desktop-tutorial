import { Link } from "./AppLink";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// The two areas the practice leads with, as a pair of cards.
//
// It lives in its own component because it belongs on more than one page. The
// home page opened with it, but /advisory did not carry it at all: the advisory
// hub is what the top bar and the phone tab bar both point at, and from there a
// reader had no link to either focus area. Two pages, one block, so a copy
// change cannot leave one of them saying something the other no longer says.
//
// Mediation is linked under the pair rather than beside it. It is a service the
// practice provides, not a third headline.
export function FocusAreas({ withHeading = true }: { withHeading?: boolean }) {
  const { t } = useLang();
  const h = t.home;

  return (
    <section className="wrap section section-line">
      {withHeading && (
        <div style={{ maxWidth: "58ch", margin: "0 0 40px" }}>
          <p className="eyebrow">{h.advisoryPillarsEyebrow}</p>
          <h2 className="h2">{h.advisoryPillarsH2}</h2>
        </div>
      )}
      <div className="grid grid-2">
        <Link to="/ai-legal-advisory" className="card" aria-label={h.advisoryAiTitle}>
          <span className="icon-badge"><Icon name="brain" size={23} /></span>
          <h3 className="h3" style={{ fontSize: 22, margin: "18px 0 10px", lineHeight: 1.25 }}>{h.advisoryAiTitle}</h3>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--slate)", margin: 0 }}>{h.advisoryAiBody}</p>
          <span className="card-go">{h.advisoryMore} &rarr;</span>
        </Link>
        <Link to="/real-estate-legal-advisory" className="card" aria-label={h.advisoryReTitle}>
          <span className="icon-badge"><Icon name="scale" size={23} /></span>
          <h3 className="h3" style={{ fontSize: 22, margin: "18px 0 10px", lineHeight: 1.25 }}>{h.advisoryReTitle}</h3>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--slate)", margin: 0 }}>{h.advisoryReBody}</p>
          <span className="card-go">{h.advisoryMore} &rarr;</span>
        </Link>
      </div>
      <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--slate)", margin: "26px 0 0" }}>
        {h.advisoryMediationLead}{" "}
        <Link to="/mediation-dispute-resolution" style={{ color: "var(--clay)" }}>{h.advisoryMediationTitle}</Link>
      </p>
    </section>
  );
}
