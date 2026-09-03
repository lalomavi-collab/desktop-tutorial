import { useParams, Navigate } from "react-router-dom";
import { Link } from "../components/AppLink";
import { PageMeta } from "../components/PageMeta";
import { ContactCTA } from "../components/ContactCTA";
import { useLang } from "../context/LangContext";
import { pageNode, pageJsonLd } from "../lib/schema";
import { articlesByTopic, topicBySlug, topicPath } from "../lib/topics";

// One subject's writing, on its own page. The list is every article in the
// topic, titles only: the title is the anchor text, and the standfirst is a
// summary of prose that already lives on the article's own page.

export function Topic() {
  const { topic: slug } = useParams();
  const { t } = useLang();
  const topic = slug ? topicBySlug.get(slug) : undefined;
  if (!topic) return <Navigate to="/insights" replace />;

  const articles = articlesByTopic(t).get(topic.slug) ?? [];
  const url = `https://lalumapp.com${topicPath(topic.slug)}`;

  return (
    <>
      <PageMeta
        title={`${topic.title} | LALUM`}
        description={topic.desc}
        path={topicPath(topic.slug)}
        jsonLd={pageJsonLd([pageNode("CollectionPage", topic.title, topic.desc, url)])}
      />

      <section className="wrap" style={{ maxWidth: 860, padding: "88px 32px 8px" }}>
        <p className="eyebrow"><Link to="/insights" style={{ color: "inherit" }}>{t.insights.heroPill}</Link></p>
        <h1 className="serif" style={{ fontSize: "clamp(28px, 6.5vw, 44px)", lineHeight: 1.14, letterSpacing: "-0.02em", margin: "14px 0 18px" }}>
          {topic.name}
        </h1>
        <p className="lede" style={{ maxWidth: "60ch", margin: 0 }}>{topic.lede}</p>
        {topic.pillar ? (
          <p style={{ margin: "22px 0 0" }}>
            <Link to={`/${topic.pillar.path}`} className="btn btn-outline">{topic.pillar.label}</Link>
          </p>
        ) : null}
      </section>

      <section className="wrap section" style={{ maxWidth: 860 }}>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {articles.map((a) => (
            <li key={a.slug}>
              <Link
                to={`/insights/${a.slug}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "15px 20px", color: "var(--ink)", textDecoration: "none" }}
              >
                <span className="serif" style={{ fontSize: 17, lineHeight: 1.4 }}>{a.title}</span>
                <span style={{ flex: "none", color: "var(--clay)" }} aria-hidden="true">&larr;</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <ContactCTA title={t.insights.ctaTitle} body={t.insights.ctaBody} primaryLabel={t.ui.initiateRisk} />
    </>
  );
}
