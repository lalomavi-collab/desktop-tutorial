import { useEffect } from "react";

// Sections arrive as the reader reaches them.
//
// The page already had one animation, on the route wrapper, and it played once
// at mount. By the time anyone scrolled to the fourth section it had long since
// finished, so everything past the first screen appeared fully formed and
// static: the reader crossed from one subject to the next with nothing marking
// the crossing.
//
// Four constraints shaped this:
//
//   1. The hidden state is added here, in JavaScript, and never sits in the
//      stylesheet. A crawler, a reader with JavaScript off, and the prerendered
//      document all get the page fully visible. A stylesheet that starts
//      content at opacity 0 hides it from anyone whose script never runs.
//   2. Only sections still below the fold are touched. Anything already on
//      screen, the hero above all, is left exactly as it is, so the largest
//      element on the page is never hidden and then faded back in.
//   3. It respects prefers-reduced-motion, and print, where an unrevealed
//      section would otherwise come out blank.
//   4. A section that has been passed is revealed whether or not the reader
//      lingered on it. The first version of this used an IntersectionObserver,
//      and a scroll fast enough to cross a section between two delivered
//      callbacks (End, then Home) left it at opacity 0 with no way back. A
//      measured pass over what is left reveals anything the viewport has
//      reached, including what it has already gone past, so no scroll speed
//      can strand a section invisible.
export function useScrollReveal(routeKey: string) {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const main = document.getElementById("main");
    if (!main) return;

    let pending: HTMLElement[] = [];
    let queued = false;

    function reveal() {
      queued = false;
      // A section starts its reveal once a tenth of the viewport still lies
      // below its top edge, so it is already moving as the reader looks at it.
      const fold = window.innerHeight * 0.9;
      pending = pending.filter((el) => {
        if (el.getBoundingClientRect().top >= fold) return true;
        el.classList.add("reveal-in");
        return false;
      });
      if (!pending.length) window.removeEventListener("scroll", onScroll);
    }

    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(reveal);
    }

    function scan() {
      const fold = window.innerHeight * 0.92;
      let added = false;
      for (const el of main!.querySelectorAll<HTMLElement>(".route-view > section")) {
        if (el.dataset.reveal) continue;
        el.dataset.reveal = "1";
        if (el.getBoundingClientRect().top < fold) continue;
        el.classList.add("reveal");
        pending.push(el);
        added = true;
      }
      if (added) window.addEventListener("scroll", onScroll, { passive: true });
    }

    scan();
    // Routes are code-split, so on a cold navigation the page's sections do not
    // exist yet when this runs. They are picked up as they mount.
    const mo = new MutationObserver(() => scan());
    mo.observe(main, { childList: true, subtree: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [routeKey]);
}
