import { useState, type KeyboardEvent } from "react";
import { Link } from "./AppLink";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// "Which one are you?" as a router rather than a signpost.
//
// It used to be four cards, three of which pointed at the same practice hub. A
// homeowner and a CTO were told they were different and then sent to the same
// page, which is worse than not asking: the question raised an expectation the
// destination did not meet. Now each audience opens its own rubrics, four
// entries written for that reader and pointing at four different pages that
// already exist.
//
// Every panel stays in the document and the inactive ones carry `hidden`,
// rather than the open one being the only one rendered. A crawler that runs the
// page, and a reader on a screen reader walking the document, then reach all
// sixteen rubrics instead of the four that happen to open first.
export function AudiencePaths() {
  const { t, dir } = useLang();
  const h = t.home;
  const [active, setActive] = useState(0);
  const last = h.audiences.length - 1;

  // Left and right swap meaning in Hebrew and Arabic, so the step follows the
  // reading direction instead of the key's name.
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next = active;
    if (e.key === forward) next = active === last ? 0 : active + 1;
    else if (e.key === back) next = active === 0 ? last : active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    setActive(next);
    document.getElementById(`audience-tab-${next}`)?.focus();
  }

  return (
    <section className="audience-band" aria-labelledby="audience-title">
      <div className="wrap section">
        <div className="audience-head">
          <p className="eyebrow">{h.audienceEyebrow}</p>
          <h2 className="h2" id="audience-title">{h.audienceTitle}</h2>
          <p className="audience-lede">{h.audienceLede}</p>
        </div>

        <div className="audience-tabs" role="tablist" aria-label={h.audienceTitle}>
          {h.audiences.map((a, i) => (
            <button
              key={a.label}
              type="button"
              role="tab"
              id={`audience-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`audience-panel-${i}`}
              tabIndex={i === active ? 0 : -1}
              className={"audience-tab" + (i === active ? " is-active" : "")}
              onClick={() => setActive(i)}
              onKeyDown={onKeyDown}
            >
              <span className="audience-tab-icon" aria-hidden="true"><Icon name={a.icon} size={19} /></span>
              <span className="audience-tab-label">{a.label}</span>
            </button>
          ))}
        </div>

        {h.audiences.map((a, i) => (
          <div
            key={a.label}
            role="tabpanel"
            id={`audience-panel-${i}`}
            aria-labelledby={`audience-tab-${i}`}
            hidden={i !== active}
            className="audience-panel"
          >
            <p className="audience-panel-lede">{a.body}</p>
            <div className="audience-rubrics">
              {a.rubrics.map((r, j) => (
                <Link key={r.label} to={r.to} className="audience-rubric">
                  <span className="audience-rubric-n" aria-hidden="true">{String(j + 1).padStart(2, "0")}</span>
                  <span className="audience-rubric-label">{r.label}</span>
                  <span className="audience-rubric-body">{r.body}</span>
                  <span className="audience-rubric-go" aria-hidden="true">&rarr;</span>
                </Link>
              ))}
            </div>
            <Link to={a.to} className="btn btn-clay audience-panel-cta">{a.cta}</Link>
          </div>
        ))}
      </div>
    </section>
  );
}
