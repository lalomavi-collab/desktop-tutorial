// Re-running a matter's analysis under another practice area (migration 0046). The analysis itself comes from the
// pipeline's analyze route; this only decides which documents take part and walks them one at a time.
import { runBulk, type BulkResult } from "./bulk";

/** The document types the risk rules were written for, as in the matter rollup (0042). A document with no type yet takes part. */
export const ASSESSED_TYPES = ["CONTRACT", "COURT_FILING"];
export const isAssessed = (docType: string | null | undefined): boolean => !docType || ASSESSED_TYPES.includes(docType);

export interface ReDoc { id: string; doc_type?: string | null; editor_content: string }
export interface Analysis { findings: unknown[]; risk: { level: string; score: number; red: number; yellow: number; green: number } }
export type Analyze = (text: string, area: string) => Promise<{ ok: boolean; analysis?: Analysis; error?: string }>;
export type Store = (docId: string, analysis: Analysis, area: string) => Promise<{ ok: boolean; error?: string }>;

export const eligibleDocs = <T extends ReDoc>(docs: T[]): T[] => docs.filter((d) => isAssessed(d.doc_type) && d.editor_content.trim().length > 0);

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
