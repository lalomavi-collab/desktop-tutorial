import { LAB_STAGES } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function PartnerLab() {
  return (
    <section className="py-24 md:py-32 border-t border-border bg-bg-2">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          align="center"
          eyebrow="Partner Lab"
          title="Build the intelligence around your practice."
          subtitle="The environment in which the practice-specific AI architecture is developed."
        />
        <Reveal delay={150} className="mt-14 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {LAB_STAGES.map((stage, i) => (
            <div key={stage} className="rounded-xl border border-border bg-surface p-4 text-center">
              <p className="text-xs font-mono text-cyan">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-2 text-sm font-semibold text-ink">{stage}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
