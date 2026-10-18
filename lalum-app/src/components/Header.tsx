import { useEffect, useState } from "react";
import { Link, NavLink } from "./AppLink";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { useShare } from "./ShareButton";
import { DownloadIcon, useInstall } from "./AppInstall";
import { Icon } from "./Icon";
import { OPEN_GUIDE_EVENT } from "./UserGuide";
import { OPEN_SOS_EVENT } from "./SosMenu";
import { OPEN_CHAT_EVENT } from "./chatEvents";
import { whatsappNumber, telegramUrl, officePhone, paymentsEnabled } from "../lib/content";
import { LANGS, cvPath } from "../lib/hreflang";
import { Wordmark } from "./Wordmark";
import { byLang } from "../lib/byLang";
import { useScrollLock } from "../lib/useScrollLock";

const HG = {
  he: { engine: "המנוע וחדר ההחלטות", practice: "תחומי עיסוק", clinic: "קליניקה ואקדמיה", insights: "תובנות ופרופיל", profile: "פרופיל וקורות חיים", cta: "סשן אבחון", group: "ניווט ראשי", contact: "יצירת קשר", call: "שיחה" },
  en: { engine: "Engine & Decision Room", practice: "Practice Areas", clinic: "Clinic & Academy", insights: "Insights & Profile", profile: "Profile & CV", cta: "Diagnostics Session", group: "Primary navigation", contact: "Contact", call: "Call" },
  ar: { engine: "المحرّك وغرفة القرار", practice: "مجالات العمل", clinic: "العيادة والأكاديمية", insights: "رؤى وملف شخصي", profile: "الملف الشخصي والسيرة الذاتية", cta: "جلسة تشخيص", group: "التنقل الرئيسي", contact: "التواصل", call: "اتصال" },
  es: { engine: "Motor y Decisión", practice: "Áreas", clinic: "Clínica y Academia", insights: "Análisis y perfil", profile: "Perfil y CV", cta: "Sesión de diagnóstico", group: "Navegación principal", contact: "Contacto", call: "Llamar" },
  fr: { engine: "Moteur et Décision", practice: "Domaines", clinic: "Clinique et Académie", insights: "Analyses et profil", profile: "Profil et CV", cta: "Séance de diagnostic", group: "Navigation principale", contact: "Contact", call: "Appeler" },
};

export function Header() {
  const { user } = useAuth();
  const { t, lang, setLang } = useLang();
  const [moreOpen, setMoreOpen] = useState(false);
  // The full menu renders as a bottom sheet only below 900px; above it, it is a
  // small anchored dropdown. Scroll-lock the page behind the sheet, but not
  // behind the desktop dropdown (which closes on any outside click) so the page
  // does not freeze under a small card.
  const [isSheet, setIsSheet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setIsSheet(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  // The menu behaves like a standard application menu (the pattern Claude's own
  // interface uses): a click opens it, and it stays open until the visitor
  // picks a row, clicks outside it (the backdrop), or presses Escape. It never
  // closes on its own from the pointer drifting off, which read as unpredictable.
  const { share, copied: shareCopied } = useShare();
  // One-tap desktop install (Chrome/Edge). canPrompt is false everywhere the
  // browser has no native prompt (Safari, Firefox), so this stays invisible
  // there instead of adding a seventh permanent icon to a row already at its
  // documented limit of six.
  const { installed: appInstalled, canPrompt: canInstall, promptInstall } = useInstall();

  // Below 900px the "more" menu becomes a bottom sheet (see index.css); a
  // sheet that only closes by tapping its own backdrop reads as broken on a
  // phone, and locking the page behind it keeps the body from scrolling out
  // from under a surface that is meant to feel anchored to the screen edge.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);
  useScrollLock(moreOpen && isSheet);

  // The two areas the practice leads with, first and named as domains: AI &
  // Law, then Real Estate. Clinic is the existing advisory hub under a name
  // that matches how the practice already describes its own operating model
  // (see the FAQ on "Clinic and Engine"); Engine is the home page's own
  // #engine section, reachable from anywhere via the cross-page hash scroll
  // in App.tsx; Decision Room is the existing readiness quiz. None of these
  // three is a new page or a new URL, only a new name for one already live.
  // Training and Knowledge have no slot of their own in this shape: they, and
  // Articles, follow the five links in the menu as the reading group.
  const hg = byLang(HG, lang);
  // The four groups of the top bar. Every URL is one the site already serves;
  // the full list, with Knowledge and the rest, stays in the menu.
  const groups: { label: string; items: { to: string; label: string; plain?: boolean }[] }[] = [
    { label: hg.engine, items: [{ to: "/#engine", label: t.ui.nav.engine }, { to: "/risk", label: t.ui.nav.decisionRoom }] },
    { label: hg.practice, items: [{ to: "/ai-legal-advisory", label: t.ui.nav.ai }, { to: "/real-estate-legal-advisory", label: t.ui.nav.realEstate }] },
    { label: hg.clinic, items: [{ to: "/advisory", label: t.ui.nav.clinic }, { to: "/training", label: t.ui.nav.training }] },
    { label: hg.insights, items: [{ to: "/insights", label: t.ui.nav.insights }, { to: "/knowledge", label: t.ui.nav.knowledge }, { to: cvPath(lang), label: hg.profile, plain: true }] },
  ];

  return (
    <header className={"site-header" + (moreOpen ? " nav-open" : "")}>
      <div className="wrap header-inner">
        <Link to="/" className="brand">
          <Wordmark height={19} />
        </Link>
        <span dir="ltr" className="mono hdr-badge" aria-hidden="true">[LAW &amp; AI LAB]</span>

        {/* The one menu, right beside the wordmark: a labelled control that
            opens a single panel with the full site nav, the reading menu,
            every contact and utility action, and the language switch. It shows
            on every width (the nav pills hide on phones, this does not), so
            there is one obvious place that reaches everything, and it closes on
            its own once the pointer leaves it (see scheduleAutoClose). */}
        <div className="header-more-wrap">
          <button
            type="button"
            className="header-menu-btn"
            onClick={() => setMoreOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
          >
            <Icon name="menu" size={17} />
            <span>{t.ui.nav.menu}</span>
          </button>
          {moreOpen && (
            <>
              <div onClick={() => setMoreOpen(false)} className="header-more-backdrop" />
              <div
                role="menu"
                aria-label={t.ui.nav.menu}
                className="card header-more-menu"
              >
                {/* A header for the panel: on phones the menu is a full-screen
                    overlay (it must cover the floating chat and accessibility
                    buttons and the bottom tab bar, which sit above a partial
                    sheet), so it needs the wordmark and an explicit close. On
                    desktop this row is hidden and the anchored dropdown stands
                    on its own. */}
                <div className="header-more-head">
                  <Wordmark height={17} />
                  <button type="button" className="header-more-close" onClick={() => setMoreOpen(false)} aria-label={t.ui.quickAccess.close}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
                {/* The menu is organised, not listed: two entries first (the
                    assistant app and the client portal, with quick payment as a
                    third when it is on), then the same four groups the top bar
                    uses, then contact as three short buttons, then the small
                    utilities. Every link the flat list carried is still here,
                    once. The assistant link is a plain anchor, not <Link>:
                    /os has no translated build, and <Link> would carry the
                    language basename onto a path with no prerendered file. */}
                <div className="hm-top">
                  <a href="/os/" role="menuitem" className="hm-tile hm-tile-os" onClick={() => setMoreOpen(false)}>
                    <Icon name="spark" size={18} /> LALUM LEX
                  </a>
                  <Link to={user ? "/portal" : "/login"} role="menuitem" className="hm-tile" onClick={() => setMoreOpen(false)}>
                    <Icon name="user" size={18} /> {user ? t.ui.clientPortal : t.ui.clientLogin}
                  </Link>
                  {paymentsEnabled && (
                    <Link to={user ? "/portal" : "/login"} role="menuitem" className="hm-tile" onClick={() => setMoreOpen(false)}>
                      <span className="header-more-pay-symbol" aria-hidden="true">₪</span> {t.ui.bookPage.quickPayTitle}
                    </Link>
                  )}
                </div>
                {groups.map((g) => (
                  <div key={g.label} role="group" aria-label={g.label} className="hm-group">
                    <div className="hm-gh">{g.label}</div>
                    <div className="hm-links">
                      {g.items.map((it) => it.plain ? (
                        <a key={it.to} href={it.to} role="menuitem" className="hm-link" onClick={() => setMoreOpen(false)}>{it.label}</a>
                      ) : it.to.includes("#") ? (
                        <Link key={it.to} to={it.to} role="menuitem" className="hm-link" onClick={() => setMoreOpen(false)}>{it.label}</Link>
                      ) : (
                        <NavLink key={it.to} to={it.to} role="menuitem" onClick={() => setMoreOpen(false)} className={({ isActive }) => "hm-link" + (isActive ? " active" : "")}>
                          {it.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
                <div role="group" aria-label={hg.contact} className="hm-group">
                  <div className="hm-gh">{hg.contact}</div>
                  <div className="hm-contact">
                    <a role="menuitem" className="hm-ch" href={`tel:${officePhone.tel}`} aria-label={t.ui.botCall.aria} onClick={() => setMoreOpen(false)}>
                      <Icon name="headset" size={20} /> {hg.call}
                    </a>
                    <a role="menuitem" className="hm-ch" href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(t.ui.whatsapp.msg)}`} target="_blank" rel="noopener noreferrer" aria-label={t.ui.whatsapp.aria} onClick={() => setMoreOpen(false)}>
                      <Icon name="whatsapp" size={20} /> WhatsApp
                    </a>
                    <a role="menuitem" className="hm-ch" href={telegramUrl} target="_blank" rel="noopener noreferrer" aria-label={t.ui.telegram.aria} onClick={() => setMoreOpen(false)}>
                      <Icon name="telegram" size={20} /> Telegram
                    </a>
                  </div>
                </div>
                <div className="hm-utils">
                  <button type="button" role="menuitem" className="hm-util" onClick={() => { window.dispatchEvent(new Event(OPEN_GUIDE_EVENT)); setMoreOpen(false); }}>
                    <Icon name="compass" size={16} /> {t.ui.guide.open}
                  </button>
                  <button type="button" role="menuitem" className="hm-util" onClick={share}>
                    <Icon name="share" size={16} /> {shareCopied ? t.ui.share.copied : t.ui.share.aria}
                  </button>
                  {canInstall && !appInstalled && (
                    <button type="button" role="menuitem" className="hm-util" onClick={() => { void promptInstall(); setMoreOpen(false); }}>
                      <DownloadIcon size={16} /> {t.ui.footer.installApp}
                    </button>
                  )}
                  {/* Plain anchor: /partners is Hebrew-only and has no file at
                      "/en/partners" for <Link>'s basename-prefixed href. */}
                  <a href="/partners/" role="menuitem" className="hm-util" onClick={() => setMoreOpen(false)}>
                    <Icon name="scale" size={16} /> {t.ui.partnerLogin}
                  </a>
                </div>
                <div className="header-more-divider" role="separator" />
                <div className="header-more-langs">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      role="menuitemradio"
                      aria-checked={l.code === lang}
                      onClick={() => { setLang(l.code); setMoreOpen(false); }}
                      dir={l.dir}
                      className={"header-more-lang" + (l.code === lang ? " active" : "")}
                    >
                      {l.autonym}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* The nav pills and the LALUM LEX button that used to sit in this bar
            are gone on purpose: every one of them already lives in the menu
            above, so showing both was the same destinations twice. The menu is
            the single home for navigation, which leaves the bar with room to
            breathe. Only the quick utilities stay here (account, chat, SOS). */}

        {/* The four groups. Desktop only: below 900px the menu sheet carries
            every one of these links. Each group opens on hover or keyboard
            focus; its first link is also its own destination. */}
        <nav className="header-groups hide-mobile" aria-label={hg.group}>
          {groups.map((g) => (
            <div key={g.label} className="hg">
              <span className="hg-label" tabIndex={0}>{g.label}</span>
              <div className="hg-menu">
                {g.items.map((it) => it.plain ? (
                  <a key={it.to} href={it.to}>{it.label}</a>
                ) : it.to.includes("#") ? (
                  <Link key={it.to} to={it.to}>{it.label}</Link>
                ) : (
                  <NavLink key={it.to} to={it.to}>{it.label}</NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="header-tools">
          {/* The two controls that used to float in the page's bottom corner,
              one above the other: the quick-access dot and the chat launcher.
              Parked there they covered content on every screen and on every
              page, which is a high price for two entry points nobody asked to
              see. Here they are reachable without being in the way.
              The chat opens through its event rather than by importing
              ChatWidget, which would pull that heavy component out of its lazy
              chunk and into the header's. UserGuide already does the same. */}
          <button
            type="button"
            className="tb-btn"
            onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}
            aria-label={t.ui.chat.open}
            title={t.ui.chat.open}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 0 1 4 11.5 8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
            </svg>
          </button>
          {/* The urgent-contact button: always visible on desktop, first in
              the row, so it is never lost among the other tools. Opens a
              small sheet with every fast channel (call, WhatsApp, Telegram)
              instead of picking one action for the client. On phones it
              drops out here (hide-mobile): the bottom tab bar already carries
              its own always-reachable SOS tab, and showing both crowded the
              top bar for no benefit — one reachable SOS is enough. */}
          <button
            type="button"
            className="tb-btn tb-sos hide-mobile"
            onClick={() => window.dispatchEvent(new Event(OPEN_SOS_EVENT))}
            aria-label={t.ui.sos.aria}
            title={t.ui.sos.aria}
          >
            {t.ui.sos.open}
          </button>
          {/* Quick payment used to live here too on phones (desktop always
              reached it through the floating ContactRail instead): a bare ₪
              icon standing alone beside the menu button, the toolbar's only
              visible child at that width. Folded into the "More" menu
              instead (see header-more-wrap above), so the phone header
              collapses to exactly two controls, the wordmark and the menu,
              rather than two separate single-purpose buttons competing for
              the same corner. */}
          {/* A dedicated "Start" pill was tried here and dropped: the toolbar
              already carries six round controls plus the client login link,
              and one more rigid, non-shrinking pill pushed the nav-pills row
              below what six domain/model links need, forcing two of them
              into a scroll with no visible affordance. The practice's primary
              CTA (/book) already anchors the hero, FocusAreas, and every
              closing section, so nothing was actually missing an entry
              point. Only the client login/portal button remains here, so the
              header stays uncluttered. */}
          <div className="hdr-langs hide-mobile" role="group" aria-label="Language">
            {LANGS.filter((l) => l.code === "he" || l.code === "en" || l.code === lang).map((l) => (
              <button key={l.code} type="button" className={"mono" + (l.code === lang ? " on" : "")} aria-pressed={l.code === lang} onClick={() => setLang(l.code)}>
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
          <Link to={user ? "/portal" : "/login"} className="header-login hide-mobile" aria-label={user ? t.ui.clientPortal : t.ui.clientLogin} title={user ? t.ui.clientPortal : t.ui.clientLogin}>
            <Icon name="user" size={16} /> <span className="header-cta-label">{user ? t.ui.clientPortal : t.ui.clientLogin}</span>
          </Link>
          <Link to="/book" className="hdr-cta hide-mobile">{hg.cta}</Link>
        </div>
      </div>
    </header>
  );
}
