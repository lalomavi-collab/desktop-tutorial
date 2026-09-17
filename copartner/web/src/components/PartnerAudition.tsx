import { AUDITION_STEPS } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function PartnerAudition() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 border-t border-border bg-bg-2">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading
          align="center"
          eyebrow="Not a Job Interview"
          title="The Partner Audition."
          subtitle="The applicant demonstrates what they know, how they work and how they decide. The last point is critical: the objective is not to automate everything, but to find where intelligence creates professional leverage."
        />
        <Reveal delay={150} className="mt-12 flex flex-col gap-3">
          {AUDITION_STEPS.map((step, i) => {
            const isLast = i === AUDITION_STEPS.length - 1;
            return (
              <div
                key={step}
                className={`flex items-center gap-4 rounded-xl border p-4 ${isLast ? "border-gold/40 bg-gold/5" : "border-border bg-surface"}`}
              >
                <span className={`font-mono text-sm ${isLast ? "text-gold" : "text-cyan"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm text-ink">{step}</span>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
