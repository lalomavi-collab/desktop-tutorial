import { useState } from "react";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// Accordion FAQ grouped by practice area, with a FAQPage JSON-LD block emitted
// inline so Google can surface the questions as rich snippets. Single source of
// truth: the schema is built from the same copy the accordion renders.
export function PracticeFaq() {
  const { t } = useLang();
  const f = t.practice.faq;
  const [open, setOpen] = useState("");

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: f.cats.flatMap((c) =>
      c.items.map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a },
      }))
    ),
  };

  return (
    <section id="faq-practice" className="wrap section" style={{ maxWidth: 920 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
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
                    <button type="button" className="pfaq-q" aria-expanded={on} onClick={() => setOpen(on ? "" : key)}>
                      <span>{it.q}</span>
                      <span className="pfaq-chev" aria-hidden="true"><Icon name="chevron-d" size={18} /></span>
                    </button>
                    <div className="pfaq-a" style={{ maxHeight: on ? 420 : 0 }}>
                      <p>{it.a}</p>
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
