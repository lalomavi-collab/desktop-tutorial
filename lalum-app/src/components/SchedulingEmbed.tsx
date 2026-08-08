// Inline scheduling embed. Users book without leaving lalumapp.com. Renders
// the provider's booking page in an iframe, so swapping the scheduling vendor
// (Zoho Bookings, or anything else that allows iframe embedding) only means
// changing the `url` this component receives, no component changes.

import { useEffect, useMemo } from "react";

type Theme = { background: string; text: string; primary: string };

const OBSIDIAN_GOLD: Theme = { background: "0a0a0a", text: "fffdd0", primary: "d4af37" };

type Props = {
  url: string;
  prefill?: { name?: string; email?: string };
  theme?: Partial<Theme>;
  height?: number;
  onScheduled?: () => void;
};

// Best-effort prefill via query params. Param names are provider-specific and
// unverified for the currently connected provider; unsupported params are
// simply ignored by the destination page.
function withPrefill(url: string, prefill?: { name?: string; email?: string }): string {
  if (!url || !prefill) return url;
  try {
    const u = new URL(url);
    if (prefill.name) u.searchParams.set("name", prefill.name);
    if (prefill.email) u.searchParams.set("email", prefill.email);
    return u.toString();
  } catch {
    return url;
  }
}

export function SchedulingEmbed({ url, prefill, theme, height = 680, onScheduled }: Props) {
  const t: Theme = { ...OBSIDIAN_GOLD, ...theme };
  const src = useMemo(() => withPrefill(url, prefill), [url, prefill?.name, prefill?.email]);

  useEffect(() => {
    if (!onScheduled) return;
    const cb = onScheduled;
    // Booking confirmation via postMessage: the event name/shape depends on
    // the connected provider and has not been verified here. This listens
    // broadly for anything that looks like a booking-confirmed event; if the
    // provider does not send one, onScheduled simply never fires (the visitor
    // still gets a confirmation from the provider itself, by email).
    function onMsg(e: MessageEvent) {
      const d = e.data as { event?: string } | null;
      if (d && typeof d === "object" && typeof d.event === "string" && /book|schedul/i.test(d.event)) cb();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onScheduled]);

  if (!src) return null;

  return (
    <div style={{ minWidth: 320, height, borderRadius: 16, overflow: "hidden", background: `#${t.background}` }}>
      <iframe src={src} title="Schedule a meeting" width="100%" height="100%" style={{ border: 0, display: "block" }} />
    </div>
  );
}
