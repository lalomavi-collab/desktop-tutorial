import { PRACTICE_AREAS_TAGLINE } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const CHAIN = ["Domain", "Methodology", "Knowledge", "Workflow", "AI Engine", "Human Review"];

export default function DomainEngine() {
  return (
    <section id="domains" className="py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          align="center"
          title="Every practice deserves its own intelligence."
          subtitle={PRACTICE_AREAS_TAGLINE + " The system is configured around the logic, documents, workflows, risks and knowledge of each domain."}
        />

        <Reveal delay={150} className="mt-14 flex flex-wrap items-center justify-center gap-3">
          {CHAIN.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <span className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm text-ink whitespace-nowrap">
                {step}
              </span>
              {i < CHAIN.length - 1 && <span aria-hidden="true" className="text-cyan">→</span>}
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
