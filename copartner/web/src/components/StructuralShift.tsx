import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const TRADITIONAL = ["Fixed teams", "Fixed overhead", "Fragmented expertise", "Siloed departments", "Generic technology", "Manual knowledge retrieval"];
const COPARTNER = ["Partner-led expertise", "Practice-specific intelligence", "Shared infrastructure", "Cross-domain capability", "Intelligent workflow", "Human-controlled decisions"];

export default function StructuralShift() {
  return (
    <section id="platform" className="py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading title="Legal practice is changing." />
        <div className="mt-16 grid md:grid-cols-2 gap-px rounded-2xl overflow-hidden border border-border bg-border">
          <Reveal className="bg-bg-2 p-8 md:p-10">
            <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase mb-6">Traditional Model</p>
            <ul className="space-y-4">
              {TRADITIONAL.map((item) => (
                <li key={item} className="flex items-start gap-3 text-muted">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="bg-bg-2 p-8 md:p-10" delay={120}>
            <p className="text-xs font-semibold tracking-[0.2em] text-cyan uppercase mb-6">CoPartner Model</p>
            <ul className="space-y-4">
              {COPARTNER.map((item) => (
                <li key={item} className="flex items-start gap-3 text-ink">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
