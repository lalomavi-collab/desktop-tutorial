import { CLIENT_INTELLIGENCE_CHAIN } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function ClientIntelligence() {
  return (
    <section className="py-24 md:py-32 border-t border-border bg-bg-2">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          align="center"
          title="A structured intelligence layer around every client relationship."
          subtitle="Confidentiality, permissions and professional obligations are respected throughout."
        />

        <Reveal delay={150} className="mt-14 flex flex-wrap items-center justify-center gap-3">
          {CLIENT_INTELLIGENCE_CHAIN.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <span className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm text-ink">{step}</span>
              {i < CLIENT_INTELLIGENCE_CHAIN.length - 1 && <span aria-hidden="true" className="text-cyan">↓</span>}
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
