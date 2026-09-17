import { LAYERS } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function LayerArchitecture() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading align="center" title="One platform. Three layers of intelligence." />
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {LAYERS.map((layer, i) => (
            <Reveal key={layer.key} delay={i * 100}>
              <div className="h-full rounded-2xl border border-border bg-surface p-8 hover:border-cyan/40 transition-colors">
                <span className="text-sm font-mono text-cyan">{layer.n}</span>
                <h3 className="mt-3 text-2xl font-bold text-ink">{layer.title}</h3>
                <p className="mt-1 text-sm text-muted">{layer.tag}</p>
                <p className="mt-4 text-sm text-muted leading-relaxed">{layer.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 text-center text-sm text-muted" delay={300}>
          Partner, Intelligence and Platform. Not a linear handoff. A continuous relationship.
        </Reveal>
      </div>
    </section>
  );
}
