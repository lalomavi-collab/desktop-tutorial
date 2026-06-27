import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

// App download section (Waze-style). PWA install works now; store badges show
// "soon" until the native apps are published.
export default function DownloadApp() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => { if (deferred) { deferred.prompt(); setDeferred(null); } };

  const badge = (top: string, big: string, soon: boolean, icon: React.ReactNode) => (
    <div style={{
      position: "relative", display: "flex", alignItems: "center", gap: 10,
      background: "#000", color: "#fff", borderRadius: 12, padding: "9px 16px", minWidth: 150,
      opacity: soon ? 0.6 : 1, cursor: "default",
    }}>
      {icon}
      <div dir="ltr" style={{ lineHeight: 1.1, textAlign: "start" }}>
        <div style={{ fontSize: 10 }}>{top}</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{big}</div>
      </div>
      {soon && <span style={{ position: "absolute", top: -8, insetInlineEnd: -6, background: "#D97757", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{t("dl.soon")}</span>}
    </div>
  );

  return (
    <div className="container" style={{ position: "relative", zIndex: 2, maxWidth: 1100, padding: "8px 0 40px" }}>
      <div style={{
        background: "linear-gradient(135deg, rgba(51,204,255,0.10), rgba(217,119,87,0.10))",
        border: "1px solid var(--line)", borderRadius: 18, padding: "22px 20px",
        display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>📲 {t("dl.title")}</h3>
          <p className="muted" style={{ margin: 0, fontSize: 13, maxWidth: 460, lineHeight: 1.6 }}>{t("dl.sub")}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={install} disabled={installed} className="btn btn-gold" style={{ padding: "12px 22px", fontSize: 14 }}>
            {installed ? t("dl.installed") : `⬇️ ${t("dl.install")}`}
          </button>
          {badge("Download on the", "App Store", true, <span style={{ fontSize: 24 }}></span>)}
          {badge("GET IT ON", "Google Play", true, <span style={{ fontSize: 22 }}>▶</span>)}
        </div>
      </div>
    </div>
  );
}
