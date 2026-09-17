import { BRAND } from "../lib/content";
import Reveal from "./Reveal";
import SystemVisualizer from "./SystemVisualizer";

export default function Hero() {
  return (
    <section id="top" className="relative pt-36 pb-24 md:pt-44 md:pb-32 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--color-cyan) 12%, transparent), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-16 items-center">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.25em] text-cyan uppercase mb-6">
            {BRAND.name} · {BRAND.descriptor}
          </p>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.08] text-ink whitespace-pre-line">
            {BRAND.statement}
          </h1>
          <p className="mt-8 text-lg text-muted leading-relaxed max-w-xl">
            A new operating model for senior legal practitioners. Practice-specific AI engines.
            Cross-domain intelligence. On-demand infrastructure. Human judgment at the center.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#apply"
              className="inline-flex items-center justify-center rounded-full bg-cyan text-bg px-7 py-3.5 text-sm font-bold tracking-wide hover:opacity-90 transition-opacity focus-ring"
            >
              APPLY TO LEAD A DOMAIN
            </a>
            <a
              href="#platform"
              className="inline-flex items-center justify-center rounded-full border border-border px-7 py-3.5 text-sm font-semibold text-ink hover:border-muted transition-colors focus-ring"
            >
              EXPLORE THE ARCHITECTURE
            </a>
          </div>
        </Reveal>

        <SystemVisualizer />
      </div>
    </section>
  );
}
