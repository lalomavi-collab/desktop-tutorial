import type { ReactNode } from "react";
import { useLang } from "../context/LangContext";

// The frame of the diagnostics booking: a sharp container with a telemetry bar
// on top and the three scopes the session covers, then whatever the page puts
// in it (the scheduling embed, or the manual request form). It carries no
// behaviour of its own, so booking works exactly as before.

const SCOPES = {
  he: ["ממשל AI", "נדל״ן ותמ״א 38", "גישור ובוררות (DOM)"],
  en: ["AI Governance", "Real Estate & TAMA 38", "DOM Arbitration"],
};

export function DiagnosticBriefing({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const scopes = SCOPES[lang === "he" ? "he" : "en"];
  return (
    <div className="dx">
      <div className="dx-bar" dir="ltr">
        <span className="mono">[DIAGNOSTIC PROTOCOL // 45-MIN ARCHITECTURE MAPPING]</span>
      </div>
      <ul className="dx-scope" aria-label={lang === "he" ? "היקף הסשן" : "Session scope"}>
        {scopes.map((s, i) => (
          <li key={s}>
            <span dir="ltr" className="mono dx-idx">[{String(i + 1).padStart(2, "0")}]</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
      <div className="dx-body">{children}</div>
    </div>
  );
}
