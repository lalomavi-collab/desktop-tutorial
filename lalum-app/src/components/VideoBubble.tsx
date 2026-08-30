import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "react-router-dom";
import { Link } from "./AppLink";
import { useLang } from "../context/LangContext";
import { CHAT_STATE_EVENT } from "./chatEvents";
import { bcp47For } from "../lib/hreflang";

// A floating video bubble: a small circle in the corner of every marketing page
// playing a silent looping preview, which expands into a vertical player with
// sound and two calls to action.
//
// It is asset driven. With VITE_VIDEO_BUBBLE_SRC unset the component renders
// nothing at all, so the site never ships an empty player or a 404 request for a
// clip that was never uploaded.
//
// Three rules shape the rest of this file:
//   1. One panel per corner. The chat lives in the same corner, so the bubble
//      steps aside while the chat is open (CHAT_STATE_EVENT) instead of
//      stacking two dialogs on the same 24px.
//   2. Nothing plays behind the visitor's back. A visitor who asked for reduced
//      motion, or whose browser is in data-saver mode, gets a still poster and
//      an explicit play control, never an autoplaying loop.
//   3. Everything the mouse can do, the keyboard can do: real buttons, an
//      accessible name on each, Escape to close, and focus handed back to the
//      bubble on the way out.

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

const DISMISS_KEY = "lalum_video_bubble_hidden_at";
// A visitor who closed the bubble should not meet it again on the next page, or
// the next visit. A month is long enough to read as "it listened", short enough
// that a returning client still meets a new clip.
const DISMISS_DAYS = 30;

// Where a marketing video would interrupt rather than invite: the sign-in form
// and the private client area, which people reach with a task already in mind.
const QUIET_ROUTES = /^\/(login|portal)(\/|$)/;

function hiddenByVisitor(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

// Three ways a visitor says "do not start a video on your own": the operating
// system's reduced-motion setting, the site's own accessibility menu (which puts
// .a11y-reduce-motion on <html>), and a browser in data-saver mode. Any one of
// them turns the loop into a still poster with a play control.
function prefersStill(): boolean {
  try {
    if (document.documentElement.classList.contains("a11y-reduce-motion")) return true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return conn?.saveData === true;
  } catch {
    return false;
  }
}


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
};

// The clip's length, as m:ss. Shown on the invitation so "short" is a number
// rather than a promise, and read from the file at runtime so it stays true
// when the clip is replaced.
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

function clock(seconds: number): string | null {
  // A browser that cannot decode the file reports NaN or Infinity, and a
  // stream reports something absurd. Anything outside a plausible clip length
  // prints nothing rather than a wrong promise.
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600) return null;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function VideoBubble() {
  const { t, lang } = useLang();
  const V = t.ui.videoBubble;
  const { pathname } = useLocation();

  const [visible, setVisible] = useState(() => !hiddenByVisitor());
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // The clip failed to load (wrong path, unsupported codec, offline). Better to
  // disappear than to show a black circle where a face should be.
  const [broken, setBroken] = useState(false);
  const [still, setStill] = useState(prefersStill);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  // null until the file has been asked. `true` only on a positive answer, so a
  // browser that cannot tell keeps the control rather than hiding a working one.
  const [hasAudio, setHasAudio] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const previewRef = useRef<HTMLVideoElement>(null);
  const fullRef = useRef<HTMLVideoElement>(null);
  const orbRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    fullRef.current?.pause();
  }, []);

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

  // Leaving the page (usually by tapping one of the calls to action) closes the
  // player, so a video never floats over the page the visitor just asked for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Either setting can be flipped mid-visit: the accessibility menu is one click
  // away on every page, so watch for it rather than reading the preference once.
  useEffect(() => {
    const recheck = () => setStill(prefersStill());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", recheck);
    const obs = new MutationObserver(recheck);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mq.removeEventListener("change", recheck);
      obs.disconnect();
    };
  }, []);

  // The silent preview only runs while it is on screen and the tab is in front.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    if (open || still) {
      el.pause();
      return;
    }
    el.muted = true;
    const start = () => { void el.play().catch(() => { /* autoplay refused; the poster stands in */ }); };
    const onVisibility = () => (document.hidden ? el.pause() : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [open, still, visible, chatOpen]);

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
      orbRef.current?.focus();
    };
  }, [open, close]);

  if (!videoBubbleSrc || broken || !visible || chatOpen || QUIET_ROUTES.test(pathname)) return null;

  function expand() {
    // flushSync so the player exists before play() is called, keeping the call
    // inside the click that triggered it. Browsers only allow audio to start on
    // a user gesture, and an effect a tick later no longer counts as one.
    flushSync(() => setOpen(true));
    previewRef.current?.pause();
    const el = fullRef.current;
    if (!el) return;
    el.currentTime = 0;
    // The clip carries a voiceover recorded for it, so opening the player asks
    // for sound: the click is the gesture browsers require. A refusal falls
    // back to muted with the control showing, rather than a player that sits
    // there doing nothing. The collapsed preview stays silent either way, since
    // nothing should make noise before it is asked to.
    el.muted = false;
    setMuted(false);
    void el.play().catch(() => {
      el.muted = true;
      setMuted(true);
      void el.play().catch(() => setPlaying(false));
    });
  }

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

  function hideForGood() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
    setVisible(false);
  }

  // The line on screen right now. Anything outside every window shows nothing,
  // so a clip longer than the script simply runs on without text.
  const lines = SCRIPT[lang];
  const caption = lines?.find((c) => progress >= c.from && progress < c.to) ?? null;

  const captions = videoBubbleCaptions ? (
    <track kind="captions" src={videoBubbleCaptions} srcLang={bcp47For(lang)} label={t.ui.langName} default />
  ) : null;

  return (
    <div className={"vbub-dock" + (open ? " is-open" : "")}>
      {!open && (
        <div className="vbub-orb-wrap">
          {/* One control, not a circle plus a caption that only appears on
              hover. A phone has no hover, so the old bubble was a floating face
              with nothing saying what tapping it would do. */}
          <button ref={orbRef} type="button" className="vbub-invite" onClick={expand} aria-label={V.open} title={V.open}>
            <span className="vbub-orb">
              <video
                ref={previewRef}
                className="vbub-orb-video"
                src={videoBubbleSrc}
                poster={videoBubblePoster || undefined}
                preload={still ? "none" : "metadata"}
                loop
                muted
                playsInline
                tabIndex={-1}
                aria-hidden="true"
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration || 0);
                  setHasAudio(audioPresence(e.currentTarget));
                }}
                onError={() => setBroken(true)}
              />
              <span className="vbub-orb-play" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </span>
            </span>
            <span className="vbub-invite-txt" aria-hidden="true">
              <span className="vbub-invite-line">{V.teaser}</span>
              {/* The runtime knows how long the clip is, so the promise is
                  measured rather than guessed. */}
              <span className="vbub-invite-meta">{V.open}{clock(duration) ? ` · ${clock(duration)}` : ""}</span>
            </span>
          </button>

          <button type="button" className="vbub-dismiss" onClick={hideForGood} aria-label={V.hide} title={V.hide}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}

      {open && (
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
            {hasAudio !== false && (
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
            src={videoBubbleSrc}
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
      )}
    </div>
  );
}
