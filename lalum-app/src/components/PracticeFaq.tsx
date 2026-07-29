import { useState } from "react";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// Accordion FAQ grouped by practice area. This renders the visible Q&A only; the
// FAQPage JSON-LD is emitted once per page via PageMeta (see src/lib/pageFaqs.ts),
// so a page that shows this section still carries exactly one FAQPage block
// instead of a second, competing one.
export function PracticeFaq() {
  const { t } = useLang();
  const f = t.practice.faq;
  const [open, setOpen] = useState("");

  return (
    <section id="faq-practice" className="wrap section" style={{ maxWidth: 920 }}>
      <div style={{ maxWidth: "56ch", margin: "0 0 32px" }}>
        <p className="eyebrow">{f.eyebrow}</p>
        <h2 className="h2">{f.title}</h2>
        <p className="lede" style={{ marginTop: 14 }}>{f.sub}</p>
      </div>
      <div className="pfaq">
        {f.cats.map((cat) => (
          <div key={cat.id} className="pfaq-cat">
            <div className="pfaq-cat-title">{cat.title}</div>
            <div className="pfaq-list">
              {cat.items.map((it, i) => {
                const key = `${cat.id}-${i}`;
                const on = open === key;
                return (
                  <div key={key} className={"pfaq-item" + (on ? " on" : "")}>
                    <button type="button" className="pfaq-q" id={`${key}-b`} aria-expanded={on} aria-controls={`${key}-p`} onClick={() => setOpen(on ? "" : key)}>
                      <span>{it.q}</span>
                      <span className="pfaq-chev" aria-hidden="true"><Icon name="chevron-d" size={18} /></span>
                    </button>
                    <div className="pfaq-a" id={`${key}-p`} role="region" aria-labelledby={`${key}-b`}>
                      <div><p>{it.a}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
