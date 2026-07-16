import { Link } from "react-router-dom";
import { useLang } from "../context/LangContext";

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="site-footer">
      <div
        className="wrap"
        style={{ padding: "44px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>LALUM</span>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <Link to="/" className="muted" style={{ fontSize: 14 }}>{t.ui.footerLinks.home}</Link>
          <Link to="/advisory" className="muted" style={{ fontSize: 14 }}>{t.ui.footerLinks.advisory}</Link>
          <Link to="/training" className="muted" style={{ fontSize: 14 }}>{t.ui.footerLinks.training}</Link>
          <Link to="/insights" className="muted" style={{ fontSize: 14 }}>{t.ui.footerLinks.insights}</Link>
          <Link to="/login" className="muted" style={{ fontSize: 14 }}>{t.ui.footerLinks.login}</Link>
        </div>
        <span className="muted" style={{ fontSize: 13 }} dir="ltr">{t.ui.copyright}</span>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <Link to="/legal#terms" className="muted" style={{ fontSize: 13 }}>{t.ui.footerLinks.terms}</Link>
          <Link to="/legal#privacy" className="muted" style={{ fontSize: 13 }}>{t.ui.footerLinks.privacy}</Link>
          <Link to="/legal#accessibility" className="muted" style={{ fontSize: 13 }}>{t.ui.footerLinks.accessibility}</Link>
        </div>
      </div>
    </footer>
  );
}
