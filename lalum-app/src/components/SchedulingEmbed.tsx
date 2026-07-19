import { useEffect, useRef } from "react";

// Branded Calendly inline embed. Users schedule without leaving lalumapp.com.
// Colors are Calendly widget params (hex without '#'). Default is the LALUM
// premium dark palette (obsidian background, cream text, gold accent).

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (opts: {
        url: string;
        parentElement: HTMLElement;
        prefill?: { name?: string; email?: string };
        utm?: Record<string, string>;
      }) => void;
    };
  }
}

type Theme = { background: string; text: string; primary: string };

const OBSIDIAN_GOLD: Theme = { background: "0a0a0a", text: "fffdd0", primary: "d4af37" };

type Props = {
  url: string;
  prefill?: { name?: string; email?: string };
  theme?: Partial<Theme>;
  height?: number;
  onScheduled?: () => void;
};

let loader: Promise<void> | null = null;
function loadCalendly(): Promise<void> {
  if (window.Calendly) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://assets.calendly.com/assets/external/widget.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://assets.calendly.com/assets/external/widget.js";
    js.async = true;
    js.onload = () => resolve();
    js.onerror = () => reject(new Error("calendly_load_failed"));
    document.body.appendChild(js);
  });
  return loader;
}

function withTheme(url: string, t: Theme): string {
  const u = new URL(url);
  u.searchParams.set("background_color", t.background);
  u.searchParams.set("text_color", t.text);
  u.searchParams.set("primary_color", t.primary);
  u.searchParams.set("hide_gdpr_banner", "1");
  return u.toString();
}

export function SchedulingEmbed({ url, prefill, theme, height = 680, onScheduled }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const t: Theme = { ...OBSIDIAN_GOLD, ...theme };

  useEffect(() => {
    let alive = true;
    loadCalendly()
      .then(() => {
        if (!alive || !ref.current || !window.Calendly) return;
        ref.current.innerHTML = "";
        window.Calendly.initInlineWidget({ url: withTheme(url, t), parentElement: ref.current, prefill });
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, t.background, t.text, t.primary, prefill?.name, prefill?.email]);

  useEffect(() => {
    if (!onScheduled) return;
    const cb = onScheduled;
    function onMsg(e: MessageEvent) {
      const d = e.data as { event?: string } | null;
      if (d && typeof d === "object" && d.event === "calendly.event_scheduled") cb();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onScheduled]);

  return <div ref={ref} style={{ minWidth: 320, height, borderRadius: 16, overflow: "hidden" }} />;
}
