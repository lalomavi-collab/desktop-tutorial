import type { ReactNode } from "react";
import Reveal from "./Reveal";

export default function SectionHeading({
  eyebrow, title, subtitle, align = "left",
}: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; align?: "left" | "center" }) {
  const alignClass = align === "center" ? "text-center mx-auto" : "";
  return (
    <Reveal className={`max-w-3xl ${alignClass}`}>
      {eyebrow && (
        <p className="text-xs font-semibold tracking-[0.2em] text-cyan uppercase mb-4">{eyebrow}</p>
      )}
      <h2 className="text-3xl md:text-5xl font-bold text-ink leading-tight">{title}</h2>
      {subtitle && <p className="mt-5 text-base md:text-lg text-muted leading-relaxed">{subtitle}</p>}
    </Reveal>
  );
}
