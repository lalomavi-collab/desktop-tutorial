import { BRAND } from "../lib/content";
import Reveal from "./Reveal";

export default function FinalCTA() {
  return (
    <section className="py-24 md:py-32 border-t border-border text-center">
      <div className="mx-auto max-w-2xl px-6">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold text-ink">YOUR PRACTICE. ENGINEERED.</h2>
          <p className="mt-6 text-muted">
            You built the expertise. {BRAND.name} builds the intelligence infrastructure around it.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a href="#apply" className="inline-flex items-center justify-center rounded-full bg-cyan text-bg px-7 py-3.5 text-sm font-bold tracking-wide hover:opacity-90 transition-opacity focus-ring">
              APPLY TO LEAD A DOMAIN
            </a>
            <a href="#platform" className="inline-flex items-center justify-center rounded-full border border-border px-7 py-3.5 text-sm font-semibold text-ink hover:border-muted transition-colors focus-ring">
              EXPLORE THE PLATFORM
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
