import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { ShareButton } from "./ShareButton";
import { Icon } from "./Icon";
import { OPEN_GUIDE_EVENT } from "./UserGuide";
import { whatsappNumber, telegramUrl, officePhone, paymentsEnabled } from "../lib/content";

// A collapsible quick-action rail on the inline-start edge. Collapsed it is a
// single round toggle (matching the chat and accessibility corner buttons), so
// it never covers page content; on hover, focus, or tap it expands into a
// vertical rail of contact/utility actions. Keeping these here lets the top
// header stay lean (brand, nav, language, login) with nothing to crowd.
export function ContactRail() {
  const { user } = useAuth();
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <aside
      className={"contact-rail" + (open ? " open" : "")}
      aria-label={t.ui.quickActions}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
    >
      <button
        type="button"
        className="tb-btn rail-toggle"
        aria-expanded={open}
        aria-label={t.ui.quickActions}
        title={t.ui.quickActions}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={open ? "x" : "plus"} size={18} />
      </button>

      <div className="rail-items">
        {paymentsEnabled && (
          <Link to={user ? "/portal" : "/login"} className="tb-btn tb-pay" aria-label={t.ui.bookPage.quickPayTitle} title={t.ui.bookPage.quickPayTitle}>
            <Icon name="card" size={18} />
          </Link>
        )}
        <a className="tb-btn tb-bot" href={`tel:${officePhone.tel}`} aria-label={t.ui.botCall.aria} title={t.ui.botCall.aria}>
          <Icon name="headset" size={19} />
        </a>
        <a
          className="tb-btn"
          href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(t.ui.whatsapp.msg)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.ui.whatsapp.aria}
          title={t.ui.whatsapp.aria}
        >
          <Icon name="whatsapp" size={19} />
        </a>
        <a className="tb-btn tb-tg" href={telegramUrl} target="_blank" rel="noopener noreferrer" aria-label={t.ui.telegram.aria} title={t.ui.telegram.aria}>
          <Icon name="telegram" size={18} />
        </a>
        <ShareButton />
        <button type="button" className="tb-btn" onClick={() => window.dispatchEvent(new Event(OPEN_GUIDE_EVENT))} aria-label={t.ui.guide.open} title={t.ui.guide.open}>
          <Icon name="compass" size={18} />
        </button>
      </div>
    </aside>
  );
}
