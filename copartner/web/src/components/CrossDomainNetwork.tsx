import { CROSS_DOMAIN_EXAMPLE } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function CrossDomainNetwork() {
  return (
    <section className="py-24 md:py-32 border-t border-border bg-bg-2">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          align="center"
          title="One client. Multiple domains. One intelligence layer."
          subtitle="Complex matters rarely respect departmental boundaries. Domain-specific expertise stays specialized, while becoming connected."
        />

        <Reveal delay={150} className="mt-14">
          <div className="rounded-2xl border border-border bg-surface p-8 md:p-10">
            <p className="text-center text-sm text-muted mb-6">A single client may require</p>
            <div className="flex flex-wrap justify-center gap-3">
              {CROSS_DOMAIN_EXAMPLE.map((d) => (
                <span key={d} className="rounded-full border border-cyan/30 bg-cyan/5 px-4 py-2 text-sm text-ink">{d}</span>
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <span className="rounded-full border border-gold/40 bg-gold/10 px-5 py-2 text-sm font-semibold text-gold">
                One CoPartner Intelligence Layer
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
