import { useEffect, useMemo, useState } from "react";
import { useLang } from "../context/LangContext";
import { whatsappNumber, contactEmail } from "../lib/content";

// Inline scheduling embed. Users book without leaving lalumapp.com. Renders the
// provider's booking page in an iframe, so swapping the scheduling vendor (Zoho
// Bookings, or anything else that allows iframe embedding) only means changing
// the `url` this component receives, no component changes. Around the frame it
// keeps a loading state and an always-visible escape hatch (direct link,
// WhatsApp, email) so the visitor is never stranded at a blank or blocked frame.

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

// Best-effort prefill via query params. Param names are provider-specific and
// unverified for the currently connected provider; unsupported params are
// simply ignored by the destination page.
function withPrefill(url: string, prefill?: { name?: string; email?: string }): string {
  if (!url || !prefill) return url;
  try {
    const u = new URL(url);
    if (prefill.name) u.searchParams.set("name", prefill.name);
    if (prefill.email) u.searchParams.set("email", prefill.email);
    return u.toString();
  } catch {
    return url;
  }
}

export function SchedulingEmbed({ url, prefill, theme, height = 680, onScheduled }: Props) {
  const { lang } = useLang();
  const c = COPY[lang];
  const t: Theme = { ...OBSIDIAN_GOLD, ...theme };
  const src = useMemo(() => withPrefill(url, prefill), [url, prefill?.name, prefill?.email]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Reset to loading whenever the embedded URL changes (e.g. switching meeting
  // type), so the spinner shows again while the new frame loads.
  useEffect(() => { setStatus("loading"); }, [src]);

  useEffect(() => {
    if (!onScheduled) return;
    const cb = onScheduled;
    // Booking confirmation via postMessage: the event name/shape depends on
    // the connected provider and has not been verified here. This listens
    // broadly for anything that looks like a booking-confirmed event; if the
    // provider does not send one, onScheduled simply never fires (the visitor
    // still gets a confirmation from the provider itself, by email).
    function onMsg(e: MessageEvent) {
      const d = e.data as { event?: string } | null;
      if (d && typeof d === "object" && typeof d.event === "string" && /book|schedul/i.test(d.event)) cb();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onScheduled]);

  const waHref = `https://wa.me/${whatsappNumber}`;

  if (!src) return null;

  // Error fallback: the calendar frame did not load (blocked, offline, or slow).
  // Never leave the visitor at a dead frame; offer the direct link plus two
  // channels that always work.
  if (status === "error") {
    return (
      <div style={{ minWidth: 320, borderRadius: 16, border: "1px solid var(--line-strong)", background: "var(--card)", padding: "26px 22px", textAlign: "center" }}>
        <p className="h3" style={{ fontSize: 19, margin: "0 0 6px" }}>{c.errTitle}</p>
        <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.6, margin: "0 0 18px", maxWidth: "44ch", marginInline: "auto" }}>{c.errBody}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <a href={src} target="_blank" rel="noopener noreferrer" className="btn btn-clay btn-sm">{c.openNew}</a>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">{c.whatsapp}</a>
          <a href={`mailto:${contactEmail}`} className="btn btn-ghost btn-sm">{c.email}</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: "relative", minWidth: 320, height, borderRadius: 16, overflow: "hidden", background: `#${t.background}` }}>
        <iframe
          src={src}
          title="Schedule a meeting"
          width="100%"
          height="100%"
          style={{ border: 0, display: "block" }}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
        />
        {status === "loading" && (
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--slate)", fontSize: 14.5 }}>
            <span className="embed-spinner" />
            {c.loading}
          </div>
        )}
      </div>
      {/* Persistent escape hatch: even when the frame "loads" it can render
          empty (blocked third-party cookies, ad blockers); the direct link
          always works. */}
      <p style={{ marginTop: 12, fontSize: 13, color: "var(--slate)", textAlign: "center" }}>
        {c.trouble}{" "}
        <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: "var(--clay)", fontWeight: 600 }}>{c.openNew}</a>
      </p>
    </div>
  );
}
