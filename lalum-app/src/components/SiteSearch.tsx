import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../context/LangContext";
import { Icon } from "./Icon";
import { externalLinks } from "../lib/content";

type Hit = { title: string; sub: string; to?: string; href?: string; keywords?: string };

// Normalise a string for tolerant matching: lowercase, strip Hebrew niqqud and
// punctuation, and fold Hebrew final letters to their base form so a query like
// "תשלום" also matches text that ends a word with "ם". Latin diacritics are
// folded too. The result is a clean, space-separated token stream.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // Hebrew niqqud / cantillation
    .replace(/[̀-ͯ]/g, "") // Latin combining marks
    .replace(/[ךםןףץ]/g, (c) => ({ "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" }[c] as string))
    .replace(/["'`׳״.,;:!?()\[\]{}<>\/\\|_+=~@#$%^&*־–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Bilingual synonym groups. If a query token belongs to a group, every other
// term in the group is also treated as matching, so "לשלם" finds the payment
// area and "meeting" finds booking. Kept small and practical.
const SYNONYMS: string[][] = [
  ["תשלום", "לשלם", "לשלמ", "תשלומים", "סליקה", "חשבונית", "חשבוניות", "כספים", "אשראי", "pay", "payment", "invoice", "billing", "checkout", "bit", "google pay", "apple pay"],
  ["פגישה", "פגישות", "תיאום", "לתאם", "יעוץ", "התייעצות", "שיחה", "זום", "טימס", "טלפון", "פרונטלי", "meeting", "book", "booking", "call", "consult", "consultation", "zoom", "teams", "phone", "schedule", "calendar"],
  ["נדלן", "נדל", "התחדשות", "עירונית", "תמא", "פינוי", "בינוי", "מקרקעין", "דיירים", "יזם", "קבלן", "real estate", "urban renewal", "tama", "property"],
  ["בינה", "מלאכותית", "ai", "אלגוריתם", "מודל", "artificial intelligence", "machine learning"],
  ["גישור", "בוררות", "יישוב", "סכסוך", "mediation", "arbitration", "dispute"],
  ["מסמכים", "קבצים", "תיקייה", "העלאה", "documents", "files", "upload", "portal", "לקוחות", "client"],
  ["הדרכה", "קורס", "סדנה", "הרצאה", "training", "course", "workshop", "lecture"],
  ["מאמר", "מאמרים", "תובנות", "בלוג", "מדריך", "מדריכים", "ידע", "insight", "insights", "article", "guide", "knowledge", "faq", "שאלות"],
];

function expand(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const tok of tokens) {
    for (const group of SYNONYMS) {
      if (group.some((g) => norm(g) === tok || norm(g).startsWith(tok) || tok.startsWith(norm(g)))) {
        for (const g of group) out.add(norm(g));
      }
    }
  }
  return [...out].filter(Boolean);
}

// A lightweight, client-side site search over the whole app: pages, articles,
// advisory areas, and the knowledge links. Built from the current-language
// dictionary so it stays in sync with the content and needs no backend. The
// matching is tolerant (niqqud, final letters, synonyms) and ranked so the most
// relevant destination surfaces first.
export function SiteSearch() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const index = useMemo<Hit[]>(() => {
    const nav = t.ui.nav;
    const items: Hit[] = [
      { title: nav.home, sub: t.ui.seeWhatWeDo, to: "/", keywords: "home ראשי בית start" },
      { title: nav.advisory, sub: t.advisory.heroLede, to: "/advisory", keywords: "נדלן התחדשות עירונית תמא גישור בינה מלאכותית ai mediation real estate advisory" },
      { title: nav.training, sub: t.training.heroLede, to: "/training", keywords: "קורס סדנה הרצאה הדרכה training course" },
      { title: nav.insights, sub: t.insights.heroLede, to: "/insights", keywords: "מאמרים תובנות בלוג articles insights" },
      { title: nav.knowledge, sub: t.knowledge.sub, to: "/knowledge", keywords: "ידע מדריכים שאלות ותשובות faq knowledge guides q&a" },
      { title: t.ui.bookPage.navCta, sub: t.ui.bookPage.subtitleLive, to: "/book", keywords: "פגישה תיאום שיחה זום טימס טלפון פרונטלי meeting book call zoom teams phone" },
      { title: t.ui.clientLogin, sub: t.ui.footer.client, to: "/login", keywords: "כניסה התחברות פורטל מסמכים תשלום לשלם client login portal documents pay payment" },
    ];
    for (const a of t.data.articles) items.push({ title: a.title, sub: a.dek, to: `/insights/${a.slug}`, keywords: `${a.category} מאמר article` });
    for (const s of t.data.advisoryServices) items.push({ title: s.title, sub: s.body, to: "/advisory", keywords: "ייעוץ advisory" });
    items.push({ title: t.ui.footerLinks.qa, sub: t.knowledge.sub, href: externalLinks.qa, keywords: "שאלות ותשובות faq q&a knowledge" });
    items.push({ title: t.ui.footerLinks.articles, sub: t.insights.heroLede, href: externalLinks.articles, keywords: "מאמרים articles" });
    return items;
  }, [t]);

  const results = useMemo<Hit[]>(() => {
    const raw = norm(q);
    if (!raw) return [];
    const scored: { hit: Hit; score: number }[] = [];
    for (const it of index) {
      const title = norm(it.title);
      const sub = norm(it.sub);
      const keys = norm(it.keywords ?? "");
      const hay = `${title} ${sub} ${keys}`;
      // Every token from the *original* query must be represented (AND), with
      // synonyms allowed to satisfy a token. Score rewards title/prefix hits.
      let ok = true;
      let score = 0;
      for (const base of raw.split(" ")) {
        const variants = expand([base]);
        const matched = variants.some((v) => hay.includes(v));
        if (!matched) { ok = false; break; }
        if (title.includes(base)) score += title.startsWith(base) ? 12 : 8;
        else if (sub.includes(base)) score += 4;
        else if (keys.includes(base)) score += 3;
        else score += 1; // matched only via a synonym
      }
      if (ok) scored.push({ hit: it, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map((s) => s.hit);
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
