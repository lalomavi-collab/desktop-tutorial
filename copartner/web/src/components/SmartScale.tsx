import { SCALE_COMPARISON } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

function Chain({ label, items, accent }: { label: string; items: readonly string[]; accent: boolean }) {
  return (
    <div className={`rounded-2xl border p-8 ${accent ? "border-cyan/30 bg-cyan/5" : "border-border bg-surface"}`}>
      <p className={`text-xs font-semibold tracking-[0.2em] uppercase mb-6 ${accent ? "text-cyan" : "text-muted"}`}>{label}</p>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={item} className="flex items-center gap-3">
            <span className={`text-sm ${accent ? "text-ink" : "text-muted"}`}>{item}</span>
            {i < items.length - 1 && <span aria-hidden="true" className="text-muted">↓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SmartScale() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          align="center"
          title="Scale capability, not bureaucracy."
          subtitle="The platform is designed to reduce dependence on unnecessary fixed infrastructure, and to let professional capability scale through technology and network access."
        />
        <div className="mt-16 grid md:grid-cols-2 gap-6">
          <Reveal><Chain label={SCALE_COMPARISON.traditional.label} items={SCALE_COMPARISON.traditional.chain} accent={false} /></Reveal>
          <Reveal delay={120}><Chain label={SCALE_COMPARISON.copartner.label} items={SCALE_COMPARISON.copartner.chain} accent /></Reveal>
        </div>
      </div>
    </section>
  );
}
