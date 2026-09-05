import { useState } from "react";
import { Icon } from "./Icon";
import { useLang } from "../context/LangContext";

// Always shares the canonical production address.
const SHARE_URL = "https://lalumapp.com";

// The share action itself, apart from any one button's markup: on devices
// with the Web Share API it opens the native share sheet (WhatsApp, Telegram,
// mail, ...); elsewhere it copies the link and reports back so the caller can
// show its own confirmation. Shared between the round header button and the
// header's mobile "more" menu, which needs the same action with a label next
// to it instead of a floating toast.
export function useShare() {
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

  return { share: () => void share(), copied };
}

// Round share button, used in the desktop header row.
export function ShareButton() {
  const { t } = useLang();
  const s = t.ui.share;
  const { share, copied } = useShare();

  return (
    <div className="share-wrap">
      <button type="button" className="share-btn" onClick={share} aria-label={s.aria} title={s.aria}>
        <Icon name="share" size={16} />
        <span className="share-ring" aria-hidden="true" />
      </button>
      {copied && <span className="share-toast" role="status">{s.copied}</span>}
    </div>
  );
}
