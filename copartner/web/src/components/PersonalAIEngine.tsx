import { AI_MODULES } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function PersonalAIEngine() {
  return (
    <section className="py-24 md:py-32 border-t border-border bg-bg-2">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Your Practice, Engineered"
          title="Your practice. Engineered."
          subtitle="Your experience should not disappear into documents, emails and individual memory. It should become an intelligent system, operating within defined sources, permissions, workflows and review protocols."
        />

        <div className="mt-16 flex flex-col items-center">
          <Reveal className="rounded-full border border-gold/40 bg-gold/5 px-8 py-4 text-center">
            <p className="text-sm font-semibold text-ink">Partner AI Engine</p>
          </Reveal>

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
            {AI_MODULES.map((m, i) => (
              <Reveal key={m.key} delay={i * 80}>
                <div className="group h-full rounded-xl border border-border bg-surface p-6 hover:border-cyan/40 hover:bg-cyan/5 transition-colors">
                  <span className="text-xs font-mono text-cyan">{m.n}</span>
                  <h3 className="mt-2 text-lg font-bold text-ink">{m.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{m.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
