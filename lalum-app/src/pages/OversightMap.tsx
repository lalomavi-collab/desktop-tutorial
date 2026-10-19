import { useRef, useState } from "react";
import { PageMeta } from "../components/PageMeta";
import { Link } from "../components/AppLink";
import { LoopVideo } from "../components/LoopVideo";
import { pageNode, pageJsonLd } from "../lib/schema";
import { OVERSIGHT_PAGE, OVERSIGHT_POINTS, OVERSIGHT_SOURCES, type OversightSource } from "../lib/oversightMap";

// The oversight map: where two frameworks name a human being, quoted from the
// instruments. A picker on one side, the selected point's wording and source on
// the other. Nothing on this page is paraphrased law (see lib/oversightMap.ts).

type Filter = "all" | OversightSource;

export function OversightMap() {
  const [filter, setFilter] = useState<Filter>("all");
  const [pickedId, setPickedId] = useState<string>(OVERSIGHT_POINTS[0].id);
  const detailRef = useRef<HTMLElement>(null);
  const jsonLd = pageJsonLd([pageNode("WebPage", OVERSIGHT_PAGE.title, OVERSIGHT_PAGE.desc, OVERSIGHT_PAGE.url)]);

  const shown = OVERSIGHT_POINTS.filter((p) => filter === "all" || p.source === filter);
  const picked = shown.find((p) => p.id === pickedId) ?? shown[0];
  const meta = OVERSIGHT_SOURCES[picked.source];

  // On a phone the detail sits below the list, out of sight of the card just
  // tapped, so bring it into view (without motion for those who asked for none).
  const pick = (id: string) => {
    setPickedId(id);
    if (window.matchMedia("(max-width: 820px)").matches) {
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" }));
    }
  };

  const chooseFilter = (f: Filter) => {
    setFilter(f);
    const first = OVERSIGHT_POINTS.find((p) => f === "all" || p.source === f);
    if (first && !(f === "all" || OVERSIGHT_POINTS.find((p) => p.id === pickedId)?.source === f)) setPickedId(first.id);
  };

  return (
    <>
      <PageMeta title={`${OVERSIGHT_PAGE.title} | LALUM`} description={OVERSIGHT_PAGE.desc} path={`/${OVERSIGHT_PAGE.path}`} jsonLd={jsonLd} />

      <section className="wrap section" style={{ maxWidth: 1000, paddingTop: 60 }}>
        <div className="pillar-hero">
          <p className="eyebrow">{OVERSIGHT_PAGE.eyebrow}</p>
          <h1 className="serif" style={{ fontSize: "clamp(30px, 6.5vw, 46px)", lineHeight: 1.16, letterSpacing: "-0.015em", margin: "12px 0 18px" }}>
            {OVERSIGHT_PAGE.h1}
          </h1>
          <p className="lede" style={{ fontSize: 19, lineHeight: 1.7, color: "var(--slate)", maxWidth: "64ch", margin: 0 }}>{OVERSIGHT_PAGE.lede}</p>
        </div>
      </section>

      {/* The framing clip: what a lawyer still sells when a machine drafts in
          seconds, set against two verbatim lines from the Supreme Court. */}
      <section className="wrap" style={{ maxWidth: 1000, paddingBottom: 12 }}>
        <LoopVideo src="/media/lalum-legal-ai-layer.mp4" poster="/media/lalum-legal-ai-layer.jpg" className="engine-video" label={OVERSIGHT_PAGE.videoAlt} />
      </section>

      <section className="wrap section section-line" style={{ maxWidth: 1000 }}>
        <div role="group" aria-label={OVERSIGHT_PAGE.filterLabel} style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 24px" }}>
          {([["all", OVERSIGHT_PAGE.filterAll], ["ai-act", OVERSIGHT_SOURCES["ai-act"].label], ["nist", OVERSIGHT_SOURCES.nist.label]] as [Filter, string][]).map(([f, label]) => (
            <button
              key={f}
              type="button"
              className={"nav-pill" + (filter === f ? " active" : "")}
              aria-pressed={filter === f}
              onClick={() => chooseFilter(f)}
              dir="auto"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="oversight-grid">
          <div role="group" aria-label={OVERSIGHT_PAGE.pickLabel} className="oversight-list">
            {shown.map((p) => {
              const active = p.id === picked.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={"card oversight-pick" + (active ? " active" : "")}
                  aria-pressed={active}
                  onClick={() => pick(p.id)}
                >
                  <span className="oversight-pick-ref" dir="ltr">{OVERSIGHT_SOURCES[p.source].label} · {p.ref}</span>
                  <span className="oversight-pick-title">{p.title}</span>
                </button>
              );
            })}
          </div>

          <article ref={detailRef} className="card oversight-detail" aria-live="polite">
            <p className="eyebrow" style={{ margin: 0, textTransform: "none" }}>
              <span dir="ltr">{meta.label} · {picked.ref}</span> · {meta.status}
            </p>
            <h2 className="h2" style={{ margin: "10px 0 14px" }}>{picked.title}</h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, margin: "0 0 20px" }}><b>{OVERSIGHT_PAGE.humanLabel}: </b>{picked.human}</p>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", color: "var(--slate)", margin: "0 0 8px" }}>{OVERSIGHT_PAGE.quoteLabel}</p>
            <blockquote dir="ltr" lang="en" className="oversight-quote">{picked.quote}</blockquote>
            <p style={{ margin: "16px 0 0" }}>
              <a href={picked.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--clay)", fontWeight: 600 }}>
                {OVERSIGHT_PAGE.sourceLabel} &rarr;
              </a>
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--slate)", margin: "18px 0 0", paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <b>{OVERSIGHT_PAGE.scopeLabel}: </b>{meta.scope}
            </p>
          </article>
        </div>
      </section>

      <section className="wrap section" style={{ maxWidth: 760, textAlign: "center" }}>
        <p style={{ fontSize: 15.5, margin: "0 0 18px" }}>
          <b>{OVERSIGHT_PAGE.moreLabel}: </b>
          <Link to={OVERSIGHT_PAGE.moreHref} style={{ color: "var(--clay)", fontWeight: 600 }}>{OVERSIGHT_PAGE.moreTitle} &rarr;</Link>
        </p>
        <p style={{ fontSize: 14, color: "var(--slate)", margin: "0 0 10px" }}>{OVERSIGHT_PAGE.checked}</p>
        <p style={{ fontSize: 13, color: "var(--slate)", margin: 0 }}>{OVERSIGHT_PAGE.disclaimer}</p>
      </section>
    </>
  );
}
