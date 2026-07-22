import { useLang } from "../context/LangContext";
import { Icon } from "./Icon";
import { ZoomMark, WhatsAppMark, TelegramMark, ApplePayMark, GPayMark, BitMark } from "./BrandMarks";

// A colourful capabilities band: one glance shows everything the app does, which
// makes it read as full and alive. Icons pair by position with the localized
// labels; accents cycle through the warm brand tones.
const ICONS = ["headset", "video", "calendar", "shield", "folder", "whatsapp", "book", "search"];
const ACCENTS = [
  { c: "#a8482a", t: "#f3e7de" },
  { c: "#9a7328", t: "#f1e9d6" },
  { c: "#8a3f45", t: "#f3e4e4" },
  { c: "#3f8f5f", t: "#e2f0e7" },
];

export function Capabilities() {
  const { t } = useLang();
  const h = t.home;
  return (
    <section className="wrap section">
      <div style={{ textAlign: "center", maxWidth: "56ch", margin: "0 auto 40px" }}>
        <p className="eyebrow">{h.capsEyebrow}</p>
        <h2 className="h2">{h.capsTitle}</h2>
      </div>
      <div className="caps-grid">
        {h.caps.map((label, i) => {
          const a = ACCENTS[i % ACCENTS.length];
          return (
            <div key={label} className="caps-item">
              <span className="caps-badge" style={{ background: a.t, color: a.c }}>
                <Icon name={ICONS[i % ICONS.length]} size={24} />
              </span>
              <span className="caps-label">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Works-with: recognisable brand logos add colour and show integrations. */}
      <div style={{ textAlign: "center", marginTop: 46 }}>
        <p className="eyebrow">{h.integrationsEyebrow}</p>
        <div className="integrations-row">
          <ZoomMark size={30} />
          <WhatsAppMark size={30} />
          <TelegramMark size={30} />
          <ApplePayMark size={26} />
          <GPayMark size={26} />
          <BitMark size={26} />
        </div>
      </div>
    </section>
  );
}
