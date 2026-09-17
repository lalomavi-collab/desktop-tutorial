import { RED_FLAG_TRIGGERS } from "../lib/content";
import Reveal from "./Reveal";

export default function RedFlagProtocol() {
  return (
    <section className="py-24 md:py-32 border-t border-border bg-bg-2">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-8 py-6 flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs font-semibold tracking-[0.25em] text-muted uppercase">Review Required</p>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan/40 px-3 py-1 text-xs font-semibold text-cyan">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse-slow" aria-hidden="true" />
              AI can stop and escalate
            </span>
          </div>

          <div className="p-8 grid sm:grid-cols-2 gap-3">
            {RED_FLAG_TRIGGERS.map((t) => (
              <div key={t} className="rounded-lg border border-border px-4 py-3 text-sm text-muted">{t}</div>
            ))}
          </div>

          <div className="border-t border-border px-8 py-8 flex flex-col md:flex-row items-center justify-center gap-6 text-center">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">AI Status</p>
              <p className="mt-1 text-lg font-bold text-cyan">Review Required</p>
            </div>
            <span aria-hidden="true" className="text-muted">→</span>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Next</p>
              <p className="mt-1 text-lg font-bold text-gold">Partner Review</p>
            </div>
          </div>
        </Reveal>

        <p className="mt-6 text-center text-sm text-muted max-w-2xl mx-auto">
          The platform is designed around controlled legal intelligence, not unrestricted automation.
        </p>
      </div>
    </section>
  );
}
