import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLang } from "../context/LangContext";

export function Legal() {
  const { t } = useLang();
  const g = t.legal;
  const { hash } = useLocation();

  // Jump to the requested section (#terms / #privacy / #accessibility).
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) el.scrollIntoView({ block: "start" });
    }
  }, [hash]);

  const sections = [
    { id: "terms", ...g.terms },
    { id: "privacy", ...g.privacy },
    { id: "accessibility", ...g.accessibility },
  ];

  return (
    <section className="wrap" style={{ maxWidth: 820, padding: "80px 32px 120px" }}>
      <p className="eyebrow">{g.eyebrow}</p>
      <h1 className="serif" style={{ fontSize: 42, lineHeight: 1.15, letterSpacing: "-0.015em", margin: "0 0 20px" }}>{g.title}</h1>
      <div className="notice notice-warn" style={{ marginBottom: 40 }}>{g.disclaimer}</div>

      {sections.map((s) => (
        <div key={s.id} id={s.id} style={{ scrollMarginTop: 90, marginBottom: 40 }}>
          <h2 className="serif" style={{ fontSize: 26, fontWeight: 500, margin: "0 0 14px" }}>{s.title}</h2>
          {s.body.map((p, i) => (
            <p key={i} style={{ fontSize: 16, lineHeight: 1.72, color: "var(--slate)", margin: "0 0 14px", maxWidth: "66ch" }}>{p}</p>
          ))}
        </div>
      ))}
    </section>
  );
}
