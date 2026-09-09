import { useState } from "react";
import { useLang } from "../context/LangContext";
import { isInAppBrowser } from "../lib/inAppBrowser";

// A thin bar above the header for the one browsing context where install is
// otherwise invisible: WhatsApp, Instagram, Facebook and the other in-app
// WebViews (see lib/inAppBrowser.ts) never fire `beforeinstallprompt`, and on
// iOS cannot install a PWA at all — so the header's one-tap button and the
// footer's install band both stay silent there, with nothing on screen
// telling a visitor installation is even possible. This band is the fix: it
// only shows in that context, says so plainly, and points at the exact menu
// that gets a visitor into a real browser.
//
// It sits in normal document flow, ahead of the sticky header, rather than
// floating: a floating band here would repeat the exact mistake .hprompt and
// .vbub-dock made colliding in the corner — a fixed element competing with
// two others already anchored to viewport edges. Being first in flow, it
// simply pushes the header down and can never overlap anything.
const SEEN_KEY = "lalum_iab_banner_seen";

function alreadyDismissed(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function InAppBrowserBanner() {
  const { t } = useLang();
  const B = t.ui.inAppBrowser;
  const [dismissed, setDismissed] = useState(alreadyDismissed);

  if (dismissed || !isInAppBrowser()) return null;

  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode */ }
  }

  return (
    <div className="iab-banner" role="note">
      <p className="iab-banner-text">
        <span className="iab-banner-message">{B.message}</span>{" "}
        <span className="iab-banner-how">{B.how}</span>
      </p>
      <button type="button" className="iab-banner-close" onClick={dismiss} aria-label={B.close} title={B.close}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
