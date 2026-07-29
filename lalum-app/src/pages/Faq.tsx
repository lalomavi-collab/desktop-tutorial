import { useState } from "react";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { PageMeta } from "../components/PageMeta";
import { useLang } from "../context/LangContext";
import { faqCategories } from "../lib/faq";
import { faqPageNode, pageJsonLd } from "../lib/schema";
import { faqsForPath } from "../lib/pageFaqs";

// In-app Q&A page. Questions and answers are imported from the firm's Wix FAQ,
// grouped by category, each an accessible accordion.
export function Faq() {
  const { t } = useLang();
  const f = t.faqPage;
  const [open, setOpen] = useState<string>("");

  return (
    <>
      <PageMeta
        title={t.seo.faq.title}
        description={t.seo.faq.desc}
        path="/faq"
        jsonLd={pageJsonLd([faqPageNode(faqsForPath(t, "/faq"))])}
      />
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap" style={{ maxWidth: 900, padding: "96px 32px 40px", textAlign: "center" }}>
          <span className="pill">{f.heroPill}</span>
          <h1 className="serif" style={{ fontSize: "clamp(30px, 7.5vw, 54px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "20ch" }}>{f.title}</h1>
          <p className="lede" style={{ maxWidth: "62ch", margin: "26px auto 0" }}>{f.lede}</p>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="wrap" style={{ maxWidth: 820, paddingBottom: "var(--sec)" }}>
        {faqCategories.map((cat) => (
          <div key={cat.id} style={{ marginTop: 40 }}>
            <div className="faq-cat-head">
              <span className="faq-cat-badge">{cat.title}</span>
              <span className="faq-cat-count">{cat.items.length}</span>
            </div>
            <div className="faq-list" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
              {cat.items.map((it, i) => {
                const key = `${cat.id}-${i}`;
                const isOpen = open === key;
                const pid = `faq-panel-${key}`;
                const bid = `faq-btn-${key}`;
                return (
                  <div key={key} className="faq-item">
                    <button id={bid} type="button" className="faq-q" aria-expanded={isOpen} aria-controls={pid} onClick={() => setOpen(isOpen ? "" : key)}>
                      <span>{it.q}</span>
                      <span className={"faq-chevron" + (isOpen ? " open" : "")} aria-hidden="true"><Icon name="chevron-d" size={18} /></span>
                    </button>
                    {isOpen && (
                      <div id={pid} role="region" aria-labelledby={bid} className="faq-answer">
                        {it.a.map((p, j) => <p key={j} style={{ margin: j === 0 ? "0 0 12px" : "0 0 12px" }}>{p}</p>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <ContactCTA title={f.ctaTitle} body={f.ctaBody} primaryLabel={t.ui.bookPage.navCta} />
    </>
  );
}
