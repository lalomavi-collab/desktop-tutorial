import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "./AppLink";
import { useLang } from "../context/LangContext";
// Imported, not referenced as "/favicon.svg": that path is also the browser
// tab icon, and browsers cache a favicon far more stubbornly than an ordinary
// asset, sometimes for the life of the profile, regardless of what a fresh
// deploy serves at that URL. A visitor whose browser had cached an old icon
// from before this rebrand saw that old icon here too, because it was
// genuinely the same request. Importing the file gives Vite a content-hashed
// filename instead, so this image is never the same URL as the tab icon and
// never inherits its caching.
import lalumMark from "../assets/lalum-mark.svg";

// A pill that appears once when someone lands on the home page and takes
// itself away after half a minute.
//
// It was a 340px circle at first, then a card at the video bubble's own
// scale. Both still sat tall enough to compete with the hero. This version
// takes the video bubble's own shape too, an orb beside a line of text, so
// the whole thing is one thin strip rather than a block of its own.
//
// Three things about the timing are deliberate:
//
// 1. It waits before appearing. Arriving at the same instant as the page means
//    competing with the hero, and on a first visit also with the cookie banner.
//    A short delay lets the page settle first.
// 2. It appears once per visit, not once per navigation. "Only on entry" means
//    the visitor should not meet it again every time they come back to the home
//    page in the same session, so the fact that it was shown lives in
//    sessionStorage and clears itself when the tab closes.
// 3. The countdown pauses while the pointer is over it or while anything inside
//    it has keyboard focus. Content that removes itself on a timer is a real
//    accessibility problem: a visitor who reads slowly, or who is still tabbing
//    towards the button, should not have it vanish mid-reach.
const SEEN_KEY = "lalum_home_prompt_seen";
const APPEAR_AFTER_MS = 1800;
const VISIBLE_MS = 30000;

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Private mode or blocked storage. Showing it once is the safe failure.
    return false;
  }
}

export function HomePrompt() {
  const { t } = useLang();
  const P = t.ui.homePrompt;
  const [phase, setPhase] = useState<"waiting" | "shown" | "gone">(
    () => (alreadySeen() ? "gone" : "waiting"),
  );
  const [held, setHeld] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const dismiss = useCallback(() => {
    setPhase("gone");
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
  }, []);

  // Appear, once the page has had a moment.
  useEffect(() => {
    if (phase !== "waiting") return;
    const t = setTimeout(() => setPhase("shown"), APPEAR_AFTER_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Leave on its own, unless the visitor is engaged with it.
  useEffect(() => {
    if (phase !== "shown" || held) return;
    const t = setTimeout(dismiss, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [phase, held, dismiss]);

  // Escape closes it, the same as the close button.
  useEffect(() => {
    if (phase !== "shown") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, dismiss]);

  if (phase !== "shown") return null;

  return (
    <div
      ref={ref}
      className="hprompt"
      role="region"
      aria-label={P.aria}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHeld(false); }}
    >
      {/* The full sentence still lives in the title attribute: the strip
          truncates both lines to fit, and a reader who hovers or a screen
          reader (via the region's own aria-label above) still gets it whole. */}
      <Link to="/risk" className="hprompt-pill" onClick={dismiss} title={`${P.lead} ${P.body}`}>
        {/* The firm's own mark, not a generic icon. Same rule as everywhere
            else in the app: only the supplied artwork represents LALUM, never
            a stand-in glyph. This is the same square crop used for the
            favicon and the app icon, proven legible at exactly this size,
            served from its own imported URL (see the import above). */}
        <img className="hprompt-orb" src={lalumMark} alt="" width={36} height={36} aria-hidden="true" />
        <span className="hprompt-txt">
          <span className="hprompt-lead">{P.lead}</span>
          <span className="hprompt-body">{P.body}</span>
        </span>
        <span className="hprompt-go" aria-hidden="true">&rarr;</span>
      </Link>
      <button type="button" className="hprompt-close" onClick={dismiss} aria-label={P.close} title={P.close}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
