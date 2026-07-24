import { Link } from "react-router-dom";
import { useLang } from "../context/LangContext";
import { Icon } from "./Icon";
import { ZoomMark, TeamsMark, MeetMark, WhatsAppMark, TelegramMark, GPayMark, LeumiMark } from "./BrandMarks";
import { whatsappNumber, officePhone } from "../lib/content";

// A colourful capabilities band: one glance shows everything the app does, which
// makes it read as full and alive. Icons pair by position with the localized
// labels; accents cycle through the warm brand tones. Every tile is clickable
// and jumps to the matching part of the app.
const ICONS = ["headset", "video", "calendar", "shield", "folder", "whatsapp", "book", "search"];
const ACCENTS = [
  { c: "#a8482a", t: "#f3e7de" },
  { c: "#9a7328", t: "#f1e9d6" },
  { c: "#8a3f45", t: "#f3e4e4" },
  { c: "#3f8f5f", t: "#e2f0e7" },
];

// Destination per capability tile, parallel to the `caps` labels array. `to` is
// an in-app route; `href` is an external/protocol link opened appropriately.
type Target = { to?: string; href?: string; external?: boolean };

export function Capabilities() {
  const { t } = useLang();
  const h = t.home;
  const waHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(t.ui.whatsapp.msg)}`;
  const targets: Target[] = [
    { href: `tel:${officePhone.tel}` }, // AI voice intake -> call the bot line
    { to: "/book" }, // Video meetings
    { to: "/book" }, // Smart scheduling
    { to: "/login" }, // Secure payments (paid from the client portal)
    { to: "/login" }, // Client documents (in the client portal)
    { href: waHref, external: true }, // WhatsApp & Telegram
    { to: "/knowledge" }, // Knowledge & guides
    { to: "/" }, // Site-wide search (lives on the home hero)
  ];

  return (
    <section className="wrap section">
      <div style={{ textAlign: "center", maxWidth: "56ch", margin: "0 auto 40px" }}>
        <p className="eyebrow">{h.capsEyebrow}</p>
        <h2 className="h2">{h.capsTitle}</h2>
      </div>
      <div className="caps-grid">
        {h.caps.map((label, i) => {
          const a = ACCENTS[i % ACCENTS.length];
          const target = targets[i] ?? { to: "/" };
          const inner = (
            <>
              <span className="caps-badge" style={{ background: a.t, color: a.c }}>
                <Icon name={ICONS[i % ICONS.length]} size={24} />
              </span>
              <span className="caps-label">{label}</span>
              <span className="caps-go" aria-hidden="true">{t.ui.capsGo} &rarr;</span>
            </>
          );
          if (target.to) {
            return (
              <Link key={label} to={target.to} className="caps-item" aria-label={label}>
                {inner}
              </Link>
            );
          }
          return (
            <a
              key={label}
              href={target.href}
              className="caps-item"
              aria-label={label}
              {...(target.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {inner}
            </a>
          );
        })}
      </div>

      {/* Works-with: recognisable brand logos add colour and show integrations. */}
      <div style={{ textAlign: "center", marginTop: 46 }}>
        <p className="eyebrow">{h.integrationsEyebrow}</p>
        <div className="integrations-row">
          <ZoomMark size={30} />
          <TeamsMark size={30} />
          <MeetMark size={30} />
          <WhatsAppMark size={30} />
          <TelegramMark size={30} />
          <GPayMark size={26} />
          <LeumiMark size={26} />
        </div>
      </div>
    </section>
  );
}
