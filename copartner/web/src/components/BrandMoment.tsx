import { BRAND } from "../lib/content";
import Reveal from "./Reveal";

export default function BrandMoment() {
  return (
    <section className="py-28 md:py-40 bg-black">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <Reveal>
          <p className="text-sm md:text-base text-muted leading-relaxed uppercase tracking-wide">
            What do you do with the knowledge you spent 20 years building?
          </p>
        </Reveal>
        <Reveal delay={250}>
          <p className="mt-8 text-lg md:text-xl text-ink font-semibold">You build a system around it.</p>
        </Reveal>
        <Reveal delay={500}>
          <p className="mt-10 text-3xl md:text-5xl font-display font-bold text-ink">{BRAND.name}</p>
        </Reveal>
      </div>
    </section>
  );
}
