import { ClauseScan } from "./ClauseScan";
import { DecisionLattice } from "./DecisionLattice";

// Ambient hero backdrop. Sits behind hero content (give the content
// position:relative and a z-index so it stacks above this layer).
//
// Four variants:
//   "clauses"  contract lines under a passing light, two of them flagged. The
//              page people land on, because it says what the practice does
//              before a word is read.
//   "lattice"  a sparse decision graph with a signal travelling through it.
//   "warm"     slow drifting light blobs. Pleasant, and says nothing, which is
//              why it stayed only where the page's own content carries the
//              message.
//   "photo"    the home hero only. A single static image (an unrelated crop,
//              no wordmark or text in frame, per the Logo: Single Source
//              rule), under the same scrim treatment as the drawn variants so
//              it reads as part of the same system rather than a photo pasted
//              on top of it.
// The three drawn variants are built entirely in the browser: no media file,
// no network request, and they freeze under prefers-reduced-motion.
export function AmbientBackground({ variant = "warm" }: { variant?: "warm" | "lattice" | "clauses" | "photo" }) {
  return (
    <div className={"ambient ambient-" + variant} aria-hidden="true">
      {variant === "lattice" && <DecisionLattice />}
      {variant === "clauses" && <ClauseScan />}
      {variant === "warm" && (
        <>
          <span className="ambient-blob ambient-b1" />
          <span className="ambient-blob ambient-b2" />
          <span className="ambient-blob ambient-b3" />
          <span className="ambient-sweep" />
        </>
      )}
      {variant === "photo" && (
        <img src="/hero-legal-algorist.webp" alt="" className="ambient-photo-img" loading="eager" fetchPriority="high" />
      )}
      {variant !== "photo" && <span className="ambient-grain" />}
      <span className="ambient-scrim" />
    </div>
  );
}
