import { useEffect } from "react";

// Locks background scroll while a full-screen overlay is open — chiefly the
// header's mobile "more" menu and the quick-access menu once they render as
// bottom sheets (see the .header-more-menu / .qad-menu mobile rules in
// index.css). A sheet sliding up from the screen edge should read as its own
// surface, not a panel floating over content that keeps scrolling underneath
// it, the way a native app sheet behaves.
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
