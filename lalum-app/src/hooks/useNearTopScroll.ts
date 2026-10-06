import { useEffect, useState } from "react";

// True while the page is scrolled less than `thresholdPx` from the top.
// Used by the floating accessibility and chat docks: on a mid-height phone
// viewport (roughly 740-830px tall, a very common range once the browser's
// own address bar is factored in), their fixed bottom position lands
// directly on top of the hero's CTA row before any scrolling happens,
// hiding a real clickable button behind an opaque circle. A few hundred
// pixels of scroll always clears that specific hero content out of the
// dock's fixed zone, so hiding the dock only for that initial stretch (it
// reappears the instant the visitor scrolls) resolves the collision on
// every page without hard-coding a page-specific pixel offset.
export function useNearTopScroll(thresholdPx = 180): boolean {
  const [nearTop, setNearTop] = useState(false);

  useEffect(() => {
    // Guards against a page short enough that it can never scroll past
    // thresholdPx (a short article, a form-only page): without this,
    // scrollY can never reach the threshold, so the hook would return true
    // forever and the dock would never appear on that page at all. Found
    // by testing the fix on more than just the page it was written
    // against — the same fixed-dock-over-content trade-off this hook
    // makes is only worth it when scrolling can actually clear the zone.
    function evaluate() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setNearTop(maxScroll > thresholdPx && window.scrollY < thresholdPx);
    }
    evaluate();
    window.addEventListener("scroll", evaluate, { passive: true });
    window.addEventListener("resize", evaluate);
    return () => {
      window.removeEventListener("scroll", evaluate);
      window.removeEventListener("resize", evaluate);
    };
  }, [thresholdPx]);

  return nearTop;
}
