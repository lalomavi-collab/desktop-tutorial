import { useEffect, useRef, useState } from "react";

// Adds .is-visible to an element once it scrolls into view, driving the
// .reveal CSS transition (index.css). Fails open: if IntersectionObserver is
// unavailable the element is marked visible immediately.
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  // Lazy initializer, not a synchronous setState-in-effect: environments
  // without IntersectionObserver start (and stay) visible.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, className: `reveal${visible ? " is-visible" : ""}` };
}
