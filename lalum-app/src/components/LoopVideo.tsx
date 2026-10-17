import { useEffect, useRef } from "react";

/** A silent, looping clip. Autoplays muted and holds still on its poster for
 *  visitors who ask for reduced motion. With `label` it is announced as an
 *  image with that description; without, it is decorative and hidden from
 *  assistive tech. No controls either way. */
export function LoopVideo({ src, poster, className, label }: { src: string; poster: string; className?: string; label?: string }) {
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
    <div className={className} {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      <video ref={ref} muted loop playsInline autoPlay preload="metadata" poster={poster} tabIndex={-1}>
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}
