import { useEffect, useRef, useState } from "react";
import { useLang } from "../context/LangContext";
import { Icon } from "./Icon";
import { useDialogA11y } from "../lib/useDialogA11y";
import { whatsappNumber, telegramUrl, officePhone } from "../lib/content";

// Any component can open the urgent-contact sheet by dispatching this event.
// Mirrors the OPEN_GUIDE_EVENT pattern in UserGuide.tsx, so both the header
// SOS button and the bottom tab bar SOS tab share one overlay instance.
export const OPEN_SOS_EVENT = "lalum:open-sos";

export function SosMenu() {
  const { t } = useLang();
  const s = t.ui.sos;
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openSos = () => setOpen(true);
    window.addEventListener(OPEN_SOS_EVENT, openSos);
    return () => window.removeEventListener(OPEN_SOS_EVENT, openSos);
  }, []);

  // Escape / focus-trap / scroll-lock / focus-restore.
  useDialogA11y(open, () => setOpen(false), sheetRef);

  if (!open) return null;

  return (
    <div className="guide-overlay" role="dialog" aria-modal="true" aria-label={s.title} onClick={() => setOpen(false)}>
      <div className="guide-sheet sos-sheet" onClick={(e) => e.stopPropagation()} ref={sheetRef}>
        <div className="guide-head">
          <div>
            <div className="guide-eyebrow">{s.eyebrow}</div>
            <h2 className="guide-title">{s.title}</h2>
          </div>
          <button type="button" className="guide-close" onClick={() => setOpen(false)} aria-label={s.close}>×</button>
        </div>

        <p className="guide-intro">{s.intro}</p>

        <div className="sos-actions">
          <a className="sos-action" href={`tel:${officePhone.tel}`} onClick={() => setOpen(false)}>
            <span className="sos-action-icon"><Icon name="headset" size={20} /></span>
            <span className="sos-action-c">
              <strong>{s.call}</strong>
              <span>{s.callNote}</span>
            </span>
          </a>
          <a
            className="sos-action"
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(s.whatsappMsg)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <span className="sos-action-icon"><Icon name="whatsapp" size={20} /></span>
            <span className="sos-action-c"><strong>{s.whatsapp}</strong></span>
          </a>
          <a className="sos-action" href={telegramUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <span className="sos-action-icon"><Icon name="telegram" size={20} /></span>
            <span className="sos-action-c"><strong>{s.telegram}</strong></span>
          </a>
        </div>
      </div>
    </div>
  );
}
