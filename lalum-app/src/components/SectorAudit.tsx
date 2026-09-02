import { Diagnostic } from "./Diagnostic";
import type { AuditBand, AuditQuestion } from "../lib/sectors";

// The sector self-assessment. All of the behaviour lives in the shared
// diagnostic engine, which the tools on the AI pillar use as well; this stays
// as its own name because the sector page reads better for it, and because a
// sector may later want to hand the engine something the tools do not.
export function SectorAudit({ questions, bands }: { questions: AuditQuestion[]; bands: AuditBand[] }) {
  return <Diagnostic questions={questions} bands={bands} />;
}
