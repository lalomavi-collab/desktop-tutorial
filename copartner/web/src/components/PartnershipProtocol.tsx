import { PROTOCOL_STAGES } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function PartnershipProtocol() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading align="center" eyebrow="Partnership Protocol" title="From confidential submission to launch." />
        <Reveal delay={150} className="mt-14 flex flex-col gap-4">
          {PROTOCOL_STAGES.map((stage) => (
            <div key={stage.n} className="flex items-start gap-5 rounded-xl border border-border bg-surface p-5">
              <span className="font-mono text-cyan text-sm">{stage.n}</span>
              <div>
                <p className="font-semibold text-ink">{stage.title}</p>
                <p className="text-sm text-muted mt-1">{stage.body}</p>
              </div>
            </div>
          ))}
        </Reveal>
        <Reveal delay={300} className="mt-8 text-center text-sm text-muted">
          Timeline depends on practice complexity.
        </Reveal>
      </div>
    </section>
  );
}
