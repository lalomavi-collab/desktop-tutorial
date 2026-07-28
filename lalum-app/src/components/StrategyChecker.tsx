import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// Interactive pre-deal / pre-litigation value map. The visitor picks their
// situation and sees a concise three-step breakdown of what an early strategic
// consultation changes. Deliberately light on text: three steps, one line each.
export function StrategyChecker() {
  const { t } = useLang();
  const s = t.practice.strategy;
  const [active, setActive] = useState(s.paths[0].id);
  const path = s.paths.find((p) => p.id === active) ?? s.paths[0];

  return (
    <div className="strategy-checker" aria-label={s.title}>
      <div className="strategy-head">
        <h3 className="strategy-title">{s.title}</h3>
        <p className="strategy-sub">{s.sub}</p>
      </div>

      <div className="strategy-tabs" role="tablist" aria-label={s.title}>
        {s.paths.map((p) => {
          const on = p.id === active;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={"strategy-tab" + (on ? " on" : "")}
              onClick={() => setActive(p.id)}
            >
              <Icon name={p.icon} size={18} />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* key forces a remount on change so the step animation replays */}
      <div key={path.id} className="strategy-panel" role="tabpanel">
        <div className="strategy-tagline">{path.tagline}</div>
        <ol className="strategy-steps">
          {path.steps.map((step, i) => (
            <li key={i} className="strategy-step" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="strategy-step-n" aria-hidden="true">{i + 1}</span>
              <div className="strategy-step-text">
                <div className="strategy-step-title">{step.title}</div>
                <div className="strategy-step-body">{step.body}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="strategy-foot">
        <p className="strategy-savings">{s.savingsNote}</p>
        <Link to="/book" className="btn btn-clay">
          <Icon name="calendar" size={16} /> {s.cta}
        </Link>
      </div>
    </div>
  );
}
