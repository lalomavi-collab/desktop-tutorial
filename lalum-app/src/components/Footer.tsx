import { Link } from "react-router-dom";
import { useLang } from "../context/LangContext";
import { contactEmail, officePhone, directPhone } from "../lib/content";

export function Footer() {
  const { t } = useLang();
  const f = t.ui.footer;
  const L = t.ui.footerLinks;

  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <div className="footer-brand">
          <img src="/lalum-logo.png" alt="LALUM" className="footer-logo" />
          <p className="footer-tagline">{f.tagline}</p>
        </div>

        <nav className="footer-col" aria-label={f.explore}>
          <div className="footer-head">{f.explore}</div>
          <Link to="/">{L.home}</Link>
          <Link to="/advisory">{L.advisory}</Link>
          <Link to="/training">{L.training}</Link>
          <Link to="/insights">{L.insights}</Link>
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
          <a href={`tel:${directPhone.tel}`} dir="ltr">{directPhone.display}</a>
          <span className="footer-city">{f.city}</span>
        </div>
      </div>

      <div className="wrap footer-bottom">
        <span className="muted" style={{ fontSize: 13 }} dir="ltr">© 2026 LALUM · {f.city} · {f.rights}</span>
        <div className="footer-legal">
          <Link to="/legal#terms">{L.terms}</Link>
          <Link to="/legal#privacy">{L.privacy}</Link>
          <Link to="/legal#accessibility">{L.accessibility}</Link>
        </div>
      </div>
    </footer>
  );
}
