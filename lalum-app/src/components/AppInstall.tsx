import { useEffect, useState } from "react";
import { useLang } from "../context/LangContext";

// The LALUM app is a Progressive Web App: it installs straight from the browser
// ("Add to Home Screen"), there is no native App Store or Google Play listing,
// so this band never shows store buttons that would link nowhere. On a desktop
// the QR is the path (scan it with a phone). On a phone the QR is useless (you
// cannot scan your own screen), so CSS hides it there and this component offers
// a real install control instead: where the browser fires the native install
// prompt (beforeinstallprompt) the button installs in one tap, otherwise it
// reveals concise per-platform steps. Once the app is installed we render
// nothing, so an installed user is never nagged to install again.

const APP_URL = "https://lalumapp.com";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function DownloadIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
    </svg>
  );
}

function ScanIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M3 12h18" />
    </svg>
  );
}

export function AppInstall() {
  const { t } = useLang();
  const f = t.ui.footer;
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    // Already running as an installed standalone app: offer nothing.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    function onPrompt(e: Event) {
      // Keep the event so the button can trigger the native install later.
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function onInstall() {
    if (deferred) {
      await deferred.prompt();
      // The captured event is single-use; drop it whatever the choice was.
      setDeferred(null);
      return;
    }
    // No native prompt available (iOS Safari, or a browser without it): show
    // the short per-platform "add to home screen" steps.
    setShowHow((v) => !v);
  }

  if (installed) return null;

  return (
    <div className="wrap footer-download">
      <div className="footer-download-text">
        <h3 className="footer-download-title">{f.downloadTitle}</h3>
        <p className="footer-download-sub">{f.downloadSub}</p>
        {/* Install control. CSS shows it on phones (where the QR is hidden) and
            keeps it out of the way on desktop, unless a native install prompt is
            available, in which case it is offered everywhere. */}
        <div className={`footer-install${deferred ? " has-prompt" : ""}`}>
          <button type="button" className="btn btn-clay footer-install-btn" onClick={onInstall} aria-expanded={showHow}>
            <DownloadIcon /> {f.installApp}
          </button>
          {showHow && (
            <div className="footer-install-how" role="note">
              <p>{f.installIos}</p>
              <p>{f.installAndroid}</p>
            </div>
          )}
        </div>
      </div>
      {/* QR: a scannable jump to the app on a phone. The corner frame and the
          "scan to install" hint make its purpose unmistakable. Hidden on phones. */}
      <a className="footer-qr" href={APP_URL} aria-label={f.qrAlt}>
        <span className="footer-qr-frame">
          <img src="/download-qr.svg" alt={f.qrAlt} width={112} height={112} loading="lazy" decoding="async" />
        </span>
        <span className="footer-qr-hint"><ScanIcon /> {f.installHint}</span>
      </a>
    </div>
  );
}
