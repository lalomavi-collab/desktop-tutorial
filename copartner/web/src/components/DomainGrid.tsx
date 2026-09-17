import { DOMAINS } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function DomainGrid() {
  return (
    <section className="py-24 md:py-32 border-t border-border bg-bg-2">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Domain Network"
          title="Every domain, one architecture."
          subtitle="A growing network of legal domains, each with its own methodology, knowledge base and AI engine. Most are open for a practitioner to lead."
        />

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOMAINS.map((d, i) => {
            const assigned = d.status === "assigned";
            return (
              <Reveal key={d.name} delay={(i % 6) * 60}>
                <div
                  className={`h-full rounded-xl border p-5 transition-colors ${
                    assigned ? "border-gold/40 bg-gold/5" : "border-border bg-surface hover:border-cyan/40"
                  }`}
                >
                  <p className="font-semibold text-ink">{d.name}</p>
                  <p className={`mt-2 text-xs font-semibold tracking-wide uppercase ${assigned ? "text-gold" : "text-cyan"}`}>
                    {assigned ? "Domain Assigned" : "Open for Domain Leadership"}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
