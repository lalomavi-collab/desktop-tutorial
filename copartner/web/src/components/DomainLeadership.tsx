import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const PARTNER_BRINGS = ["Expertise", "Methodology", "Professional judgment", "Network", "Client capability", "Domain knowledge"];
const COPARTNER_BRINGS = ["AI infrastructure", "Knowledge architecture", "Workflow systems", "Cross-domain connectivity", "Operational infrastructure", "Technology and platform environment"];

export default function DomainLeadership() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading align="center" title="Expertise becomes infrastructure." subtitle="A Domain Leader does not simply join a directory." />

        <div className="mt-14 grid md:grid-cols-2 gap-6">
          <Reveal className="rounded-2xl border border-gold/30 bg-gold/5 p-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase mb-5">The Partner Contributes</p>
            <ul className="space-y-3">
              {PARTNER_BRINGS.map((i) => <li key={i} className="text-sm text-ink">{i}</li>)}
            </ul>
          </Reveal>
          <Reveal delay={120} className="rounded-2xl border border-cyan/30 bg-cyan/5 p-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-cyan uppercase mb-5">CoPartner Contributes</p>
            <ul className="space-y-3">
              {COPARTNER_BRINGS.map((i) => <li key={i} className="text-sm text-ink">{i}</li>)}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={220} className="mt-12 flex justify-center">
          <a
            href="#apply"
            className="inline-flex items-center justify-center rounded-full bg-cyan text-bg px-7 py-3.5 text-sm font-bold tracking-wide hover:opacity-90 transition-opacity focus-ring"
          >
            APPLY TO LEAD A DOMAIN
          </a>
        </Reveal>
      </div>
    </section>
  );
}
