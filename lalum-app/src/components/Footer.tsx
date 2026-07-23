import { Link } from "react-router-dom";
import { useLang } from "../context/LangContext";
import { Icon } from "./Icon";
import { GPayMark, LeumiMark } from "./BrandMarks";
import { contactEmail, officePhone, directPhone, socialLinks, externalLinks, officeAddress, paymentsEnabled, bankTransfer } from "../lib/content";
import { OPEN_COOKIE_EVENT } from "./CookieConsent";

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20" />
    </svg>
  );
}

export function Footer() {
  const { t, lang } = useLang();
  const f = t.ui.footer;
  const L = t.ui.footerLinks;
  const addr = officeAddress[lang];

  return (
    <footer className="site-footer">
      {/* Download band: scan the QR to install the app. */}
      <div className="wrap footer-download">
        <div className="footer-download-text">
          <h3 className="footer-download-title">{f.downloadTitle}</h3>
          <p className="footer-download-sub">{f.downloadSub}</p>
        </div>
        <a className="footer-qr" href="https://lalumapp.com" aria-label={f.qrAlt}>
          <img src="/download-qr.svg" alt={f.qrAlt} width={112} height={112} />
        </a>
      </div>

      <div className="wrap footer-inner">
        <div className="footer-brand">
          <img src="/lalum-logo.png" alt="LALUM" className="footer-logo" />
          <p className="footer-tagline">{f.tagline}</p>
          <div className="footer-social" aria-label={f.follow}>
            <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" aria-label={f.linkedin} className="footer-social-link"><LinkedInIcon /></a>
            <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label={f.facebook} className="footer-social-link"><FacebookIcon /></a>
            <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label={f.instagram} className="footer-social-link"><InstagramIcon /></a>
            <a href={socialLinks.website} target="_blank" rel="noopener noreferrer" aria-label={f.website} className="footer-social-link"><GlobeIcon /></a>
          </div>
        </div>

        <nav className="footer-col" aria-label={f.explore}>
          <div className="footer-head">{f.explore}</div>
          <Link to="/">{L.home}</Link>
          <Link to="/advisory">{L.advisory}</Link>
          <Link to="/training">{L.training}</Link>
          <Link to="/insights">{L.insights}</Link>
          <Link to="/knowledge">{L.knowledge}</Link>
          <a href={externalLinks.qa} target="_blank" rel="noopener noreferrer">{L.qa}</a>
          <a href={externalLinks.articles} target="_blank" rel="noopener noreferrer">{L.articles}</a>
        </nav>

        <nav className="footer-col" aria-label={f.client}>
          <div className="footer-head">{f.client}</div>
          <Link to="/login">{L.login}</Link>
          <Link to="/book">{f.book}</Link>
        </nav>

        <div className="footer-col">
          <div className="footer-head">{f.contact}</div>
          <a href={`mailto:${contactEmail}`} dir="ltr">{contactEmail}</a>
          <a href={`tel:${officePhone.tel}`} dir="ltr">{officePhone.display}</a>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <a href={`tel:${directPhone.tel}`} dir="ltr">{directPhone.display}</a>
            <span className="muted" style={{ fontSize: 11 }}>{t.ui.urgentOnly}</span>
          </span>
          <address className="footer-address">
            {addr.map((line, i) => <span key={i}>{line}</span>)}
          </address>
        </div>
      </div>

      {(paymentsEnabled || bankTransfer.enabled) && (
        <div className="wrap footer-pay" aria-label={f.paySecure}>
          <span className="footer-pay-label">
            <Icon name="shield" size={15} /> {f.paySecure}
          </span>
          <span className="footer-pay-badges">
            {paymentsEnabled && <GPayMark size={24} />}
            {bankTransfer.enabled && <LeumiMark size={22} />}
          </span>
        </div>
      )}

      <div className="wrap footer-bottom">
        <span className="muted footer-copy" style={{ fontSize: 13 }}>
          <span dir="ltr">© 2026 LALUM</span>
          <span>{f.city} · {f.rights}</span>
        </span>
        <div className="footer-legal">
          <Link to="/legal#terms">{L.terms}</Link>
          <Link to="/legal#privacy">{L.privacy}</Link>
          <Link to="/legal#security">{L.security}</Link>
          <Link to="/legal#accessibility">{L.accessibility}</Link>
          <button type="button" className="footer-legal-btn" onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_EVENT))}>{L.cookies}</button>
        </div>
      </div>
    </footer>
  );
}
