import { FOUNDER } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function Founder() {
  return (
    <section className="py-24 md:py-32 border-t border-border bg-bg-2">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading eyebrow="Founder" title="Built by a lawyer who understands both sides." />

        <Reveal delay={150} className="mt-14 grid md:grid-cols-[220px_1fr] gap-10 items-start">
          <div className="rounded-2xl border border-border bg-surface aspect-square flex items-center justify-center">
            <span className="text-4xl font-display font-bold text-muted" aria-hidden="true">AL</span>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-ink">{FOUNDER.name}</h3>
            <p className="text-sm text-cyan mt-1">{FOUNDER.role}</p>
            <ul className="mt-6 space-y-2.5">
              {FOUNDER.facts.map((f) => (
                <li key={f} className="text-sm text-muted flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              {FOUNDER.axes.map((a) => (
                <span key={a} className="rounded-full border border-border px-3 py-1 text-xs text-muted">{a}</span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
