import { BRAND } from "../lib/content";
import Reveal from "./Reveal";

export default function HumanJudgment() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold text-ink">AI does not get the final word.</h2>
        </Reveal>

        <div className="mt-14 grid md:grid-cols-2 gap-6">
          <Reveal className="rounded-2xl border border-border bg-surface p-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-cyan uppercase mb-5">AI</p>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-ink">
              {["Analyze", "Structure", "Flag", "Recommend"].map((s) => (
                <span key={s} className="rounded-full border border-cyan/30 bg-cyan/5 px-4 py-2">{s}</span>
              ))}
            </div>
          </Reveal>
          <Reveal className="rounded-2xl border border-gold/30 bg-gold/5 p-8" delay={120}>
            <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase mb-5">Partner</p>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-ink">
              {["Review", "Decide", "Approve"].map((s) => (
                <span key={s} className="rounded-full border border-gold/40 bg-gold/10 px-4 py-2">{s}</span>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={220} className="mt-14 text-lg md:text-2xl font-bold text-ink whitespace-pre-line">
          {BRAND.principle}
        </Reveal>
      </div>
    </section>
  );
}
