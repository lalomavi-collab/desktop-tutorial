import { useEffect } from "react";
import { useLang } from "../context/LangContext";

// Live LinkedIn posts on the home page, via the SociableKit widget. The widget
// script scans the page for the .sk-ww-linkedin-profile-post div (matched by its
// data-embed-id) and renders the feed into it. The script is added on mount and
// removed on unmount so it re-runs across SPA navigation.
const EMBED_ID = "25702004";
const WIDGET_SRC = "https://widgets.sociablekit.com/linkedin-profile-posts/widget.js";

const PROFILE_URL = "https://www.linkedin.com/in/dr-avraham-lalum-ab833929";

const COPY = {
  he: { eyebrow: "LinkedIn", title: "מהפוסטים שלי בלינקדאין", sub: "עדכונים ותובנות מקצועיות, ישירות מהפרופיל.", cta: "צפו בפוסטים שלי בלינקדאין" },
  en: { eyebrow: "LinkedIn", title: "From my LinkedIn", sub: "Professional updates and insights, straight from the profile.", cta: "See my posts on LinkedIn" },
} as const;

export function LinkedInFeed() {
  const { lang } = useLang();
  const c = COPY[lang];

  useEffect(() => {
    const s = document.createElement("script");
    s.src = WIDGET_SRC;
    s.defer = true;
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, []);

  return (
    <section className="wrap section" aria-label={c.title}>
      <div style={{ maxWidth: "56ch", margin: "0 0 28px" }}>
        <p className="eyebrow">{c.eyebrow}</p>
        <h2 className="h2">{c.title}</h2>
        <p className="lede" style={{ marginTop: 12 }}>{c.sub}</p>
      </div>
      {/* The widget script replaces this div's content once it loads. Until then
          (or if it is blocked) the fallback link keeps the section useful. */}
      <div className="sk-ww-linkedin-profile-post" data-embed-id={EMBED_ID} style={{ minHeight: 80 }}>
        <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">{c.cta}</a>
      </div>
    </section>
  );
}
