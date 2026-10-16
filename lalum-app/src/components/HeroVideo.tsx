import { useEffect, useRef } from "react";

/** The home hero's silent loop on AI and real estate (public/media/lalum-hero.mp4).
 *  Autoplays muted, loops, and holds still on the poster for visitors who ask
 *  for reduced motion. Decorative: hidden from assistive tech, no controls. */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (mq.matches) v.pause();
      else void v.play().catch(() => {});
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className="founder-hero hero-video" aria-hidden="true">
      <video ref={ref} muted loop playsInline autoPlay preload="metadata" poster="/media/lalum-hero.jpg" tabIndex={-1}>
        <source src="/media/lalum-hero.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
