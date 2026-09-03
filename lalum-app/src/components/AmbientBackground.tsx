import { ClauseScan } from "./ClauseScan";
import { DecisionLattice } from "./DecisionLattice";

// Ambient hero backdrop, built entirely in the browser: no media file, no
// network request, and it freezes under prefers-reduced-motion. Sits behind
// hero content (give the content position:relative and a z-index so it stacks
// above this layer).
//
// Three variants:
//   "clauses"  contract lines under a passing light, two of them flagged. The
//              page people land on, because it says what the practice does
//              before a word is read.
//   "lattice"  a sparse decision graph with a signal travelling through it.
//   "warm"     slow drifting light blobs. Pleasant, and says nothing, which is
//              why it stayed only where the page's own content carries the
//              message.
export function AmbientBackground({ variant = "warm" }: { variant?: "warm" | "lattice" | "clauses" }) {
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
      <span className="ambient-grain" />
      <span className="ambient-scrim" />
    </div>
  );
}
