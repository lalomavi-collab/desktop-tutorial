import { SECURITY_ITEMS } from "../lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function SecurityArchitecture() {
  return (
    <section className="py-24 md:py-32 border-t border-border bg-bg-2">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading align="center" title="Intelligence without compromising trust." />

        <Reveal delay={120} className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECURITY_ITEMS.map((item) => (
            <div key={item} className="rounded-xl border border-border bg-surface px-5 py-4 text-sm font-medium text-ink">
              {item}
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
