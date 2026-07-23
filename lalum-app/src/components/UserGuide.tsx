import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../context/LangContext";
import { OPEN_CHAT_EVENT } from "./ChatWidget";
import { externalLinks, appUrl } from "../lib/content";

// Any component can open the quick-start guide by dispatching this event.
export const OPEN_GUIDE_EVENT = "lalum:open-guide";

// Where each step's action leads. "chat" opens the LEX chat widget.
const STEP_TARGETS = ["/login", "/login", "/login", "/book", "chat"];

export function UserGuide() {
  const { t } = useLang();
  const g = t.ui.guide;
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const openGuide = () => setOpen(true);
    window.addEventListener(OPEN_GUIDE_EVENT, openGuide);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, openGuide);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  function go(target: string) {
    setOpen(false);
    if (target === "chat") {
      window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
      return;
    }
    navigate(target);
  }

  return (
    <div className="guide-overlay" role="dialog" aria-modal="true" aria-label={g.title} onClick={() => setOpen(false)}>
      <div className="guide-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="guide-head">
          <div>
            <div className="guide-eyebrow">LALUM</div>
            <h2 className="guide-title">{g.title}</h2>
          </div>
          <button type="button" className="guide-close" onClick={() => setOpen(false)} aria-label={g.close}>×</button>
        </div>

        <p className="guide-intro">{g.intro}</p>

        <ol className="guide-steps">
          {g.steps.map((s, i) => (
            <li key={i} className="guide-step">
              <span className="guide-n">{i + 1}</span>
              <div className="guide-step-c">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <button type="button" className="guide-cta" onClick={() => go(STEP_TARGETS[i])}>{s.cta}</button>
              </div>
            </li>
          ))}
        </ol>

        <div className="guide-more">
          <span className="guide-more-title">{g.moreTitle}</span>
          <a href={externalLinks.qa} target="_blank" rel="noopener noreferrer">{g.qa}</a>
          <button type="button" className="guide-more-link" onClick={() => go("/insights")}>{g.articles}</button>
          <a href={appUrl} target="_blank" rel="noopener noreferrer">{g.download}</a>
        </div>

        <p className="guide-note">{g.aiNote}</p>
      </div>
    </div>
  );
}
