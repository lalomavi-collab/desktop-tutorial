import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "./AppLink";
import { useLang } from "../context/LangContext";
import { useInstall } from "./AppInstall";
import { QUIET_ROUTES } from "../lib/quietRoutes";
import { useScrollLock } from "../lib/useScrollLock";
import lalumMark from "../assets/lalum-mark.svg";

// One quiet control, replacing two auto-popping invitations (the video teaser
// pill and the home-page compliance prompt) that visitors found intrusive, and
// that, at a phone width, sat close enough to visually collide with each other.
// Nothing appears on its own here: a visitor opens this by choice, sees what is
// on offer, and picks one.
//
// It lives in the header (components/Header.tsx) rather than floating over the
// page. Two round controls parked in the bottom corner cover content on every
// screen of every page; in the toolbar they are reachable without being in the
// way.
const videoBubbleSrc = import.meta.env.VITE_VIDEO_BUBBLE_SRC ?? "";

// The intro film plays in its own section on the home page
// (components/FounderIntroVideo.tsx), with the browser's own controls. This
// menu takes the visitor there rather than opening a second player for the
// same clip. There used to be two implementations of one thing, and the one
// this menu pointed at was the one that did not play.
const FILM_SELECTOR = ".founder-film";

function playFilm(): boolean {
  const film = document.querySelector(FILM_SELECTOR);
  if (!film) return false;
  film.scrollIntoView({ behavior: "smooth", block: "center" });
  // A refusal is fine: the controls are right there and the visitor is now
  // looking at them. What must not happen is an unhandled rejection.
  void film.querySelector("video")?.play().catch(() => { /* the visitor presses play */ });
  return true;
}

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
  const navigate = useNavigate();
  const { installed, canPrompt, promptInstall } = useInstall();
  const [open, setOpen] = useState(false);

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

  function openFilm() {
    setOpen(false);
    if (playFilm()) return;
    // Not on the home page. Navigate there, then wait for the section to
    // exist: the route is code split, so it is not on the page the moment
    // navigate() returns. Bounded, because a frame loop with no end is how a
    // tab starts burning battery over a section that never arrives.
    // The hash matters: MarketingLayout resets the scroll to the top on every
    // route change *unless* the route carries one, so without it the jump to
    // the film would be undone a frame after it happened.
    navigate({ pathname: "/", hash: "#founder-film" });
    let frames = 0;
    const tick = () => {
      if (playFilm() || (frames += 1) > 120) return;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
              <button type="button" role="menuitem" className="qad-item" onClick={openFilm}>
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
