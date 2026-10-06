import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "./AppLink";
import { useLang } from "../context/LangContext";
import { useInstall } from "./AppInstall";
import { emitOpenVideo } from "./quickAccessEvents";
import { QUIET_ROUTES } from "../lib/quietRoutes";
import { useScrollLock } from "../lib/useScrollLock";
import lalumMark from "../assets/lalum-mark.svg";

// One quiet control in the corner, replacing two auto-popping invitations
// (the video teaser pill and the home-page compliance prompt) that visitors
// found intrusive — and that, at a phone width, sat close enough to visually
// collide with each other. Nothing appears on its own here: a visitor opens
// this by choice, sees what is on offer, and picks one.
const videoBubbleSrc = import.meta.env.VITE_VIDEO_BUBBLE_SRC ?? "";

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5.5" width="13" height="13" rx="2.5" />
      <path d="M15.5 10.5 21 7v10l-5.5-3.5" />
    </svg>
  );
}
function DownloadMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
    </svg>
  );
}
function ScaleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M12 3 5 8l3.5 7a4 4 0 0 0 7 0L19 8z" />
      <path d="M8 20h8" />
    </svg>
  );
}

export function QuickAccessDot() {
  const { t } = useLang();
  const Q = t.ui.quickAccess;
  const { pathname } = useLocation();
  const { installed, canPrompt, promptInstall } = useInstall();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  // Below 900px this menu is a bottom sheet (see index.css) — lock the page
  // behind it for the same reason the header's mobile menu does.
  useScrollLock(open);

  // Closing on navigation matches every other floating control on the page —
  // a menu open on the page a visitor just left is a menu open by accident.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (QUIET_ROUTES.test(pathname)) return null;

  function openVideo() {
    setOpen(false);
    emitOpenVideo(buttonRef.current);
  }

  async function installApp() {
    setOpen(false);
    if (canPrompt) await promptInstall();
    // No native prompt available (iOS Safari, or a browser without one): the
    // footer's own install band still carries the per-platform steps: this
    // just gets the visitor there without a second copy of that text.
    else document.querySelector(".footer-download")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="qad-dock">
      {open && (
        <>
          {/* Backdrop closes the menu on outside click without a global listener. */}
          <div onClick={() => setOpen(false)} className="qad-backdrop" />
          <div className="qad-menu" role="menu" aria-label={Q.open}>
            <span className="sheet-handle" aria-hidden="true" />
            {videoBubbleSrc && (
              <button type="button" role="menuitem" className="qad-item" onClick={openVideo}>
                <span className="qad-item-icon"><VideoIcon /></span>
                <span className="qad-item-txt">
                  <span className="qad-item-label">{t.ui.videoBubble.open}</span>
                  <span className="qad-item-desc">{t.ui.videoBubble.teaser}</span>
                </span>
              </button>
            )}
            {!installed && (
              <button type="button" role="menuitem" className="qad-item" onClick={() => void installApp()}>
                <span className="qad-item-icon"><DownloadMenuIcon /></span>
                <span className="qad-item-txt">
                  <span className="qad-item-label">{t.ui.footer.installApp}</span>
                  <span className="qad-item-desc">{t.ui.footer.downloadSub}</span>
                </span>
              </button>
            )}
            <Link to="/risk" role="menuitem" className="qad-item" onClick={() => setOpen(false)}>
              <span className="qad-item-icon"><ScaleIcon /></span>
              <span className="qad-item-txt">
                <span className="qad-item-label">{t.ui.homePrompt.cta}</span>
                <span className="qad-item-desc">{t.ui.homePrompt.lead}</span>
              </span>
            </Link>
          </div>
        </>
      )}
      <button
        ref={buttonRef}
        type="button"
        className="qad-button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? Q.close : Q.open}
        title={open ? Q.close : Q.open}
      >
        <img src={lalumMark} alt="" aria-hidden="true" />
      </button>
    </div>
  );
}
