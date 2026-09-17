import { AUDIT_STEPS } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function PracticeAudit() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading eyebrow="AI Practice Audit" align="center" title="Where does intelligence create leverage?" />
        <Reveal delay={150} className="mt-14 flex flex-col">
          {AUDIT_STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-5">
              <div className="flex flex-col items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan/40 bg-cyan/5 text-xs font-bold text-cyan">
                  {i + 1}
                </span>
                {i < AUDIT_STEPS.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden="true" />}
              </div>
              <div className="pb-8">
                <p className="font-semibold text-ink">{step.title}</p>
                <p className="text-sm text-muted mt-1">{step.body}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
