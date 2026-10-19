import { useRef, useState } from "react";
import { useLang } from "../context/LangContext";

// The home page film: about a minute, English narration by an AI voice, drawn in code
// (scripts/home-film-visuals.mjs). It sits below the first section, never in the hero,
// and nothing loads until it is asked for: the poster is the only request, the video
// and the subtitle tracks arrive on the click. Subtitles are separate tracks, one per
// site language, the visitor's own language switched on.
const LANGS = ["en", "he", "es", "fr", "ar"] as const;

export function HomeFilm() {
  const { lang, t } = useLang();
  const h = t.home;
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  function start() {
    setStarted(true);
    // the element exists on the next render; play it then
    requestAnimationFrame(() => void ref.current?.play().catch(() => {}));
  }

  return (
    <figure className="home-film" style={{ margin: 0 }}>
      {started ? (
        <video ref={ref} controls playsInline preload="auto" poster="/media/home-film.jpg" style={{ width: "100%", borderRadius: 14, background: "#0b100c", aspectRatio: "16 / 9" }}>
          <source src="/media/home-film.mp4" type="video/mp4" />
          {LANGS.map((l) => (
            <track key={l} kind="subtitles" src={`/media/home-film.${l}.vtt`} srcLang={l} label={l.toUpperCase()} default={l === lang} />
          ))}
        </video>
      ) : (
        <button type="button" onClick={start} aria-label={h.filmPlay} style={{ position: "relative", display: "block", width: "100%", padding: 0, border: 0, borderRadius: 14, overflow: "hidden", cursor: "pointer", background: "#0b100c" }}>
          <img src="/media/home-film.jpg" alt={h.filmPosterAlt} loading="lazy" decoding="async" width={1280} height={720} style={{ display: "block", width: "100%", height: "auto" }} />
          <span aria-hidden="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span style={{ width: 84, height: 84, borderRadius: "50%", background: "rgba(11,16,12,.72)", border: "2px solid #e7c27a", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="#e7c27a"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </span>
        </button>
      )}
      <figcaption className="dim" style={{ marginTop: 12, fontSize: 15 }}>{h.filmDisclosure}</figcaption>
    </figure>
  );
}
