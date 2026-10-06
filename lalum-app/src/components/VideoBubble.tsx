import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "react-router-dom";
import { Link } from "./AppLink";
import { useLang } from "../context/LangContext";
import { CHAT_STATE_EVENT } from "./chatEvents";
import { OPEN_VIDEO_EVENT } from "./quickAccessEvents";
import { QUIET_ROUTES } from "../lib/quietRoutes";
import { bcp47For } from "../lib/hreflang";

// The video panel: opened on request from the quick-access dot
// (QuickAccessDot.tsx, via OPEN_VIDEO_EVENT) rather than inviting itself —
// visitors found the old auto-popping teaser bubble intrusive, and paired
// with the home-page prompt it collided on a phone (see git history on
// .vbub-invite/.hprompt). This component now renders nothing until asked.
//
// It is asset driven. With VITE_VIDEO_BUBBLE_SRC unset the component renders
// nothing at all, so the site never ships an empty player or a 404 request for a
// clip that was never uploaded.
//
// Two rules shape the rest of this file:
//   1. One panel per corner. The chat lives in the same corner, so the panel
//      steps aside while the chat is open (CHAT_STATE_EVENT) instead of
//      stacking two dialogs on the same 24px.
//   2. Everything the mouse can do, the keyboard can do: real buttons, an
//      accessible name on each, Escape to close, and focus handed back to
//      whatever opened the panel on the way out.

// The clip itself. An asset in public/ ("/media/lalum-intro.mp4") or an
// absolute CDN URL; empty means the feature is off and nothing renders. The
// poster is the still a visitor sees before the clip loads and wherever autoplay
// is suppressed, and the captions file (WebVTT) is what keeps the expanded
// player usable with the sound off. All three are read here rather than in
// lib/content.ts because vite.config.ts imports that module in Node, where
// import.meta.env does not exist.
const videoBubbleSrc = import.meta.env.VITE_VIDEO_BUBBLE_SRC ?? "";
const videoBubblePoster = import.meta.env.VITE_VIDEO_BUBBLE_POSTER ?? "";
const videoBubbleCaptions = import.meta.env.VITE_VIDEO_BUBBLE_CAPTIONS ?? "";

// What the clip says, in text, because the clip itself says nothing.
//
// The recording has no soundtrack: it was cut from a session about another
// subject, so the speaker is present but silent, and the message is carried
// here. Each line holds for about three seconds, which is a comfortable read
// in Hebrew at this size, and the last one hands over to the buttons below.
//
// The timings are tied to this fourteen second file. A new clip needs new
// lines, which is why they sit beside the component and not in the shared
// string table.
type Caption = { from: number; to: number; text: string; sub?: string };

// One clip per language, where a language has one of its own.
//
// Hebrew gets the reel: the lines are part of the picture and the narration is
// synced to them, so it needs no overlay. Every other language falls back to
// the configured clip, played silently under its own translated lines, because
// a French visitor reading French while a Hebrew voice talks over burned-in
// Hebrew is worse than no sound at all.
type Clip = { src: string; burnedIn?: boolean; spoken?: boolean };
const CLIPS: Record<string, Clip> = {
  he: { src: "/media/lalum-reel.mp4", burnedIn: true, spoken: true },
};
const SCRIPT: Record<string, Caption[]> = {
  he: [
    { from: 0.0, to: 4.95, text: "רוב הארגונים לא יודעים איפה הם חשופים" },
    { from: 5.1, to: 7.95, text: "בדרך כלל זה לא הסעיף המסובך בחוזה" },
    { from: 8.2, to: 11.0, text: "אלא הדבר הפשוט שאיש לא תיעד" },
    { from: 11.65, to: 14.92, text: "שמונה שאלות, שתי דקות, ואז נדבר" },
  ],
  en: [
    { from: 0.0, to: 4.95, text: "Most organisations do not know where they are exposed" },
    { from: 5.1, to: 7.95, text: "It is rarely the complicated clause" },
    { from: 8.2, to: 11.0, text: "It is the simple thing nobody recorded" },
    { from: 11.65, to: 14.92, text: "Eight questions, two minutes, then we talk" },
  ],
  es: [
    { from: 0.0, to: 4.95, text: "La mayoría de las organizaciones no sabe dónde está expuesta" },
    { from: 5.1, to: 7.95, text: "Casi nunca es la cláusula complicada" },
    { from: 8.2, to: 11.0, text: "Es lo simple que nadie documentó" },
    { from: 11.65, to: 14.92, text: "Ocho preguntas, dos minutos, y hablamos" },
  ],
  fr: [
    { from: 0.0, to: 4.95, text: "La plupart des organisations ignorent où elles sont exposées" },
    { from: 5.1, to: 7.95, text: "Ce n'est presque jamais la clause compliquée" },
    { from: 8.2, to: 11.0, text: "C'est la chose simple que personne n'a documentée" },
    { from: 11.65, to: 14.92, text: "Huit questions, deux minutes, puis on en parle" },
  ],
  ar: [
    { from: 0.0, to: 4.95, text: "معظم المؤسسات لا تعرف أين تكمن مخاطرها" },
    { from: 5.1, to: 7.95, text: "ونادرًا ما يكون السبب البند المعقّد" },
    { from: 8.2, to: 11.0, text: "بل الأمر البسيط الذي لم يوثّقه أحد" },
    { from: 11.65, to: 14.92, text: "ثمانية أسئلة، دقيقتان، ثم نتحدث" },
  ],
};

// Whether the file carries an audio track at all. No browser exposes this the
// same way, so: Firefox answers directly, Chromium and Safari only once some
// audio has been decoded, and the standard `audioTracks` list is missing in
// most. An unknown answer stays unknown, and the caller keeps the control.
function audioPresence(el: HTMLVideoElement): boolean | null {
  const v = el as HTMLVideoElement & {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: { length: number };
  };
  if (typeof v.mozHasAudio === "boolean") return v.mozHasAudio;
  if (v.audioTracks && typeof v.audioTracks.length === "number") return v.audioTracks.length > 0;
  if (typeof v.webkitAudioDecodedByteCount === "number" && v.webkitAudioDecodedByteCount > 0) return true;
  return null;
}

export function VideoBubble() {
  const { t, lang } = useLang();
  const V = t.ui.videoBubble;
  const { pathname } = useLocation();

  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // The clip failed to load (wrong path, unsupported codec, offline). Better to
  // disappear than to show a black circle where a face should be.
  const [broken, setBroken] = useState(false);

  const clip = CLIPS[lang];
  const src = clip?.src ?? videoBubbleSrc;
  // A reel carries its own lines; anything else needs the overlay.
  const lines = clip?.burnedIn ? undefined : SCRIPT[lang];
  // Sound is offered only where the narration matches the page's language.
  const spoken = clip?.spoken === true;
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  // null until the file has been asked. `true` only on a positive answer, so a
  // browser that cannot tell keeps the control rather than hiding a working one.
  const [hasAudio, setHasAudio] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const fullRef = useRef<HTMLVideoElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Whatever opened the panel (the quick-access dot's button) — focus returns
  // there on close, so the visitor lands back exactly where they started
  // instead of at the top of the page.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    fullRef.current?.pause();
  }, []);

  const expand = useCallback(() => {
    // flushSync so the player exists before play() is called, keeping the call
    // inside the click that triggered it. Browsers only allow audio to start on
    // a user gesture, and an effect a tick later no longer counts as one.
    flushSync(() => setOpen(true));
    const el = fullRef.current;
    if (!el) return;
    el.currentTime = 0;
    // The clip carries a voiceover recorded for it, so opening the player asks
    // for sound where that voice matches the page: the click is the gesture
    // browsers require. A refusal falls back to muted with the control
    // showing, rather than a player that sits there doing nothing.
    el.muted = !spoken;
    setMuted(el.muted);
    void el.play().catch(() => {
      el.muted = true;
      setMuted(true);
      void el.play().catch(() => setPlaying(false));
    });
  }, [spoken]);

  // The chat owns the corner while it is open.
  useEffect(() => {
    const onChat = (e: Event) => {
      const next = (e as CustomEvent<{ open?: boolean }>).detail?.open === true;
      setChatOpen(next);
      if (next) close();
    };
    window.addEventListener(CHAT_STATE_EVENT, onChat);
    return () => window.removeEventListener(CHAT_STATE_EVENT, onChat);
  }, [close]);

  // Requested from the quick-access dot. Ignored on quiet routes / while
  // broken, same as the dot's own menu already arranges for.
  useEffect(() => {
    const onOpenRequest = (e: Event) => {
      if (!videoBubbleSrc || broken || QUIET_ROUTES.test(pathname)) return;
      const trigger = (e as CustomEvent<{ trigger?: HTMLElement | null }>).detail?.trigger ?? null;
      returnFocusRef.current = trigger;
      expand();
    };
    window.addEventListener(OPEN_VIDEO_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPEN_VIDEO_EVENT, onOpenRequest);
  }, [broken, pathname, expand]);

  // Leaving the page (usually by tapping one of the calls to action) closes the
  // player, so a video never floats over the page the visitor just asked for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes, and focus moves into the panel and back out again.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const raf = requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      returnFocusRef.current?.focus();
    };
  }, [open, close]);

  if (!open || !videoBubbleSrc || broken || chatOpen || QUIET_ROUTES.test(pathname)) return null;

  function togglePlay() {
    const el = fullRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => { /* ignore */ });
    else el.pause();
  }

  function toggleMute() {
    const el = fullRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }

  function seek(seconds: number) {
    const el = fullRef.current;
    if (!el) return;
    el.currentTime = seconds;
    setProgress(seconds);
  }

  // The line on screen right now. Anything outside every window shows nothing,
  // so a clip longer than the script simply runs on without text.
  const caption = lines?.find((c) => progress >= c.from && progress < c.to) ?? null;

  const captions = videoBubbleCaptions ? (
    <track kind="captions" src={videoBubbleCaptions} srcLang={bcp47For(lang)} label={t.ui.langName} default />
  ) : null;

  return (
    <div className="vbub-dock is-open">
      <div ref={panelRef} className="vbub-panel" role="dialog" aria-label={V.open}>
        <div className="vbub-panel-tools">
          <button ref={closeRef} type="button" className="vbub-tool" onClick={close} aria-label={V.close} title={V.close}>
            <span aria-hidden="true">×</span>
          </button>
          <button type="button" className="vbub-tool" onClick={togglePlay} aria-label={playing ? V.pause : V.play} title={playing ? V.pause : V.play}>
            {playing ? (
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          {hasAudio !== false && spoken && (
          <button type="button" className="vbub-tool" onClick={toggleMute} aria-label={muted ? V.unmute : V.mute} title={muted ? V.unmute : V.mute}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H2v6h4l5 4z" />
              {muted ? <path d="m17 9 4 6M21 9l-4 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
            </svg>
          </button>
          )}
        </div>

        <video
          ref={fullRef}
          className="vbub-panel-video"
          src={src}
          poster={videoBubblePoster || undefined}
          playsInline
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={(e) => {
            // The element has to be captured here: React clears
            // `currentTarget` once the handler returns, and the updater below
            // runs during the next render, where it would already be null.
            const el = e.currentTarget;
            setDuration(el.duration || 0);
            setHasAudio((known) => (known === true ? true : audioPresence(el)));
          }}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
          onError={() => { setBroken(true); setOpen(false); }}
        >
          {captions}
        </video>

        {/* The lines change every few seconds, which no screen reader can
            follow, so the whole message is offered once, in order, and the
            moving copy is marked decorative. */}
        {lines && (
          <p className="vbub-script-full">{lines.map((c) => c.text).join(". ")}</p>
        )}

        {caption && (
          <div className="vbub-script" aria-hidden="true">
            <p className="vbub-script-line">{caption.text}</p>
          </div>
        )}

        <div className="vbub-panel-foot">
          <input
            className="vbub-seek"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(progress, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label={V.seek}
            disabled={!duration}
          />

          <div className="vbub-meta">
            <span className="vbub-badge">{V.badge}</span>
            <h3 className="vbub-name">{t.home.founderName}</h3>
            <p className="vbub-tagline">{V.tagline}</p>
          </div>

          <div className="vbub-ctas">
            <Link to="/book" className="vbub-cta-gold" onClick={close}>{V.primaryCta}</Link>
            <Link to="/risk" className="vbub-cta-ghost" onClick={close}>
              {V.secondaryCta} <span aria-hidden="true">⚖️</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
