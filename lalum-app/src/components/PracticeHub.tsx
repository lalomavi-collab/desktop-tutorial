import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// Filterable grid of representative (illustrative) scenarios, with a modal for
// the full detail. Deliberately framed as approach, not specific client cases,
// so it stays within legal-advertising ethics.
export function PracticeHub() {
  const { t } = useLang();
  const h = t.practice.hub;
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState<string | null>(null);
  const item = h.items.find((x) => x.id === active) ?? null;
  const shown = filter === "all" ? h.items : h.items.filter((x) => x.area === filter);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(null); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [active]);

  return (
    <section id="practice-hub" className="wrap section">
      <div style={{ maxWidth: "56ch", margin: "0 0 24px" }}>
        <p className="eyebrow">{h.eyebrow}</p>
        <h2 className="h2">{h.title}</h2>
        <p className="hub-note">{h.note}</p>
      </div>

      <div className="hub-tabs" role="tablist" aria-label={h.title}>
        {h.filters.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id}
            className={"hub-tab" + (filter === f.id ? " on" : "")} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="hub-grid">
        {shown.map((it) => (
          <button key={it.id} type="button" className="hub-card" onClick={() => setActive(it.id)}>
            <div className="hub-card-tags">
              {it.tags.map((tg) => <span key={tg} className="hub-tag">{tg}</span>)}
            </div>
            <h3 className="hub-card-title">{it.title}</h3>
            <p className="hub-card-summary">{it.summary}</p>
            <span className="hub-card-more">{h.more} &rarr;</span>
          </button>
        ))}
      </div>

      {item && createPortal(
        <div className="hub-backdrop" onClick={() => setActive(null)}>
          <div className="hub-modal" role="dialog" aria-modal="true" aria-label={item.title} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="hub-modal-close" onClick={() => setActive(null)} aria-label={h.close}>
              <Icon name="x" size={18} />
            </button>
            <div className="hub-card-tags">
              {item.tags.map((tg) => <span key={tg} className="hub-tag">{tg}</span>)}
            </div>
            <h3 className="hub-modal-title">{item.title}</h3>
            {item.detail.map((p, i) => <p key={i} className="hub-modal-p">{p}</p>)}
            <div className="hub-modal-foot">
              <p className="hub-modal-note">{h.note}</p>
              <Link to="/book" className="btn btn-clay" onClick={() => setActive(null)}>
                <Icon name="calendar" size={16} /> {t.practice.riskCalc.cta}
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
