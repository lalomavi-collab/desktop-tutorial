import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";
import { RiskCalculator } from "./RiskCalculator";

// Dark-premium highlight for the pre-deal / pre-litigation strategic advisory.
// The message is that this is an executive layer that works alongside the
// client's existing lawyer, not a replacement, paired with the interactive
// value map.
export function PreDealStrategy() {
  const { t } = useLang();
  const pd = t.practice.preDeal;
  return (
    <section id="pre-deal" className="pre-deal">
      <div className="wrap section pre-deal-grid">
        <div className="pre-deal-head">
          <p className="eyebrow" style={{ color: "var(--clay-soft)" }}>{pd.eyebrow}</p>
          <h2 className="h2" style={{ color: "var(--paper)", margin: "0 0 16px" }}>{pd.title}</h2>
          <p className="pre-deal-lede">{pd.lede}</p>
          <div className="pre-deal-note">
            <Icon name="shield" size={18} />
            <span>{pd.note}</span>
          </div>
          <ul className="pre-deal-points">
            {pd.points.map((pt) => (
              <li key={pt}><Icon name="check" size={15} /><span>{pt}</span></li>
            ))}
          </ul>
        </div>
        <RiskCalculator />
      </div>
    </section>
  );
}
