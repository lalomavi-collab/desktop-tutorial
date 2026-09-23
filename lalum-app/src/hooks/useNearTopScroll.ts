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
  const [nearTop, setNearTop] = useState(() => (typeof window === "undefined" ? false : window.scrollY < thresholdPx));

  useEffect(() => {
    function onScroll() {
      setNearTop(window.scrollY < thresholdPx);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [thresholdPx]);

  return nearTop;
}
