import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../context/LangContext";
import { Icon } from "./Icon";
import { externalLinks } from "../lib/content";

type Hit = { title: string; sub: string; to?: string; href?: string };

// A lightweight, client-side site search over the whole app: pages, articles,
// advisory areas, and the knowledge links. Built from the current-language
// dictionary so it stays in sync with the content and needs no backend.
export function SiteSearch() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const index = useMemo<Hit[]>(() => {
    const nav = t.ui.nav;
    const items: Hit[] = [
      { title: nav.home, sub: t.ui.seeWhatWeDo, to: "/" },
      { title: nav.advisory, sub: t.advisory.heroLede, to: "/advisory" },
      { title: nav.training, sub: t.training.heroLede, to: "/training" },
      { title: nav.insights, sub: t.insights.heroLede, to: "/insights" },
      { title: nav.knowledge, sub: t.knowledge.sub, to: "/knowledge" },
      { title: t.ui.bookPage.navCta, sub: t.ui.bookPage.subtitleLive, to: "/book" },
      { title: t.ui.clientLogin, sub: "", to: "/login" },
    ];
    for (const a of t.data.articles) items.push({ title: a.title, sub: a.dek, to: `/insights/${a.slug}` });
    for (const s of t.data.advisoryServices) items.push({ title: s.title, sub: s.body, to: "/advisory" });
    items.push({ title: t.ui.footerLinks.qa, sub: "", href: externalLinks.qa });
    items.push({ title: t.ui.footerLinks.articles, sub: "", href: externalLinks.articles });
    return items;
  }, [t]);

  const results = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return index.filter((it) => (it.title + " " + it.sub).toLowerCase().includes(s)).slice(0, 8);
  }, [q, index]);

  function go(hit?: Hit) {
    const it = hit ?? results[active];
    if (!it) return;
    setQ("");
    setActive(0);
    if (it.to) navigate(it.to);
    else if (it.href) window.open(it.href, "_blank", "noopener");
  }

  return (
    <div style={{ position: "relative", maxWidth: 520, marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line-strong)", background: "var(--card)", borderRadius: 9999, padding: "12px 18px" }}>
        <Icon name="search" size={18} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); go(); }
            else if (e.key === "Escape") { setQ(""); }
          }}
          placeholder={t.ui.search.placeholder}
          aria-label={t.ui.search.placeholder}
          style={{ border: "none", outline: "none", background: "transparent", fontSize: 15.5, flex: 1, color: "var(--ink)", font: "inherit", minWidth: 0 }}
        />
      </div>
      {q.trim() !== "" && (
        <div role="listbox" style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: "calc(100% + 8px)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 24px 50px -30px rgba(60,45,30,.5)", overflow: "hidden", zIndex: 20 }}>
          {results.length === 0 ? (
            <div className="muted" style={{ padding: "16px 18px", fontSize: 14 }}>{t.ui.search.none}</div>
          ) : (
            results.map((it, i) => (
              <button
                key={it.title + i}
                type="button"
                onClick={() => go(it)}
                onMouseEnter={() => setActive(i)}
                style={{ display: "block", width: "100%", textAlign: "start", padding: "12px 18px", background: i === active ? "var(--clay-tint)" : "transparent", border: "none", borderBottom: i < results.length - 1 ? "1px solid var(--line)" : "none", cursor: "pointer", font: "inherit", color: "inherit" }}
              >
                <span style={{ fontWeight: 600, fontSize: 14.5 }}>{it.title}</span>
                {it.sub && (
                  <span className="muted" style={{ display: "block", fontSize: 12.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.sub}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
