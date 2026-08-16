import { useEffect, useRef, useState } from "react";
import { useLang } from "../context/LangContext";
import { whatsappNumber, contactEmail } from "../lib/content";

// Branded Calendly inline embed. Users schedule without leaving lalumapp.com.
// Colors are Calendly widget params (hex without '#'). Default is the LALUM
// premium dark palette (obsidian background, cream text, gold accent).

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (opts: {
        url: string;
        parentElement: HTMLElement;
        prefill?: { name?: string; email?: string };
        utm?: Record<string, string>;
      }) => void;
    };
  }
}

type Theme = { background: string; text: string; primary: string };

const OBSIDIAN_GOLD: Theme = { background: "0a0a0a", text: "fffdd0", primary: "d4af37" };

type Props = {
  url: string;
  prefill?: { name?: string; email?: string };
  theme?: Partial<Theme>;
  height?: number;
  onScheduled?: () => void;
};

const COPY = {
  he: {
    loading: "טוען את היומן…",
    trouble: "היומן לא נטען?",
    openNew: "לפתיחת היומן בחלון חדש",
    errTitle: "לא הצלחנו לטעון את היומן",
    errBody: "אפשר לקבוע דרך הקישור הישיר, או להשאיר פרטים ונחזור אליכם.",
    whatsapp: "תיאום בוואטסאפ",
    email: "לשליחת מייל",
  },
  en: {
    loading: "Loading the calendar…",
    trouble: "Calendar not loading?",
    openNew: "Open the calendar in a new tab",
    errTitle: "We couldn't load the calendar",
    errBody: "You can book via the direct link, or leave your details and we'll get back to you.",
    whatsapp: "Schedule on WhatsApp",
    email: "Send an email",
  },
  es: {
    loading: "Cargando el calendario…",
    trouble: "¿El calendario no carga?",
    openNew: "Abrir el calendario en una pestaña nueva",
    errTitle: "No pudimos cargar el calendario",
    errBody: "Puede reservar a través del enlace directo, o dejar sus datos y le responderemos.",
    whatsapp: "Coordinar por WhatsApp",
    email: "Enviar un correo",
  },
  fr: {
    loading: "Chargement du calendrier…",
    trouble: "Le calendrier ne se charge pas ?",
    openNew: "Ouvrir le calendrier dans un nouvel onglet",
    errTitle: "Nous n'avons pas pu charger le calendrier",
    errBody: "Vous pouvez réserver via le lien direct, ou laisser vos coordonnées et nous vous recontacterons.",
    whatsapp: "Planifier sur WhatsApp",
    email: "Envoyer un e-mail",
  },
  ar: {
    loading: "جارٍ تحميل التقويم…",
    trouble: "التقويم لا يُحمَّل؟",
    openNew: "افتحوا التقويم في تبويب جديد",
    errTitle: "لم نتمكن من تحميل التقويم",
    errBody: "يمكنكم الحجز عبر الرابط المباشر، أو ترك بياناتكم وسنعاود التواصل معكم.",
    whatsapp: "التنسيق عبر واتساب",
    email: "إرسال بريد إلكتروني",
  },
} as const;

let loader: Promise<void> | null = null;
function loadCalendly(): Promise<void> {
  if (window.Calendly) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://assets.calendly.com/assets/external/widget.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://assets.calendly.com/assets/external/widget.js";
    js.async = true;
    js.onload = () => resolve();
    js.onerror = () => reject(new Error("calendly_load_failed"));
    document.body.appendChild(js);
  });
  return loader;
}

function withTheme(url: string, t: Theme): string {
  const u = new URL(url);
  u.searchParams.set("background_color", t.background);
  u.searchParams.set("text_color", t.text);
  u.searchParams.set("primary_color", t.primary);
  u.searchParams.set("hide_gdpr_banner", "1");
  return u.toString();
}

export function SchedulingEmbed({ url, prefill, theme, height = 680, onScheduled }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { lang } = useLang();
  const c = COPY[lang];
  const t: Theme = { ...OBSIDIAN_GOLD, ...theme };
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    loadCalendly()
      .then(() => {
        if (!alive || !ref.current || !window.Calendly) return;
        ref.current.innerHTML = "";
        window.Calendly.initInlineWidget({ url: withTheme(url, t), parentElement: ref.current, prefill });
        setStatus("ready");
      })
      .catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, t.background, t.text, t.primary, prefill?.name, prefill?.email]);

  useEffect(() => {
    if (!onScheduled) return;
    const cb = onScheduled;
    function onMsg(e: MessageEvent) {
      const d = e.data as { event?: string } | null;
      if (d && typeof d === "object" && d.event === "calendly.event_scheduled") cb();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onScheduled]);

  const waHref = `https://wa.me/${whatsappNumber}`;

  // Error fallback: the calendar script did not load (blocked, offline, or slow).
  // Never leave the visitor at a dead frame; offer the direct link plus two
  // channels that always work.
  if (status === "error") {
    return (
      <div style={{ minWidth: 320, borderRadius: 16, border: "1px solid var(--line-strong)", background: "var(--card)", padding: "26px 22px", textAlign: "center" }}>
        <p className="h3" style={{ fontSize: 19, margin: "0 0 6px" }}>{c.errTitle}</p>
        <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.6, margin: "0 0 18px", maxWidth: "44ch", marginInline: "auto" }}>{c.errBody}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-clay btn-sm">{c.openNew}</a>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">{c.whatsapp}</a>
          <a href={`mailto:${contactEmail}`} className="btn btn-ghost btn-sm">{c.email}</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: "relative", minWidth: 320, height, borderRadius: 16, overflow: "hidden" }}>
        <div ref={ref} style={{ width: "100%", height: "100%" }} />
        {status === "loading" && (
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--slate)", fontSize: 14.5 }}>
            <span className="embed-spinner" />
            {c.loading}
          </div>
        )}
      </div>
      {/* Persistent escape hatch: even when the widget "loads" it can render an
          empty frame (blocked third-party cookies, ad blockers); the direct link
          always works. */}
      <p style={{ marginTop: 12, fontSize: 13, color: "var(--slate)", textAlign: "center" }}>
        {c.trouble}{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--clay)", fontWeight: 600 }}>{c.openNew}</a>
      </p>
    </div>
  );
}
