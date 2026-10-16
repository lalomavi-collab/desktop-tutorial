import { useMemo, useRef, useState } from "react";
import { Link } from "../components/AppLink";
import { ContactCTA } from "../components/ContactCTA";
import { PageMeta } from "../components/PageMeta";
import { AmbientBackground } from "../components/AmbientBackground";
import { pageNode, pageJsonLd } from "../lib/schema";
import { useLang } from "../context/LangContext";
import { blogMeta } from "../lib/blogMeta";
import { coverFor } from "../lib/covers";
import { TOPICS_IN_ORDER, topicBySlug, topicPath } from "../lib/topics";
import articleIndex from "../data/articleIndex.json";

// The articles page: a lead story, a reel, a topic filter and one grid in which
// every article has its own cover (src/lib/covers.ts). Nothing here changes the
// copy; the filter reuses the topic names the hubs already carry.

type Card = {
  slug: string;
  title: string;
  dek: string;
  category: string;
  date: string;
  read?: string;
  topic: string;
};

const topicOf = (slug: string) => (articleIndex as Record<string, { topic: string | null }>)[slug]?.topic ?? "practice";

export function Insights() {
  const { t } = useLang();
  const ins = t.insights;
  const [topic, setTopic] = useState<string>("all");
  const gridTop = useRef<HTMLDivElement>(null);

  // Imported blog first (newest on top), then the curated bilingual pieces; one
  // card per slug, so a piece that exists in both lists is not shown twice.
  const cards = useMemo(() => {
    const seen = new Set<string>();
    const out: Card[] = [];
    const push = (c: Omit<Card, "topic">) => { if (!seen.has(c.slug)) { seen.add(c.slug); out.push({ ...c, topic: topicOf(c.slug) }); } };
    blogMeta.forEach((b) => push({ slug: b.slug, title: b.title, dek: b.excerpt, category: ins.fromBlog, date: b.date }));
    t.data.articles.forEach((a) => push({ slug: a.slug, title: a.title, dek: a.dek, category: a.category, date: a.date, read: a.read }));
    return out;
  }, [t, ins.fromBlog]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    cards.forEach((c) => m.set(c.topic, (m.get(c.topic) ?? 0) + 1));
    return m;
  }, [cards]);
  const topics = TOPICS_IN_ORDER.filter((x) => (counts.get(x.slug) ?? 0) > 0);

  const lead = cards[0];
  const side = cards.slice(1, 3);
  const rest = cards.slice(3);
  const label = (c: Card) => topicBySlug.get(c.topic)?.name ?? c.category;

  const pick = (slug: string) => {
    setTopic(slug);
    gridTop.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const tile = (c: Card, i: number, cls = "") => (
    <Link key={c.slug} to={`/insights/${c.slug}`} className={`ins-card ${cls}`} hidden={topic !== "all" && c.topic !== topic} style={{ ["--d" as string]: `${Math.min(i, 8) * 55}ms` }}>
      <div className="ins-cover">
        <img src={coverFor(c.slug)} alt="" width={1200} height={630} loading={i < 6 && cls ? "eager" : "lazy"} decoding="async" />
        <span className="ins-tag">{label(c)}</span>
      </div>
      <div className="ins-body">
        <h2 className="serif ins-title">{c.title}</h2>
        <p className="ins-dek">{c.dek}</p>
        <div className="ins-meta">
          <span>{c.date}</span>{c.read ? <><span aria-hidden="true">·</span><span>{c.read}</span></> : null}
          <span className="ins-go">{t.ui.article.read} &rarr;</span>
        </div>
      </div>
    </Link>
  );

  return (
    <>
      <PageMeta title={t.seo.insights.title} description={t.seo.insights.desc} path="/insights" jsonLd={pageJsonLd([pageNode("CollectionPage", t.seo.insights.title, t.seo.insights.desc, "https://lalumapp.com/insights")])} />

      {/* HERO: headline beside the reel */}
      <section className="ins-hero">
        <AmbientBackground variant="warm" />
        <div className="wrap ins-hero-in">
          <div className="ins-hero-text">
            <span className="pill">{ins.heroPill}</span>
            <h1 className="serif ins-h1">
              {ins.heroH1a} <span className="italic-clay">{ins.heroH1b}</span>
            </h1>
            <p className="lede" style={{ maxWidth: "56ch", margin: "22px 0 0" }}>{ins.heroLede}</p>
          </div>
          <div className="ins-reel" aria-hidden="true">
            <video muted loop playsInline autoPlay preload="none" poster="/media/lalum-intro.jpg" tabIndex={-1}>
              <source src="/media/lalum-reel.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      {/* LEAD + TWO */}
      <section className="wrap ins-feature">
        {lead && tile(lead, 0, "ins-lead")}
        <div className="ins-side">{side.map((c, i) => tile(c, i + 1, "ins-compact"))}</div>
      </section>

      {/* FILTER */}
      <div ref={gridTop} className="wrap ins-filter" role="group" aria-label={t.ui.article.allArticles} style={{ scrollMarginTop: 96 }}>
        <button type="button" className="ins-chip" aria-pressed={topic === "all"} onClick={() => pick("all")}>
          {t.ui.article.allArticles} <b>{cards.length}</b>
        </button>
        {topics.map((x) => (
          <button key={x.slug} type="button" className="ins-chip" aria-pressed={topic === x.slug} onClick={() => pick(x.slug)}>
            {x.name} <b>{counts.get(x.slug)}</b>
          </button>
        ))}
      </div>

      {/* GRID: every card stays in the page, so the list keeps linking to all of them */}
      <section className="wrap" style={{ paddingBottom: 28 }}>
        <div className="ins-grid">{rest.map((c, i) => tile(c, i))}</div>
        {topic !== "all" && topicBySlug.get(topic) ? (
          <p style={{ textAlign: "center", margin: "28px 0 0" }}>
            <Link to={topicPath(topic)} className="btn btn-outline">{topicBySlug.get(topic)!.name}</Link>
          </p>
        ) : null}
      </section>

      {/* crawlable topic hubs, independent of the filter state */}
      <nav className="wrap ins-hubs" aria-label={ins.heroPill} style={{ paddingBottom: "var(--sec)" }}>
        {topics.map((x) => <Link key={x.slug} to={topicPath(x.slug)}>{x.name}</Link>)}
      </nav>

      <ContactCTA title={ins.ctaTitle} body={ins.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
