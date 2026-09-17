import { PARTNER_CRITERIA } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function PartnerProfile() {
  return (
    <section id="partner-model" className="py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading
          align="center"
          eyebrow="Partner Model"
          title="Who leads a domain?"
          subtitle="CoPartner AI is designed for experienced practitioners."
        />
        <Reveal delay={150} className="mt-12 grid sm:grid-cols-2 gap-4">
          {PARTNER_CRITERIA.map((c) => (
            <div key={c} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
              <span aria-hidden="true" className="mt-1 text-cyan">✓</span>
              <span className="text-sm text-muted">{c}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
