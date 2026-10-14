// Re-running a matter's analysis under another practice area (migration 0046). The analysis itself comes from the
// pipeline's analyze route; this only decides which documents take part and walks them one at a time.
import { runBulk, type BulkResult } from "./bulk";

/** The document types the risk rules were written for, as in the matter rollup (0042). A document with no type yet takes part. */
export const ASSESSED_TYPES = ["CONTRACT", "COURT_FILING"];
export const isAssessed = (docType: string | null | undefined): boolean => !docType || ASSESSED_TYPES.includes(docType);

export interface ReDoc { id: string; doc_type?: string | null; editor_content: string }
export interface Analysis { practice_area?: string; findings: unknown[]; risk: { level: string; score: number; red: number; yellow: number; green: number } }
export type Analyze = (text: string, area: string) => Promise<{ ok: boolean; analysis?: Analysis; error?: string }>;
export type Store = (docId: string, analysis: Analysis, area: string) => Promise<{ ok: boolean; error?: string }>;

/** What to run: each document with the area it gets. A document-level choice wins over its type's choice; no choice means the document is left alone. */
export interface PlanItem { doc: ReDoc; area: string }
export const UNTYPED = "";
export function buildPlan(docs: ReDoc[], typeAreas: Record<string, string>, docAreas: Record<string, string>): PlanItem[] {
  const out: PlanItem[] = [];
  for (const d of docs) {
    if (d.editor_content.trim().length === 0) continue;
    const area = docAreas[d.id] || typeAreas[d.doc_type ?? UNTYPED] || "";
    if (area) out.push({ doc: d, area });
  }
  return out;
}
/** Counts by type for the type rows of the panel, untyped documents under UNTYPED. */
export function countByType(docs: ReDoc[]): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const d of docs) m.set(d.doc_type ?? UNTYPED, (m.get(d.doc_type ?? UNTYPED) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export const eligibleDocs = <T extends ReDoc>(docs: T[]): T[] => docs.filter((d) => isAssessed(d.doc_type) && d.editor_content.trim().length > 0);

/** The plan, one document at a time, each under its own area. */
export async function reanalyzePlan(plan: PlanItem[], analyze: Analyze, store: Store, onStep?: (n: number, total: number) => void): Promise<BulkResult> {
  const byId = new Map(plan.map((p) => [p.doc.id, p]));
  return runBulk(plan.map((p) => p.doc.id), async (id) => {
    const p = byId.get(id) as PlanItem;
    const a = await analyze(p.doc.editor_content, p.area);
    if (!a.ok || !a.analysis) return { ok: false, error: a.error ?? "הניתוח נכשל." };
    return store(id, a.analysis, p.area);
  }, onStep);
}

/** One document at a time: analyse, then store. A failure on one is reported by id and does not stop the rest. */
export async function reanalyzeDocs(docs: ReDoc[], area: string, analyze: Analyze, store: Store, onStep?: (n: number, total: number) => void): Promise<BulkResult> {
  const byId = new Map(docs.map((d) => [d.id, d]));
  return runBulk(docs.map((d) => d.id), async (id) => {
    const d = byId.get(id) as ReDoc;
    const a = await analyze(d.editor_content, area);
    if (!a.ok || !a.analysis) return { ok: false, error: a.error ?? "הניתוח נכשל." };
    return store(id, a.analysis, area);
  }, onStep);
}
