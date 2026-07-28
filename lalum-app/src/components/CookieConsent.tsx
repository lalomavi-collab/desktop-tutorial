import { useEffect, useRef, useState } from "react";
import { useLang } from "../context/LangContext";
import { useDialogA11y } from "../lib/useDialogA11y";

const KEY = "lalum-cookie-consent";
export const OPEN_COOKIE_EVENT = "lalum:open-cookie-settings";
// Fired once the visitor has made (or already has) a cookie choice, so other
// first-visit overlays can wait their turn instead of stacking on top.
export const COOKIE_RESOLVED_EVENT = "lalum:cookie-consent-resolved";

type Consent = { analytics: boolean; ts: number };

function read(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

// Whether the visitor has already resolved the cookie banner (any stored choice).
export function cookieConsentResolved(): boolean {
  return read() !== null;
}

// Additive cookie consent: a first-visit banner plus a settings dialog that the
// footer "Cookie settings" link reopens. Essential cookies are always on; the
// analytics preference is stored (no tracking is loaded unless it is allowed).
export function CookieConsent() {
  const { t, dir } = useLang();
  const C = t.ui.cookie;
  const [banner, setBanner] = useState(false);
  const [modal, setModal] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [saved, setSaved] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useDialogA11y(modal, () => setModal(false), modalRef);

  useEffect(() => {
    const existing = read();
    if (!existing) setBanner(true);
    else setAnalytics(existing.analytics);
    const openModal = () => {
      const cur = read();
      setAnalytics(cur?.analytics ?? false);
      setSaved(false);
      setModal(true);
    };
    window.addEventListener(OPEN_COOKIE_EVENT, openModal);
    return () => window.removeEventListener(OPEN_COOKIE_EVENT, openModal);
  }, []);

  function persist(a: boolean) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ analytics: a, ts: Date.now() } satisfies Consent));
    } catch {
      /* ignore */
    }
    setAnalytics(a);
    setBanner(false);
    // Let any queued first-visit overlay (the privacy notice) know it may show.
    window.dispatchEvent(new Event(COOKIE_RESOLVED_EVENT));
  }

  if (!banner && !modal) return null;

  return (
    <>
      {banner && !modal && (
        <div dir={dir} role="region" aria-label={C.title} className="cookie-banner">
          <span className="cookie-banner-text">{C.banner}</span>
          <div className="cookie-banner-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSaved(false); setModal(true); }}>{C.manage}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => persist(false)}>{C.reject}</button>
            <button type="button" className="btn btn-clay btn-sm" onClick={() => persist(true)}>{C.accept}</button>
          </div>
        </div>
      )}

      {modal && (
        <div className="cookie-overlay" role="dialog" aria-modal="true" aria-label={C.title} onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
          <div dir={dir} className="cookie-modal" ref={modalRef}>
            <h2 className="h3" style={{ fontSize: 22, margin: "0 0 8px" }}>{C.title}</h2>
            <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.6, margin: "0 0 18px" }}>{C.intro}</p>

            <div className="cookie-row">
              <div>
                <div style={{ fontWeight: 600 }}>{C.essential}</div>
                <div className="muted" style={{ fontSize: 13 }}>{C.essentialNote}</div>
              </div>
              <span className="cookie-fixed">✓</span>
            </div>

            <label className="cookie-row" style={{ cursor: "pointer" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{C.analytics}</div>
                <div className="muted" style={{ fontSize: 13 }}>{C.analyticsNote}</div>
              </div>
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} style={{ width: 20, height: 20 }} />
            </label>

            {saved && <div className="notice notice-ok" style={{ marginTop: 16 }}>{C.saved}</div>}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => persist(false)}>{C.reject}</button>
              <button type="button" className="btn btn-ink btn-sm" onClick={() => { persist(analytics); setSaved(true); setTimeout(() => setModal(false), 700); }}>{C.save}</button>
              <button type="button" className="btn btn-clay btn-sm" onClick={() => { persist(true); setSaved(true); setTimeout(() => setModal(false), 700); }}>{C.accept}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
