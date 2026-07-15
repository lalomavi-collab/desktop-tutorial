import { Link } from "react-router-dom";
import { contactEmail } from "../lib/content";

export function Footer() {
  return (
    <footer className="site-footer">
      <div
        className="wrap"
        style={{
          padding: "44px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span className="brand-mark" style={{ width: 28, height: 28, fontSize: 16 }}>L</span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>LALUM</span>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <Link to="/" className="muted" style={{ fontSize: 14 }}>Home</Link>
          <Link to="/advisory" className="muted" style={{ fontSize: 14 }}>Advisory & Mediation</Link>
          <Link to="/training" className="muted" style={{ fontSize: 14 }}>Training</Link>
          <Link to="/insights" className="muted" style={{ fontSize: 14 }}>Insights</Link>
          <Link to="/login" className="muted" style={{ fontSize: 14 }}>Client login</Link>
        </div>
        <span className="muted" style={{ fontSize: 13 }} dir="ltr">
          © 2026 LALUM · {contactEmail} · Tel Aviv
        </span>
      </div>
    </footer>
  );
}
