import { useMemo, useState } from "react";
import { scriptDir } from "../lib/hreflang";
import { useSearchParams } from "react-router-dom";
import { Link } from "../components/AppLink";
import { Icon } from "../components/Icon";
import { ContactCTA } from "../components/ContactCTA";
import { PageMeta } from "../components/PageMeta";
import { pageNode, pageJsonLd } from "../lib/schema";
import { useLang } from "../context/LangContext";
import {
  AREAS, DATABASES, EMPTY_QUERY, areaLabel, countByArea, courtsInCorpus,
  rulingTitle, searchRulings, siteSearchUrl, webSearchUrl,
  type AreaId, type Ruling, type Sort,
} from "../lib/rulings";

// Case law search.
//
// The page holds its whole state in the URL, so a search is a link: a colleague
// can be sent /rulings?q=הזיות&area=ai and lands on the same screen. It is also
// what lets the empty state be honest, because the query it could not answer is
// the query it hands to the official databases.

const sectionStyle = { fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em", color: "var(--slate)", margin: "16px 0 6px" } as const;
const proseStyle = { fontSize: 15, lineHeight: 1.7, margin: 0, color: "var(--ink)" } as const;

function Section({ label, children }: { label: string; children: string }) {
  return (
    <>
      <p style={sectionStyle}>{label}</p>
      <p style={proseStyle}>{children}</p>
    </>
  );
}

function RulingCard({ r }: { r: Ruling }) {
  const { t } = useLang();
  const c = t.rulings;
  const [copied, setCopied] = useState(false);
  const cite = `${rulingTitle(r)} (${r.dateLabel})`;

  return (
    <article style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: "26px 28px", borderTop: "3px solid #9a7328" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", justifyContent: "space-between" }}>
        {/* Foreign captions and courts sit in a Hebrew page. Without their own
            direction the citation dot and the date land on the wrong side. */}
        <h2 className="serif" style={{ fontSize: 21, fontWeight: 500, margin: 0 }} {...scriptDir(rulingTitle(r))}>{rulingTitle(r)}</h2>
        <button
          type="button"
          className="btn btn-outline"
          style={{ padding: "6px 12px", fontSize: 13 }}
          onClick={() => {
            navigator.clipboard?.writeText(cite).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            }, () => undefined);
          }}
        >
          {copied ? c.copied : c.copy}
        </button>
      </div>

      {/* The court is usually English and the date label is Hebrew, so the
          direction belongs on each part and not on the line that holds both:
          marking the whole line by the court left six Hebrew dates flowing the
          wrong way. */}
      <p className="muted" style={{ fontSize: 13.5, margin: "8px 0 0" }}>
        <span {...scriptDir(r.court)}>{r.court}</span> · <span {...scriptDir(r.dateLabel)}>{r.dateLabel}</span>
        {r.bench ? ` · ${c.bench}: ${r.bench}` : ""}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
        {r.areas.map((a) => (
          <span key={a} className="pill" style={{ fontSize: 12 }}>{areaLabel(a)}</span>
        ))}
        {r.tags.map((tag) => (
          <span key={tag} style={{ fontSize: 12, color: "var(--slate)", border: "1px solid var(--line)", borderRadius: 9999, padding: "3px 10px" }}>{tag}</span>
        ))}
      </div>

      {r.facts && <Section label={c.facts}>{r.facts}</Section>}
      {r.issue && <Section label={c.issue}>{r.issue}</Section>}
      <Section label={c.holding}>{r.holding}</Section>
      {r.quote && (
        <blockquote style={{ margin: "14px 0 0", padding: "10px 16px", borderInlineStart: "3px solid #9a7328", background: "var(--clay-tint)", fontSize: 15, lineHeight: 1.6 }}>
          {r.quote}
        </blockquote>
      )}
      {r.implications && <Section label={c.implications}>{r.implications}</Section>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 18 }}>
        {r.article && (
          <Link to={`/insights/${r.article}`} style={{ fontSize: 14, fontWeight: 600, color: "var(--clay)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {c.readArticle} <Icon name="chevron-l" size={14} />
          </Link>
        )}
        {r.sources.map((s) => (
          <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "var(--slate)" }}>
            {c.source}: {s.label}
          </a>
        ))}
      </div>
    </article>
  );
}

// The official databases, with the visitor's own words carried into them.
function ExternalPanel({ title, body, terms, q }: { title: string; body: string; terms: string[]; q: string }) {
  const { t } = useLang();
  const c = t.rulings;
  const queries = q.trim() ? [q.trim()] : terms;

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: "26px 28px" }}>
      <h2 className="serif" style={{ fontSize: 22, fontWeight: 500, margin: 0 }} {...scriptDir(title)}>{title}</h2>
      {body && <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--slate)", margin: "10px 0 0" }}>{body}</p>}

      <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "flex", flexDirection: "column", gap: 14 }}>
        {queries.map((query) => (
          <li key={query}>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>{query}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DATABASES.map((db) => (
                <a key={db.site} className="btn btn-outline" style={{ padding: "6px 13px", fontSize: 13 }} href={siteSearchUrl(db.site, query)} target="_blank" rel="noopener noreferrer">
                  {db.label}
                </a>
              ))}
              <a className="btn btn-outline" style={{ padding: "6px 13px", fontSize: 13 }} href={webSearchUrl(query)} target="_blank" rel="noopener noreferrer">
                {c.webSearch}
              </a>
            </div>
          </li>
        ))}
      </ul>

      <p className="muted" style={{ fontSize: 13, marginTop: 18 }}>
        {c.externalForm}:{" "}
        {DATABASES.map((db, i) => (
          <span key={db.site}>
            {i > 0 ? " · " : ""}
            <a href={db.form} target="_blank" rel="noopener noreferrer">{db.label}</a>
          </span>
        ))}
      </p>
    </div>
  );
}

export function Rulings() {
  const { t } = useLang();
  const c = t.rulings;
  const [params, setParams] = useSearchParams();

  const q = params.get("q") ?? EMPTY_QUERY.q;
  const area = (params.get("area") ?? EMPTY_QUERY.area) as AreaId | "all";
  const court = params.get("court") ?? EMPTY_QUERY.court;
  const sort = (params.get("sort") ?? EMPTY_QUERY.sort) as Sort;

  // One writer for the whole query, so a filter never drops the search term and
  // an empty value leaves the URL clean rather than carrying ?court=all.
  function update(patch: Partial<{ q: string; area: string; court: string; sort: string }>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  }

  const results = useMemo(() => searchRulings({ q, area, court, sort }), [q, area, court, sort]);
  const courts = useMemo(() => courtsInCorpus(), []);
  const activeArea = AREAS.find((a) => a.id === area);
  const areaIsEmpty = !!activeArea && countByArea(activeArea.id) === 0;
  const filtered = q.trim() !== "" || area !== "all" || court !== "all";

  const selectStyle = {
    border: "1px solid var(--line-strong)", background: "var(--card)", borderRadius: 9999,
    padding: "10px 16px", fontSize: 14.5, color: "var(--ink)", font: "inherit",
  } as const;

  return (
    <>
      <PageMeta
        title={t.seo.rulings.title}
        description={t.seo.rulings.desc}
        path="/rulings"
        jsonLd={pageJsonLd([pageNode("CollectionPage", t.seo.rulings.title, t.seo.rulings.desc, "https://lalumapp.com/rulings")])}
      />

      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="wrap" style={{ maxWidth: 900, padding: "96px 32px 32px", textAlign: "center" }}>
          <span className="pill">{c.heroPill}</span>
          <h1 className="serif" style={{ fontSize: "clamp(30px, 7.5vw, 54px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "20ch" }}>
            {c.title}
          </h1>
          <p className="lede" style={{ maxWidth: "62ch", margin: "26px auto 0" }}>{c.sub}</p>
        </div>
      </section>

      {/* SEARCH AND FILTERS */}
      <section className="wrap" style={{ paddingBottom: 24 }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line-strong)", background: "var(--card)", borderRadius: 9999, padding: "12px 18px" }}>
            <Icon name="search" size={18} />
            <input
              value={q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder={c.searchPlaceholder}
              aria-label={c.searchLabel}
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 15.5, flex: 1, color: "var(--ink)", font: "inherit", minWidth: 0 }}
            />
            {filtered && (
              <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })} style={{ border: "none", background: "transparent", font: "inherit", fontSize: 13.5, color: "var(--slate)", cursor: "pointer" }}>
                {c.clear}
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 18 }}>
            <button type="button" className="btn btn-outline" style={{ padding: "8px 15px", fontSize: 14, fontWeight: area === "all" ? 700 : 500 }} onClick={() => update({ area: "all" })}>
              {c.areaAll}
            </button>
            {AREAS.map((a) => (
              <button key={a.id} type="button" className="btn btn-outline" style={{ padding: "8px 15px", fontSize: 14, fontWeight: area === a.id ? 700 : 500 }} onClick={() => update({ area: a.id })}>
                {a.label} <span style={{ color: "var(--slate)" }}>{countByArea(a.id)}</span>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 14 }}>
            <select aria-label={c.courtLabel} value={court} onChange={(e) => update({ court: e.target.value })} style={selectStyle}>
              <option value="all">{c.courtAll}</option>
              {courts.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select aria-label={c.sortLabel} value={sort} onChange={(e) => update({ sort: e.target.value })} style={selectStyle}>
              <option value="relevance">{c.sortRelevance}</option>
              <option value="newest">{c.sortNewest}</option>
              <option value="oldest">{c.sortOldest}</option>
            </select>
          </div>

          <p className="muted" style={{ textAlign: "center", fontSize: 13.5, marginTop: 16 }}>
            {results.length} {c.results}
          </p>
        </div>
      </section>

      {/* RESULTS */}
      <section className="wrap" style={{ paddingBottom: 32 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
          {results.map((r) => <RulingCard key={r.id} r={r} />)}

          {results.length === 0 && (
            <ExternalPanel
              title={areaIsEmpty ? c.emptyAreaTitle : c.noneTitle}
              body={areaIsEmpty ? c.emptyAreaBody : c.noneBody}
              terms={activeArea ? activeArea.terms : AREAS.map((a) => a.terms[0])}
              q={q}
            />
          )}

          {results.length > 0 && (
            <ExternalPanel title={c.externalTitle} body={activeArea?.blurb ?? ""} terms={activeArea ? activeArea.terms : AREAS.map((a) => a.terms[0])} q={q} />
          )}

          <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>{c.disclaimer}</p>
        </div>
      </section>

      <ContactCTA title={t.insights.ctaTitle} body={t.insights.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
