// Bulk move to the recycle bin. Sequential on purpose: each item is its own audited database call, so a failure
// on one (legal hold, no permission) never hides the others, and the result says exactly which ones did not move.
export interface BulkResult { done: string[]; failed: { id: string; error: string }[] }

export async function runBulk(
  ids: string[],
  act: (id: string) => Promise<{ ok: boolean; error?: string }>,
  onStep?: (n: number, total: number) => void,
): Promise<BulkResult> {
  const out: BulkResult = { done: [], failed: [] };
  const seen = new Set<string>();
  const list = ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
  for (let i = 0; i < list.length; i++) {
    let r: { ok: boolean; error?: string };
    try { r = await act(list[i]); } catch { r = { ok: false, error: "הפעולה נכשלה." }; }
    if (r.ok) out.done.push(list[i]); else out.failed.push({ id: list[i], error: r.error ?? "הפעולה נכשלה." });
    onStep?.(i + 1, list.length);
  }
  return out;
}

/** Toggle one id in a selection, or select/clear a whole visible set. */
export function toggle(sel: ReadonlySet<string>, id: string): Set<string> {
  const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); return n;
}
export function setAll(visible: string[], on: boolean): Set<string> { return new Set(on ? visible : []); }
