import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link } from "./AppLink";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";
import { useDialogA11y } from "../lib/useDialogA11y";

// Filterable grid of representative (illustrative) scenarios, with a modal for
// the full detail. Deliberately framed as approach, not specific client cases,
// so it stays within legal-advertising ethics.
export function PracticeHub() {
  const { t, dir } = useLang();
  const h = t.practice.hub;
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setActive(null), []);
  useDialogA11y(!!active, close, modalRef);

  const item = h.items.find((x) => x.id === active) ?? null;
  const shown = filter === "all" ? h.items : h.items.filter((x) => x.area === filter);

  return (
    <section id="practice-hub" className="wrap section">
      <div style={{ maxWidth: "56ch", margin: "0 0 24px" }}>
        <p className="eyebrow">{h.eyebrow}</p>
        <h2 className="h2">{h.title}</h2>
        <p className="hub-note">{h.note}</p>
      </div>

      <div className="hub-tabs">
        {h.filters.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id}
            className={"hub-tab" + (filter === f.id ? " on" : "")} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="hub-empty">{h.empty}</p>
      ) : (
        <div className="hub-grid">
          {shown.map((it) => (
            <button key={it.id} type="button" className="hub-card" onClick={() => setActive(it.id)}>
              <div className="hub-card-tags">
                {it.tags.map((tg) => <span key={tg} className="hub-tag">{tg}</span>)}
              </div>
              <h3 className="hub-card-title">{it.title}</h3>
              <p className="hub-card-summary">{it.summary}</p>
              <span className="hub-card-more">{h.more} <span aria-hidden="true">{dir === "rtl" ? "←" : "→"}</span></span>
            </button>
          ))}
        </div>
      )}

      {item && createPortal(
        <div className="hub-backdrop" onClick={close}>
          <div ref={modalRef} className="hub-modal" role="dialog" aria-modal="true" aria-label={item.title} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="hub-modal-close" onClick={close} aria-label={h.close}>
              <Icon name="x" size={18} />
            </button>
            <div className="hub-card-tags">
              {item.tags.map((tg) => <span key={tg} className="hub-tag">{tg}</span>)}
            </div>
            <h3 className="hub-modal-title">{item.title}</h3>
            {item.detail.map((p) => <p key={p.slice(0, 32)} className="hub-modal-p">{p}</p>)}
            <div className="hub-modal-foot">
              <p className="hub-modal-note">{h.note}</p>
              <Link to="/book" className="btn btn-clay" onClick={close}>
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
