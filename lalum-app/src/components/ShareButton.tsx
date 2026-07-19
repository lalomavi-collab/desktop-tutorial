import { useState } from "react";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// Round share button. On devices with the Web Share API it opens the native
// share sheet (WhatsApp, Telegram, mail, ...); elsewhere it copies the link and
// shows a short confirmation. Always shares the canonical production address.
const SHARE_URL = "https://lalumapp.com";

export function ShareButton() {
  const { t } = useLang();
  const s = t.ui.share;
  const [copied, setCopied] = useState(false);

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "LALUM", text: s.text, url: SHARE_URL });
      } catch {
        // Sheet dismissed or unavailable: nothing more to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: silently ignore.
    }
  }

  return (
    <div className="share-wrap">
      <button type="button" className="share-btn" onClick={() => void share()} aria-label={s.aria} title={s.aria}>
        <Icon name="share" size={16} />
        <span className="share-ring" aria-hidden="true" />
      </button>
      {copied && <span className="share-toast" role="status">{s.copied}</span>}
    </div>
  );
}
