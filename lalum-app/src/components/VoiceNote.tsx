import { useRef, useState } from "react";
import { useLang } from "../context/LangContext";

// A short recording from the founder, sitting beside his details rather than
// floating over the page: nothing plays until it is asked to, and asking is one
// button.
//
// It renders only in Hebrew, because the recording is in Hebrew. A player
// offered on the English or Arabic pages would promise something the file does
// not deliver, and a translated label would not change what comes out of the
// speaker.
//
// Two sources on purpose: AAC first, which every current browser and Safari
// play, and Opus second for builds shipped without the patented codecs. The
// browser takes the first it understands.

const SOURCES = [
  { src: "/media/lalum-voice.m4a", type: "audio/mp4" },
  { src: "/media/lalum-voice.ogg", type: "audio/ogg; codecs=opus" },
];

// Hebrew-only labels: the recording itself is in Hebrew, and the component
// renders only on the Hebrew site (see the lang guard below), so it never
// reaches a translated page.
const COPY = {
  label: "האזינו לד״ר עו״ד אברהם ללום",
  play: "האזנה להקלטה",
  pause: "עצירת ההקלטה",
  seek: "מיקום בהקלטה",
};

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function VoiceNote() {
  const { lang } = useLang();
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(0);

  if (lang !== "he") return null;

  function toggle() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }

  function seek(seconds: number) {
    const el = ref.current;
    if (!el) return;
    el.currentTime = seconds;
    setAt(seconds);
  }

  return (
    <div className="voice">
      <button type="button" className="voice-btn" onClick={toggle} aria-label={playing ? COPY.pause : COPY.play} title={playing ? COPY.pause : COPY.play}>
        {playing ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      <div className="voice-body">
        <span className="voice-label">{COPY.label}</span>
        <input
          className="voice-seek"
          type="range"
          min={0}
          max={length || 0}
          step={0.1}
          value={Math.min(at, length || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={COPY.seek}
          disabled={!length}
        />
      </div>

      <span className="voice-time" dir="ltr">{clock(at)} / {clock(length)}</span>

      {/* preload="none": a recording nobody asked for should not cost anyone a
          download, least of all on a phone. */}
      <audio
        ref={ref}
        preload="none"
        onLoadedMetadata={(e) => setLength(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setAt(0); }}
      >
        {SOURCES.map((s) => <source key={s.src} src={s.src} type={s.type} />)}
      </audio>
    </div>
  );
}
