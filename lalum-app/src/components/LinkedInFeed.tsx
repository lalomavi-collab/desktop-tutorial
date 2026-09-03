import { useEffect } from "react";
import { useLang } from "../context/LangContext";

// Live LinkedIn posts on the home page, via the SociableKit widget. The widget
// script scans the page for the .sk-ww-linkedin-profile-post div (matched by its
// data-embed-id) and renders the feed into it. The script is added on mount and
// removed on unmount so it re-runs across SPA navigation.
const EMBED_ID = "25702004";
const WIDGET_SRC = "https://widgets.sociablekit.com/linkedin-profile-posts/widget.js";

const PROFILE_URL = "https://www.linkedin.com/in/dr-avraham-lalum-ab833929";

function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

const COPY = {
  he: {
    eyebrow: "LinkedIn",
    title: "מהפוסטים שלי בלינקדאין",
    sub: "עדכונים ותובנות מקצועיות, ישירות מהפרופיל.",
    card: "העוקבים אחריי בלינקדאין מקבלים ראשונים ניתוחים משפטיים, עדכוני רגולציה, ותובנות על AI במשפט.",
    cta: "עקבו אחריי בלינקדאין",
  },
  en: {
    eyebrow: "LinkedIn",
    title: "From my LinkedIn",
    sub: "Professional updates and insights, straight from the profile.",
    card: "Followers are first to get legal analysis, regulatory updates, and insights on AI in law.",
    cta: "Follow me on LinkedIn",
  },
  es: {
    eyebrow: "LinkedIn",
    title: "Desde mi LinkedIn",
    sub: "Actualizaciones e ideas profesionales, directamente desde el perfil.",
    card: "Los seguidores reciben primero análisis legal, actualizaciones regulatorias e ideas sobre la IA en el derecho.",
    cta: "Sígueme en LinkedIn",
  },
  fr: {
    eyebrow: "LinkedIn",
    title: "Depuis mon LinkedIn",
    sub: "Mises à jour et analyses professionnelles, directement depuis le profil.",
    card: "Les abonnés reçoivent en premier des analyses juridiques, des mises à jour réglementaires et des réflexions sur l'IA dans le droit.",
    cta: "Suivez-moi sur LinkedIn",
  },
  ar: {
    eyebrow: "LinkedIn",
    title: "من صفحتي على LinkedIn",
    sub: "تحديثات ورؤى مهنية، مباشرة من الملف الشخصي.",
    card: "يحصل المتابعون أولاً على التحليلات القانونية والتحديثات التنظيمية والرؤى حول الذكاء الاصطناعي في مجال القانون.",
    cta: "تابعني على LinkedIn",
  },
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
      <div style={{ maxWidth: "56ch", margin: "0 0 24px" }}>
        <p className="eyebrow">{c.eyebrow}</p>
        <h2 className="h2">{c.title}</h2>
        <p className="lede" style={{ marginTop: 12 }}>{c.sub}</p>
      </div>
      {/* The SociableKit script replaces this div's content with the live feed
          once it loads. Until then (or if it is ever blocked) the fallback card
          keeps the section polished and inviting, never a bare link in a void. */}
      <div className="sk-ww-linkedin-profile-post" data-embed-id={EMBED_ID}>
        <div className="li-fallback">
          <span className="li-fallback-mark"><LinkedInIcon /></span>
          <p className="li-fallback-text">{c.card}</p>
          <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="footer-linkedin-cta li-fallback-cta">
            <LinkedInIcon />
            <span>{c.cta}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
