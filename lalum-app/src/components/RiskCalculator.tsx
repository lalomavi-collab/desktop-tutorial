import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// Two-axis pre-deal risk calculator: pick a project type and a stage, and see
// the key risk vectors plus the exposure at that stage, with a clear pointer to
// an early strategic consultation. Data-driven, animated, RTL-safe.
export function RiskCalculator() {
  const { t } = useLang();
  const r = t.practice.riskCalc;
  const [typeId, setTypeId] = useState(r.types[0].id);
  const [stageId, setStageId] = useState(r.stages[0].id);
  const type = r.types.find((x) => x.id === typeId) ?? r.types[0];
  const stage = r.stages.find((x) => x.id === stageId) ?? r.stages[0];

  return (
    <div className="riskcalc" aria-label={r.title}>
      <div className="riskcalc-head">
        <p className="eyebrow" style={{ color: "var(--clay)" }}>{r.eyebrow}</p>
        <h3 className="riskcalc-title">{r.title}</h3>
        <p className="riskcalc-sub">{r.sub}</p>
      </div>

      <div className="riskcalc-controls">
        <div className="riskcalc-field">
          <span className="riskcalc-flabel">{r.typeLabel}</span>
          <div className="riskcalc-opts" role="tablist" aria-label={r.typeLabel}>
            {r.types.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={x.id === typeId}
                className={"riskcalc-opt" + (x.id === typeId ? " on" : "")} onClick={() => setTypeId(x.id)}>
                <Icon name={x.icon} size={16} /><span>{x.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="riskcalc-field">
          <span className="riskcalc-flabel">{r.stageLabel}</span>
          <div className="riskcalc-opts" role="tablist" aria-label={r.stageLabel}>
            {r.stages.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={x.id === stageId}
                className={"riskcalc-opt" + (x.id === stageId ? " on" : "")} onClick={() => setStageId(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div key={typeId + stageId} className="riskcalc-result">
        <div className={"riskcalc-exposure tone-" + stage.tone}>
          <div className="riskcalc-exposure-top">
            <span className="riskcalc-exposure-label">{r.exposureLabel}</span>
            <span className="riskcalc-exposure-level">{stage.level}</span>
          </div>
          <span className="riskcalc-meter"><span className={"riskcalc-meter-fill tone-" + stage.tone} /></span>
          <p className="riskcalc-exposure-note">{stage.note}</p>
        </div>
        <div className="riskcalc-vectors">
          <div className="riskcalc-vectors-label">{r.vectorsLabel}</div>
          <ul>
            {type.vectors.map((v, i) => (
              <li key={i} className="riskcalc-vector" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="riskcalc-vdot" aria-hidden="true" />
                <div>
                  <div className="riskcalc-vtitle">{v.title}</div>
                  <div className="riskcalc-vbody">{v.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="riskcalc-foot">
        <p className="riskcalc-ctanote">{r.ctaNote}</p>
        <Link to="/book" className="btn btn-clay"><Icon name="calendar" size={16} /> {r.cta}</Link>
      </div>
    </div>
  );
}
