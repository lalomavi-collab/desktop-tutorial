import { useLang } from "../context/LangContext";
import { Wordmark } from "./Wordmark";

// Founder introduction video, surfaced prominently on the home page so the firm
// is branded around its founder. It reuses the already-uploaded clip
// (public/media/lalum-intro.mp4, poster lalum-intro.jpg, Hebrew captions) — the
// same asset the corner VideoBubble was built around — and all its copy comes
// from the existing shared strings (the LALUM wordmark plus the canonical name
// in videoBubble.teaser), so no new per-language copy is introduced.
//
// Click-to-play through the native controls: accessible and keyboard-operable
// out of the box, and reduced-motion safe because nothing autoplays. Only the
// poster loads until the visitor asks for the clip (preload="none").
const SRC = "/media/lalum-intro.mp4";
const POSTER = "/media/lalum-intro.jpg";
const HE_CAPTIONS = "/media/lalum-intro.he.vtt";

export function FounderIntroVideo() {
  const { t, lang } = useLang();
  const V = t.ui.videoBubble;
  return (
    <figure
      id="founder-film"
      className="founder-film"
      aria-label={V.open}
      style={{
        margin: "0 0 28px",
        background: "var(--clay-tint)",
        border: "1px solid var(--clay-soft)",
        borderRadius: 20,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 6px 14px" }}>
        <Wordmark
          height={18}
          label={t.home.logoAlt}
          style={{ height: "auto", width: "auto", maxHeight: 18, opacity: 0.9 }}
        />
        <figcaption style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.4 }}>{V.teaser}</figcaption>
      </div>
      <video
        className="founder-film-video"
        src={SRC}
        poster={POSTER}
        controls
        preload="none"
        playsInline
        style={{ width: "100%", height: "auto", display: "block", borderRadius: 14, background: "#000" }}
      >
        {lang === "he" && (
          <track kind="captions" src={HE_CAPTIONS} srcLang="he" label={t.ui.langName} default />
        )}
      </video>
    </figure>
  );
}
