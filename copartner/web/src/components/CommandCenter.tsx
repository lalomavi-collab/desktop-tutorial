import { COMMAND_ITEMS } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const TONE_CLASS: Record<string, string> = {
  cyan: "border-cyan/40 text-cyan bg-cyan/5",
  gold: "border-gold/40 text-gold bg-gold/5",
  muted: "border-border text-muted bg-surface",
};

export default function CommandCenter() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading align="center" title="What needs your attention?" subtitle="The Legal Command Center is designed around decisions, not dashboards." />

        <Reveal delay={150} className="mt-14 rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
          {COMMAND_ITEMS.map((item) => (
            <div key={item.title} className="flex flex-col sm:flex-row sm:items-center gap-3 p-5">
              <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${TONE_CLASS[item.tone]}`}>
                {item.tag}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="text-sm text-muted">{item.detail}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
