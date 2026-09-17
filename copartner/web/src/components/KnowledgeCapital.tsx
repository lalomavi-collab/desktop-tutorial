import { KNOWLEDGE_CHAIN, KNOWLEDGE_SOURCES } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function KnowledgeCapital() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          align="center"
          title="What you learned over 20 years should not disappear with the document."
          subtitle="Accumulated professional knowledge can be structured into a governed knowledge environment, with full traceability."
        />

        <Reveal delay={100} className="mt-14 flex flex-wrap justify-center gap-3">
          {KNOWLEDGE_SOURCES.map((s) => (
            <span key={s} className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted">{s}</span>
          ))}
        </Reveal>

        <Reveal delay={200} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {KNOWLEDGE_CHAIN.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <span className="rounded-full border border-cyan/30 bg-cyan/5 px-5 py-2.5 text-sm text-ink">{step}</span>
              {i < KNOWLEDGE_CHAIN.length - 1 && <span aria-hidden="true" className="text-cyan">→</span>}
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
