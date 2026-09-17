import type { ReactNode } from "react";
import { useReveal } from "../hooks/useReveal";

export default function Reveal({
  children, className = "", delay = 0,
}: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, className: revealClass } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`${revealClass} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
