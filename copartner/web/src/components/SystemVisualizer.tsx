import { BRAND } from "../lib/content";
import Reveal from "./Reveal";

const CHAIN = [
  { label: "Domain Leader", tone: "gold" as const },
  { label: "Practice-Specific AI Engine", tone: "cyan" as const, branch: "30+ Domain Network" },
  { label: "Specialized Team Review", tone: "cyan" as const },
  { label: "Human Judgment Sign-Off", tone: "gold" as const },
  { label: "Enterprise Client", tone: "muted" as const },
];

function Dot({ tone }: { tone: "gold" | "cyan" | "muted" }) {
  const color = tone === "gold" ? "bg-gold" : tone === "cyan" ? "bg-cyan" : "bg-muted";
  const pulse = tone === "muted" ? "" : "animate-pulse-slow";
  return <span className={`relative z-10 block h-3.5 w-3.5 rounded-full ${color} ${pulse} ring-4 ring-bg`} />;
}

export default function SystemVisualizer() {
  return (
    <Reveal className="mx-auto w-full max-w-md" delay={150}>
      <div role="img" aria-label="Domain Leader connects to a Practice-Specific AI Engine, which links to the 30+ domain network, then to Specialized Team Review, then to Human Judgment Sign-Off, then to the Enterprise Client.">
        <ol aria-hidden="true" className="relative border-s border-border ps-6 space-y-7">
          {CHAIN.map((node) => (
            <li key={node.label} className="relative">
              <span className="absolute -start-[31px] top-1"><Dot tone={node.tone} /></span>
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <p className="text-sm font-semibold text-ink">{node.label}</p>
              </div>
              {node.branch && (
                <div className="mt-2 ms-4 flex items-center gap-2 text-xs text-cyan">
                  <span aria-hidden="true">↔</span>
                  <span className="rounded-lg border border-cyan/30 bg-cyan/5 px-3 py-1.5">{node.branch}</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-8 text-center text-xs md:text-sm font-semibold tracking-wide text-muted whitespace-pre-line">
        {BRAND.principle}
      </p>
    </Reveal>
  );
}
